import type { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import type { MessageRecord } from '../../engine/types';
import { socialHashText } from '../../engine/social/SocialMemoryLedger';
import { pulseOutreachOptions, type PulseOutreachMotive } from './PulseOutreachContent';
import { formatPulseNewsLine, realizePulseReply } from './PulseVoice';
import { createSimulationNarrative } from '../../narrative/SimulationNarrativeAdapter';
import { DEFAULT_NARRATIVE_FLOWS, PULSE_CONTEXTUAL_FLOWS, PULSE_FOLLOWUP_FLOWS, PULSE_OUTREACH_REPLY_FLOW, PULSE_OUTREACH_NEWS_REPLY_FLOW, PULSE_OUTREACH_PROMISE_REPLY_FLOW, PULSE_OUTREACH_SHARED_REPLY_FLOW } from '../../narrative/flows';
import type { NarrativeFlowDefinition } from '../../narrative/NarrativeCoordinator';
import type { SimulationPulseNarrativeCommand, SimulationPulseNarrativeResult } from './SimulationHostProtocol';

const MAX_CHOICES = 8;
const MIN_REPLY_WAIT_MINUTES = 10;
const MAX_CONTACT_CHECK = 100;
const MAX_DELIVERIES_PER_ADVANCE = 4;
const MAX_OUTREACH_CANDIDATES_PER_DAY = 2;
const OUTREACH_COOLDOWN_MINUTES = 2 * 1440;
const MARKER = 'pulse:v2:';
const firstFlows = [
  DEFAULT_NARRATIVE_FLOWS.find(flow => flow.flowId === 'pulse_checkin')!,
  ...Object.values(PULSE_CONTEXTUAL_FLOWS),
];
const allFlows = [...firstFlows, ...PULSE_FOLLOWUP_FLOWS, PULSE_OUTREACH_REPLY_FLOW, PULSE_OUTREACH_NEWS_REPLY_FLOW, PULSE_OUTREACH_PROMISE_REPLY_FLOW, PULSE_OUTREACH_SHARED_REPLY_FLOW];
const flowById = new Map(allFlows.map(flow => [flow.flowId, flow]));

type Thread =
  | { stage: 'first' }
  | { stage: 'second'; topic: number }
  | { stage: 'outreach' }
  | { stage: 'waiting_first'; topic: number; flowId: string; sentMinute: number }
  | { stage: 'waiting_second'; topic: number; replyIndex: number; sentMinute: number }
  | { stage: 'waiting_outreach'; replyIndex: number; sentMinute: number }
  | { stage: 'complete' };

function totalMinutes(engine: SimulationKernel): number {
  const { day, hour, minute } = engine.getChromeRead().time;
  return (day - 1) * 1440 + hour * 60 + minute;
}

function latest(engine: SimulationKernel, actorId: string, accountId?: string): MessageRecord | null {
  return engine.getConversationRead(actorId, 0, 1, accountId).messages.at(-1) ?? null;
}

/** The canonical Social transcript is the only thread bookmark, including
 * across cold saves. Never persist a second React/Worker chat cursor.
 */
function thread(engine: SimulationKernel, actorId: string, accountId?: string): Thread {
  const last = latest(engine, actorId, accountId);
  if (!last) return { stage: 'first' };
  const marker = last.tags?.find(tag => tag.startsWith(MARKER));
  if (!marker) return { stage: 'first' };
  if (marker === 'pulse:v2:closed' && last.senderId === actorId) {
    const currentDay = engine.getChromeRead().time.day;
    return last.day === currentDay ? { stage: 'complete' } : { stage: 'first' };
  }
  const outreach = /^pulse:v2:outreach:(promise|shared|trusted|remote|diner|canal|shift|hello|news)$/.exec(marker);
  if (outreach && last.senderId === actorId) return { stage: 'outreach' };
  const outboundOutreach = /^pulse:v2:outreach_out:([0-2])$/.exec(marker);
  if (outboundOutreach && last.senderId === 'player') {
    return { stage: 'waiting_outreach', replyIndex: Number(outboundOutreach[1]), sentMinute: last.timestampMinute };
  }
  const response = /^pulse:v2:response:([0-2])$/.exec(marker);
  if (response && last.senderId === actorId) {
    return { stage: 'second', topic: Number(response[1]) };
  }
  const first = /^pulse:v2:open:([0-2]):(pulse_[a-z_]+)$/.exec(marker);
  if (first && last.senderId === 'player' && first[2] && firstFlows.some(f => f.flowId === first[2])) {
    return { stage: 'waiting_first', topic: Number(first[1]), flowId: first[2], sentMinute: last.timestampMinute };
  }
  const second = /^pulse:v2:followup_out:([0-2]):([0-2])$/.exec(marker);
  if (second && last.senderId === 'player') {
    return { stage: 'waiting_second', topic: Number(second[1]), replyIndex: Number(second[2]), sentMinute: last.timestampMinute };
  }
  return { stage: 'first' };
}

function authorize(engine: SimulationKernel, actorId: string, accountId?: string) {
  if (!actorId || actorId.length > 128 || !engine.social.isKnown(actorId)
    || (accountId && !engine.social.hasPulseBuddy(accountId, actorId))) {
    throw new Error('This contact is not in your buddy list.');
  }
  const actor = engine.getPlayerActorRead(actorId)?.actor;
  if (!actor || actor.lifecycle === 'departed' || actor.connection === 'blocked') {
    throw new Error('This contact is unavailable.');
  }
  return actor;
}

function firstFlow(engine: SimulationKernel, actorId: string, accountId?: string): NarrativeFlowDefinition {
  const actor = authorize(engine, actorId, accountId);
  // A fresh screen name is not automatically the known physical player.
  // Do not expose promises/trust/remembered personal facts across aliases.
  if (accountId) return firstFlows[0]!;
  const shared = engine.social.getCoreMemories(actorId).some(memory =>
    memory.kind === 'shared_moment'
    && memory.meaning?.participants.includes('player')
    && memory.meaning.participants.includes(actorId));
  const key = actor.relationship.conflicted ? 'repair'
    : shared ? 'reminisce'
    : actor.relationship.trusted ? 'trusted'
    : actor.reach === 'remote' ? 'remote'
    : actor.roles.includes('diner-staff') ? 'nearby'
    : actor.roles.includes('canal-regular') ? 'night'
    : actor.roles.includes('shift-worker') ? 'shift'
    : null;
  return (key && PULSE_CONTEXTUAL_FLOWS[key]) || firstFlows[0]!;
}

/** Recheck the NPC outreach motive against canonical Social/World truth.
 * A promise that was resolved or a memory not actually shared with the player
 * cannot sustain its contextual claim. The Social transcript is the sole
 * bookmark across immediate replies, delayed delivery and cold saves.
 */
function outreachReplyFlow(engine: SimulationKernel, actorId: string): NarrativeFlowDefinition {
  const rows = engine.getConversationRead(actorId, 0, 2).messages;
  const last = rows.at(-1);
  const source = last?.senderId === actorId ? last
    : last?.senderId === 'player' && last.tags?.some(tag => /^pulse:v2:outreach_out:[0-2]$/.test(tag))
      ? rows.at(-2) : null;
  if (source?.senderId !== actorId) return PULSE_OUTREACH_REPLY_FLOW;
  if (source.tags?.includes('pulse:v2:outreach:promise')) {
    return engine.social.getOpenPromises(actorId).length > 0
      ? PULSE_OUTREACH_PROMISE_REPLY_FLOW : PULSE_OUTREACH_REPLY_FLOW;
  }
  if (source.tags?.includes('pulse:v2:outreach:shared')) {
    const genuinelyShared = engine.social.getCoreMemories(actorId).some(memory =>
      memory.kind === 'shared_moment'
      && memory.meaning?.participants.includes('player')
      && memory.meaning.participants.includes(actorId));
    return genuinelyShared ? PULSE_OUTREACH_SHARED_REPLY_FLOW : PULSE_OUTREACH_REPLY_FLOW;
  }
  if (!source.tags?.includes('pulse:v2:outreach:news')) return PULSE_OUTREACH_REPLY_FLOW;
  const eventTag = source.tags.find(tag => tag.startsWith('world_event:'));
  const eventId = eventTag?.slice('world_event:'.length);
  if (!eventId || eventId.length > 128) return PULSE_OUTREACH_REPLY_FLOW;
  const now = totalMinutes(engine);
  const learned = engine.world.getBuddyKnowledge(actorId).some(entry =>
    entry.eventId === eventId && entry.learnedAtMinute <= now);
  if (!learned) return PULSE_OUTREACH_REPLY_FLOW;
  const realEvent = engine.world.getTriggeredEventsForIds(
    new Set([eventId]), engine.getChromeRead().time.day,
  ).some(event => event.id === eventId && (event.triggeredAtMinute ?? Number.POSITIVE_INFINITY) <= now);
  return realEvent ? PULSE_OUTREACH_NEWS_REPLY_FLOW : PULSE_OUTREACH_REPLY_FLOW;
}

function flowFor(state: Thread, engine: SimulationKernel, actorId: string, accountId?: string): NarrativeFlowDefinition | null {
  if (state.stage === 'first') return firstFlow(engine, actorId, accountId);
  if (state.stage === 'second') return PULSE_FOLLOWUP_FLOWS[state.topic] ?? null;
  if (state.stage === 'outreach') return outreachReplyFlow(engine, actorId);
  return null;
}

function openInk(engine: SimulationKernel, actorId: string, flow: NarrativeFlowDefinition) {
  const { coordinator } = createSimulationNarrative(engine, [flow]);
  const started = coordinator.handleSemanticEvent({
    kind: 'conversation_started', channel: 'pulse', actorId,
  });
  if (!started.started) throw new Error('Authored conversation unavailable.');
  const frame = coordinator.advanceToChoices();
  const choices = frame.choices.slice(0, MAX_CHOICES).map(choice => ({
    id: choice.id, text: choice.text.trim().slice(0, 180),
  }));
  if (!choices.length) throw new Error('No authored choices available.');
  return { coordinator, choices };
}

function responseFor(engine: SimulationKernel, actorId: string, flow: NarrativeFlowDefinition, index: number): string {
  const { coordinator, choices } = openInk(engine, actorId, flow);
  if (!Number.isInteger(index) || index < 0 || index >= choices.length) throw new Error('Invalid narrative reply.');
  const chosen = coordinator.choose(index);
  const response = chosen.canContinue && chosen.choices.length === 0
    ? coordinator.advanceToChoices() : chosen;
  const authored = response.text.trim().slice(0, 500);
  const buddy = engine.social.getBuddy(actorId);
  return buddy ? realizePulseReply(authored, buddy.traits).slice(0, 500) : authored;
}

function receive(engine: SimulationKernel, actorId: string, text: string, tags: string[], accountId?: string) {
  if (!text) throw new Error('Authored reply was empty.');
  const result = engine.dispatchAction({
    type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: actorId, text, pulseAccountId: accountId,
    tags: ['ink_pulse', 'authored', ...tags],
  });
  if (!result.success) throw new Error(result.error ?? 'Unable to deliver authored reply.');
}

function deliver(engine: SimulationKernel, actorId: string, state: Extract<Thread, { stage: 'waiting_first' | 'waiting_second' | 'waiting_outreach' }>, accountId?: string): string {
  const flow = state.stage === 'waiting_first'
    ? flowById.get(state.flowId)
    : state.stage === 'waiting_second' ? PULSE_FOLLOWUP_FLOWS[state.topic]
    : outreachReplyFlow(engine, actorId);
  if (!flow) throw new Error('Unknown authored thread.');
  const text = responseFor(engine, actorId, flow,
    state.stage === 'waiting_first' ? state.topic : state.replyIndex);
  const tag = state.stage === 'waiting_first'
    ? `pulse:v2:response:${state.topic}` : 'pulse:v2:closed';
  receive(engine, actorId, text, [tag], accountId);
  return text;
}

function view(engine: SimulationKernel, actorId: string, accountId?: string): SimulationPulseNarrativeResult {
  const state = thread(engine, actorId, accountId);
  const flow = flowFor(state, engine, actorId, accountId);
  return {
    revision: engine.getMessengerRead(0).revision,
    actorId,
    phase: state.stage,
    choices: flow ? openInk(engine, actorId, flow).choices : [],
  };
}

/** Deterministic, bounded delivery on actual world-minute advances. No UI
 * polling or fake instant replies for unavailable contacts. Social alone
 * owns time-stamped messages; this module computes eligible reactions.
 */
export function deliverPendingPulseReplies(engine: SimulationKernel): number {
  let delivered = 0;
  const accounts: Array<string | undefined> = [undefined, ...engine.social.getPulseAccountIds()];
  for (const accountId of accounts) {
    for (const contact of engine.getMessengerRead(MAX_CONTACT_CHECK, accountId).contacts) {
    if (delivered >= MAX_DELIVERIES_PER_ADVANCE) return delivered;
    const id = contact.actorId;
    const state = thread(engine, id, accountId);
    if (state.stage !== 'waiting_first' && state.stage !== 'waiting_second' && state.stage !== 'waiting_outreach') continue;
    if (totalMinutes(engine) - state.sentMinute < MIN_REPLY_WAIT_MINUTES) continue;
    const actor = engine.getPlayerActorRead(id)?.actor;
    if (!actor?.canChatNow.allowed) continue;
    deliver(engine, id, state, accountId);
    delivered += 1;
    }
  }
  return delivered;
}

/** A recent World-owned event may be discussed only by a person with a
 * matching learned-event record. No global event feed is treated as something
 * every actor knows, and no untyped memory text is promoted to an event.
 */
function recentKnownPulseEvent(engine: SimulationKernel, actorId: string, now: number) {
  const learned = engine.world.getBuddyKnowledge(actorId)
    .filter(entry => entry.learnedAtMinute <= now && now - entry.learnedAtMinute <= 2 * 1440);
  if (!learned.length) return null;
  const events = engine.world.getTriggeredEventsForIds(
    new Set(learned.map(entry => entry.eventId)), engine.getChromeRead().time.day,
  );
  const byId = new Map(events.map(event => [event.id, event]));
  const newestFirst = learned.sort((a, b) =>
    b.learnedAtMinute - a.learnedAtMinute || a.eventId.localeCompare(b.eventId));
  for (const entry of newestFirst) {
    const event = byId.get(entry.eventId);
    if (event && (event.triggeredAtMinute ?? Number.POSITIVE_INFINITY) <= now) {
      return { event, attitude: entry.attitude };
    }
  }
  return null;
}

/** A very small, deterministic world-initiated chat opportunity.
 * At most two known candidates may initiate on a given world day. A real
 * conversation, busy/blocked NPC, or recent exchange excludes the actor.
 * The only bookmark is a canonical inbound Social message tag.
 */
export function initiateWorkerPulseOutreach(engine: SimulationKernel): number {
  const time = engine.getChromeRead();
  const { day, hour } = time.time;
  if (!time.pulseInstalled || day < 2 || hour < 9 || hour >= 23) return 0;
  const now = totalMinutes(engine);
  const candidates = engine.getMessengerRead(MAX_CONTACT_CHECK).contacts
    .map(row => ({ id: row.actorId, order: socialHashText(row.actorId + ':outreach:' + day) }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .slice(0, MAX_OUTREACH_CANDIDATES_PER_DAY);
  let initiated = 0;
  for (const { id } of candidates) {
    if (thread(engine, id).stage !== 'first') continue;
    if (engine.social.hasConversationMessageOnDay(id, day)) continue;
    const previous = latest(engine, id);
    if (previous && now - previous.timestampMinute < OUTREACH_COOLDOWN_MINUTES) continue;
    const actor = engine.getPlayerActorRead(id)?.actor;
    if (!actor || actor.lifecycle === 'departed' ||
      actor.connection === 'blocked' || actor.connection === 'distant' ||
      actor.relationship.conflicted || !actor.canChatNow.allowed) continue;
    const buddy = engine.social.getBuddy(id);
    if (!buddy) continue;
    const mood = engine.social.getDailyMood(id, day);
    if (mood === 'cold' || mood === 'off') continue;
    const promise = engine.social.getOpenPromises(id).length > 0;
    // No untyped memory text may be promoted to a supposed shared fact.
    const shared = engine.social.getCoreMemories(id).some(memory =>
      memory.kind === 'shared_moment'
      && memory.meaning?.participants.includes('player')
      && memory.meaning.participants.includes(id));
    const news = !promise && !shared ? recentKnownPulseEvent(engine, id, now) : null;
    const motive: PulseOutreachMotive | 'news' =
      promise ? 'promise'
      : shared ? 'shared'
      : news ? 'news'
      : actor.relationship.trusted ? 'trusted'
      : actor.reach === 'remote' ? 'remote'
      : actor.roles.includes('diner-staff') ? 'diner'
      : actor.roles.includes('canal-regular') ? 'canal'
      : actor.roles.includes('shift-worker') ? 'shift'
      : 'hello';
    const chance = promise || shared ? 90 : news ? 75 : actor.relationship.trusted ? 70 : 45;
    const roll = socialHashText(id + ':outreach:chance:' + day) % 100;
    if (roll >= chance) continue;
    let line: string;
    if (motive === 'news') {
      if (!news) continue;
      line = formatPulseNewsLine(news.event.title, news.attitude, buddy.traits);
    } else {
      const options = pulseOutreachOptions(motive, buddy.traits);
      line = options[socialHashText(id + ':outreach:line:' + day) % options.length]!;
    }
    receive(engine, id, line, [
      'systemic_outreach', 'pulse:v2:outreach:' + motive,
      ...(motive === 'news' && news ? ['world_event:' + news.event.id] : []),
    ]);
    initiated += 1;
  }
  return initiated;
}

/** Reconcile owed replies before any unsolicited new message; only Worker
 * time advancement invokes this. Reading the Pulse UI never generates chat.
 */
export function reconcileWorkerPulseSocial(engine: SimulationKernel): { replies: number; outreach: number } {
  const replies = deliverPendingPulseReplies(engine);
  const outreach = initiateWorkerPulseOutreach(engine);
  return { replies, outreach };
}

export function createWorkerPulseNarrative(engine: SimulationKernel) {
  return {
    run(command: SimulationPulseNarrativeCommand): SimulationPulseNarrativeResult {
      if (!command || !['openAccount', 'addBuddy', 'choices', 'choose'].includes(command.kind)) {
        throw new Error('Invalid Pulse narrative operation.');
      }
      if (!engine.getChromeRead().pulseInstalled) throw new Error('Install Pulse Messenger to chat.');
      if (command.kind === 'openAccount') {
        engine.openPulseAccount(command.accountId);
        return { revision: engine.getRevision(), actorId: '', phase: 'first', choices: [] };
      }
      if (command.kind === 'addBuddy') {
        engine.addPulseBuddy(command.accountId, command.actorId);
        return { revision: engine.getRevision(), actorId: command.actorId, phase: 'first', choices: [] };
      }
      const actor = authorize(engine, command.actorId, command.accountId);
      if (command.kind === 'choices') return view(engine, command.actorId, command.accountId);

      const state = thread(engine, command.actorId, command.accountId);
      const flow = flowFor(state, engine, command.actorId, command.accountId);
      if (!flow) throw new Error('This conversation is waiting or has ended for now.');
      const { choices } = openInk(engine, command.actorId, flow);
      if (!Number.isSafeInteger(command.choiceIndex)
        || command.choiceIndex < 0 || command.choiceIndex >= choices.length
        || typeof command.expectedText !== 'string'
        || choices[command.choiceIndex]?.text !== command.expectedText) {
        throw new Error('This reply is no longer available. Choose another.');
      }
      const first = state.stage === 'first';
      const topic = first ? command.choiceIndex : state.stage === 'second' ? state.topic : 0;
      const tag = first
        ? `pulse:v2:open:${topic}:${flow.flowId}`
        : state.stage === 'outreach' ? `pulse:v2:outreach_out:${command.choiceIndex}`
        : `pulse:v2:followup_out:${topic}:${command.choiceIndex}`;
      const sentText = choices[command.choiceIndex]!.text;
      const sent = engine.dispatchAction({
        type: 'SOCIAL_SEND_MESSAGE', buddyId: command.actorId, text: sentText,
        pulseAccountId: command.accountId,
        tags: ['ink_pulse', 'authored', tag],
      });
      if (!sent.success) throw new Error(sent.error ?? 'Message could not be sent.');
      let reply: string | null = null;
      if (actor.canChatNow.allowed) {
        // Follow-up paths choose the actual reply index; the original first
        // choice index only selects the correct second-turn flow.
        const replyIndex = first ? topic : command.choiceIndex;
        const replyFlow = first ? flow
          : state.stage === 'outreach' ? outreachReplyFlow(engine, command.actorId)
          : PULSE_FOLLOWUP_FLOWS[topic]!;
        const spoken = responseFor(engine, command.actorId, replyFlow, replyIndex);
        receive(engine, command.actorId, spoken, [first ? `pulse:v2:response:${topic}` : 'pulse:v2:closed'], command.accountId);
        reply = spoken;
      }
      return { ...view(engine, command.actorId, command.accountId), sent: sentText, reply };
    },
  };
}

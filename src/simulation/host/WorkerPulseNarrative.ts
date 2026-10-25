import type { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import type { MessageRecord } from '../../engine/types';
import { createSimulationNarrative } from '../../narrative/SimulationNarrativeAdapter';
import { DEFAULT_NARRATIVE_FLOWS, PULSE_CONTEXTUAL_FLOWS, PULSE_FOLLOWUP_FLOWS } from '../../narrative/flows';
import type { NarrativeFlowDefinition } from '../../narrative/NarrativeCoordinator';
import type { SimulationPulseNarrativeCommand, SimulationPulseNarrativeResult } from './SimulationHostProtocol';

const MAX_CHOICES = 8;
const MIN_REPLY_WAIT_MINUTES = 10;
const MAX_CONTACT_CHECK = 100;
const MAX_DELIVERIES_PER_ADVANCE = 4;
const MARKER = 'pulse:v2:';
const firstFlows = [
  DEFAULT_NARRATIVE_FLOWS.find(flow => flow.flowId === 'pulse_checkin')!,
  ...Object.values(PULSE_CONTEXTUAL_FLOWS),
];
const allFlows = [...firstFlows, ...PULSE_FOLLOWUP_FLOWS];
const flowById = new Map(allFlows.map(flow => [flow.flowId, flow]));

type Thread =
  | { stage: 'first' }
  | { stage: 'second'; topic: number }
  | { stage: 'waiting_first'; topic: number; flowId: string; sentMinute: number }
  | { stage: 'waiting_second'; topic: number; sentMinute: number }
  | { stage: 'complete' };

function totalMinutes(engine: SimulationKernel): number {
  const { day, hour, minute } = engine.getChromeRead().time;
  return (day - 1) * 1440 + hour * 60 + minute;
}

function latest(engine: SimulationKernel, actorId: string): MessageRecord | null {
  return engine.getConversationRead(actorId, 0, 1).messages.at(-1) ?? null;
}

/** The canonical Social transcript is the only thread bookmark, including
 * across cold saves. Never persist a second React/Worker chat cursor.
 */
function thread(engine: SimulationKernel, actorId: string): Thread {
  const last = latest(engine, actorId);
  if (!last) return { stage: 'first' };
  const marker = last.tags?.find(tag => tag.startsWith(MARKER));
  if (!marker) return { stage: 'first' };
  if (marker === 'pulse:v2:closed' && last.senderId === actorId) {
    const currentDay = engine.getChromeRead().time.day;
    return last.day === currentDay ? { stage: 'complete' } : { stage: 'first' };
  }
  const response = /^pulse:v2:response:([0-2])$/.exec(marker);
  if (response && last.senderId === actorId) {
    return { stage: 'second', topic: Number(response[1]) };
  }
  const first = /^pulse:v2:open:([0-2]):(pulse_[a-z_]+)$/.exec(marker);
  if (first && last.senderId === 'player' && first[2] && firstFlows.some(f => f.flowId === first[2])) {
    return { stage: 'waiting_first', topic: Number(first[1]), flowId: first[2], sentMinute: last.timestampMinute };
  }
  const second = /^pulse:v2:followup_out:([0-2])$/.exec(marker);
  if (second && last.senderId === 'player') {
    return { stage: 'waiting_second', topic: Number(second[1]), sentMinute: last.timestampMinute };
  }
  return { stage: 'first' };
}

function authorize(engine: SimulationKernel, actorId: string) {
  if (!actorId || actorId.length > 128 || !engine.social.isKnown(actorId)) {
    throw new Error('This contact is not in your buddy list.');
  }
  const actor = engine.getPlayerActorRead(actorId)?.actor;
  if (!actor || actor.lifecycle === 'departed' || actor.connection === 'blocked') {
    throw new Error('This contact is unavailable.');
  }
  return actor;
}

function firstFlow(engine: SimulationKernel, actorId: string): NarrativeFlowDefinition {
  const actor = authorize(engine, actorId);
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

function flowFor(state: Thread, engine: SimulationKernel, actorId: string): NarrativeFlowDefinition | null {
  if (state.stage === 'first') return firstFlow(engine, actorId);
  if (state.stage === 'second') return PULSE_FOLLOWUP_FLOWS[state.topic] ?? null;
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
  return response.text.trim().slice(0, 500);
}

function receive(engine: SimulationKernel, actorId: string, text: string, tags: string[]) {
  if (!text) throw new Error('Authored reply was empty.');
  const result = engine.dispatchAction({
    type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: actorId, text,
    tags: ['ink_pulse', 'authored', ...tags],
  });
  if (!result.success) throw new Error(result.error ?? 'Unable to deliver authored reply.');
}

function deliver(engine: SimulationKernel, actorId: string, state: Extract<Thread, { stage: 'waiting_first' | 'waiting_second' }>): string {
  const flow = state.stage === 'waiting_first'
    ? flowById.get(state.flowId)
    : PULSE_FOLLOWUP_FLOWS[state.topic];
  if (!flow) throw new Error('Unknown authored thread.');
  const text = responseFor(engine, actorId, flow, state.topic);
  const tag = state.stage === 'waiting_first'
    ? `pulse:v2:response:${state.topic}` : 'pulse:v2:closed';
  receive(engine, actorId, text, [tag]);
  return text;
}

function view(engine: SimulationKernel, actorId: string): SimulationPulseNarrativeResult {
  const state = thread(engine, actorId);
  const flow = flowFor(state, engine, actorId);
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
  for (const contact of engine.getMessengerRead(MAX_CONTACT_CHECK).contacts) {
    if (delivered >= MAX_DELIVERIES_PER_ADVANCE) break;
    const id = contact.actorId;
    const state = thread(engine, id);
    if (state.stage !== 'waiting_first' && state.stage !== 'waiting_second') continue;
    if (totalMinutes(engine) - state.sentMinute < MIN_REPLY_WAIT_MINUTES) continue;
    const actor = engine.getPlayerActorRead(id)?.actor;
    if (!actor?.canChatNow.allowed) continue;
    deliver(engine, id, state);
    delivered += 1;
  }
  return delivered;
}

export function createWorkerPulseNarrative(engine: SimulationKernel) {
  return {
    run(command: SimulationPulseNarrativeCommand): SimulationPulseNarrativeResult {
      if (!command || (command.kind !== 'choices' && command.kind !== 'choose')) {
        throw new Error('Invalid Pulse narrative operation.');
      }
      if (!engine.getChromeRead().pulseInstalled) throw new Error('Install Pulse Messenger to chat.');
      const actor = authorize(engine, command.actorId);
      if (command.kind === 'choices') return view(engine, command.actorId);

      const state = thread(engine, command.actorId);
      const flow = flowFor(state, engine, command.actorId);
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
        : `pulse:v2:followup_out:${topic}`;
      const sentText = choices[command.choiceIndex]!.text;
      const sent = engine.dispatchAction({
        type: 'SOCIAL_SEND_MESSAGE', buddyId: command.actorId, text: sentText,
        tags: ['ink_pulse', 'authored', tag],
      });
      if (!sent.success) throw new Error(sent.error ?? 'Message could not be sent.');
      let reply: string | null = null;
      if (actor.canChatNow.allowed) {
        // Follow-up paths choose the actual reply index; the original first
        // choice index only selects the correct second-turn flow.
        const replyIndex = first ? topic : command.choiceIndex;
        const replyFlow = first ? flow : PULSE_FOLLOWUP_FLOWS[topic]!;
        const spoken = responseFor(engine, command.actorId, replyFlow, replyIndex);
        receive(engine, command.actorId, spoken, [first ? `pulse:v2:response:${topic}` : 'pulse:v2:closed']);
        reply = spoken;
      }
      return { ...view(engine, command.actorId), sent: sentText, reply };
    },
  };
}

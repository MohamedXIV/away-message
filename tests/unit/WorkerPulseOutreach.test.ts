import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { socialHashText } from '../../src/engine/social/SocialMemoryLedger';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';
import {
  createWorkerPulseNarrative, initiateWorkerPulseOutreach,
  reconcileWorkerPulseSocial, deliverPendingPulseReplies,
} from '../../src/simulation/host/WorkerPulseNarrative';
import { pulseOutreachOptions } from '../../src/simulation/host/PulseOutreachContent';
import { formatPulseNewsLine } from '../../src/simulation/host/PulseVoice';

function fixture(seed = 'npc-outreach-demo-002') {
  const initial = buildFreshSandboxSocialState(seed);
  const ids = Object.keys(initial.knownHandles ?? {});
  const engine = new SimulationKernel({ social: initial });
  const chrome = engine.getChromeRead.bind(engine);
  let installed = true;
  vi.spyOn(engine, 'getChromeRead').mockImplementation(() => ({
    ...chrome(), pulseInstalled: installed,
  }));
  const read = engine.getPlayerActorRead.bind(engine);
  let available = true;
  let conflicted = false;
  let worldNews = false;
  const readKnowledge = engine.world.getBuddyKnowledge.bind(engine.world);
  vi.spyOn(engine.world, 'getBuddyKnowledge').mockImplementation(id =>
    worldNews ? readKnowledge(id) : []);
  vi.spyOn(engine, 'getPlayerActorRead').mockImplementation(actorId => {
    const result = read(actorId);
    if (!result || !ids.includes(actorId)) return result;
    return { ...result, actor: {
      ...result.actor, lifecycle: 'active', connection: 'known',
      relationship: { ...result.actor.relationship, conflicted, trusted: true },
      canChatNow: { allowed: available, reasons: available ? [] : ['away'] },
    } };
  });
  vi.spyOn(engine.social, 'getDailyMood').mockReturnValue('warm');
  function toEligibleDay() {
    const day = Array.from({ length: 12 }, (_, i) => i + 2)
      .find(d => ids.some(id => socialHashText(id + ':outreach:chance:' + d) % 100 < 70));
    if (!day) throw new Error('No deterministic outreach day in fixture');
    // The default world starts at 08:00, before people should message.
    // Advance to 10:00 on the selected day, not 08:00.
    const current = engine.getChromeRead().time;
    engine.advanceGameMinutes((day - 1) * 1440 + 600 - current.totalMinutes);
    expect(engine.getChromeRead().time.day).toBe(day);
    expect(engine.getChromeRead().time.hour).toBe(10);
    return day;
  }
  return {
    engine, ids, toEligibleDay,
    setAvailable(value: boolean) { available = value; },
    setConflicted(value: boolean) { conflicted = value; },
    setInstalled(value: boolean) { installed = value; },
    setWorldNews(value: boolean) { worldNews = value; },
    narrative: createWorkerPulseNarrative(engine),
  };
}

describe('#223 NPC-initiated Pulse — canonical social opportunity', () => {
  it('initiates a bounded, player-known, relationship-aware message on world-time reconciliation', () => {
    const ctx = fixture();
    expect(initiateWorkerPulseOutreach(ctx.engine)).toBe(0); // day 1, no daily spam
    const day = ctx.toEligibleDay();
    const done = reconcileWorkerPulseSocial(ctx.engine);
    expect(done.outreach).toBeGreaterThan(0);
    expect(done.outreach).toBeLessThanOrEqual(2);
    expect(reconcileWorkerPulseSocial(ctx.engine).outreach).toBe(0);

    const origin = ctx.ids.find(id =>
      ctx.engine.getConversationRead(id, 0, 1).messages.some(msg =>
        msg.tags?.includes('systemic_outreach')));
    expect(origin).toBeTruthy();
    const first = ctx.engine.getConversationRead(origin!, 0, 8).messages;
    expect(first).toHaveLength(1);
    expect(first[0]?.day).toBe(day);
    expect(first[0]?.senderId).toBe(origin);
    expect(first[0]?.tags).toContain('pulse:v2:outreach:trusted');
    expect(pulseOutreachOptions('trusted', ctx.engine.social.getBuddy(origin!)!.traits))
      .toContain(first[0]?.text);
    expect(ctx.engine.getMessengerRead().unreadCounts[origin!]).toBeGreaterThanOrEqual(1);

    const view = ctx.narrative.run({ kind: 'choices', actorId: origin! });
    expect(view.phase).toBe('outreach');
    expect(view.choices.map(c => c.text))
      .toContain("Hey, good to hear from you. What's up?");
    const replied = ctx.narrative.run({
      kind: 'choose', actorId: origin!, choiceIndex: 0,
      expectedText: view.choices[0]!.text,
    });
    expect(replied.phase).toBe('complete');
    expect(replied.reply).toContain('Nothing urgent');
    expect(ctx.engine.getConversationRead(origin!, 0, 8).messages.map(x => x.senderId))
      .toEqual([origin, 'player', origin]);

    const cold = new SimulationKernel(ctx.engine.exportSnapshot());
    const readChrome = cold.getChromeRead.bind(cold);
    vi.spyOn(cold, 'getChromeRead').mockImplementation(() => ({ ...readChrome(), pulseInstalled: true }));
    expect(createWorkerPulseNarrative(cold).run({ kind: 'choices', actorId: origin! }).phase)
      .toBe('complete');
    expect(ctx.engine.social.isKnown('invented-stranger')).toBe(false);
  });

  it('defers an outreach reply if the NPC becomes busy, then restores and delivers once', () => {
    const ctx = fixture('npc-outreach-demo-002');
    ctx.toEligibleDay();
    const started = initiateWorkerPulseOutreach(ctx.engine);
    expect(started).toBeGreaterThan(0);
    const id = ctx.ids.find(id => ctx.narrative.run({ kind: 'choices', actorId: id }).phase === 'outreach')!;
    expect(id).toBeTruthy();
    const intro = ctx.narrative.run({ kind: 'choices', actorId: id });
    ctx.setAvailable(false);
    const sent = ctx.narrative.run({
      kind: 'choose', actorId: id, choiceIndex: 2,
      expectedText: intro.choices[2]!.text,
    });
    expect(sent.phase).toBe('waiting_outreach');
    expect(sent.reply).toBeNull();
    expect(ctx.engine.getConversationRead(id, 0, 8).messages).toHaveLength(2);
    expect(deliverPendingPulseReplies(ctx.engine)).toBe(0);
    ctx.engine.advanceGameMinutes(11);
    expect(deliverPendingPulseReplies(ctx.engine)).toBe(0);
    const saved = ctx.engine.exportSnapshot();
    const restored = new SimulationKernel(saved);
    const getChrome = restored.getChromeRead.bind(restored);
    vi.spyOn(restored, 'getChromeRead').mockImplementation(() => ({
      ...getChrome(), pulseInstalled: true,
    }));
    const getActor = restored.getPlayerActorRead.bind(restored);
    vi.spyOn(restored, 'getPlayerActorRead').mockImplementation(other => {
      const read = getActor(other);
      return read && other === id
        ? { ...read, actor: { ...read.actor, canChatNow: { allowed: true, reasons: [] } } }
        : read;
    });
    expect(createWorkerPulseNarrative(restored).run({ kind: 'choices', actorId: id }).phase)
      .toBe('waiting_outreach');
    expect(reconcileWorkerPulseSocial(restored).replies).toBe(1);
    expect(reconcileWorkerPulseSocial(restored).replies).toBe(0);
    expect(restored.getConversationRead(id, 0, 10).messages.at(-1)?.text)
      .toContain('No worries');
    expect(createWorkerPulseNarrative(restored).run({ kind: 'choices', actorId: id }).phase)
      .toBe('complete');
  });

  it('does not manufacture a message when no software, contacts unavailable, or NPC is in an existing conversation', () => {
    const ctx = fixture('npc-outreach-demo-003');
    ctx.toEligibleDay();
    ctx.setInstalled(false);
    expect(initiateWorkerPulseOutreach(ctx.engine)).toBe(0);
    ctx.setInstalled(true);
    ctx.setAvailable(false);
    expect(initiateWorkerPulseOutreach(ctx.engine)).toBe(0);
    ctx.setAvailable(true);
    const id = ctx.ids[0]!;
    const offer = ctx.narrative.run({ kind: 'choices', actorId: id });
    ctx.narrative.run({ kind: 'choose', actorId: id, choiceIndex: 1, expectedText: offer.choices[1]!.text });
    expect(ctx.narrative.run({ kind: 'choices', actorId: id }).phase).toBe('second');
    expect(initiateWorkerPulseOutreach(ctx.engine)).toBeLessThanOrEqual(1);
    expect(ctx.narrative.run({ kind: 'choices', actorId: id }).phase).toBe('second');
  });

  it('can initiate a shared-memory check-in only after a typed mutual event', () => {
    const ctx = fixture('npc-outreach-demo-005');
    ctx.engine.social.addCoreMemory(ctx.ids[0]!, {
      text: 'The player really attended this gathering with the contact',
      kind: 'shared_moment', day: 1,
      meaning: {
        participants: ['player', ctx.ids[0]!],
        subject: { kind: 'event', id: 'shared_gathering' },
        source: { kind: 'direct_experience', refId: 'gathering_01' },
        salience: 'high', valence: 'positive',
      },
    });
    ctx.toEligibleDay();
    initiateWorkerPulseOutreach(ctx.engine);
    const first = ctx.engine.getConversationRead(ctx.ids[0]!, 0, 10).messages;
    if (first.length) {
      expect(first[0]?.tags).toContain('pulse:v2:outreach:shared');
      expect(pulseOutreachOptions('shared', ctx.engine.social.getBuddy(ctx.ids[0]!)!.traits))
        .toContain(first[0]?.text);
    }
    // Whichever daily candidate writes, any other NPC without a mutual
    // memory must never claim the private event.
    for (const id of ctx.ids.slice(1)) {
      const other = ctx.engine.getConversationRead(id, 0, 10).messages;
      for (const msg of other) {
        expect(msg.tags).not.toContain('pulse:v2:outreach:shared');
      }
    }
  });

  it('never mentions a private or merely textual memory as shared experience', () => {
    const ctx = fixture('npc-outreach-demo-004');
    ctx.engine.social.addCoreMemory(ctx.ids[0]!, {
      text: 'Private diary entry not witnessed by the player',
      kind: 'shared_moment', day: 1,
      meaning: {
        participants: ['other-person', ctx.ids[0]!],
        subject: { kind: 'event', id: 'private_meeting' },
        source: { kind: 'direct_experience', refId: 'private001' },
        salience: 'high', valence: 'positive',
      },
    });
    ctx.engine.social.addCoreMemory(ctx.ids[1]!, {
      text: 'A long scene the player heard a rumor about',
      kind: 'shared_moment', day: 1,
    });
    ctx.toEligibleDay();
    initiateWorkerPulseOutreach(ctx.engine);
    for (const id of ctx.ids) {
      const messages = ctx.engine.getConversationRead(id, 0, 10).messages;
      for (const message of messages) {
        if (message.tags?.includes('systemic_outreach')) {
          expect(message.tags).not.toContain('pulse:v2:outreach:shared');
          expect(message.text).not.toMatch(/remember that day we shared|time we spent together/i);
        }
      }
    }
  });

  it('mentions only an event the actual actor learned, with its World-owned attitude and cold history', () => {
    const ctx = fixture('npc-outreach-event-voice-001');
    const day = Array.from({ length: 9 }, (_, i) => i + 5)
      .find(d => ctx.ids.map(id => ({
        id, order: socialHashText(id + ':outreach:' + d),
      })).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .slice(0, 2).some(({ id }) => socialHashText(id + ':outreach:chance:' + d) % 100 < 75));
    expect(day).toBeDefined();
    const current = ctx.engine.getChromeRead().time.totalMinutes;
    ctx.engine.advanceGameMinutes((day! - 1) * 1440 + 17 * 60 - current);
    const eventId = day! >= 11 ? 'orion_os_7_release'
      : day! >= 9 ? 'goldnet_surge'
      : day! >= 7 ? 'orion_os_7_beta' : 'city_canal_festival';
    const event = ctx.engine.world.getTriggeredEventsForIds(new Set([eventId]))[0];
    expect(event).toBeTruthy();

    // The World owner, not text similarity or a global omniscient feed, grants
    // each eligible actor knowledge of this actually triggered event.
    const now = ctx.engine.getChromeRead().time.totalMinutes;
    for (const id of ctx.ids) {
      ctx.engine.world.learnEventForBuddy(id, eventId, {
        kind: 'direct_observation', sourceId: 'event_voice_test', atMinute: now,
      });
    }
    ctx.setWorldNews(true);
    expect(initiateWorkerPulseOutreach(ctx.engine)).toBeGreaterThan(0);
    const news = ctx.ids.flatMap(id => ctx.engine.getConversationRead(id, 0, 10).messages
      .filter(message => message.tags?.includes('pulse:v2:outreach:news'))
      .map(message => ({ id, message })));
    expect(news.length).toBeGreaterThan(0);
    for (const { id, message } of news) {
      const learned = ctx.engine.world.getBuddyKnowledge(id).find(row => row.eventId === eventId);
      expect(learned).toBeTruthy();
      expect(message.tags).toContain('world_event:' + eventId);
      expect(message.text).toBe(formatPulseNewsLine(event!.title, learned!.attitude,
        ctx.engine.social.getBuddy(id)!.traits));
    }

    const restored = new SimulationKernel(ctx.engine.exportSnapshot());
    for (const { id, message } of news) {
      expect(restored.getConversationRead(id, 0, 10).messages.some(row =>
        row.text === message.text && row.tags?.includes('world_event:' + eventId))).toBe(true);
    }
  });
});

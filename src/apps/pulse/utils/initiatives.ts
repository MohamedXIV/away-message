import {
  shouldInitiateContact,
  pickInitiativeText,
  pickGossipLine,
  resolveArchetype,
  NPC_BUZZ_LINES,
  rollSeeded100,
  pickSeeded,
  type InitiativeKind,
} from '../../../engine/characterTemplates';
import type {
  BuddyPresenceStatus,
  CharacterArchetype,
  DailyMood,
  RelationshipStage,
} from '../../../engine/types';

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

/** Minimal engine surface the planner needs (structural — SimulationEngine satisfies it). */
export interface InitiativeEngine {
  social: {
    getBuddies(): Array<{ id: string; displayName: string; status?: string; archetype?: CharacterArchetype }>;
    getRelationshipStage(id: string): RelationshipStage;
    getPresence(id: string): { status: BuddyPresenceStatus } | undefined;
    getDailyMood(id: string, day: number): DailyMood;
    getOpenPromises(id: string): Array<{ text: string }>;
    // Character Lives: fixed temperament for the nerve gate + shy buzz.
    // Absent on legacy stubs → the gate is skipped (legacy behavior preserved).
    getTraits?(id: string): { shyness: number; warmth: number; spontaneity: number } | undefined;
    // A buddy's read of the player: cold-read players get fewer voluntary check-ins.
    getPlayerRead?(id: string): { beliefs: { warmth: number }; certainty: number } | undefined;
  };
  world?: {
    getTriggeredEvents?: () => Array<{ title?: string; triggerDay?: number }>;
  };
}

export interface InitiativePlan {
  buddyId: string;
  displayName: string;
  text: string;
  kind: InitiativeKind;
  /** Extra message tags (e.g. 'buzz' for shy nudges). */
  tags?: string[];
}

/**
 * Nerve to start a *voluntary* chat (checkin/gossip/cafe_invite), 5..95.
 * Warmth and spontaneity push up, shyness drags down, close bonds add courage.
 * Duty kinds (promise_reminder/event_share) never consult nerve — even shy
 * buddies chase what they owe you.
 */
export function nerveForInitiative(
  stage: RelationshipStage,
  traits: { shyness: number; warmth: number; spontaneity: number }
): number {
  const raw = (stage === 'close' ? 25 : 10)
    + traits.warmth * 0.35
    + traits.spontaneity * 0.25
    - traits.shyness * 0.5;
  return Math.max(5, Math.min(95, Math.round(raw)));
}

/** Buzz chance (%) for a voluntary checkin: only shy (70+) buddies buzz. */
export function buzzChanceFor(shyness: number): number {
  return shyness >= 70 ? (shyness - 65) * 3 : 0;
}

const KIND_PRIORITY: Record<InitiativeKind, number> = {
  promise_reminder: 0,
  event_share: 1,
  gossip: 2,
  checkin: 3,
  cafe_invite: 4,
};

/**
 * P4 — rules-only initiative planner shared by the login pass and the mid-session
 * day-change pass. Returns at most maxCount plans, priority-ordered
 * (promise_reminder → event_share → gossip → checkin → cafe_invite),
 * and the updated initiatedToday map (only planned buddies are marked).
 * Pure except for engine reads — never dispatches, never touches AI.
 */
export function planInitiatives(
  engine: InitiativeEngine,
  opts: { day: number; blockedIds: string[]; initiatedToday: Record<string, number>; maxCount: number; salt: string }
): { plans: InitiativePlan[]; initiatedToday: Record<string, number> } {
  const day = Math.max(1, Math.floor(opts.day) || 1);
  const blocked = new Set(opts.blockedIds);
  const done = { ...opts.initiatedToday };
  const candidates: Array<InitiativePlan & { stage: RelationshipStage }> = [];
  try {
    const worldEvents = engine.world?.getTriggeredEvents?.() || [];
    const freshEvents = worldEvents.filter(
      (e) => typeof e.triggerDay === 'number' && (e.triggerDay === day || e.triggerDay === day - 1)
        && typeof e.title === 'string' && e.title.trim().length > 3
    );
    // C2 gossip targets: buddies currently distant/gone (visible absence, worth mentioning)
    const gossipTargets = engine.social.getBuddies().filter(
      (b) => (b.status === 'distant' || b.status === 'gone') && !blocked.has(b.id)
    );
    for (const buddy of engine.social.getBuddies()) {
      if (blocked.has(buddy.id)) continue;
      if (done[buddy.id] === day) continue;
      if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
      const stage = engine.social.getRelationshipStage(buddy.id);
      const pres = engine.social.getPresence(buddy.id);
      const mood = engine.social.getDailyMood(buddy.id, day);
      const roll = hashString(`${buddy.id}:${day}:init:${opts.salt}`) % 100;
      if (!shouldInitiateContact({ stage, presenceStatus: pres?.status ?? 'offline', mood, initiatedToday: false, roll })) continue;
      const open = engine.social.getOpenPromises(buddy.id);
      const kindRoll = hashString(`${buddy.id}:${day}:kind:${opts.salt}`) % 100;
      let kind: InitiativeKind = 'checkin';
      let eventTitle: string | undefined;
      if (open.length > 0 && kindRoll < 40) {
        kind = 'promise_reminder';
      } else if (freshEvents.length > 0 && kindRoll < 75) {
        kind = 'event_share';
        eventTitle = freshEvents[hashString(`${buddy.id}:${day}:evt:${opts.salt}`) % freshEvents.length]?.title;
      }
      if (kind === 'checkin' && stage === 'close' && (hashString(`${buddy.id}:${day}:cafe:${opts.salt}`) % 100) < 10) {
        kind = 'cafe_invite';
      }
      // C2 gossip: a friend+ buddy may mention someone else's visible absence instead of small talk
      let gossipName: string | undefined;
      let gossipStatus: 'distant' | 'gone' | undefined;
      if (kind === 'checkin' && gossipTargets.length > 0 && (hashString(`${buddy.id}:${day}:gossip:${opts.salt}`) % 100) < 35) {
        const others = gossipTargets.filter((t) => t.id !== buddy.id);
        if (others.length > 0) {
          const target = others[hashString(`${buddy.id}:${day}:gossiptarget:${opts.salt}`) % others.length]!;
          if (target.status === 'distant' || target.status === 'gone') {
            kind = 'gossip';
            gossipName = target.displayName;
            gossipStatus = target.status;
          }
        }
      }
      const arch = resolveArchetype(buddy.id, buddy.archetype);
      const seed = `${buddy.id}:${day}:${opts.salt}`;
      // Character Lives nerve gate: temperament decides who actually dares to
      // start a voluntary chat. Duty (promises/events) bypasses it entirely.
      // Cold-read players are checked on less (their nerve × warmth factor).
      const traits = engine.social.getTraits?.(buddy.id);
      if (traits && (kind === 'checkin' || kind === 'gossip' || kind === 'cafe_invite')) {
        const read = engine.social.getPlayerRead?.(buddy.id);
        const warmth = read ? Math.max(0, Math.min(100, read.beliefs.warmth)) : 50;
        const warmthFactor = read ? 0.6 + 0.4 * (warmth / 100) : 1;
        if (rollSeeded100(`${buddy.id}:${day}:nerve:${opts.salt}`) >= nerveForInitiative(stage, traits) * warmthFactor) continue;
      }
      let text = kind === 'gossip' && gossipName && gossipStatus
        ? pickGossipLine(arch, seed, gossipName, gossipStatus)
        : pickInitiativeText(arch, kind, seed, { eventTitle, promiseText: open[0]?.text });
      // Shy buddies often buzz instead of typing (MSN-era nudge, 'buzz' tag).
      let tags: string[] | undefined;
      if (traits && kind === 'checkin' && rollSeeded100(`${buddy.id}:${day}:buzz:${opts.salt}`) < buzzChanceFor(traits.shyness)) {
        text = pickSeeded(NPC_BUZZ_LINES, `${buddy.id}:${day}:buzzline:${opts.salt}`);
        tags = ['buzz'];
      }
      candidates.push({ buddyId: buddy.id, displayName: buddy.displayName, text, kind, stage, ...(tags ? { tags } : {}) });
    }
  } catch { /* planner never throws — callers treat empty as no initiatives */ }
  candidates.sort((a, b) => {
    const prio = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    if (prio !== 0) return prio;
    if (a.stage === 'close' && b.stage !== 'close') return -1;
    if (b.stage === 'close' && a.stage !== 'close') return 1;
    return a.buddyId < b.buddyId ? -1 : 1;
  });
  const plans = candidates.slice(0, Math.max(0, opts.maxCount)).map(({ buddyId, displayName, text, kind, tags }) => ({ buddyId, displayName, text, kind, ...(tags ? { tags } : {}) }));
  for (const plan of plans) done[plan.buddyId] = day;
  return { plans, initiatedToday: done };
}

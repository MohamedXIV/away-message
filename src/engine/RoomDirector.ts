// src/engine/RoomDirector.ts
// P5.3 room physics — pure rules for group mood, direct NPC-to-NPC address,
// and prompt context. The UI gathers inputs (affinities/stages) and injects
// the outputs; NOTHING here touches AI, state, or randomness (rolls passed in).

export type RoomMood = 'lively' | 'warm' | 'steady' | 'tense' | 'cold';

export interface RoomPair {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  affinity: number;
}

/** Group mood from buddy-to-buddy affinities. Friction dominates: one bitter pair tenses the room. */
export function computeRoomMood(pairs: RoomPair[]): { mood: RoomMood; score: number } {
  if (pairs.length === 0) return { mood: 'steady', score: 0 };
  let sum = 0;
  let min = Infinity;
  for (const pair of pairs) {
    sum += pair.affinity;
    if (pair.affinity < min) min = pair.affinity;
  }
  const score = Math.round(sum / pairs.length);
  if (min <= -25) return { mood: 'tense', score };
  if (score < -10) return { mood: 'cold', score };
  if (score >= 20) return { mood: 'lively', score };
  if (score >= 5) return { mood: 'warm', score };
  return { mood: 'steady', score };
}

export interface DirectTarget {
  id: string;
  name: string;
  affinity: number;
  /** 'duet' (affinity >= 30): build warmly. 'friction' (<= -25): stay civil and short. */
  tone: 'duet' | 'friction' | 'neutral';
}

/**
 * Pick another present participant for the responder to address directly.
 * Target = strongest |affinity| tie; only fires on roll < 25 so most turns stay player-facing.
 */
export function pickDirectTarget(
  responderId: string,
  others: Array<{ id: string; name: string; affinity: number }>,
  roll: number
): DirectTarget | null {
  if (roll < 0 || roll >= 25) return null;
  const candidates = others.filter((o) => o.id !== responderId);
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  for (const candidate of candidates) {
    if (Math.abs(candidate.affinity) > Math.abs(best.affinity)) best = candidate;
  }
  if (Math.abs(best.affinity) < 10) return null; // no notable tie → stay player-facing
  const tone = best.affinity >= 30 ? 'duet' : best.affinity <= -25 ? 'friction' : 'neutral';
  return { id: best.id, name: best.name, affinity: best.affinity, tone };
}

/** Compact room context for prompt injection ("Room mood: warm. Maya↔Ryan: warm (+15)"). */
export function buildRoomContext(roomName: string, mood: RoomMood, pairs: RoomPair[]): string {
  if (pairs.length === 0) return `Room mood: ${mood}.`;
  const parts = [...pairs]
    .sort((x, y) => Math.abs(y.affinity) - Math.abs(x.affinity))
    .slice(0, 4)
    .map((p) => {
      const v = p.affinity;
      const label = v >= 30 ? 'deep bond' : v >= 10 ? 'warm' : v <= -30 ? 'bitter' : v <= -10 ? 'tense' : 'neutral';
      return `${p.aName}↔${p.bName}: ${label} (${v >= 0 ? '+' : ''}${v})`;
    });
  return `Room "${roomName}" mood: ${mood}. ${parts.join(' • ')}`;
}

/** Per-mood behavior instruction appended to the responder persona. */
export function roomMoodInstruction(mood: RoomMood): string {
  switch (mood) {
    case 'lively':
      return 'The room is lively — be playful, a little longer than usual, riff with the others.';
    case 'warm':
      return 'The room is warm — be open and friendly, enjoy the company.';
    case 'tense':
      return 'The room is tense — keep replies shorter and cooler, stay civil, do not escalate.';
    case 'cold':
      return 'The room is cold — be brief and guarded, one short line.';
    case 'steady':
    default:
      return 'The room is relaxed — reply naturally.';
  }
}

/** Direct-address instruction for the responder persona. */
export function directAddressInstruction(target: DirectTarget): string {
  if (target.tone === 'duet') {
    return `You get along great with ${target.name} (present) — you may briefly address them by name and build warmly on their point.`;
  }
  if (target.tone === 'friction') {
    return `You and ${target.name} (present) grate a little — you may acknowledge them by name but stay civil and keep it short.`;
  }
  return `You may briefly address ${target.name} (present) by name if it fits.`;
}

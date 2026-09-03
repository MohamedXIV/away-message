// src/engine/AppointmentDirector.ts
// P5 live meetings — pure rules for meetup parsing, RSVP and show decisions.
// The engine orchestrates (flags/messages/dimensions); NOTHING here touches AI or state.

import type { AppointmentRsvp, DailyMood, RelationshipStage } from './types';

export type MeetingLocation = 'cafe' | 'work' | 'motel_lobby';

/** Fixed daily slots per meeting location (minute of day). */
export const LOCATION_SLOTS: Record<MeetingLocation, { start: number; end: number }> = {
  cafe: { start: 18 * 60, end: 19 * 60 + 30 },
  work: { start: 9 * 60, end: 12 * 60 },
  motel_lobby: { start: 20 * 60, end: 20 * 60 + 30 },
};

export function locationLabel(location: string): string {
  if (location === 'work') return 'work';
  if (location === 'motel_lobby') return 'the motel lobby';
  return 'the cafe';
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** Deterministic 0..99 roll for appointment decisions (stable across reloads). */
export function appointmentRoll(seed: string): number {
  return hashText(seed) % 100;
}

const MEET_WORDS = /\bmeet\b|meet up|meetup|get together|hang out|coffee|caf[eé]\b|see you at|come by|come over|shift together|work together|grab a bite|tacos tomorrow/i;
const CANCEL_WORDS = /can['’]?t make it|won['’]?t make it|can['’]?t come|cant come|won['’]?t be there|have to cancel|gotta cancel|rain check|\bcancel\b|can['’]?t go\b/i;

export interface MeetupProposal {
  locationId: MeetingLocation;
  dayOffset: number;
}

/**
 * Parse a player chat line for an explicit meetup proposal.
 * Conservative: requires BOTH a meet-word AND an explicit day-word (no guessing).
 * Returns null for anything ambiguous.
 */
export function parseMeetupProposal(text: string): MeetupProposal | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (CANCEL_WORDS.test(trimmed)) return null;
  if (!MEET_WORDS.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  let dayOffset: number | null = null;
  if (lower.includes('tomorrow')) dayOffset = 1;
  else if (lower.includes('tonight') || /\btoday\b/.test(lower)) dayOffset = 0;
  else if (lower.includes('weekend') || lower.includes('saturday') || lower.includes('sunday')) dayOffset = 3;
  if (dayOffset === null) return null;
  let locationId: MeetingLocation = 'cafe';
  if (/work|shift|cart/.test(lower)) locationId = 'work';
  else if (/lobby|motel/.test(lower)) locationId = 'motel_lobby';
  else if (/caf[eé]|coffee|taco|bite|diner/.test(lower)) locationId = 'cafe';
  return { locationId, dayOffset };
}

/** Does this player line cancel pending plans? (checked before proposal parsing) */
export function isMeetupCancelText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return false;
  return CANCEL_WORDS.test(trimmed);
}

/** NPC RSVP decision: strained → no; low mood → maybe; otherwise yes. Pure. */
export function decideRsvp(opts: { stage: RelationshipStage; mood: DailyMood; roll: number }): AppointmentRsvp {
  if (opts.stage === 'strained') return 'no';
  if ((opts.mood === 'off' || opts.mood === 'tired') && opts.roll < 40) return 'maybe';
  return 'yes';
}

/**
 * NPC show decision at resolution time. Pure.
 * - rsvp 'no' (or anything unexpected) → stays home
 * - strained → 70% no-show
 * - mood 'off' → 40% no-show
 * - 'maybe' RSVP → 25% flake
 * - otherwise shows
 */
export function decideNpcShow(opts: { rsvp: AppointmentRsvp | undefined; stage: RelationshipStage; mood: DailyMood; roll: number }): boolean {
  if (opts.rsvp === 'no') return false;
  if (opts.stage === 'strained') return opts.roll >= 70;
  if (opts.mood === 'off') return opts.roll >= 40;
  if (opts.rsvp === 'maybe') return opts.roll >= 25;
  return true;
}

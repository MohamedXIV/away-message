// src/tools/studio/types.ts
// Constants, enums, and utility types for the Content Studio visual UI.

import type { HairColor, EyeColor, CharacterRoutine, CharacterArtProfile, BuddyBackstory } from '../../engine/types';

export type StudioTab = 'characters' | 'archetypes' | 'dialoguePools' | 'affinitySeeds' | 'raw';

export const HAIR_COLOR_OPTIONS: HairColor[] = [
  'black', 'dark_brown', 'brown', 'light_brown', 'blonde',
  'auburn', 'red', 'grey', 'dyed_blue', 'dyed_pink', 'dyed_green',
];

export const EYE_COLOR_OPTIONS: EyeColor[] = [
  'brown', 'dark_brown', 'hazel', 'blue', 'green', 'grey', 'amber',
];

export const REACH_OPTIONS: Array<'local' | 'remote'> = ['local', 'remote'];

export const WORK_SHIFT_OPTIONS: Array<CharacterRoutine['workShift']> = [
  'morning', 'day', 'evening', 'night', 'flexible',
];

export const ART_ENGINE_OPTIONS: Array<CharacterArtProfile['engine']> = ['live2d', 'mesh', 'none'];

export const BACKSTORY_RELATIONSHIP_OPTIONS: Array<BuddyBackstory['relationship']> = [
  'friend', 'acquaintance', 'stranger', 'close', 'estranged',
];

export const CANDIDATE_STATUS_OPTIONS: Array<BuddyBackstory['candidates'][number]['status']> = [
  'active', 'dead', 'changed',
];

export const LANGUAGE_OPTIONS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'zh', 'ja'];

export const TRAIT_DEFINITIONS: Array<{
  key: 'shyness' | 'warmth' | 'discipline' | 'spontaneity' | 'loyalty';
  label: string;
  lowLabel: string;
  highLabel: string;
  description: string;
}> = [
  { key: 'shyness', label: 'Shyness', lowLabel: 'Outgoing / Bold', highLabel: 'Reserved / Hesitant', description: 'Affects initiative nerve and polite apology lines.' },
  { key: 'warmth', label: 'Warmth', lowLabel: 'Cool / Aloof', highLabel: 'Empathetic / Open', description: 'Affects conversation comfort and tone softness.' },
  { key: 'discipline', label: 'Discipline', lowLabel: 'Casual / Relaxed', highLabel: 'Orderly / Formal', description: 'Affects schedule adherence and MyPlace tone.' },
  { key: 'spontaneity', label: 'Spontaneity', lowLabel: 'Predictable / Deliberate', highLabel: 'Impulsive / Random', description: 'Affects sudden chat check-ins and run-ins.' },
  { key: 'loyalty', label: 'Loyalty', lowLabel: 'Independent', highLabel: 'Fiercely Devoted', description: 'Affects mediation help and forgiveness tolerance.' },
];

export const AFFINITY_DEFINITIONS: Array<{
  key: string;
  label: string;
  category: 'positive' | 'tension';
  color: string;
}> = [
  { key: 'familiarity', label: 'Familiarity', category: 'positive', color: '#6366f1' },
  { key: 'trust', label: 'Trust', category: 'positive', color: '#3b82f6' },
  { key: 'comfort', label: 'Comfort', category: 'positive', color: '#10b981' },
  { key: 'respect', label: 'Respect', category: 'positive', color: '#8b5cf6' },
  { key: 'affection', label: 'Affection', category: 'positive', color: '#ec4899' },
  { key: 'attraction', label: 'Attraction', category: 'positive', color: '#f43f5e' },
  { key: 'annoyance', label: 'Annoyance', category: 'tension', color: '#f59e0b' },
  { key: 'suspicion', label: 'Suspicion', category: 'tension', color: '#d97706' },
  { key: 'resentment', label: 'Resentment', category: 'tension', color: '#ef4444' },
];

/** Convert minute of day (0..1439) into 12h time string (e.g. 420 -> "07:00 AM"). */
export function minuteToTimeStr(minute: number): string {
  const m = Math.max(0, Math.min(1439, Math.round(minute || 0)));
  const h24 = Math.floor(m / 60);
  const mins = m % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = mins.toString().padStart(2, '0');
  return `${h12.toString().padStart(2, '0')}:${mm} ${ampm}`;
}

/** Convert "HH:MM AM/PM" or "HH:MM" string back to minute of day (0..1439). */
export function timeStrToMinute(str: string): number {
  const clean = str.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return 0;
  let h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  const period = match[3];
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

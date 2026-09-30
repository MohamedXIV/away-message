import type { BuddyPresence } from '../../../engine/types';
import { SEED_BY_ID, seedCharacterWithRole } from '../../../engine/seedCharacters';

export interface NpcStyleProfile {
  buddyId: string;
  displayName: string;
  handle: string;
  persona: string;
  vocabulary: string[];
  punctuation: string;
  quirks: string[];
  typing: {
    wpm: number;
    variance: number;
    pauseStyle: string;
  };
  summaryHint: string;
}

type NpcStyleDetails = Omit<NpcStyleProfile, 'buddyId' | 'displayName' | 'handle'>;

export const NPC_STYLE_PROFILES: Record<string, NpcStyleProfile> = {};

function registerRoleStyle(role: string, details: NpcStyleDetails): void {
  const actor = seedCharacterWithRole(role);
  if (!actor) return;
  NPC_STYLE_PROFILES[actor.id] = {
    buddyId: actor.id,
    displayName: actor.displayName,
    handle: actor.handle,
    ...details,
  };
}

registerRoleStyle('diner-staff', {
  persona: 'Quiet, observant, creative, and a little guarded. Uses lowercase, pauses, music references, and gentle honesty. Warms up slowly and remembers small details.',
  vocabulary: ['hey...', 'umm', 'maybe', 'i think', 'soft', 'quiet', 'music', 'rain', 'coffee', '~'],
  punctuation: 'lowercase, uses "..." and "~" softly, rarely caps, occasional :)',
  quirks: ['lowercase-heavy', 'hesitant pauses ...', 'music/rain references', 'remembers player details'],
  typing: { wpm: 55, variance: 18, pauseStyle: 'hesitant with 300-800ms mid-sentence pauses' },
  summaryHint: 'quiet, hesitant, warm but reserved',
});

registerRoleStyle('cart-owner', {
  persona: 'Warm, impulsive coworker. Uses casual slang, jokes, and short messages. Avoids heavy emotional talks unless trust is high.',
  vocabulary: ['yo', 'dude', 'lol', 'haha', 'brb', 'afk', 'man', 'tacos', 'cart'],
  punctuation: 'short bursts, uses ! and lol, abbreviations, caps for emphasis occasionally',
  quirks: ['fast short messages', 'slang-heavy', 'food/cart talk'],
  typing: { wpm: 85, variance: 10, pauseStyle: 'bursty, quick send' },
  summaryHint: 'fast, slangy, direct, playful',
});

registerRoleStyle('canal-regular', {
  persona: 'Night-owl archivist with dry humor. Curious about strange details, concise, slightly cryptic, but grounded.',
  vocabulary: ['quiet', 'indexing', 'logs', 'hum', 'canal', 'night', 'strange', 'observed', 'perhaps'],
  punctuation: 'concise, precise, uses . and —, rarely emoticons',
  quirks: ['concise', 'dry humor', 'cryptic but grounded', 'notices acoustic details'],
  typing: { wpm: 88, variance: 12, pauseStyle: 'steady, deliberate' },
  summaryHint: 'concise, dry, slightly cryptic, observant',
});

registerRoleStyle('landlord', {
  persona: 'Professional property manager. Formal, practical, and terse. Cares about rent, schedules, and keeping the property calm.',
  vocabulary: ['Please', 'Regarding', 'Office', 'Account', 'Convenient', 'Regards', 'Notice', 'Policy'],
  punctuation: 'formal, proper capitalization, periods, no slang, no emoticons',
  quirks: ['formal/polite', 'references office hours/policy', 'terse', 'never slang'],
  typing: { wpm: 42, variance: 8, pauseStyle: 'slow, deliberate, proper' },
  summaryHint: 'formal, terse, professional',
});

export function getNpcStyle(buddyId: string): NpcStyleProfile {
  return NPC_STYLE_PROFILES[buddyId] || {
    buddyId,
    displayName: buddyId,
    handle: buddyId,
    persona: `A believable online friend ${buddyId} with a distinct but grounded personality.`,
    vocabulary: [],
    punctuation: 'neutral',
    quirks: [],
    typing: { wpm: 65, variance: 10, pauseStyle: 'normal' },
    summaryHint: 'neutral',
  };
}

export function getNpcMoodLabel(
  presence: BuddyPresence | undefined,
  relationship: { trust: number; comfort: number; annoyance: number; familiarity: number } | undefined,
  gameHour: number,
  energy?: number
): string {
  if (!presence) return 'unknown';
  if (presence.status === 'offline') return 'offline — likely tired or away from desk';
  if (presence.status === 'away') {
    if (presence.awayMessage.toLowerCase().includes('sleep') || gameHour >= 23 || gameHour <= 5) return 'tired but keeping a window open';
    return `distracted — ${presence.awayMessage.slice(0, 48)}`;
  }
  if ((relationship?.annoyance ?? 0) > 45) return 'slightly irritated, shorter replies';
  if ((relationship?.comfort ?? 0) > 65 && (relationship?.trust ?? 0) > 50) return 'relaxed and familiar, more open';
  if ((relationship?.familiarity ?? 0) < 15) return 'polite but reserved, still measuring you';
  if (gameHour >= 22 || gameHour <= 4) return 'night-owl energy, softer and slower';
  if (energy !== undefined && energy < 30) return 'low energy, a bit drained';
  return 'neutral and present, responsive';
}

export function getNpcAvailabilityLabel(presence: BuddyPresence | undefined, gameHour: number): string {
  if (!presence) return 'unknown';
  if (presence.status === 'online') return 'available — actively checking Pulse';
  if (presence.status === 'away') {
    if (gameHour >= 23 || gameHour <= 5) return 'away — probably winding down';
    return 'away — may reply slowly';
  }
  return 'offline — not expecting a prompt reply';
}

const ARCHETYPE_ONLINE_LABELS: Record<string, string> = {
  artist: 'online — listening to music',
  coworker: 'online — chilling after shift',
  nightowl: 'online — nightboard / logs',
  regular: 'online — evening check-in',
  student: 'online — cramming / chatting',
  trader: 'online — watching the tape',
};

export function getNpcActivityLabel(presence: BuddyPresence | undefined, buddyId: string, gameHour: number): string {
  if (presence?.awayMessage) return presence.awayMessage;
  if (presence?.status === 'online') {
    const seed = SEED_BY_ID[buddyId];
    if (seed?.roles?.includes('rain-lover') && gameHour >= 18) {
      return `online — listening to rain / myplace/${seed.myplace || buddyId}`;
    }
    const archetype = seed?.archetype;
    return (archetype && ARCHETYPE_ONLINE_LABELS[archetype]) || 'online and checking messages';
  }
  if (presence?.status === 'away') return presence.awayMessage || 'stepped away briefly';
  return 'offline';
}

import type { BuddyPresence } from '../../../engine/types';
import { CORE_BY_ID, CORE_IDS } from '../../../engine/coreBuddies';

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

const coreIdentity = (id: string): { buddyId: string; displayName: string; handle: string } => {
  const buddy = CORE_BY_ID[id];
  return { buddyId: id, displayName: buddy?.displayName ?? id, handle: buddy?.handle ?? id };
};

export const NPC_STYLE_PROFILES: Record<string, NpcStyleProfile> = {
  [CORE_IDS.MAYA]: {
    ...coreIdentity(CORE_IDS.MAYA),
    persona: 'Quiet, observant, creative, and a little guarded. Uses lowercase, pauses, music references, and gentle honesty. She warms up slowly and remembers small details the player shares.',
    vocabulary: ['hey...', 'umm', 'maybe', 'i think', 'soft', 'quiet', 'music', 'rain', 'coffee', '~'],
    punctuation: 'lowercase, uses "..." and "~" softly, rarely caps, occasional :)',
    quirks: ['lowercase-heavy', 'hesitant pauses ...', 'ends with ~ sometimes', 'music/rain references', 'remembers player details'],
    typing: { wpm: 55, variance: 18, pauseStyle: 'hesitant with 300-800ms mid-sentence pauses' },
    summaryHint: 'Maya speaks lowercase, hesitant, warm but reserved.',
  },
  [CORE_IDS.RYAN]: {
    ...coreIdentity(CORE_IDS.RYAN),
    persona: 'Warm, impulsive food-cart coworker. Uses casual slang, jokes, and short messages. He avoids heavy emotional talks unless trust is high. Fast, direct, friendly, uses lol and yo.',
    vocabulary: ['yo', 'dude', 'lol', 'haha', 'brb', 'afk', 'yo', 'man', 'tacos', 'cart'],
    punctuation: 'short bursts, uses ! and lol, abbreviations, caps for emphasis occasionally',
    quirks: ['fast short messages', 'uses yo/lol/brb', 'food/cart slang', 'exclamation heavy when excited'],
    typing: { wpm: 85, variance: 10, pauseStyle: 'bursty, quick send' },
    summaryHint: 'Ryan is fast, slangy, direct, playful.',
  },
  [CORE_IDS.NORA]: {
    ...coreIdentity(CORE_IDS.NORA),
    persona: 'Night-owl archivist with dry humor. Curious about strange details, concise, slightly cryptic, but not supernatural. She notices patterns others miss and speaks in precise, slightly poetic fragments.',
    vocabulary: ['quiet', 'indexing', 'logs', 'hum', 'canal', 'night', 'strange', 'observed', 'perhaps'],
    punctuation: 'concise, precise, uses . and —, rarely emoticons, uses lowercase for style sometimes',
    quirks: ['concise', 'dry humor', 'cryptic but grounded', 'references logs/nightboard', 'notices acoustic details'],
    typing: { wpm: 88, variance: 12, pauseStyle: 'steady, deliberate' },
    summaryHint: 'Nora is concise, dry, slightly cryptic, observant.',
  },
  [CORE_IDS.HENDERSON]: {
    ...coreIdentity(CORE_IDS.HENDERSON),
    persona: 'Professional motel manager. Formal, practical, and terse. He cares about rent, schedules, and keeping the property calm. Polite but never casual, uses proper capitalization and punctuation.',
    vocabulary: ['Please', 'Regarding', 'Office', 'Account', 'Convenient', 'Regards', 'Notice', 'Policy'],
    punctuation: 'formal, proper capitalization, periods, no slang, no emoticons',
    quirks: ['formal/polite', 'references office hours/policy', 'terse', 'never slang'],
    typing: { wpm: 42, variance: 8, pauseStyle: 'slow, deliberate, proper' },
    summaryHint: 'Henderson is formal, terse, professional.',
  },
};

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
    if (gameHour >= 0 && gameHour <= 6) return 'away — may respond slowly (late night)';
    return 'away — may respond after a short delay';
  }
  if (presence.status === 'busy') return 'busy — unlikely to reply quickly';
  return 'offline — not expecting a prompt reply';
}

export function getNpcActivityLabel(presence: BuddyPresence | undefined, buddyId: string, gameHour: number): string {
  if (presence?.awayMessage) return presence.awayMessage;
  if (presence?.status === 'online') {
    if (buddyId === CORE_IDS.MAYA && gameHour >= 18) return 'online — listening to rain / myplace/mayablue';
    if (buddyId === CORE_IDS.RYAN && gameHour >= 18) return 'online — gaming / chilling';
    if (buddyId === CORE_IDS.NORA && gameHour >= 22) return 'online — indexing logs / nightboard';
    if (buddyId === CORE_IDS.HENDERSON && gameHour >= 8 && gameHour <= 18) return 'online — motel front desk open';
    return 'online and checking messages';
  }
  if (presence?.status === 'away') return presence.awayMessage || 'stepped away briefly';
  return 'offline';
}

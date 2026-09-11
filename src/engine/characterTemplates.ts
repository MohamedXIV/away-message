// src/engine/characterTemplates.ts
// Template library for the unified CharacterEngine — offline, deterministic, era-locked.
// Each archetype defines a weekly daily-rhythm, baseline relationships, and typing speed.
// Callers supply id/displayName/handle; the template supplies everything behavioural.

import type {
  BuddyAttitude,
  BuddyCharacter,
  BuddyPresenceStatus,
  CharacterArchetype,
  CharacterTraits,
  DailyMood,
  GlobalEventCategory,
  RelationshipDimensions,
  RelationshipStage,
  ScheduleBlock,
} from './types';
import { CORE_BUDDIES, CORE_BY_ID } from './coreBuddies';

export interface ScheduleBlockSpec {
  start: number; // minute of day 0..1439
  end: number; // minute of day 0..1440
  status: BuddyPresenceStatus;
  msg: string;
}

export interface CharacterArchetypeTemplate {
  archetype: CharacterArchetype;
  label: string;
  blurb: string;
  dailyBlocks: ScheduleBlockSpec[];
  initialRelationships: RelationshipDimensions;
  typingSpeedWpm: number;
  /** Fixed temperament for this archetype (procedural buddies inherit + stable jitter). */
  defaultTraits: CharacterTraits;
  personaHint: string;
  vocabulary: string[];
  quirks: string[];
  offlineLines: string[];
  defaultInterests: string[];
  defaultSong: string;
}

function blocks(specs: ScheduleBlockSpec[]): ScheduleBlock[] {
  return specs.map((b) => ({
    startMinuteOfDay: b.start,
    endMinuteOfDay: b.end,
    status: b.status,
    awayMessage: b.msg,
  }));
}

/** Weekly rotation: pattern repeats every 7 days (day 1..7 keys). */
export function buildWeeklySchedule(dailyBlocks: ScheduleBlockSpec[]): Record<number, ScheduleBlock[]> {
  const day = blocks(dailyBlocks);
  const sched: Record<number, ScheduleBlock[]> = {};
  for (let d = 1; d <= 7; d++) {
    sched[d] = day.map((b) => ({ ...b }));
  }
  return sched;
}

export const CHARACTER_ARCHETYPES: Record<CharacterArchetype, CharacterArchetypeTemplate> = {
  coworker: {
    archetype: 'coworker',
    label: 'Coworker',
    blurb: 'Works days, hangs out online in the evening.',
    dailyBlocks: [
      { start: 0, end: 420, status: 'offline', msg: 'asleep' },
      { start: 420, end: 540, status: 'offline', msg: 'commute' },
      { start: 540, end: 960, status: 'offline', msg: 'at work' },
      { start: 960, end: 1080, status: 'away', msg: 'grabbing food' },
      { start: 1080, end: 1320, status: 'online', msg: 'chilling' },
      { start: 1320, end: 1440, status: 'offline', msg: 'crashed' },
    ],
    initialRelationships: { familiarity: 25, trust: 30, comfort: 35, respect: 35, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    defaultTraits: { shyness: 25, warmth: 75, discipline: 55, spontaneity: 70, loyalty: 65 },
    typingSpeedWpm: 75,
    personaHint: 'Practical, friendly, a little teasing. Talks about work, food, and gear.',
    vocabulary: ['yo', 'lol', 'dude', 'brutal shift', 'tacos', 'bench test'],
    quirks: ['short bursts', 'slang-heavy', 'sends food pics talk'],
    offlineLines: [
      'yo, leaving this here before i crash. we still on for later?',
      'shift was brutal lol. hmu when you are back',
      'found something cool at work — will tell you when you are on',
    ],
    defaultInterests: ['Work Stories', 'Food', 'Gear'],
    defaultSong: 'Shop Radio Mix',
  },
  nightowl: {
    archetype: 'nightowl',
    label: 'Night Owl',
    blurb: 'Sleeps days, archives the night.',
    dailyBlocks: [
      { start: 0, end: 300, status: 'online', msg: 'the night is quiet' },
      { start: 300, end: 360, status: 'away', msg: 'watching dawn' },
      { start: 360, end: 1140, status: 'offline', msg: 'offline' },
      { start: 1140, end: 1320, status: 'away', msg: 'indexing logs' },
      { start: 1320, end: 1440, status: 'online', msg: 'night shift' },
    ],
    initialRelationships: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    defaultTraits: { shyness: 60, warmth: 45, discipline: 70, spontaneity: 35, loyalty: 75 },
    typingSpeedWpm: 90,
    personaHint: 'Dry humor, concise, a little cryptic. Curious about strange details.',
    vocabulary: ['logged', 'archive', 'frequency', 'quiet', 'noted'],
    quirks: ['terse one-liners', 'timestamps things', 'dry asides'],
    offlineLines: [
      'you were offline. i found an interesting link and bookmarked it for you.',
      'night was quiet. left you something to read when you are back.',
      'logged something strange at 3am. tell me if you saw it too?',
    ],
    defaultInterests: ['Night Logs', 'Archives', 'Quiet Hours'],
    defaultSong: 'Static Hum (Field Recording)',
  },
  student: {
    archetype: 'student',
    label: 'Student',
    blurb: 'Classes by day, cramming and chatting by night.',
    dailyBlocks: [
      { start: 0, end: 420, status: 'offline', msg: 'asleep' },
      { start: 420, end: 480, status: 'away', msg: 'morning rush' },
      { start: 480, end: 900, status: 'offline', msg: 'in class' },
      { start: 900, end: 1020, status: 'away', msg: 'library?' },
      { start: 1020, end: 1380, status: 'online', msg: 'cramming / chatting' },
      { start: 1380, end: 1440, status: 'offline', msg: 'crashed' },
    ],
    initialRelationships: { familiarity: 10, trust: 15, comfort: 25, respect: 30, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    defaultTraits: { shyness: 30, warmth: 80, discipline: 40, spontaneity: 85, loyalty: 55 },
    typingSpeedWpm: 85,
    personaHint: 'Energetic, abbreviation-heavy, asks lots of questions. Big on music and campus gossip.',
    vocabulary: ['omg', 'brb', 'lol', 'quiz', 'cramming', 'u up?'],
    quirks: ['many questions', 'emoji-ish shorthand', 'multi-message bursts'],
    offlineLines: [
      'omg you missed me!! quiz tomorrow kill me lol. hmu when ur back',
      'brb physics is eating me alive. tell me everything later??',
      'left you a whole rant about today. read it when ur on!!',
    ],
    defaultInterests: ['Campus', 'Music', 'Late Snacks'],
    defaultSong: 'Cram Session Mix',
  },
  trader: {
    archetype: 'trader',
    label: 'Trader',
    blurb: 'Watches tickers in the morning, deals at noon.',
    dailyBlocks: [
      { start: 0, end: 360, status: 'offline', msg: 'asleep' },
      { start: 360, end: 720, status: 'online', msg: 'watching the tape' },
      { start: 720, end: 960, status: 'away', msg: 'out dealing' },
      { start: 960, end: 1200, status: 'online', msg: 'back at the desk' },
      { start: 1200, end: 1440, status: 'offline', msg: 'early night' },
    ],
    initialRelationships: { familiarity: 8, trust: 10, comfort: 15, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    defaultTraits: { shyness: 35, warmth: 40, discipline: 85, spontaneity: 45, loyalty: 50 },
    typingSpeedWpm: 70,
    personaHint: 'Terse, numbers-first, always checking prices. Friendly when a deal lands.',
    vocabulary: ['tape', 'spread', 'bid', 'closed at', 'volume'],
    quirks: ['quotes numbers', 'short sentences', 'correct punctuation'],
    offlineLines: [
      'tape moved while you were out. left you the numbers.',
      'closed a small deal today. details when you are back.',
      'watching the open tomorrow. ping me early?',
    ],
    defaultInterests: ['Markets', 'Deals', 'Morning Tape'],
    defaultSong: 'Opening Bell Ambience',
  },
  artist: {
    archetype: 'artist',
    label: 'Artist',
    blurb: 'Rehearses days, plays late.',
    dailyBlocks: [
      { start: 0, end: 480, status: 'offline', msg: 'sleeping' },
      { start: 480, end: 600, status: 'offline', msg: 'morning coffee' },
      { start: 600, end: 1020, status: 'away', msg: 'rehearsal / day job' },
      { start: 1020, end: 1260, status: 'online', msg: 'home, noodling on guitar' },
      { start: 1260, end: 1440, status: 'online', msg: 'late set / listening room' },
    ],
    initialRelationships: { familiarity: 15, trust: 20, comfort: 25, respect: 35, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    defaultTraits: { shyness: 70, warmth: 65, discipline: 45, spontaneity: 60, loyalty: 80 },
    typingSpeedWpm: 70,
    personaHint: 'Warm, expressive, talks in images. Shares songs, gigs, and gear talk.',
    vocabulary: ['tone', 'take', 'mix', 'gig', 'strings', '~'],
    quirks: ['lowercase-ish', 'music metaphors', 'shares what they are hearing'],
    offlineLines: [
      'hey... missed you. left a new take on my page, tell me what you think?',
      'rehearsal ran late. humming something new — will play it for you later ~',
      'was thinking about that song we talked about. hope you are good.',
    ],
    defaultInterests: ['Gigs', 'Gear', 'Mixtapes'],
    defaultSong: 'Bedroom Take 04',
  },
  regular: {
    archetype: 'regular',
    label: 'Regular',
    blurb: 'Around most evenings, quiet weekends.',
    dailyBlocks: [
      { start: 0, end: 450, status: 'offline', msg: 'asleep' },
      { start: 450, end: 1020, status: 'offline', msg: 'out living life' },
      { start: 1020, end: 1140, status: 'away', msg: 'making dinner' },
      { start: 1140, end: 1350, status: 'online', msg: 'evening check-in' },
      { start: 1350, end: 1440, status: 'offline', msg: 'winding down' },
    ],
    initialRelationships: { familiarity: 10, trust: 15, comfort: 20, respect: 30, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    defaultTraits: { shyness: 40, warmth: 55, discipline: 80, spontaneity: 30, loyalty: 70 },
    typingSpeedWpm: 65,
    personaHint: 'Easygoing, balanced, a good listener. Small talk that turns real slowly.',
    vocabulary: ['hey', 'nice', 'how was', 'sounds good'],
    quirks: ['polite openers', 'asks about your day', 'short paragraphs'],
    offlineLines: [
      'hey, you missed me earlier. hope your day went okay — ping me later?',
      'stopped by to say hi. catch you in the evening?',
      'left you a quick hello. no rush replying.',
    ],
    defaultInterests: ['Evenings', 'Walks', 'Radio'],
    defaultSong: 'Evening Static',
  },
};

export function getArchetypeTemplate(archetype: CharacterArchetype): CharacterArchetypeTemplate {
  return CHARACTER_ARCHETYPES[archetype]!;
}

export interface NamePoolEntry {
  id: string;
  displayName: string;
  handle: string;
}

/**
 * Offline name pools for auto-generated newcomers (era-fitting, no real people).
 * Ids double as MyPlace usernames (e.g. myplace.local/june_tape).
 */
export const ARCHETYPE_NAME_POOLS: Record<CharacterArchetype, NamePoolEntry[]> = {
  coworker: [
    { id: 'dana_counter', displayName: 'Dana', handle: 'dana_counter' },
    { id: 'leo_grill', displayName: 'Leo', handle: 'leo_grill' },
    { id: 'priya_depot', displayName: 'Priya', handle: 'priya_depot' },
    { id: 'marco_cart', displayName: 'Marco', handle: 'marco_cart' },
  ],
  nightowl: [
    { id: 'iris_afterhours', displayName: 'Iris', handle: 'iris_afterhours' },
    { id: 'cole_static', displayName: 'Cole', handle: 'cole_static' },
    { id: 'wren_night', displayName: 'Wren', handle: 'wren_night' },
    { id: 'otis_lowfreq', displayName: 'Otis', handle: 'otis_lowfreq' },
  ],
  student: [
    { id: 'jules_cram', displayName: 'Jules', handle: 'jules_cram' },
    { id: 'tara_dorm', displayName: 'Tara', handle: 'tara_dorm' },
    { id: 'dev_quad', displayName: 'Dev', handle: 'dev_quad' },
    { id: 'mina_library', displayName: 'Mina', handle: 'mina_library' },
  ],
  trader: [
    { id: 'vik_tape', displayName: 'Vik', handle: 'vik_tape' },
    { id: 'rosa_bid', displayName: 'Rosa', handle: 'rosa_bid' },
    { id: 'hank_ledger', displayName: 'Hank', handle: 'hank_ledger' },
    { id: 'suki_tick', displayName: 'Suki', handle: 'suki_tick' },
  ],
  artist: [
    { id: 'june_tape', displayName: 'June', handle: 'june_tape' },
    { id: 'theo_fret', displayName: 'Theo', handle: 'theo_fret' },
    { id: 'lena_reel', displayName: 'Lena', handle: 'lena_reel' },
    { id: 'kai_chorus', displayName: 'Kai', handle: 'kai_chorus' },
  ],
  regular: [
    { id: 'bill_porch', displayName: 'Bill', handle: 'bill_porch' },
    { id: 'ana_corner', displayName: 'Ana', handle: 'ana_corner' },
    { id: 'tom_evening', displayName: 'Tom', handle: 'tom_evening' },
    { id: 'ruth_window', displayName: 'Ruth', handle: 'ruth_window' },
  ],
};

/** First-contact Pulse openers per archetype (link appended by the director). */
export const ARCHETYPE_INTRO_LINES: Record<CharacterArchetype, string[]> = {
  coworker: [
    'hey! i\'m {name} — we crossed paths at work today. mind if i add you here?',
    'yo {name} here, from the shift. good meeting you — lets stay in touch?',
  ],
  nightowl: [
    'hey. i\'m {name}. saw you on NightBoard late. mind if i add you?',
    'you\'re up late too. i\'m {name} — adding you here, hope thats ok.',
  ],
  student: [
    ' hii im {name}!! met you online, adding you here ok??',
    'yo its {name} — we should totally hang on here more lol',
  ],
  trader: [
    'hey, {name} here. we move in the same circles. adding you.',
    '{name}. good meeting you — lets keep a line open.',
  ],
  artist: [
    'hey... i\'m {name}. loved your vibe — mind if i add you here? ~',
    'hi, {name} here. lets trade songs sometime?',
  ],
  regular: [
    'hey, i\'m {name}. nice meeting you — adding you here.',
    'hi! {name} here. hope its ok i added you :)',
  ],
};

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Avalanche a seed string into a well-spread 32-bit hash. Plain hashSeed
 * clusters when inputs differ only in a trailing digit (e.g. consecutive
 * days → consecutive rolls), which would correlate whole systems day to day.
 * New code must roll/pick through these helpers, never raw hashSeed % N.
 */
export function spreadSeed(seed: string): number {
  let h = hashSeed(seed);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic 0..99 roll with good spread across sequential inputs. */
export function rollSeeded100(seed: string): number {
  return spreadSeed(seed) % 100;
}

/** Deterministic pool pick with good spread across sequential inputs. */
export function pickSeeded<T>(pool: readonly T[], seed: string): T {
  return pool[spreadSeed(seed) % pool.length]!;
}

/** Deterministic name pick that skips taken ids (suffixes _2, _3 when pools exhaust). */
export function pickTemplateName(
  archetype: CharacterArchetype,
  seed: string,
  takenIds: Set<string> | string[]
): NamePoolEntry {
  const taken = takenIds instanceof Set ? takenIds : new Set(takenIds);
  const pool = ARCHETYPE_NAME_POOLS[archetype]!;
  const start = hashSeed(`${seed}:${archetype}`) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const entry = pool[(start + i) % pool.length]!;
    if (!taken.has(entry.id) && !taken.has(entry.handle)) return entry;
  }
  // Pool exhausted — suffix the deterministic pick (still stable for the same seed+taken set size)
  const base = pool[start % pool.length]!;
  let n = 2;
  while (taken.has(`${base.id}_${n}`)) n++;
  return { id: `${base.id}_${n}`, displayName: base.displayName, handle: `${base.handle}_${n}` };
}

/** Deterministic first-contact line with {name} filled in (no link — director appends it). */
export function pickTemplateIntroLine(archetype: CharacterArchetype, seed: string, displayName: string): string {
  const lines = ARCHETYPE_INTRO_LINES[archetype]!;
  const line = lines[hashSeed(`${seed}:${archetype}:intro`) % lines.length]!;
  return line.replaceAll('{name}', displayName);
}

/** Core ids → archetype, derived from the registry (single source of truth). */
export const CORE_ID_TO_ARCHETYPE: Record<string, CharacterArchetype> = Object.fromEntries(
  CORE_BUDDIES.map((b) => [b.id, b.archetype])
);

export function resolveArchetype(buddyId: string, stored?: CharacterArchetype): CharacterArchetype {
  if (stored && CHARACTER_ARCHETYPES[stored]) return stored;
  return CORE_ID_TO_ARCHETYPE[buddyId] ?? 'regular';
}

export interface AttitudeEntry {
  att: BuddyAttitude;
  takes: string[];
}

/**
 * Per-archetype attitude palettes for world events.
 * coworker/artist/nightowl/regular carry the original ryan/maya/nora/henderson
 * voices verbatim; student/trader are new but follow the same shape.
 */
export const ARCHETYPE_ATTITUDES: Record<CharacterArchetype, Record<GlobalEventCategory, AttitudeEntry>> = {
  coworker: {
    os_release: { att: 'hyped', takes: ['gonna camp TechMart for the box', 'benchmarked it on my rig already', 'my cart is ready'] },
    site_launch: { att: 'curious', takes: ["checking if my band page survives v2", "hope my links don't break"] },
    economy: { att: 'hyped', takes: ['flipped a stick and bought tacos', 'watching BidBay like a hawk'] },
    culture: { att: 'curious', takes: ['glitter is wild but fun', 'need that tiler for my page'] },
    city_news: { att: 'indifferent', takes: ['saw it from the cart', 'night market sounds good after shift'] },
    system: { att: 'worried', takes: ['throttle will kill my downloads', 'gonna queue overnight'] },
    pulse_update: { att: 'curious', takes: ['new chat thing? does it break my tabs', 'updating after shift'] },
  },
  artist: {
    os_release: { att: 'skeptical', takes: ['glossy is pretty but my 512 is fine', 'not upgrading just for a dock'] },
    site_launch: { att: 'annoyed', takes: ['Top 8 feels like ranking friends', 'autoplay blasts at 2am'] },
    economy: { att: 'indifferent', takes: ['not my game', 'glad someone made money'] },
    culture: { att: 'curious', takes: ['love the canal rain song', 'tiling stars is kinda pretty'] },
    city_news: { att: 'curious', takes: ['night market by the canal — want to go?', 'hum kept me up, heard it too?'] },
    system: { att: 'annoyed', takes: ['throttle ruins my playlist loads', 'will stay up late anyway'] },
    pulse_update: { att: 'curious', takes: ['ooh new way to send songs?', 'hope my away messages survive'] },
  },
  nightowl: {
    os_release: { att: 'skeptical', takes: ['skin backport is the real story', 'bench says 7 is slower on 512'] },
    site_launch: { att: 'curious', takes: ['threaded replies will save NightBoard', 'archiving the launch'] },
    economy: { att: 'curious', takes: ['watching GoldNet like a tape', 'canal air moves markets'] },
    culture: { att: 'skeptical', takes: ['glitter is archival noise', 'counter tracks the decay'] },
    city_news: { att: 'hyped', takes: ['hum is infrastructure — logged it', 'have a spectral capture'] },
    system: { att: 'curious', takes: ['throttle is a good control variable', 'logging packet loss'] },
    pulse_update: { att: 'curious', takes: ['logging the changelog', 'quiet rollout, good'] },
  },
  regular: {
    os_release: { att: 'indifferent', takes: ['as long as the office PC boots', 'support ends for 4.8?'] },
    site_launch: { att: 'indifferent', takes: ['keep it quiet after 10pm', 'no glitter in the lobby'] },
    economy: { att: 'worried', takes: ['rent still due regardless', 'don’t gamble rent on GoldNet'] },
    culture: { att: 'annoyed', takes: ['glitter slows the office machine', 'please no autoplay in hours'] },
    city_news: { att: 'curious', takes: ['night market needs a permit?', 'hum is the substation, per city'] },
    system: { att: 'worried', takes: ['maintenance affects motel DSL too', 'guests complained last time'] },
    pulse_update: { att: 'indifferent', takes: ['as long as messages still arrive', 'will update when I must'] },
  },
  student: {
    os_release: { att: 'curious', takes: ['does it run on 512? asking for a friend', 'gonna install it on the library pc lol'] },
    site_launch: { att: 'hyped', takes: ['already remade my whole page', 'new background who dis'] },
    economy: { att: 'indifferent', takes: ['broke student life', 'rich people stuff lol'] },
    culture: { att: 'hyped', takes: ['this is my whole personality now', 'sending this to the group chat'] },
    city_news: { att: 'curious', takes: ['ooh is that near campus?', 'might check it out after class'] },
    system: { att: 'annoyed', takes: ['throttle during finals week??', 'my essay upload will die'] },
    pulse_update: { att: 'hyped', takes: ['new emotes?? updating NOW', 'brb new version time'] },
  },
  trader: {
    os_release: { att: 'curious', takes: ['does it speed up my terminal?', "benchmarks or it didn't happen"] },
    site_launch: { att: 'indifferent', takes: ['noted.', 'does it move markets? no? ok'] },
    economy: { att: 'hyped', takes: ['bought the rumor', "volume confirms, i'm in"] },
    culture: { att: 'skeptical', takes: ['noise.', 'counter-trading the hype'] },
    city_news: { att: 'indifferent', takes: ['saw it on the wire', 'no position'] },
    system: { att: 'worried', takes: ['throttle kills my quotes feed', 'need backup dial-up'] },
    pulse_update: { att: 'indifferent', takes: ['uptime matters, updating overnight', 'any downtime window?'] },
  },
};

/** Deterministic offline line for an archetype (stable across reloads). */
export function pickTemplateOfflineLine(archetype: CharacterArchetype, seedMinute: number): string {
  const lines = CHARACTER_ARCHETYPES[archetype]?.offlineLines ?? CHARACTER_ARCHETYPES['regular'].offlineLines;
  return lines[Math.abs(seedMinute) % lines.length]!;
}

// ==========================================
// P3 — INITIATIVES & SHARP-EVENT LINES
// NPCs only ever speak from these pools (rules pick the moment, AI only
// paraphrases inside live chat). All {event}/{promise} placeholders filled by caller.
// ==========================================

/** NPC-initiated check-ins per archetype — only sent to friend+ buddies, max once/day. */
export const ARCHETYPE_INITIATIVE_LINES: Record<CharacterArchetype, string[]> = {
  coworker: [
    'yo, slow shift. hows your day going?',
    'hey, you alive over there? been quiet lol',
    'break time. whats new with you?',
  ],
  nightowl: [
    'youre up. im up. coincidence? probably not.',
    'quiet night. you doing okay?',
    'hey. couldnt sleep. you around?',
  ],
  student: [
    'hiii!! guess who got bored in class lol. wassup??',
    'yo yo, break between lectures. talk to meee',
    'ugh homework. distract me pls??',
  ],
  trader: [
    'markets are dead today. you around?',
    'hey. slow board. whats the word?',
    'checking in — everything good on your end?',
  ],
  artist: [
    'hey... working on something new. how are you doing? ~',
    'rain sounds good tonight. thinking of you — hows things?',
    'hi. needed a break from the canvas. you okay?',
  ],
  regular: [
    'hey, just checking in. everything alright?',
    'hi! slow day at the desk. how are you?',
    'hey there — long time no chat. all good?',
  ],
};

/** World-event shares per archetype — {event} is the short event title from world knowledge. */
export const ARCHETYPE_EVENT_SHARE_LINES: Record<CharacterArchetype, string[]> = {
  coworker: [
    'yo did you see {event}? wild lol',
    'hey, {event} — thats gonna mess with my shift i bet',
  ],
  nightowl: [
    '{event}. logged. thought you should know.',
    'saw {event} on the boards. make of that what you will.',
  ],
  student: [
    'OMG did you hear about {event}?? everyone is talking about it!!',
    'yo {event}!! thats actually kinda huge lol',
  ],
  trader: [
    '{event}. moving my positions accordingly.',
    'heads up: {event}. could shake the board.',
  ],
  artist: [
    'hey... {event}. feels like material for a song, honestly ~',
    '{event}... strange times. what do you make of it?',
  ],
  regular: [
    'did you hear about {event}? just making sure you saw.',
    'hey — {event}. thought i should mention it.',
  ],
};

/** Sharp-event confrontation openers per archetype — sent once when annoyance crosses the line. */
export const ARCHETYPE_CONFRONT_LINES: Record<CharacterArchetype, string[]> = {
  coworker: [
    'ok real talk — youve been brushing me off all week. whats up with that?',
    'hey. i dont love how this has been going. did i do something?',
  ],
  nightowl: [
    'youve gone cold. say it straight — are we good or not?',
    'i notice patterns. yours changed. talk to me.',
  ],
  student: [
    'ok wow, youve been ignoring me?? did i do something wrong??',
    'hey... feels like youre mad at me. pls just tell me??',
  ],
  trader: [
    'straight talk: youve been dismissive. i dont do one-sided.',
    'positions are clear — you checked out. want to fix it or not?',
  ],
  artist: [
    'hey... you feel far away lately. did i lose you somewhere? ~',
    'i wrote three verses about this silence. please just talk to me.',
  ],
  regular: [
    'i have to ask — have i done something to upset you?',
    'youve seemed distant. id rather hear it straight.',
  ],
};

/** Farewell lines when a buddy goes distant (procedural buddies only, core 4 never leave). */
export const ARCHETYPE_FAREWELL_LINES: Record<CharacterArchetype, string[]> = {
  coworker: [
    'alright. i need some space for a while. dont take it personal... actually, take it a little personal.',
    'im out for a bit. maybe ill catch you around. maybe not.',
  ],
  nightowl: [
    'going dark for a while. dont follow.',
    'logging off. this frequency is dead.',
  ],
  student: [
    'ok i cant do this rn... need space. bye for now??',
    'this hurts lol. im gonna go offline for a while. take care??',
  ],
  trader: [
    'closing this position. out for a while.',
    'done here. capital preserved. goodbye.',
  ],
  artist: [
    'i need quiet for a while... goodbye, for now ~',
    'the song ended. take care of yourself.',
  ],
  regular: [
    'i think i need some time away. take care.',
    'going quiet for a while. no hard feelings — just tired.',
  ],
};

/** Return lines when a distant buddy comes back after a week. */
export const ARCHETYPE_RETURN_LINES: Record<CharacterArchetype, string[]> = {
  coworker: [
    'yo... im back. sorry i vanished. we cool?',
    'hey. time off helped. can we reset?',
  ],
  nightowl: [
    'back online. the static cleared. hey.',
    'reconnected. sorry for the silence.',
  ],
  student: [
    'hiii... im back?? missed talking to you lol. forgive me??',
    'ok im back!! sorry i ghosted. are we ok??',
  ],
  trader: [
    'reopening. cool head now. truce?',
    'back on the board. lets reset.',
  ],
  artist: [
    'hey... im back. wrote a lot while i was gone. missed you ~',
    'the quiet helped. im here again — hi.',
  ],
  regular: [
    'hey. im back — sorry for going quiet.',
    'time helped. id like to start over, if thats okay.',
  ],
};

/** Promise-reminder nudges — {promise} is the player's own commitment text. */
export const PROMISE_REMINDER_LINES: string[] = [
  'hey, not to nag but... you said: "{promise}". still on?',
  'reminder from your friendly neighborhood buddy: "{promise}" — did that happen?',
  'sooo... "{promise}"?? just checking lol',
];

/** Cafe-invite openers (rare initiative kind, close buddies only). */
export const CAFE_INVITE_LINES: string[] = [
  'hey, you free later? grab a coffee at the cafe with me?',
  'cafe later? my treat. could use the company.',
  'wanna meet at the cafe sometime soon? been too long.',
];

/** C2 gossip lines — {name} is going through a visible rough patch (distant) or vanished (gone). */
export const GOSSIP_DISTANT_LINES: string[] = [
  'hey... have you heard from {name} lately? theyve gone quiet on me.',
  'kinda worried about {name} tbh. they pulled away. you noticed?',
  '{name} has been distant. hope theyre okay...',
];
export const GOSSIP_GONE_LINES: string[] = [
  'hey. {name} is just... gone. vanished. do you know what happened?',
  '{name} disappeared on me. if you hear from them, tell them i asked?',
  'still no word from {name}. that one stings.',
];

export type InitiativeKind = 'checkin' | 'event_share' | 'promise_reminder' | 'cafe_invite' | 'gossip';

function pickFromPool(pool: string[], seed: string): string {
  return pool[hashSeed(seed) % pool.length]!;
}

/** Deterministic initiative line; caller fills nothing — {event}/{promise} come from opts. */
export function pickInitiativeText(
  archetype: CharacterArchetype,
  kind: InitiativeKind,
  seed: string,
  opts?: { eventTitle?: string; promiseText?: string }
): string {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  switch (kind) {
    case 'event_share': {
      const title = (opts?.eventTitle || 'the latest news').slice(0, 80);
      return pickFromPool(ARCHETYPE_EVENT_SHARE_LINES[arch]!, `${seed}:event`).replaceAll('{event}', title);
    }
    case 'promise_reminder': {
      const promise = (opts?.promiseText || 'that thing you promised').slice(0, 120);
      return pickFromPool(PROMISE_REMINDER_LINES, `${seed}:promise`).replaceAll('{promise}', promise);
    }
    case 'cafe_invite':
      return pickFromPool(CAFE_INVITE_LINES, `${seed}:cafe`);
    case 'checkin':
    default:
      return pickFromPool(ARCHETYPE_INITIATIVE_LINES[arch]!, `${seed}:checkin`);
  }
}

export function pickConfrontLine(archetype: CharacterArchetype, seed: string): string {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  return pickFromPool(ARCHETYPE_CONFRONT_LINES[arch]!, `${seed}:confront`);
}

export function pickFarewellLine(archetype: CharacterArchetype, seed: string): string {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  return pickFromPool(ARCHETYPE_FAREWELL_LINES[arch]!, `${seed}:farewell`);
}

export function pickReturnLine(archetype: CharacterArchetype, seed: string): string {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  return pickFromPool(ARCHETYPE_RETURN_LINES[arch]!, `${seed}:return`);
}

/** C2 gossip line about another buddy's visible absence (name + status filled by caller). */export function pickGossipLine(
  _archetype: CharacterArchetype,
  seed: string,
  targetName: string,
  status: 'distant' | 'gone'
): string {
  const pool = status === 'gone' ? GOSSIP_GONE_LINES : GOSSIP_DISTANT_LINES;
  const name = targetName.trim().slice(0, 40) || 'they';
  return pickFromPool(pool, `${seed}:gossip:${status}`).replaceAll('{name}', name);
}

// ==========================================
// P5 — LIVE MEETING LINES (shared pools, {location}/{dayref} filled by caller)
// ==========================================

/** NPC confirmations — sent the day before (or same-day for tonight plans). */
export const APPT_RSVP_YES_LINES: string[] = [
  'sounds good — see you at {location} {dayref}!',
  'yes! {location} {dayref}, dont be late lol',
  'ok, {location} {dayref}. looking forward to it :)',
];
/** NPC declines — only sent when strained (rare by design). */
export const APPT_RSVP_NO_LINES: string[] = [
  'honestly... i dont think {location} {dayref} is a good idea. not right now.',
  'gonna pass on {location} {dayref}. sorry. things feel off.',
  'cant do {location} {dayref}. maybe some other time.',
];
/** NPC maybes — low mood days. */
export const APPT_RSVP_MAYBE_LINES: string[] = [
  'maybe... {location} {dayref}? ill try, no promises lol',
  '{location} {dayref} — probably. ping me that day?',
  'tentative yes for {location} {dayref}. depends how the day goes.',
];
/** NPC showed up, player didn't — one salty line, feeds the sharp ladder via dims. */
export const APPT_STOOD_UP_LINES: string[] = [
  'waited at {location}... guess something came up.',
  'i was at {location}. you never showed. cool. cool cool.',
  'sat at {location} for a while. hope youre okay, honestly a bit hurt.',
];
/** NPC flaked — apology lines. */
export const APPT_APOLOGY_LINES: string[] = [
  'im really sorry about {location} — i flaked. can i make it up to you?',
  'sorry i missed {location}... no good excuse. forgive me?',
  'i feel awful about {location}. let me reschedule, my treat?',
];

export type RsvpLineKind = 'yes' | 'no' | 'maybe';

export function pickRsvpLine(kind: RsvpLineKind, seed: string, location: string, dayRef: string): string {
  const pool = kind === 'no' ? APPT_RSVP_NO_LINES : kind === 'maybe' ? APPT_RSVP_MAYBE_LINES : APPT_RSVP_YES_LINES;
  return pickFromPool(pool, `${seed}:rsvp:${kind}`).replaceAll('{location}', location).replaceAll('{dayref}', dayRef);
}

export function pickStoodUpLine(seed: string, location: string): string {
  return pickFromPool(APPT_STOOD_UP_LINES, `${seed}:stoodup`).replaceAll('{location}', location);
}

export function pickMeetingApologyLine(seed: string, location: string): string {
  return pickFromPool(APPT_APOLOGY_LINES, `${seed}:apptapology`).replaceAll('{location}', location);
}

// ==========================================
// P5.2 — CO-OP WRAP-UP LINES ({detail} = the night's deterministic mini-event)
// ==========================================

/** Side-shift wrap-ups (Ryan-flavoured, used for work meetings that happen). */
export const SHIFT_WRAP_LINES: string[] = [
  'yo that shift was WILD. {detail} — we survived tho lol. you earned that pay',
  'we make a good crew lol. {detail} — see? told you it would be fun',
  'shift done. {detail} — thanks for jumping in, seriously',
];
/** Gig-shift wrap-ups (neutral voice — any contact can send these). */
export const GIG_WRAP_LINES: string[] = [
  'good work today. {detail} — you earned every cent of that pay.',
  'shift done, and honestly? you were great. {detail} — come back anytime.',
];
/** Archive-night wrap-ups (Nora-flavoured, used for archive meetings that happen). */
export const ARCHIVE_WRAP_LINES: string[] = [
  'productive night. {detail} — filing it under unsolved. thanks for the hands.',
  'found something. {detail} — you have good eyes for this.',
  'archive +2% sorted. {detail} — same time next week?',
];

export function pickShiftWrapLine(seed: string, detail: string): string {
  return pickFromPool(SHIFT_WRAP_LINES, `${seed}:shiftwrap`).replaceAll('{detail}', detail.slice(0, 120));
}

export function pickGigWrapLine(seed: string, detail: string): string {
  return pickFromPool(GIG_WRAP_LINES, `${seed}:gigwrap`).replaceAll('{detail}', detail.slice(0, 120));
}

export function pickArchiveWrapLine(seed: string, detail: string): string {
  return pickFromPool(ARCHIVE_WRAP_LINES, `${seed}:archivewrap`).replaceAll('{detail}', detail.slice(0, 120));
}

// ==========================================
// P5.3 — ROOM EXIT LINES (tense rooms: a rubbed-raw buddy posts this INSTEAD
// of a normal reply — per-turn only, no mute state, no save impact)
// ==========================================

export const ROOM_EXIT_LINES: string[] = [
  'ok i need air. later.',
  'yeah im gonna step out for a bit. dont wait up.',
  'this vibe is off tonight. catching you all later.',
  'not feeling this convo. im out — no hard feelings.',
];

export function pickRoomExitLine(seed: string): string {
  return pickFromPool(ROOM_EXIT_LINES, `${seed}:roomexit`);
}

// ==========================================
// P5.4 — MYPLACE SOCIAL LINES ({name} = profile owner display name)
// ==========================================

/** NPC → NPC guestbook notes left on each other's pages. */
export const GUESTBOOK_LINES: string[] = [
  'love the new look, {name}!! this page keeps getting better',
  'stopping by to say hi — the new song is stuck in my head lol',
  'your photos!! okay, teaching me your ways soon, {name}?',
  'this headline is so you. never change, {name}',
  'came for the glitter, stayed for the bio. 10/10 page',
  'added your song to my rotation, {name}!!',
];
/** Profile-owner replies to the player's guestbook notes. */
export const GUESTBOOK_REPLY_LINES: string[] = [
  'thanks for stopping by!! means a lot :)',
  'hey!! saw your note — you are the best lol',
  'aww thank you!! come back anytime :)',
];
/** Celebration when an NPC enters someone's Top 3 (positive-only news). */
export const TOP8_NEWS_LINES: string[] = [
  'omg {name} put me at #{rank} on their page!! made my whole day lol',
  'guess who just made {name}\u2019s top #{rank}?? me!! okay im happy',
  '{name} ranked me #{rank}!! screen-shotting this forever lol',
];

export function pickGuestbookLine(seed: string, ownerName: string): string {
  const name = ownerName.trim().slice(0, 40) || 'friend';
  return pickFromPool(GUESTBOOK_LINES, `${seed}:guestbook`).replaceAll('{name}', name);
}

export function pickGuestbookReplyLine(seed: string): string {
  return pickFromPool(GUESTBOOK_REPLY_LINES, `${seed}:gbreply`);
}

export function pickTop8NewsLine(seed: string, ownerName: string, rank: number): string {
  const name = ownerName.trim().slice(0, 40) || 'friend';
  const r = Math.max(1, Math.min(3, Math.floor(rank) || 1));
  return pickFromPool(TOP8_NEWS_LINES, `${seed}:top8news`).replaceAll('{name}', name).replaceAll('{rank}', String(r));
}

// ==========================================
// P5.6 — BOARD & MAIL LINES (NPC-authored threads, cross-talk replies, mail chains)
// {name} = another buddy's display name, {event}/{location} filled by caller.
// ==========================================

/** Weekly NPC-authored thread starters per archetype (title + body). */
export const BOARD_THREAD_TOPICS: Record<CharacterArchetype, Array<{ title: string; body: string }>> = {
  coworker: [
    { title: 'best cheap eats near 4th & industrial?', body: 'settling a debate. price, portion, hours. go.' },
    { title: 'shift swap board — post yours here', body: 'got tuesday, need friday. or the other way. whatever, post it.' },
    { title: 'psa: the vending machine by the depot eats quarters', body: 'lost 75 cents. consider this a public service announcement.' },
  ],
  nightowl: [
    { title: '3am log: the hum changed pitch again', body: 'down 2hz after the substation work. recordings attached to my usual spot. discuss.' },
    { title: 'unindexed box — need a second pair of eyes', body: 'found a box with no tag and bad handwriting. if you like mysteries, this one is yours.' },
    { title: 'quietest hour poll', body: 'when does this town actually sleep? my money is on 4:40am. data welcome.' },
  ],
  student: [
    { title: 'anyone selling last semester notes??', body: 'will pay in snacks and eternal gratitude lol' },
    { title: 'campus laundry machine #3 is HAUNTED (jk... unless?)', body: 'it ate my quarters AND my favorite shirt. thread for fellow victims' },
    { title: 'study group forming?? night edition', body: 'library closes too early. motel parking lot? bring chips' },
  ],
  trader: [
    { title: 'daily board: what moved overnight', body: 'post your fills. no hype, numbers only.' },
    { title: 'backup dial-up providers ranked', body: 'primary went down twice this week. ranking every fallback i tried.' },
    { title: 'iso: working parallel cable', body: 'will trade a spare hub. no lowballing, i know what i have.' },
  ],
  artist: [
    { title: 'rain recordings vol. 4 — feedback wanted ~', body: 'new batch from the canal nights. tell me which take breathes best.' },
    { title: 'looking for a wall (legal ones only)', body: 'have sketches, have permission slip, need a big flat legal wall.' },
    { title: 'tape swap anyone?', body: 'made a 60-min mix of slow rainy stuff. will dub a copy for anyone who asks ~' },
  ],
  regular: [
    { title: 'lost: one grey scarf near the motel office', body: 'if found please leave at the front desk. reward: gratitude.' },
    { title: 'reminder: quiet hours start at 10pm', body: 'posting this with love. the walls are thin and so is my patience.' },
    { title: 'community board: odd jobs wanted/offered', body: 'post jobs or availability. keep it neighborly.' },
  ],
};

/** Event-driven thread starters ({event} = short world-event title). */
export const BOARD_EVENT_THREADS: Array<{ title: string; body: string }> = [
  { title: 'did anyone else see: {event}??', body: 'just saw the news. thread for reactions, details, sightings.' },
  { title: '{event} — megathread', body: 'keeping it all in one place. post updates as they come.' },
];

/** Cross-talk replies — {name} is another NPC the replier addresses by name. */
export const BOARD_REPLIES: string[] = [
  'seconding this. {name}, you called it last week lol',
  '{name} was literally just saying this. anyway +1',
  'hard agree. {name}, thoughts? you usually have data',
  'lol {name} owes me a soda, i predicted exactly this',
  'quoting {name} from the lounge: "told you so". so. told you so.',
  'interesting. {name} disagrees but i am on your side on this one',
];

/** Plain replies (no cross-talk) for variety. */
export const BOARD_PLAIN_REPLIES: string[] = [
  'lol this is exactly the content i come here for',
  'saving this thread. good stuff.',
  'can confirm, saw the same thing last night',
  '+1. nothing to add, just +1',
  'this board never disappoints',
];

/** Post-meeting thank-you mail ({location} filled by caller). */
export const MAIL_THANKS_LINES: string[] = [
  'hey — last night at {location} was really good. thanks for showing up. lets do it again sometime :)',
  'still thinking about {location}. glad we did that. you are good company, you know?',
];
/** Apology mail after the NPC flaked ({location} filled by caller). */
export const MAIL_APOLOGY_LINES: string[] = [
  'ok this needed more than a chat message: i am sorry about {location}. no excuses, i messed up. let me make it up to you — dinner is on me.',
  'writing properly because you deserve it: sorry i missed {location}. i feel awful. tell me how to fix it?',
];
/** Farewell mail when a buddy goes distant/gone (longer than the Pulse line). */
export const MAIL_FAREWELL_LINES: string[] = [
  'hey. i am writing this instead of saying it because i would chicken out. i need to go quiet for a while. it is not all you — mostly it is me and the noise in my head. keep the light on? maybe i will be back.',
  'so... i am gone for a bit. dont write back, i mean it kindly — i just need the static to stop. take care of yourself. you were a good friend.',
];
/** Welcome-back mail on return. */
export const MAIL_WELCOME_LINES: string[] = [
  'hey. i am back. saw your messages (all of them). thank you for not giving up on me. coffee soon? please say yes.',
  'ok. the quiet helped and i missed you. i am back online and i would like to start over, if that is okay.',
];

function fillBoard(text: string, replacements: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(replacements)) out = out.replaceAll(`{${key}}`, value);
  return out;
}

export function pickBoardTopic(archetype: CharacterArchetype, week: number, slot: number): { title: string; body: string } {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  const pool = BOARD_THREAD_TOPICS[arch]!;
  const entry = pool[(week * 2 + slot) % pool.length]!;
  return { title: entry.title, body: entry.body };
}

export function pickBoardEventThread(seed: string, eventTitle: string): { title: string; body: string } {
  const entry = BOARD_EVENT_THREADS[hashSeed(seed) % BOARD_EVENT_THREADS.length]!;
  const clean = eventTitle.trim().slice(0, 60) || 'the latest news';
  return { title: fillBoard(entry.title, { event: clean }), body: fillBoard(entry.body, { event: clean }) };
}

export function pickBoardReply(seed: string, otherName?: string): string {
  if (otherName && otherName.trim()) {
    return pickFromPool(BOARD_REPLIES, `${seed}:xreply`).replaceAll('{name}', otherName.trim().slice(0, 40));
  }
  return pickFromPool(BOARD_PLAIN_REPLIES, `${seed}:preply`);
}

export function pickMailThanks(seed: string, location: string): string {
  return pickFromPool(MAIL_THANKS_LINES, `${seed}:mailthanks`).replaceAll('{location}', location);
}

export function pickMailApology(seed: string, location: string): string {
  return pickFromPool(MAIL_APOLOGY_LINES, `${seed}:mailapology`).replaceAll('{location}', location);
}

export function pickMailFarewell(seed: string): string {
  return pickFromPool(MAIL_FAREWELL_LINES, `${seed}:mailfarewell`);
}

export function pickMailWelcome(seed: string): string {
  return pickFromPool(MAIL_WELCOME_LINES, `${seed}:mailwelcome`);
}

// ==========================================
// P6.3 — OUTING ENCOUNTER LINES (sent on chance meetings out in the city)
// ==========================================

/** Maya spots you at the diner during her shift. */
export const OUTING_MAYA_LINES: string[] = [
  'hey!! you came to the diner?? shouldve told me, i wouldve saved you the good booth lol',
  'omg hi!! on my break in like ten — dont you dare leave before i sit down',
  'you have great timing, slow hour. sit, i will bring you coffee on the house ~',
];
/** Nora crosses paths with you on the late canal walk. */
export const OUTING_NORA_LINES: string[] = [
  'oh. it is you. walking the canal too? the hum is louder tonight.',
  'couldnt sleep either? walk with me a bit. i found something weird upstream.',
  'hey. good night for it — quiet water, loud wires. stay a while?',
];

export function pickOutingMayaLine(seed: string): string {
  return pickFromPool(OUTING_MAYA_LINES, `${seed}:outingmaya`);
}

export function pickOutingNoraLine(seed: string): string {
  return pickFromPool(OUTING_NORA_LINES, `${seed}:outingnora`);
}

// ==========================================
// P6.4 — RENT LADDER LINES (Henderson: formal, escalating, never cruel)
// ==========================================

/** Gentle reminder two days before rent is due. */
export const RENT_REMINDER_LINES: string[] = [
  'Good morning. A friendly reminder that Room 104 rent (${amount}) is due on day {day}. Front desk, anytime before 8pm.',
  'Hello — rent of ${amount} comes due on day {day}. Pay at the desk when convenient. Thank you.',
];
/** Stern same-day warning. */
export const RENT_STERN_LINES: string[] = [
  'Room 104: rent of ${amount} is due TODAY. Please settle at the front desk to avoid a late fee.',
  'Final courtesy notice: ${amount} due today for Room 104. The ledger waits for no one.',
];
/** Daily overdue nudge (capped 1/day, kind but firm). */
export const RENT_NUDGE_LINES: string[] = [
  'Room 104 account is past due (${amount}). I have paused your download line until we settle. The desk is open.',
  'A reminder that Room 104 remains unpaid (${amount}). Downloads are paused meantime — come see me.',
];
/** Thank-you on payment. */
export const RENT_THANKS_LINES: string[] = [
  'Payment received for Room 104. Thank you — a pleasure doing business. Download line restored.',
  'Room 104 is settled. Much appreciated. Your line is back to full speed.',
];

function fillRent(text: string, amount: number, day: number): string {
  return text.replaceAll('{amount}', `$${amount.toFixed(2)}`).replaceAll('{day}', String(day)).replaceAll('${amount}', `$${amount.toFixed(2)}`);
}

export function pickRentReminderLine(seed: string, amount: number, day: number): string {
  return fillRent(pickFromPool(RENT_REMINDER_LINES, `${seed}:rentremind`), amount, day);
}

export function pickRentSternLine(seed: string, amount: number, day: number): string {
  return fillRent(pickFromPool(RENT_STERN_LINES, `${seed}:rentstern`), amount, day);
}

export function pickRentNudgeLine(seed: string, amount: number): string {
  return fillRent(pickFromPool(RENT_NUDGE_LINES, `${seed}:rentnudge`), amount, 0);
}

export function pickRentThanksLine(seed: string): string {
  return pickFromPool(RENT_THANKS_LINES, `${seed}:rentthanks`);
}

// ==========================================
// P6 — JOB BOARD LINES ({gig} = gig title, {day} filled by caller)
// ==========================================

/** Gig acceptance notes (the shift itself arrives as a real appointment). */
export const JOB_ACCEPT_LINES: string[] = [
  'good news — youre on for {gig} {day}! come by, dont be late. it is all set on my end.',
  '{gig} {day} — you got it! see you there. wear something you can move in lol',
];
/** Gig rejections (kind, no penalty — lenient town). */
export const JOB_REJECT_LINES: string[] = [
  'hey, sorry — {gig} went to someone else this time. nothing personal, timing. try again soon?',
  'bad news on {gig}: they already filled it. i put in a word for next time though.',
];

export function pickJobAcceptLine(seed: string, gig: string, dayRef: string): string {
  return pickFromPool(JOB_ACCEPT_LINES, `${seed}:jobaccept`)
    .replaceAll('{gig}', gig.slice(0, 60)).replaceAll('{day}', dayRef);
}

export function pickJobRejectLine(seed: string, gig: string): string {
  return pickFromPool(JOB_REJECT_LINES, `${seed}:jobreject`).replaceAll('{gig}', gig.slice(0, 60));
}

export interface InitiativeDecision {
  stage: RelationshipStage;
  presenceStatus: BuddyPresenceStatus;
  mood: DailyMood;
  initiatedToday: boolean;
  /** Deterministic 0..99 roll, e.g. hashSeed(`${buddyId}:${day}`) % 100. */
  roll: number;
}

/**
 * Rules-only gate for NPC initiatives (AI never decides to message first).
 * friend/close + online/away + mood ok + not yet today + roll under threshold.
 */
export function shouldInitiateContact(decision: InitiativeDecision): boolean {
  if (decision.initiatedToday) return false;
  if (decision.stage !== 'friend' && decision.stage !== 'close') return false;
  if (decision.presenceStatus !== 'online' && decision.presenceStatus !== 'away') return false;
  if (decision.mood === 'off' || decision.mood === 'cold') return false;
  const threshold = decision.stage === 'close' ? 45 : 30;
  return decision.roll >= 0 && decision.roll < threshold;
}

export function listArchetypes(): CharacterArchetype[] {
  return Object.keys(CHARACTER_ARCHETYPES) as CharacterArchetype[];
}

/** Build a weekly schedule for an archetype (days 1..7, rotation handled by SocialEngine lookup). */
export function buildScheduleForArchetype(archetype: CharacterArchetype): Record<number, ScheduleBlock[]> {
  return buildWeeklySchedule(CHARACTER_ARCHETYPES[archetype]?.dailyBlocks ?? CHARACTER_ARCHETYPES['regular'].dailyBlocks);
}

/** Validate a candidate buddy id (snake_case, engine-canonical). */
export function validateCharacterId(id: string): { ok: boolean; error?: string } {
  if (!id || typeof id !== 'string') return { ok: false, error: 'Buddy id must be a non-empty string.' };
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) {
    return { ok: false, error: 'Buddy id must be snake_case: start with a letter, a-z/0-9/_, 2..32 chars.' };
  }
  const reserved = ['player', 'system', 'you', 'me', 'unknown'];
  if (reserved.includes(id)) return { ok: false, error: `Buddy id '${id}' is reserved.` };
  return { ok: true };
}

/** Type guard for schedule blocks (used when restoring persisted defs). */
export function isValidSchedule(schedule: unknown): schedule is Record<number, ScheduleBlock[]> {
  if (!schedule || typeof schedule !== 'object') return false;
  const days = Object.values(schedule as Record<string, unknown>);
  if (days.length === 0) return false;
  return days.every(
    (blocks) =>
      Array.isArray(blocks) &&
      blocks.length > 0 &&
      blocks.every(
        (b) =>
          b &&
          typeof b === 'object' &&
          typeof (b as ScheduleBlock).startMinuteOfDay === 'number' &&
          typeof (b as ScheduleBlock).endMinuteOfDay === 'number' &&
          typeof (b as ScheduleBlock).status === 'string' &&
          typeof (b as ScheduleBlock).awayMessage === 'string'
      )
  );
}

/** Clamp relationship dimensions into 0..100 (shared with SocialEngine deltas). */
export function clampRelationships(rel: RelationshipDimensions): RelationshipDimensions {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    familiarity: clamp(rel.familiarity),
    trust: clamp(rel.trust),
    comfort: clamp(rel.comfort),
    respect: clamp(rel.respect),
    annoyance: clamp(rel.annoyance),
    affection: clamp(rel.affection ?? 0),
    attraction: clamp(rel.attraction ?? 0),
    suspicion: clamp(rel.suspicion ?? 0),
    resentment: clamp(rel.resentment ?? 0),
  };
}

/** Clamp traits into 0..100 (integers). Missing keys fall back to 50 (neutral). */
export function clampTraits(traits: Partial<CharacterTraits> | undefined): CharacterTraits {
  const clamp = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50);
  return {
    shyness: clamp(traits?.shyness),
    warmth: clamp(traits?.warmth),
    discipline: clamp(traits?.discipline),
    spontaneity: clamp(traits?.spontaneity),
    loyalty: clamp(traits?.loyalty),
  };
}

/**
 * Hand-authored temperament for the core 4 (code-owned, never persisted).
 * Derived from the registry — edit content/store.json, never this map.
 */
export const CORE_TRAITS: Record<string, CharacterTraits> = Object.fromEntries(
  CORE_BUDDIES.map((b) => [b.id, { ...b.traits }])
);

/** Traits for a buddy id: core hand-authored wins, everyone else inherits their archetype. */
export function traitsForBuddy(buddyId: string, archetype: CharacterArchetype): CharacterTraits {
  const core = CORE_BY_ID[buddyId];
  if (core) return { ...core.traits };
  return { ...(CHARACTER_ARCHETYPES[archetype]?.defaultTraits ?? CHARACTER_ARCHETYPES['regular'].defaultTraits) };
}

/**
 * The PLAYER is a fixed character with a story, not an avatar: introverted,
 * homebound, shy, taciturn. Buddies never see these numbers — each builds
 * its own read through observation (see SocialEngine playerReads), starting
 * neutral and often misreading quiet as cold. Exported as canon + test anchor.
 */
export const PLAYER_TRAITS: CharacterTraits = {
  shyness: 85,
  warmth: 55,
  discipline: 60,
  spontaneity: 25,
  loyalty: 70,
};

// ==========================================
// CHARACTER LIVES — leave lines, agenda labels, run-in spots, mediation asks
// Rules pick the line (seeded); AI only paraphrases inside live chat.
// ==========================================

/** Classify a schedule block's away text: sleep/work blocks make a buddy busy (polite-leave rules). */
export function classifyScheduleBlock(awayMessage: string): 'sleep' | 'work' | null {
  const msg = (awayMessage || '').toLowerCase();
  if (/closed|sleep|asleep|crashed|\bnap\b|\bbed\b|winding down|zzz/.test(msg)) return 'sleep';
  if (/work|shift|cart|desk|office|class|librar|rehearsal|dealing|commute|tape|indexing|front desk/.test(msg)) return 'work';
  return null;
}

/** Polite goodbye when a sleep/work block starts mid-contact. Shy buddies use SOFT. */
export const LEAVE_LINES: Record<'sleep' | 'work', { soft: string[]; direct: string[] }> = {
  sleep: {
    soft: [
      'hey... i gotta crash, sorry. talk tomorrow? ~',
      'eyes are closing lol. gn, really',
      'need to sleep... dont stay up too late either',
    ],
    direct: [
      'alright, im crashing. later!',
      'bed time, dead serious. catch you tomorrow',
      'gotta sleep, early start. gn!',
    ],
  },
  work: {
    soft: [
      'ahh sorry, shift starts — gotta run. talk later?',
      'boss is glaring lol. brb after work',
      'duty calls... ill ping you when im back',
    ],
    direct: [
      'shift time, gotta run. later!',
      'work calls. back this evening',
      'on the clock now — hmu later',
    ],
  },
};

/** Deterministic leave-line pick: shy (>= 70) buddies apologize softly. */
export function pickLeaveLine(kind: 'sleep' | 'work', shyness: number, seed: string): string {
  return pickSeeded(LEAVE_LINES[kind][shyness >= 70 ? 'soft' : 'direct'], `${seed}:leave:${kind}`);
}

/** Agenda filler labels for free windows (weekly planning pass). */
export const AGENDA_LABELS: Record<'social' | 'errand', string[]> = {
  social: ['open mic @ the cafe', 'nightboard thread', 'arcade high-score run', 'canal walk with a friend', 'mixtape swap'],
  errand: ['laundromat run', 'TechMart browse', 'groceries @ corner store', 'rent envelope drop', 'library return'],
};

/** Where NPC↔NPC run-ins happen (witness labels). */
export const NPC_RUNIN_SPOTS = ['the cafe', 'the laundromat', 'the canal', 'the arcade', 'NightBoard', 'the motel lobby'];

/** Witness verbs per NPC↔NPC action (log lines + gossip). */
export const NPC_RUNIN_VERBS: Record<string, string[]> = {
  warm_chat: ['caught up', 'chatted a while'],
  shared_activity: ['hung out', 'grabbed a table together'],
  deep_talk: ['talked for a long while', 'had a real talk'],
  small_favor: ['sorted something out together', 'helped each other out'],
  support_crisis: ['talked through a rough patch', 'stuck close together'],
  flirt: ['laughed a little too long', 'lingered together'],
  argument: ['argued', 'had words'],
  cold_shoulder: ['barely spoke', 'kept their distance'],
};

/** Deterministic run-in spot + witness verb. */
export function pickRuninSpot(seed: string): string {
  return pickSeeded(NPC_RUNIN_SPOTS, `${seed}:spot`);
}

export function pickRuninVerb(action: string, seed: string): string {
  return pickSeeded(NPC_RUNIN_VERBS[action] ?? NPC_RUNIN_VERBS['warm_chat']!, `${seed}:verb:${action}`);
}

/** Mediation request openers ({target} filled by the caller with a display name). */
export const MEDIATION_ASK_LINES: Record<'introduce' | 'strengthen' | 'ask_about', string[]> = {
  introduce: [
    'hey... you know {target}, right? could you introduce us? i get shy asking myself',
    'do you think you could introduce me to {target}? no pressure tho',
    'ive been wanting to talk to {target}. would you help break the ice?',
  ],
  strengthen: [
    'me and {target} have been a bit off... could you put in a good word for me?',
    'if you talk to {target}, tell them i mean well? trying to fix things',
    '{target} has been distant. if you get a chance, tell them i miss hanging out?',
  ],
  ask_about: [
    'what do you think of {target}? curious what they are like',
    'you know {target} better than me — are they doing okay?',
    'is {target} around much lately? wondering how they are',
  ],
};

/** Deterministic mediation ask-line pick with {target} filled in. */
export function pickMediationAskLine(kind: 'introduce' | 'strengthen' | 'ask_about', seed: string, targetName: string): string {
  return pickSeeded(MEDIATION_ASK_LINES[kind], `${seed}:ask:${kind}`).replaceAll('{target}', targetName);
}

/** MSN-era nudges: shy buddies ping instead of typing (sent with the 'buzz' tag). */
export const NPC_BUZZ_LINES = ['*nudge*', '*buzzes you*', '*nudge nudge*'];

/** Natural hair colors for generated buddies (the AI is instructed likewise). */
export const TEMPLATE_HAIR_COLORS = [
  'black', 'dark brown', 'brown', 'light brown', 'dirty blonde', 'blonde',
  'red', 'auburn', 'grey', 'white', 'balding', 'bald',
];

/** Eye colors for generated buddies. */
export const TEMPLATE_EYE_COLORS = ['brown', 'dark brown', 'hazel', 'green', 'blue', 'grey'];

/** Era-plausible languages with template weights (first = most common). */
export const TEMPLATE_LANGUAGES = ['en', 'en', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'zh', 'ja'];

/** Deterministic appearance + languages for a template newcomer. */
export function pickTemplateAppearance(seed: string): { hair: string; eyes: string; languages: Array<{ lang: string; level: number }> } {
  const hair = pickSeeded(TEMPLATE_HAIR_COLORS, `${seed}:hair`);
  const eyes = pickSeeded(TEMPLATE_EYE_COLORS, `${seed}:eyes`);
  const primary = pickSeeded(TEMPLATE_LANGUAGES, `${seed}:lang1`);
  const languages: Array<{ lang: string; level: number }> = [
    { lang: primary, level: 3 + (spreadSeed(`${seed}:lvl1`) % 3) },
  ];
  if (spreadSeed(`${seed}:lang2?`) % 100 < 30) {
    const second = pickSeeded(TEMPLATE_LANGUAGES, `${seed}:lang2`);
    if (second !== primary) languages.push({ lang: second, level: 1 + (spreadSeed(`${seed}:lvl2`) % 3) });
  }
  if (spreadSeed(`${seed}:lang3?`) % 100 < 10) {
    const third = pickSeeded(TEMPLATE_LANGUAGES, `${seed}:lang3`);
    if (third !== primary && !languages.some((l) => l.lang === third)) {
      languages.push({ lang: third, level: 1 + (spreadSeed(`${seed}:lvl3`) % 2) });
    }
  }
  return { hair, eyes, languages };
}

/** MSN-era signature colors: derived from the registry (edit content, not this map). */
export const CORE_SIGNATURE_COLORS: Record<string, string> = Object.fromEntries(
  CORE_BUDDIES.map((b) => [b.id, b.color])
);

export const ARCHETYPE_SIGNATURE_COLORS: Record<CharacterArchetype, string> = {
  coworker: '#b3541e',
  nightowl: '#3d6e9e',
  student: '#4e9e4e',
  trader: '#8e7a2e',
  artist: '#9e4e8e',
  regular: '#6e6e6e',
};

/** Signature chat color for a buddy id (core fixed, procedural by archetype). */
export function buddySignatureColor(buddyId: string, archetype: CharacterArchetype): string {
  const core = CORE_BY_ID[buddyId];
  if (core) return core.color;
  return ARCHETYPE_SIGNATURE_COLORS[archetype] ?? '#800080';
}
/** Thank-you lines when the player helps with a mediation (rules-picked, capped). */
export const MEDIATION_THANKS_LINES = [
  'thank you... really. that means a lot',
  'you are a good friend for doing that. thanks!',
  'aww thanks! i owe you one',
];

/** Deterministic thanks-line pick. */
export function pickMediationThanks(seed: string): string {
  return pickSeeded(MEDIATION_THANKS_LINES, `${seed}:thanks`);
}

/** Friend-request outcomes (rules-picked, capped). */
export const CONTACT_ACCEPT_LINES = [
  'oh hey! added ✓ talk soon?',
  'hey!! of course — added you back.',
  'sure, added. whats up?',
];

export const CONTACT_DECLINE_LINES = [
  'sorry... do i know you? maybe another time.',
  'hmm, i dont add strangers. no offense?',
];

export const CONTACT_BOUNCE_LINES: Record<'dead' | 'changed', string[]> = {
  dead: [
    'That Pulse ID does not exist. Check the spelling — or they are long gone.',
    'No such ID. Dead air.',
  ],
  changed: [
    'That ID is dead — they moved handles a while back.',
    'Nobody home at that ID anymore.',
  ],
};

/** Deterministic contact-line picks. */
export function pickContactLine(kind: 'accept' | 'decline', seed: string): string {
  return pickSeeded(kind === 'accept' ? CONTACT_ACCEPT_LINES : CONTACT_DECLINE_LINES, `${seed}:contact:${kind}`);
}

export function pickContactBounce(status: 'dead' | 'changed', seed: string): string {
  return pickSeeded(CONTACT_BOUNCE_LINES[status], `${seed}:bounce:${status}`);
}

/**
 * Backstory re-introductions ({name} filled by the caller): how someone from
 * before day 1 says hello again. Strangers never re-introduce (never met).
 */
export const BACKSTORY_REINTRO_LINES: Record<'close' | 'friend' | 'acquaintance' | 'estranged', string[]> = {
  close: [
    'FINALLY. thought you fell off the planet — {name} here!',
    '{name} here!! took you long enough to sign on. missed you!',
  ],
  friend: [
    'hey!! its been ages — {name} here. you still on pulse?',
    '{name}! long time. we should catch up properly soon?',
  ],
  acquaintance: [
    'hey, {name} here — not sure you remember me?',
    'hi... {name}. we met a while back. how have you been?',
  ],
  estranged: [
    '...hi. its {name}. yeah, that {name}.',
    '{name}. i know. just... hi.',
  ],
};

/** Deterministic re-intro pick with {name} filled in. */
export function pickBackstoryReintro(depth: 'close' | 'friend' | 'acquaintance' | 'estranged', seed: string, displayName: string): string {
  return pickSeeded(BACKSTORY_REINTRO_LINES[depth], `${seed}:reintro:${depth}`).replaceAll('{name}', displayName);
}

/**
 * MyPlace self-announcement voices ({link} filled by the caller).
 * Picked by temperament: shy → soft, disciplined → formal, else direct.
 */
export const MYPLACE_UPDATE_LINES = {
  soft: 'hey — i changed my MyPlace a bit, new bio and song. what do you think? {link}',
  formal: 'updated my MyPlace — new headline. does it read okay? {link}',
  direct: 'yo changed my MyPlace — added some new stuff. check it? {link} lmk',
} as const;

/** Deterministic MyPlace announcement pick from temperament. */
export function pickMyplaceUpdateLine(shyness: number, discipline: number, link: string): string {
  const kind = shyness >= 65 ? 'soft' : discipline >= 75 ? 'formal' : 'direct';
  return MYPLACE_UPDATE_LINES[kind].replaceAll('{link}', link);
}

export type { BuddyCharacter };

// src/engine/characterTemplates.ts
// Template library for the unified CharacterEngine — offline, deterministic, era-locked.
// Each archetype defines a weekly daily-rhythm, baseline relationships, and typing speed.
// Callers supply id/displayName/handle; the template supplies everything behavioural.

import type {
  BuddyAttitude,
  BuddyCharacter,
  BuddyPresenceStatus,
  CharacterArchetype,
  DailyMood,
  GlobalEventCategory,
  RelationshipDimensions,
  RelationshipStage,
  ScheduleBlock,
} from './types';

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
    initialRelationships: { familiarity: 25, trust: 30, comfort: 35, respect: 35, annoyance: 0 },
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
    initialRelationships: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0 },
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
    initialRelationships: { familiarity: 10, trust: 15, comfort: 25, respect: 30, annoyance: 0 },
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
    initialRelationships: { familiarity: 8, trust: 10, comfort: 15, respect: 40, annoyance: 0 },
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
    initialRelationships: { familiarity: 15, trust: 20, comfort: 25, respect: 35, annoyance: 0 },
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
    initialRelationships: { familiarity: 10, trust: 15, comfort: 20, respect: 30, annoyance: 0 },
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
  return CHARACTER_ARCHETYPES[archetype];
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

/** Deterministic name pick that skips taken ids (suffixes _2, _3 when pools exhaust). */
export function pickTemplateName(
  archetype: CharacterArchetype,
  seed: string,
  takenIds: Set<string> | string[]
): NamePoolEntry {
  const taken = takenIds instanceof Set ? takenIds : new Set(takenIds);
  const pool = ARCHETYPE_NAME_POOLS[archetype];
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
  const lines = ARCHETYPE_INTRO_LINES[archetype];
  const line = lines[hashSeed(`${seed}:${archetype}:intro`) % lines.length]!;
  return line.replaceAll('{name}', displayName);
}

/** Legacy core ids → archetype (keeps the original 4 voices byte-identical). */
export const CORE_ID_TO_ARCHETYPE: Record<string, CharacterArchetype> = {
  ryan: 'coworker',
  maya: 'artist',
  nora: 'nightowl',
  henderson: 'regular',
};

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
  const lines = CHARACTER_ARCHETYPES[archetype].offlineLines;
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
      return pickFromPool(ARCHETYPE_EVENT_SHARE_LINES[arch], `${seed}:event`).replaceAll('{event}', title);
    }
    case 'promise_reminder': {
      const promise = (opts?.promiseText || 'that thing you promised').slice(0, 120);
      return pickFromPool(PROMISE_REMINDER_LINES, `${seed}:promise`).replaceAll('{promise}', promise);
    }
    case 'cafe_invite':
      return pickFromPool(CAFE_INVITE_LINES, `${seed}:cafe`);
    case 'checkin':
    default:
      return pickFromPool(ARCHETYPE_INITIATIVE_LINES[arch], `${seed}:checkin`);
  }
}

export function pickConfrontLine(archetype: CharacterArchetype, seed: string): string {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  return pickFromPool(ARCHETYPE_CONFRONT_LINES[arch], `${seed}:confront`);
}

export function pickFarewellLine(archetype: CharacterArchetype, seed: string): string {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  return pickFromPool(ARCHETYPE_FAREWELL_LINES[arch], `${seed}:farewell`);
}

export function pickReturnLine(archetype: CharacterArchetype, seed: string): string {
  const arch = CHARACTER_ARCHETYPES[archetype] ? archetype : 'regular';
  return pickFromPool(ARCHETYPE_RETURN_LINES[arch], `${seed}:return`);
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
  return buildWeeklySchedule(CHARACTER_ARCHETYPES[archetype].dailyBlocks);
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

export function isCoreBuddyId(id: string): boolean {
  return id === 'ryan' || id === 'maya' || id === 'nora' || id === 'henderson';
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
  };
}

export type { BuddyCharacter };

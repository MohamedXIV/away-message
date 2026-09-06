// GENERATED — do not edit by hand.
// Source: content/store.json (content v3ba32359). Regenerate: npm run content:pull.
export const CONTENT_VERSION = '3ba32359';

export interface GeneratedScheduleBlock {
  start: number;
  end: number;
  status: 'online' | 'away' | 'busy' | 'offline';
  msg: string;
}

export interface GeneratedBuddyDef {
  id: string;
  displayName: string;
  handle: string;
  myplace: string;
  archetype: string;
  status: string;
  metVia: string;
  color: string;
  persona: string;
  typingSpeedWpm: number;
  traits: { shyness: number; warmth: number; discipline: number; spontaneity: number; loyalty: number };
  hearts: { familiarity: number; trust: number; comfort: number; respect: number; annoyance: number; affection: number; attraction: number; suspicion: number; resentment: number };
  blocks: GeneratedScheduleBlock[];
}

export const GENERATED_BUDDIES: GeneratedBuddyDef[] = [
  {
    id: "ryan",
    displayName: "Ryan",
    handle: "ryan_foodcart",
    myplace: "tacocart_ryan",
    archetype: "coworker",
    status: "friend",
    metVia: "core",
    color: "#d96c3b",
    persona: "Warm, impulsive food-cart coworker. Uses casual slang, jokes, and short messages. He avoids heavy emotional talks unless trust is high.",
    typingSpeedWpm: 80,
    traits: { shyness: 25, warmth: 78, discipline: 50, spontaneity: 72, loyalty: 62 },
    hearts: { familiarity: 40, trust: 50, comfort: 50, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    blocks: [
      { start: 0, end: 420, status: "offline" as GeneratedScheduleBlock['status'], msg: "asleep" },
      { start: 420, end: 540, status: "offline" as GeneratedScheduleBlock['status'], msg: "commute" },
      { start: 540, end: 960, status: "offline" as GeneratedScheduleBlock['status'], msg: "work @ cart" },
      { start: 960, end: 1080, status: "away" as GeneratedScheduleBlock['status'], msg: "afk grabbin tacos" },
      { start: 1080, end: 1320, status: "online" as GeneratedScheduleBlock['status'], msg: "gaming / chilling" },
      { start: 1320, end: 1440, status: "offline" as GeneratedScheduleBlock['status'], msg: "sleep is for the weak" },
    ],
  },
  {
    id: "maya",
    displayName: "Maya",
    handle: "starlight_maya",
    myplace: "maya_x",
    archetype: "artist",
    status: "acquaintance",
    metVia: "core",
    color: "#6a3fa0",
    persona: "Quiet, observant, creative, and a little guarded. Uses lowercase, pauses, music references, and gentle honesty. She warms up slowly.",
    typingSpeedWpm: 60,
    traits: { shyness: 88, warmth: 62, discipline: 48, spontaneity: 45, loyalty: 85 },
    hearts: { familiarity: 10, trust: 20, comfort: 30, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    blocks: [
      { start: 0, end: 480, status: "offline" as GeneratedScheduleBlock['status'], msg: "sleeping" },
      { start: 480, end: 540, status: "offline" as GeneratedScheduleBlock['status'], msg: "morning tea" },
      { start: 540, end: 1050, status: "away" as GeneratedScheduleBlock['status'], msg: "at the desk... dont look at me" },
      { start: 1050, end: 1260, status: "online" as GeneratedScheduleBlock['status'], msg: "home! making coffee :)" },
      { start: 1260, end: 1440, status: "online" as GeneratedScheduleBlock['status'], msg: "listening to the rain ~ myplace/mayablue" },
    ],
  },
  {
    id: "nora",
    displayName: "Nora",
    handle: "NightOwl87",
    myplace: "nightowl87",
    archetype: "nightowl",
    status: "acquaintance",
    metVia: "core",
    color: "#2e7f86",
    persona: "Night-owl archivist with dry humor. Curious about strange details, concise, slightly cryptic, but not supernatural.",
    typingSpeedWpm: 90,
    traits: { shyness: 65, warmth: 42, discipline: 72, spontaneity: 30, loyalty: 78 },
    hearts: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    blocks: [
      { start: 0, end: 300, status: "online" as GeneratedScheduleBlock['status'], msg: "the night is quiet" },
      { start: 300, end: 360, status: "away" as GeneratedScheduleBlock['status'], msg: "watching dawn" },
      { start: 360, end: 1140, status: "offline" as GeneratedScheduleBlock['status'], msg: "offline" },
      { start: 1140, end: 1320, status: "away" as GeneratedScheduleBlock['status'], msg: "indexing old logs" },
      { start: 1320, end: 1440, status: "online" as GeneratedScheduleBlock['status'], msg: "nightboard / logs" },
    ],
  },
  {
    id: "henderson",
    displayName: "Mr. Henderson",
    handle: "motel_office",
    myplace: "",
    archetype: "regular",
    status: "acquaintance",
    metVia: "core",
    color: "#7a5c3e",
    persona: "Professional motel manager. Formal, practical, and terse. He cares about rent, schedules, and keeping the property calm.",
    typingSpeedWpm: 40,
    traits: { shyness: 45, warmth: 50, discipline: 85, spontaneity: 25, loyalty: 72 },
    hearts: { familiarity: 30, trust: 30, comfort: 20, respect: 40, annoyance: 10, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    blocks: [
      { start: 0, end: 480, status: "offline" as GeneratedScheduleBlock['status'], msg: "office closed" },
      { start: 480, end: 1200, status: "online" as GeneratedScheduleBlock['status'], msg: "motel front desk open" },
      { start: 1200, end: 1440, status: "offline" as GeneratedScheduleBlock['status'], msg: "office closed" },
    ],
  },
];

export interface GeneratedPool {
  key: string;
  lines: string[];
  version: number;
}

export const GENERATED_POOLS: GeneratedPool[] = [
  {
    key: "leave:sleep:direct",
    lines: ["alright, im crashing. later!", "bed time, dead serious. catch you tomorrow", "gotta sleep, early start. gn!"],
    version: 1,
  },
  {
    key: "leave:sleep:soft",
    lines: ["hey... i gotta crash, sorry. talk tomorrow? ~", "eyes are closing lol. gn, really", "need to sleep... dont stay up too late either"],
    version: 1,
  },
  {
    key: "leave:work:direct",
    lines: ["shift time, gotta run. later!", "work calls. back this evening", "on the clock now — hmu later"],
    version: 1,
  },
  {
    key: "leave:work:soft",
    lines: ["ahh sorry, shift starts — gotta run. talk later?", "boss is glaring lol. brb after work", "duty calls... ill ping you when im back"],
    version: 1,
  },
];

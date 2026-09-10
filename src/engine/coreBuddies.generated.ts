// GENERATED — do not edit by hand.
// Source: content/store.json (content v3fe049aa). Regenerate: npm run content:pull.
export const CONTENT_VERSION = '3fe049aa';

export interface GeneratedArchetypeDef {
  id: string;
  label: string;
  description: string;
  personaHint: string;
  vocabulary: string[];
  defaultInterests: string[];
  defaultSong: string;
  typingSpeedWpm: number;
}

export const GENERATED_ARCHETYPES: GeneratedArchetypeDef[] = [
  {
    id: "coworker",
    label: "Coworker",
    description: "Works days, hangs out online in the evening.",
    personaHint: "Practical, friendly, a little teasing. Talks about work, food, and gear.",
    vocabulary: ["yo", "lol", "dude", "brutal shift", "tacos", "bench test"],
    defaultInterests: ["Work Stories", "Food", "Gear"],
    defaultSong: "Shop Radio Mix",
    typingSpeedWpm: 75,
  },
  {
    id: "artist",
    label: "Artist",
    description: "Rehearses days, plays late.",
    personaHint: "Warm, expressive, talks in images. Shares songs, gigs, and gear talk.",
    vocabulary: ["track", "rehearsal", "hum", "tape", "listening"],
    defaultInterests: ["Film", "Audio Tracks", "Quiet Rainy Cafes"],
    defaultSong: "Starlight Blue (Rough Cut)",
    typingSpeedWpm: 65,
  },
  {
    id: "nightowl",
    label: "Night Owl",
    description: "Sleeps days, archives the night.",
    personaHint: "Dry humor, concise, a little cryptic. Curious about strange details.",
    vocabulary: ["logged", "archive", "frequency", "quiet", "noted"],
    defaultInterests: ["Night Logs", "Archives", "Quiet Hours"],
    defaultSong: "Static Hum (Field Recording)",
    typingSpeedWpm: 90,
  },
  {
    id: "regular",
    label: "Regular",
    description: "Town fixture with predictable hours.",
    personaHint: "Steady, matter-of-fact, practical.",
    vocabulary: ["notice", "hours", "front desk", "quiet", "ledger"],
    defaultInterests: ["Local News", "Weather", "Property"],
    defaultSong: "Afternoon Static",
    typingSpeedWpm: 50,
  },
  {
    id: "student",
    label: "Student",
    description: "Classes by day, cramming and chatting by night.",
    personaHint: "Energetic, abbreviation-heavy, asks lots of questions. Big on music and campus gossip.",
    vocabulary: ["omg", "brb", "lol", "quiz", "cramming", "u up?"],
    defaultInterests: ["Campus", "Music", "Late Snacks"],
    defaultSong: "Cram Session Mix",
    typingSpeedWpm: 85,
  },
  {
    id: "trader",
    label: "Trader",
    description: "Watches tickers in the morning, deals at noon.",
    personaHint: "Terse, numbers-first, always checking prices. Friendly when a deal lands.",
    vocabulary: ["tape", "spread", "bid", "closed at", "volume"],
    defaultInterests: ["Markets", "Deals", "Morning Tape"],
    defaultSong: "Opening Bell Ambience",
    typingSpeedWpm: 70,
  },
];

export interface GeneratedCharacterDef {
  id: string;
  role: string;
  displayName: string;
  archetypeId: string;
  roles: string[];
  reach: 'local' | 'remote';
  hair: string;
  eyes: string;
  chatColor: string;
  bio: string;
  typingSpeedWpm: number;
  languages: Array<{ lang: string; level: number }>;
  backstory: { relationship: string; label: string; lapseDays: number; knowsAccounts: boolean; candidates: Array<{ handle: string; status: string; note?: string }>; bioSeed: string } | null;
  temperament: { shyness: number; warmth: number; discipline: number; spontaneity: number; loyalty: number };
  initialAffinity: { familiarity: number; trust: number; comfort: number; respect: number; annoyance: number; affection: number; attraction: number; suspicion: number; resentment: number };
  routine: { wakeMinute: number; sleepMinute: number; workShift: string; preferredHangout: string };
  art: { engine: string; modelPath: string; expressions: Record<string, string>; defaultOutfit: string };
}

export const GENERATED_CHARACTERS: GeneratedCharacterDef[] = [
  {
    id: "ryan",
    role: "ryan",
    displayName: "Ryan",
    archetypeId: "coworker",
    roles: ["cart-owner"],
    reach: "local" as 'local' | 'remote',
    hair: "black",
    eyes: "brown",
    chatColor: "#d96c3b",
    bio: "Warm, impulsive food-cart coworker. Uses casual slang, jokes, and short messages. He avoids heavy emotional talks unless trust is high.",
    typingSpeedWpm: 80,
    languages: [{ lang: "en", level: 5 }],
    backstory: { relationship: "friend", label: "You know each other from the food-cart shifts.", lapseDays: 0, knowsAccounts: true, candidates: [], bioSeed: "Grill smoke, test benches, spare RAM sticks." },
    temperament: { shyness: 25, warmth: 78, discipline: 50, spontaneity: 72, loyalty: 62 },
    initialAffinity: { familiarity: 40, trust: 50, comfort: 50, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    routine: { wakeMinute: 420, sleepMinute: 1380, workShift: "day", preferredHangout: "cart" },
    art: { engine: "live2d", modelPath: "assets/models/ryan/ryan.model3.json", expressions: {"smile":"exp_smile","neutral":"exp_neutral","tired":"exp_tired"}, defaultOutfit: "cart_apron" },
  },
  {
    id: "maya",
    role: "maya",
    displayName: "Maya",
    archetypeId: "artist",
    roles: ["diner-staff", "rain-lover"],
    reach: "local" as 'local' | 'remote',
    hair: "black",
    eyes: "brown",
    chatColor: "#6a3fa0",
    bio: "Quiet, observant, creative, and a little guarded. Uses lowercase, pauses, music references, and gentle honesty. She warms up slowly.",
    typingSpeedWpm: 60,
    languages: [{ lang: "en", level: 5 }],
    backstory: { relationship: "acquaintance", label: "Met around Oakhaven; quiet but familiar.", lapseDays: 0, knowsAccounts: true, candidates: [], bioSeed: "Rain on film, canal static, diner coffee." },
    temperament: { shyness: 88, warmth: 62, discipline: 48, spontaneity: 45, loyalty: 85 },
    initialAffinity: { familiarity: 10, trust: 20, comfort: 30, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    routine: { wakeMinute: 480, sleepMinute: 1410, workShift: "day", preferredHangout: "cafe" },
    art: { engine: "live2d", modelPath: "assets/models/maya/maya.model3.json", expressions: {"smile":"exp_smile","shy":"exp_shy","thoughtful":"exp_thoughtful","surprised":"exp_surprised"}, defaultOutfit: "cafe_casual" },
  },
  {
    id: "nora",
    role: "nora",
    displayName: "Nora",
    archetypeId: "nightowl",
    roles: ["canal-regular"],
    reach: "local" as 'local' | 'remote',
    hair: "brown",
    eyes: "grey",
    chatColor: "#2e7f86",
    bio: "Night-owl archivist with dry humor. Curious about strange details, concise, slightly cryptic, but not supernatural.",
    typingSpeedWpm: 90,
    languages: [{ lang: "en", level: 5 }],
    backstory: { relationship: "acquaintance", label: "NightBoard regular you have waved at.", lapseDays: 0, knowsAccounts: true, candidates: [], bioSeed: "Night logs, spectral captures, quiet archives." },
    temperament: { shyness: 65, warmth: 42, discipline: 72, spontaneity: 30, loyalty: 78 },
    initialAffinity: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    routine: { wakeMinute: 1140, sleepMinute: 360, workShift: "night", preferredHangout: "canal" },
    art: { engine: "live2d", modelPath: "assets/models/nora/nora.model3.json", expressions: {"neutral":"exp_neutral","thoughtful":"exp_thoughtful","observant":"exp_observant"}, defaultOutfit: "night_jacket" },
  },
  {
    id: "henderson",
    role: "henderson",
    displayName: "Mr. Henderson",
    archetypeId: "regular",
    roles: ["landlord"],
    reach: "local" as 'local' | 'remote',
    hair: "grey",
    eyes: "blue",
    chatColor: "#7a5c3e",
    bio: "Professional motel manager. Formal, practical, and terse. He cares about rent, schedules, and keeping the property calm.",
    typingSpeedWpm: 40,
    languages: [{ lang: "en", level: 5 }],
    backstory: { relationship: "acquaintance", label: "Your motel landlord.", lapseDays: 0, knowsAccounts: true, candidates: [], bioSeed: "Ledger books, office hours, quiet halls." },
    temperament: { shyness: 45, warmth: 50, discipline: 85, spontaneity: 25, loyalty: 72 },
    initialAffinity: { familiarity: 30, trust: 30, comfort: 20, respect: 40, annoyance: 10, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
    routine: { wakeMinute: 450, sleepMinute: 1320, workShift: "day", preferredHangout: "motel" },
    art: { engine: "live2d", modelPath: "assets/models/henderson/henderson.model3.json", expressions: {"neutral":"exp_neutral","stern":"exp_stern"}, defaultOutfit: "motel_suit" },
  },
];

export interface GeneratedDialoguePool {
  key: string;
  lines: string[];
  version: number;
}

export const GENERATED_DIALOGUE_POOLS: GeneratedDialoguePool[] = [
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

export interface GeneratedAffinitySeed {
  roleA: string;
  roleB: string;
  value: number;
}

export const GENERATED_AFFINITY_SEEDS: GeneratedAffinitySeed[] = [
  {
    roleA: "canal-regular",
    roleB: "cart-owner",
    value: -5,
  },
  {
    roleA: "canal-regular",
    roleB: "diner-staff",
    value: 5,
  },
  {
    roleA: "canal-regular",
    roleB: "landlord",
    value: 0,
  },
  {
    roleA: "cart-owner",
    roleB: "diner-staff",
    value: 15,
  },
  {
    roleA: "cart-owner",
    roleB: "landlord",
    value: 10,
  },
  {
    roleA: "diner-staff",
    roleB: "landlord",
    value: 10,
  },
];

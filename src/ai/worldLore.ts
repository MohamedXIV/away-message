// src/ai/worldLore.ts
// Canonical fictional world bible — fed to every procedural AI prompt as initial info.
// Keep small, factual, and era-locked (1998-2006, no modern tech).

export const WORLD_LORE = {
  era: '1998-2006, dial-up to early broadband, beige boxes, CRTs',
  city: {
    name: 'Oakhaven',
    districts: ['Canal District (industrial, motel row, neon diner)', 'Downtown', 'TechMart corridor', 'Starlite Motel area (Room 104)'],
    vibe: 'damp brick, sodium lights, canal bridge, night market, telecom antenna, payphones',
  },
  brands: {
    os: ['Orion OS 4.8 (98/ME-like, beveled, 512MB)', 'Orion OS 6.0 (XP-like, warmer)', 'Orion OS 7 (upcoming, glossy, dock, 768MB min / 1GB rec)'],
    sites: {
      myplace: 'personal pages with glitter, top 8, autoplay songs, tiled backgrounds, guestbooks — MySpace-like; v1→v2 added maps, Top 8, tiler; v2.1 adds song charts/contests',
      pulse: 'AIM-like messenger with away messages, buddy list, typing indicators',
      citywire: 'local newspaper site (oakhaven district edition) — now procedural feed',
      techmart: 'hardware store site — sells RAM, Orion boxes, DSL modems',
      downloadhub: 'shareware directory — mirrors 1..3, throttled',
      nightboard: 'small forum — threads about OS skins, RAM prices, canal hum',
      goldnet: 'toy digital-gold price ticker (no real crypto, surges/dips on CityWire)',
      findit: 'search engine',
    },
    hardware: '512MB→1024MB RAM, 40GB HDD (~7GB free), 256k→1M DSL, single-core CPU',
  },
  timeline: {
    orion: [
      'Day 3-4: Orion 7 whispers on NightBoard',
      'Day 7: beta screenshots leak (BMP zip, glossy dock, debate)',
      'Day 9: 1GB RAM gate revealed — anger',
      'Day 11: midnight launch at TechMart (glossy box, poster)',
      'Day 11-12: 99% file-copy bug + dock skin backport for 6.0',
      'Day 13: screensavers + CityWire 7-vs-6 bench',
    ],
    myplace: [
      'Day 3: v2 launch (Top 8, profile songs)',
      'Day 5-6: maps + threaded guestbooks',
      'Day 8-9: Top 8 drama + autoplay backlash',
      'Day 10-11: tiler viral + song chart “Canal Rain”',
      'Day 12-13: glitter contest + guestbook spam wave',
    ],
  },
  characters: {
    ryan: 'food-cart coworker, practical, teasing, teaches Pulse/software',
    maya: 'starlight_maya — quiet, lowercase, music, guarded then warm',
    nora: 'NightOwl87 — night archivist, dry humor, forum rabbit holes',
    henderson: 'motel manager, formal, rent-focused',
  },
  tone: 'intimate, slightly lonely, warm when connected, occasionally uneasy, grounded, no supernatural as fact, no horror',
  hardRules: [
    'All brands are fictional — never use real company names (Microsoft, Google, MySpace, Windows).',
    'All URLs must be *.local only, never real domains.',
    'No real politics, no real celebrities, no real news events.',
    'Technology must stay 1998-2006: no smartphones, no modern flat UI, no 4G, no AI self-reference.',
    'Supernatural may be hinted as rumor, never stated as fact.',
    'Every event must be mundane enough to be plausible in a cheap motel life.',
  ],
} as const;

export function buildLorePrompt(): string {
  return [
    `World: ${WORLD_LORE.city.name} — ${WORLD_LORE.city.districts.join('; ')}.`,
    `Era: ${WORLD_LORE.era}.`,
    `Brands: ${WORLD_LORE.brands.os.join(', ')}; sites: ${Object.entries(WORLD_LORE.brands.sites).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
    `Timeline Orion: ${(WORLD_LORE as unknown as { timeline: { orion: string[]; myplace: string[] } }).timeline.orion.join(' | ')}.`,
    `Timeline MyPlace: ${(WORLD_LORE as unknown as { timeline: { orion: string[]; myplace: string[] } }).timeline.myplace.join(' | ')}.`,
    `Characters: ${Object.entries(WORLD_LORE.characters).map(([k, v]) => `${k}:${v}`).join(' | ')}.`,
    `Tone: ${WORLD_LORE.tone}.`,
    `Hard rules: ${WORLD_LORE.hardRules.join(' ')}`,
  ].join('\n');
}

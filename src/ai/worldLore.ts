// src/ai/worldLore.ts
// Canonical fictional world bible for procedural AI prompts.
// Keep small, factual, era-locked, and independent of any required cast or campaign day.

export const WORLD_LORE = {
  era: '1998-2006, dial-up to early broadband, beige boxes, CRTs',
  city: {
    name: 'Oakhaven',
    districts: ['Canal District', 'Downtown', 'TechMart corridor', 'motel row'],
    vibe: 'damp brick, sodium lights, canal bridge, night market, telecom antenna, payphones',
  },
  brands: {
    os: ['Orion OS 4.8', 'Orion OS 6.x', 'later Orion releases'],
    sites: {
      myplace: 'personal pages with music, friends, tiled backgrounds, guestbooks, and era-appropriate profile customization',
      pulse: 'AIM-like messenger with away messages, buddy list, typing indicators, and public rooms',
      citywire: 'local newspaper site for Oakhaven',
      techmart: 'hardware and software shop',
      downloadhub: 'shareware directory with mirrors and throttled downloads',
      nightboard: 'small local forum about computers, music, town rumors, and late-night observations',
      goldnet: 'fictional digital-gold price ticker',
      findit: 'period-style search engine',
    },
    hardware: 'low-memory PCs, small HDDs, dial-up/DSL, single-core CPUs, CRT displays',
  },
  ongoingThreads: [
    'Orion releases, leaks, hardware requirements, patches, skins, and user arguments may emerge over time.',
    'MyPlace features, profile trends, music sharing, guestbook drama, and layout fads may emerge over time.',
    'Local news, jobs, rent, weather, shops, transit, events, and rumors continue independently of player progression.',
    'No thread is required to occur on a fixed day or to reach a canonical conclusion.',
  ],
  tone: 'intimate, slightly lonely, warm when connected, occasionally uneasy, grounded, no supernatural as fact, no horror',
  hardRules: [
    'All brands are fictional — never use real company names as in-world brands.',
    'All fictional web URLs must remain local to the simulated internet.',
    'No real politics, real celebrities, or real news events.',
    'Technology must stay period-appropriate: no smartphones, modern flat mobile UI, or contemporary network assumptions.',
    'Supernatural may be hinted as rumor, never stated as fact.',
    'Never assume a named NPC exists. Use only actors supplied by current live context.',
    'Never assume a fixed campaign day, final day, required meeting, or ending.',
  ],
} as const;

export function buildLorePrompt(): string {
  return [
    `World: ${WORLD_LORE.city.name} — ${WORLD_LORE.city.districts.join('; ')}.`,
    `Era: ${WORLD_LORE.era}.`,
    `Brands/sites: ${Object.entries(WORLD_LORE.brands.sites).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
    `Ongoing threads: ${WORLD_LORE.ongoingThreads.join(' | ')}.`,
    `Tone: ${WORLD_LORE.tone}.`,
    `Hard rules: ${WORLD_LORE.hardRules.join(' ')}`,
  ].join('\n');
}

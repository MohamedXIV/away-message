// src/ai/proceduralTemplates.ts
// Template fallback — works offline, deterministic, era-correct.
// Used when AI key missing, fails, or returns invalid batch.

import type { ProceduralWorldEvent } from './proceduralSchemas';

export interface TemplatePoolEntry {
  title: string;
  description: string;
  knowledgePrompt: string;
  cityWireHeadline: string;
  cityWireBody: string;
  siteUrl?: string;
}

const TEMPLATE_POOLS: Record<string, TemplatePoolEntry[]> = {
  site_launch: [
    {
      title: 'MyPlace adds neighborhood maps',
      description: 'MyPlace now shows a tiny map of Oakhaven blocks on each profile.',
      knowledgePrompt: 'MyPlace added little neighborhood maps — people are pinning their favorite corners.',
      cityWireHeadline: 'MyPlace Pins the Neighborhood',
      cityWireBody: 'MyPlace rolled out hand-drawn block maps. Early adopters are marking the canal bench where the neon buzzes loudest.',
      siteUrl: 'http://myplace.local/maps',
    },
    {
      title: 'NightBoard gets threaded replies',
      description: 'NightBoard forum now supports nested replies and quote blocks.',
      knowledgePrompt: 'NightBoard got threaded replies — old threads are being revived with nested arguments.',
      cityWireHeadline: 'NightBoard Learns to Thread',
      cityWireBody: 'Moderators say the new quoting system has doubled reply depth overnight. “Finally we can argue properly,” wrote one handle.',
      siteUrl: 'http://nightboard.local/',
    },
    {
      title: 'DownloadHub opens mirror #3',
      description: 'DownloadHub added a third FTP mirror behind the canal substation.',
      knowledgePrompt: 'DownloadHub added mirror #3 — downloads are less throttled after midnight.',
      cityWireHeadline: 'Third Mirror Eases Download Queues',
      cityWireBody: 'The new mirror is reported to cut 8MB installer waits from 45 to 18 minutes on 512k DSL.',
      siteUrl: 'http://downloadhub.local/',
    },
    // --- MyPlace rich evolution ---
    {
      title: 'MyPlace v2 Top 8 drama erupts',
      description: 'MyPlace v2 Top 8 rankings sparked friendship reshuffles across Oakhaven.',
      knowledgePrompt: 'MyPlace Top 8 drama — people are re-ranking friends and screenshots are circulating on Pulse.',
      cityWireHeadline: 'Top 8 Sparks Hallway Diplomacy',
      cityWireBody: 'One handle wrote: “I was 3 yesterday, now I’m 9.” Moderators remind users that manual ordering is “a feature, not a verdict.”',
      siteUrl: 'http://myplace.local/top8',
    },
    {
      title: 'MyPlace autoplay complaints spike',
      description: 'Autoplay profile songs are driving 56k users to close tabs mid-load.',
      knowledgePrompt: 'MyPlace autoplay songs are killing 56k loads — Pulse is full of “how to mute?” threads.',
      cityWireHeadline: 'Autoplay Anthems Test 56K Patience',
      cityWireBody: 'A 3MB MP3 on a glitter-packed profile takes 94 seconds to load on dial-up. A NightBoard thread tracks “worst offenders.”',
      siteUrl: 'http://myplace.local/autoplay',
    },
    {
      title: 'MyPlace background tiler goes viral',
      description: 'A new tiled-background maker lets users repeat a 100x100 pattern across their page.',
      knowledgePrompt: 'Everyone is tiling tiny star GIFs as MyPlace backgrounds — some pages look like static.',
      cityWireHeadline: 'Tiled Stars Blanket MyPlace',
      cityWireBody: 'The tool exports a 4KB GIF that repeats edge-to-edge. One profile now has 12 tiling layers and a visitor counter at 00427.',
      siteUrl: 'http://myplace.local/tiler',
    },
    {
      title: 'MyPlace guestbook spam wave',
      description: 'Guestbooks are flooded with “add me back!” and glitter chain letters.',
      knowledgePrompt: 'MyPlace guestbooks are spammed with glitter chains — people beg for adds.',
      cityWireHeadline: 'Guestbooks Drown in Glitter Chains',
      cityWireBody: 'A typical entry: “add 2 ur top? i’ll rate 10/10!!!” with five tiled hearts. Moderators ask for restraint.',
      siteUrl: 'http://myplace.local/guestbook',
    },
    {
      title: 'MyPlace song chart: “Canal Rain” tops profiles',
      description: 'A lo-fi track named “Canal Rain” is the most used profile song this week.',
      knowledgePrompt: '“Canal Rain” is the top MyPlace profile song — Maya has it too.',
      cityWireHeadline: '“Canal Rain” Tops MyPlace Charts',
      cityWireBody: 'The 128kbps MP3 is hosted on RetroAmp mirrors. Pulse away messages quote its chorus.',
      siteUrl: 'http://myplace.local/charts',
    },
  ],
  os_release: [
    {
      title: 'Orion OS 7 skins leak on NightBoard',
      description: 'Alleged Orion OS 7 wallpapers circulated as 800x600 BMPs.',
      knowledgePrompt: 'Leaked Orion OS 7 wallpapers are passing around as BMPs — some love the glossy dock, some call it clutter.',
      cityWireHeadline: 'Glossy Dock Divides Early Testers',
      cityWireBody: 'A 1.2MB zip of wallpapers labeled “orion7_skins_b3” appeared on NightBoard. OrionSoft declined to comment.',
      siteUrl: 'http://orionsoft.local/beta',
    },
    {
      title: 'Orion OS 6.1 patch notes posted',
      description: 'OrionSoft posted patch notes for 6.0→6.1: faster file copy, new screensaver.',
      knowledgePrompt: 'Orion OS 6.1 patch is out — faster copies and a new “Canal At Night” screensaver.',
      cityWireHeadline: 'Orion 6.1: Faster Copies, New Screensaver',
      cityWireBody: 'Users report the new progress dialog is “less anxious.” The included screensaver pans over a rain-slick canal.',
      siteUrl: 'http://orionsoft.local/patch',
    },
    // --- Orion OS 7 detailed arc ---
    {
      title: 'Orion OS 7 requires 1GB RAM — anger at 512MB owners',
      description: 'Beta notes confirm Orion 7 needs 768MB minimum, 1GB recommended. 512MB machines are blocked from install.',
      knowledgePrompt: 'Orion 7 needs 1GB — 512MB owners are angry they must buy RAM or stay on 6.0.',
      cityWireHeadline: '1GB Gate Slams 512MB Holdouts',
      cityWireBody: 'The installer checks RAM before copying. TechMart reports a run on used 512MB sticks. OrionSoft says “6.0 will be supported.”',
      siteUrl: 'http://orionsoft.local/requirements',
    },
    {
      title: 'Orion OS 7 midnight launch at TechMart',
      description: 'TechMart will open at midnight for boxed Orion 7 copies with a glossy slipcase.',
      knowledgePrompt: 'TechMart midnight launch for Orion 7 — people are camping for the glossy box.',
      cityWireHeadline: 'Midnight Boxes for Glossy System',
      cityWireBody: 'First 20 buyers get a “Dock Dreams” poster. One clerk said the installer reboots twice “for drama.”',
      siteUrl: 'http://techmart.local/orion7',
    },
    {
      title: 'Orion 7 first bug: file copy freezes at 99%',
      description: 'Early adopters report a freeze at 99% when copying large folders on 40GB drives.',
      knowledgePrompt: 'Orion 7 has a 99% file-copy freeze — workaround is to copy in smaller batches.',
      cityWireHeadline: '99% Freeze Greets Early Adopters',
      cityWireBody: 'A NightBoard thread lists the bug and a safe copy trick. OrionSoft promises a patch “next week-ish.”',
      siteUrl: 'http://nightboard.local/thread/orion7-bug',
    },
    {
      title: 'Orion 7 dock skins already cloned for 6.0',
      description: 'A hobbyist ported the glossy dock as a skin for Orion 6.0, no upgrade needed.',
      knowledgePrompt: 'Someone cloned the Orion 7 dock as a skin for 6.0 — looks almost the same without the RAM tax.',
      cityWireHeadline: 'Glossy Dock Backported to 6.0',
      cityWireBody: 'The 400KB skin is on DownloadHub. Purists say “it’s not the same glow.”',
      siteUrl: 'http://downloadhub.local/files/orion7-dock-skin',
    },
    {
      title: 'Orion 7 screensavers: canal, aquarium, pipes',
      description: 'Orion 7 ships with three new screensavers, including a pipe maze and canal at night.',
      knowledgePrompt: 'Orion 7 screensavers include “Canal At Night” — it pans over wet neon like the real canal.',
      cityWireHeadline: 'Screensavers Pan Over Neon Canal',
      cityWireBody: 'The canal saver is already being ripped as a standalone .scr for 6.0 users.',
      siteUrl: 'http://orionsoft.local/screensavers',
    },
    {
      title: 'Orion 7 vs 6.0: CityWire benchmark',
      description: 'CityWire timed boot and file copy on identical beige boxes: 7 is 12% slower on 512MB, 8% faster on 1GB.',
      knowledgePrompt: 'CityWire benched 7 vs 6.0 — slower on 512MB, faster on 1GB with the new file cache.',
      cityWireHeadline: '7 Slower on 512, Faster on 1GB',
      cityWireBody: 'Boot: 6.0 48s, 7 54s on 512MB. On 1GB, 7 shaved 4 seconds off a 200MB copy.',
      siteUrl: 'http://citywire.local/article/orion-bench',
    },
  ],
  city_news: [
    {
      title: 'Canal substation hum returns',
      description: 'The 60Hz hum near the canal bridge was heard again after midnight.',
      knowledgePrompt: 'That low hum by the canal came back last night — motel guests noticed flickering neon.',
      cityWireHeadline: 'Hum Returns to Canal Bridge After Midnight',
      cityWireBody: 'Contractors said energized sub-stations cause the tone. Residents near Room 104 reported buzzing payphones.',
      siteUrl: 'http://citywire.local/article/canal-hum',
    },
    {
      title: 'Starlite Diner extends late hours',
      description: 'The 24H diner now serves soup until 2am for night-shift workers.',
      knowledgePrompt: 'Starlite Diner now serves soup until 2am — night-shift folks are gathering there.',
      cityWireHeadline: 'Diner Stretches Soup Service to 2AM',
      cityWireBody: 'The owner says the new hours are for telecom workers and motel guests who miss dinner.',
      siteUrl: 'http://citywire.local/article/diner-hours',
    },
    {
      title: 'Bus line adds late night loop',
      description: 'The cross-town bus now loops past TechMart after 10pm.',
      knowledgePrompt: 'The late bus now loops past TechMart — easier to pick up RAM after work.',
      cityWireHeadline: 'Late Bus Now Loops Past TechMart',
      cityWireBody: 'Riders say the new loop saves a 20-minute walk with heavy boxes.',
      siteUrl: 'http://citywire.local/article/bus-loop',
    },
  ],
  economy: [
    {
      title: 'BidBay RAM auction spikes',
      description: 'Used 512MB sticks are bidding up after Orion 7 rumors.',
      knowledgePrompt: 'Used RAM is spiking on BidBay — everyone wants 1GB before Orion 7.',
      cityWireHeadline: 'Used RAM Bids Climb Ahead of Orion 7',
      cityWireBody: 'A 512MB stick closed at $38 last night, up from $22. TechMart keeps new sticks at $45.',
      siteUrl: 'http://bidbay.local/',
    },
    {
      title: 'GoldNet dips after surge',
      description: 'GoldNet corrected -8% after the surge, traders call it “canal air”.',
      knowledgePrompt: 'GoldNet dipped after the surge — some are buying the dip, some cashing out.',
      cityWireHeadline: 'GoldNet Cools After Canal-Driven Surge',
      cityWireBody: 'Volume stayed high. One motel guest reportedly traded a single unit from the lobby payphone.',
      siteUrl: 'http://goldnet.local/',
    },
  ],
  culture: [
    {
      title: 'MyPlace glitter packing contest',
      description: 'A MyPlace group tracks who can pack most glitter without crashing 56k.',
      knowledgePrompt: 'There is a MyPlace glitter-packing contest — who can add most GIFs without breaking 56k loads.',
      cityWireHeadline: 'Glitter-Packing Contest Tests 56K Patience',
      cityWireBody: 'Leaderboard shows a profile with 14 tiled GIFs that still loads in 22 seconds on dial-up.',
      siteUrl: 'http://myplace.local/contest',
    },
    {
      title: 'TechMart installs meet MyPlace glitter',
      description: 'TechMart clerks are now asked to install MyPlace tiler CDs that customers burned at home.',
      knowledgePrompt: 'People bring burned tiler CDs to TechMart — clerks install MyPlace glitter for them.',
      cityWireHeadline: 'Burned Tiler CDs at the Counter',
      cityWireBody: 'One disc was labeled “STARZ_V3” in marker. “We install the glitter, they take the lag,” said a clerk.',
      siteUrl: 'http://myplace.local/tiler',
    },
    {
      title: 'RetroAmp skin mirrors Orion 7 gloss',
      description: 'A RetroAmp skin mimics Orion 7 glass with a candy progress bar.',
      knowledgePrompt: 'New RetroAmp skin copies Orion 7 gloss — candy bar and reflections.',
      cityWireHeadline: 'Candy Bar Skin for RetroAmp',
      cityWireBody: 'The skin is 80KB. It pairs well with the “Canal Rain” profile song on MyPlace.',
      siteUrl: 'http://retroamp.local/skins',
    },
  ],
  system: [
    {
      title: 'DSL node maintenance window',
      description: 'Telecom will throttle DSL to 128k overnight for node work.',
      knowledgePrompt: 'DSL will be throttled to 128k overnight for maintenance — good night to sleep early.',
      cityWireHeadline: 'Overnight DSL Throttle for Node Work',
      cityWireBody: 'TechMart recommends queuing big downloads before 11pm or after 4am.',
      siteUrl: 'http://citywire.local/article/dsl-maintenance',
    },
  ],
};

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function pickTemplateEvents(
  seed: string,
  currentDay: number,
  allowedCategories: string[],
  count: number,
): ProceduralWorldEvent[] {
  const normalizedCats = allowedCategories.length > 0 ? allowedCategories : Object.keys(TEMPLATE_POOLS);
  const result: ProceduralWorldEvent[] = [];
  for (let i = 0; i < count; i++) {
    const catIndex = hashString(`${seed}:${currentDay}:${i}:cat`) % normalizedCats.length;
    const category = normalizedCats[catIndex] ?? 'city_news';
    const pool = TEMPLATE_POOLS[category] ?? TEMPLATE_POOLS['city_news']!;
    const entryIndex = hashString(`${seed}:${currentDay}:${i}:entry`) % pool.length;
    const entry = pool[entryIndex]!;
    const triggerDay = currentDay + 1 + (hashString(`${seed}:${currentDay}:${i}:day`) % 3); // +1..+3
    const triggerHour = 9 + (hashString(`${seed}:${currentDay}:${i}:hour`) % 8); // 9..16
    result.push({
      id: `proc_${category}_${currentDay}_${i}_${hashString(`${seed}:${entry.title}`).toString(36).slice(0, 4)}`,
      title: entry.title,
      description: entry.description,
      category: category as ProceduralWorldEvent['category'],
      triggerDay,
      triggerHour,
      knowledgePrompt: entry.knowledgePrompt,
      siteUrl: entry.siteUrl ?? null,
      cityWireHeadline: entry.cityWireHeadline,
      cityWireBody: entry.cityWireBody,
      cityWireByline: `CityWire Staff // Day ${triggerDay}`,
    });
  }
  // Deduplicate by id
  const seen = new Set<string>();
  return result.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

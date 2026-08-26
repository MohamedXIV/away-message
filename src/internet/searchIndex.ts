import { SearchIndexEntry, SearchResultSummary } from './types';

export const SEARCH_INDEX_DATABASE: SearchIndexEntry[] = [
  // ----------------------------------------------------
  // SOFTWARE & UTILITIES
  // ----------------------------------------------------
  {
    id: 'search_pulse_download',
    title: 'Pulse Messenger 5.2 - Official Free Download',
    url: 'http://pulsechat.local/download',
    snippet: 'Stay connected with your friends and coworkers! Download Pulse 5.2 featuring custom away messages, tabbed chat, and sound alerts.',
    category: 'software',
    keywords: ['pulse', 'messenger', 'chat', 'im', 'instant', 'download', 'away', 'message', 'aim', 'msn', 'friends'],
    availableFromDay: 1,
    datePublished: 'May 14, 2005',
  },
  {
    id: 'search_flashfetch_app',
    title: 'FlashFetch 3.1 Download Accelerator - Speed up slow downloads',
    url: 'http://downloadhub.local/files/flashfetch',
    snippet: 'Stuck with slow downloads or broken connections? FlashFetch splits files into 4 parallel segments with auto-resume capability.',
    category: 'software',
    keywords: ['flashfetch', 'download', 'accelerator', 'slow', 'resume', 'segments', 'speed', 'bandwidth', 'faster'],
    availableFromDay: 1,
    datePublished: 'Jan 22, 2005',
  },
  {
    id: 'search_retroamp_player',
    title: 'RetroAmp 2.3 Audio Player - Classic MP3 & MIDI playback',
    url: 'http://retroamp.local',
    snippet: 'The premier lightweight audio player for Orion OS. Full equalizer, playlist management, and downloadable custom skins.',
    category: 'software',
    keywords: ['retroamp', 'audio', 'music', 'mp3', 'player', 'winamp', 'sound', 'equalizer', 'skins', 'songs'],
    availableFromDay: 1,
    datePublished: 'Aug 09, 2004',
  },
  {
    id: 'search_zipmate_utility',
    title: 'ZipMate 4.0 Archive Manager - ZIP & RAR Extraction',
    url: 'http://zipmate.local',
    snippet: 'Easily compress and extract ZIP archives on Orion OS. Available in standard installer and lightweight portable standalone formats.',
    category: 'software',
    keywords: ['zipmate', 'zip', 'unzip', 'archive', 'extract', 'compress', 'rar', 'tar', 'portable', 'utility'],
    availableFromDay: 1,
    datePublished: 'Mar 18, 2005',
  },
  {
    id: 'search_photobox_suite',
    title: 'PhotoBox Studio 3.0 - Professional Image Editing for Orion 6.0',
    url: 'http://downloadhub.local/files/photobox',
    snippet: 'Next-generation photo editing with layered canvas and RAW support. Requires Orion OS 6.0 and 768 MB RAM.',
    category: 'software',
    keywords: ['photobox', 'photo', 'picture', 'editor', 'image', 'orion6', 'studio', 'graphics', 'viewer'],
    availableFromDay: 1,
    datePublished: 'Sep 05, 2006',
  },
  {
    id: 'search_weatherbuddy_widget',
    title: 'WeatherBuddy 1.4 - Free Animated Desktop Weather Widget',
    url: 'http://weatherbuddy.local',
    snippet: 'Get real-time temperature and forecasts delivered right to your Orion desktop by your friendly weather companion cloud!',
    category: 'software',
    keywords: ['weatherbuddy', 'weather', 'widget', 'forecast', 'temperature', 'desktop', 'cloud', 'free', 'adware'],
    availableFromDay: 1,
    datePublished: 'Jun 11, 2005',
  },
  {
    id: 'search_safesweep_security',
    title: 'SafeSweep Anti-Spyware 2.0 - Clean Hijacked Toolbars & Malware',
    url: 'http://safesweep.local',
    snippet: 'Detects and removes unwanted search toolbars, SearchMate adware, startup hijacks, and restores your default browser homepage.',
    category: 'software',
    keywords: ['safesweep', 'spyware', 'adware', 'searchmate', 'toolbar', 'hijack', 'virus', 'security', 'antivirus', 'clean'],
    availableFromDay: 1,
    datePublished: 'Oct 01, 2006',
  },
  {
    id: 'search_peerbox_p2p',
    title: 'PeerBox P2P Network 1.2 - Decentralized File Sharing',
    url: 'http://peerbox.local',
    snippet: 'Search and share audio, software, and documents with millions of users across the decentralized PeerBox file network.',
    category: 'software',
    keywords: ['peerbox', 'p2p', 'sharing', 'files', 'kazaa', 'limewire', 'download', 'network', 'mp3'],
    availableFromDay: 2,
    datePublished: 'Nov 19, 2005',
  },

  // ----------------------------------------------------
  // HARDWARE & MARKETPLACE
  // ----------------------------------------------------
  {
    id: 'search_techmart_ram',
    title: 'TechMart Direct: 512MB DDR-400 RAM Upgrade Module (.00)',
    url: 'http://techmart.local/product/ram512',
    snippet: 'Double your memory to 1024 MB! Run demanding programs smoothly and eliminate multitasking slowdowns. Guaranteed compatibility.',
    category: 'hardware',
    keywords: ['techmart', 'ram', 'memory', 'upgrade', '512mb', '1024mb', 'hardware', 'store', 'buy', 'ddr'],
    availableFromDay: 1,
    datePublished: 'Sep 28, 2006',
  },
  {
    id: 'search_techmart_os6',
    title: 'TechMart Direct: Orion OS 6.0 Home Edition Upgrade CD (.00)',
    url: 'http://techmart.local/product/orion6',
    snippet: 'Upgrade your PC to Orion 6.0! Sleek new interface, enhanced multimedia, and full compatibility with modern applications.',
    category: 'hardware',
    keywords: ['orion', 'orion6', 'os', 'upgrade', 'operating system', 'windows', 'software', 'techmart'],
    availableFromDay: 1,
    datePublished: 'Sep 15, 2006',
  },
  {
    id: 'search_bidbay_classifieds',
    title: 'BidBay Auctions & Classifieds: Used PC Hardware & Electronics',
    url: 'http://bidbay.local',
    snippet: 'Browse local classified listings for used RAM sticks, IDE hard drives, desktop speakers, and electronics at discount prices.',
    category: 'hardware',
    keywords: ['bidbay', 'auction', 'used', 'cheap', 'classifieds', 'ram', 'hdd', 'speakers', 'ebay', 'deals'],
    availableFromDay: 1,
    datePublished: 'Oct 02, 2006',
  },
  {
    id: 'search_goldnet_exchange',
    title: 'GoldNet Digital Bullion Vault - Secure Online Gold Holdings',
    url: 'http://goldnet.local',
    snippet: 'Buy, store, and redeem digital gold certificates linked to spot bullion prices. Instant funding and cash redemption.',
    category: 'hardware',
    keywords: ['goldnet', 'gold', 'bullion', 'vault', 'exchange', 'currency', 'investment', 'money', 'rates'],
    availableFromDay: 1,
    datePublished: 'Jun 30, 2006',
  },

  // ----------------------------------------------------
  // COMMUNITY & FORUMS (RABBIT HOLE A & B)
  // ----------------------------------------------------
  {
    id: 'search_nightboard_downloads',
    title: 'NightBoard: "Why are downloads crawling on Orion 4.8?" (Thread #101)',
    url: 'http://nightboard.local/thread/101',
    snippet: 'User thread on slow connection speeds. Ryan_K recommends downloading FlashFetch from DownloadHub for multi-part acceleration.',
    category: 'community',
    keywords: ['nightboard', 'thread', 'slow', 'downloads', 'crawling', 'ryan', 'flashfetch', 'forum', 'orion', 'speed'],
    availableFromDay: 1,
    datePublished: 'Oct 03, 2006',
  },
  {
    id: 'search_nightboard_canal',
    title: 'NightBoard: "Strange low-frequency hum near the Industrial Canal" (Thread #104)',
    url: 'http://nightboard.local/thread/104',
    snippet: 'NightOwl87 posts audio observations and late-night sightings near the old waterworks bridge and north industrial district.',
    category: 'community',
    keywords: ['nightboard', 'nightowl87', 'hum', 'canal', 'industrial', 'bridge', 'mystery', 'sounds', 'nora'],
    availableFromDay: 2,
    datePublished: 'Oct 04, 2006',
  },
  {
    id: 'search_nightboard_toolbar_warn',
    title: 'NightBoard: "WARNING: WeatherBuddy bundles SearchMate toolbar!" (Thread #112)',
    url: 'http://nightboard.local/thread/112',
    snippet: 'Community alert regarding hijacked browser start pages and how to safely remediate with SafeSweep Anti-Spyware.',
    category: 'community',
    keywords: ['nightboard', 'weatherbuddy', 'searchmate', 'toolbar', 'adware', 'safesweep', 'hijack', 'warning'],
    availableFromDay: 1,
    datePublished: 'Sep 21, 2006',
  },

  // ----------------------------------------------------
  // SOCIAL & PEOPLE
  // ----------------------------------------------------
  {
    id: 'search_myplace_maya',
    title: 'MyPlace: maya_x - Photography, Indie Music & Late Nights',
    url: 'http://myplace.local/maya_x',
    snippet: 'Maya\'s personal MyPlace profile. Photos from 4th Street Diner, favorite tracks, blog entries, and guestbook comments.',
    category: 'social',
    keywords: ['maya', 'maya_x', 'myplace', 'profile', 'diner', 'photos', 'blog', 'friends'],
    availableFromDay: 1,
    datePublished: 'Oct 01, 2006',
  },
  {
    id: 'search_myplace_ryan',
    title: 'MyPlace: ryan_k - PC Modding, Bass Guitar & Audio Tech',
    url: 'http://myplace.local/ryan_k',
    snippet: 'Ryan\'s personal page. System specs, overclocking tests, links to favorite download utilities, and band schedule.',
    category: 'social',
    keywords: ['ryan', 'ryan_k', 'myplace', 'modding', 'hardware', 'guitar', 'music', 'overclock'],
    availableFromDay: 1,
    datePublished: 'Sep 18, 2006',
  },
  {
    id: 'search_myplace_nightowl',
    title: 'MyPlace: NightOwl87 - Urban Nocturne & Architecture',
    url: 'http://myplace.local/nightowl87',
    snippet: 'Nora\'s dark-themed portfolio featuring midnight city photography, industrial landscapes, and cryptic poetry excerpts.',
    category: 'social',
    keywords: ['nightowl87', 'nora', 'myplace', 'night', 'photography', 'poetry', 'urban', 'canal'],
    availableFromDay: 2,
    datePublished: 'Oct 02, 2006',
  },

  // ----------------------------------------------------
  // NEWS & LOCAL SERVICES
  // ----------------------------------------------------
  {
    id: 'search_citywire_power',
    title: 'CityWire: Motel District Power Grid Upgrades Slated for October',
    url: 'http://citywire.local/article/power_grid',
    snippet: 'Municipal utilities announce overnight substation maintenance affecting North Motel corridor and industrial avenue.',
    category: 'news',
    keywords: ['citywire', 'news', 'motel', 'power', 'grid', 'outage', 'north', 'electric'],
    availableFromDay: 1,
    datePublished: 'Oct 01, 2006',
  },
  {
    id: 'search_jobs_diner',
    title: 'CityJobs: 4th Street Diner Hiring Evening Kitchen Staff (/shift)',
    url: 'http://jobs.local/job/diner_cook',
    snippet: 'Immediate opening for reliable line cook and dishwasher. Flexible schedule, cash wages paid at shift end.',
    category: 'news',
    keywords: ['jobs', 'diner', 'work', 'cook', 'kitchen', 'cash', 'wage', 'shift', 'employment'],
    availableFromDay: 1,
    datePublished: 'Sep 29, 2006',
  },
  {
    id: 'search_motellink_portal',
    title: 'North Motel Resident Intranet & Guest Services',
    url: 'http://motellink.local',
    snippet: 'Important notices regarding weekly rent payment schedules (Day 7 & 14), quiet hours, and high-speed dial-up/DSL access.',
    category: 'news',
    keywords: ['motel', 'motellink', 'rent', 'north', 'rules', 'manager', 'room', 'wifi', 'internet'],
    availableFromDay: 1,
    datePublished: 'Oct 01, 2006',
  },
];

export class SearchEngine {
  public static search(
    query: string,
    options?: {
      category?: string;
      currentDay?: number;
      narrativeFlags?: Record<string, any>;
      limit?: number;
    }
  ): SearchResultSummary {
    const rawQuery = query || '';
    const cleanQuery = rawQuery.toLowerCase().trim();
    const currentDay = options?.currentDay ?? 1;
    const category = options?.category ?? 'all';
    const flags = options?.narrativeFlags ?? {};
    const limit = options?.limit ?? 20;

    if (!cleanQuery) {
      return {
        query: rawQuery,
        normalizedQuery: '',
        category,
        totalMatches: 0,
        searchDurationSeconds: 0.02,
        results: [],
      };
    }

    // Tokenize terms
    const tokens = cleanQuery
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const matchedEntries: (SearchIndexEntry & { score: number })[] = [];

    for (const entry of SEARCH_INDEX_DATABASE) {
      // 1. Day filter
      if (entry.availableFromDay > currentDay) continue;
      if (entry.availableUntilDay && entry.availableUntilDay < currentDay) continue;

      // 2. Narrative flags filter
      if (entry.requiredFlags && entry.requiredFlags.length > 0) {
        const hasAllFlags = entry.requiredFlags.every((flagKey) => Boolean(flags[flagKey]));
        if (!hasAllFlags) continue;
      }

      // 3. Category filter
      if (category !== 'all' && entry.category !== category) {
        continue;
      }

      // 4. Scoring Algorithm
      let score = 0;
      const lowerTitle = entry.title.toLowerCase();
      const lowerUrl = entry.url.toLowerCase();
      const lowerSnippet = entry.snippet.toLowerCase();
      const lowerKeywords = entry.keywords.map((k) => k.toLowerCase());

      // Exact phrase match bonus
      if (lowerTitle.includes(cleanQuery)) score += 100;
      if (lowerUrl.includes(cleanQuery)) score += 80;
      if (lowerSnippet.includes(cleanQuery)) score += 40;

      // Token-level scoring
      let tokenMatches = 0;
      for (const token of tokens) {
        let matched = false;

        if (lowerTitle.includes(token)) {
          score += 25;
          matched = true;
        }
        if (lowerUrl.includes(token)) {
          score += 15;
          matched = true;
        }
        if (lowerKeywords.some((k) => k.includes(token))) {
          score += 20;
          matched = true;
        }
        if (lowerSnippet.includes(token)) {
          score += 10;
          matched = true;
        }

        if (matched) tokenMatches++;
      }

      // Bonus if all tokens are present
      if (tokens.length > 1 && tokenMatches === tokens.length) {
        score += 50;
      }

      if (score > 0) {
        matchedEntries.push({ ...entry, score });
      }
    }

    // Sort descending by score
    matchedEntries.sort((a, b) => b.score - a.score);
    const results = matchedEntries.slice(0, limit);

    return {
      query: rawQuery,
      normalizedQuery: cleanQuery,
      category,
      totalMatches: matchedEntries.length,
      searchDurationSeconds: 0.04 + Math.round(Math.random() * 3) / 100,
      results,
    };
  }
}

export function searchInternet(
  query: string,
  currentDay: number = 1,
  narrativeFlags: Record<string, any> = {}
): SearchIndexEntry[] {
  return SearchEngine.search(query, { currentDay, narrativeFlags }).results;
}

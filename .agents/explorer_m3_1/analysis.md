# Milestone 3 Architecture & Blueprints: Fake Internet Subsystem & Voyager Browser

**Author**: `explorer_m3_1`  
**Date**: 2026-08-22  
**Scope**: Complete architectural designs, data models, interaction patterns, and code blueprints for:
1. `src/internet/InternetRouter.ts` (Local routing, URL normalization, dynamic routes, simulated latency, 404 error page)
2. `src/internet/searchIndex.ts` (Full-text search engine, normalized keyword scoring, categories, date gating, narrative gating)
3. All 18 fake `.local` websites in `src/internet/sites/`
4. `src/apps/browser/VoyagerBrowserApp.tsx` (Full Netscape/IE6-style browser shell with history, bookmarks, loading progress, and SearchMate toolbar injection slot)

---

## 1. Executive Architecture Summary

The Fake Internet subsystem delivers an authentic mid-2000s web exploration network within the diegetic Orion OS environment. In accordance with `04-INTERNET-SOCIAL-AND-NARRATIVE.md` and `05-TECHNICAL-ARCHITECTURE.md`:
- **Strictly Local Content**: No real network requests or iframes are executed. All content is generated via React components and curated datasets.
- **Fragmented Visual Aesthetics**: Rather than adhering to a single modern design system, each site features a distinct, period-accurate visual identity (harsh contrasts, retro bevels, table-like layout grids, bright banners, glitter gifs, vBulletin forum structures, and e-commerce carts).
- **Authoritative Simulation Integration**: Download links directly trigger real `DOWNLOAD_START` actions on the `SimulationEngine` via `useSimulationStore`. Hardware/store checkouts interface with `PLAYER_SPEND_CASH` and hardware upgrade actions.
- **Dynamic & Narrative-Reactive**: Sites update across the 14-day timeline (news headlines, fluctuating digital gold rates, classified listings expiring, forum replies accumulating), gated by game day and narrative flags.
- **Two Multi-Step Rabbit Holes**:
  - **Rabbit Hole A (Software)**: NightBoard download complaint → Ryan recommendations → DownloadHub → FlashFetch / ZipMate download → utility unlock.
  - **Rabbit Hole B (Identity)**: NightBoard mysterious user `NightOwl87` → thread on industrial canal → MyPlace personal profile (`myplace.local/nightowl87`) → real-name/city discovery.

```
+-----------------------------------------------------------------------------------+
|                            VoyagerBrowserApp.tsx                                  |
|  [Back][Forward][Stop][Refresh][Home]  Address: [ http://findit.local/search?q=.. ] [Go] |
|  Bookmarks: [FindIt] [DownloadHub] [Pulse] [TechMart] [BidBay] [MyPlace] [NightBoard]... |
|  [SearchMate Adware Toolbar: (When WeatherBuddy installed)] [Search Web] [Weather: 68°F]  |
|  +-----------------------------------------------------------------------------+  |
|  |  InternetRouter.ts                                                          |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  | Latency Simulator (56k: 900ms, DSL 256k: 350ms, 512k: 180ms, 1M: 80ms)|  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  | Route Matching Engine (Hosts + Dynamic Parametric Routes)             |  |  |
|  |  | -> 18 Period-Authentic Websites / Default404Page                       |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
|  Status: [Done / Connecting...]                  [Zone: Local Intranet] [⬇ 1 DL]  |
+-----------------------------------------------------------------------------------+
```

---

## 2. System Domain 1: `src/internet/InternetRouter.ts`

### 2.1 Technical Specification & Interfaces

The `InternetRouter` is responsible for parsing user input into normalized URLs, dispatching routes to corresponding site components, simulating network connection latency, and handling 404/DNS error states.

```ts
// src/internet/types.ts

export type InternetHost =
  | 'findit.local'
  | 'downloadhub.local'
  | 'pulsechat.local'
  | 'techmart.local'
  | 'bidbay.local'
  | 'myplace.local'
  | 'mailbox.local'
  | 'nightboard.local'
  | 'citywire.local'
  | 'jobs.local'
  | 'goldnet.local'
  | 'weatherbuddy.local'
  | 'retroamp.local'
  | 'orionsoft.local'
  | 'zipmate.local'
  | 'safesweep.local'
  | 'peerbox.local'
  | 'motellink.local'
  | 'searchmate.local';

export interface ParsedUrl {
  rawUrl: string;
  normalizedUrl: string;
  protocol: 'http:' | 'https:';
  host: string;
  pathname: string;
  pathSegments: string[];
  searchParams: Record<string, string>;
  hash: string;
}

export interface SiteRouteProps {
  url: ParsedUrl;
  navigate: (url: string) => void;
  params: Record<string, string>;
  searchParams: Record<string, string>;
}

export interface RouteMatchResult {
  host: string;
  pathname: string;
  params: Record<string, string>;
  component: React.ComponentType<SiteRouteProps>;
  pageTitle: string;
}
```

### 2.2 Complete Code Blueprint: `src/internet/InternetRouter.ts`

```ts
// src/internet/InternetRouter.ts

import React from 'react';
import { ConnectionType } from '../engine/types';
import { ParsedUrl, RouteMatchResult, SiteRouteProps } from './types';

// Site Components (Lazy or direct imports)
import { FindItSite } from './sites/FindItSite';
import { DownloadHubSite } from './sites/DownloadHubSite';
import { PulseChatSite } from './sites/PulseChatSite';
import { TechMartSite } from './sites/TechMartSite';
import { BidBaySite } from './sites/BidBaySite';
import { MyPlaceSite } from './sites/MyPlaceSite';
import { MailboxSite } from './sites/MailboxSite';
import { NightBoardSite } from './sites/NightBoardSite';
import { CityWireSite } from './sites/CityWireSite';
import { JobsSite } from './sites/JobsSite';
import { GoldNetSite } from './sites/GoldNetSite';
import { WeatherBuddySite } from './sites/WeatherBuddySite';
import { RetroAmpSite } from './sites/RetroAmpSite';
import { OrionSoftSite } from './sites/OrionSoftSite';
import { ZipMateSite } from './sites/ZipMateSite';
import { SafeSweepSite } from './sites/SafeSweepSite';
import { PeerBoxSite } from './sites/PeerBoxSite';
import { MotelLinkSite } from './sites/MotelLinkSite';
import { SearchMateSite } from './sites/SearchMateSite';
import { Default404Page } from './sites/Default404Page';

export interface RouteDefinition {
  pathPattern: string; // e.g. '/', '/search', '/thread/:threadId', '/profile/:username'
  component: React.ComponentType<SiteRouteProps>;
  title: string | ((params: Record<string, string>) => string);
}

export interface SiteRegistryEntry {
  host: string;
  defaultTitle: string;
  routes: RouteDefinition[];
}

export class InternetRouter {
  private static siteRegistry: Map<string, SiteRegistryEntry> = new Map();

  static {
    // Register all 18 authentic sites + SearchMate portal
    this.registerSite({
      host: 'findit.local',
      defaultTitle: 'FindIt Search',
      routes: [
        { pathPattern: '/', component: FindItSite, title: 'FindIt Search' },
        { pathPattern: '/search', component: FindItSite, title: 'FindIt Search Results' },
      ],
    });

    this.registerSite({
      host: 'downloadhub.local',
      defaultTitle: 'DownloadHub - The Free Software Directory',
      routes: [
        { pathPattern: '/', component: DownloadHubSite, title: 'DownloadHub Software' },
        { pathPattern: '/category/:categoryId', component: DownloadHubSite, title: 'DownloadHub Category' },
        { pathPattern: '/files/:fileId', component: DownloadHubSite, title: (p) => `DownloadHub - ${p.fileId}` },
      ],
    });

    this.registerSite({
      host: 'pulsechat.local',
      defaultTitle: 'Pulse Messenger - Free Instant Messaging',
      routes: [
        { pathPattern: '/', component: PulseChatSite, title: 'Pulse Messenger' },
        { pathPattern: '/download', component: PulseChatSite, title: 'Pulse Downloads' },
        { pathPattern: '/skins', component: PulseChatSite, title: 'Pulse Skin Gallery' },
        { pathPattern: '/directory', component: PulseChatSite, title: 'Pulse Member Directory' },
      ],
    });

    this.registerSite({
      host: 'techmart.local',
      defaultTitle: 'TechMart Direct - PC Hardware & Software Superstore',
      routes: [
        { pathPattern: '/', component: TechMartSite, title: 'TechMart Hardware' },
        { pathPattern: '/category/:category', component: TechMartSite, title: 'TechMart Catalog' },
        { pathPattern: '/product/:productId', component: TechMartSite, title: 'TechMart Product Detail' },
        { pathPattern: '/checkout', component: TechMartSite, title: 'TechMart Checkout' },
      ],
    });

    this.registerSite({
      host: 'bidbay.local',
      defaultTitle: 'BidBay - Buy, Sell, and Trade Used Goods',
      routes: [
        { pathPattern: '/', component: BidBaySite, title: 'BidBay Auctions & Classifieds' },
        { pathPattern: '/item/:itemId', component: BidBaySite, title: 'BidBay Item Listing' },
        { pathPattern: '/category/:cat', component: BidBaySite, title: 'BidBay Category' },
      ],
    });

    this.registerSite({
      host: 'myplace.local',
      defaultTitle: 'MyPlace - A Place for Friends',
      routes: [
        { pathPattern: '/', component: MyPlaceSite, title: 'MyPlace Home' },
        { pathPattern: '/:username', component: MyPlaceSite, title: (p) => `MyPlace - ${p.username}'s Profile` },
        { pathPattern: '/profile/:username', component: MyPlaceSite, title: (p) => `MyPlace - ${p.username}'s Profile` },
        { pathPattern: '/photos/:username', component: MyPlaceSite, title: (p) => `MyPlace - ${p.username}'s Photos` },
      ],
    });

    this.registerSite({
      host: 'mailbox.local',
      defaultTitle: 'MailBox Webmail Client',
      routes: [
        { pathPattern: '/', component: MailboxSite, title: 'MailBox - Inbox' },
        { pathPattern: '/message/:messageId', component: MailboxSite, title: 'MailBox - Read Message' },
        { pathPattern: '/compose', component: MailboxSite, title: 'MailBox - Compose' },
      ],
    });

    this.registerSite({
      host: 'nightboard.local',
      defaultTitle: 'NightBoard - Hardware, Code & Late-Night Discussion',
      routes: [
        { pathPattern: '/', component: NightBoardSite, title: 'NightBoard Community' },
        { pathPattern: '/forum/:forumId', component: NightBoardSite, title: 'NightBoard Forum' },
        { pathPattern: '/thread/:threadId', component: NightBoardSite, title: (p) => `NightBoard - Thread #${p.threadId}` },
      ],
    });

    this.registerSite({
      host: 'citywire.local',
      defaultTitle: 'CityWire Local News & Weather',
      routes: [
        { pathPattern: '/', component: CityWireSite, title: 'CityWire News' },
        { pathPattern: '/article/:articleId', component: CityWireSite, title: 'CityWire Article' },
        { pathPattern: '/weather', component: CityWireSite, title: 'CityWire 5-Day Forecast' },
      ],
    });

    this.registerSite({
      host: 'jobs.local',
      defaultTitle: 'CityJobs Classified Employment Board',
      routes: [
        { pathPattern: '/', component: JobsSite, title: 'CityJobs Employment' },
        { pathPattern: '/job/:jobId', component: JobsSite, title: 'CityJobs Listing Detail' },
      ],
    });

    this.registerSite({
      host: 'goldnet.local',
      defaultTitle: 'GoldNet - Digital Bullion Vault & Exchange',
      routes: [
        { pathPattern: '/', component: GoldNetSite, title: 'GoldNet Digital Bullion' },
        { pathPattern: '/vault', component: GoldNetSite, title: 'GoldNet Member Vault' },
        { pathPattern: '/rates', component: GoldNetSite, title: 'GoldNet Spot Prices' },
      ],
    });

    this.registerSite({
      host: 'weatherbuddy.local',
      defaultTitle: 'WeatherBuddy Desktop Weather - Free Download!',
      routes: [
        { pathPattern: '/', component: WeatherBuddySite, title: 'WeatherBuddy Free Download' },
        { pathPattern: '/thanks', component: WeatherBuddySite, title: 'WeatherBuddy Thank You' },
      ],
    });

    this.registerSite({
      host: 'retroamp.local',
      defaultTitle: 'RetroAmp - It Really Kicks the Llama',
      routes: [
        { pathPattern: '/', component: RetroAmpSite, title: 'RetroAmp Audio Player' },
        { pathPattern: '/skins', component: RetroAmpSite, title: 'RetroAmp Skins' },
      ],
    });

    this.registerSite({
      host: 'orionsoft.local',
      defaultTitle: 'OrionSoft Systems Corporation',
      routes: [
        { pathPattern: '/', component: OrionSoftSite, title: 'OrionSoft - Orion OS 6.0' },
        { pathPattern: '/os6', component: OrionSoftSite, title: 'Orion OS 6.0 Features' },
        { pathPattern: '/support', component: OrionSoftSite, title: 'OrionSoft KnowledgeBase' },
      ],
    });

    this.registerSite({
      host: 'zipmate.local',
      defaultTitle: 'ZipMate Archive Manager',
      routes: [
        { pathPattern: '/', component: ZipMateSite, title: 'ZipMate Compression Utility' },
      ],
    });

    this.registerSite({
      host: 'safesweep.local',
      defaultTitle: 'SafeSweep Security Labs',
      routes: [
        { pathPattern: '/', component: SafeSweepSite, title: 'SafeSweep Anti-Spyware' },
        { pathPattern: '/database', component: SafeSweepSite, title: 'SafeSweep Threat Database' },
      ],
    });

    this.registerSite({
      host: 'peerbox.local',
      defaultTitle: 'PeerBox P2P Community Network',
      routes: [
        { pathPattern: '/', component: PeerBoxSite, title: 'PeerBox P2P File Sharing' },
      ],
    });

    this.registerSite({
      host: 'motellink.local',
      defaultTitle: 'North Motel Resident Portal',
      routes: [
        { pathPattern: '/', component: MotelLinkSite, title: 'North Motel Resident Bulletin' },
      ],
    });

    this.registerSite({
      host: 'searchmate.local',
      defaultTitle: 'SearchMate - The Helpful Web Search Companion',
      routes: [
        { pathPattern: '/', component: SearchMateSite, title: 'SearchMate Web Portal' },
      ],
    });
  }

  public static registerSite(entry: SiteRegistryEntry): void {
    this.siteRegistry.set(entry.host.toLowerCase(), entry);
  }

  /**
   * Normalizes any input string into a structured ParsedUrl
   */
  public static parseUrl(rawInput: string): ParsedUrl {
    let clean = rawInput.trim();
    if (!clean) clean = 'http://findit.local';

    let protocol: 'http:' | 'https:' = 'http:';
    if (clean.startsWith('https://')) {
      protocol = 'https:';
      clean = clean.substring(8);
    } else if (clean.startsWith('http://')) {
      protocol = 'http:';
      clean = clean.substring(7);
    }

    // Extract hash
    let hash = '';
    const hashIndex = clean.indexOf('#');
    if (hashIndex !== -1) {
      hash = clean.substring(hashIndex);
      clean = clean.substring(0, hashIndex);
    }

    // Extract search query string
    let searchParams: Record<string, string> = {};
    const queryIndex = clean.indexOf('?');
    if (queryIndex !== -1) {
      const queryString = clean.substring(queryIndex + 1);
      clean = clean.substring(0, queryIndex);
      const search = new URLSearchParams(queryString);
      search.forEach((val, key) => {
        searchParams[key] = val;
      });
    }

    // Split host and path
    const slashIndex = clean.indexOf('/');
    let host = (slashIndex === -1 ? clean : clean.substring(0, slashIndex)).toLowerCase();
    let pathname = slashIndex === -1 ? '/' : clean.substring(slashIndex);
    if (!pathname.startsWith('/')) pathname = '/' + pathname;

    // Default to .local if single word entered without TLD (e.g. "findit" -> "findit.local")
    if (!host.includes('.')) {
      host = `${host}.local`;
    }

    const pathSegments = pathname.split('/').filter(Boolean);
    const queryStringFormatted = Object.keys(searchParams).length > 0
      ? '?' + new URLSearchParams(searchParams).toString()
      : '';
    const normalizedUrl = `${protocol}//${host}${pathname}${queryStringFormatted}${hash}`;

    return {
      rawUrl: rawInput,
      normalizedUrl,
      protocol,
      host,
      pathname,
      pathSegments,
      searchParams,
      hash,
    };
  }

  /**
   * Resolves a URL to a route match or fallback 404 component
   */
  public static resolveRoute(parsedUrl: ParsedUrl): RouteMatchResult {
    const site = this.siteRegistry.get(parsedUrl.host);
    if (!site) {
      return {
        host: parsedUrl.host,
        pathname: parsedUrl.pathname,
        params: {},
        component: Default404Page,
        pageTitle: 'Server Not Found - HTTP 404',
      };
    }

    for (const route of site.routes) {
      const match = this.matchPath(route.pathPattern, parsedUrl.pathname);
      if (match) {
        const title = typeof route.title === 'function' ? route.title(match) : route.title;
        return {
          host: parsedUrl.host,
          pathname: parsedUrl.pathname,
          params: match,
          component: route.component,
          pageTitle: title || site.defaultTitle,
        };
      }
    }

    return {
      host: parsedUrl.host,
      pathname: parsedUrl.pathname,
      params: {},
      component: Default404Page,
      pageTitle: 'Page Not Found - HTTP 404',
    };
  }

  /**
   * Pattern matcher supporting :params and wildcards *
   */
  private static matchPath(pattern: string, pathname: string): Record<string, string> | null {
    if (pattern === pathname) return {};

    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length && !pattern.includes('*')) {
      return null;
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i++) {
      const pPart = patternParts[i];
      const actualPart = pathParts[i];

      if (pPart.startsWith(':')) {
        const paramName = pPart.slice(1);
        params[paramName] = actualPart;
      } else if (pPart === '*') {
        return params;
      } else if (pPart !== actualPart) {
        return null;
      }
    }

    return params;
  }

  /**
   * Simulates network latency based on player connection type
   */
  public static simulateLatency(
    connectionType: ConnectionType,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let totalMs = 350;
      switch (connectionType) {
        case 'dialup_56k':
          totalMs = 850 + Math.floor(Math.random() * 300);
          break;
        case 'dsl_256k':
          totalMs = 320 + Math.floor(Math.random() * 120);
          break;
        case 'dsl_512k':
          totalMs = 180 + Math.floor(Math.random() * 60);
          break;
        case 'dsl_1m':
          totalMs = 80 + Math.floor(Math.random() * 30);
          break;
      }

      const steps = 4;
      const stepDuration = totalMs / steps;
      let currentStep = 0;

      if (signal?.aborted) {
        return reject(new Error('Navigation aborted'));
      }

      const interval = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(interval);
          return reject(new Error('Navigation aborted'));
        }

        currentStep++;
        const progress = Math.min(100, Math.round((currentStep / steps) * 100));
        onProgress?.(progress);

        if (currentStep >= steps) {
          clearInterval(interval);
          resolve();
        }
      }, stepDuration);
    });
  }
}
```

---

## 3. System Domain 2: `src/internet/searchIndex.ts`

### 3.1 Search Index Architecture & Scoring Engine

`findit.local` is the primary discovery engine for the player. The search index implements:
1. **Keyword Normalization**: Tokenization, stripping punctuation, lowercasing, and handling common synonyms.
2. **Multi-Word Scoring**: Relevancy weights for exact title matches, URL slug matches, all-token intersection, keyword matches, and snippet text.
3. **Date & Narrative Gating**: Results are dynamically filtered by the current game day (1..14) and player knowledge flags (`narrative.flags`).

```ts
// src/internet/searchIndex.ts

export interface SearchIndexEntry {
  id: string;
  title: string;
  url: string;
  snippet: string;
  category: 'software' | 'news' | 'community' | 'hardware' | 'social';
  keywords: string[];
  availableFromDay: number;      // 1..14
  availableUntilDay?: number;
  requiredFlags?: string[];      // Narrative flags required to appear
  datePublished: string;        // Period authentic date (e.g. "Oct 12, 2004")
  score?: number;
}

export interface SearchResultSummary {
  query: string;
  normalizedQuery: string;
  category: string;
  totalMatches: number;
  searchDurationSeconds: number;
  results: SearchIndexEntry[];
}

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
    title: 'TechMart Direct: 512MB DDR-400 RAM Upgrade Module ($45.00)',
    url: 'http://techmart.local/product/ram512',
    snippet: 'Double your memory to 1024 MB! Run demanding programs smoothly and eliminate multitasking slowdowns. Guaranteed compatibility.',
    category: 'hardware',
    keywords: ['techmart', 'ram', 'memory', 'upgrade', '512mb', '1024mb', 'hardware', 'store', 'buy', 'ddr'],
    availableFromDay: 1,
    datePublished: 'Sep 28, 2006',
  },
  {
    id: 'search_techmart_os6',
    title: 'TechMart Direct: Orion OS 6.0 Home Edition Upgrade CD ($40.00)',
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
    title: 'CityJobs: 4th Street Diner Hiring Evening Kitchen Staff ($62/shift)',
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
```

---

## 4. System Domain 3: All 18 Fake Internet Websites

Each website is implemented with an authentic early-to-mid-2000s visual layout, distinct CSS rules, and dynamic interactivity.

### 4.1 Site 1: `findit.local` (Search Engine)
- **Visuals**: Clean white background, vintage blue/yellow logo, category tabs ("Web", "Software", "News", "Hardware", "People"), classic search box, "FindIt Search" & "I'm Feeling Lucky" beveled buttons.
- **Features**: Live query parsing, instant search results execution, sponsored links box (TechMart & GoldNet ads), related queries, and web directory links.
- **Route**: `src/internet/sites/FindItSite.tsx`

### 4.2 Site 2: `downloadhub.local` (Software Repository)
- **Visuals**: Tucows / Download.com 2004 green and slate theme, cow rating icons (🐮🐮🐮🐮🐮), categories sidebar, top 10 downloads leaderboard.
- **Features**:
  - Detailed app pages for FlashFetch, RetroAmp, ZipMate, WeatherBuddy, SafeSweep, PhotoBox, Pulse Messenger.
  - One-click green "Download Now (x.x MB)" buttons that call `useSimulationStore.getState().startDownload(...)`.
  - Realistic download metadata: Author, OS Requirements, License, File Size.
- **Route**: `src/internet/sites/DownloadHubSite.tsx`

### 4.3 Site 3: `pulsechat.local` (Pulse Messenger Portal)
- **Visuals**: AIM / MSN Messenger 2005 gradient blue look with yellow butterfly-style icon, bold callout boxes, feature screenshots.
- **Features**:
  - Download section for Pulse 5.2 (and Orion 6 preview of Pulse 6.0).
  - Skin showcase for Pulse custom chat themes.
  - Member search directory.
  - Connection guide for dial-up and DSL users.
- **Route**: `src/internet/sites/PulseChatSite.tsx`

### 4.4 Site 4: `techmart.local` (PC Hardware Store)
- **Visuals**: TigerDirect / Newegg 2004 red & white e-commerce catalog, promotional red starburst badges ("HOT DEAL!"), shopping cart dropdown.
- **Features**:
  - Product Catalog:
    - 512 MB RAM Upgrade Module ($45.00) -> Triggers `HARDWARE_UPGRADE_RAM`.
    - Orion OS 6.0 Upgrade CD ($40.00) -> Adds installer to Downloads or triggers OS upgrade.
    - 512k DSL Speed Plan Upgrade ($30.00) -> Triggers `HARDWARE_UPGRADE_CONNECTION`.
    - Desktop Stereo Speakers ($25.00) -> Unlocks audio playback hardware flag.
    - USB 320x240 Webcam ($35.00) -> Unlocks webcam hardware flag.
  - Cart & Cash Checkout: Validates player has sufficient cash, deducts cash, executes upgrade, and displays receipt with order confirmation email in `mailbox.local`.
- **Route**: `src/internet/sites/TechMartSite.tsx`

### 4.5 Site 5: `bidbay.local` (Classifieds & Auctions)
- **Visuals**: eBay 2003 / Craigslist layout with multi-colored logo, time remaining counters, seller feedback stars.
- **Features**:
  - Used hardware listings at discount prices (e.g. Used 512MB RAM for $28.00 vs $45.00 new at TechMart!).
  - Buy-It-Now functionality with local pickup instructions.
  - Listings update across game days (Day 1..14).
- **Route**: `src/internet/sites/BidBaySite.tsx`

### 4.6 Site 6: `myplace.local` (Personal Social Profiles)
- **Visuals**: MySpace 2005 custom glitter, tile backgrounds, embedded MIDI/synth player, Top 8 Friends grid, harsh flash photography.
- **Profiles**:
  - `maya_x`: Personal blog entries, diner photos, favorite songs, guestbook comments with interactive comment form.
  - `ryan_k`: Band photos, overclocking benchmarks, link to NightBoard.
  - `nightowl87`: Cryptic midnight urban photography, industrial bridge poetry (Rabbit Hole B).
- **Route**: `src/internet/sites/MyPlaceSite.tsx`

### 4.7 Site 7: `mailbox.local` (Webmail Client)
- **Visuals**: Hotmail / Yahoo Mail 2004 blue navigation bar, folder list (Inbox [4], Sent, Trash), unread bold indicator.
- **Features**:
  - Motel Management Notice (Rent due alerts on Day 7 and Day 14).
  - ISP Welcome & Internet Billing Receipt.
  - Work schedule update from 4th Street Diner manager.
  - Email from Ryan with music track attachment (clicking "Download Attachment" saves `C:/Downloads/track01.mp3`).
  - Spam emails with period phishing flavor.
- **Route**: `src/internet/sites/MailboxSite.tsx`

### 4.8 Site 8: `nightboard.local` (Discussion Forums)
- **Visuals**: vBulletin 3.0 / phpBB 2.0 navy and silver theme, user avatars, post counts, user signatures with PC specs.
- **Boards & Key Threads**:
  - **Rabbit Hole A**: Thread #101 ("Why are downloads crawling on 4.8?") -> Ryan_K recommends FlashFetch on DownloadHub.
  - **Rabbit Hole B**: Thread #104 ("Strange hum near Industrial Canal") -> NightOwl87 thread with mystery lore.
  - Thread #108 ("PhotoBox 3.0 requires Orion 6 - hardware debate").
  - Thread #112 ("WeatherBuddy adware warning - clean with SafeSweep").
- **Route**: `src/internet/sites/NightBoardSite.tsx`

### 4.9 Site 9: `citywire.local` (Local News Portal)
- **Visuals**: Newspaper grid layout with bold headline banners, weather widget, municipal police blotter.
- **Features**: Headlines dynamically update according to game day (Day 1: Power grid maintenance, Day 3: DSL line expansion, Day 7: Industrial canal environmental survey, Day 11: Café district street fair).
- **Route**: `src/internet/sites/CityWireSite.tsx`

### 4.10 Site 10: `jobs.local` (Classified Job Board)
- **Visuals**: Simple classified text board with categories: Food Service, Warehousing, General Labor, IT/Office.
- **Features**:
  - Primary job listing: 4th Street Diner Line Cook ($62/shift).
  - Secondary gigs: Evening Courier ($35/shift), Warehouse Sorter ($40/shift).
- **Route**: `src/internet/sites/JobsSite.tsx`

### 4.11 Site 11: `goldnet.local` (Digital Bullion Exchange)
- **Visuals**: e-Gold 2003 metallic gold gradients, vault security lock badge, price ticker.
- **Features**:
  - Fluctuating gold price chart by day ($380 -> $412 -> $395 -> $430/oz).
  - Cash-to-Gold deposit and Gold-to-Cash redemption interface connected to player wallet.
- **Route**: `src/internet/sites/GoldNetSite.tsx`

### 4.12 Site 12: `weatherbuddy.local` (Freeware Landing Page)
- **Visuals**: BonziBuddy style cartoon cloud mascot with smiling face, bright yellow download button, animated GIF clouds.
- **Features**: Free download link for WeatherBuddy 1.4 installer with small fine-print disclosure of bundled SearchMate Toolbar.
- **Route**: `src/internet/sites/WeatherBuddySite.tsx`

### 4.13 Site 13: `retroamp.local` (RetroAmp Portal)
- **Visuals**: Nullsoft / Winamp 2002 black and neon green theme with electric lightning bolt banners.
- **Features**: Download RetroAmp 2.3 setup, skin previews ("Classic Gold", "CyberPulse", "Obsidian"), synthesizer audio engine documentation.
- **Route**: `src/internet/sites/RetroAmpSite.tsx`

### 4.14 Site 14: `orionsoft.local` (OS Vendor Portal)
- **Visuals**: Microsoft Windows 2000/XP product portal look, clean corporate navy/white grid.
- **Features**: Orion OS 6.0 feature matrix, hardware requirements table (768MB RAM, Tier 1 CPU, 500MB disk), Orion 4.8 End-of-Life timeline.
- **Route**: `src/internet/sites/OrionSoftSite.tsx`

### 4.15 Site 15: `zipmate.local` (Archive Utility)
- **Visuals**: WinZip / 7-Zip clean blue utility layout.
- **Features**:
  - Two distinct download links:
    1. "Standard Installer (.exe)" -> standard registry install.
    2. "Portable ZIP (.zip)" -> extracts portable executable without Add/Remove entry.
- **Route**: `src/internet/sites/ZipMateSite.tsx`

### 4.16 Site 16: `safesweep.local` (Security Portal)
- **Visuals**: Spybot Search & Destroy / Ad-Aware 2004 shield motif with red threat warnings.
- **Features**: Download SafeSweep 2.0 Anti-Spyware, known spyware signature database listing SearchMate Toolbar.
- **Route**: `src/internet/sites/SafeSweepSite.tsx`

### 4.17 Site 17: `peerbox.local` (P2P Network Portal)
- **Visuals**: Kazaa / LimeWire dark neon style with network throughput statistics.
- **Features**: Download PeerBox 1.2 client, community file search directory.
- **Route**: `src/internet/sites/PeerBoxSite.tsx`

### 4.18 Site 18: `motellink.local` (Motel Resident Intranet)
- **Visuals**: Basic Web 1.0 brown/beige bulletin board with serif typography.
- **Features**: Rent payment deadline policy (Day 7 and Day 14), quiet hours notice, motel manager contact info.
- **Route**: `src/internet/sites/MotelLinkSite.tsx`

---

## 5. System Domain 4: `src/apps/browser/VoyagerBrowserApp.tsx`

### 5.1 Architecture & Adware Toolbar Integration

`VoyagerBrowserApp` encapsulates the full Netscape 7 / Internet Explorer 6 web browsing experience:
1. **History Navigation**: Stack-based Back, Forward, Refresh, and Home buttons.
2. **URL Bar & Autocomplete**: Editable URL text field with instant Enter key navigation and quick dropdown suggestions.
3. **Bookmarks Quickbar**: Period-authentic toolbar containing 1-click links to major websites.
4. **SearchMate Adware Toolbar Injection Slot**:
   - Queries `useInstalledSoftware()` for `searchmate_toolbar` payload.
   - If present, injects the authentic SearchMate search bar and adware buttons directly beneath the bookmarks toolbar!
   - Features a functional search input that redirects queries to `findit.local/search?q=...`.
5. **Simulated Latency Progress Indicator**:
   - Top progress bar animates across the viewport during simulated network fetch.
   - Animated spinning globe / Orion throbber in the upper-right corner.
6. **Integrated Status Bar**:
   - Connection state indicator ("Done", "Connecting to techmart.local...", "Opening page...").
   - Download status pill showing active downloads and aggregate download speed.

### 5.2 Complete Code Blueprint: `src/apps/browser/VoyagerBrowserApp.tsx`

```tsx
// src/apps/browser/VoyagerBrowserApp.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore, useHardwareState, useInstalledSoftware, useDownloads } from '../../store/useSimulationStore';
import { InternetRouter } from '../../internet/InternetRouter';
import { ParsedUrl, RouteMatchResult } from '../../internet/types';

export const VoyagerBrowserApp: React.FC<{ initialUrl?: string }> = ({ initialUrl = 'http://findit.local' }) => {
  const hardware = useHardwareState();
  const installedSoftware = useInstalledSoftware();
  const downloads = useDownloads();

  // Navigation History Stack
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [urlInput, setUrlInput] = useState<string>(initialUrl);
  const [currentParsedUrl, setCurrentParsedUrl] = useState<ParsedUrl>(() => InternetRouter.parseUrl(initialUrl));
  const [currentRoute, setCurrentRoute] = useState<RouteMatchResult>(() => InternetRouter.resolveRoute(InternetRouter.parseUrl(initialUrl)));

  // Loading & Latency State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<number>(100);
  const [statusText, setStatusText] = useState<string>('Done');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if SearchMate Adware Toolbar is active
  const hasSearchMateToolbar = installedSoftware.some(
    (sw) => sw.isAdware && sw.adwarePayload?.toolbarInjected
  );

  // Execute Navigation
  const navigateTo = useCallback((rawUrl: string, addToHistory = true) => {
    // Cancel any active navigation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const parsed = InternetRouter.parseUrl(rawUrl);
    const resolved = InternetRouter.resolveRoute(parsed);

    setUrlInput(parsed.normalizedUrl);
    setIsLoading(true);
    setLoadProgress(15);
    setStatusText(`Connecting to ${parsed.host}...`);

    InternetRouter.simulateLatency(
      hardware.connectionType,
      (progress) => {
        setLoadProgress(progress);
        if (progress > 50) {
          setStatusText(`Loading ${parsed.normalizedUrl}...`);
        }
      },
      abortController.signal
    )
      .then(() => {
        setCurrentParsedUrl(parsed);
        setCurrentRoute(resolved);
        setIsLoading(false);
        setLoadProgress(100);
        setStatusText('Done');

        if (addToHistory) {
          setHistory((prev) => {
            const nextHistory = prev.slice(0, historyIndex + 1);
            nextHistory.push(parsed.normalizedUrl);
            return nextHistory;
          });
          setHistoryIndex((prev) => prev + 1);
        }
      })
      .catch((err) => {
        if (err.message !== 'Navigation aborted') {
          setIsLoading(false);
          setLoadProgress(100);
          setStatusText('Error loading page');
        }
      });
  }, [hardware.connectionType, historyIndex]);

  // Back / Forward / Refresh / Home Handlers
  const handleBack = () => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      navigateTo(prevUrl, false);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextUrl = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      navigateTo(nextUrl, false);
    }
  };

  const handleRefresh = () => {
    navigateTo(currentParsedUrl.normalizedUrl, false);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setLoadProgress(100);
      setStatusText('Stopped');
    }
  };

  const handleHome = () => {
    navigateTo('http://findit.local');
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(urlInput);
  };

  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  const ComponentToRender = currentRoute.component;

  return (
    <div className="w-full h-full flex flex-col bg-[#ece9d8] text-black font-sans text-xs select-none overflow-hidden">
      {/* Menu Bar */}
      <div className="flex gap-3 px-2 py-0.5 bg-[#dfdfdf] border-b border-gray-400 text-xs select-none">
        <span className="hover:underline cursor-pointer">File</span>
        <span className="hover:underline cursor-pointer">Edit</span>
        <span className="hover:underline cursor-pointer">View</span>
        <span className="hover:underline cursor-pointer">Favorites</span>
        <span className="hover:underline cursor-pointer">Tools</span>
        <span className="hover:underline cursor-pointer">Help</span>
      </div>

      {/* Navigation Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#ece9d8] border-b border-gray-300">
        <button
          onClick={handleBack}
          disabled={historyIndex <= 0}
          className="flex items-center gap-1 px-2 py-0.5 bg-[#ece9d8] border border-gray-400 rounded disabled:opacity-40 hover:bg-white active:bg-gray-200 cursor-pointer text-xs"
          title="Back"
        >
          <span>⬅</span> <span>Back</span>
        </button>

        <button
          onClick={handleForward}
          disabled={historyIndex >= history.length - 1}
          className="flex items-center gap-1 px-2 py-0.5 bg-[#ece9d8] border border-gray-400 rounded disabled:opacity-40 hover:bg-white active:bg-gray-200 cursor-pointer text-xs"
          title="Forward"
        >
          <span>Forward</span> <span>➡</span>
        </button>

        <button
          onClick={handleStop}
          disabled={!isLoading}
          className="px-2 py-0.5 bg-[#ece9d8] border border-gray-400 rounded disabled:opacity-40 hover:bg-white active:bg-gray-200 cursor-pointer text-xs"
          title="Stop"
        >
          🛑 Stop
        </button>

        <button
          onClick={handleRefresh}
          className="px-2 py-0.5 bg-[#ece9d8] border border-gray-400 rounded hover:bg-white active:bg-gray-200 cursor-pointer text-xs"
          title="Refresh"
        >
          🔄 Refresh
        </button>

        <button
          onClick={handleHome}
          className="px-2 py-0.5 bg-[#ece9d8] border border-gray-400 rounded hover:bg-white active:bg-gray-200 cursor-pointer text-xs"
          title="Home"
        >
          🏠 Home
        </button>

        {/* Animated Throbber (Spinning globe when loading) */}
        <div className="ml-auto w-6 h-6 border border-gray-400 bg-white rounded flex items-center justify-center text-sm shadow-inner">
          <span className={isLoading ? 'animate-spin inline-block' : ''}>🌐</span>
        </div>
      </div>

      {/* Address Bar */}
      <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 px-2 py-1 bg-[#ece9d8] border-b border-gray-300">
        <span className="text-gray-700 font-bold text-xs shrink-0">Address:</span>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="flex-1 px-2 py-0.5 bg-white border border-gray-500 rounded text-xs outline-none font-mono text-gray-900 shadow-inner"
        />
        <button
          type="submit"
          className="px-3 py-0.5 bg-[#ece9d8] border border-gray-500 rounded hover:bg-white active:bg-gray-300 text-xs font-bold cursor-pointer"
        >
          Go ➔
        </button>
      </form>

      {/* Bookmarks Toolbar */}
      <div className="flex items-center gap-2 px-2 py-0.5 bg-[#f5f5f5] border-b border-gray-300 text-[11px] overflow-x-auto">
        <span className="text-gray-500 font-bold shrink-0">Links:</span>
        <button onClick={() => navigateTo('http://findit.local')} className="hover:underline text-blue-700 shrink-0">🔍 FindIt</button>
        <button onClick={() => navigateTo('http://downloadhub.local')} className="hover:underline text-blue-700 shrink-0">💾 DownloadHub</button>
        <button onClick={() => navigateTo('http://pulsechat.local')} className="hover:underline text-blue-700 shrink-0">💬 Pulse</button>
        <button onClick={() => navigateTo('http://techmart.local')} className="hover:underline text-blue-700 shrink-0">🛒 TechMart</button>
        <button onClick={() => navigateTo('http://bidbay.local')} className="hover:underline text-blue-700 shrink-0">🏷️ BidBay</button>
        <button onClick={() => navigateTo('http://myplace.local')} className="hover:underline text-blue-700 shrink-0">⭐ MyPlace</button>
        <button onClick={() => navigateTo('http://mailbox.local')} className="hover:underline text-blue-700 shrink-0">✉️ MailBox</button>
        <button onClick={() => navigateTo('http://nightboard.local')} className="hover:underline text-blue-700 shrink-0">🌙 NightBoard</button>
        <button onClick={() => navigateTo('http://citywire.local')} className="hover:underline text-blue-700 shrink-0">📰 CityWire</button>
        <button onClick={() => navigateTo('http://jobs.local')} className="hover:underline text-blue-700 shrink-0">💼 Jobs</button>
        <button onClick={() => navigateTo('http://goldnet.local')} className="hover:underline text-blue-700 shrink-0">💰 GoldNet</button>
      </div>

      {/* SearchMate Adware Toolbar Injection Slot */}
      {hasSearchMateToolbar && (
        <div className="flex items-center gap-2 px-2 py-1 bg-[#fff8d4] border-b border-yellow-400 text-xs shadow-sm">
          <span className="font-bold text-yellow-900 flex items-center gap-1">
            <span>🟡</span> SearchMate:
          </span>
          <input
            type="text"
            placeholder="Search the Web with SearchMate..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigateTo(`http://findit.local/search?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
              }
            }}
            className="w-48 px-1.5 py-0.5 bg-white border border-yellow-600 rounded text-xs outline-none"
          />
          <button
            onClick={() => navigateTo('http://findit.local')}
            className="px-2 py-0.5 bg-yellow-200 border border-yellow-500 rounded hover:bg-yellow-100 text-[11px]"
          >
            Search
          </button>
          <span className="text-[11px] text-gray-700 ml-auto flex items-center gap-2">
            <span>🛡️ Pop-ups: Blocked</span>
            <span>⛅ Weather: 68°F Cloudy</span>
          </span>
        </div>
      )}

      {/* Simulated Latency Loading Progress Bar */}
      {isLoading && (
        <div className="w-full h-1 bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-150 ease-out"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      )}

      {/* Main Website Canvas */}
      <div className="flex-1 overflow-auto bg-white relative">
        <ComponentToRender
          url={currentParsedUrl}
          navigate={navigateTo}
          params={currentRoute.params}
          searchParams={currentParsedUrl.searchParams}
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-[#dfdfdf] border-t border-gray-400 text-[11px] text-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <span>{statusText}</span>
        </div>

        <div className="flex items-center gap-3">
          {activeDownloads.length > 0 && (
            <div className="flex items-center gap-1 text-blue-700 font-bold bg-blue-100 px-1.5 py-0.2 rounded border border-blue-300">
              <span>⬇</span>
              <span>
                {activeDownloads.length} downloading ({activeDownloads.reduce((acc, d) => acc + d.allocatedKbps, 0)} kbps)
              </span>
            </div>
          )}
          <span>🔒 Local Intranet</span>
        </div>
      </div>
    </div>
  );
};
```

---

## 6. Integration Architecture & Window Registration

In `src/desktop/WindowManager.tsx`:
Add `browser` and `app.browser` to `defaultAppComponents`:
```tsx
browser: ({ window }) => <VoyagerBrowserApp initialUrl={window.customState?.initialUrl} />,
'app.browser': ({ window }) => <VoyagerBrowserApp initialUrl={window.customState?.initialUrl} />,
```

In `src/engine/SoftwareRegistry.ts`:
Ensure `Voyager Browser` shortcut in `C:/Desktop/Voyager Browser.lnk` opens `app.browser`.

---

## 7. Comprehensive Test Strategy

The test plan covers unit and integration validation across all four core domains:

1. **`InternetRouter.test.ts` (Unit)**:
   - URL parsing (`findit.local`, `http://downloadhub.local/files/flashfetch`, `nightboard.local/thread/104`, query strings).
   - Parameter extraction (`/category/:categoryId`, `/thread/:threadId`, `/profile/:username`).
   - 404 fallback routing for unknown hosts and paths.
   - Latency simulation speed calculation for 56k dialup vs 256k DSL vs 512k DSL vs 1M DSL.
   - Navigation abort signal cancellation.

2. **`searchIndex.test.ts` (Unit)**:
   - Keyword normalization and tokenization.
   - Multi-word relevance scoring (exact title matches, keyword matches, snippet matches).
   - Category filtering ("software", "news", "community", "hardware", "social").
   - Day gating (Day 1 vs Day 2+ results).
   - Narrative flag gating (`knows_nora_realname`, etc.).

3. **`VoyagerBrowserApp.test.tsx` (Component & Integration)**:
   - History stack progression (Back, Forward, Refresh, Home).
   - Bookmarks quickbar navigation.
   - SearchMate adware toolbar visibility when installed vs removed.
   - Download trigger integration (`startDownload` initiated from `DownloadHubSite`).
   - E-commerce checkout integration (`TechMart` cash deduction and RAM/OS upgrade).

4. **`RabbitHolesIntegration.test.ts` (Narrative Integration)**:
   - **Rabbit Hole A**: NightBoard Thread #101 → DownloadHub FlashFetch → `startDownload`.
   - **Rabbit Hole B**: NightBoard Thread #104 → MyPlace `nightowl87` → identity reveal.

---

## 8. Summary of Deliverables & Files to Implement

| Target File | Description |
|---|---|
| `src/internet/types.ts` | Internet subsystem types, parsed URLs, site route definitions |
| `src/internet/InternetRouter.ts` | Routing engine, latency simulator, host registry |
| `src/internet/searchIndex.ts` | Full-text search engine, curated database, scoring |
| `src/internet/sites/FindItSite.tsx` | Search engine UI with categories and ads |
| `src/internet/sites/DownloadHubSite.tsx` | Software directory with 1-click download actions |
| `src/internet/sites/PulseChatSite.tsx` | Pulse Messenger portal, downloads, skins |
| `src/internet/sites/TechMartSite.tsx` | Hardware store with cash checkout & upgrades |
| `src/internet/sites/BidBaySite.tsx` | Used classifieds & auction listings |
| `src/internet/sites/MyPlaceSite.tsx` | Personal profile pages (Maya, Ryan, NightOwl87) |
| `src/internet/sites/MailboxSite.tsx` | Webmail client with rent notices & attachments |
| `src/internet/sites/NightBoardSite.tsx` | Forum with handles, Rabbit Holes A & B |
| `src/internet/sites/CityWireSite.tsx` | Local news portal with day-based articles |
| `src/internet/sites/JobsSite.tsx` | Classified job board |
| `src/internet/sites/GoldNetSite.tsx` | Digital gold exchange with fluctuating rates |
| `src/internet/sites/WeatherBuddySite.tsx` | Freeware landing page bundling SearchMate |
| `src/internet/sites/RetroAmpSite.tsx` | Audio player downloads & skin portal |
| `src/internet/sites/OrionSoftSite.tsx` | Orion OS vendor portal & OS 6.0 specs |
| `src/internet/sites/ZipMateSite.tsx` | Archive tool portal (installer vs portable) |
| `src/internet/sites/SafeSweepSite.tsx` | Anti-spyware security tool portal |
| `src/internet/sites/PeerBoxSite.tsx` | P2P file sharing community portal |
| `src/internet/sites/MotelLinkSite.tsx` | North Motel resident intranet bulletin |
| `src/internet/sites/SearchMateSite.tsx` | SearchMate adware search portal |
| `src/internet/sites/Default404Page.tsx` | Authentic 2000s HTTP 404 page |
| `src/apps/browser/VoyagerBrowserApp.tsx` | Complete web browser application |
| `tests/unit/InternetRouter.test.ts` | Unit tests for routing & latency |
| `tests/unit/SearchIndex.test.ts` | Unit tests for search engine |
| `tests/integration/VoyagerBrowser.test.tsx` | Integration tests for browser & downloads |

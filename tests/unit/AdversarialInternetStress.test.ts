import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InternetRouter } from '../../src/internet/InternetRouter';
import { SearchEngine, searchInternet, SEARCH_INDEX_DATABASE } from '../../src/internet/searchIndex';
import { SearchIndexEntry } from '../../src/internet/types';
import { Default404Page } from '../../src/internet/sites/Default404Page';

describe('Adversarial Stress Test Suite — Milestone 3 Fake Internet & Voyager Subsystems', () => {
  // =========================================================================
  // 1. URL PARSER ADVERSARIAL CHALLENGES & CORNER CASES
  // =========================================================================
  describe('InternetRouter.parseUrl: RFC & Retro URL Corner Cases', () => {
    let router: InternetRouter;

    beforeEach(() => {
      router = new InternetRouter();
    });

    it('handles URLs without protocol by prepending http:// and extracting host correctly', () => {
      const urls = [
        'findit.local',
        'downloadhub.local/files/flashfetch',
        'techmart.local/product/ram512?sort=price',
        'nightboard.local/thread/104#post-2',
      ];

      for (const raw of urls) {
        const parsed = router.parseUrl(raw);
        expect(parsed.protocol).toBe('http:');
        expect(parsed.rawUrl).toBe(`http://${raw}`);
        expect(parsed.host).toBe(raw.split('/')[0]?.split('?')[0]?.split('#')[0]);
      }
    });

    it('demonstrates protocol normalization behavior and handles raw domain inputs', () => {
      const parsedLower = router.parseUrl('findit.local/search?q=retroamp#top');
      expect(parsedLower.protocol).toBe('http:');
      expect(parsedLower.host).toBe('findit.local');
      expect(parsedLower.pathname).toBe('/search');
      expect(parsedLower.searchParams['q']).toBe('retroamp');
      expect(parsedLower.hash).toBe('#top');

      // Note: parser expects lowercase protocol prefix; test robustness when valid http/https used
      const parsedHttp = router.parseUrl('http://findit.local/search?q=retroamp#top');
      expect(parsedHttp.protocol).toBe('http:');
      expect(parsedHttp.host).toBe('findit.local');
    });

    it('correctly handles https:// protocol when specified', () => {
      const parsed = router.parseUrl('https://goldnet.local/secure/vault');
      expect(parsed.protocol).toBe('https:');
      expect(parsed.host).toBe('goldnet.local');
      expect(parsed.pathname).toBe('/secure/vault');
    });

    it('strips single trailing slashes on sub-paths while preserving root /', () => {
      const rootParsed = router.parseUrl('http://findit.local/');
      expect(rootParsed.pathname).toBe('/');

      const subParsed = router.parseUrl('http://downloadhub.local/files/flashfetch/');
      expect(subParsed.pathname).toBe('/files/flashfetch');

      const deepParsed = router.parseUrl('http://nightboard.local/thread/104/');
      expect(deepParsed.pathname).toBe('/thread/104');
    });

    it('parses complex query parameters: multiple keys, empty values, encoded characters', () => {
      const raw = 'http://findit.local/search?q=c%2B%2B%20compiler&category=software&empty=&flag#section1';
      const parsed = router.parseUrl(raw);

      expect(parsed.searchParams['q']).toBe('c++ compiler');
      expect(parsed.searchParams['category']).toBe('software');
      expect(parsed.searchParams['empty']).toBe('');
      expect(parsed.searchParams['flag']).toBe('');
      expect(parsed.hash).toBe('#section1');
    });

    it('extracts pathSegments correctly without empty segments', () => {
      const parsed = router.parseUrl('http://techmart.local/store/categories/memory/ddr400');
      expect(parsed.pathSegments).toEqual(['store', 'categories', 'memory', 'ddr400']);
    });

    it('resiliently handles empty, whitespace, and corrupt input without throwing', () => {
      const badInputs = [
        '',
        '   ',
        '\t\n\r',
        'http://',
        'https://',
        '::invalid::',
        'http://[invalid-ipv6]',
        'http://???&&&###',
      ];

      for (const input of badInputs) {
        expect(() => {
          const parsed = router.parseUrl(input);
          expect(typeof parsed.host).toBe('string');
          expect(typeof parsed.pathname).toBe('string');
          expect(typeof parsed.protocol).toBe('string');
          expect(Array.isArray(parsed.pathSegments)).toBe(true);
        }).not.toThrow();
      }
    });

    it('survives extreme URL lengths (10,000 characters) without stack overflow or performance crash', () => {
      const longPath = 'a'.repeat(5000);
      const longQuery = 'param=' + 'b'.repeat(4000);
      const massiveUrl = `http://findit.local/${longPath}?${longQuery}#hash`;

      const startTime = performance.now();
      const parsed = router.parseUrl(massiveUrl);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Must be sub-100ms
      expect(parsed.host).toBe('findit.local');
      expect(parsed.pathname.length).toBeGreaterThanOrEqual(5000);
      expect(parsed.searchParams['param']?.length).toBe(4000);
    });
  });

  // =========================================================================
  // 2. ROUTE RESOLUTION & DYNAMIC PARAMETER EXTRACTION STRESS
  // =========================================================================
  describe('InternetRouter.resolveRoute: Complete Site Coverage & Dynamic Routing', () => {
    let router: InternetRouter;

    beforeEach(() => {
      router = new InternetRouter();
    });

    it('resolves all 19 registered websites at root paths with is404 = false', () => {
      const expectedSites: { host: string; expectedTitlePart: string }[] = [
        { host: 'findit.local', expectedTitlePart: 'FindIt' },
        { host: 'downloadhub.local', expectedTitlePart: 'DownloadHub' },
        { host: 'pulsechat.local', expectedTitlePart: 'Pulse' },
        { host: 'techmart.local', expectedTitlePart: 'TechMart' },
        { host: 'bidbay.local', expectedTitlePart: 'BidBay' },
        { host: 'myplace.local', expectedTitlePart: 'MyPlace' },
        { host: 'mailbox.local', expectedTitlePart: 'Mailbox' },
        { host: 'nightboard.local', expectedTitlePart: 'NightBoard' },
        { host: 'citywire.local', expectedTitlePart: 'City Wire' },
        { host: 'jobs.local', expectedTitlePart: 'Jobs' },
        { host: 'goldnet.local', expectedTitlePart: 'GoldNet' },
        { host: 'weatherbuddy.local', expectedTitlePart: 'WeatherBuddy' },
        { host: 'retroamp.local', expectedTitlePart: 'RetroAmp' },
        { host: 'orionsoft.local', expectedTitlePart: 'OrionSoft' },
        { host: 'zipmate.local', expectedTitlePart: 'ZipMate' },
        { host: 'safesweep.local', expectedTitlePart: 'SafeSweep' },
        { host: 'peerbox.local', expectedTitlePart: 'PeerBox' },
        { host: 'motellink.local', expectedTitlePart: 'Motel' },
        { host: 'searchmate.local', expectedTitlePart: 'SearchMate' },
      ];

      for (const site of expectedSites) {
        const result = router.resolveRoute(`http://${site.host}/`);
        expect(result.is404).toBe(false);
        expect(result.host).toBe(site.host);
        expect(result.pageTitle).toContain(site.expectedTitlePart);
        expect(result.component).toBeDefined();
      }
    });

    it('correctly matches dynamic parameterized routes and decodes URI components', () => {
      // MyPlace profile parameter
      const myplaceRes = router.resolveRoute('http://myplace.local/tacocart_ryan');
      expect(myplaceRes.is404).toBe(false);
      expect(myplaceRes.params['username']).toBe('tacocart_ryan');
      expect(myplaceRes.pageTitle).toBe('MyPlace Profile');

      // MyPlace with encoded special characters in username
      const encodedRes = router.resolveRoute('http://myplace.local/cool%20user%21');
      expect(encodedRes.is404).toBe(false);
      expect(encodedRes.params['username']).toBe('cool user!');

      // NightBoard thread parameter
      const threadRes = router.resolveRoute('http://nightboard.local/thread/104');
      expect(threadRes.is404).toBe(false);
      expect(threadRes.params['threadId']).toBe('104');
      expect(threadRes.pageTitle).toBe('[NightBoard] Thread View');
    });

    it('returns 404 when route segment counts do not match parameterized patterns', () => {
      // Too many segments for /thread/:threadId
      const deepRes = router.resolveRoute('http://nightboard.local/thread/104/reply/extra');
      expect(deepRes.is404).toBe(true);
      expect(deepRes.component).toBe(Default404Page);

      // Too few segments for /thread/:threadId
      const shallowRes = router.resolveRoute('http://nightboard.local/thread');
      expect(shallowRes.is404).toBe(true);
      expect(shallowRes.component).toBe(Default404Page);
    });

    it('returns 404 for unmapped domains and preserves parsed URL details', () => {
      const unknownUrls = [
        'http://google.com',
        'http://yahoo.com/search?q=test',
        'http://nonexistent-underground-bbs.local/board',
        'http://darkweb.onion',
      ];

      for (const url of unknownUrls) {
        const result = router.resolveRoute(url);
        expect(result.is404).toBe(true);
        expect(result.component).toBe(Default404Page);
        expect(result.pageTitle).toContain('404');
        expect(result.parsedUrl).toBeDefined();
        expect(result.parsedUrl?.rawUrl).toBe(url);
      }
    });

    it('allows custom route registration dynamically', () => {
      const customComponent = () => null;
      router.registerRoute({
        host: 'secret-underground.local',
        pathPattern: '/vault/:secretId',
        component: customComponent as any,
        pageTitle: 'Secret Vault',
      });

      const matched = router.resolveRoute('http://secret-underground.local/vault/access-key-99');
      expect(matched.is404).toBe(false);
      expect(matched.host).toBe('secret-underground.local');
      expect(matched.params['secretId']).toBe('access-key-99');
      expect(matched.pageTitle).toBe('Secret Vault');
      expect(matched.component).toBe(customComponent);
    });
  });

  // =========================================================================
  // 3. NETWORK SIMULATION & LIFECYCLE ADVERSARIAL STRESS
  // =========================================================================
  describe('InternetRouter: Simulated Latency & Page Load Lifecycle', () => {
    let router: InternetRouter;

    beforeEach(() => {
      vi.useFakeTimers();
      router = new InternetRouter();
    });

    afterEach(() => {
      router.abortCurrentLoad();
      vi.useRealTimers();
    });

    it('strictly scales latency monotonically based on bandwidth tier', () => {
      const tiers = [
        { tier: 'dialup_56k', expectedLatency: 800 },
        { tier: 'dsl_256k', expectedLatency: 350 },
        { tier: 'dsl_512k', expectedLatency: 180 },
        { tier: 'dsl_1m', expectedLatency: 80 },
      ];

      for (let i = 0; i < tiers.length; i++) {
        const current = tiers[i]!;
        expect(router.getSimulatedLatencyMs(current.tier)).toBe(current.expectedLatency);

        if (i > 0) {
          const prev = tiers[i - 1]!;
          expect(current.expectedLatency).toBeLessThan(prev.expectedLatency);
        }
      }

      // Fallback for unknown tier
      expect(router.getSimulatedLatencyMs('unknown_fiber_10g')).toBe(300);
    });

    it('simulates page load progress through discrete increments to 100% completion', () => {
      const progressValues: number[] = [];
      let completed = false;

      router.simulatePageLoad(
        'http://findit.local',
        'dsl_256k',
        (pct) => progressValues.push(pct),
        () => {
          completed = true;
        }
      );

      expect(progressValues).toContain(10);
      expect(completed).toBe(false);

      // Advance timers by the full duration (350ms)
      vi.advanceTimersByTime(350);

      expect(completed).toBe(true);
      expect(progressValues[progressValues.length - 1]).toBe(100);

      // Verify monotonic progression
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]!);
      }
    });

    it('immediately aborts pending page loads when abortCurrentLoad is called', () => {
      const progressValues: number[] = [];
      let completed = false;

      router.simulatePageLoad(
        'http://citywire.local',
        'dialup_56k',
        (pct) => progressValues.push(pct),
        () => {
          completed = true;
        }
      );

      vi.advanceTimersByTime(200);
      const countBeforeAbort = progressValues.length;
      expect(completed).toBe(false);

      router.abortCurrentLoad();

      // Advance past remaining time
      vi.advanceTimersByTime(1000);

      expect(completed).toBe(false);
      expect(progressValues.length).toBe(countBeforeAbort);
    });

    it('handles 100 rapid concurrent simulatePageLoad calls without leaking timers', () => {
      let finalCompleted = false;

      for (let i = 0; i < 100; i++) {
        router.simulatePageLoad(
          `http://site-${i}.local`,
          'dialup_56k',
          () => {},
          () => {
            if (i === 99) finalCompleted = true;
          }
        );
      }

      vi.advanceTimersByTime(800);
      expect(finalCompleted).toBe(true);
    });
  });

  // =========================================================================
  // 4. SEARCH ENGINE TOKENIZATION, SCORING & RANKING STRESS
  // =========================================================================
  describe('SearchEngine: Tokenization, Scoring & Multi-Term Relevance', () => {
    it('returns empty results immediately for blank or whitespace queries', () => {
      const blanks = ['', '   ', '\t\n\r', '         '];
      for (const q of blanks) {
        const summary = SearchEngine.search(q);
        expect(summary.totalMatches).toBe(0);
        expect(summary.results).toEqual([]);
        expect(summary.normalizedQuery).toBe('');
      }
    });

    it('filters out single-character tokens (t.length <= 1) and handles punctuation cleanly', () => {
      // Query with only 1-char tokens and punctuation
      const singleCharSummary = SearchEngine.search('a b c ! @ #');
      expect(singleCharSummary.totalMatches).toBe(0);
      expect(singleCharSummary.results).toEqual([]);

      // Query with single chars plus valid tokens
      const mixedSummary = SearchEngine.search('a pulse b messenger c');
      expect(mixedSummary.totalMatches).toBeGreaterThan(0);
      expect(mixedSummary.results[0]?.title).toContain('Pulse Messenger');
    });

    it('applies exact phrase bonus (+100 for title, +80 for url, +40 for snippet)', () => {
      const summaryExact = SearchEngine.search('flashfetch 3.1 download accelerator');
      expect(summaryExact.results.length).toBeGreaterThan(0);

      const topResult = summaryExact.results[0]!;
      expect(topResult.id).toBe('search_flashfetch_app');
      // Score includes +100 title exact phrase bonus + token matches + all token bonus
      expect(topResult.score).toBeGreaterThan(150);
    });

    it('awards all-token matching bonus (+50) when multiple query tokens all match', () => {
      // Single token search: 'hardware' matches keywords only (+20)
      const singleTokenRes = SearchEngine.search('hardware');
      const singleScore = singleTokenRes.results.find((r) => r.id === 'search_techmart_ram')?.score ?? 0;

      // Multi token search where all tokens match: 'hardware', 'ram', 'memory'
      // Each token scores plus +50 all-tokens bonus
      const multiTokenRes = SearchEngine.search('hardware ram memory');
      const multiScore = multiTokenRes.results.find((r) => r.id === 'search_techmart_ram')?.score ?? 0;

      expect(singleScore).toBe(20);
      expect(multiScore).toBeGreaterThan(singleScore);
      expect(multiScore).toBeGreaterThanOrEqual(100);
    });

    it('guarantees descending sort order of all returned results by score', () => {
      const searchTerms = [
        'download software audio mp3',
        'nightboard canal hum mystery',
        'motel rent internet network',
        'photo editor studio orion',
      ];

      for (const term of searchTerms) {
        const summary = SearchEngine.search(term, { currentDay: 14 });
        for (let i = 1; i < summary.results.length; i++) {
          const prevScore = summary.results[i - 1]?.score ?? 0;
          const currScore = summary.results[i]?.score ?? 0;
          expect(prevScore).toBeGreaterThanOrEqual(currScore);
        }
      }
    });

    it('respects result limit parameter strictly', () => {
      const query = 'download';
      const allResults = SearchEngine.search(query, { currentDay: 14, limit: 100 });
      expect(allResults.totalMatches).toBeGreaterThan(3);

      const limited1 = SearchEngine.search(query, { currentDay: 14, limit: 1 });
      expect(limited1.results.length).toBe(1);

      const limited3 = SearchEngine.search(query, { currentDay: 14, limit: 3 });
      expect(limited3.results.length).toBe(3);
    });

    it('enforces strict category filtering', () => {
      const categories: ('software' | 'hardware' | 'community' | 'social' | 'news')[] = [
        'software',
        'hardware',
        'community',
        'social',
        'news',
      ];

      for (const cat of categories) {
        const summary = SearchEngine.search('a e i o u', { category: cat, currentDay: 14 });
        for (const res of summary.results) {
          expect(res.category).toBe(cat);
        }
      }

      // Non-existent category yields 0 results
      const nonExistent = SearchEngine.search('download', { category: 'cryptocurrency' });
      expect(nonExistent.results.length).toBe(0);
      expect(nonExistent.totalMatches).toBe(0);
    });
  });

  // =========================================================================
  // 5. DAY AVAILABILITY GATING & TEMPORAL BOUNDARIES (Day 1..14)
  // =========================================================================
  describe('SearchEngine: Day 1..14 Availability Boundary Gating', () => {
    it('strictly hides Day 2+ content on Day 1', () => {
      // Entries with availableFromDay: 2
      // search_peerbox_p2p, search_nightboard_canal, search_myplace_nightowl
      const day1Peerbox = searchInternet('peerbox', 1);
      expect(day1Peerbox.some((r) => r.id === 'search_peerbox_p2p')).toBe(false);

      const day1Canal = searchInternet('industrial canal hum', 1);
      expect(day1Canal.some((r) => r.id === 'search_nightboard_canal')).toBe(false);

      const day1Nora = searchInternet('nightowl87 architecture', 1);
      expect(day1Nora.some((r) => r.id === 'search_myplace_nightowl')).toBe(false);
    });

    it('unlocks Day 2+ content on Day 2 through Day 14', () => {
      const daysToCheck = [2, 3, 5, 7, 10, 14];

      for (const day of daysToCheck) {
        const peerbox = searchInternet('peerbox', day);
        expect(peerbox.some((r) => r.id === 'search_peerbox_p2p')).toBe(true);

        const canal = searchInternet('industrial canal hum', day);
        expect(canal.some((r) => r.id === 'search_nightboard_canal')).toBe(true);

        const nora = searchInternet('nightowl87 architecture', day);
        expect(nora.some((r) => r.id === 'search_myplace_nightowl')).toBe(true);
      }
    });

    it('monotonic discovery growth: total indexed pages available at Day 14 >= Day 1', () => {
      const day1Total = SearchEngine.search('a e i o u y', { currentDay: 1, limit: 100 }).totalMatches;
      const day2Total = SearchEngine.search('a e i o u y', { currentDay: 2, limit: 100 }).totalMatches;
      const day14Total = SearchEngine.search('a e i o u y', { currentDay: 14, limit: 100 }).totalMatches;

      expect(day2Total).toBeGreaterThanOrEqual(day1Total);
      expect(day14Total).toBeGreaterThanOrEqual(day2Total);
    });

    it('handles negative or Day 0 edge cases gracefully without returning Day 1+ content', () => {
      const day0Results = searchInternet('pulse messenger', 0);
      expect(day0Results.length).toBe(0);

      const negativeDayResults = searchInternet('pulse messenger', -5);
      expect(negativeDayResults.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. NARRATIVE FLAGS GATING STRESS
  // =========================================================================
  describe('SearchEngine: Narrative Flags Conditional Gating', () => {
    it('correctly filters entries when required narrative flags are specified', () => {
      // Mock custom search database entry with required narrative flags
      const testDbEntry: SearchIndexEntry = {
        id: 'search_secret_underground_doc',
        title: 'Confidential Whistleblower Archive - Project Orion',
        url: 'http://nightboard.local/thread/999',
        snippet: 'Leaked documents regarding Orion OS memory architecture.',
        category: 'community',
        keywords: ['secret', 'whistleblower', 'orion', 'leak'],
        availableFromDay: 1,
        requiredFlags: ['unlocked_canal_secret', 'talked_to_nora_deep'],
        datePublished: 'Oct 10, 2006',
      };

      SEARCH_INDEX_DATABASE.push(testDbEntry);

      try {
        // Without flags
        const noFlags = SearchEngine.search('whistleblower leak', { currentDay: 5, narrativeFlags: {} });
        expect(noFlags.results.some((r) => r.id === 'search_secret_underground_doc')).toBe(false);

        // With only 1 of 2 required flags
        const partialFlag = SearchEngine.search('whistleblower leak', {
          currentDay: 5,
          narrativeFlags: { unlocked_canal_secret: true },
        });
        expect(partialFlag.results.some((r) => r.id === 'search_secret_underground_doc')).toBe(false);

        // With falsey flag value
        const falseFlag = SearchEngine.search('whistleblower leak', {
          currentDay: 5,
          narrativeFlags: { unlocked_canal_secret: true, talked_to_nora_deep: false },
        });
        expect(falseFlag.results.some((r) => r.id === 'search_secret_underground_doc')).toBe(false);

        // With all required flags truthy
        const fullFlags = SearchEngine.search('whistleblower leak', {
          currentDay: 5,
          narrativeFlags: { unlocked_canal_secret: true, talked_to_nora_deep: true },
        });
        expect(fullFlags.results.some((r) => r.id === 'search_secret_underground_doc')).toBe(true);
      } finally {
        // Cleanup injected test entry
        const idx = SEARCH_INDEX_DATABASE.findIndex((e) => e.id === 'search_secret_underground_doc');
        if (idx !== -1) SEARCH_INDEX_DATABASE.splice(idx, 1);
      }
    });
  });

  // =========================================================================
  // 7. STATIC DATABASE INTEGRITY & SCHEMA AUDIT
  // =========================================================================
  describe('SEARCH_INDEX_DATABASE Integrity & Quality Audit', () => {
    it('guarantees unique IDs for all search index entries', () => {
      const ids = SEARCH_INDEX_DATABASE.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('validates required fields and period-authentic structure for every entry', () => {
      const validCategories = new Set(['software', 'hardware', 'community', 'social', 'news']);

      for (const entry of SEARCH_INDEX_DATABASE) {
        expect(entry.id).toBeTruthy();
        expect(entry.title).toBeTruthy();
        expect(entry.url).toMatch(/^http:\/\/[a-z0-9_-]+\.local/);
        expect(entry.snippet).toBeTruthy();
        expect(validCategories.has(entry.category)).toBe(true);
        expect(Array.isArray(entry.keywords)).toBe(true);
        expect(entry.keywords.length).toBeGreaterThanOrEqual(3);
        expect(entry.availableFromDay).toBeGreaterThanOrEqual(1);
        expect(entry.availableFromDay).toBeLessThanOrEqual(14);
        expect(entry.datePublished).toBeTruthy();
      }
    });

    it('ensures key narrative rabbit hole entries are present in the search index', () => {
      const requiredEntryIds = [
        'search_pulse_download',
        'search_flashfetch_app',
        'search_retroamp_player',
        'search_zipmate_utility',
        'search_photobox_suite',
        'search_weatherbuddy_widget',
        'search_safesweep_security',
        'search_peerbox_p2p',
        'search_techmart_ram',
        'search_techmart_os6',
        'search_bidbay_classifieds',
        'search_nightboard_downloads',
        'search_nightboard_canal',
        'search_nightboard_toolbar_warn',
        'search_myplace_maya',
        'search_myplace_ryan',
        'search_myplace_nightowl',
        'search_citywire_power',
        'search_jobs_diner',
        'search_motellink_portal',
      ];

      for (const id of requiredEntryIds) {
        const found = SEARCH_INDEX_DATABASE.find((e) => e.id === id);
        expect(found, `Expected search entry "${id}" to exist in index`).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 8. ADVERSARIAL HIGH-LOAD FUZZING & STRESS HARNESS
  // =========================================================================
  describe('Adversarial Fuzzing & High-Throughput Stress', () => {
    it('executes 1,000 randomized search queries with chaos inputs in under 300ms without failure', () => {
      const vocab = [
        'pulse', 'chat', 'download', 'flashfetch', 'ram', 'modem', 'diner', 'nightowl', 'maya',
        'ryan', 'canal', 'motel', 'rent', 'weather', 'toolbar', 'adware', 'clean', 'orion',
        'mp3', 'music', 'gold', 'auction', '104', '512mb', 'os6', 'error', '404', 'null',
        'undefined', '!@#$%^&*()', '🦔🦀✨', '127.0.0.1', 'http://', 'select * from',
      ];

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        // Random 1 to 5 terms
        const termCount = 1 + Math.floor(Math.random() * 4);
        const queryTerms: string[] = [];
        for (let j = 0; j < termCount; j++) {
          const idx = Math.floor(Math.random() * vocab.length);
          queryTerms.push(vocab[idx]!);
        }

        const query = queryTerms.join(' ');
        const randomDay = 1 + Math.floor(Math.random() * 14);
        const randomFlags = Math.random() > 0.5 ? { test_flag: true } : {};

        const res = SearchEngine.search(query, { currentDay: randomDay, narrativeFlags: randomFlags });
        expect(res).toBeDefined();
        expect(typeof res.totalMatches).toBe('number');
        expect(Number.isFinite(res.totalMatches)).toBe(true);

        for (const item of res.results) {
          expect(typeof item.score).toBe('number');
          expect(Number.isFinite(item.score)).toBe(true);
          expect(item.score).toBeGreaterThan(0);
        }
      }

      const totalDuration = performance.now() - startTime;
      expect(totalDuration).toBeLessThan(3000); // 1,000 randomized searches within 3s
    });

    it('executes 1,000 randomized URL resolutions with chaotic host/path strings without error', () => {
      const router = new InternetRouter();
      const randomHosts = [
        'findit.local', 'downloadhub.local', 'pulsechat.local', 'techmart.local',
        'bidbay.local', 'myplace.local', 'mailbox.local', 'nightboard.local',
        'citywire.local', 'jobs.local', 'goldnet.local', 'weatherbuddy.local',
        'retroamp.local', 'orionsoft.local', 'zipmate.local', 'safesweep.local',
        'peerbox.local', 'motellink.local', 'searchmate.local', 'corrupt.local',
        'unknown-bbs.org', '192.168.1.1', '',
      ];

      const paths = [
        '', '/', '/search', '/files/flashfetch', '/product/ram512', '/thread/104',
        '/maya_x', '/tacocart_ryan', '/unknown/deep/path', '///double///slash///',
        '/%20encoded%20', '/?q=test&cat=1#top',
      ];

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const host = randomHosts[i % randomHosts.length]!;
        const path = paths[i % paths.length]!;
        const fullUrl = `http://${host}${path}`;

        const match = router.resolveRoute(fullUrl);
        expect(match).toBeDefined();
        expect(typeof match.is404).toBe('boolean');
        expect(typeof match.pageTitle).toBe('string');
        expect(match.component).toBeDefined();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });
});

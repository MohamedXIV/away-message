import { ParsedUrl, RouteMatchResult, SiteRouteDefinition } from './types';
import { Default404Page } from './sites/Default404Page';
import { FindItSite } from './sites/FindItSite';
import { DownloadHubSite } from './sites/DownloadHubSite';
import { PulseChatSite } from './sites/PulseChatSite';
import { PulseWebSite } from './sites/PulseWebSite';
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

export class InternetRouter {
  private routes: SiteRouteDefinition[] = [];
  private activeLoadTimer: NodeJS.Timeout | null = null;
  private activeIntervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.registerDefaultRoutes();
  }

  public registerRoute(route: SiteRouteDefinition): void {
    this.routes.push(route);
  }

  public parseUrl(rawUrl: string): ParsedUrl {
    let normalized = (rawUrl || '').trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `http://${normalized}`;
    }

    try {
      const urlObj = new URL(normalized);
      const host = urlObj.hostname.toLowerCase();
      let pathname = urlObj.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }

      const searchParams: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        searchParams[key] = value;
      });

      const protocol: 'http:' | 'https:' = urlObj.protocol === 'https:' ? 'https:' : 'http:';
      const pathSegments = pathname.split('/').filter(Boolean);

      return {
        rawUrl: normalized,
        normalizedUrl: normalized,
        protocol,
        host,
        pathname: pathname || '/',
        pathSegments,
        searchParams,
        hash: urlObj.hash || '',
      };
    } catch {
      const cleanHost = normalized.replace(/^https?:\/\//, '').split('/')[0] || 'unknown';
      return {
        rawUrl: normalized,
        normalizedUrl: normalized,
        protocol: 'http:',
        host: cleanHost,
        pathname: '/',
        pathSegments: [],
        searchParams: {},
        hash: '',
      };
    }
  }

  public resolveRoute(rawUrl: string): RouteMatchResult {
    const parsed = this.parseUrl(rawUrl);

    for (const def of this.routes) {
      if (def.host.toLowerCase() !== parsed.host) {
        continue;
      }

      // Check path match and param extraction
      const match = this.matchPathPattern(def.pathPattern, parsed.pathname);
      if (match.isMatch) {
        return {
          host: def.host,
          pathname: parsed.pathname,
          params: match.params,
          component: def.component,
          pageTitle: def.pageTitle,
          parsedUrl: parsed,
          routeParams: match.params,
          is404: false,
        };
      }
    }

    // Default 404 Route
    return {
      host: parsed.host,
      pathname: parsed.pathname,
      params: {},
      component: Default404Page,
      pageTitle: '404 Not Found - Voyager Browser',
      parsedUrl: parsed,
      routeParams: {},
      is404: true,
    };
  }

  private matchPathPattern(
    pattern: string,
    actualPath: string
  ): { isMatch: boolean; params: Record<string, string> } {
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actualPath.split('/').filter(Boolean);

    if (patternParts.length !== actualParts.length) {
      return { isMatch: false, params: {} };
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i++) {
      const pPart = patternParts[i] || '';
      const aPart = actualParts[i] || '';

      if (pPart.startsWith(':')) {
        const paramName = pPart.slice(1);
        params[paramName] = decodeURIComponent(aPart);
      } else if (pPart.toLowerCase() !== aPart.toLowerCase()) {
        return { isMatch: false, params: {} };
      }
    }

    return { isMatch: true, params };
  }

  public getSimulatedLatencyMs(connectionType: string): number {
    switch (connectionType) {
      case 'dialup_56k':
        return 800;
      case 'dsl_256k':
        return 350;
      case 'dsl_512k':
        return 180;
      case 'dsl_1m':
        return 80;
      default:
        return 300;
    }
  }

  public simulatePageLoad(
    _targetUrl: string,
    connectionType: string,
    onProgress: (percent: number) => void,
    onComplete: () => void
  ): void {
    this.abortCurrentLoad();

    const totalDuration = this.getSimulatedLatencyMs(connectionType);
    const steps = 10;
    const stepDuration = totalDuration / steps;
    let currentStep = 0;

    onProgress(10);

    this.activeIntervalTimer = setInterval(() => {
      currentStep++;
      const pct = Math.min(95, Math.round((currentStep / steps) * 100));
      onProgress(pct);

      if (currentStep >= steps) {
        if (this.activeIntervalTimer) clearInterval(this.activeIntervalTimer);
        this.activeIntervalTimer = null;
        onProgress(100);
        onComplete();
      }
    }, stepDuration);
  }

  public abortCurrentLoad(): void {
    if (this.activeIntervalTimer) {
      clearInterval(this.activeIntervalTimer);
      this.activeIntervalTimer = null;
    }
    if (this.activeLoadTimer) {
      clearTimeout(this.activeLoadTimer);
      this.activeLoadTimer = null;
    }
  }

  private registerDefaultRoutes(): void {
    // 1. FindIt Search Portal
    this.registerRoute({
      host: 'findit.local',
      pathPattern: '/',
      component: FindItSite,
      pageTitle: 'FindIt Web Search',
    });

    // 2. DownloadHub Software Repository
    this.registerRoute({
      host: 'downloadhub.local',
      pathPattern: '/',
      component: DownloadHubSite,
      pageTitle: 'DownloadHub.local — Software Archive',
    });

    // 3. PulseChat Web Portal
    this.registerRoute({
      host: 'pulsechat.local',
      pathPattern: '/',
      component: PulseChatSite,
      pageTitle: 'Pulse Messenger — Stay Connected',
    });

    // 3b. Pulse Web Client (full messenger in the browser, same live session)
    this.registerRoute({
      host: 'pulse.local',
      pathPattern: '/',
      component: PulseWebSite,
      pageTitle: 'Pulse Web Messenger',
    });

    // 4. TechMart Direct
    this.registerRoute({
      host: 'techmart.local',
      pathPattern: '/',
      component: TechMartSite,
      pageTitle: 'TechMart Direct 2006 — Hardware & Modems',
    });

    // 5. BidBay Auctions
    this.registerRoute({
      host: 'bidbay.local',
      pathPattern: '/',
      component: BidBaySite,
      pageTitle: 'BidBay: Online Auctions & Marketplace',
    });

    // 6. MyPlace Social Networking
    this.registerRoute({
      host: 'myplace.local',
      pathPattern: '/',
      component: MyPlaceSite,
      pageTitle: 'MyPlace.local — A Place for Friends',
    });
    this.registerRoute({
      host: 'myplace.local',
      pathPattern: '/:username',
      component: MyPlaceSite,
      pageTitle: 'MyPlace Profile',
    });

    // 7. Mailbox.local Webmail
    this.registerRoute({
      host: 'mailbox.local',
      pathPattern: '/',
      component: MailboxSite,
      pageTitle: 'Mailbox.local Webmail',
    });

    // 8. NightBoard Anonymous Textboard
    this.registerRoute({
      host: 'nightboard.local',
      pathPattern: '/',
      component: NightBoardSite,
      pageTitle: '[NightBoard] Anonymous Underground Textboard',
    });
    this.registerRoute({
      host: 'nightboard.local',
      pathPattern: '/thread/:threadId',
      component: NightBoardSite,
      pageTitle: '[NightBoard] Thread View',
    });

    // 9. The City Wire
    this.registerRoute({
      host: 'citywire.local',
      pathPattern: '/',
      component: CityWireSite,
      pageTitle: 'The City Wire — Oakhaven District Edition',
    });

    // 10. Jobs.local Classifieds
    this.registerRoute({
      host: 'jobs.local',
      pathPattern: '/',
      component: JobsSite,
      pageTitle: 'Jobs.local Classifieds',
    });

    // 11. GoldNet Financial
    this.registerRoute({
      host: 'goldnet.local',
      pathPattern: '/',
      component: GoldNetSite,
      pageTitle: 'GoldNet Financial Banking',
    });

    // 12. WeatherBuddy Portal
    this.registerRoute({
      host: 'weatherbuddy.local',
      pathPattern: '/',
      component: WeatherBuddySite,
      pageTitle: 'WeatherBuddy 3.1 Portal',
    });

    // 13. RetroAmp Audio Player
    this.registerRoute({
      host: 'retroamp.local',
      pathPattern: '/',
      component: RetroAmpSite,
      pageTitle: 'RetroAmp Audio Player',
    });

    // 14. OrionSoft Systems Corporation
    this.registerRoute({
      host: 'orionsoft.local',
      pathPattern: '/',
      component: OrionSoftSite,
      pageTitle: 'OrionSoft Systems Corporation',
    });

    // 15. ZipMate Archive Manager
    this.registerRoute({
      host: 'zipmate.local',
      pathPattern: '/',
      component: ZipMateSite,
      pageTitle: 'ZipMate Archive Manager',
    });

    // 16. SafeSweep Anti-Spyware
    this.registerRoute({
      host: 'safesweep.local',
      pathPattern: '/',
      component: SafeSweepSite,
      pageTitle: 'SafeSweep Anti-Spyware 2006',
    });

    // 17. PeerBox P2P Swarm
    this.registerRoute({
      host: 'peerbox.local',
      pathPattern: '/',
      component: PeerBoxSite,
      pageTitle: 'PeerBox P2P Swarm Network',
    });

    // 18. Starlite Motel Link
    this.registerRoute({
      host: 'motellink.local',
      pathPattern: '/',
      component: MotelLinkSite,
      pageTitle: 'Starlite Motel Guest Network',
    });

    // 19. SearchMate Smart Portal
    this.registerRoute({
      host: 'searchmate.local',
      pathPattern: '/',
      component: SearchMateSite,
      pageTitle: 'SearchMate™ Search Portal',
    });
  }
}

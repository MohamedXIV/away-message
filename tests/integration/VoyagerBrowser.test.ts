import { describe, it, expect, beforeEach } from 'vitest';
import { InternetRouter } from '../../src/internet/InternetRouter';
import { searchInternet } from '../../src/internet/searchIndex';

describe('Voyager Browser & Fake Internet Subsystem Integration Suite', () => {
  let router: InternetRouter;

  beforeEach(() => {
    router = new InternetRouter();
  });

  it('routes correctly across all 20 period-authentic web properties', () => {
    const siteHosts = [
      'findit.local',
      'downloadhub.local',
      'pulsechat.local',
      'techmart.local',
      'bidbay.local',
      'myplace.local',
      'mailbox.local',
      'nightboard.local',
      'citywire.local',
      'jobs.local',
      'goldnet.local',
      'weatherbuddy.local',
      'retroamp.local',
      'orionsoft.local',
      'zipmate.local',
      'safesweep.local',
      'peerbox.local',
      'motellink.local',
      'searchmate.local',
    ];

    siteHosts.forEach((host) => {
      const match = router.resolveRoute(host);
      expect(match.is404).toBe(false);
      expect(match.component).toBeDefined();
    });
  });

  it('simulates page loading with progress steps matching connection speed', async () => {
    const progressHistory: number[] = [];

    await new Promise<void>((resolve) => {
      router.simulatePageLoad(
        'techmart.local',
        'dsl_1m',
        (pct) => {
          progressHistory.push(pct);
        },
        () => {
          resolve();
        }
      );
    });

    expect(progressHistory.length).toBeGreaterThanOrEqual(5);
    expect(progressHistory[progressHistory.length - 1]).toBe(100);
  });

  it('integrates search engine indexing with browser URL resolution', () => {
    const searchHits = searchInternet('mp3 audio player', 1, {});
    expect(searchHits.length).toBeGreaterThan(0);

    const firstHit = searchHits[0];
    expect(firstHit).toBeDefined();
    if (firstHit) {
      const routeRes = router.resolveRoute(firstHit.url);
      expect(routeRes.is404).toBe(false);
    }
  });
});

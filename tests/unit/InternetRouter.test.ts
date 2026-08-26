import { describe, it, expect, beforeEach } from 'vitest';
import { InternetRouter } from '../../src/internet/InternetRouter';

describe('InternetRouter Unit Test Suite', () => {
  let router: InternetRouter;

  beforeEach(() => {
    router = new InternetRouter();
  });

  it('correctly parses raw URLs with protocol, hostname, path, and query params', () => {
    const parsed = router.parseUrl('http://searchmate.local/search?q=soundcard&category=hardware#top');
    expect(parsed.host).toBe('searchmate.local');
    expect(parsed.pathname).toBe('/search');
    expect(parsed.searchParams['q']).toBe('soundcard');
    expect(parsed.searchParams['category']).toBe('hardware');
    expect(parsed.protocol).toBe('http:');
    expect(parsed.hash).toBe('#top');
  });

  it('normalizes URLs without explicit protocols', () => {
    const parsed = router.parseUrl('techmart.local/deals');
    expect(parsed.protocol).toBe('http:');
    expect(parsed.host).toBe('techmart.local');
    expect(parsed.pathname).toBe('/deals');
  });

  it('resolves standard registered hosts and pages', () => {
    const resFindIt = router.resolveRoute('findit.local');
    expect(resFindIt.is404).toBe(false);
    expect(resFindIt.host).toBe('findit.local');
    expect(resFindIt.pageTitle).toBe('FindIt Web Search');

    const resDownloadHub = router.resolveRoute('downloadhub.local');
    expect(resDownloadHub.is404).toBe(false);
    expect(resDownloadHub.host).toBe('downloadhub.local');
  });

  it('extracts dynamic route parameters from paths', () => {
    const resMyPlace = router.resolveRoute('myplace.local/tacocart_ryan');
    expect(resMyPlace.is404).toBe(false);
    expect(resMyPlace.host).toBe('myplace.local');
    expect(resMyPlace.params['username']).toBe('tacocart_ryan');

    const resNightBoard = router.resolveRoute('nightboard.local/thread/104');
    expect(resNightBoard.is404).toBe(false);
    expect(resNightBoard.params['threadId']).toBe('104');
  });

  it('falls back to 404 handler on unmapped domain names', () => {
    const resUnknown = router.resolveRoute('nonexistent-site-2006.local');
    expect(resUnknown.is404).toBe(true);
    expect(resUnknown.pageTitle).toContain('404');
  });

  it('calculates simulated network latency based on modem/DSL tier', () => {
    const dialupLatency = router.getSimulatedLatencyMs('dialup_56k');
    const dsl256Latency = router.getSimulatedLatencyMs('dsl_256k');
    const dsl512Latency = router.getSimulatedLatencyMs('dsl_512k');
    const dsl1mLatency = router.getSimulatedLatencyMs('dsl_1m');

    expect(dialupLatency).toBeGreaterThan(dsl256Latency);
    expect(dsl256Latency).toBeGreaterThan(dsl512Latency);
    expect(dsl512Latency).toBeGreaterThan(dsl1mLatency);
    expect(dsl1mLatency).toBe(80);
  });
});

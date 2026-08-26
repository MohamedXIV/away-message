import { describe, it, expect } from 'vitest';
import { searchInternet, SearchEngine } from '../../src/internet/searchIndex';

describe('SearchEngine & SearchIndex Test Suite', () => {
  it('returns matching results for simple keywords', () => {
    const results = searchInternet('pulse messenger', 1, {});
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toContain('Pulse');
  });

  it('ranks results matching keywords and titles higher', () => {
    const results = searchInternet('hardware RAM memory', 1, {});
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.url.includes('techmart.local'))).toBe(true);
  });

  it('respects day availability gating', () => {
    // Search for canal audio recordings available from day 1
    const day1Results = searchInternet('canal audio', 1, {});
    const day3Results = searchInternet('canal audio', 3, {});
    expect(day3Results.length).toBeGreaterThanOrEqual(day1Results.length);
  });

  it('respects narrative flag requirements', () => {
    const withoutFlag = SearchEngine.search('diner', { currentDay: 1, narrativeFlags: {} }).results;
    const withFlag = SearchEngine.search('diner', { currentDay: 1, narrativeFlags: { talked_to_maya: true } }).results;
    expect(withFlag.length).toBeGreaterThanOrEqual(withoutFlag.length);
  });

  it('handles empty or whitespace-only queries gracefully', () => {
    const emptyResults = searchInternet('   ', 1, {});
    expect(emptyResults).toEqual([]);
  });
});

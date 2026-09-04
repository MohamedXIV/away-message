import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadPulseAccounts,
  checkPulseCredentials,
  signUpPulseAccount,
  findPulseAccount,
  loadPulseCredentials,
  savePulseCredentials,
} from '../../src/apps/pulse/persistence';

function stubStorage() {
  let store: Record<string, string> = {};
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => (key in store ? store[key]! : null),
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    },
  });
  return () => { store = {}; };
}

describe('Pulse accounts (sign-up + validation)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts empty, creates on first sign-in, then validates', () => {
    expect(loadPulseAccounts('t1')).toEqual([]);
    const first = checkPulseCredentials([], 'wanderer06', 'secret1', 't1');
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    const again = checkPulseCredentials(first.accounts, 'wanderer06', 'secret1', 't1');
    expect(again.ok).toBe(true);
    expect(again.created).toBe(false);
    expect(checkPulseCredentials(first.accounts, 'wanderer06', 'wrong', 't1').ok).toBe(false);
    expect(checkPulseCredentials(first.accounts, 'wanderer06', '', 't1').ok).toBe(false);
    expect(checkPulseCredentials(first.accounts, '  ', 'x', 't1').ok).toBe(false);
    // IDs match case-insensitively
    expect(findPulseAccount(first.accounts, 'WANDERER06')?.id).toBe('wanderer06');
  });

  it('persists accounts per slot', () => {
    const res = checkPulseCredentials([], 'neo', 'pass123', 'slotA');
    expect(res.ok).toBe(true);
    expect(loadPulseAccounts('slotA').map((a) => a.id)).toEqual(['neo']);
    expect(loadPulseAccounts('slotB')).toEqual([]);
  });

  it('explicit sign-up validates everything', () => {
    const short = signUpPulseAccount([], 'ab', 'pw', 'pw', 't2');
    expect(short.ok).toBe(false);
    const mismatch = signUpPulseAccount([], 'neo2', 'pw1', 'pw2', 't2');
    expect(mismatch.ok).toBe(false);
    expect(mismatch.error).toContain('match');
    const bad = signUpPulseAccount([], 'a b!', 'pw', 'pw', 't2');
    expect(bad.ok).toBe(false);
    const ok = signUpPulseAccount([], 'neo2', 'pw1', 'pw1', 't2');
    expect(ok.ok).toBe(true);
    const taken = signUpPulseAccount(ok.accounts, 'NEO2', 'other', 'other', 't2');
    expect(taken.ok).toBe(false);
    expect(taken.error).toContain('taken');
  });
});

describe('Pulse remembered credentials', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves, loads and clears per slot', () => {
    expect(loadPulseCredentials('s1')).toBeNull();
    savePulseCredentials({ id: 'wanderer06', password: 'secret1', remember: true, autoSign: true }, 's1');
    const loaded = loadPulseCredentials('s1');
    expect(loaded?.id).toBe('wanderer06');
    expect(loaded?.autoSign).toBe(true);
    // Other slots are isolated
    expect(loadPulseCredentials('s2')).toBeNull();
    // Unchecking remember clears
    savePulseCredentials(null, 's1');
    expect(loadPulseCredentials('s1')).toBeNull();
  });
});

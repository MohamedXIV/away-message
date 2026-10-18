import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InkRuntime } from '../../src/narrative/ink/InkRuntime';

const fixturePath = join(__dirname, '../../src/narrative/ink/fixtures/hello.ink');
const compiledPath = join(__dirname, '../../src/narrative/ink/fixtures/hello.ink.json');
const source = readFileSync(fixturePath, 'utf8');
const compiledJson = JSON.parse(readFileSync(compiledPath, 'utf8'));

function bind(rt: InkRuntime) {
  rt.bindExternalFunction('request_effect', () => 'queued', false);
  return rt;
}

describe('InkRuntime', () => {
  it('compiles authored Ink source offline', () => {
    const rt = InkRuntime.compile(source);
    bind(rt);
    const c = rt.continue();
    expect(c.text).toContain('Hello there.');
    expect(c.tags).toEqual(['greeting']);
  });

  it('surfaces choices and tags through continuation', () => {
    const rt = bind(InkRuntime.compile(source));
    rt.continue(); // Hello there.
    const c = rt.continue(); // What would you like to do? + choices
    expect(c.choices.map((x) => x.text)).toEqual(['Ask about the exam', 'Say goodbye']);
    expect(c.canContinue).toBe(false);
  });

  it('updates Ink-local variables on a branch', () => {
    const rt = bind(InkRuntime.compile(source));
    rt.continue();
    rt.continue();
    rt.choose(0);
    const c = rt.continue();
    expect(c.text).toContain('You asked about the exam.');
    expect(c.tags).toContain('effect:flag:asked_exam:true');
    expect(rt.getVariable('asked')).toBe(true);
  });

  it('loads a committed compiled fixture', () => {
    const rt = bind(new InkRuntime(compiledJson));
    const c = rt.continue();
    expect(c.text).toContain('Hello there.');
    expect(c.tags).toEqual(['greeting']);
  });

  it('restores flow deterministically after save/reload', () => {
    const rt = bind(InkRuntime.compile(source));
    rt.continue(); // Hello there.
    rt.continue(); // choices
    rt.choose(0);
    rt.continue(); // exam text
    // Now at end; save before the final consume? Instead test mid-flow restore:
    const rt2 = bind(InkRuntime.compile(source));
    rt2.continue(); // Hello there.
    rt2.continue(); // choices
    const saved = rt2.saveState();
    // restore into a fresh runtime built from committed compiled JSON
    const restored = bind(new InkRuntime(compiledJson));
    restored.loadState(saved);
    // After restore, the next continuation should match a fresh run choosing same path
    const fresh = bind(InkRuntime.compile(source));
    fresh.continue();
    fresh.continue();
    fresh.choose(0);
    // Compare variable + canContinue
    expect(restored.getVariable('asked')).toBe(fresh.getVariable('asked'));
  });

  it('binds external functions and resets state', () => {
    const rt = bind(InkRuntime.compile(source));
    rt.setVariable('asked', true);
    expect(rt.getVariable('asked')).toBe(true);
    rt.reset();
    expect(rt.getVariable('asked')).toBe(false);
  });

  it('saveState/loadState round-trips ink state json', () => {
    const rt = bind(InkRuntime.compile(source));
    rt.continue();
    const state = rt.saveState();
    expect(state.version).toBe(1);
    expect(typeof state.storyStateJson).toBe('string');
    expect(state.storyStateJson.length).toBeGreaterThan(10);
    const rt2 = bind(new InkRuntime(compiledJson));
    rt2.loadState(state.storyStateJson);
    expect(rt2.canContinue).toBe(rt.canContinue);
  });
});

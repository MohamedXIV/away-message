import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * #172 closure boundary: normal React/Phaser consumers must never revive
 * per-revision full-world materialization by importing old Zustand selectors
 * or registering the legacy full-snapshot engine subscription.
 *
 * This intentionally scans actual production source, not the fixture/test
 * tree. Explicit persistence/export and AI Lab's user-triggered dry-run
 * preview remain allowed; they are not normal render subscriptions.
 */
const root = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const oldHotSelectors =
  /\b(?:useGameTime|usePlayerState|useHardwareState|useVfsState|useDownloads|useInstalledSoftware|useSocialState|useWorldState|useNarrativeState|useTelemetryStats)\s*\(/g;

describe('#172 normal UI bounded-publication regression gate', () => {
  it('keeps live React and Phaser presentation off legacy hot snapshot selectors', () => {
    const files = walk(root).filter(path =>
      path.endsWith('.tsx') || (path.includes('/world/phaser/') && path.endsWith('.ts')),
    );
    const violations: string[] = [];
    for (const path of files) {
      const file = relative(process.cwd(), path);
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(oldHotSelectors)) {
        violations.push(`${file}: legacy whole-world hook ${match[0].trim()}`);
      }
      if (/useSimulationStore\.getState\(\)\.state\b/.test(source)) {
        violations.push(`${file}: eager legacy store state read`);
      }
      if (/useSimulationStore\s*\([\s\S]{0,100}?\b(?:s|state)\.state\b/.test(source)) {
        violations.push(`${file}: subscribed legacy store state selector`);
      }
      if (/\bengine\.subscribe\s*\(/.test(source)) {
        violations.push(`${file}: full-snapshot engine.subscribe subscriber`);
      }
      if (/\bengine\.getState\s*\(/.test(source)) {
        violations.push(`${file}: engine-wide getState in a render module`);
      }
    }
    expect(files.length).toBeGreaterThan(70);
    expect(violations).toEqual([]);
  });

  it('keeps the compatibility Zustand bridge revision-only until an explicit legacy read', () => {
    const source = readFileSync(join(root, 'store/useSimulationStore.ts'), 'utf8');
    expect(source).toContain('engineInstance.subscribeChanges(');
    expect(source).toContain('createLegacySnapshotView(engineInstance)');
    expect(source).not.toMatch(/engineInstance\.subscribe\s*\(/);
  });
});

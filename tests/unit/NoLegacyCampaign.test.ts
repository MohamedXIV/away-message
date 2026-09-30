import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [
  'AGENTS.md',
  'PROJECT.md',
  'index.html',
  'src',
  'tests',
  'docs',
  'content',
  'scripts',
  'tools',
  'AI_LAB.md',
  'TEST_INFRA.md',
];

const TEXT_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.html']);
const SELF = 'tests/unit/NoLegacyCampaign.test.ts';

const banned: Array<{ label: string; pattern: RegExp }> = [
  { label: 'fixed-duration campaign', pattern: new RegExp('14[- ]day', 'i') },
  { label: 'fixed final day', pattern: new RegExp('day\\s*14', 'i') },
  { label: 'retired completion mode', pattern: new RegExp('free[- _]?play(?:_unlocked)?', 'i') },
  { label: 'retired evaluation completion flag', pattern: new RegExp('evaluation[_ -]?complete', 'i') },
  { label: 'retired Day14 modal', pattern: new RegExp('Day' + '14ResolutionModal', 'i') },
  { label: 'retired ending arc', pattern: new RegExp('evaluation' + 'EndingArc', 'i') },
  { label: 'named campaign meeting flag', pattern: new RegExp('maya_' + 'met_in_person', 'i') },
  { label: 'named day-by-day campaign knot', pattern: new RegExp('maya_' + 'day\\d+', 'i') },
  { label: 'legacy named intro alias', pattern: new RegExp('(ryan|nora)_' + 'intro', 'i') },
  { label: 'protected core cast language', pattern: new RegExp('core\\s*(?:4|four).*?(?:protected|required|cannot)', 'i') },
  { label: 'protected core buddy language', pattern: new RegExp('core\\s+buddy.*?(?:protected|required|cannot)', 'i') },
  { label: 'obsolete core buddy module', pattern: new RegExp('coreBuddies', 'i') },
  { label: 'obsolete core cast symbols', pattern: new RegExp('(?:CORE_BUDDIES|CORE_IDS|CORE_BY_ID|CoreBuddy|coreBuddyDef|coreBuddyIds|isRegistryBuddy)', 'i') },
  { label: 'obsolete core-derived symbols', pattern: new RegExp('(?:CORE_PROFILE_ALIASES|CORE_ID_TO_ARCHETYPE|CORE_TRAITS|CORE_SIGNATURE_COLORS)', 'i') },
  { label: 'obsolete core provenance', pattern: new RegExp("metVia\\s*:\\s*['\"]core['\"]", 'i') },
  { label: 'retired finite-game ids', pattern: new RegExp('(?:end_game|mid_game)_', 'i') },
  { label: 'named outing rule API', pattern: new RegExp('(?:mayaDinerEncounter|noraCanalEncounter|pickOutingMayaLine|pickOutingNoraLine)', 'i') },
];

function extension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot) : '';
}

function collect(path: string, out: string[]): void {
  const absolute = join(ROOT, path);
  const stats = statSync(absolute);
  if (stats.isFile()) {
    if (TEXT_EXTENSIONS.has(extension(path))) out.push(path);
    return;
  }

  for (const name of readdirSync(absolute)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    collect(join(path, name), out);
  }
}

describe('product direction guard', () => {
  it('contains no retired fixed-duration/fixed-cast campaign authority', () => {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) collect(root, files);

    const violations: string[] = [];
    for (const file of files) {
      const normalized = relative(ROOT, join(ROOT, file)).replace(/\\/g, '/');
      if (normalized === SELF) continue;
      const text = readFileSync(join(ROOT, file), 'utf8');
      const lines = text.split(/\r?\n/);
      for (const { label, pattern } of banned) {
        lines.forEach((line, index) => {
          if (pattern.test(line)) violations.push(`${normalized}:${index + 1} [${label}] ${line.trim()}`);
        });
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

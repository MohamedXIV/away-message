import { describe, expect, it } from 'vitest';
import { parseContentJson, validateContent, generateWorldRegistrySource } from '../../src/tools/content/codegen';
import { buildEventModifierRow } from '../../src/tools/studio/eventModifierAuthoring';
import { worldTablesFromGenerated } from '../../src/tools/studio/worldTablesFromGenerated';
import { readFileSync } from 'node:fs';

/**
 * RED-first TDD for #46 content slice: eventModifiers validate loudly,
 * generate deterministically, and round-trip through Studio tables.
 */
describe('Content event modifiers (#46)', () => {
  it('seed specs validate clean and generate a deterministic registry', () => {
    const raw = readFileSync('content/store.json', 'utf8');
    const tables = parseContentJson(raw);
    expect(validateContent(tables)).toEqual([]);

    const first = generateWorldRegistrySource(tables);
    const second = generateWorldRegistrySource(tables);
    expect(second).toBe(first);
    expect(first).toContain('GENERATED_EVENT_MODIFIERS');
    expect(first).toContain('festival_courier_backlog');
    expect(first).toContain('courier_backlog');
  });

  it('rejects unknown domains, out-of-vocabulary kinds, and unbounded values', () => {
    const raw = readFileSync('content/store.json', 'utf8');
    const base = parseContentJson(raw);
    const tables = {
      ...base,
      eventModifiers: {
        ...(base['eventModifiers'] as Record<string, unknown>),
        bad_domain: { eventId: 'x', domain: 'weather', kind: 'storm', durationMinutes: 60, targetIds: '[]', value: '' },
        bad_kind: { eventId: 'x', domain: 'delivery', kind: 'teleport', durationMinutes: 60, targetIds: '[]', value: '' },
        bad_value: { eventId: 'x', domain: 'delivery', kind: 'courier_backlog', durationMinutes: 60, targetIds: '[]', value: '9999' },
        bad_target: { eventId: 'x', domain: 'place', kind: 'reduced_desirability', durationMinutes: 60, targetIds: '["nope_nowhere"]', value: '' },
        bad_window: { eventId: 'x', domain: 'network', kind: 'slow_mirrors', durationMinutes: 99999, targetIds: '[]', value: '' },
      },
    };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('bad_domain') && e.includes('domain'))).toBe(true);
    expect(errors.some((e) => e.includes('bad_kind') && e.includes('kind'))).toBe(true);
    expect(errors.some((e) => e.includes('bad_value'))).toBe(true);
    expect(errors.some((e) => e.includes('bad_target'))).toBe(true);
    expect(errors.some((e) => e.includes('bad_window'))).toBe(true);
  });

  it('Studio authoring builds valid rows and Studio tables round-trip the registry', () => {
    const row = buildEventModifierRow('city_canal_festival', 'delivery', 'courier_backlog', 2880, [], '360');
    expect(row).toEqual({
      eventId: 'city_canal_festival',
      domain: 'delivery',
      kind: 'courier_backlog',
      durationMinutes: 2880,
      targetIds: '[]',
      value: '360',
    });
    expect(() => buildEventModifierRow('x', 'weather', 'storm', 60, [], '')).toThrow();
    expect(() => buildEventModifierRow('x', 'delivery', 'teleport', 60, [], '')).toThrow();

    const tables = worldTablesFromGenerated();
    const modifiers = (tables['eventModifiers'] ?? {}) as Record<string, Record<string, unknown>>;
    expect(Object.keys(modifiers).sort()).toEqual([
      'festival_courier_backlog',
      'festival_night_opportunity',
      'os7_upgrade_opportunity',
    ]);
    expect(modifiers['festival_courier_backlog']).toMatchObject({
      eventId: 'city_canal_festival',
      domain: 'delivery',
      kind: 'courier_backlog',
    });
  });
});

// tests/unit/EncounterDirectorPersistence.test.ts
// #47 — the director persists only cooldown identity/timestamps and
// surfaced one-shot identities. Candidates are always recomputed from
// canonical authorities after reload; no source copies are stored.

import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  emptyEncounterDirectorState,
  hydrateEncounterDirectorState,
} from '../../src/engine/encounters';

describe('EncounterDirector persistence (#47)', () => {
  it('1. hydrate drops malformed rows and bounds both collections', () => {
    expect(hydrateEncounterDirectorState(undefined)).toEqual(emptyEncounterDirectorState());
    expect(hydrateEncounterDirectorState(null)).toEqual(emptyEncounterDirectorState());
    expect(hydrateEncounterDirectorState('nope')).toEqual(emptyEncounterDirectorState());
    expect(hydrateEncounterDirectorState([])).toEqual(emptyEncounterDirectorState());

    const cooldowns: Record<string, unknown> = {};
    for (let i = 0; i < 200; i++) cooldowns[`key_${i}`] = 1000 + i;
    cooldowns['bad_finite'] = Number.NaN;
    cooldowns['bad_negative'] = -5;
    cooldowns[''] = 1000;
    const hydrated = hydrateEncounterDirectorState({
      cooldowns,
      surfacedOneShots: ['ok_1', 42, '', 'ok_2', ...Array.from({ length: 200 }, (_, i) => `shot_${i}`)],
    });
    expect(Object.keys(hydrated.cooldowns)).toHaveLength(64);
    expect(hydrated.surfacedOneShots).toHaveLength(64);
    expect(hydrated.surfacedOneShots).toContain('ok_1');
    expect(hydrated.surfacedOneShots).toContain('ok_2');
    expect(hydrated.cooldowns['bad_finite']).toBeUndefined();
    expect(hydrated.cooldowns['bad_negative']).toBeUndefined();
  });

  it('2. foreign-shaped director state never throws and never invents encounters', () => {
    const state = hydrateEncounterDirectorState({ cooldowns: { x: 'soon' }, surfacedOneShots: 'all' });
    expect(state).toEqual(emptyEncounterDirectorState());
  });

  it('3. engine round-trip preserves the slice and reloads suppressions identically', () => {
    const first = new SimulationEngine();
    const snapshot = first.exportSnapshot() as unknown as Record<string, unknown>;
    snapshot['encounters'] = {
      cooldowns: { 'place:place_b1:sam': 1000 },
      surfacedOneShots: ['obligation:appointment:sam:appt_1'],
    };
    snapshot['npcMobility'] = { trips: {}, places: { sam: 'place_b1' } };

    const second = new SimulationEngine();
    second.loadSnapshot(snapshot as never);
    expect(second.getEncounterDirectorState()).toEqual({
      cooldowns: { 'place:place_b1:sam': 1000 },
      surfacedOneShots: ['obligation:appointment:sam:appt_1'],
    });

    // Reload stability: export again and the slice is byte-identical.
    const reloaded = second.exportSnapshot() as unknown as Record<string, unknown>;
    expect(reloaded['encounters']).toEqual(snapshot['encounters']);
  });

  it('4. old saves without the slice hydrate to empty deterministic defaults', () => {
    const first = new SimulationEngine();
    const snapshot = first.exportSnapshot() as unknown as Record<string, unknown>;
    delete snapshot['encounters'];
    const second = new SimulationEngine();
    second.loadSnapshot(snapshot as never);
    expect(second.getEncounterDirectorState()).toEqual(emptyEncounterDirectorState());
  });

  it('5. persisted state carries no source-authority copies', () => {
    const first = new SimulationEngine();
    const snapshot = first.exportSnapshot() as unknown as Record<string, unknown>;
    snapshot['encounters'] = {
      cooldowns: { 'place:place_b1:sam': 1000 },
      surfacedOneShots: ['obligation:appointment:sam:appt_1'],
    };
    const second = new SimulationEngine();
    second.loadSnapshot(snapshot as never);
    const stored = (second.exportSnapshot() as unknown as Record<string, unknown>)['encounters'] as Record<string, unknown>;
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toMatch(/familiarity|affection|energyGain|fare|segmentMinutes/);
    expect(Object.keys(stored).sort()).toEqual(['cooldowns', 'surfacedOneShots']);
  });

  it('6. a fresh engine decides none without errors and marks nothing', () => {
    const sim = new SimulationEngine();
    const decision = sim.decideEncounter();
    expect(decision.kind).toBe('none');
    expect(sim.getEncounterDirectorState()).toEqual(emptyEncounterDirectorState());
  });
});

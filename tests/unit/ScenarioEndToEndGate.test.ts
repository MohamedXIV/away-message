import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { emptyScenarioState } from '../../src/engine/scenario/ScenarioState';
import { GENERATED_SCENARIOS } from '../../src/engine/scenarioContent.generated';


describe('Scenario / Story Thread end-to-end sandbox gate (#148)', () => {
  it('deterministically selects eligible authored Scenarios for a true new save', () => {
    const a = new SimulationEngine({ scenarioSeed: 'e2e-new-save' });
    const b = new SimulationEngine({ scenarioSeed: 'e2e-new-save' });

    expect(a.getScenarioState()).toEqual(b.getScenarioState());
    expect(Object.keys(a.getScenarioState().instances)).toHaveLength(3);
  });

  it('binds Someone From Before without Maya and seeds only canonical Social/knowledge owners', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    engine.social.removeBuddy('maya');
    const created = engine.initializeScenarios(GENERATED_SCENARIOS, 'e2e-no-maya', 5);
    const someone = created.find((instance) => instance.definitionId === 'someone_from_before');

    expect(someone?.bindings.old_acquaintance).toBe('nora');
    expect(engine.social.getRelationships('nora')?.familiarity).toBeGreaterThanOrEqual(35);
    expect(engine.social.isKnown('nora')).toBe(true);
    expect(someone?.facts).toEqual({ history_origin: 'before_oakhaven' });
    expect(someone?.facts).not.toHaveProperty('relationship');
    expect(someone?.facts).not.toHaveProperty('location');
    expect(someone?.facts).not.toHaveProperty('job');
    expect(someone?.facts).not.toHaveProperty('availability');
  });

  it('observes normal sandbox clues, dedupes hooks through save/reload, and never fabricates physical colocation', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    engine.social.removeBuddy('maya');
    const created = engine.initializeScenarios(GENERATED_SCENARIOS, 'e2e-hooks', 5);
    const someone = created.find((instance) => instance.definitionId === 'someone_from_before');
    expect(someone).toBeDefined();

    const noPhysicalTruth = engine.getScenarioHookOpportunities({}, GENERATED_SCENARIOS)
      .filter((hook) => hook.instanceId === someone!.id);
    expect(noPhysicalTruth.map((hook) => hook.hookId)).not.toContain('chance_encounter');

    const physicalTruth = engine.getScenarioHookOpportunities(
      { colocatedActorIds: ['nora'] },
      GENERATED_SCENARIOS,
    ).filter((hook) => hook.instanceId === someone!.id);
    expect(physicalTruth.map((hook) => hook.hookId)).toContain('chance_encounter');

    const searchTruth = engine.getScenarioHookOpportunities(
      { searchTerms: ['old username'] },
      GENERATED_SCENARIOS,
    ).filter((hook) => hook.instanceId === someone!.id);
    expect(searchTruth.map((hook) => hook.hookId)).toContain('old_handle_search');
    expect(engine.consumeScenarioHook(someone!.id, 'old_handle_search', GENERATED_SCENARIOS)).toBe(true);

    const restored = new SimulationEngine(engine.exportSnapshot());
    const afterReload = restored.getScenarioHookOpportunities(
      { searchTerms: ['old username'] },
      GENERATED_SCENARIOS,
    ).filter((hook) => hook.instanceId === someone!.id);
    expect(afterReload.map((hook) => hook.hookId)).not.toContain('old_handle_search');
  });

  it('supports multiple threads, failed binding, and a dormant unresolved thread through a large time jump', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    engine.social.removeBuddy('maya');
    const created = engine.initializeScenarios(GENERATED_SCENARIOS, 'e2e-lifecycle', 5);

    expect(created.length).toBeGreaterThanOrEqual(3);
    expect(created.some((instance) => instance.definitionId === 'bad_history')).toBe(false);
    expect(engine.getScenarioState().attemptedDefinitionIds).toContain('bad_history');

    const debt = created.find((instance) => instance.definitionId === 'old_debt');
    expect(debt).toBeDefined();
    expect(engine.setScenarioLifecycle(debt!.id, 'dormant')).toBe(true);
    engine.advanceGameMinutes(90 * 1440, 'scenario-gate-long-gap');
    expect(engine.getScenarioState().instances[debt!.id]?.lifecycle).toBe('dormant');
  });

  it('keeps the core sandbox progressing with zero Scenarios', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    const beforeMinute = engine.clock.getTotalMinutes();
    engine.advanceGameMinutes(7 * 1440, 'scenario-gate-zero-scenarios');

    expect(engine.clock.getTotalMinutes()).toBe(beforeMinute + 7 * 1440);
    expect(engine.getScenarioState()).toEqual(emptyScenarioState());
    expect(engine.getScenarioProjection({})).toEqual([]);
  });

  it('passes the authority regression audit: no sacred actor, duplicate world truth, AI outcome, quest UI, or fixed ending contract', () => {
    const framework = [
      '../../src/engine/scenario/types.ts',
      '../../src/engine/scenario/ScenarioState.ts',
      '../../src/engine/scenario/ScenarioDirector.ts',
      '../../src/engine/scenario/ScenarioProjection.ts',
      '../../src/engine/scenarioContent.generated.ts',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

    expect(framework).not.toMatch(/actorId\s*[:=]\s*['"]maya['"]/i);
    expect(framework).not.toMatch(/teleport|setNpcPlace|overwrite.*intent/i);
    expect(framework).not.toMatch(/openai|anthropic|llm.*outcome|ai.*outcome/i);
    expect(framework).not.toMatch(/quest\s*log|objective\s*(hud|tracker)|map\s*marker|xp\s*reward|completion\s*(meter|percent)/i);
    expect(framework).not.toMatch(/campaignLength|fixedEnding|endingDay|day14/i);

    const instance = Object.values(
      new SimulationEngine({ scenarioSeed: 'audit' }).getScenarioState().instances,
    )[0];
    expect(instance).toBeDefined();
    expect(instance).not.toHaveProperty('relationship');
    expect(instance).not.toHaveProperty('location');
    expect(instance).not.toHaveProperty('address');
    expect(instance).not.toHaveProperty('job');
    expect(instance).not.toHaveProperty('availability');
  });
});

import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { ScenarioDirector } from '../../src/engine/scenario/ScenarioDirector';
import { GENERATED_SCENARIOS } from '../../src/engine/scenarioContent.generated';

describe('first optional authored Scenario pack (#146)', () => {
  it('ships five distinct authored families through the generated content registry', () => {
    expect(GENERATED_SCENARIOS.map((scenario) => scenario.id).sort()).toEqual([
      'bad_history',
      'family_connection',
      'first_job_lead',
      'old_debt',
      'someone_from_before',
    ]);
    expect(new Set(GENERATED_SCENARIOS.flatMap((scenario) => scenario.tags)).size).toBeGreaterThanOrEqual(5);
  });

  it('supports multiple compatible threads while one authored required binding fails safely', () => {
    const social = new SocialEngine(new EventBus());
    social.removeBuddy('maya');
    const director = new ScenarioDirector(social);
    const created = director.initialize(GENERATED_SCENARIOS, {
      seed: 'pack-proof',
      maxInstances: 5,
      atMinute: 0,
    });

    const ids = created.map((instance) => instance.definitionId);
    expect(ids).toContain('someone_from_before');
    expect(ids).toContain('family_connection');
    expect(ids).toContain('old_debt');
    expect(ids).not.toContain('bad_history');
    expect(created.length).toBeGreaterThanOrEqual(3);

    const oldAcquaintance = created.find((instance) => instance.definitionId === 'someone_from_before');
    expect(oldAcquaintance?.bindings.old_acquaintance).toBe('nora');
    expect(oldAcquaintance?.bindings.old_acquaintance).not.toBe('maya');
    expect(director.getState().attemptedDefinitionIds).toContain('bad_history');
  });

  it('lets an authored Scenario remain dormant and unresolved across an arbitrarily long save gap', () => {
    const social = new SocialEngine(new EventBus());
    const director = new ScenarioDirector(social);
    const created = director.initialize(GENERATED_SCENARIOS, {
      seed: 'long-running',
      maxInstances: 5,
      atMinute: 0,
    });
    const thread = created.find((instance) => instance.definitionId === 'old_debt');
    expect(thread).toBeDefined();
    expect(director.setLifecycle(thread!.id, 'dormant')).toBe(true);

    const restoredMuchLater = new ScenarioDirector(social, director.getState());
    expect(restoredMuchLater.getState().instances[thread!.id]?.lifecycle).toBe('dormant');
    expect(restoredMuchLater.getState().instances[thread!.id]?.startedAtMinute).toBe(0);
  });
});

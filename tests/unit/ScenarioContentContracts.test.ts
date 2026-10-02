import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  emptyScenarioState,
  hydrateScenarioState,
  type ScenarioRuntimeState,
} from '../../src/engine/scenario/ScenarioState';
import {
  generateScenarioRegistrySource,
  validateScenarioContent,
  type ContentTables,
} from '../../src/tools/content/codegen';
import { createContentStore } from '../../src/tools/content/schema';

function validScenarioTables(): ContentTables {
  return {
    scenarios: {
      someone_from_before: {
        tags: ['personal-history'],
        eligibility: {
          requiredWorldTags: [],
          excludedWorldTags: [],
          selectionWeight: 1,
          exclusiveGroup: '',
        },
        roles: [
          {
            id: 'old_acquaintance',
            required: true,
            allowSharedActor: false,
            actorRolesAny: ['local'],
            actorTagsAll: [],
            actorTagsNone: [],
            reachesAny: ['local'],
          },
        ],
        initialFacts: [
          {
            id: 'remembered_name',
            kind: 'player_knowledge',
            roleId: 'old_acquaintance',
            factKey: 'remembered_name',
            value: 'known_from_before',
            sourceRef: 'scenario:someone_from_before',
          },
        ],
        hooks: [
          {
            id: 'old_handle_searchable',
            kind: 'knowledge_fact',
            roleId: 'old_acquaintance',
            factKey: 'old_handle_searchable',
            oneShot: true,
            presentationCue: 'remembered_old_acquaintance_nearby',
          },
        ],
        presentation: {
          titleKey: 'scenario.someone_from_before.title',
          summaryKey: 'scenario.someone_from_before.summary',
          hiddenUntilHookId: 'old_handle_searchable',
        },
      },
    },
  };
}

describe('Scenario contracts + authored content pipeline (#143)', () => {
  it('loads Scenario definitions through the shared TinyBase schema', () => {
    const row = validScenarioTables().scenarios.someone_from_before;
    const store = createContentStore();

    expect(() => store.setRow('scenarios', 'someone_from_before', row as never)).not.toThrow();
    expect(store.getRow('scenarios', 'someone_from_before')).toEqual(row);
  });

  it('validates semantic role and hook references without sacred actor ids', () => {
    expect(validateScenarioContent(validScenarioTables())).toEqual([]);

    const malformed = validScenarioTables();
    malformed.scenarios.someone_from_before.roles = [
      ...malformed.scenarios.someone_from_before.roles as unknown[],
      {
        id: 'old_acquaintance',
        required: false,
        allowSharedActor: false,
        actorRolesAny: [],
        actorTagsAll: [],
        actorTagsNone: [],
        reachesAny: [],
      },
    ];
    malformed.scenarios.someone_from_before.hooks = [
      {
        id: 'impossible_clue',
        kind: 'knowledge_fact',
        roleId: 'missing_role',
        factKey: '',
        oneShot: true,
        presentationCue: '',
      },
    ];

    const errors = validateScenarioContent(malformed);
    expect(errors).toContain("Scenario 'someone_from_before' has duplicate role id 'old_acquaintance'.");
    expect(errors).toContain("Scenario 'someone_from_before' hook 'impossible_clue' references unknown role 'missing_role'.");
    expect(errors).toContain("Scenario 'someone_from_before' hook 'impossible_clue' requires factKey.");
  });

  it('generates a deterministic typed registry from authored definitions', () => {
    const sourceA = generateScenarioRegistrySource(validScenarioTables());
    const sourceB = generateScenarioRegistrySource(validScenarioTables());

    expect(sourceA).toBe(sourceB);
    expect(sourceA).toContain('export const GENERATED_SCENARIOS');
    expect(sourceA).toContain('someone_from_before');
    expect(sourceA).toContain('old_acquaintance');
    expect(sourceA).not.toContain("actorId: 'maya'");
  });

  it('hydrates bounded per-save instance state and round-trips it through SimulationEngine', () => {
    const state: ScenarioRuntimeState = {
      instances: {
        'someone_from_before:0': {
          id: 'someone_from_before:0',
          definitionId: 'someone_from_before',
          bindings: { old_acquaintance: 'actor_184' },
          startedAtMinute: 0,
          lifecycle: 'dormant',
          consumedHookIds: ['old_handle_searchable'],
          facts: { origin: 'nearby_village' },
        },
      },
    };

    expect(hydrateScenarioState(undefined)).toEqual(emptyScenarioState());
    expect(hydrateScenarioState(state)).toEqual(state);

    const snapshot = new SimulationEngine({ scenarios: state } as never).exportSnapshot();
    expect(snapshot.scenarios).toEqual(state);
    expect(new SimulationEngine(snapshot as never).exportSnapshot().scenarios).toEqual(state);
  });
});

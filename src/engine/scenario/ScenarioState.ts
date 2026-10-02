import type { ScenarioInstance, ScenarioLifecycle, ScenarioScalar } from './types';

export interface ScenarioRuntimeState {
  instances: Record<string, ScenarioInstance>;
  /** Definitions already considered for this save; failed/filtered bindings never reroll on reload. */
  attemptedDefinitionIds: string[];
}
const LIFECYCLES = new Set<ScenarioLifecycle>(['active', 'dormant', 'resolved', 'abandoned']);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/;
export function emptyScenarioState(): ScenarioRuntimeState { return { instances: {}, attemptedDefinitionIds: [] }; }
function scalar(value: unknown): value is ScenarioScalar {
  return typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
/** Current-format boundary; invalid rows are refused instead of inventing canonical state. */
export function hydrateScenarioState(input: unknown): ScenarioRuntimeState {
  const root = record(input);
  const rows = record(root?.['instances']);
  if (!rows) return emptyScenarioState();
  const instances: Record<string, ScenarioInstance> = {};
  for (const key of Object.keys(rows).sort()) {
    const raw = record(rows[key]);
    if (!raw || !ID.test(key)) continue;
    const id = typeof raw['id'] === 'string' ? raw['id'] : '';
    const definitionId = typeof raw['definitionId'] === 'string' ? raw['definitionId'] : '';
    const lifecycle = raw['lifecycle'];
    const startedAtMinute = raw['startedAtMinute'];
    if (id !== key || !ID.test(definitionId) || !LIFECYCLES.has(lifecycle as ScenarioLifecycle)
      || typeof startedAtMinute !== 'number' || !Number.isFinite(startedAtMinute) || startedAtMinute < 0) continue;
    const bindingsRaw = record(raw['bindings']) ?? {};
    const bindings: Record<string, string | null> = {};
    for (const roleId of Object.keys(bindingsRaw).sort().slice(0, 32)) {
      const value = bindingsRaw[roleId];
      if (!ID.test(roleId) || (value !== null && (typeof value !== 'string' || !ID.test(value)))) continue;
      bindings[roleId] = value as string | null;
    }
    const factsRaw = record(raw['facts']) ?? {};
    const facts: Record<string, ScenarioScalar> = {};
    for (const factId of Object.keys(factsRaw).sort().slice(0, 128)) {
      const value = factsRaw[factId];
      if (ID.test(factId) && scalar(value)) facts[factId] = value;
    }
    const consumedHookIds = Array.from(new Set(
      (Array.isArray(raw['consumedHookIds']) ? raw['consumedHookIds'] : [])
        .filter((value): value is string => typeof value === 'string' && ID.test(value)).slice(0, 128),
    )).sort();
    instances[key] = { id, definitionId, bindings, startedAtMinute: Math.floor(startedAtMinute),
      lifecycle: lifecycle as ScenarioLifecycle, consumedHookIds, facts };
  }
  const attemptedDefinitionIds = Array.from(new Set(
    (Array.isArray(root?.['attemptedDefinitionIds']) ? root?.['attemptedDefinitionIds'] : [])
      .filter((value): value is string => typeof value === 'string' && ID.test(value))
      .slice(0, 256),
  )).sort();
  return { instances, attemptedDefinitionIds };
}
export function cloneScenarioState(state: ScenarioRuntimeState): ScenarioRuntimeState {
  return hydrateScenarioState(state);
}

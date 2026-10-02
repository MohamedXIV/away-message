import type { ScenarioRuntimeState } from './ScenarioState';
import type { ScenarioDefinition, ScenarioLifecycle } from './types';
import type { ScenarioHookOpportunity } from './ScenarioDirector';

export type ScenarioProjectionState =
  | 'hidden'
  | 'active'
  | 'dormant'
  | 'resolved'
  | 'abandoned';

export interface ScenarioProjectionActor {
  readonly id: string;
  readonly displayName: string;
  readonly handle: string;
}

export interface ScenarioProjectionRole {
  readonly roleId: string;
  readonly actor: ScenarioProjectionActor | null;
}

export interface ScenarioProjectionHook {
  readonly id: string;
  readonly presentationCue: string;
  readonly roleId: string;
  readonly actor: ScenarioProjectionActor | null;
}

export interface ScenarioProjectionEntry {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly state: ScenarioProjectionState;
  readonly titleKey: string | null;
  readonly summaryKey: string | null;
  readonly roles: readonly ScenarioProjectionRole[];
  readonly availableHooks: readonly ScenarioProjectionHook[];
}

export interface ScenarioProjectionKnowledge {
  isActorKnown(actorId: string): boolean;
  getActorPresentation(actorId: string): ScenarioProjectionActor | null;
}

function visibleLifecycle(lifecycle: ScenarioLifecycle): Exclude<ScenarioProjectionState, 'hidden'> {
  return lifecycle;
}

function actorIfKnown(
  actorId: string | null,
  knowledge: ScenarioProjectionKnowledge,
): ScenarioProjectionActor | null {
  if (!actorId || !knowledge.isActorKnown(actorId)) return null;
  return knowledge.getActorPresentation(actorId);
}

/**
 * Pure player-safe Scenario read model.
 *
 * It deliberately excludes scenario-local facts and every canonical domain's
 * private state (relationship values, current location, job, residence, etc).
 * Bound actor identity appears only after the canonical knowledge owner says
 * that actor is known.
 */
export function projectScenarios(input: {
  definitions: readonly ScenarioDefinition[];
  state: ScenarioRuntimeState;
  availableHooks: readonly ScenarioHookOpportunity[];
  knowledge: ScenarioProjectionKnowledge;
}): readonly ScenarioProjectionEntry[] {
  const definitionsById = new Map(input.definitions.map((definition) => [definition.id, definition]));
  const hooksByInstance = new Map<string, ScenarioHookOpportunity[]>();

  for (const hook of input.availableHooks) {
    const bucket = hooksByInstance.get(hook.instanceId) ?? [];
    bucket.push(hook);
    hooksByInstance.set(hook.instanceId, bucket);
  }

  return Object.values(input.state.instances)
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((instance): ScenarioProjectionEntry[] => {
      const definition = definitionsById.get(instance.definitionId);
      if (!definition) return [];

      const available = [...(hooksByInstance.get(instance.id) ?? [])]
        .sort((a, b) => a.hookId.localeCompare(b.hookId));

      const hiddenHookId = definition.presentation?.hiddenUntilHookId ?? '';
      const hiddenGatePassed = !hiddenHookId
        || instance.consumedHookIds.includes(hiddenHookId)
        || available.some((hook) => hook.hookId === hiddenHookId);

      const state: ScenarioProjectionState = hiddenGatePassed
        ? visibleLifecycle(instance.lifecycle)
        : 'hidden';

      const roles = definition.roles
        .map((role): ScenarioProjectionRole => ({
          roleId: role.id,
          actor: state === 'hidden'
            ? null
            : actorIfKnown(instance.bindings[role.id] ?? null, input.knowledge),
        }))
        .sort((a, b) => a.roleId.localeCompare(b.roleId));

      const safeHooks: ScenarioProjectionHook[] = state === 'hidden'
        ? []
        : available.map((hook) => ({
          id: hook.hookId,
          presentationCue: hook.presentationCue,
          roleId: hook.roleId,
          actor: actorIfKnown(hook.boundActorId, input.knowledge),
        }));

      return [{
        instanceId: instance.id,
        definitionId: instance.definitionId,
        state,
        titleKey: state === 'hidden' ? null : definition.presentation?.titleKey ?? null,
        summaryKey: state === 'hidden' ? null : definition.presentation?.summaryKey ?? null,
        roles,
        availableHooks: safeHooks,
      }];
    });
}

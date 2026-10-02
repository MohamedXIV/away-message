import type { SocialEngine } from '../SocialEngine';
import type { ScenarioHookOpportunity } from './ScenarioDirector';
import type { ScenarioRuntimeState } from './ScenarioState';
import type { ScenarioDefinition, ScenarioLifecycle } from './types';

export type ScenarioPresentationState = 'hidden' | ScenarioLifecycle;

export interface ScenarioProjectedActor {
  readonly id: string;
  readonly displayName: string;
  readonly knownHandles: readonly string[];
}

export interface ScenarioProjectedRole {
  readonly roleId: string;
  /** Null until the canonical Social knowledge owner says this actor is known. */
  readonly actor: ScenarioProjectedActor | null;
}

export interface ScenarioProjectedHook {
  readonly id: string;
  readonly presentationCue: string;
  readonly roleId: string;
  /** Player-safe identity only; never current location/job/relationship state. */
  readonly actor: ScenarioProjectedActor | null;
}

export interface ScenarioProjection {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly presentationState: ScenarioPresentationState;
  readonly titleKey: string | null;
  readonly summaryKey: string | null;
  readonly roles: readonly ScenarioProjectedRole[];
  readonly availableHooks: readonly ScenarioProjectedHook[];
}

function knownActor(social: SocialEngine, actorId: string | null): ScenarioProjectedActor | null {
  if (!actorId || !social.isKnown(actorId)) return null;
  const actor = social.getBuddy(actorId);
  if (!actor) return null;
  return {
    id: actor.id,
    displayName: actor.displayName,
    knownHandles: social.getKnownHandles(actorId),
  };
}

/**
 * Build a player-safe, read-only semantic projection. This function cannot
 * mutate Scenario, Social, spatial, jobs, or any other canonical authority.
 */
export function projectScenarios(
  definitions: readonly ScenarioDefinition[],
  state: ScenarioRuntimeState,
  social: SocialEngine,
  opportunities: readonly ScenarioHookOpportunity[],
): ScenarioProjection[] {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const hooksByInstance = new Map<string, ScenarioHookOpportunity[]>();
  for (const hook of opportunities) {
    const list = hooksByInstance.get(hook.instanceId) ?? [];
    list.push(hook);
    hooksByInstance.set(hook.instanceId, list);
  }

  const projections: ScenarioProjection[] = [];
  for (const instance of Object.values(state.instances).sort((a, b) => a.id.localeCompare(b.id))) {
    const definition = definitionsById.get(instance.definitionId);
    if (!definition) continue;
    const hiddenUntil = definition.presentation?.hiddenUntilHookId ?? '';
    const visible = !hiddenUntil || instance.consumedHookIds.includes(hiddenUntil);
    const presentationState: ScenarioPresentationState = visible ? instance.lifecycle : 'hidden';

    const roles = definition.roles.map((role) => ({
      roleId: role.id,
      // A hidden thread must not reveal the binding relationship merely
      // because the actor is known through some unrelated canonical path.
      actor: visible ? knownActor(social, instance.bindings[role.id] ?? null) : null,
    }));
    const availableHooks = (hooksByInstance.get(instance.id) ?? [])
      .sort((a, b) => a.hookId.localeCompare(b.hookId))
      .map((hook) => ({
        id: hook.hookId,
        presentationCue: hook.presentationCue,
        roleId: hook.roleId,
        actor: knownActor(social, hook.boundActorId),
      }));

    projections.push({
      instanceId: instance.id,
      definitionId: instance.definitionId,
      presentationState,
      titleKey: visible ? definition.presentation?.titleKey ?? null : null,
      summaryKey: visible ? definition.presentation?.summaryKey ?? null : null,
      roles,
      availableHooks,
    });
  }
  return projections;
}

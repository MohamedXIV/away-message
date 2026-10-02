import type { BuddyCharacter, RelationshipDimensions } from '../types';
import type { SocialEngine } from '../SocialEngine';
import {
  cloneScenarioState,
  hydrateScenarioState,
  type ScenarioRuntimeState,
} from './ScenarioState';
import type {
  ScenarioDefinition,
  ScenarioHookDefinition,
  ScenarioInstance,
  ScenarioLifecycle,
  ScenarioRoleDefinition,
  ScenarioSeedFact,
} from './types';

export interface ScenarioInitializationOptions {
  seed: string;
  worldTags?: readonly string[];
  maxInstances?: number;
  atMinute?: number;
}

export interface ScenarioObservation {
  knowledgeFacts?: readonly string[];
  playerPlaceId?: string | null;
  colocatedActorIds?: readonly string[];
  searchTerms?: readonly string[];
}

export interface ScenarioHookOpportunity {
  instanceId: string;
  definitionId: string;
  hookId: string;
  presentationCue: string;
  roleId: string;
  boundActorId: string | null;
}

const RELATIONSHIP_KEYS = new Set<keyof RelationshipDimensions>([
  'familiarity', 'trust', 'comfort', 'respect', 'annoyance',
  'affection', 'attraction', 'suspicion', 'resentment',
]);

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function actorTags(actor: BuddyCharacter): Set<string> {
  const tags = new Set<string>();
  const reach = actor.reach ?? 'local';
  tags.add(reach);
  tags.add(`reach:${reach}`);
  if (actor.archetype) {
    tags.add(actor.archetype);
    tags.add(`archetype:${actor.archetype}`);
  }
  if (actor.status) tags.add(`status:${actor.status}`);
  for (const role of actor.roles ?? []) {
    tags.add(role);
    tags.add(`role:${role}`);
  }
  return tags;
}

function matchesRole(actor: BuddyCharacter, role: ScenarioRoleDefinition): boolean {
  if (actor.status === 'gone' || actor.status === 'blocked') return false;
  if (role.reachesAny.length > 0 && !role.reachesAny.includes(actor.reach ?? 'local')) return false;
  const roles = new Set(actor.roles ?? []);
  if (role.actorRolesAny.length > 0 && !role.actorRolesAny.some((value) => roles.has(value))) return false;
  const tags = actorTags(actor);
  if (role.actorTagsAll.some((value) => !tags.has(value))) return false;
  if (role.actorTagsNone.some((value) => tags.has(value))) return false;
  return true;
}

function definitionEligible(definition: ScenarioDefinition, worldTags: ReadonlySet<string>): boolean {
  if (!(definition.eligibility.selectionWeight > 0)) return false;
  if (definition.eligibility.requiredWorldTags.some((tag) => !worldTags.has(tag))) return false;
  if (definition.eligibility.excludedWorldTags.some((tag) => worldTags.has(tag))) return false;
  return true;
}

function weightedDefinitionScore(definition: ScenarioDefinition, seed: string): number {
  const weight = Math.max(0.0001, definition.eligibility.selectionWeight);
  return hashText(`${seed}:definition:${definition.id}`) / weight;
}

function actorScore(definitionId: string, roleId: string, actorId: string, seed: string): number {
  return hashText(`${seed}:role:${definitionId}:${roleId}:${actorId}`);
}

function bindRoles(
  definition: ScenarioDefinition,
  social: SocialEngine,
  seed: string,
): Record<string, string | null> | null {
  const bindings: Record<string, string | null> = {};
  const usedActors = new Set<string>();
  const actors = social.getBuddies();

  for (const role of definition.roles) {
    const candidates = actors
      .filter((actor) => matchesRole(actor, role))
      .filter((actor) => role.allowSharedActor || !usedActors.has(actor.id))
      .sort((a, b) =>
        actorScore(definition.id, role.id, a.id, seed)
        - actorScore(definition.id, role.id, b.id, seed)
        || a.id.localeCompare(b.id));

    const chosen = candidates[0];
    if (!chosen) {
      if (role.required) return null;
      bindings[role.id] = null;
      continue;
    }
    bindings[role.id] = chosen.id;
    if (!role.allowSharedActor) usedActors.add(chosen.id);
  }
  return bindings;
}

function clampRelationship(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Scenario framing coordinator. It owns only bindings/lifecycle/provenance.
 * Social/knowledge truth is initialized through SocialEngine's canonical APIs.
 */
export class ScenarioDirector {
  private state: ScenarioRuntimeState;

  public constructor(
    private readonly social: SocialEngine,
    initialState?: unknown,
  ) {
    this.state = hydrateScenarioState(initialState);
  }

  public hydrate(state: unknown): void {
    this.state = hydrateScenarioState(state);
  }

  public getState(): ScenarioRuntimeState {
    return cloneScenarioState(this.state);
  }

  public initialize(
    definitions: readonly ScenarioDefinition[],
    options: ScenarioInitializationOptions,
  ): ScenarioInstance[] {
    const seed = options.seed.trim().slice(0, 160) || 'default';
    const worldTags = new Set(options.worldTags ?? []);
    const maxInstances = Math.max(0, Math.min(16, Math.floor(options.maxInstances ?? 3)));
    const atMinute = Math.max(0, Math.floor(options.atMinute ?? 0));
    const attempted = new Set(this.state.attemptedDefinitionIds);
    const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
    const occupiedExclusiveGroups = new Set(
      Object.values(this.state.instances)
        .map((instance) => definitionsById.get(instance.definitionId)?.eligibility.exclusiveGroup ?? '')
        .filter(Boolean),
    );

    const pending = definitions
      .filter((definition) => !attempted.has(definition.id))
      .sort((a, b) =>
        weightedDefinitionScore(a, seed) - weightedDefinitionScore(b, seed)
        || a.id.localeCompare(b.id));

    const created: ScenarioInstance[] = [];
    for (const definition of pending) {
      attempted.add(definition.id);
      if (Object.keys(this.state.instances).length >= maxInstances) continue;
      if (!definitionEligible(definition, worldTags)) continue;
      const group = definition.eligibility.exclusiveGroup;
      if (group && occupiedExclusiveGroups.has(group)) continue;

      const bindings = bindRoles(definition, this.social, seed);
      if (!bindings) continue;

      const id = `${definition.id}:${hashText(`${seed}:instance:${definition.id}`).toString(36)}`;
      const instance: ScenarioInstance = {
        id,
        definitionId: definition.id,
        bindings,
        startedAtMinute: atMinute,
        lifecycle: 'active',
        consumedHookIds: [],
        facts: {},
      };
      this.applyInitialFacts(definition.initialFacts, instance, atMinute);
      this.state.instances[id] = instance;
      if (group) occupiedExclusiveGroups.add(group);
      created.push(structuredClone(instance));
    }

    this.state.attemptedDefinitionIds = [...attempted].sort();
    return created;
  }

  /**
   * Read-only hook projection over canonical observations. Eligibility never
   * moves actors or mutates Social/Knowledge/Spatial owners.
   */
  public getAvailableHooks(
    definitions: readonly ScenarioDefinition[],
    observation: ScenarioObservation,
  ): ScenarioHookOpportunity[] {
    const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
    const knowledge = new Set(observation.knowledgeFacts ?? []);
    const colocated = new Set(observation.colocatedActorIds ?? []);
    const searches = new Set((observation.searchTerms ?? []).map((term) => term.trim().toLowerCase()).filter(Boolean));
    const opportunities: ScenarioHookOpportunity[] = [];

    for (const instance of Object.values(this.state.instances).sort((a, b) => a.id.localeCompare(b.id))) {
      if (instance.lifecycle === 'resolved' || instance.lifecycle === 'abandoned') continue;
      const definition = definitionsById.get(instance.definitionId);
      if (!definition) continue;
      const consumed = new Set(instance.consumedHookIds);
      for (const hook of [...definition.hooks].sort((a, b) => a.id.localeCompare(b.id))) {
        if (hook.oneShot && consumed.has(hook.id)) continue;
        if (!this.hookEligible(hook, instance, {
          knowledge,
          colocated,
          searches,
          playerPlaceId: observation.playerPlaceId ?? null,
        })) continue;
        opportunities.push({
          instanceId: instance.id,
          definitionId: instance.definitionId,
          hookId: hook.id,
          presentationCue: hook.presentationCue,
          roleId: hook.roleId,
          boundActorId: hook.roleId ? instance.bindings[hook.roleId] ?? null : null,
        });
      }
    }
    return opportunities;
  }

  public consumeHook(
    definitions: readonly ScenarioDefinition[],
    instanceId: string,
    hookId: string,
  ): boolean {
    const instance = this.state.instances[instanceId];
    if (!instance || instance.lifecycle === 'resolved' || instance.lifecycle === 'abandoned') return false;
    const definition = definitions.find((candidate) => candidate.id === instance.definitionId);
    const hook = definition?.hooks.find((candidate) => candidate.id === hookId);
    if (!hook) return false;
    if (hook.oneShot && instance.consumedHookIds.includes(hookId)) return false;
    if (!instance.consumedHookIds.includes(hookId)) {
      instance.consumedHookIds = [...instance.consumedHookIds, hookId].sort();
    }
    return true;
  }

  public setLifecycle(instanceId: string, lifecycle: ScenarioLifecycle): boolean {
    const instance = this.state.instances[instanceId];
    if (!instance) return false;
    if (instance.lifecycle === lifecycle) return true;
    instance.lifecycle = lifecycle;
    return true;
  }

  private hookEligible(
    hook: ScenarioHookDefinition,
    instance: ScenarioInstance,
    observation: {
      knowledge: ReadonlySet<string>;
      colocated: ReadonlySet<string>;
      searches: ReadonlySet<string>;
      playerPlaceId: string | null;
    },
  ): boolean {
    if (hook.kind === 'knowledge_fact') return observation.knowledge.has(hook.factKey);
    if (hook.kind === 'player_entered_place') return Boolean(hook.factKey) && observation.playerPlaceId === hook.factKey;
    if (hook.kind === 'search_term') return Boolean(hook.factKey) && observation.searches.has(hook.factKey.trim().toLowerCase());
    if (hook.kind === 'bound_actor_colocated') {
      const actorId = hook.roleId ? instance.bindings[hook.roleId] ?? null : null;
      return Boolean(actorId && observation.colocated.has(actorId));
    }
    return false;
  }

  private applyInitialFacts(
    facts: readonly ScenarioSeedFact[],
    instance: ScenarioInstance,
    atMinute: number,
  ): void {
    const day = Math.floor(atMinute / 1440) + 1;
    for (const fact of facts) {
      const actorId = fact.roleId ? instance.bindings[fact.roleId] ?? null : null;

      if (fact.kind === 'scenario_fact') {
        instance.facts[fact.factKey] = fact.value;
        continue;
      }

      if (fact.kind === 'player_knowledge') {
        if (!actorId) continue;
        if (fact.factKey === 'bound_actor_handle' && fact.value === true) {
          const actor = this.social.getBuddy(actorId);
          if (actor) this.social.learnHandle(actorId, actor.handle);
        } else if (fact.factKey === 'known_handle' && typeof fact.value === 'string') {
          this.social.learnHandle(actorId, fact.value);
        }
        continue;
      }

      if (!actorId) continue;
      if (fact.factKey === 'memory' && typeof fact.value === 'string') {
        this.social.addCoreMemory(actorId, {
          text: fact.value,
          kind: 'shared_moment',
          day,
        });
        continue;
      }
      if (RELATIONSHIP_KEYS.has(fact.factKey as keyof RelationshipDimensions)
        && typeof fact.value === 'number' && Number.isFinite(fact.value)) {
        const key = fact.factKey as keyof RelationshipDimensions;
        const current = this.social.getRelationships(actorId);
        if (!current) continue;
        const target = Math.max(current[key], clampRelationship(fact.value));
        this.social.adjustRelationship(actorId, { [key]: target } as Partial<RelationshipDimensions>);
      }
    }
  }
}

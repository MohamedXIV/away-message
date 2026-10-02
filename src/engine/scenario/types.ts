export type ScenarioId = string;
export type ScenarioRoleId = string;
export type ScenarioInstanceId = string;
export type ScenarioScalar = string | number | boolean;
export type ScenarioLifecycle = 'active' | 'dormant' | 'resolved' | 'abandoned';

export interface ScenarioEligibility {
  readonly requiredWorldTags: readonly string[];
  readonly excludedWorldTags: readonly string[];
  readonly selectionWeight: number;
  readonly exclusiveGroup: string;
}
export interface ScenarioRoleDefinition {
  readonly id: ScenarioRoleId;
  readonly required: boolean;
  readonly allowSharedActor: boolean;
  readonly actorRolesAny: readonly string[];
  readonly actorTagsAll: readonly string[];
  readonly actorTagsNone: readonly string[];
  readonly reachesAny: readonly string[];
}
export type ScenarioSeedFactKind = 'social_history' | 'player_knowledge' | 'scenario_fact';
export interface ScenarioSeedFact {
  readonly id: string;
  readonly kind: ScenarioSeedFactKind;
  readonly roleId: ScenarioRoleId | '';
  readonly factKey: string;
  readonly value: ScenarioScalar;
  readonly sourceRef: string;
}
export type ScenarioHookKind = 'knowledge_fact' | 'player_entered_place' | 'bound_actor_colocated' | 'search_term';
export interface ScenarioHookDefinition {
  readonly id: string;
  readonly kind: ScenarioHookKind;
  readonly roleId: ScenarioRoleId | '';
  readonly factKey: string;
  readonly oneShot: boolean;
  readonly presentationCue: string;
}
export interface ScenarioPresentation {
  readonly titleKey: string;
  readonly summaryKey: string;
  readonly hiddenUntilHookId: string;
}
export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly tags: readonly string[];
  readonly eligibility: ScenarioEligibility;
  readonly roles: readonly ScenarioRoleDefinition[];
  readonly initialFacts: readonly ScenarioSeedFact[];
  readonly hooks: readonly ScenarioHookDefinition[];
  readonly presentation?: ScenarioPresentation;
}
export interface ScenarioInstance {
  id: ScenarioInstanceId;
  definitionId: ScenarioId;
  bindings: Record<ScenarioRoleId, string | null>;
  startedAtMinute: number;
  lifecycle: ScenarioLifecycle;
  consumedHookIds: string[];
  facts: Record<string, ScenarioScalar>;
}

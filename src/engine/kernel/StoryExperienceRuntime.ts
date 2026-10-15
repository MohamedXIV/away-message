import type { CoreDomainOwners } from './CoreDomainOwners';
import {
  InnerVoiceEngine,
  emptyInnerVoicePersistedState,
  type InnerVoicePersistedState,
  type InnerVoiceUiState,
  type InspectThoughtRequest,
  type ThoughtIntent,
  type ThoughtTrigger,
} from '../innerVoice/index';
import type { ScenarioRuntimeState } from '../scenario/ScenarioState';
import {
  ScenarioDirector,
  type ScenarioHookOpportunity,
  type ScenarioObservation,
} from '../scenario/ScenarioDirector';
import type {
  ScenarioDefinition,
  ScenarioInstance,
  ScenarioLifecycle,
} from '../scenario/types';
import { projectScenarios, type ScenarioProjection } from '../scenario/ScenarioProjection';
import { GENERATED_SCENARIOS } from '../scenarioContent.generated';

/**
 * Owns the existing authored ScenarioDirector and presentation-only InnerVoice
 * *instances*, each with its own distinct persisted slice and responsibilities.
 * No gameplay state, Social graph, clock or invented parallel narrative truth.
 *
 * Fresh runs select authored scenarios once; current-format reload restores
 * the exact saved scenario instances without choosing new content.
 */
export class StoryExperienceRuntime {
  private readonly scenarios: ScenarioDirector;
  private readonly voice: InnerVoiceEngine;

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'social'>,
    initialScenarios?: ScenarioRuntimeState,
    scenarioSeed = 'default',
    initialVoice?: InnerVoicePersistedState | null,
  ) {
    this.scenarios = new ScenarioDirector(owners.social, initialScenarios);
    if (initialScenarios === undefined) {
      this.scenarios.initialize(GENERATED_SCENARIOS, {
        seed: scenarioSeed,
        atMinute: owners.clock.getTotalMinutes(),
        maxInstances: 3,
      });
    }
    this.voice = new InnerVoiceEngine(initialVoice ?? null);
  }

  public loadState(
    scenarioState?: ScenarioRuntimeState,
    voiceState?: InnerVoicePersistedState | null,
  ): void {
    // Exactly persisted bindings: NO new authored selection on reload.
    this.scenarios.hydrate(scenarioState);
    this.voice.hydrate(voiceState ?? emptyInnerVoicePersistedState());
  }

  public getScenarioState(): ScenarioRuntimeState {
    return this.scenarios.getState();
  }

  /** Test/tooling seam for authored definitions; production new saves use the generated registry. */
  public initializeScenarios(
    definitions: readonly ScenarioDefinition[],
    seed = 'default',
    maxInstances = 3,
  ): ScenarioInstance[] {
    return this.scenarios.initialize(definitions, {
      seed,
      atMinute: this.owners.clock.getTotalMinutes(),
      maxInstances,
    });
  }

  public getScenarioHookOpportunities(
    observation: ScenarioObservation,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): ScenarioHookOpportunity[] {
    return this.scenarios.getAvailableHooks(definitions, observation);
  }

  public getScenarioProjection(
    observation: ScenarioObservation,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): ScenarioProjection[] {
    const opportunities = this.scenarios.getAvailableHooks(definitions, observation);
    return projectScenarios(
      definitions,
      this.scenarios.getState(),
      this.owners.social,
      opportunities,
    );
  }

  public consumeScenarioHook(
    instanceId: string,
    hookId: string,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): boolean {
    return this.scenarios.consumeHook(definitions, instanceId, hookId);
  }

  public setScenarioLifecycle(instanceId: string, lifecycle: ScenarioLifecycle): boolean {
    return this.scenarios.setLifecycle(instanceId, lifecycle);
  }

  public getInnerVoiceEngine(): InnerVoiceEngine {
    return this.voice;
  }

  public getInnerVoiceState(): InnerVoicePersistedState {
    return this.voice.getPersistedState();
  }

  public requestInnerThought(
    trigger: ThoughtTrigger,
    nowMinute?: number,
    ui?: InnerVoiceUiState,
  ): ThoughtIntent | null {
    return this.voice.request(trigger, nowMinute ?? this.owners.clock.getTotalMinutes(), ui);
  }

  public requestInspectThought(
    request: InspectThoughtRequest,
    nowMinute?: number,
  ): ThoughtIntent | null {
    return this.voice.requestInspect(request, nowMinute ?? this.owners.clock.getTotalMinutes());
  }

  public dismissInnerThought(): void {
    this.voice.dismissActive();
  }
}

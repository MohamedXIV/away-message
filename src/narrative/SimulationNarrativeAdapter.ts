import type { SimulationEngine } from '../engine/SimulationEngine';
import type { ScenarioObservation } from '../engine/scenario/ScenarioDirector';
import {
  NarrativeContextProjectionSchema,
  type NarrativeContextProjection,
  type NarrativeEffectRequest,
} from './contracts';
import {
  NarrativeCoordinator,
  type NarrativeContextSource,
  type NarrativeCoordinatorResult,
  type NarrativeEffectContext,
  type NarrativeEffectOwner,
  type NarrativeFlowDefinition,
  type NarrativeScenarioHookRef,
  type NarrativeSessionRef,
} from './NarrativeCoordinator';
import { DEFAULT_NARRATIVE_FLOWS } from './flows';

/**
 * Canonical bridge between the engine-independent NarrativeCoordinator and the
 * one SimulationKernel authority.
 *
 * Context comes only from bounded owner reads. Effects become ordinary
 * SimulationActions; owners validate and commit them. Scenario hooks are
 * consumed through ScenarioDirector's canonical runtime.
 */
export class SimulationNarrativeAdapter implements NarrativeContextSource, NarrativeEffectOwner {
  constructor(private readonly engine: SimulationEngine) {}

  public buildContext(session: NarrativeSessionRef): NarrativeContextProjection {
    const hud = this.engine.getHudProjection();
    const status = this.engine.getPlayerStatusRead();
    const actorRead = session.actorId ? this.engine.getPlayerActorRead(session.actorId) : null;
    // Canonical in-person read: known local actor actually present at the
    // requested place. The caller initiates in-person requests from that place.
    const guest = session.placeId && session.actorId
      ? this.engine.getCafeGuestRead(session.placeId, session.actorId).guest
      : null;

    const location = session.placeId
      ? { placeId: session.placeId, coLocated: guest?.actorId === session.actorId }
      : undefined;

    const playerKnows = actorRead
      ? actorRead.playerKnowledge.facts.map((fact) => `${fact.subjectId}:${fact.predicate}`)
      : [];

    return NarrativeContextProjectionSchema.parse({
      currentDay: hud.time.day,
      currentTimeMinute: hud.time.hour * 60 + hud.time.minute,
      timeOfDay: hud.time.timeOfDay,
      player: {
        cash: hud.cash,
        energy: status.needs.energy,
        fatigue: status.needs.fatigue,
      },
      ...(actorRead
        ? {
            actor: {
              id: actorRead.actor.actorId,
              reach: actorRead.actor.reach,
              roles: [...actorRead.actor.roles],
              lifecycle: actorRead.actor.lifecycle,
              connection: actorRead.actor.connection,
              relationshipStage: actorRead.actor.relationship.stage,
              trusted: actorRead.actor.relationship.trusted,
              conflicted: actorRead.actor.relationship.conflicted,
            },
          }
        : {}),
      ...(location ? { location } : {}),
      ...(session.scenario
        ? { scenario: { instanceId: session.scenario.instanceId, hookId: session.scenario.hookId } }
        : {}),
      ...(playerKnows.length > 0 ? { knowledge: { playerKnows } } : {}),
      flags: {},
      completedBeats: [],
    });
  }

  public handleEffect(
    request: NarrativeEffectRequest,
    context: NarrativeEffectContext,
  ): { accepted: boolean; committed?: boolean; result?: unknown; error?: string } {
    const actorId = context.session.actorId;
    switch (request.type) {
      case 'request_effect': {
        if (request.effectId === 'social_act') {
          const rawAction = request.payload.arg;
          return this.applySocialAction(actorId, typeof rawAction === 'string' ? rawAction : '');
        }
        return {
          accepted: false,
          error: `No canonical owner is wired for narrative effect '${request.effectId}'.`,
        };
      }
      case 'social_act': {
        if (actorId && request.buddyId !== actorId) {
          return { accepted: false, error: 'Narrative social effect targeted an actor outside this session.' };
        }
        return this.applySocialAction(request.buddyId, request.action);
      }
      case 'world_set_flag': {
        const result = this.engine.dispatchAction({
          type: 'WORLD_SET_FLAG', key: request.key, value: request.value,
        });
        return result.success
          ? { accepted: true, committed: true, result: result.data }
          : { accepted: false, error: result.error ?? 'World flag request was rejected.' };
      }
      case 'world_trigger_event': {
        const result = this.engine.dispatchAction({
          type: 'WORLD_TRIGGER_EVENT', eventId: request.eventId,
        });
        return result.success
          ? { accepted: true, committed: true, result: result.data }
          : { accepted: false, error: result.error ?? 'World event request was rejected.' };
      }
      case 'schedule_appointment': {
        if (actorId && request.appointment.characterId !== actorId) {
          return { accepted: false, error: 'Narrative appointment targeted an actor outside this session.' };
        }
        const result = this.engine.dispatchAction({
          type: 'WORLD_SCHEDULE_APPOINTMENT', appointment: request.appointment,
        });
        return result.success
          ? { accepted: true, committed: true, result: result.data }
          : { accepted: false, error: result.error ?? 'Appointment request was rejected.' };
      }
      case 'unlock':
        return { accepted: false, error: 'No canonical unlock owner is wired for narrative effects.' };
    }
  }

  /** Explicit Scenario observation, never a generic tick scan. */
  public observeScenarioHooks(
    coordinator: NarrativeCoordinator,
    observation: ScenarioObservation,
  ): NarrativeCoordinatorResult[] {
    return this.engine
      .getScenarioHookOpportunities(observation)
      .map((opportunity) => coordinator.handleSemanticEvent({
        kind: 'scenario_hook_available',
        ...(opportunity.boundActorId ? { actorId: opportunity.boundActorId } : {}),
        scenario: toScenarioHookRef(opportunity),
      }));
  }

  /** Scenario ownership stays with ScenarioDirector; this only advances its lifecycle. */
  public consumeScenarioHook(hook: NarrativeScenarioHookRef): boolean {
    return this.engine.consumeScenarioHook(hook.instanceId, hook.hookId);
  }

  private applySocialAction(
    actorId: string | undefined,
    action: string,
  ): { accepted: boolean; committed?: boolean; result?: unknown; error?: string } {
    if (!actorId) {
      return { accepted: false, error: 'No canonical actor is bound to this narrative flow.' };
    }
    const result = this.engine.dispatchAction({
      type: 'SOCIAL_APPLY_ACTION', buddyId: actorId, socialAction: action,
    });
    return result.success
      ? { accepted: true, committed: true, result: result.data }
      : { accepted: false, error: result.error ?? 'Social action was rejected.' };
  }
}

export function createSimulationNarrative(
  engine: SimulationEngine,
  flows: readonly NarrativeFlowDefinition[] = DEFAULT_NARRATIVE_FLOWS,
): { coordinator: NarrativeCoordinator; adapter: SimulationNarrativeAdapter } {
  const adapter = new SimulationNarrativeAdapter(engine);
  const coordinator = new NarrativeCoordinator({
    flows,
    contextSource: adapter,
    effectOwner: adapter,
    consumeScenarioHook: (hook) => adapter.consumeScenarioHook(hook),
  });
  return { coordinator, adapter };
}

function toScenarioHookRef(opportunity: {
  instanceId: string;
  definitionId: string;
  hookId: string;
  roleId: string;
  boundActorId: string | null;
  presentationCue: string;
}): NarrativeScenarioHookRef {
  return {
    instanceId: opportunity.instanceId,
    definitionId: opportunity.definitionId,
    hookId: opportunity.hookId,
    roleId: opportunity.roleId,
    boundActorId: opportunity.boundActorId,
    presentationCue: opportunity.presentationCue,
  };
}

import type { CharacterIntent, CharacterIntentKind } from '../life/types';
import type {
  ContextRequirement,
  ContextRequirementResult,
} from '../physical/PhysicalContextRuntime';

export interface VenueRoleDefinition {
  id: string;
  placeId: string;
  name: string;
  roleKind: string;
  stationIds: string[];
  tags: string[];
}

export interface VenueStationDefinition {
  id: string;
  placeId: string;
  spaceId: string;
  anchorId: string | null;
  name: string;
  capacity: number;
  roleKinds: string[];
  tags: string[];
}

export interface VenueServiceDefinition {
  id: string;
  placeId: string;
  spaceId: string;
  name: string;
  intentKinds: CharacterIntentKind[];
  activityTemplateId: string;
  requiredRoleKinds: string[];
  requiredStationIds: string[];
  contextRequirements: ContextRequirement[];
  tags: string[];
}

export interface VenueActivityPhaseDefinition {
  id: string;
  durationMinutes: number;
  stationId: string | null;
}

export interface VenueActivityTemplateDefinition {
  id: string;
  placeId: string;
  name: string;
  purpose: string;
  activityKind: string;
  phases: VenueActivityPhaseDefinition[];
  completionOwner: string;
  completionKind: string;
  tags: string[];
}

export interface VenueDefinitionSet {
  roles: readonly VenueRoleDefinition[];
  stations: readonly VenueStationDefinition[];
  services: readonly VenueServiceDefinition[];
  activityTemplates: readonly VenueActivityTemplateDefinition[];
}

export type VenueRoleAssignmentStatus = 'active' | 'break' | 'inactive';

export interface VenueRoleAssignment {
  id: string;
  actorId: string;
  roleId: string;
  sourceKind: string;
  sourceId: string;
  status: VenueRoleAssignmentStatus;
  stationId: string | null;
}

export interface VenueActivityProposal {
  actorId: string;
  placeId: string;
  serviceId: string;
  activityTemplateId: string;
  purpose: string;
  activityKind: string;
  sourceKind: CharacterIntent['sourceKind'] | undefined;
  sourceId: string | undefined;
  targetActorId: string | undefined;
  intentKind: CharacterIntentKind;
  intentPriority: number;
  intentReasons: string[];
}

export type VenueActivityStatus = 'active' | 'completed';

export interface VenueActivityInstance {
  id: string;
  actorId: string;
  placeId: string;
  serviceId: string;
  activityTemplateId: string;
  purpose: string;
  activityKind: string;
  sourceKind?: CharacterIntent['sourceKind'];
  sourceId?: string;
  targetActorId?: string;
  intentKind: CharacterIntentKind;
  intentPriority: number;
  intentReasons: string[];
  status: VenueActivityStatus;
  currentPhaseIndex: number;
  phaseId: string;
  phaseStartedAtMinute: number;
  phaseEndsAtMinute: number;
  stationId: string | null;
  startedAtMinute: number;
  completedAtMinute?: number;
}

export interface VenueCompletionCommand {
  activityInstanceId: string;
  actorId: string;
  placeId: string;
  serviceId: string;
  owner: string;
  kind: string;
  sourceKind: CharacterIntent['sourceKind'] | undefined;
  sourceId: string | undefined;
  completedAtMinute: number;
}

export interface VenueRuntimeState {
  roleAssignments: Record<string, VenueRoleAssignment>;
  activities: Record<string, VenueActivityInstance>;
}

export interface VenueServiceAvailability {
  available: boolean;
  blockers: string[];
}

export type ResolveVenueActivityResult =
  | { ok: true; proposal: VenueActivityProposal }
  | { ok: false; reason: string; blockers?: string[] };

export type StartVenueActivityResult =
  | { ok: true; state: VenueRuntimeState; activity: VenueActivityInstance }
  | { ok: false; reason: string };

export interface AdvanceVenueActivitiesResult {
  state: VenueRuntimeState;
  completed: VenueCompletionCommand[];
}

function cloneAssignment(assignment: VenueRoleAssignment): VenueRoleAssignment {
  return { ...assignment };
}

function cloneActivity(activity: VenueActivityInstance): VenueActivityInstance {
  return {
    ...activity,
    intentReasons: [...activity.intentReasons],
  };
}

export function cloneVenueRuntimeState(state: VenueRuntimeState): VenueRuntimeState {
  return {
    roleAssignments: Object.fromEntries(
      Object.entries(state.roleAssignments).map(([id, assignment]) => [
        id,
        cloneAssignment(assignment),
      ]),
    ),
    activities: Object.fromEntries(
      Object.entries(state.activities).map(([id, activity]) => [
        id,
        cloneActivity(activity),
      ]),
    ),
  };
}

export function createEmptyVenueRuntimeState(): VenueRuntimeState {
  return { roleAssignments: {}, activities: {} };
}

function definitionMaps(definitions: VenueDefinitionSet) {
  return {
    roles: new Map(definitions.roles.map((role) => [role.id, role] as const)),
    stations: new Map(definitions.stations.map((station) => [station.id, station] as const)),
    services: new Map(definitions.services.map((service) => [service.id, service] as const)),
    templates: new Map(
      definitions.activityTemplates.map((template) => [template.id, template] as const),
    ),
  };
}

function stationOccupants(
  state: VenueRuntimeState,
  stationId: string,
  excludeActorId?: string,
): string[] {
  const actors = new Set<string>();

  for (const assignment of Object.values(state.roleAssignments)) {
    if (
      assignment.status !== 'inactive' &&
      assignment.stationId === stationId &&
      assignment.actorId !== excludeActorId
    ) {
      actors.add(assignment.actorId);
    }
  }

  for (const activity of Object.values(state.activities)) {
    if (
      activity.status === 'active' &&
      activity.stationId === stationId &&
      activity.actorId !== excludeActorId
    ) {
      actors.add(activity.actorId);
    }
  }

  return [...actors].sort();
}

function stationHasCapacity(
  state: VenueRuntimeState,
  station: VenueStationDefinition,
  actorId?: string,
): boolean {
  return stationOccupants(state, station.id, actorId).length < station.capacity;
}

export function setVenueRoleAssignment(
  state: VenueRuntimeState,
  assignment: VenueRoleAssignment,
  definitions: VenueDefinitionSet,
): VenueRuntimeState {
  const { roles, stations } = definitionMaps(definitions);
  const role = roles.get(assignment.roleId);
  if (!role) throw new Error(`Unknown venue role: ${assignment.roleId}.`);
  if (!assignment.id.trim()) throw new Error('Venue role assignment id must be non-empty.');
  if (!assignment.actorId.trim()) throw new Error('Venue role assignment actor id must be non-empty.');
  if (!assignment.sourceKind.trim() || !assignment.sourceId.trim()) {
    throw new Error('Venue role assignment must reference a source owner record.');
  }

  if (assignment.stationId) {
    const station = stations.get(assignment.stationId);
    if (!station) throw new Error(`Unknown venue station: ${assignment.stationId}.`);
    if (station.placeId !== role.placeId) {
      throw new Error(
        `Venue role ${role.id} cannot occupy station ${station.id} in another place.`,
      );
    }
    if (role.stationIds.length > 0 && !role.stationIds.includes(station.id)) {
      throw new Error(
        `Venue role ${role.id} is not compatible with station ${station.id}.`,
      );
    }
    if (station.roleKinds.length > 0 && !station.roleKinds.includes(role.roleKind)) {
      throw new Error(
        `Station ${station.id} does not accept role kind ${role.roleKind}.`,
      );
    }

    const candidate = cloneVenueRuntimeState(state);
    delete candidate.roleAssignments[assignment.id];
    if (!stationHasCapacity(candidate, station, assignment.actorId)) {
      throw new Error(`Venue station ${station.id} is full.`);
    }
  }

  const next = cloneVenueRuntimeState(state);
  next.roleAssignments[assignment.id] = cloneAssignment(assignment);
  return next;
}

function missingContextBlockers(result: ContextRequirementResult): string[] {
  if (result.ok) return [];
  return result.missing.map((requirement) => {
    if (requirement.kind === 'item') {
      return `missing_context:item:${requirement.itemKind}`;
    }
    return `missing_context:${requirement.kind}:${requirement.capability}`;
  });
}

export function evaluateVenueService(args: {
  serviceId: string;
  definitions: VenueDefinitionSet;
  state: VenueRuntimeState;
  actorPlaceIds: Readonly<Record<string, string | null | undefined>>;
  contextResult: ContextRequirementResult;
}): VenueServiceAvailability {
  const { roles, stations, services, templates } = definitionMaps(args.definitions);
  const service = services.get(args.serviceId);
  if (!service) return { available: false, blockers: ['unknown_service'] };
  if (!templates.has(service.activityTemplateId)) {
    return { available: false, blockers: ['missing_activity_template'] };
  }

  const blockers: string[] = [];

  for (const stationId of service.requiredStationIds) {
    const station = stations.get(stationId);
    if (!station || station.placeId !== service.placeId) {
      blockers.push(`missing_station:${stationId}`);
    }
  }

  for (const requiredRoleKind of service.requiredRoleKinds) {
    const staffed = Object.values(args.state.roleAssignments).some((assignment) => {
      if (assignment.status !== 'active') return false;
      const role = roles.get(assignment.roleId);
      if (!role) return false;
      return (
        role.placeId === service.placeId &&
        role.roleKind === requiredRoleKind &&
        args.actorPlaceIds[assignment.actorId] === service.placeId
      );
    });
    if (!staffed) blockers.push(`missing_role:${requiredRoleKind}`);
  }

  blockers.push(...missingContextBlockers(args.contextResult));

  return {
    available: blockers.length === 0,
    blockers,
  };
}

export function resolveIntentToVenueActivity(args: {
  intent: CharacterIntent;
  actorPlaceId: string | null;
  definitions: VenueDefinitionSet;
  state: VenueRuntimeState;
  actorPlaceIds: Readonly<Record<string, string | null | undefined>>;
  resolveContext: (
    spaceId: string,
    requirements: readonly ContextRequirement[],
  ) => ContextRequirementResult;
}): ResolveVenueActivityResult {
  if (args.intent.blockers.length > 0) {
    return { ok: false, reason: 'intent_blocked', blockers: [...args.intent.blockers] };
  }
  if (!args.actorPlaceId) return { ok: false, reason: 'actor_not_at_place' };
  if (
    args.intent.targetPlaceId !== undefined &&
    args.intent.targetPlaceId !== args.actorPlaceId
  ) {
    return { ok: false, reason: 'intent_target_elsewhere' };
  }

  const candidates = args.definitions.services
    .filter(
      (service) =>
        service.placeId === args.actorPlaceId &&
        service.intentKinds.includes(args.intent.kind),
    )
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const maps = definitionMaps(args.definitions);
  const unavailable: string[] = [];
  for (const service of candidates) {
    const contextResult = args.resolveContext(
      service.spaceId,
      service.contextRequirements,
    );
    const availability = evaluateVenueService({
      serviceId: service.id,
      definitions: args.definitions,
      state: args.state,
      actorPlaceIds: args.actorPlaceIds,
      contextResult,
    });
    if (!availability.available) {
      unavailable.push(...availability.blockers.map((blocker) => `${service.id}:${blocker}`));
      continue;
    }

    const template = maps.templates.get(service.activityTemplateId);
    if (!template) {
      unavailable.push(`${service.id}:missing_activity_template`);
      continue;
    }

    return {
      ok: true,
      proposal: {
        actorId: args.intent.actorId,
        placeId: service.placeId,
        serviceId: service.id,
        activityTemplateId: template.id,
        purpose: template.purpose,
        activityKind: template.activityKind,
        sourceKind: args.intent.sourceKind,
        sourceId: args.intent.sourceId,
        targetActorId: args.intent.targetActorId,
        intentKind: args.intent.kind,
        intentPriority: args.intent.priority,
        intentReasons: [...args.intent.reasons],
      },
    };
  }

  return {
    ok: false,
    reason: candidates.length === 0 ? 'no_compatible_service' : 'service_unavailable',
    ...(unavailable.length === 0 ? {} : { blockers: unavailable }),
  };
}

function activityInstanceId(proposal: VenueActivityProposal, nowMinute: number): string {
  return `activity:${proposal.actorId}:${proposal.serviceId}:${proposal.sourceId ?? 'intent'}:${nowMinute}`;
}

export function startVenueActivity(
  state: VenueRuntimeState,
  proposal: VenueActivityProposal,
  definitions: VenueDefinitionSet,
  nowMinute: number,
): StartVenueActivityResult {
  const { services, templates, stations } = definitionMaps(definitions);
  const service = services.get(proposal.serviceId);
  if (!service || service.placeId !== proposal.placeId) {
    return { ok: false, reason: 'unknown_service' };
  }
  const template = templates.get(proposal.activityTemplateId);
  if (!template || template.id !== service.activityTemplateId) {
    return { ok: false, reason: 'unknown_activity_template' };
  }
  const firstPhase = template.phases[0];
  if (!firstPhase) return { ok: false, reason: 'empty_activity_template' };

  const alreadyActive = Object.values(state.activities).some(
    (activity) => activity.status === 'active' && activity.actorId === proposal.actorId,
  );
  if (alreadyActive) return { ok: false, reason: 'actor_already_active' };

  if (firstPhase.stationId) {
    const station = stations.get(firstPhase.stationId);
    if (!station) return { ok: false, reason: `unknown_station:${firstPhase.stationId}` };
    if (!stationHasCapacity(state, station, proposal.actorId)) {
      return { ok: false, reason: `station_full:${station.id}` };
    }
  }

  const id = activityInstanceId(proposal, nowMinute);
  if (state.activities[id]) return { ok: false, reason: 'duplicate_activity_id' };

  const activity: VenueActivityInstance = {
    id,
    actorId: proposal.actorId,
    placeId: proposal.placeId,
    serviceId: proposal.serviceId,
    activityTemplateId: proposal.activityTemplateId,
    purpose: proposal.purpose,
    activityKind: proposal.activityKind,
    ...(proposal.sourceKind === undefined ? {} : { sourceKind: proposal.sourceKind }),
    ...(proposal.sourceId === undefined ? {} : { sourceId: proposal.sourceId }),
    ...(proposal.targetActorId === undefined ? {} : { targetActorId: proposal.targetActorId }),
    intentKind: proposal.intentKind,
    intentPriority: proposal.intentPriority,
    intentReasons: [...proposal.intentReasons],
    status: 'active',
    currentPhaseIndex: 0,
    phaseId: firstPhase.id,
    phaseStartedAtMinute: nowMinute,
    phaseEndsAtMinute: nowMinute + firstPhase.durationMinutes,
    stationId: firstPhase.stationId,
    startedAtMinute: nowMinute,
  };

  const next = cloneVenueRuntimeState(state);
  next.activities[id] = activity;
  return { ok: true, state: next, activity: cloneActivity(activity) };
}

function completionCommand(
  activity: VenueActivityInstance,
  template: VenueActivityTemplateDefinition,
  completedAtMinute: number,
): VenueCompletionCommand {
  return {
    activityInstanceId: activity.id,
    actorId: activity.actorId,
    placeId: activity.placeId,
    serviceId: activity.serviceId,
    owner: template.completionOwner,
    kind: template.completionKind,
    sourceKind: activity.sourceKind,
    sourceId: activity.sourceId,
    completedAtMinute,
  };
}

export function advanceVenueActivities(
  state: VenueRuntimeState,
  toMinute: number,
  definitions: VenueDefinitionSet,
): AdvanceVenueActivitiesResult {
  if (!Number.isFinite(toMinute)) throw new Error('Venue activity time must be finite.');

  const next = cloneVenueRuntimeState(state);
  const maps = definitionMaps(definitions);
  const completed: VenueCompletionCommand[] = [];

  for (const activityId of Object.keys(next.activities).sort()) {
    let activity = next.activities[activityId]!;
    if (activity.status !== 'active') continue;

    const template = maps.templates.get(activity.activityTemplateId);
    if (!template) continue;

    while (activity.status === 'active' && toMinute >= activity.phaseEndsAtMinute) {
      const transitionMinute = activity.phaseEndsAtMinute;
      const nextPhaseIndex = activity.currentPhaseIndex + 1;
      const nextPhase = template.phases[nextPhaseIndex];

      if (!nextPhase) {
        activity = {
          ...activity,
          status: 'completed',
          stationId: null,
          completedAtMinute: transitionMinute,
        };
        next.activities[activityId] = activity;
        completed.push(completionCommand(activity, template, transitionMinute));
        break;
      }

      if (nextPhase.stationId) {
        const station = maps.stations.get(nextPhase.stationId);
        if (!station) break;
        if (!stationHasCapacity(next, station, activity.actorId)) break;
      }

      activity = {
        ...activity,
        currentPhaseIndex: nextPhaseIndex,
        phaseId: nextPhase.id,
        phaseStartedAtMinute: transitionMinute,
        phaseEndsAtMinute: transitionMinute + nextPhase.durationMinutes,
        stationId: nextPhase.stationId,
      };
      next.activities[activityId] = activity;
    }
  }

  return { state: next, completed };
}

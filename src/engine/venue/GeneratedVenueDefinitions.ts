import type { CharacterIntentKind } from '../life/types';
import type { ContextRequirement } from '../physical/PhysicalContextRuntime';
import type { VenueDefinitionSet } from './VenueOperations';
import {
  GENERATED_ACTIVITY_TEMPLATES,
  GENERATED_VENUE_ROLES,
  GENERATED_VENUE_SERVICES,
  GENERATED_VENUE_STATIONS,
} from '../worldContent.generated';

export const GENERATED_VENUE_DEFINITIONS: VenueDefinitionSet = {
  roles: GENERATED_VENUE_ROLES.map((role) => ({
    id: role.id,
    placeId: role.placeId,
    name: role.name,
    roleKind: role.roleKind,
    stationIds: [...role.stationIds],
    tags: [...role.tags],
  })),
  stations: GENERATED_VENUE_STATIONS.map((station) => ({
    id: station.id,
    placeId: station.placeId,
    spaceId: station.spaceId,
    anchorId: station.anchorId,
    name: station.name,
    capacity: station.capacity,
    roleKinds: [...station.roleKinds],
    tags: [...station.tags],
  })),
  services: GENERATED_VENUE_SERVICES.map((service) => ({
    id: service.id,
    placeId: service.placeId,
    spaceId: service.spaceId,
    name: service.name,
    intentKinds: [...service.intentKinds] as CharacterIntentKind[],
    activityTemplateId: service.activityTemplateId,
    requiredRoleKinds: [...service.requiredRoleKinds],
    requiredStationIds: [...service.requiredStationIds],
    contextRequirements: service.contextRequirements.map(
      (requirement) => ({ ...requirement }) as ContextRequirement,
    ),
    tags: [...service.tags],
  })),
  activityTemplates: GENERATED_ACTIVITY_TEMPLATES.map((template) => ({
    id: template.id,
    placeId: template.placeId,
    name: template.name,
    purpose: template.purpose,
    activityKind: template.activityKind,
    phases: template.phases.map((phase) => ({
      id: phase.id,
      durationMinutes: phase.durationMinutes,
      stationId: phase.stationId,
    })),
    completionOwner: template.completionOwner,
    completionKind: template.completionKind,
    tags: [...template.tags],
  })),
};

import type { ContentTables } from '../shared';
import { validateWorldId } from '../shared';

const TAG_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
const INTENT_KINDS = new Set([
  'stay_current_activity',
  'prepare_to_leave',
  'travel_to_place',
  'perform_work',
  'attend_appointment',
  'shop_for_need',
  'visit_person',
  'return_home',
  'use_computer',
  'call_or_message',
  'rest_or_sleep',
  'pursue_personal_goal',
]);

function isTag(value: unknown): value is string {
  return typeof value === 'string' && TAG_PATTERN.test(value);
}

function rowObject(
  errors: string[],
  table: string,
  id: string,
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(table + '/' + id + ': must be an object.');
    return null;
  }
  const idCheck = validateWorldId(id);
  if (!idCheck.ok) errors.push(table + '/' + id + ': ' + idCheck.error);
  return value as Record<string, unknown>;
}

function checkName(
  errors: string[],
  table: string,
  id: string,
  row: Record<string, unknown>,
): void {
  const name = row['name'];
  if (typeof name !== 'string' || !name.trim() || name.length > 80) {
    errors.push(table + '/' + id + '.name: must be a non-empty string <= 80 chars.');
  }
}

function checkTags(
  errors: string[],
  table: string,
  id: string,
  field: string,
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    errors.push(table + '/' + id + '.' + field + ': must be an array.');
    return [];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!isTag(entry)) {
      errors.push(
        table + '/' + id + '.' + field + '[' + index + ']: ' +
        String(entry) + ' must be a lowercase semantic tag.',
      );
      return;
    }
    if (seen.has(entry)) {
      errors.push(table + '/' + id + '.' + field + '[' + index + ']: duplicate ' + entry + '.');
      return;
    }
    seen.add(entry);
    result.push(entry);
  });
  return result;
}

function validateContextRequirements(
  errors: string[],
  serviceId: string,
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    errors.push('venueServices/' + serviceId + '.contextRequirements: must be an array.');
    return;
  }

  value.forEach((requirement, index) => {
    if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) {
      errors.push(
        'venueServices/' + serviceId + '.contextRequirements[' + index + ']: must be an object.',
      );
      return;
    }
    const row = requirement as Record<string, unknown>;
    if (row['kind'] === 'item') {
      if (!isTag(row['itemKind'])) {
        errors.push(
          'venueServices/' + serviceId + '.contextRequirements[' + index +
          '].itemKind: must be a semantic tag.',
        );
      }
      if (
        !Number.isInteger(row['quantity']) ||
        Number(row['quantity']) < 1 ||
        Number(row['quantity']) > 99
      ) {
        errors.push(
          'venueServices/' + serviceId + '.contextRequirements[' + index +
          '].quantity: must be an integer 1..99.',
        );
      }
      return;
    }
    if (row['kind'] === 'tool' || row['kind'] === 'resource') {
      if (!isTag(row['capability'])) {
        errors.push(
          'venueServices/' + serviceId + '.contextRequirements[' + index +
          '].capability: must be a semantic tag.',
        );
      }
      return;
    }
    errors.push(
      'venueServices/' + serviceId + '.contextRequirements[' + index +
      '].kind: must be item, tool, or resource.',
    );
  });
}

export function validateVenueContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  const places = tables['places'] ?? {};
  const spaces = tables['spaces'] ?? {};
  const views = tables['views'] ?? {};
  const anchors = tables['anchors'] ?? {};
  const roles = tables['venueRoles'] ?? {};
  const stations = tables['venueStations'] ?? {};
  const services = tables['venueServices'] ?? {};
  const templates = tables['activityTemplates'] ?? {};

  const stationRows = new Map<string, Record<string, unknown>>();
  const roleRows = new Map<string, Record<string, unknown>>();
  const templateRows = new Map<string, Record<string, unknown>>();

  for (const [id, value] of Object.entries(stations)) {
    const row = rowObject(errors, 'venueStations', id, value);
    if (!row) continue;
    stationRows.set(id, row);
    checkName(errors, 'venueStations', id, row);

    const placeId = row['placeId'];
    const spaceId = row['spaceId'];
    if (typeof placeId !== 'string' || !places[placeId]) {
      errors.push('venueStations/' + id + '.placeId: unknown place ' + String(placeId) + '.');
    }
    const space =
      typeof spaceId === 'string'
        ? (spaces[spaceId] as Record<string, unknown> | undefined)
        : undefined;
    if (!space) {
      errors.push('venueStations/' + id + '.spaceId: unknown space ' + String(spaceId) + '.');
    } else if (space['placeId'] !== placeId) {
      errors.push(
        'venueStations/' + id + '.spaceId: space ' + String(spaceId) +
        ' does not belong to place ' + String(placeId) + '.',
      );
    }

    const anchorId = row['anchorId'];
    if (anchorId !== undefined && anchorId !== null && anchorId !== '') {
      const anchor =
        typeof anchorId === 'string'
          ? (anchors[anchorId] as Record<string, unknown> | undefined)
          : undefined;
      if (!anchor) {
        errors.push('venueStations/' + id + '.anchorId: unknown anchor ' + String(anchorId) + '.');
      } else if (space) {
        const view =
          typeof anchor['viewId'] === 'string'
            ? (views[String(anchor['viewId'])] as Record<string, unknown> | undefined)
            : undefined;
        if (!view || view['spaceId'] !== spaceId) {
          errors.push(
            'venueStations/' + id + '.anchorId: anchor ' + String(anchorId) +
            ' does not belong to space ' + String(spaceId) + '.',
          );
        }
      }
    }

    if (!Number.isInteger(row['capacity']) || Number(row['capacity']) < 1) {
      errors.push('venueStations/' + id + '.capacity: must be an integer >= 1.');
    }
    checkTags(errors, 'venueStations', id, 'roleKinds', row['roleKinds']);
    checkTags(errors, 'venueStations', id, 'tags', row['tags']);
  }

  for (const [id, value] of Object.entries(roles)) {
    const row = rowObject(errors, 'venueRoles', id, value);
    if (!row) continue;
    roleRows.set(id, row);
    checkName(errors, 'venueRoles', id, row);

    const placeId = row['placeId'];
    if (typeof placeId !== 'string' || !places[placeId]) {
      errors.push('venueRoles/' + id + '.placeId: unknown place ' + String(placeId) + '.');
    }
    if (!isTag(row['roleKind'])) {
      errors.push('venueRoles/' + id + '.roleKind: must be a lowercase semantic tag.');
    }

    if (!Array.isArray(row['stationIds'])) {
      errors.push('venueRoles/' + id + '.stationIds: must be an array.');
    } else {
      row['stationIds'].forEach((stationId, index) => {
        const station =
          typeof stationId === 'string' ? stationRows.get(stationId) : undefined;
        if (!station) {
          errors.push(
            'venueRoles/' + id + '.stationIds[' + index + ']: unknown station ' +
            String(stationId) + '.',
          );
        } else if (station['placeId'] !== placeId) {
          errors.push(
            'venueRoles/' + id + '.stationIds[' + index + ']: station ' +
            String(stationId) + ' belongs to another place.',
          );
        }
      });
    }
    checkTags(errors, 'venueRoles', id, 'tags', row['tags']);
  }

  for (const [id, value] of Object.entries(templates)) {
    const row = rowObject(errors, 'activityTemplates', id, value);
    if (!row) continue;
    templateRows.set(id, row);
    checkName(errors, 'activityTemplates', id, row);

    const placeId = row['placeId'];
    if (typeof placeId !== 'string' || !places[placeId]) {
      errors.push('activityTemplates/' + id + '.placeId: unknown place ' + String(placeId) + '.');
    }

    for (const field of ['purpose', 'activityKind', 'completionOwner', 'completionKind'] as const) {
      if (!isTag(row[field])) {
        errors.push(
          'activityTemplates/' + id + '.' + field + ': must be a lowercase semantic tag.',
        );
      }
    }

    const phases = row['phases'];
    if (!Array.isArray(phases) || phases.length === 0) {
      errors.push('activityTemplates/' + id + '.phases: must contain at least one phase.');
    } else if (phases.length > 16) {
      errors.push('activityTemplates/' + id + '.phases: max 16 phases.');
    } else {
      const seen = new Set<string>();
      phases.forEach((phase, index) => {
        if (!phase || typeof phase !== 'object' || Array.isArray(phase)) {
          errors.push(
            'activityTemplates/' + id + '.phases[' + index + ']: must be an object.',
          );
          return;
        }
        const phaseRow = phase as Record<string, unknown>;
        const phaseId = phaseRow['id'];
        if (!isTag(phaseId)) {
          errors.push(
            'activityTemplates/' + id + '.phases[' + index + '].id: must be a semantic tag.',
          );
        } else if (seen.has(phaseId)) {
          errors.push(
            'activityTemplates/' + id + '.phases[' + index + '].id: duplicate ' +
            phaseId + '.',
          );
        } else {
          seen.add(phaseId);
        }

        if (
          !Number.isInteger(phaseRow['durationMinutes']) ||
          Number(phaseRow['durationMinutes']) < 1
        ) {
          errors.push(
            'activityTemplates/' + id + '.phases[' + index +
            '].durationMinutes: must be an integer >= 1.',
          );
        }

        const stationId = phaseRow['stationId'];
        if (stationId !== undefined && stationId !== null && stationId !== '') {
          const station =
            typeof stationId === 'string' ? stationRows.get(stationId) : undefined;
          if (!station) {
            errors.push(
              'activityTemplates/' + id + '.phases[' + index +
              '].stationId: unknown station ' + String(stationId) + '.',
            );
          } else if (station['placeId'] !== placeId) {
            errors.push(
              'activityTemplates/' + id + '.phases[' + index +
              '].stationId: station ' + String(stationId) + ' belongs to another place.',
            );
          }
        }
      });
    }
    checkTags(errors, 'activityTemplates', id, 'tags', row['tags']);
  }

  for (const [id, value] of Object.entries(services)) {
    const row = rowObject(errors, 'venueServices', id, value);
    if (!row) continue;
    checkName(errors, 'venueServices', id, row);

    const placeId = row['placeId'];
    const spaceId = row['spaceId'];
    if (typeof placeId !== 'string' || !places[placeId]) {
      errors.push('venueServices/' + id + '.placeId: unknown place ' + String(placeId) + '.');
    }
    const space =
      typeof spaceId === 'string'
        ? (spaces[spaceId] as Record<string, unknown> | undefined)
        : undefined;
    if (!space) {
      errors.push('venueServices/' + id + '.spaceId: unknown space ' + String(spaceId) + '.');
    } else if (space['placeId'] !== placeId) {
      errors.push(
        'venueServices/' + id + '.spaceId: space ' + String(spaceId) +
        ' does not belong to place ' + String(placeId) + '.',
      );
    }

    const intentKinds = row['intentKinds'];
    if (!Array.isArray(intentKinds) || intentKinds.length === 0) {
      errors.push('venueServices/' + id + '.intentKinds: must contain at least one intent kind.');
    } else {
      intentKinds.forEach((kind, index) => {
        if (typeof kind !== 'string' || !INTENT_KINDS.has(kind)) {
          errors.push(
            'venueServices/' + id + '.intentKinds[' + index +
            ']: unknown CharacterIntent kind ' + String(kind) + '.',
          );
        }
      });
    }

    const templateId = row['activityTemplateId'];
    const template =
      typeof templateId === 'string' ? templateRows.get(templateId) : undefined;
    if (!template) {
      errors.push(
        'venueServices/' + id + '.activityTemplateId: unknown activity template ' +
        String(templateId) + '.',
      );
    } else if (template['placeId'] !== placeId) {
      errors.push(
        'venueServices/' + id + '.activityTemplateId: template ' +
        String(templateId) + ' belongs to another place.',
      );
    }

    const requiredRoleKinds = checkTags(
      errors,
      'venueServices',
      id,
      'requiredRoleKinds',
      row['requiredRoleKinds'],
    );
    for (const roleKind of requiredRoleKinds) {
      const exists = [...roleRows.values()].some(
        (role) => role['placeId'] === placeId && role['roleKind'] === roleKind,
      );
      if (!exists) {
        errors.push(
          'venueServices/' + id + '.requiredRoleKinds: no ' + roleKind +
          ' role exists in place ' + String(placeId) + '.',
        );
      }
    }

    const requiredStationIds = row['requiredStationIds'];
    if (!Array.isArray(requiredStationIds)) {
      errors.push('venueServices/' + id + '.requiredStationIds: must be an array.');
    } else {
      requiredStationIds.forEach((stationId, index) => {
        const station =
          typeof stationId === 'string' ? stationRows.get(stationId) : undefined;
        if (!station) {
          errors.push(
            'venueServices/' + id + '.requiredStationIds[' + index +
            ']: unknown station ' + String(stationId) + '.',
          );
        } else if (station['placeId'] !== placeId) {
          errors.push(
            'venueServices/' + id + '.requiredStationIds[' + index +
            ']: station ' + String(stationId) + ' belongs to another place.',
          );
        }
      });
    }

    validateContextRequirements(errors, id, row['contextRequirements']);
    checkTags(errors, 'venueServices', id, 'tags', row['tags']);
  }

  return errors;
}

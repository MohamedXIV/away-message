import type { ContentTables } from '../shared';
import { tsString } from '../shared';

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function optionalId(value: unknown): string {
  return value === undefined || value === null || value === ''
    ? 'null'
    : tsString(String(value));
}

function contextRequirementLiteral(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row['kind'] === 'item') {
    return (
      '{ kind: "item", itemKind: ' +
      tsString(String(row['itemKind'] ?? '')) +
      ', quantity: ' +
      Number(row['quantity'] ?? 0) +
      ' }'
    );
  }
  if (row['kind'] === 'tool' || row['kind'] === 'resource') {
    return (
      '{ kind: ' +
      tsString(String(row['kind'])) +
      ', capability: ' +
      tsString(String(row['capability'] ?? '')) +
      ' }'
    );
  }
  return null;
}

function phaseLiteral(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return (
    '{ id: ' +
    tsString(String(row['id'] ?? '')) +
    ', durationMinutes: ' +
    Number(row['durationMinutes'] ?? 0) +
    ', stationId: ' +
    optionalId(row['stationId']) +
    ' }'
  );
}

export function generateVenueWorldSource(tables: ContentTables): string {
  const roles = tables['venueRoles'] ?? {};
  const stations = tables['venueStations'] ?? {};
  const services = tables['venueServices'] ?? {};
  const templates = tables['activityTemplates'] ?? {};
  const lines: string[] = [];

  lines.push('export interface GeneratedVenueRoleDef {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  name: string;');
  lines.push('  roleKind: string;');
  lines.push('  stationIds: string[];');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export interface GeneratedVenueStationDef {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  spaceId: string;');
  lines.push('  anchorId: string | null;');
  lines.push('  name: string;');
  lines.push('  capacity: number;');
  lines.push('  roleKinds: string[];');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export type GeneratedVenueContextRequirement =');
  lines.push('  | { kind: "item"; itemKind: string; quantity: number }');
  lines.push('  | { kind: "tool"; capability: string }');
  lines.push('  | { kind: "resource"; capability: string };');
  lines.push('');

  lines.push('export interface GeneratedVenueServiceDef {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  spaceId: string;');
  lines.push('  name: string;');
  lines.push('  intentKinds: string[];');
  lines.push('  activityTemplateId: string;');
  lines.push('  requiredRoleKinds: string[];');
  lines.push('  requiredStationIds: string[];');
  lines.push('  contextRequirements: GeneratedVenueContextRequirement[];');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export interface GeneratedVenueActivityPhaseDef {');
  lines.push('  id: string;');
  lines.push('  durationMinutes: number;');
  lines.push('  stationId: string | null;');
  lines.push('}');
  lines.push('');

  lines.push('export interface GeneratedVenueActivityTemplateDef {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  name: string;');
  lines.push('  purpose: string;');
  lines.push('  activityKind: string;');
  lines.push('  phases: GeneratedVenueActivityPhaseDef[];');
  lines.push('  completionOwner: string;');
  lines.push('  completionKind: string;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_VENUE_ROLES: GeneratedVenueRoleDef[] = [');
  for (const id of Object.keys(roles).sort()) {
    const row = roles[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push('    id: ' + tsString(id) + ',');
    lines.push('    placeId: ' + tsString(String(row['placeId'] ?? '')) + ',');
    lines.push('    name: ' + tsString(String(row['name'] ?? '')) + ',');
    lines.push('    roleKind: ' + tsString(String(row['roleKind'] ?? 'worker')) + ',');
    lines.push(
      '    stationIds: [' +
        stringArray(row['stationIds']).map(tsString).join(', ') +
        '],',
    );
    lines.push('    tags: [' + stringArray(row['tags']).map(tsString).join(', ') + '],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_VENUE_STATIONS: GeneratedVenueStationDef[] = [');
  for (const id of Object.keys(stations).sort()) {
    const row = stations[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push('    id: ' + tsString(id) + ',');
    lines.push('    placeId: ' + tsString(String(row['placeId'] ?? '')) + ',');
    lines.push('    spaceId: ' + tsString(String(row['spaceId'] ?? '')) + ',');
    lines.push('    anchorId: ' + optionalId(row['anchorId']) + ',');
    lines.push('    name: ' + tsString(String(row['name'] ?? '')) + ',');
    lines.push('    capacity: ' + Number(row['capacity'] ?? 0) + ',');
    lines.push(
      '    roleKinds: [' +
        stringArray(row['roleKinds']).map(tsString).join(', ') +
        '],',
    );
    lines.push('    tags: [' + stringArray(row['tags']).map(tsString).join(', ') + '],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_VENUE_SERVICES: GeneratedVenueServiceDef[] = [');
  for (const id of Object.keys(services).sort()) {
    const row = services[id] as Record<string, unknown>;
    const requirements = Array.isArray(row['contextRequirements'])
      ? row['contextRequirements']
          .map(contextRequirementLiteral)
          .filter((entry): entry is string => entry !== null)
      : [];
    lines.push('  {');
    lines.push('    id: ' + tsString(id) + ',');
    lines.push('    placeId: ' + tsString(String(row['placeId'] ?? '')) + ',');
    lines.push('    spaceId: ' + tsString(String(row['spaceId'] ?? '')) + ',');
    lines.push('    name: ' + tsString(String(row['name'] ?? '')) + ',');
    lines.push(
      '    intentKinds: [' +
        stringArray(row['intentKinds']).map(tsString).join(', ') +
        '],',
    );
    lines.push(
      '    activityTemplateId: ' +
        tsString(String(row['activityTemplateId'] ?? '')) +
        ',',
    );
    lines.push(
      '    requiredRoleKinds: [' +
        stringArray(row['requiredRoleKinds']).map(tsString).join(', ') +
        '],',
    );
    lines.push(
      '    requiredStationIds: [' +
        stringArray(row['requiredStationIds']).map(tsString).join(', ') +
        '],',
    );
    lines.push('    contextRequirements: [' + requirements.join(', ') + '],');
    lines.push('    tags: [' + stringArray(row['tags']).map(tsString).join(', ') + '],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push(
    'export const GENERATED_ACTIVITY_TEMPLATES: GeneratedVenueActivityTemplateDef[] = [',
  );
  for (const id of Object.keys(templates).sort()) {
    const row = templates[id] as Record<string, unknown>;
    const phases = Array.isArray(row['phases'])
      ? row['phases']
          .map(phaseLiteral)
          .filter((entry): entry is string => entry !== null)
      : [];
    lines.push('  {');
    lines.push('    id: ' + tsString(id) + ',');
    lines.push('    placeId: ' + tsString(String(row['placeId'] ?? '')) + ',');
    lines.push('    name: ' + tsString(String(row['name'] ?? '')) + ',');
    lines.push('    purpose: ' + tsString(String(row['purpose'] ?? 'activity')) + ',');
    lines.push(
      '    activityKind: ' + tsString(String(row['activityKind'] ?? 'activity')) + ',',
    );
    lines.push('    phases: [' + phases.join(', ') + '],');
    lines.push(
      '    completionOwner: ' +
        tsString(String(row['completionOwner'] ?? 'none')) +
        ',',
    );
    lines.push(
      '    completionKind: ' +
        tsString(String(row['completionKind'] ?? 'completed')) +
        ',',
    );
    lines.push('    tags: [' + stringArray(row['tags']).map(tsString).join(', ') + '],');
    lines.push('  },');
  }
  lines.push('];');

  return lines.join('\n');
}

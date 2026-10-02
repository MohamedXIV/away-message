import type { ScenarioDefinition } from '../../../engine/scenario/types';
import { contentHash, tsString, type ContentTables } from '../shared';
const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string') : [];
const objects = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
function definition(id: string, row: Record<string, unknown>): ScenarioDefinition {
  const eligibility = row['eligibility'] && typeof row['eligibility'] === 'object' && !Array.isArray(row['eligibility'])
    ? row['eligibility'] as Record<string, unknown> : {};
  const presentation = row['presentation'] && typeof row['presentation'] === 'object' && !Array.isArray(row['presentation'])
    ? row['presentation'] as Record<string, unknown> : null;
  return {
    id, tags: strings(row['tags']),
    eligibility: {
      requiredWorldTags: strings(eligibility['requiredWorldTags']),
      excludedWorldTags: strings(eligibility['excludedWorldTags']),
      selectionWeight: Number(eligibility['selectionWeight'] ?? 1),
      exclusiveGroup: String(eligibility['exclusiveGroup'] ?? ''),
    },
    roles: objects(row['roles']).map((role) => ({
      id: String(role['id'] ?? ''), required: role['required'] !== false,
      allowSharedActor: role['allowSharedActor'] === true, actorRolesAny: strings(role['actorRolesAny']),
      actorTagsAll: strings(role['actorTagsAll']), actorTagsNone: strings(role['actorTagsNone']),
      reachesAny: strings(role['reachesAny']),
    })),
    initialFacts: objects(row['initialFacts']).map((fact) => ({
      id: String(fact['id'] ?? ''), kind: fact['kind'] as ScenarioDefinition['initialFacts'][number]['kind'],
      roleId: String(fact['roleId'] ?? ''), factKey: String(fact['factKey'] ?? ''),
      value: fact['value'] as ScenarioDefinition['initialFacts'][number]['value'],
      sourceRef: String(fact['sourceRef'] ?? ''),
    })),
    hooks: objects(row['hooks']).map((hook) => ({
      id: String(hook['id'] ?? ''), kind: hook['kind'] as ScenarioDefinition['hooks'][number]['kind'],
      roleId: String(hook['roleId'] ?? ''), factKey: String(hook['factKey'] ?? ''),
      oneShot: hook['oneShot'] !== false, presentationCue: String(hook['presentationCue'] ?? ''),
    })),
    ...(presentation ? { presentation: { titleKey: String(presentation['titleKey'] ?? ''),
      summaryKey: String(presentation['summaryKey'] ?? ''), hiddenUntilHookId: String(presentation['hiddenUntilHookId'] ?? '') } } : {}),
  };
}
export function generateScenarioRegistrySource(tables: ContentTables): string {
  const scenarios = tables['scenarios'] ?? {};
  const definitions = Object.keys(scenarios).sort().map((id) => definition(id, scenarios[id] ?? {}));
  return ['// GENERATED — do not edit by hand.',
    `// Source: content/store.json (content v${contentHash(tables)}). Regenerate: npm run content:pull.`,
    "import type { ScenarioDefinition } from './scenario/types';", '',
    `export const SCENARIO_CONTENT_VERSION = ${tsString(contentHash(tables))};`, '',
    'export const GENERATED_SCENARIOS = ' + JSON.stringify(definitions, null, 2)
      + ' as const satisfies readonly ScenarioDefinition[];', ''].join('\n');
}

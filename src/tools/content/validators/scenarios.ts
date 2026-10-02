import type { ContentTables } from '../shared';
import { validateWorldId } from '../shared';
const ID = /^[a-z][a-z0-9_]{1,63}$/;
function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> =>
    !!entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
}
function nonEmpty(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
export function validateScenarioContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  for (const scenarioId of Object.keys(tables['scenarios'] ?? {}).sort()) {
    const row = tables['scenarios']?.[scenarioId] ?? {};
    const idResult = validateWorldId(scenarioId);
    if (!idResult.ok) errors.push(`Scenario '${scenarioId}': ${idResult.error}`);
    const roleIds = new Set<string>();
    for (const role of rows(row['roles'])) {
      const roleId = nonEmpty(role['id']);
      if (!ID.test(roleId)) { errors.push(`Scenario '${scenarioId}' has invalid semantic role id '${roleId}'.`); continue; }
      if (roleIds.has(roleId)) errors.push(`Scenario '${scenarioId}' has duplicate role id '${roleId}'.`);
      roleIds.add(roleId);
    }
    const factIds = new Set<string>();
    for (const fact of rows(row['initialFacts'])) {
      const factId = nonEmpty(fact['id']);
      if (!ID.test(factId)) errors.push(`Scenario '${scenarioId}' has invalid seed fact id '${factId}'.`);
      if (factIds.has(factId)) errors.push(`Scenario '${scenarioId}' has duplicate seed fact id '${factId}'.`);
      factIds.add(factId);
      const roleId = nonEmpty(fact['roleId']);
      if (roleId && !roleIds.has(roleId)) errors.push(`Scenario '${scenarioId}' seed fact '${factId}' references unknown role '${roleId}'.`);
      if (!nonEmpty(fact['factKey'])) errors.push(`Scenario '${scenarioId}' seed fact '${factId}' requires factKey.`);
      if (!nonEmpty(fact['sourceRef'])) errors.push(`Scenario '${scenarioId}' seed fact '${factId}' requires sourceRef provenance.`);
    }
    const hookIds = new Set<string>();
    for (const hook of rows(row['hooks'])) {
      const hookId = nonEmpty(hook['id']);
      if (!ID.test(hookId)) errors.push(`Scenario '${scenarioId}' has invalid hook id '${hookId}'.`);
      if (hookIds.has(hookId)) errors.push(`Scenario '${scenarioId}' has duplicate hook id '${hookId}'.`);
      hookIds.add(hookId);
      const roleId = nonEmpty(hook['roleId']);
      if (roleId && !roleIds.has(roleId)) errors.push(`Scenario '${scenarioId}' hook '${hookId}' references unknown role '${roleId}'.`);
      if (hook['kind'] === 'bound_actor_colocated' && !roleId) errors.push(`Scenario '${scenarioId}' hook '${hookId}' requires roleId.`);
      if ((hook['kind'] === 'knowledge_fact' || hook['kind'] === 'search_term') && !nonEmpty(hook['factKey'])) {
        errors.push(`Scenario '${scenarioId}' hook '${hookId}' requires factKey.`);
      }
    }
    const presentation = row['presentation'];
    if (presentation && typeof presentation === 'object' && !Array.isArray(presentation)) {
      const hidden = nonEmpty((presentation as Record<string, unknown>)['hiddenUntilHookId']);
      if (hidden && !hookIds.has(hidden)) errors.push(`Scenario '${scenarioId}' presentation references unknown hook '${hidden}'.`);
    }
  }
  return errors;
}

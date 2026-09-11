import { SemanticPuppet } from './SemanticPuppet';

export type AwayPuppetToolName =
  | 'puppet.inspect'
  | 'puppet.validate'
  | 'parameter.list'
  | 'parameter.get'
  | 'parameter.set'
  | 'node.list'
  | 'part.list'
  | 'away.inspect_contract'
  | 'away.set_morph'
  | 'away.test_morph_extremes'
  | 'away.set_expression'
  | 'away.set_pose'
  | 'part.set_visibility'
  | 'part.set_tint';

export interface AwayPuppetToolService {
  listTools(): AwayPuppetToolName[];
  call(name: string, args?: unknown): unknown;
}

const MODEL_FACING_TOOLS: readonly AwayPuppetToolName[] = [
  'puppet.inspect', 'puppet.validate', 'parameter.list', 'parameter.get', 'parameter.set',
  'node.list', 'part.list', 'away.inspect_contract', 'away.set_morph', 'away.test_morph_extremes',
  'away.set_expression', 'away.set_pose', 'part.set_visibility', 'part.set_tint',
];

function requireRecord(args: unknown): Record<string, unknown> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) throw new Error('Away Puppet tool arguments must be an object');
  return args as Record<string, unknown>;
}
function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}
function requireNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a finite number`);
  return value;
}
function requireBoolean(args: Record<string, unknown>, key: string): boolean {
  const value = args[key];
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`);
  return value;
}

export function createAwayPuppetToolService(puppet: SemanticPuppet): AwayPuppetToolService {
  return {
    listTools: () => [...MODEL_FACING_TOOLS],
    call(name: string, rawArgs?: unknown): unknown {
      switch (name) {
        case 'puppet.inspect':
        case 'away.inspect_contract': return puppet.inspect();
        case 'puppet.validate': return { ok: true, contractVersion: puppet.inspect().contractVersion };
        case 'parameter.list': return [...puppet.inspect().morphs];
        case 'parameter.get': {
          const args = requireRecord(rawArgs);
          const semanticName = requireString(args, 'name');
          return { name: semanticName, value: puppet.getMorph(semanticName) };
        }
        case 'parameter.set':
        case 'away.set_morph': {
          const args = requireRecord(rawArgs);
          puppet.setMorph(requireString(args, 'name'), requireNumber(args, 'value'));
          return { ok: true };
        }
        case 'away.test_morph_extremes': {
          const args = requireRecord(rawArgs);
          const semanticName = requireString(args, 'name');
          const original = puppet.getMorph(semanticName);
          const { min, max } = puppet.getMorphBounds(semanticName);
          try {
            puppet.setMorph(semanticName, min);
            puppet.setMorph(semanticName, max);
          } finally {
            puppet.setMorph(semanticName, original);
          }
          return { name: semanticName, min, max, restored: original };
        }
        case 'node.list':
        case 'part.list': return [...puppet.inspect().slots];
        case 'away.set_expression': {
          const args = requireRecord(rawArgs); puppet.setExpression(requireString(args, 'name')); return { ok: true };
        }
        case 'away.set_pose': {
          const args = requireRecord(rawArgs); puppet.setPose(requireString(args, 'name')); return { ok: true };
        }
        case 'part.set_visibility': {
          const args = requireRecord(rawArgs); puppet.setPartVisibility(requireString(args, 'slot'), requireBoolean(args, 'visible')); return { ok: true };
        }
        case 'part.set_tint': {
          const args = requireRecord(rawArgs); puppet.setTint(requireString(args, 'channel'), requireString(args, 'color')); return { ok: true };
        }
        default: throw new Error(`Unknown Away Puppet tool: ${name}`);
      }
    },
  };
}

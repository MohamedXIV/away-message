import { SemanticPuppet } from './SemanticPuppet';

export type AwayPuppetToolName =
  | 'puppet.open'
  | 'puppet.inspect'
  | 'puppet.validate'
  | 'parameter.list'
  | 'parameter.get'
  | 'parameter.set'
  | 'node.list'
  | 'part.list'
  | 'away.inspect_contract'
  | 'away.validate_rig'
  | 'away.set_morph'
  | 'away.assign_slot'
  | 'away.test_morph_extremes'
  | 'away.set_expression'
  | 'away.set_pose'
  | 'part.set_visibility'
  | 'part.set_tint';

export interface AwayPuppetToolService {
  listTools(): AwayPuppetToolName[];
  call(name: string, args?: unknown): unknown;
  dispose(): void;
}

export interface AwayPuppetSession {
  readonly puppet: SemanticPuppet;
  dispose(): void;
}

export interface AwayPuppetOpenLifecycle {
  open(source: string): AwayPuppetSession;
  disposeInitial?: () => void;
}

const MODEL_FACING_TOOLS: readonly AwayPuppetToolName[] = [
  'puppet.open', 'puppet.inspect', 'puppet.validate', 'parameter.list', 'parameter.get', 'parameter.set',
  'node.list', 'part.list', 'away.inspect_contract', 'away.validate_rig', 'away.set_morph', 'away.assign_slot', 'away.test_morph_extremes',
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

export function createAwayPuppetToolService(
  puppet: SemanticPuppet,
  lifecycle?: AwayPuppetOpenLifecycle,
): AwayPuppetToolService {
  let current: AwayPuppetSession = {
    puppet,
    dispose: lifecycle?.disposeInitial ?? (() => undefined),
  };
  let disposed = false;

  return {
    listTools: () => [...MODEL_FACING_TOOLS],
    dispose(): void {
      if (disposed) return;
      disposed = true;
      current.dispose();
    },
    call(name: string, rawArgs?: unknown): unknown {
      if (disposed) throw new Error('Away Puppet tool service is disposed');

      switch (name) {
        case 'puppet.open': {
          const args = requireRecord(rawArgs);
          const source = requireString(args, 'source');
          if (!lifecycle) throw new Error('puppet.open is unavailable without an Away Puppet lifecycle adapter');

          const next = lifecycle.open(source);
          try {
            current.dispose();
          } catch (error) {
            next.dispose();
            throw error;
          }
          current = next;
          return { ok: true, source, inspection: current.puppet.inspect() };
        }
        case 'puppet.inspect':
        case 'away.inspect_contract': return current.puppet.inspect();
        case 'puppet.validate':
        case 'away.validate_rig': return { ok: true, contractVersion: current.puppet.inspect().contractVersion };
        case 'parameter.list': return [...current.puppet.inspect().morphs];
        case 'parameter.get': {
          const args = requireRecord(rawArgs);
          const semanticName = requireString(args, 'name');
          return { name: semanticName, value: current.puppet.getMorph(semanticName) };
        }
        case 'parameter.set':
        case 'away.set_morph': {
          const args = requireRecord(rawArgs);
          current.puppet.setMorph(requireString(args, 'name'), requireNumber(args, 'value'));
          return { ok: true };
        }
        case 'away.assign_slot': {
          const args = requireRecord(rawArgs);
          current.puppet.assignSlot(requireString(args, 'slot'), requireString(args, 'assetId'));
          return { ok: true };
        }
        case 'away.test_morph_extremes': {
          const args = requireRecord(rawArgs);
          const semanticName = requireString(args, 'name');
          const original = current.puppet.getMorph(semanticName);
          const { min, max } = current.puppet.getMorphBounds(semanticName);
          try {
            current.puppet.setMorph(semanticName, min);
            current.puppet.setMorph(semanticName, max);
          } finally {
            current.puppet.setMorph(semanticName, original);
          }
          return { name: semanticName, min, max, restored: original };
        }
        case 'node.list':
        case 'part.list': return [...current.puppet.inspect().slots];
        case 'away.set_expression': {
          const args = requireRecord(rawArgs); current.puppet.setExpression(requireString(args, 'name')); return { ok: true };
        }
        case 'away.set_pose': {
          const args = requireRecord(rawArgs); current.puppet.setPose(requireString(args, 'name')); return { ok: true };
        }
        case 'part.set_visibility': {
          const args = requireRecord(rawArgs); current.puppet.setPartVisibility(requireString(args, 'slot'), requireBoolean(args, 'visible')); return { ok: true };
        }
        case 'part.set_tint': {
          const args = requireRecord(rawArgs); current.puppet.setTint(requireString(args, 'channel'), requireString(args, 'color')); return { ok: true };
        }
        default: throw new Error(`Unknown Away Puppet tool: ${name}`);
      }
    },
  };
}

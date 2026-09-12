import type { AwayPuppetOpenLifecycle, AwayPuppetSession } from './McpSemanticTools';
import {
  SemanticPuppet,
  validateAwayRigMetadata,
  type AwayRigMetadata,
  type RawPuppetAdapter,
} from './SemanticPuppet';

export interface InochiWebRuntimeParameter {
  readonly name: string;
  value: number[];
}

export interface InochiWebRuntimeNode {
  readonly name: string;
  readonly children: ReadonlyArray<InochiWebRuntimeNode | null>;
  enabled: boolean;
}

export interface InochiWebRuntimePuppet {
  readonly parameters: readonly InochiWebRuntimeParameter[];
  readonly root: InochiWebRuntimeNode | null;
  free(): void;
}

export interface InochiWebRuntimeModule {
  readonly Puppet: new (bytes: ArrayBufferLike) => InochiWebRuntimePuppet;
}

export interface InochiWebLifecycleSource {
  readonly source: string;
  readonly bytes: ArrayBufferLike;
  readonly metadata: AwayRigMetadata;
}

export type InochiWebSourceLoader = (source: string) => InochiWebLifecycleSource;

function indexNodes(root: InochiWebRuntimeNode | null): Map<string, InochiWebRuntimeNode> {
  const nodes = new Map<string, InochiWebRuntimeNode>();

  const visit = (node: InochiWebRuntimeNode | null): void => {
    if (!node) return;
    if (nodes.has(node.name)) {
      throw new Error(`Duplicate Inochi node name is ambiguous for Away metadata: ${node.name}`);
    }
    nodes.set(node.name, node);
    for (const child of node.children) visit(child);
  };

  visit(root);
  return nodes;
}

class InochiWebRawPuppetAdapter implements RawPuppetAdapter {
  private readonly parameters: Map<string, InochiWebRuntimeParameter>;
  private readonly nodes: Map<string, InochiWebRuntimeNode>;

  constructor(puppet: InochiWebRuntimePuppet) {
    this.parameters = new Map();
    for (const parameter of puppet.parameters) {
      if (this.parameters.has(parameter.name)) {
        throw new Error(`Duplicate Inochi parameter name is ambiguous for Away metadata: ${parameter.name}`);
      }
      this.parameters.set(parameter.name, parameter);
    }
    this.nodes = indexNodes(puppet.root);
  }

  hasParameter(id: string): boolean { return this.parameters.has(id); }
  hasNode(id: string): boolean { return this.nodes.has(id); }

  getParameter(id: string): number {
    const parameter = this.parameters.get(id);
    if (!parameter) throw new Error(`Unknown Inochi parameter: ${id}`);
    return parameter.value[0] ?? 0;
  }

  setParameter(id: string, value: number): void {
    const parameter = this.parameters.get(id);
    if (!parameter) throw new Error(`Unknown Inochi parameter: ${id}`);
    const next = [...parameter.value];
    if (next.length === 0) next.push(value);
    else next[0] = value;
    parameter.value = next;
  }

  setNodeVisibility(id: string, visible: boolean): void {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown Inochi node: ${id}`);
    node.enabled = visible;
  }

  setNodeTint(id: string, _color: string): void {
    if (!this.nodes.has(id)) throw new Error(`Unknown Inochi node: ${id}`);
    throw new Error('Node tint is unavailable through the pinned Inochi Web runtime adapter');
  }
}

/**
 * Concrete lifecycle bridge from the pinned upstream Web wrapper shape into
 * Away's semantic runtime. The source loader owns bytes + Away metadata;
 * this adapter owns the raw Puppet lifetime after construction.
 *
 * Deliberately absent: `assignSlot`. The pinned upstream high-level Web API
 * has no real modular part/texture replacement operation, so SemanticPuppet
 * must continue to reject `away.assign_slot` rather than faking it with node
 * visibility.
 */
export function createInochiWebLifecycle(
  module: InochiWebRuntimeModule,
  loadSource: InochiWebSourceLoader,
): AwayPuppetOpenLifecycle {
  return {
    open: (source: string): AwayPuppetSession => {
      const loaded = loadSource(source);
      const rawPuppet = new module.Puppet(loaded.bytes);

      try {
        const raw = new InochiWebRawPuppetAdapter(rawPuppet);
        const metadata = validateAwayRigMetadata(loaded.metadata, raw);
        const puppet = new SemanticPuppet(raw, metadata);
        let disposed = false;

        return {
          puppet,
          dispose: () => {
            if (disposed) return;
            disposed = true;
            rawPuppet.free();
          },
        };
      } catch (error) {
        rawPuppet.free();
        throw error;
      }
    },
  };
}

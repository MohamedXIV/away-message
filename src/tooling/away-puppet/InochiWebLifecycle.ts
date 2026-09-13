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
  assignPartTexture?(nodeName: string, textureIndex: number, attachment: number): void;
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
  private readonly slotsByNode: Map<string, AwayRigMetadata['slots'][string]>;

  constructor(
    private readonly puppet: InochiWebRuntimePuppet,
    metadata: AwayRigMetadata,
  ) {
    this.parameters = new Map();
    for (const parameter of puppet.parameters) {
      if (this.parameters.has(parameter.name)) {
        throw new Error(`Duplicate Inochi parameter name is ambiguous for Away metadata: ${parameter.name}`);
      }
      this.parameters.set(parameter.name, parameter);
    }
    this.nodes = indexNodes(puppet.root);
    this.slotsByNode = new Map();
    for (const slot of Object.values(metadata.slots)) {
      if (this.slotsByNode.has(slot.nodeId)) {
        throw new Error(`Duplicate Away slot node mapping is ambiguous: ${slot.nodeId}`);
      }
      this.slotsByNode.set(slot.nodeId, slot);
    }
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

  assignSlot(nodeId: string, assetId: string): void {
    if (!this.nodes.has(nodeId)) throw new Error(`Unknown Inochi node: ${nodeId}`);
    if (typeof this.puppet.assignPartTexture !== 'function') {
      throw new Error('Slot assignment is unavailable through the pinned Inochi Web runtime adapter');
    }
    const slot = this.slotsByNode.get(nodeId);
    const asset = slot?.assets?.[assetId];
    if (!asset) throw new Error(`Unknown slot asset ${assetId} for node ${nodeId}`);
    this.puppet.assignPartTexture(nodeId, asset.textureIndex, asset.attachment ?? 0);
  }
}

/**
 * Concrete lifecycle bridge from the pinned upstream Web wrapper shape into
 * Away's semantic runtime. The source loader owns bytes + Away metadata;
 * this adapter owns the raw Puppet lifetime after construction.
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
        const raw = new InochiWebRawPuppetAdapter(rawPuppet, loaded.metadata);
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
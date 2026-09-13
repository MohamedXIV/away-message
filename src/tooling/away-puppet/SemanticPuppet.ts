export interface RawPuppetAdapter {
  hasParameter(id: string): boolean;
  hasNode(id: string): boolean;
  getParameter(id: string): number;
  setParameter(id: string, value: number): void;
  setNodeVisibility(id: string, visible: boolean): void;
  setNodeTint(id: string, color: string): void;
  assignSlot?(nodeId: string, assetId: string): void;
}

export interface AwayMorphDefinition {
  readonly parameterId: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

export interface AwaySlotDefinition {
  readonly nodeId: string;
}

export interface AwayTintDefinition {
  readonly nodeIds: readonly string[];
}

export interface AwayParameterPresetDefinition {
  readonly parameters: Readonly<Record<string, number>>;
}

export interface AwayRigMetadata {
  readonly namespace: string;
  readonly contractVersion: number;
  readonly morphs: Readonly<Record<string, AwayMorphDefinition>>;
  readonly slots: Readonly<Record<string, AwaySlotDefinition>>;
  readonly tints: Readonly<Record<string, AwayTintDefinition>>;
  readonly expressions: Readonly<Record<string, AwayParameterPresetDefinition>>;
  readonly poses: Readonly<Record<string, AwayParameterPresetDefinition>>;
}

export interface ValidatedAwayRigMetadata extends AwayRigMetadata {
  readonly namespace: 'away-message/puppet';
  readonly contractVersion: 1;
}

export interface PuppetInspection {
  readonly morphs: string[];
  readonly slots: string[];
  readonly tints: string[];
  readonly expressions: string[];
  readonly poses: string[];
  readonly contractVersion: 1;
}

function validatePresetMappings(
  kind: 'expression' | 'pose',
  presets: Readonly<Record<string, AwayParameterPresetDefinition>>,
  raw: RawPuppetAdapter,
): void {
  for (const [name, preset] of Object.entries(presets)) {
    for (const [parameterId, value] of Object.entries(preset.parameters)) {
      if (!raw.hasParameter(parameterId)) throw new Error(`Mapped parameter ${parameterId} for ${kind} ${name} does not exist`);
      if (!Number.isFinite(value)) throw new Error(`Mapped parameter ${parameterId} for ${kind} ${name} must be finite`);
    }
  }
}

export function validateAwayRigMetadata(metadata: AwayRigMetadata, raw: RawPuppetAdapter): ValidatedAwayRigMetadata {
  if (metadata.namespace !== 'away-message/puppet') throw new Error(`Unsupported Away rig namespace: ${metadata.namespace}`);
  if (metadata.contractVersion !== 1) throw new Error(`Unsupported Away rig contract version: ${metadata.contractVersion}`);
  for (const [name, morph] of Object.entries(metadata.morphs)) {
    if (!Number.isFinite(morph.min) || !Number.isFinite(morph.max) || morph.min > morph.max) throw new Error(`Invalid bounds for morph ${name}`);
    if (morph.default < morph.min || morph.default > morph.max) throw new Error(`Default for morph ${name} is outside its bounds`);
    if (!raw.hasParameter(morph.parameterId)) throw new Error(`Mapped parameter ${morph.parameterId} for morph ${name} does not exist`);
  }
  for (const [name, slot] of Object.entries(metadata.slots)) if (!raw.hasNode(slot.nodeId)) throw new Error(`Mapped node ${slot.nodeId} for slot ${name} does not exist`);
  for (const [name, tint] of Object.entries(metadata.tints)) {
    if (tint.nodeIds.length === 0) throw new Error(`Tint ${name} must map at least one node`);
    for (const nodeId of tint.nodeIds) if (!raw.hasNode(nodeId)) throw new Error(`Mapped node ${nodeId} for tint ${name} does not exist`);
  }
  validatePresetMappings('expression', metadata.expressions, raw);
  validatePresetMappings('pose', metadata.poses, raw);
  return { namespace: 'away-message/puppet', contractVersion: 1, morphs: { ...metadata.morphs }, slots: { ...metadata.slots }, tints: { ...metadata.tints }, expressions: { ...metadata.expressions }, poses: { ...metadata.poses } };
}

export class SemanticPuppet {
  constructor(private readonly raw: RawPuppetAdapter, private readonly metadata: ValidatedAwayRigMetadata) {}

  inspect(): PuppetInspection {
    return { morphs: Object.keys(this.metadata.morphs), slots: Object.keys(this.metadata.slots), tints: Object.keys(this.metadata.tints), expressions: Object.keys(this.metadata.expressions), poses: Object.keys(this.metadata.poses), contractVersion: this.metadata.contractVersion };
  }

  getMorph(name: string): number {
    const morph = this.metadata.morphs[name];
    if (!morph) throw new Error(`Unknown morph: ${name}`);
    return this.raw.getParameter(morph.parameterId);
  }

  getMorphBounds(name: string): { min: number; max: number } {
    const morph = this.metadata.morphs[name];
    if (!morph) throw new Error(`Unknown morph: ${name}`);
    return { min: morph.min, max: morph.max };
  }

  setMorph(name: string, value: number): void {
    const morph = this.metadata.morphs[name];
    if (!morph) throw new Error(`Unknown morph: ${name}`);
    if (!Number.isFinite(value) || value < morph.min || value > morph.max) throw new Error(`Morph ${name} value ${value} is outside [${morph.min}, ${morph.max}]`);
    this.raw.setParameter(morph.parameterId, value);
  }

  assignSlot(slotName: string, assetId: string): void {
    const slot = this.metadata.slots[slotName];
    if (!slot) throw new Error(`Unknown slot: ${slotName}`);
    if (typeof this.raw.assignSlot !== 'function') throw new Error('Slot assignment is unavailable for this puppet adapter');
    this.raw.assignSlot(slot.nodeId, assetId);
  }

  setPartVisibility(slotName: string, visible: boolean): void {
    const slot = this.metadata.slots[slotName];
    if (!slot) throw new Error(`Unknown slot: ${slotName}`);
    this.raw.setNodeVisibility(slot.nodeId, visible);
  }

  setTint(channel: string, color: string): void {
    const tint = this.metadata.tints[channel];
    if (!tint) throw new Error(`Unknown tint: ${channel}`);
    for (const nodeId of tint.nodeIds) this.raw.setNodeTint(nodeId, color);
  }

  setExpression(name: string): void {
    const expression = this.metadata.expressions[name];
    if (!expression) throw new Error(`Unknown expression: ${name}`);
    for (const [parameterId, value] of Object.entries(expression.parameters)) this.raw.setParameter(parameterId, value);
  }

  setPose(name: string): void {
    const pose = this.metadata.poses[name];
    if (!pose) throw new Error(`Unknown pose: ${name}`);
    for (const [parameterId, value] of Object.entries(pose.parameters)) this.raw.setParameter(parameterId, value);
  }
}

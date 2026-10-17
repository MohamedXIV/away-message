import type {
  ActorCondition, RelationshipDimensions, RelationshipStage, SocialEngineState,
} from '../types';
import { conditionFromLegacyStatus, projectLegacyBuddyStatus } from '../semantic/ActorCondition';

export const STRAINED_ANNOYANCE = 60;

/** Deterministic action table; unknown actions deliberately preserve familiarity fallback. */
export const PLAYER_SOCIAL_ACTION_DELTAS: Readonly<Record<string, Partial<RelationshipDimensions>>> = {
  empathy: { familiarity: 3, trust: 4, comfort: 5, respect: 2, annoyance: -2, affection: 1 },
  remembered_detail: { familiarity: 5, trust: 6, comfort: 6, respect: 4, annoyance: -1, affection: 1 },
  tease_playful: { familiarity: 4, trust: 2, comfort: 3, respect: 2, annoyance: 0, affection: 1 },
  dismissive: { familiarity: -1, trust: -5, comfort: -6, respect: -3, annoyance: 8, suspicion: 2, resentment: 4 },
  vulnerable_share: { familiarity: 6, trust: 7, comfort: 8, respect: 3, annoyance: -2, affection: 4 },
  work_camaraderie: { familiarity: 4, trust: 3, comfort: 4, respect: 3, annoyance: 0, affection: 1 },
  intellectual_curiosity: { familiarity: 4, trust: 5, comfort: 2, respect: 6, annoyance: 0 },
  apologize: { trust: 2, respect: 2, comfort: 2, annoyance: -3, resentment: -3 },
  betray_confidence: { trust: -12, respect: -8, comfort: -8, annoyance: 10, suspicion: 8, resentment: 12, affection: -6 },
};

export interface PlayerRelationshipPolicy {
  normalize: (id: string) => string;
  normalizeDims: (dims: Partial<RelationshipDimensions> | undefined) => RelationshipDimensions;
  actorExists: (id: string) => boolean;
}

/**
 * #173 canonical player↔actor dimensions AND separate lifecycle/contact truth.
 * Stages and legacy BuddyCharacter.status are derived, never stored.
 * NPC↔NPC bonds are owned by the separate NpcRelationshipGraph.
 */
export class PlayerRelationships {
  private readonly dimensions = new Map<string, RelationshipDimensions>();
  private readonly conditions = new Map<string, ActorCondition>();

  constructor(private readonly policy: PlayerRelationshipPolicy) {}

  public clear(): void { this.dimensions.clear(); this.conditions.clear(); }
  public clearDimensions(): void { this.dimensions.clear(); }
  public clearConditions(): void { this.conditions.clear(); }
  public forget(rawId: string): void {
    const id = this.policy.normalize(rawId);
    this.dimensions.delete(id);
    this.conditions.delete(id);
  }

  public has(rawId: string): boolean { return this.dimensions.has(this.policy.normalize(rawId)); }

  /** Authored defaults/explicit load only. Mutations use governed adjust/apply. */
  public put(rawId: string, dims: RelationshipDimensions): void {
    this.dimensions.set(this.policy.normalize(rawId), { ...dims });
  }

  public get(rawId: string): RelationshipDimensions | undefined {
    const dims = this.dimensions.get(this.policy.normalize(rawId));
    return dims ? { ...dims } : undefined;
  }

  public putCondition(rawId: string, condition: ActorCondition): void {
    this.conditions.set(this.policy.normalize(rawId), { ...condition });
  }

  public forgetCondition(rawId: string): void { this.conditions.delete(this.policy.normalize(rawId)); }

  public getCondition(rawId: string): ActorCondition | undefined {
    const condition = this.conditions.get(this.policy.normalize(rawId));
    return condition ? { ...condition } : undefined;
  }

  public defaultCondition(rawId: string): ActorCondition {
    return this.getCondition(rawId) ?? conditionFromLegacyStatus();
  }

  public stage(rawId: string): RelationshipStage {
    const rel = this.dimensions.get(this.policy.normalize(rawId));
    if (!rel) return 'stranger';
    if (rel.annoyance >= STRAINED_ANNOYANCE) return 'strained';
    if (rel.familiarity < 10) return 'stranger';
    if (rel.familiarity < 35) return 'acquaintance';
    if (rel.familiarity < 65 || rel.trust < 50) return 'friend';
    return 'close';
  }

  public projectedStatus(rawId: string) {
    return projectLegacyBuddyStatus(this.defaultCondition(rawId), this.stage(rawId));
  }

  public applyAction(rawId: string, action: string): {
    dimensions: RelationshipDimensions; delta: Partial<RelationshipDimensions>;
  } {
    const id = this.policy.normalize(rawId);
    const current = this.dimensions.get(id);
    if (!current) throw new Error(`Buddy not found: ${id}`);
    const delta = PLAYER_SOCIAL_ACTION_DELTAS[action] || { familiarity: 1 };
    const base = this.policy.normalizeDims(current);
    const clamp = (value: number) => Math.max(0, Math.min(100, value));
    const updated: RelationshipDimensions = {
      familiarity: clamp(base.familiarity + (delta.familiarity ?? 0)),
      trust: clamp(base.trust + (delta.trust ?? 0)),
      comfort: clamp(base.comfort + (delta.comfort ?? 0)),
      respect: clamp(base.respect + (delta.respect ?? 0)),
      annoyance: clamp(base.annoyance + (delta.annoyance ?? 0)),
      affection: clamp(base.affection + (delta.affection ?? 0)),
      attraction: clamp(base.attraction + (delta.attraction ?? 0)),
      suspicion: clamp(base.suspicion + (delta.suspicion ?? 0)),
      resentment: clamp(base.resentment + (delta.resentment ?? 0)),
    };
    this.dimensions.set(id, updated);
    return { dimensions: { ...updated }, delta };
  }

  public adjust(rawId: string, partial: Partial<RelationshipDimensions>): RelationshipDimensions {
    const id = this.policy.normalize(rawId);
    const current = this.dimensions.get(id);
    if (!current) throw new Error(`Buddy not found: ${id}`);
    const base = this.policy.normalizeDims(current);
    const updated: RelationshipDimensions = { ...base };
    for (const [k, value] of Object.entries(partial)) {
      const key = k as keyof RelationshipDimensions;
      if (typeof value === 'number' && Number.isFinite(value) && key in base) {
        updated[key] = Math.max(0, Math.min(100, Math.round(value)));
      }
    }
    this.dimensions.set(id, updated);
    return { ...updated };
  }

  /** Existing persistence format: neither stage nor projection is serialized. */
  public exportState(): Pick<SocialEngineState, 'relationships' | 'actorConditions'> {
    const relationships: Record<string, RelationshipDimensions> = {};
    for (const [id, rel] of this.dimensions) relationships[id] = { ...rel };
    const actorConditions: Record<string, ActorCondition> = {};
    for (const [id, condition] of this.conditions) {
      if (this.policy.actorExists(id)) actorConditions[id] = { ...condition };
    }
    return { relationships, actorConditions };
  }

  public restoreDimensions(state: SocialEngineState['relationships']): void {
    this.dimensions.clear();
    for (const [rawId, dims] of Object.entries(state)) {
      this.put(rawId, this.policy.normalizeDims(dims));
    }
  }
}

import type {
  BuddyCharacter, NpcBondDims, NpcBondState, NpcRomanceStage,
  RelationshipDimensions, SocialEngineState,
} from '../types';

/** Private state owner, never a second simulation or social-graph authority. */
export interface NpcGraphPolicy {
  normalize: (id: string) => string;
  affinityKey: (a: string, b: string) => string;
  bondKey: (from: string, to: string) => string;
  neutral: () => NpcBondState;
  normalizeDims: (value: Partial<RelationshipDimensions> | undefined) => RelationshipDimensions;
  actorExists: (id: string) => boolean;
  actors: () => Iterable<BuddyCharacter>;
  emit: (kind: 'social:npc_bond_updated' | 'social:npc_romance_changed', payload: unknown) => void;
  actionDeltas: Readonly<Record<string, Partial<NpcBondDims>>>;
  maxAffinity: number;
  roomBumpPerTurn: number;
  roomBumpDailyCap: number;
}

/**
 * #173 — canonical sparse NPC ↔ NPC graph.
 *
 * Symmetric affinity and directed bonds have different keys and independent
 * rules, but one source-owned lifecycle. Reads never materialize neutral
 * stranger pairs; writes go through SocialEngine's governed public API.
 * Snapshots contain only irreducible non-neutral/explicit records and a
 * bounded rolling room-pair/day anti-farming ledger.
 */
export class NpcRelationshipGraph {
  private readonly affinities = new Map<string, number>();
  private readonly affinityCaps = new Map<string, number>();
  private readonly bonds = new Map<string, NpcBondState>();
  /**
   * Derived lookup keys only. The bonds Map alone owns relationship truth.
   * A source without directed edges can now skip full roster enumeration.
   */
  private readonly bondTargets = new Map<string, Set<string>>();

  private indexBond(from: string, to: string): void {
    let targets = this.bondTargets.get(from);
    if (!targets) {
      targets = new Set<string>();
      this.bondTargets.set(from, targets);
    }
    targets.add(to);
  }

  private rebuildBondIndex(): void {
    this.bondTargets.clear();
    for (const key of this.bonds.keys()) {
      const parts = key.split('__');
      if (parts.length === 2) this.indexBond(parts[0]!, parts[1]!);
    }
  }

  constructor(private readonly policy: NpcGraphPolicy) {}

  public forget(rawId: string): void {
    const id = this.policy.normalize(rawId);
    for (const key of [...this.bonds.keys()]) {
      if (key.split('__').includes(id)) this.bonds.delete(key);
    }
    this.rebuildBondIndex();
    for (const key of [...this.affinities.keys()]) {
      if (key.split('__').includes(id)) this.affinities.delete(key);
    }
    for (const key of [...this.affinityCaps.keys()]) {
      const pairPart = key.slice(0, key.lastIndexOf('_'));
      if (pairPart.split('__').includes(id)) this.affinityCaps.delete(key);
    }
  }

  /** Explicit persistence export only, independent of UI change publication. */
  public exportState(): Pick<SocialEngineState, 'affinities' | 'affinityCaps' | 'npcBonds'> {
    const affinities: Record<string, number> = {};
    for (const [key, value] of this.affinities) affinities[key] = value;
    const affinityCaps: Record<string, number> = {};
    for (const [key, value] of this.affinityCaps) affinityCaps[key] = value;
    const npcBonds: Record<string, NpcBondState> = {};
    for (const [key, bond] of this.bonds) {
      npcBonds[key] = {
        dims: { ...bond.dims }, romance: bond.romance,
        romanceSinceDay: bond.romanceSinceDay, updatedDay: bond.updatedDay,
      };
    }
    return { affinities, affinityCaps, npcBonds };
  }

  /** Restore the existing save shape and preserve its exact validation law. */
  public restoreState(state: Pick<SocialEngineState, 'affinities' | 'affinityCaps' | 'npcBonds'>): void {
    this.affinities.clear();
    if (state.affinities) {
      for (const [key, value] of Object.entries(state.affinities)) {
        if (typeof key !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) continue;
        const parts = key.split('__');
        if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) continue;
        if (this.policy.affinityKey(parts[0], parts[1]) !== key) continue;
        this.affinities.set(key, Math.max(-this.policy.maxAffinity, Math.min(this.policy.maxAffinity, Math.round(value))));
      }
    }
    this.affinityCaps.clear();
    if (state.affinityCaps) {
      for (const [key, value] of Object.entries(state.affinityCaps)) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
        this.affinityCaps.set(key, Math.min(this.policy.roomBumpDailyCap, Math.round(value)));
      }
    }
    this.bonds.clear();
    if (state.npcBonds) {
      for (const [key, bond] of Object.entries(state.npcBonds)) {
        if (typeof key !== 'string' || !bond || typeof bond !== 'object') continue;
        const parts = key.split('__');
        if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) continue;
        if (this.policy.bondKey(parts[0], parts[1]) !== key) continue;
        const dims = this.policy.normalizeDims((bond as NpcBondState).dims as Partial<RelationshipDimensions>);
        const romance = (bond as NpcBondState).romance;
        this.bonds.set(key, {
          dims: {
            familiarity: dims.familiarity, trust: dims.trust, comfort: dims.comfort,
            respect: dims.respect, affection: dims.affection, attraction: dims.attraction,
            annoyance: dims.annoyance, suspicion: dims.suspicion, resentment: dims.resentment,
          },
          romance: romance === 'crush' || romance === 'dating' ? romance : 'none',
          romanceSinceDay: Number.isFinite((bond as NpcBondState).romanceSinceDay)
            ? Math.max(1, Math.floor((bond as NpcBondState).romanceSinceDay)) : 1,
          updatedDay: Number.isFinite((bond as NpcBondState).updatedDay)
            ? Math.max(1, Math.floor((bond as NpcBondState).updatedDay)) : 1,
        });
      }
    }
    this.rebuildBondIndex();
  }

  /** Authored seeds fill gaps only for *existing* canonical actors.
   * A fresh procedural world deliberately has no legacy named roster;
   * seeding absent actor pairs would create invisible phantom graph edges.
   */
  public seedMissing(seeds: Readonly<Record<string, number>>): void {
    for (const [key, value] of Object.entries(seeds)) {
      const pair = key.split('__');
      if (pair.length !== 2 ||
        !this.policy.actorExists(pair[0]!) || !this.policy.actorExists(pair[1]!)) continue;
      if (!this.affinities.has(key)) this.affinities.set(key, value);
    }
  }

  public getAffinity(rawA: string, rawB: string): number {
    const a = this.policy.normalize(rawA);
    const b = this.policy.normalize(rawB);
    if (a === b) return 0;
    return this.affinities.get(this.policy.affinityKey(a, b)) ?? 0;
  }

  public adjustAffinity(rawA: string, rawB: string, delta: number): number {
    const a = this.policy.normalize(rawA);
    const b = this.policy.normalize(rawB);
    if (a === b || !this.policy.actorExists(a) || !this.policy.actorExists(b)) return this.getAffinity(a, b);
    if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) return this.getAffinity(a, b);
    const next = Math.max(-this.policy.maxAffinity,
      Math.min(this.policy.maxAffinity, Math.round(this.getAffinity(a, b) + delta)));
    this.affinities.set(this.policy.affinityKey(a, b), next);
    return next;
  }

  public bumpRoomAffinity(participants: string[], day: number, points = this.policy.roomBumpPerTurn): number {
    const ids = [...new Set(participants.map(this.policy.normalize))]
      .filter(id => this.policy.actorExists(id));
    if (ids.length < 2) return 0;
    const gain = Math.max(0, Math.min(this.policy.roomBumpPerTurn + 1, Math.floor(points) || 0));
    if (gain === 0) return 0;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    let bumped = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = this.policy.affinityKey(ids[i]!, ids[j]!);
        const capKey = `${key}_${safeDay}`;
        const used = this.affinityCaps.get(capKey) ?? 0;
        if (used >= this.policy.roomBumpDailyCap) continue;
        const add = Math.min(gain, this.policy.roomBumpDailyCap - used);
        this.adjustAffinity(ids[i]!, ids[j]!, add);
        this.affinityCaps.set(capKey, used + add);
        bumped++;
      }
    }
    for (const capKey of [...this.affinityCaps.keys()]) {
      const dayPart = Number(capKey.slice(capKey.lastIndexOf('_') + 1));
      if (Number.isFinite(dayPart) && dayPart < safeDay - 2) this.affinityCaps.delete(capKey);
    }
    return bumped;
  }

  public buildAffinityContext(rawBuddyId: string): string {
    const buddyId = this.policy.normalize(rawBuddyId);
    if (!this.policy.actorExists(buddyId)) return '';
    const entries: Array<{ name: string; label: string; value: number }> = [];
    for (const other of this.policy.actors()) {
      if (other.id === buddyId) continue;
      const value = this.getAffinity(buddyId, other.id);
      if (Math.abs(value) < 5) continue;
      const label = value >= 30 ? 'deep bond' : value >= 10 ? 'warm'
        : value <= -30 ? 'bitter' : 'tense';
      entries.push({ name: other.displayName, label, value });
    }
    if (entries.length === 0) return '';
    entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return `Others: ${entries.slice(0, 6).map(e =>
      `${e.name}: ${e.label} (${e.value >= 0 ? '+' : ''}${e.value})`).join(' • ')}`;
  }

  /**
   * Source-owned Life Matrix projection. Only stored directed edges can
   * be non-neutral. Iterate actual actors to retain historic roster order,
   * even when writes arrive in a different order. Return detached dims.
   */
  public getNotableBondDimensions(rawFrom: string): Array<{ targetId: string } & NpcBondDims> {
    const from = this.policy.normalize(rawFrom);
    const targets = this.bondTargets.get(from);
    if (!targets?.size || !this.policy.actorExists(from)) return [];

    const result: Array<{ targetId: string } & NpcBondDims> = [];
    for (const actor of this.policy.actors()) {
      if (actor.id === from || !targets.has(actor.id)) continue;
      const bond = this.bonds.get(this.policy.bondKey(from, actor.id));
      if (!bond) continue;
      if (bond.romance === 'none' && !Object.values(bond.dims).some(value => value !== 0)) continue;
      result.push({ targetId: actor.id, ...bond.dims });
    }
    return result;
  }

  public getBond(rawFrom: string, rawTo: string): NpcBondState {
    const key = this.policy.bondKey(rawFrom, rawTo);
    const stored = key ? this.bonds.get(key) : undefined;
    if (!stored) return this.policy.neutral();
    return {
      dims: { ...stored.dims }, romance: stored.romance,
      romanceSinceDay: stored.romanceSinceDay, updatedDay: stored.updatedDay,
    };
  }

  public adjustBond(rawFrom: string, rawTo: string, partial: Partial<NpcBondDims>, day: number): NpcBondState | null {
    const from = this.policy.normalize(rawFrom);
    const to = this.policy.normalize(rawTo);
    if (!from || !to || from === to || !this.policy.actorExists(from) || !this.policy.actorExists(to)) return null;
    const current = this.getBond(from, to);
    const dims: NpcBondDims = { ...current.dims };
    for (const [k, v] of Object.entries(partial)) {
      const key = k as keyof NpcBondDims;
      if (typeof v === 'number' && Number.isFinite(v) && key in dims) {
        dims[key] = Math.max(0, Math.min(100, Math.round(dims[key] + v)));
      }
    }
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const next: NpcBondState = {
      dims, romance: current.romance,
      romanceSinceDay: current.romanceSinceDay, updatedDay: safeDay,
    };
    this.bonds.set(this.policy.bondKey(from, to), next);
    this.indexBond(from, to);
    this.policy.emit('social:npc_bond_updated', {
      fromId: from, toId: to, bond: { ...next, dims: { ...dims } },
    });
    return this.getBond(from, to);
  }

  public applyAction(rawFrom: string, rawTo: string, action: string, day: number): NpcBondState | null {
    const delta = this.policy.actionDeltas[action];
    if (!delta) return this.getBond(rawFrom, rawTo);
    return this.adjustBond(rawFrom, rawTo, delta, day);
  }

  public setRomance(rawFrom: string, rawTo: string, stage: NpcRomanceStage, day: number): NpcBondState | null {
    const from = this.policy.normalize(rawFrom);
    const to = this.policy.normalize(rawTo);
    if (!from || !to || from === to || !this.policy.actorExists(from) || !this.policy.actorExists(to)) return null;
    if (stage !== 'none' && stage !== 'crush' && stage !== 'dating') return null;
    const current = this.getBond(from, to);
    const safeDay = Math.max(1, Math.floor(day) || 1);
    if (current.romance === stage) return current;
    const next: NpcBondState = {
      ...current, dims: { ...current.dims },
      romance: stage, romanceSinceDay: stage === 'none' ? 1 : safeDay,
      updatedDay: safeDay,
    };
    this.bonds.set(this.policy.bondKey(from, to), next);
    this.indexBond(from, to);
    this.policy.emit('social:npc_romance_changed', {
      fromId: from, toId: to, stage, day: safeDay,
    });
    return this.getBond(from, to);
  }

  public isDatingAnyone(rawId: string): boolean {
    const id = this.policy.normalize(rawId);
    for (const other of this.policy.actors()) {
      if (other.id === id) continue;
      if (this.getBond(id, other.id).romance === 'dating') return true;
      if (this.getBond(other.id, id).romance === 'dating') return true;
    }
    return false;
  }

  public buildBondContext(rawBuddyId: string): string {
    const id = this.policy.normalize(rawBuddyId);
    if (!this.policy.actorExists(id)) return '';
    const entries: Array<{ text: string; weight: number }> = [];
    for (const other of this.policy.actors()) {
      if (other.id === id) continue;
      const out = this.getBond(id, other.id);
      const back = this.getBond(other.id, id);
      const net = out.dims.affection - out.dims.annoyance - out.dims.resentment
        + back.dims.affection - back.dims.annoyance - back.dims.resentment;
      const romance = out.romance === 'dating' || back.romance === 'dating' ? 'dating'
        : out.romance === 'crush' || back.romance === 'crush' ? 'crush' : 'none';
      if (romance === 'none' && Math.abs(net) < 10) continue;
      const since = out.romance !== 'none' ? out.romanceSinceDay : back.romanceSinceDay;
      const label = romance === 'dating' ? `dating since d${since}`
        : romance === 'crush' ? 'crush'
        : net >= 30 ? 'deep bond' : net >= 10 ? 'warm' : net <= -30 ? 'bitter' : 'tense';
      entries.push({
        text: `${other.displayName}: ${label}`,
        weight: romance !== 'none' ? 1000 + Math.abs(net) : Math.abs(net),
      });
    }
    if (entries.length === 0) return '';
    entries.sort((x, y) => y.weight - x.weight);
    return `Ties: ${entries.slice(0, 6).map(e => e.text).join(' • ')}`;
  }

  public buildRomanceContext(rawBuddyId: string): string {
    const id = this.policy.normalize(rawBuddyId);
    if (!this.policy.actorExists(id)) return 'Romance: single';
    const involvements: string[] = [];
    for (const other of this.policy.actors()) {
      if (other.id === id) continue;
      const out = this.getBond(id, other.id);
      const back = this.getBond(other.id, id);
      const stage: NpcRomanceStage = out.romance === 'dating' || back.romance === 'dating'
        ? 'dating' : out.romance === 'crush' || back.romance === 'crush' ? 'crush' : 'none';
      if (stage === 'none') continue;
      const since = out.romance !== 'none' ? out.romanceSinceDay : back.romanceSinceDay;
      involvements.push(stage === 'dating'
        ? `dating ${other.displayName} since day ${since}`
        : `crush on ${other.displayName}`);
    }
    return involvements.length > 0
      ? `Romance: ${involvements.slice(0, 3).join('; ')}` : 'Romance: single';
  }
}

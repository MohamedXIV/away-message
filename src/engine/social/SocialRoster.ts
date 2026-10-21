import type { BuddyCharacter, BuddyLifecycleStatus, RelationshipDimensions, SocialEngineState } from '../types';
import { validateCharacterId, isValidSchedule, traitsForBuddy, clampTraits, resolveArchetype } from '../characterTemplates';
import { sanitizeLanguages, validatePersistedBuddy } from '../CharacterEngine';
import { SEED_CHARACTERS, seedCharacterDef, isSeedCharacter } from '../seedCharacters';
import { resolveReachForMetVia } from './ReachPolicy';

/** #173: single actor identity/definition owner. Stage, contact, relations,
 * presence, memories and transcripts are never stored alongside the roster.
 * Internal iterators are coordinator reads; only methods here mutate identities.
 */
export class SocialRoster implements Iterable<[string, BuddyCharacter]> {
  private readonly records = new Map<string, BuddyCharacter>();


  constructor(
    private readonly normalize: (id: string) => string,
    private readonly normalizeDims: (dims: Partial<RelationshipDimensions> | undefined) => RelationshipDimensions,
  ) {}

  public get size(): number { return this.records.size; }
  public has(rawId: string): boolean { return this.records.has(this.normalize(rawId)); }
  public get(rawId: string): BuddyCharacter | undefined { return this.records.get(this.normalize(rawId)); }
  public keys(): IterableIterator<string> { return this.records.keys(); }
  public values(): IterableIterator<BuddyCharacter> { return this.records.values(); }
  public entries(): IterableIterator<[string, BuddyCharacter]> { return this.records.entries(); }
  public [Symbol.iterator](): IterableIterator<[string, BuddyCharacter]> { return this.entries(); }

  /** Seed identities; authored structural conditions go to PlayerRelationships. */
  public initializeSeeds(onAuthoredStatus: (id: string, status: BuddyLifecycleStatus | undefined) => void): void {
    this.records.clear();
    for (const buddy of SEED_CHARACTERS) {
      const stored = seedCharacterDef(buddy.id);
      onAuthoredStatus(buddy.id, stored.status);
      delete stored.status;
      this.records.set(buddy.id, stored);
    }
  }

  /** Runtime actor validation and normalization without social side effects. */
  public register(def: BuddyCharacter): { id: string; initialRelationships: RelationshipDimensions; status: BuddyLifecycleStatus | undefined } {
    const id = this.normalize(def.id);
    const idCheck = validateCharacterId(id);
    if (!idCheck.ok) throw new Error(idCheck.error);
    if (this.records.has(id)) throw new Error(`Buddy already registered: ${id}`);
    if (!def.displayName?.trim()) throw new Error('Buddy displayName must be non-empty.');
    if (!def.handle?.trim()) throw new Error('Buddy handle must be non-empty.');
    if (!isValidSchedule(def.schedule)) throw new Error(`Buddy '${id}' has an invalid schedule.`);
    if (typeof def.typingSpeedWpm !== 'number' || def.typingSpeedWpm < 20 || def.typingSpeedWpm > 140) {
      throw new Error(`Buddy '${id}' has an invalid typingSpeedWpm.`);
    }
    const explicitReach = (def as Partial<BuddyCharacter>).reach;
    const stored: BuddyCharacter = {
      ...def,
      id,
      displayName: def.displayName.slice(0, 40),
      handle: def.handle.slice(0, 40),
      initialRelationships: this.normalizeDims(def.initialRelationships),
      // v3-era defs predate temperament: backfill deterministically (never random).
      traits: clampTraits({
        ...traitsForBuddy(id, def.archetype ?? resolveArchetype(id, undefined)),
        ...((def as Partial<BuddyCharacter>).traits ?? {}),
      }),
      // Free roster identity backfills (older defs predate these fields).
      // Missing reach follows the actor's recorded source; online surfaces
      // must never become local merely because the field was absent.
      reach: explicitReach === 'local' || explicitReach === 'remote'
        ? explicitReach
        : resolveReachForMetVia(def.metVia),
      appearance: {
        hair: String((def as Partial<BuddyCharacter>).appearance?.hair || 'brown').trim().slice(0, 24) || 'brown',
        eyes: String((def as Partial<BuddyCharacter>).appearance?.eyes || 'brown').trim().slice(0, 24) || 'brown',
      },
      languages: sanitizeLanguages((def as Partial<BuddyCharacter>).languages),
      roles: Array.isArray((def as Partial<BuddyCharacter>).roles)
        ? ((def as Partial<BuddyCharacter>).roles as unknown[]).filter((r): r is string => typeof r === 'string' && /^[a-z][a-z0-9_-]{1,23}$/.test(r)).slice(0, 6)
        : [],
      schedule: Object.fromEntries(
        Object.entries(def.schedule).map(([day, blks]) => [Number(day), blks.map((b) => ({ ...b }))])
      ),
    };

    const status = def.status;
    delete stored.status;
    this.records.set(id, stored);
    return { id, initialRelationships: { ...stored.initialRelationships }, status };
  }

  /** Change physical scope without replacing identity or social history. */
  public setReach(
    rawId: string,
    reach: 'local' | 'remote',
  ): { id: string; previousReach: 'local' | 'remote'; reach: 'local' | 'remote' } | null {
    const id = this.normalize(rawId);
    const existing = this.records.get(id);
    if (!existing) return null;
    const previousReach = existing.reach === 'remote' ? 'remote' : 'local';
    if (previousReach !== reach) this.records.set(id, { ...existing, reach });
    return { id, previousReach, reach };
  }

  /** All other owner cleanup and events remain SocialEngine's responsibility. */
  public remove(rawId: string): boolean { return this.records.delete(this.normalize(rawId)); }

  /** Whole-world export only; preserve current persisted procedural and seed shape. */
  public exportState(): Pick<SocialEngineState, 'buddies' | 'removedSeedActorIds'> {
    // Persist generated/non-registry definitions. Seed definitions come from content,
    // while their per-save lifecycle divergence is persisted separately.
    const buddyDefs: Record<string, BuddyCharacter> = {};
    for (const [id, b] of this.records.entries()) {
      if (isSeedCharacter(id)) continue;
      const identity = { ...b };
      delete identity.status; // an old exported status would duplicate canonical truth
      buddyDefs[id] = {
        ...identity,
        initialRelationships: { ...b.initialRelationships },
        traits: { ...b.traits },
        appearance: { ...(b.appearance ?? { hair: 'brown', eyes: 'brown' }) },
        languages: (b.languages ?? [{ lang: 'en', level: 5 }]).map((l) => ({ ...l })),
        roles: [...(b.roles ?? [])],
        backstory: b.backstory
          ? { ...b.backstory, candidates: b.backstory.candidates.map((c) => ({ ...c })) }
          : undefined,
        schedule: Object.fromEntries(
          Object.entries(b.schedule).map(([day, blks]) => [Number(day), blks.map((blk) => ({ ...blk }))])
        ),
      };
    }

    const removedSeedActorIds = SEED_CHARACTERS
      .filter(seed => !this.records.has(seed.id)).map(seed => seed.id);


    return { buddies: buddyDefs, removedSeedActorIds };
  }

  /** Replace identities; report authored contact hints without owning contact state. */
  public restore(
    state: SocialEngineState,
    onAuthoredStatus: (id: string, status: BuddyLifecycleStatus | undefined) => void,
    onRemovedSeed: (id: string) => void,
  ): void {
    this.initializeSeeds(onAuthoredStatus);
    for (const rawId of state.removedSeedActorIds ?? []) {
      const id = this.normalize(rawId);
      if (isSeedCharacter(id)) {
        this.records.delete(id);
        onRemovedSeed(id);
      }
    }
    if (state.buddies) {
      for (const [rawId, def] of Object.entries(state.buddies)) {
        const id = this.normalize(rawId);
        if (this.records.has(id) || isSeedCharacter(id)) continue;
        const res = validatePersistedBuddy({ ...def, id });
        if (!res.ok || !res.definition) continue;
        const stored: BuddyCharacter = { ...res.definition };
        onAuthoredStatus(id, stored.status);
        delete stored.status;
        this.records.set(id, stored);
      }
    }
  }
}

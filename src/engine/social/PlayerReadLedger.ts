import type { CharacterTraits, PlayerReadState, SocialEngineState } from '../types';
import { clampTraits } from '../characterTemplates';

/** Canonical bounded NPC beliefs about the player, not NPC actual knowledge or relationship authority. */
export class PlayerReadLedger {
  private readonly values = new Map<string, PlayerReadState>();
  constructor(private readonly normalize: (id: string) => string,
    private readonly actorExists: (id: string) => boolean) {}

  public forget(rawId: string): void { this.values.delete(this.normalize(rawId)); }
  public exportState(): NonNullable<SocialEngineState['playerReads']> {
    const rows: NonNullable<SocialEngineState['playerReads']> = {};
    for (const [id, read] of this.values) {
      rows[id] = { beliefs: { ...read.beliefs }, certainty: read.certainty, updatedDay: read.updatedDay };
    }
    return rows;
  }
  public restore(source: SocialEngineState['playerReads']): void {
    this.values.clear();
    if (!source) return;
    for (const [rawId, read] of Object.entries(source)) {
      const id = this.normalize(rawId);
      if (!read || typeof read !== 'object') continue;
      const beliefs = clampTraits((read as PlayerReadState).beliefs as Partial<CharacterTraits>);
      const certainty = (read as PlayerReadState).certainty;
      this.values.set(id, {
        beliefs,
        certainty: typeof certainty === 'number' && Number.isFinite(certainty)
          ? Math.max(0, Math.min(100, Math.round(certainty))) : 0,
        updatedDay: Number.isFinite((read as PlayerReadState).updatedDay)
          ? Math.max(1, Math.floor((read as PlayerReadState).updatedDay)) : 1,
      });
    }
  }

  // ---------- Reads of the player ----------

  /** Neutral prior: strangers assume an average stranger (certainty 0). */
  public static neutral(): PlayerReadState {
    return {
      beliefs: { shyness: 50, warmth: 50, discipline: 50, spontaneity: 50, loyalty: 50 },
      certainty: 0,
      updatedDay: 1,
    };
  }

  /** A buddy's current read of the player (copy; unknown buddies read neutral). */
  public get(rawId: string): PlayerReadState {
    const stored = this.values.get(this.normalize(rawId));
    if (!stored) return PlayerReadLedger.neutral();
    return { beliefs: { ...stored.beliefs }, certainty: stored.certainty, updatedDay: stored.updatedDay };
  }

  /**
   * Fold one observation into a buddy's read (beliefs 0..100 per dim).
   * Early observations swing hard; certainty (+8 each, capped) slows learning —
   * first impressions form fast and correct slowly. Unknown buddies are ignored.
   */
  public observe(rawId: string, obs: Partial<CharacterTraits>, day: number): void {
    const id = this.normalize(rawId);
    if (!this.actorExists(id)) return;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const current = this.values.get(id) ?? PlayerReadLedger.neutral();
    const beliefs: CharacterTraits = { ...current.beliefs };
    for (const [k, v] of Object.entries(obs)) {
      const key = k as keyof CharacterTraits;
      if (typeof v !== 'number' || !Number.isFinite(v) || !(key in beliefs)) continue;
      const target = Math.max(0, Math.min(100, Math.round(v)));
      const rate = 0.25 * (1 - (current.certainty / 100) * 0.6);
      beliefs[key] = Math.max(0, Math.min(100, Math.round(beliefs[key] + (target - beliefs[key]) * rate)));
    }
    this.values.set(id, {
      beliefs,
      certainty: Math.min(100, current.certainty + 8),
      updatedDay: safeDay,
    });
  }

  /**
   * Blend two buddies' reads toward each other (they compared notes about the
   * player). Only when both are fairly sure (certainty >= 40); silent by
   * design — the shift surfaces in their "read of you" lines, not in a log.
   */
  public align(rawA: string, rawB: string, day: number): boolean {
    const a = this.normalize(rawA);
    const b = this.normalize(rawB);
    if (!a || !b || a === b || !this.actorExists(a) || !this.actorExists(b)) return false;
    const readA = this.values.get(a);
    const readB = this.values.get(b);
    if (!readA || !readB || readA.certainty < 40 || readB.certainty < 40) return false;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const blend = (mine: number, theirs: number): number =>
      Math.max(0, Math.min(100, Math.round(mine + (theirs - mine) * 0.1)));
    const beliefsA: CharacterTraits = {
      shyness: blend(readA.beliefs.shyness, readB.beliefs.shyness),
      warmth: blend(readA.beliefs.warmth, readB.beliefs.warmth),
      discipline: blend(readA.beliefs.discipline, readB.beliefs.discipline),
      spontaneity: blend(readA.beliefs.spontaneity, readB.beliefs.spontaneity),
      loyalty: blend(readA.beliefs.loyalty, readB.beliefs.loyalty),
    };
    const beliefsB: CharacterTraits = {
      shyness: blend(readB.beliefs.shyness, readA.beliefs.shyness),
      warmth: blend(readB.beliefs.warmth, readA.beliefs.warmth),
      discipline: blend(readB.beliefs.discipline, readA.beliefs.discipline),
      spontaneity: blend(readB.beliefs.spontaneity, readA.beliefs.spontaneity),
      loyalty: blend(readB.beliefs.loyalty, readA.beliefs.loyalty),
    };
    this.values.set(a, { beliefs: beliefsA, certainty: readA.certainty, updatedDay: safeDay });
    this.values.set(b, { beliefs: beliefsB, certainty: readB.certainty, updatedDay: safeDay });
    return true;
  }

  /**
   * Qualitative "read of you" line for prompts ("quiet but kind, warming up").
   * Empty while the buddy has no real impression yet (certainty < 25) so the
   * model defaults to stranger-polite instead of inventing judgments.
   */
  public buildContext(rawId: string): string {
    const id = this.normalize(rawId);
    if (!this.actorExists(id)) return '';
    const read = this.values.get(id);
    if (!read || read.certainty < 25) return '';
    const b = read.beliefs;
    const labels: string[] = [];
    if (b.shyness >= 65) labels.push('quiet');
    else if (b.shyness <= 35) labels.push('outgoing');
    if (b.warmth >= 65) labels.push('kind');
    else if (b.warmth <= 35) labels.push('distant');
    if (b.spontaneity >= 65) labels.push('spontaneous');
    else if (b.spontaneity <= 35) labels.push('homebody');
    if (b.loyalty >= 65) labels.push('trustworthy');
    else if (b.loyalty <= 35) labels.push('unreliable');
    if (b.discipline >= 65) labels.push('reliable');
    else if (b.discipline <= 35) labels.push('flaky');
    const confidence = read.certainty >= 60 ? 'clearly' : read.certainty >= 40 ? 'starting to seem' : 'maybe';
    const traits = labels.slice(0, 3).join(', ') || 'hard to read';
    return `Their read of you: ${traits} (${confidence})`;
  }
}

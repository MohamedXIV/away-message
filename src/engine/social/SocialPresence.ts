import type { ActorCondition, BuddyCharacter, BuddyPresence, SocialEngineState } from '../types';

interface PresencePolicy {
  normalize: (id: string) => string;
  actors: () => Iterable<[string, BuddyCharacter]>;
  condition: (id: string) => ActorCondition | undefined;
  emit: (actorId: string, presence: BuddyPresence) => void;
  isKnown: (id: string) => boolean;
}

/**
 * One source-owned online/away presence registry. Reads contact/lifecycle law
 * but never owns a shadow of it. World minute (not wall-clock) drives updates.
 */
export class SocialPresence {
  private readonly values = new Map<string, BuddyPresence>();

  constructor(private readonly policy: PresencePolicy) {}

  public forget(rawId: string): void { this.values.delete(this.policy.normalize(rawId)); }
  public clear(): void { this.values.clear(); }
  public has(rawId: string): boolean { return this.values.has(this.policy.normalize(rawId)); }

  /** Seed/restore only: no simulated status event from rebuilding a save. */
  public put(rawId: string, presence: BuddyPresence): void {
    this.values.set(this.policy.normalize(rawId), { ...presence });
  }

  public ensure(rawId: string): void {
    if (!this.has(rawId)) this.put(rawId, { status: 'offline', awayMessage: '' });
  }

  public get(rawId: string): BuddyPresence | undefined {
    const presence = this.values.get(this.policy.normalize(rawId));
    return presence ? { ...presence } : undefined;
  }

  public exportState(): Pick<SocialEngineState, 'presence'> {
    const presence: Record<string, BuddyPresence> = {};
    for (const [id, value] of this.values) presence[id] = { ...value };
    return { presence };
  }

  public restore(source: SocialEngineState['presence']): void {
    this.values.clear();
    for (const [rawId, value] of Object.entries(source)) this.put(rawId, value);
  }

  public summary(playerKnownOnly = false): Record<string, BuddyPresence> {
    const rows: Record<string, BuddyPresence> = {};
    for (const [id, presence] of this.values) {
      if (playerKnownOnly && id !== 'player' && !this.policy.isKnown(id)) continue;
      rows[id] = { ...presence };
    }
    return rows;
  }

  public setPlayer(presence: BuddyPresence): void {
    this.put('player', presence);
    // Player manual status emits even when writing identical status (existing law).
    this.policy.emit('player', { ...presence });
  }

  public update(currentTotalMinutes: number): void {
    const day = Math.floor(currentTotalMinutes / 1440) + 1;
    const minuteOfDay = currentTotalMinutes % 1440;
    for (const [id, buddy] of this.policy.actors()) {
      const condition = this.policy.condition(id);
      if (condition?.lifecycle === 'departed' || condition?.contact === 'distant'
        || condition?.contact === 'blocked') {
        const previous = this.values.get(id);
        if (!previous || previous.status !== 'offline') {
          const offline: BuddyPresence = { status: 'offline', awayMessage: '' };
          this.values.set(id, offline);
          this.policy.emit(id, { ...offline });
        }
        continue;
      }
      const weeklyDay = ((day - 1) % 7) + 1;
      const schedule = buddy.schedule[day] || buddy.schedule[weeklyDay] || buddy.schedule[1];
      let current = schedule?.find(block =>
        minuteOfDay >= block.startMinuteOfDay && minuteOfDay < block.endMinuteOfDay);
      if (!current && schedule && schedule.length > 0) current = schedule[0];
      if (!current) continue;
      const previous = this.values.get(id);
      if (!previous || previous.status !== current.status || previous.awayMessage !== current.awayMessage) {
        const presence: BuddyPresence = { status: current.status, awayMessage: current.awayMessage };
        this.values.set(id, presence);
        this.policy.emit(id, { ...presence });
      }
    }
  }
}

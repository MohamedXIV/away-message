import type { AgendaItem, NpcInteractionLog, SocialEngineState } from '../types';

/** One owner for the authored NPC daily agenda and bounded witnessable NPC activity log.
 * Neither is actor identity, social knowledge, or an emitted event.
 */
export class SocialActivityLedger {
  private readonly agendas = new Map<string, AgendaItem[]>();
  private witnesses: NpcInteractionLog[] = [];

  constructor(
    private readonly normalize: (id: string) => string,
    private readonly actorExists: (id: string) => boolean,
    private readonly maxAgendaPerDay: number,
    private readonly maxWitnesses: number,
  ) {}

  public forget(rawId: string): void {
    const id = this.normalize(rawId);
    this.agendas.delete(id);
    this.witnesses = this.witnesses.filter(l => l.firstId !== id && l.secondId !== id);
  }

  public exportState(): Pick<SocialEngineState, 'agenda' | 'npcSocialLog'> {
    const agenda: Record<string, AgendaItem[]> = {};
    for (const [id, items] of this.agendas.entries()) agenda[id] = items.map(a => ({ ...a }));
    return { agenda, npcSocialLog: this.witnesses.map(l => ({ ...l })) };
  }

  /** Read and validate only the current owner fields. No mutation/events outside this owner. */
  public restore(state: Pick<SocialEngineState, 'agenda' | 'npcSocialLog'>): void {
    this.agendas.clear();
    if (state.agenda) {
      for (const [rawId, items] of Object.entries(state.agenda)) {
        const id = this.normalize(rawId);
        if (!Array.isArray(items)) continue;
        const clean: AgendaItem[] = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const kind = (item as AgendaItem).kind;
          if (kind !== 'sleep' && kind !== 'work' && kind !== 'social' && kind !== 'errand') continue;
          const start = (item as AgendaItem).startMinute;
          const end = (item as AgendaItem).endMinute;
          const day = (item as AgendaItem).day;
          if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(day)) continue;
          clean.push({
            id: String((item as AgendaItem).id || `ag_${clean.length}`),
            kind,
            label: String((item as AgendaItem).label || kind).trim().replace(/\s+/g, ' ').slice(0, 60) || kind,
            day: Math.max(1, Math.floor(day)),
            startMinute: Math.max(0, Math.min(1439, Math.floor(start))),
            endMinute: Math.max(1, Math.min(1440, Math.floor(end))),
          });
          if (clean.length >= this.maxAgendaPerDay * 7) break;
        }
        if (clean.length > 0) this.agendas.set(id, clean);
      }
    }

    this.witnesses = [];
    if (Array.isArray(state.npcSocialLog)) {
      for (const item of state.npcSocialLog) {
        if (!item || typeof item !== 'object') continue;
        const firstId = this.normalize(String((item as NpcInteractionLog).firstId ?? ''));
        const secondId = this.normalize(String((item as NpcInteractionLog).secondId ?? ''));
        if (!firstId || !secondId || firstId === secondId) continue;
        this.witnesses.push({
          id: String((item as NpcInteractionLog).id || `nl_${this.witnesses.length}`),
          day: Number.isFinite((item as NpcInteractionLog).day) ? Math.max(1, Math.floor((item as NpcInteractionLog).day)) : 1,
          firstId,
          secondId,
          location: String((item as NpcInteractionLog).location || 'around town').slice(0, 40),
          line: String((item as NpcInteractionLog).line || '').slice(0, 140),
        });
        if (this.witnesses.length >= this.maxWitnesses) break;
      }
    }

  }

  /** Planned blocks for a buddy (optionally one day), earliest-first. Copies, never live refs. */
  public getAgenda(rawId: string, day?: number): AgendaItem[] {
    const items = this.agendas.get(this.normalize(rawId)) ?? [];
    const list = (day === undefined ? items : items.filter((a) => a.day === day)).map((a) => ({ ...a }));
    list.sort((x, y) => x.startMinute - y.startMinute);
    return list;
  }

  /** Replace a buddy's agenda (validated, per-day capped). Throws for unknown buddies. */
  public setAgenda(rawId: string, items: AgendaItem[]): AgendaItem[] {
    const id = this.normalize(rawId);
    if (!this.actorExists(id)) throw new Error(`Buddy not found: ${id}`);
    const perDay = new Map<number, number>();
    const clean: AgendaItem[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const kind = (item as AgendaItem).kind;
      if (kind !== 'sleep' && kind !== 'work' && kind !== 'social' && kind !== 'errand') continue;
      const day = (item as AgendaItem).day;
      const start = (item as AgendaItem).startMinute;
      const end = (item as AgendaItem).endMinute;
      if (!Number.isFinite(day) || !Number.isFinite(start) || !Number.isFinite(end)) continue;
      const safeDay = Math.max(1, Math.floor(day));
      const used = perDay.get(safeDay) ?? 0;
      if (used >= this.maxAgendaPerDay) continue;
      perDay.set(safeDay, used + 1);
      clean.push({
        id: String((item as AgendaItem).id || `ag_${safeDay}_${clean.length}`),
        kind,
        label: String((item as AgendaItem).label || kind).trim().replace(/\s+/g, ' ').slice(0, 60) || kind,
        day: safeDay,
        startMinute: Math.max(0, Math.min(1439, Math.floor(start))),
        endMinute: Math.max(1, Math.min(1440, Math.floor(end))),
      });
    }
    clean.sort((x, y) => x.day - y.day || x.startMinute - y.startMinute);
    this.agendas.set(id, clean);
    return clean.map((a) => ({ ...a }));
  }


  // Bounded witness ledger, not a persistent free-text history.
  /** Record a witnessable NPC↔NPC moment (capped; oldest evicted). */
  public logNpcInteraction(entry: Omit<NpcInteractionLog, 'id'>): NpcInteractionLog {
    const record: NpcInteractionLog = {
      id: `nl_${entry.day}_${entry.firstId}_${entry.secondId}`,
      day: Math.max(1, Math.floor(entry.day) || 1),
      firstId: this.normalize(entry.firstId),
      secondId: this.normalize(entry.secondId),
      location: String(entry.location || 'around town').slice(0, 40),
      line: String(entry.line || '').slice(0, 140),
    };
    const existing = this.witnesses.findIndex((l) => l.id === record.id);
    if (existing !== -1) this.witnesses.splice(existing, 1);
    this.witnesses.push(record);
    while (this.witnesses.length > this.maxWitnesses) this.witnesses.shift();
    return { ...record };
  }

  public getNpcSocialLog(day?: number): NpcInteractionLog[] {
    const list = day === undefined ? this.witnesses : this.witnesses.filter((l) => l.day === day);
    return list.map((l) => ({ ...l }));
  }


}

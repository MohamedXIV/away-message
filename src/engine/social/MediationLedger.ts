import type { MediationKind, MediationRecord, SocialEngineState } from '../types';
import { rollSeeded100 } from '../characterTemplates';

/** One canonical mediation record owner. SocialEngine coordinates consequences and events. */
export class MediationLedger {
  private records: MediationRecord[] = [];
  constructor(private readonly normalize: (id: string) => string,
    private readonly actorExists: (id: string) => boolean,
    private readonly maxOpen: number) {}

  public forgetActor(rawId: string): void {
    const id = this.normalize(rawId);
    this.records = this.records.filter(m => m.requesterId !== id && m.targetId !== id);
  }
  public exportRecords(): MediationRecord[] { return this.records.map(m => ({ ...m })); }

  public restore(source: SocialEngineState['mediations']): void {
    this.records = [];
    if (Array.isArray(source)) {
      for (const item of source) {
        if (!item || typeof item !== 'object') continue;
        const kind = (item as MediationRecord).kind;
        const status = (item as MediationRecord).status;
        if (kind !== 'introduce' && kind !== 'strengthen' && kind !== 'ask_about') continue;
        if (status !== 'open' && status !== 'fulfilled' && status !== 'ignored' && status !== 'sabotaged' && status !== 'exposed') continue;
        const requesterId = this.normalize(String((item as MediationRecord).requesterId ?? ''));
        const targetId = this.normalize(String((item as MediationRecord).targetId ?? ''));
        if (!requesterId || !targetId || requesterId === targetId) continue;
        this.records.push({
          id: String((item as MediationRecord).id || `med_${this.records.length}`),
          requesterId,
          targetId,
          kind,
          status,
          createdDay: Number.isFinite((item as MediationRecord).createdDay) ? Math.max(1, Math.floor((item as MediationRecord).createdDay)) : 1,
          ...(Number.isFinite((item as MediationRecord).resolvedDay) ? { resolvedDay: Math.max(1, Math.floor((item as MediationRecord).resolvedDay as number)) } : {}),
        });
        if (this.records.length >= this.maxOpen * 2) break;
      }
    }
  }

  public request(rawRequester: string, rawTarget: string, kind: MediationKind, day: number): MediationRecord | null {
    const requesterId = this.normalize(rawRequester);
    const targetId = this.normalize(rawTarget);
    if (!requesterId || !targetId || requesterId === targetId) return null;
    if (!this.actorExists(requesterId) || !this.actorExists(targetId)) return null;
    if (kind !== 'introduce' && kind !== 'strengthen' && kind !== 'ask_about') return null;
    if (this.records.some((m) => m.status === 'open' && m.requesterId === requesterId && m.targetId === targetId && m.kind === kind)) return null;
    if (this.records.filter((m) => m.status === 'open').length >= this.maxOpen) return null;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    let id = `med_${requesterId}_${targetId}_${kind}_${safeDay}`;
    let n = 2;
    while (this.records.some((m) => m.id === id)) id = `med_${requesterId}_${targetId}_${kind}_${safeDay}_${n++}`;
    const record: MediationRecord = { id, requesterId, targetId, kind, status: 'open', createdDay: safeDay };
    this.records.push(record);
    return { ...record };
  }

  public get(mediationId: string): MediationRecord | undefined {
    const found = this.records.find((m) => m.id === mediationId);
    return found ? { ...found } : undefined;
  }

  public getOpen(): MediationRecord[] {
    return this.records.filter((m) => m.status === 'open').map((m) => ({ ...m }));
  }

  /** Only mutate proposal state. Callers are responsible for social effects. */
  public resolve(id: string, choice: 'help' | 'ignore' | 'badmouth', day: number): MediationRecord | null {
    const record = this.records.find(m => m.id === id);
    if (!record || record.status !== 'open') return null;
    if (choice !== 'help' && choice !== 'ignore' && choice !== 'badmouth') return null;
    record.status = choice === 'help' ? 'fulfilled' : choice === 'ignore' ? 'ignored' : 'sabotaged';
    record.resolvedDay = Math.max(1, Math.floor(day) || 1);
    return { ...record };
  }

  /** Deterministic exposure. Callback fires in-record-order to preserve social event ordering. */
  public expose(rawA: string, rawB: string, day: number,
    suspicion: (requesterId: string, targetId: string) => number,
    onExposed: (record: MediationRecord, safeDay: number) => void): MediationRecord[] {
    const a = this.normalize(rawA);
    const b = this.normalize(rawB);
    if (!a || !b || a === b) return [];
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const exposed: MediationRecord[] = [];
    for (const record of this.records) {
      if (record.status !== 'sabotaged') continue;
      if (!((record.requesterId === a && record.targetId === b)
        || (record.requesterId === b && record.targetId === a))) continue;
      const roll = rollSeeded100(`expose:${record.id}:${safeDay}`);
      if (roll >= 25 + suspicion(record.requesterId, record.targetId) * 0.5) continue;
      record.status = 'exposed';
      record.resolvedDay = safeDay;
      const detached = { ...record };
      onExposed(detached, safeDay);
      exposed.push(detached);
    }
    return exposed;
  }
}

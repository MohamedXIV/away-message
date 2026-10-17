import type { SocialEngineState } from '../types';

/** Earned contact knowledge and pruned-actor epitaphs; never inferred from relationship stage. */
export class SocialContactDirectory {
  private knownHandles: Record<string, string[]> = {};
  private epitaphs: string[] = [];

  constructor(private readonly normalize: (id: string) => string,
    private readonly actorExists: (id: string) => boolean,
    private readonly maxHandles: number,
    private readonly maxEpitaphs: number) {}

  public forget(rawId: string): void {
    delete this.knownHandles[this.normalize(rawId)];
  }

  public exportState(): Pick<SocialEngineState, 'knownHandles' | 'epitaphs'> {
    const knownHandles: Record<string, string[]> = {};
    for (const [id, handles] of Object.entries(this.knownHandles)) knownHandles[id] = [...handles];
    return { knownHandles, epitaphs: [...this.epitaphs] };
  }

  public restore(state: Pick<SocialEngineState, 'knownHandles' | 'epitaphs'>): void {
    // Known handles (validated ids/handles; absent → strangers on the wire)
    this.knownHandles = {};
    if (state.knownHandles) {
      for (const [rawId, handles] of Object.entries(state.knownHandles)) {
        const id = this.normalize(rawId);
        if (!Array.isArray(handles)) continue;
        const clean = handles
          .filter((h): h is string => typeof h === 'string' && !!h.trim())
          .map((h) => h.trim().slice(0, 40))
          .filter((h, i, arr) => arr.indexOf(h) === i)
          .slice(0, this.maxHandles);
        if (clean.length > 0) this.knownHandles[id] = clean;
      }
    }
    // Epitaphs (capped one-liners)
    this.epitaphs = Array.isArray(state.epitaphs)
      ? state.epitaphs.filter((l): l is string => typeof l === 'string' && !!l.trim()).map((l) => l.trim().slice(0, 140)).slice(-this.maxEpitaphs)
      : [];


  }

  public getKnownHandles(rawId: string): string[] {
    return [...(this.knownHandles[this.normalize(rawId)] ?? [])];
  }

  public isKnown(rawId: string): boolean {
    return (this.knownHandles[this.normalize(rawId)] ?? []).length > 0;
  }

  /** Duplicate is accepted but not newly learned; caller emits only for an actual new contact. */
  public learn(rawId: string, rawHandle: string): { accepted: boolean; newlyLearned: boolean; handle: string } {
    const id = this.normalize(rawId);
    if (!this.actorExists(id)) return { accepted: false, newlyLearned: false, handle: '' };
    const handle = (rawHandle || '').trim().slice(0, 40);
    if (!handle) return { accepted: false, newlyLearned: false, handle: '' };
    const known = this.knownHandles[id] ?? [];
    if (known.includes(handle)) return { accepted: true, newlyLearned: false, handle };
    if (known.length >= this.maxHandles) return { accepted: false, newlyLearned: false, handle };
    this.knownHandles[id] = [...known, handle];
    return { accepted: true, newlyLearned: true, handle };
  }

  public addEpitaph(line: string): void {
    const clean = (line || '').trim().replace(/\s+/g, ' ').slice(0, 140);
    if (!clean) return;
    this.epitaphs.push(clean);
    while (this.epitaphs.length > this.maxEpitaphs) this.epitaphs.shift();
  }

  public getEpitaphs(): string[] { return [...this.epitaphs]; }
}

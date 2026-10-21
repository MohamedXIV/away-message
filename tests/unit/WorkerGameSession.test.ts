import { describe, expect, it, vi } from 'vitest';
import { WorkerGameSession } from '../../src/simulation/host/WorkerGameSession';
import type { WorkerSessionFactories } from '../../src/simulation/host/WorkerGameSession';
import type { WorkerSimulationHost } from '../../src/simulation/host/WorkerSimulationHost';

class FakeWorker {
  disposed = false;
  running = false;
  minute = 480;
  revision = 0;
  paused = false;
  queryKinds: string[] = [];
  private changes = new Set<(change: any) => void>();
  private failures = new Set<(error: Error) => void>();

  query = async (query: { kind: string }) => {
    this.queryKinds.push(query.kind);
    const time = {
      day: Math.floor(this.minute / 1440) + 1,
      totalMinutes: this.minute,
      hour: Math.floor((this.minute % 1440) / 60),
      minute: this.minute % 60,
      timeOfDay: 'morning',
    };
    const common = { revision: this.revision };
    const hud = {
      ...common, time, paused: this.paused, cash: 450, socialBattery: 100, activeView: 'room',
    };
    const world = {
      ...common, time, activeView: 'room', residencePlaceId: 'starter', playerLocation: 'home',
    };
    const player = {
      ...common, moodBand: 'neutral', rent: { rentDueDay: 7, rentAmount: 140, rentPaid: false },
    };
    if (query.kind === 'gameView') return { ...common, hud, world, player };
    if (query.kind === 'hud') return hud;
    if (query.kind === 'world') return world;
    if (query.kind === 'playerStatus') return player;
    throw Error('unexpected query ' + query.kind);
  };

  subscribe(listener: (change: any) => void) {
    this.changes.add(listener);
    listener({ revision: this.revision, atMinute: this.minute, changedDomains: ['unknown'] });
    return () => { this.changes.delete(listener); };
  }
  onFailure(listener: (error: Error) => void) {
    this.failures.add(listener);
    return () => { this.failures.delete(listener); };
  }
  fail(message: string) {
    for (const listener of this.failures) listener(new Error(message));
  }
  notify() {
    this.revision++;
    for (const listener of this.changes) listener({
      revision: this.revision, atMinute: this.minute, changedDomains: ['clock', 'unknown'],
    });
  }
  async advanceGameMinutes(minutes: number) {
    this.minute += minutes;
    this.notify();
  }
  async setClockRunning(running: boolean) { this.running = running; }
  async dispatch(action: { type: string; paused?: boolean }) {
    if (action.type === 'TIME_SET_PAUSED') this.paused = !!action.paused;
    this.notify();
    return { success: true };
  }
  dispose() { this.disposed = true; this.running = false; this.changes.clear(); this.failures.clear(); }
}

function createSession(hosts: FakeWorker[], saves: string[] = []) {
  let next = 0;
  const factories: WorkerSessionFactories = {
    newGame: async () => hosts[next++] as unknown as WorkerSimulationHost,
    loadGame: async () => hosts[next++] as unknown as WorkerSimulationHost,
    saveGame: async (_host, id) => { saves.push(id); },
  };
  return new WorkerGameSession(factories);
}

describe('#175 Worker-first session lifecycle', () => {
  it('boots one Worker at a time, caches only projections and switches slots safely', async () => {
    const one = new FakeWorker();
    const two = new FakeWorker();
    const session = createSession([one, two]);
    const baseline = session.getSnapshot();
    expect(session.getSnapshot()).toBe(baseline); // stable React subscription reference
    await session.newGame();
    expect(session.getSnapshot().phase).toBe('game');
    expect(one.running).toBe(true);
    expect(session.getSnapshot().hud?.time.totalMinutes).toBe(480);
    // Subscription immediately emits the initial revision in this fixture,
    // so boot may read again; every request must still be one atomic query.
    expect(one.queryKinds.length).toBeGreaterThanOrEqual(1);
    expect(one.queryKinds.every(kind => kind === 'gameView')).toBe(true);
    await session.advanceMinutes(15);
    await vi.waitFor(() => expect(session.getSnapshot().hud?.time.totalMinutes).toBe(495));
    expect(one.queryKinds.every(kind => kind === 'gameView')).toBe(true);
    await session.save('slot_2');
    expect(session.getSnapshot().saved).toBe('Saved to slot_2');
    await session.loadGame('slot_2');
    expect(one.disposed).toBe(true);
    expect(two.running).toBe(true);
    expect(session.getSnapshot().slotId).toBe('slot_2');
    session.backToMenu();
    expect(two.disposed).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ phase: 'menu', hud: null, error: null });
    session.dispose();
  });

  it('propagates unsolicited fatal Worker errors without a shadow fallback', async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    const session = createSession([first, second]);
    await session.newGame();
    first.fail('worker-tick-crashed');
    expect(first.disposed).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      phase: 'error', error: 'worker-tick-crashed', hud: null,
    });
    await expect(session.advanceMinutes(5)).rejects.toThrow('not ready');
    await session.loadGame('slot_1');
    expect(session.getSnapshot().phase).toBe('game');
    session.dispose();
  });

  it('fails closed on a malformed mixed-revision game bundle', async () => {
    const worker = new FakeWorker();
    const originalQuery = worker.query;
    worker.query = async query => {
      const result = await originalQuery(query);
      if (query.kind === 'gameView') return {
        ...result, world: { ...(result as any).world, revision: 999 },
      };
      return result;
    };
    const session = createSession([worker]);
    await session.newGame();
    expect(worker.disposed).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      phase: 'error', hud: null, world: null, player: null,
      error: 'Worker game view revision mismatch',
    });
    session.dispose();
  });

  it('deduplicates day-boundary autosave behind bounded revision reads', async () => {
    const worker = new FakeWorker();
    const saves: string[] = [];
    const session = createSession([worker], saves);
    await session.newGame();
    await session.advanceMinutes(1440);
    await vi.waitFor(() => expect(saves).toEqual(['autosave']));
    await session.advanceMinutes(1);
    await vi.waitFor(() => expect(session.getSnapshot().hud?.time.totalMinutes).toBe(1921));
    expect(saves).toEqual(['autosave']);
    session.dispose();
  });

  it('rejects a stale late Worker boot after returning to menu', async () => {
    const delayed = new FakeWorker();
    let resolve!: (host: WorkerSimulationHost) => void;
    const session = new WorkerGameSession({
      newGame: () => new Promise<WorkerSimulationHost>(r => { resolve = r; }),
      loadGame: async () => { throw new Error('not used'); },
      saveGame: async () => {},
    });
    const starting = session.newGame();
    session.backToMenu();
    resolve(delayed as unknown as WorkerSimulationHost);
    await starting;
    expect(delayed.disposed).toBe(true);
    expect(session.getSnapshot().phase).toBe('menu');
    session.dispose();
  });

  it('does not switch slots or report success when an explicit Worker save fails', async () => {
    const worker = new FakeWorker();
    const session = new WorkerGameSession({
      newGame: async () => worker as unknown as WorkerSimulationHost,
      loadGame: async () => { throw new Error('not used'); },
      saveGame: async () => { throw new Error('IDB quota exceeded'); },
    });
    await session.newGame();
    await expect(session.save('slot_2')).rejects.toThrow('IDB quota exceeded');
    expect(session.getSnapshot()).toMatchObject({
      phase: 'game', slotId: 'slot_1', saved: null,
    });
    session.dispose();
  });

  it('retries a failed daily autosave after the next canonical revision', async () => {
    const worker = new FakeWorker();
    let attempts = 0;
    const session = new WorkerGameSession({
      newGame: async () => worker as unknown as WorkerSimulationHost,
      loadGame: async () => { throw new Error('not used'); },
      saveGame: async () => {
        attempts++;
        if (attempts === 1) throw new Error('temporary IDB error');
      },
    });
    await session.newGame();
    await session.advanceMinutes(1440);
    await vi.waitFor(() => expect(session.getSnapshot().saved).toContain('Autosave failed'));
    expect(attempts).toBe(1);
    await session.advanceMinutes(1);
    await vi.waitFor(() => expect(session.getSnapshot().saved).toBe('Autosaved'));
    expect(attempts).toBe(2);
    session.dispose();
  });

  it('serializes daily autosaves even if another day passes during a slow save', async () => {
    const worker = new FakeWorker();
    const saves: string[] = [];
    let releaseFirst!: () => void;
    const first = new Promise<void>(resolve => { releaseFirst = resolve; });
    const session = new WorkerGameSession({
      newGame: async () => worker as unknown as WorkerSimulationHost,
      loadGame: async () => { throw new Error('not used'); },
      saveGame: async (_host, slotId) => {
        saves.push(slotId);
        if (saves.length === 1) await first;
      },
    });
    await session.newGame();
    await session.advanceMinutes(1440);
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    await session.advanceMinutes(1440);
    await vi.waitFor(() => expect(session.getSnapshot().hud?.time.day).toBe(3));
    expect(saves).toEqual(['autosave']);
    releaseFirst();
    await vi.waitFor(() => expect(saves).toEqual(['autosave', 'autosave']));
    session.dispose();
  });

  it('does not let a suspended old Worker refresh block a newly loaded session', async () => {
    const oldWorker = new FakeWorker();
    const newWorker = new FakeWorker();
    const originalQuery = oldWorker.query;
    let stall = false;
    let started = false;
    let resume!: () => void;
    const pendingRead = new Promise<void>(resolve => { resume = resolve; });
    oldWorker.query = async (query) => {
      if (stall && query.kind === 'gameView') {
        started = true;
        await pendingRead;
      }
      return originalQuery(query);
    };
    const session = createSession([oldWorker, newWorker]);
    try {
      await session.newGame();
      stall = true;
      oldWorker.notify();
      await vi.waitFor(() => expect(started).toBe(true));
      await session.loadGame('slot_2');
      expect(oldWorker.disposed).toBe(true);
      await newWorker.advanceGameMinutes(11);
      // The new generation must publish immediately, without requiring the
      // prior Worker query to resolve first.
      await vi.waitFor(() => expect(session.getSnapshot().hud?.time.totalMinutes).toBe(491));
      expect(session.getSnapshot().slotId).toBe('slot_2');
    } finally {
      resume();
      session.dispose();
    }
  });
});

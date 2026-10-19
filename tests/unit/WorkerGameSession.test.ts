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
  private changes = new Set<(change: any) => void>();
  private failures = new Set<(error: Error) => void>();

  query = async (query: { kind: string }) => {
    const time = {
      day: Math.floor(this.minute / 1440) + 1,
      totalMinutes: this.minute,
      hour: Math.floor((this.minute % 1440) / 60),
      minute: this.minute % 60,
      timeOfDay: 'morning',
    };
    const common = { revision: this.revision };
    if (query.kind === 'hud') return {
      ...common, time, paused: this.paused, cash: 450, socialBattery: 100, activeView: 'room',
    };
    if (query.kind === 'world') return {
      ...common, time, activeView: 'room', residencePlaceId: 'starter', playerLocation: 'home',
    };
    if (query.kind === 'playerStatus') return {
      ...common, moodBand: 'neutral', rent: { rentDueDay: 7, rentAmount: 140, rentPaid: false },
    };
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
    await session.advanceMinutes(15);
    await vi.waitFor(() => expect(session.getSnapshot().hud?.time.totalMinutes).toBe(495));
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
});

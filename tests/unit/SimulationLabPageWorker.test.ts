import { describe, expect, it } from 'vitest';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type { SimulationWorkerReply } from '../../src/simulation/host/SimulationHostProtocol';

describe('#175 AI Lab diagnostic Worker projection', () => {
  it('returns bounded private diagnostics without full actor picker or histories', async () => {
    const replies: SimulationWorkerReply[] = [];
    const runtime = createSimulationWorkerRuntime(reply => { replies.push(reply); });
    try {
      await runtime.receive({ id: 1, op: 'init' });
      await runtime.receive({ id: 2, op: 'query', query: { kind: 'labPage', actorPage: 0, meetingPage: 0 } });
      const message = replies.find((r): r is Extract<SimulationWorkerReply, { type: 'result'; ok: true }> =>
        r.type === 'result' && r.ok && r.id === 2);
      expect(message).toBeDefined();
      const payload = message!.value as {
        roster: Record<string, unknown>;
        actors: Array<{ recentMemories: Array<{ text: string }>; memoryCount: number; promiseCount: number }>;
        appointments: { page: unknown[] };
      };
      expect(payload.actors.length).toBeLessThanOrEqual(16);
      expect(payload.appointments.page.length).toBeLessThanOrEqual(16);
      expect(payload.roster).not.toHaveProperty('imageOptions');
      expect(payload.roster).not.toHaveProperty('page');
      for (const actor of payload.actors) {
        expect(actor).not.toHaveProperty('memories');
        expect(actor).not.toHaveProperty('promises');
        expect(actor.recentMemories.length).toBeLessThanOrEqual(3);
        for (const memory of actor.recentMemories) expect(memory.text.length).toBeLessThanOrEqual(160);
      }
      expect(JSON.stringify(message!.value).length).toBeLessThan(60000);
      await runtime.receive({ id: 3, op: 'query', query: { kind: 'labPage', actorPage: -1 } });
      await runtime.receive({ id: 4, op: 'query', query: { kind: 'labPage', meetingPage: 99999 } });
      expect(replies.filter(r => r.type === 'result' && !r.ok).length).toBe(2);
    } finally { runtime.close(); }
  });
});

describe('#175 Worker-owned offline procedural event generation', () => {
  const command = (mode: 'preview' | 'inject', expectedRevision?: number) => ({
    mode, seed: 'worker-lab-test', count: 2, category: 'city_news' as const,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
  });

  it('previews without mutation, refuses stale writes, commits matching events and survives reload', async () => {
    const replies: SimulationWorkerReply[] = [];
    const worker = createSimulationWorkerRuntime(reply => { replies.push(reply); });
    const value = (id: number): any => {
      const message = replies.find(r => r.type === 'result' && r.id === id);
      if (!message || message.type !== 'result' || !message.ok) {
        throw new Error('Expected successful Worker response #' + id);
      }
      return message.value;
    };
    try {
      await worker.receive({ id: 1, op: 'init' });
      await worker.receive({ id: 2, op: 'query', query: { kind: 'labPage' } });
      const initial = value(2);
      await worker.receive({ id: 3, op: 'labProcedural', command: command('preview') });
      const preview = value(3);
      expect(preview.mode).toBe('preview');
      expect(preview.events).toHaveLength(2);
      expect(preview.injectedIds).toEqual([]);
      expect(preview.revision).toBe(initial.revision);
      expect(JSON.stringify(preview).length).toBeLessThan(3000);
      expect(preview).not.toHaveProperty('world');
      expect(preview.events[0]).not.toHaveProperty('isTriggered');

      await worker.receive({ id: 4, op: 'query', query: { kind: 'labPage' } });
      expect(value(4).eventCounts).toEqual(initial.eventCounts);
      expect(value(4).revision).toBe(initial.revision);

      await worker.receive({ id: 5, op: 'advance', minutes: 1, reason: 'stale preview guard' });
      await worker.receive({ id: 6, op: 'labProcedural', command: command('inject', preview.revision) });
      const stale = replies.find(r => r.type === 'result' && r.id === 6);
      expect(stale).toMatchObject({ type: 'result', ok: false });
      if (stale?.type === 'result' && !stale.ok) expect(stale.error.message).toContain('stale');

      await worker.receive({ id: 7, op: 'labProcedural', command: command('preview') });
      const currentPreview = value(7);
      await worker.receive({ id: 8, op: 'labProcedural', command: command('inject', currentPreview.revision) });
      const committed = value(8);
      expect(committed.mode).toBe('inject');
      expect(committed.injectedIds).toEqual(currentPreview.events.map((e: { id: string }) => e.id));
      expect(committed.events).toEqual(currentPreview.events);
      expect(committed.revision).toBeGreaterThan(currentPreview.revision);
      await worker.receive({ id: 9, op: 'query', query: { kind: 'labPage' } });
      expect(value(9).eventCounts.pending).toBe(initial.eventCounts.pending + 2);

      await worker.receive({ id: 10, op: 'export' });
      const saved = value(10);
      expect(saved.world.pendingProceduralEvents.map((e: { id: string }) => e.id))
        .toEqual(currentPreview.events.map((e: { id: string }) => e.id));
      const coldReplies: SimulationWorkerReply[] = [];
      const coldWorker = createSimulationWorkerRuntime(reply => { coldReplies.push(reply); });
      try {
        await coldWorker.receive({ id: 1, op: 'init', initialState: saved });
        await coldWorker.receive({ id: 2, op: 'query', query: { kind: 'labPage' } });
        const coldRead = coldReplies.find(r => r.type === 'result' && r.id === 2);
        expect(coldRead).toMatchObject({ type: 'result', ok: true });
        if (coldRead?.type === 'result' && coldRead.ok) {
          expect((coldRead.value as { eventCounts: { pending: number } }).eventCounts.pending)
            .toBe(initial.eventCounts.pending + 2);
        }
      } finally { coldWorker.close(); }
      // Reloading the unchanged pre-injection world into the *same* instance
      // must evict events from the former run; no stale pending queue leakage.
      const clean = { ...saved, world: { ...saved.world, pendingProceduralEvents: [] },
        narrative: { ...saved.narrative, pendingProceduralEvents: [] } };
      await worker.receive({ id: 11, op: 'load', snapshot: clean });
      await worker.receive({ id: 12, op: 'query', query: { kind: 'labPage' } });
      expect(value(12).eventCounts.pending).toBe(initial.eventCounts.pending);
    } finally { worker.close(); }
  });

  it('rejects malformed, oversized and injection-without-preview controls', async () => {
    const replies: SimulationWorkerReply[] = [];
    const worker = createSimulationWorkerRuntime(reply => { replies.push(reply); });
    try {
      await worker.receive({ id: 1, op: 'init' });
      const invalid = [
        { ...command('preview'), count: 4 },
        { ...command('preview'), count: 0 },
        { ...command('preview'), seed: 'X'.repeat(10000) },
        { ...command('preview'), category: 'private_world_dump' },
        { ...command('preview'), seed: '!' },
        command('inject'),
        command('inject', -1),
      ];
      for (let i = 0; i < invalid.length; i++) {
        await worker.receive({ id: i + 2, op: 'labProcedural', command: invalid[i] as never });
        expect(replies.find(r => r.type === 'result' && r.id === i + 2))
          .toMatchObject({ type: 'result', ok: false });
      }
      await worker.receive({ id: 20, op: 'query', query: { kind: 'labPage' } });
      const page = replies.find(r => r.type === 'result' && r.id === 20);
      expect(page).toMatchObject({ type: 'result', ok: true });
    } finally { worker.close(); }
  });
});

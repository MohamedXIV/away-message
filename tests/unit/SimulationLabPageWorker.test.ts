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

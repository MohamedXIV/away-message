// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { db } from '../../src/persistence/db';
import { saveSlot } from '../../src/persistence/slots';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type {
  SimulationWorkerCommand, SimulationWorkerReply, SimulationWorkerRequest,
} from '../../src/simulation/host/SimulationHostProtocol';

beforeEach(async () => {
  await db.transaction('rw', db.saves, db.conversation_pages, async () => {
    await db.saves.clear();
    await db.conversation_pages.clear();
  });
});

function workerHarness() {
  const events: SimulationWorkerReply[] = [];
  const worker = createSimulationWorkerRuntime(event => events.push(event));
  let id = 0;
  return {
    async ask(command: SimulationWorkerCommand) {
      const requestId = ++id;
      await worker.receive({ id: requestId, ...command } as SimulationWorkerRequest);
      const result = events.find(item => item.type === 'result' && item.id === requestId);
      if (!result || result.type !== 'result') throw new Error('Missing Worker reply');
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    close() { worker.close(); },
  };
}

describe('#175 real indexedDB current-slot Worker ownership', () => {
  it('cold-boots full private conversation history and rebinds readers after overwriting its slot', async () => {
    // Fixture creates a source world outside the Worker; after saving, ONLY
    // the Worker owns the loaded live world. No bootstrap snapshot is
    // materialized or transferred across the Worker protocol.
    const fixture = new SimulationKernel();
    const actor = fixture.social.getBuddies()[0]!;
    fixture.social.learnHandle(actor.id, actor.handle);
    for (let n = 0; n < 145; n++) {
      fixture.social.sendMessage(actor.id, actor.id, 'player', 'SLOT_WORKER_' + n, 1000 + n);
    }
    await saveSlot(fixture, 'slot_worker');
    const persisted = (await db.saves.get('slot_worker'))!;
    expect(persisted.snapshot!.social.conversations[actor.id]).toHaveLength(32);
    expect(await db.conversation_pages.where('slotId').equals('slot_worker').count()).toBeGreaterThan(0);

    const worker = workerHarness();
    try {
      await worker.ask({ op: 'initSlot', slotId: 'slot_worker' });
      const older = await worker.ask({
        op: 'query', query: { kind: 'conversation', actorId: actor.id, offset: 110, limit: 40 },
      }) as { messages: Array<{ text: string }>; total: number };
      expect(older.total).toBe(145);
      expect(older.messages[0]?.text).toBe('SLOT_WORKER_0');
      expect(older.messages.at(-1)?.text).toBe('SLOT_WORKER_34');
      const hidden = await worker.ask({
        op: 'query', query: { kind: 'conversation', actorId: 'guessed-private-actor', offset: 100, limit: 50 },
      }) as { messages: unknown[]; total: number };
      expect(hidden).toMatchObject({ messages: [], total: 0 });

      await worker.ask({ op: 'advance', minutes: 5, reason: 'worker slot' });
      const saved = await worker.ask({
        op: 'saveSlot', slotId: 'slot_worker', saveName: 'Worker-owned save',
        pulse: { pulseSlotId: 'slot_worker', pulsePayload: { marker: 'ui-owned-pulse' } },
      }) as { id: string; name: string };
      expect(saved).toMatchObject({ id: 'slot_worker', name: 'Worker-owned save' });
      const reloadedRecord = (await db.saves.get('slot_worker'))!;
      expect((reloadedRecord.meta?.pulsePayload as { marker: string }).marker).toBe('ui-owned-pulse');
      // Rebinding after replacement must not keep pointing to the deleted
      // prior-generation cold pages.
      const oldAfterWrite = await worker.ask({
        op: 'query', query: { kind: 'conversation', actorId: actor.id, offset: 110, limit: 40 },
      }) as { messages: Array<{ text: string }>; total: number };
      expect(oldAfterWrite.messages).toEqual(older.messages);
      expect(oldAfterWrite.total).toBe(older.total);
    } finally {
      worker.close();
    }

    // A fresh Worker process sees the same slot from IndexedDB, including
    // cold transcript bodies, without any main-thread SimulationKernel.
    const second = workerHarness();
    try {
      await second.ask({ op: 'initSlot', slotId: 'slot_worker' });
      const restored = await second.ask({
        op: 'query', query: { kind: 'conversation', actorId: actor.id, offset: 110, limit: 40 },
      });
      expect(restored).toMatchObject({ total: 145, revision: 0 });
      const coldPage = restored as { messages: Array<{ text: string }> };
      expect(coldPage.messages[0]?.text).toBe('SLOT_WORKER_0');
      expect(coldPage.messages.at(-1)?.text).toBe('SLOT_WORKER_34');
      const summary = await second.ask({ op: 'query', query: { kind: 'hud' } }) as {
        time: { totalMinutes: number };
      };
      expect(summary.time.totalMinutes).toBe(fixture.clock.getTotalMinutes() + 5);
    } finally {
      second.close();
    }
  });

  it('rejects missing slots without creating a world; retries the same worker safely', async () => {
    const worker = workerHarness();
    try {
      await expect(worker.ask({ op: 'initSlot', slotId: 'missing_worker_slot' }))
        .rejects.toThrow('missing or unreadable');
      await expect(worker.ask({ op: 'query', query: { kind: 'hud' } }))
        .rejects.toThrow('not initialized');
      await worker.ask({ op: 'init' });
      const valid = await worker.ask({ op: 'query', query: { kind: 'hud' } });
      expect(valid).toHaveProperty('revision', 0);
      await expect(worker.ask({ op: 'initSlot', slotId: 'missing_worker_slot' }))
        .rejects.toThrow('already initialized');
    } finally {
      worker.close();
    }
  });
});

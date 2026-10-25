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
      // Simulated minutes can deliver a new NPC reply; the original cold
      // prefix must remain byte-identical after slot-generation rebind.
      expect(oldAfterWrite.messages.slice(0, older.messages.length)).toEqual(older.messages);
      expect(oldAfterWrite.total).toBeGreaterThanOrEqual(older.total);
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
      expect(restored).toMatchObject({ revision: 0 });
      const coldPage = restored as { messages: Array<{ text: string }> };
      expect(coldPage.messages[0]?.text).toBe('SLOT_WORKER_0');
      expect(coldPage.messages[34]?.text).toBe('SLOT_WORKER_34');
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
  it('atomically persists a café Ink choice point in Save As, cold-loads it and isolates original slot', async () => {
    const fixture = new SimulationKernel();
    expect(fixture.dispatchAction({ type: 'TRAVEL_TO', to: 'cafe', mode: 'walk' }).success).toBe(true);
    fixture.relocateActorSpatially('maya', { x: 20, y: 60, z: 0 });
    expect(fixture.getCafeGuestRead('place_a1').guest?.actorId).toBe('maya');
    await saveSlot(fixture, 'ink_source');

    const first = workerHarness();
    try {
      await first.ask({ op: 'initSlot', slotId: 'ink_source' });
      const start = await first.ask({ op: 'cafeNarrative', command: { kind: 'startCafe' } }) as {
        active: boolean; frame: { choices: Array<{ text: string }> };
      };
      expect(start.active).toBe(true);
      expect(start.frame.choices[0]?.text).toBe("Ask how they've been");
      await first.ask({
        op: 'saveSlot', slotId: 'ink_copy',
        pulse: { pulseSlotId: 'ink_copy', pulsePayload: { view: 'cafe' } },
      });
      const saved = (await db.saves.get('ink_copy'))!;
      expect(saved.meta?.cafeNarrative).toMatchObject({
        version: 2,
        actorId: 'maya',
        coordinator: { version: 1, session: { flowId: 'cafe_meeting' } },
        display: { text: expect.stringContaining('Hey! You made it!') },
      });
      expect(saved.meta?.pulsePayload).toEqual({ view: 'cafe' });
      expect(JSON.stringify(saved.meta?.cafeNarrative)).not.toContain('conversations');
      expect((await db.saves.get('ink_source'))!.meta?.cafeNarrative).toBeNull();
    } finally { first.close(); }

    const fromCopy = workerHarness();
    try {
      await fromCopy.ask({ op: 'initSlot', slotId: 'ink_copy' });
      const resumed = await fromCopy.ask({ op: 'cafeNarrative', command: { kind: 'current' } }) as {
        active: boolean; frame: { choices: Array<{ text: string }> };
      };
      expect(resumed.active).toBe(true);
      expect((resumed.frame as { text?: string }).text).toContain('Hey! You made it!');
      expect(resumed.frame.choices[0]?.text).toBe("Ask how they've been");
      const answer = await fromCopy.ask({
        op: 'cafeNarrative', command: { kind: 'choose', choiceIndex: 0 },
      }) as { frame: { text: string } };
      expect(answer.frame.text).toContain('the week comes out sideways');
      await fromCopy.ask({
        op: 'saveSlot', slotId: 'ink_copy',
        pulse: { pulseSlotId: 'ink_copy', pulsePayload: null },
      });
    } finally { fromCopy.close(); }

    const original = workerHarness();
    try {
      await original.ask({ op: 'initSlot', slotId: 'ink_source' });
      expect(await original.ask({ op: 'cafeNarrative', command: { kind: 'current' } }))
        .toEqual({ active: false, actor: null, frame: null });
    } finally { original.close(); }

    const restoredAgain = workerHarness();
    try {
      await restoredAgain.ask({ op: 'initSlot', slotId: 'ink_copy' });
      const resumed = await restoredAgain.ask({
        op: 'cafeNarrative', command: { kind: 'current' },
      }) as { active: boolean; frame: { choices: Array<{ text: string }> } };
      expect(resumed.active).toBe(true);
      expect(resumed.frame.choices.some(choice => choice.text.includes('Let the conversation'))).toBe(true);
    } finally { restoredAgain.close(); }
  });

  it('rejects malformed saved Ink metadata but preserves the canonical saved world', async () => {
    const fixture = new SimulationKernel();
    await saveSlot(fixture, 'ink_corrupt');
    const record = (await db.saves.get('ink_corrupt'))!;
    await db.saves.update('ink_corrupt', {
      meta: { ...record.meta, cafeNarrative: { version: 1, actorId: 'maya', coordinator: { version: 777 } } },
    });
    const worker = workerHarness();
    try {
      await worker.ask({ op: 'initSlot', slotId: 'ink_corrupt' });
      const world = await worker.ask({ op: 'query', query: { kind: 'world' } }) as {
        playerLocation: string;
      };
      expect(world.playerLocation).toBe('home');
      expect(await worker.ask({ op: 'cafeNarrative', command: { kind: 'current' } }))
        .toEqual({ active: false, actor: null, frame: null });
    } finally { worker.close(); }
  });

});

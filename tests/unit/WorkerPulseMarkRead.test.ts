import { describe, expect, it } from 'vitest';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type { SimulationMessengerRead } from '../../src/engine/kernel/SimulationPublication';
import type {
  SimulationWorkerCommand,
  SimulationWorkerReply,
  SimulationWorkerRequest,
} from '../../src/simulation/host/SimulationHostProtocol';

function harness() {
  const sent: SimulationWorkerReply[] = [];
  const runtime = createSimulationWorkerRuntime(message => sent.push(message));
  let nextId = 0;
  const ask = async (command: SimulationWorkerCommand) => {
    const id = ++nextId;
    await runtime.receive({ ...command, id } as SimulationWorkerRequest);
    const result = [...sent].reverse().find(message => message.type === 'result' && message.id === id);
    if (!result || result.type !== 'result') throw new Error('Missing Worker reply');
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  return { runtime, sent, ask };
}

describe('#223 Worker Pulse conversation acknowledgement', () => {
  it('clears canonical unread only for a known conversation', async () => {
    const { runtime, ask } = harness();
    try {
      await ask({ op: 'init', freshRosterSeed: 'pulse-read-ack-fixture' });
      const before = await ask({ op: 'query', query: { kind: 'messenger', maxContacts: 32 } }) as SimulationMessengerRead;
      const actorId = before.contacts[0]?.actorId;
      expect(actorId).toBeTruthy();

      await ask({ op: 'dispatch', action: {
        type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: actorId!, text: 'Are you around?',
        tags: ['authored'],
      } });
      const unread = await ask({ op: 'query', query: { kind: 'messenger', maxContacts: 32 } }) as SimulationMessengerRead;
      expect(unread.contacts.find(row => row.actorId === actorId)?.unread).toBe(1);

      expect(await ask({ op: 'markConversationRead', actorId: actorId! })).toBe(true);
      const read = await ask({ op: 'query', query: { kind: 'messenger', maxContacts: 32 } }) as SimulationMessengerRead;
      expect(read.contacts.find(row => row.actorId === actorId)?.unread).toBe(0);

      // No unread state means no redundant canonical revision.
      expect(await ask({ op: 'markConversationRead', actorId: actorId! })).toBe(false);
    } finally {
      runtime.close();
    }
  });

  it('refuses unknown and malformed conversation identities', async () => {
    const { runtime, ask } = harness();
    try {
      await ask({ op: 'init', freshRosterSeed: 'pulse-read-ack-fixture' });
      expect(await ask({ op: 'markConversationRead', actorId: 'not-a-known-contact' })).toBe(false);
      await expect(ask({ op: 'markConversationRead', actorId: '' }))
        .rejects.toThrow('Invalid conversation identity');
    } finally {
      runtime.close();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PlayerContactCoordination } from '../../src/engine/kernel/PlayerContactCoordination';

function contacts(engine: SimulationEngine): PlayerContactCoordination {
  return (engine as unknown as { playerContacts: PlayerContactCoordination }).playerContacts;
}

describe('PlayerContactCoordination — one Social roster and Needs battery', () => {
  it('is the actual policy used by the public messaging command', () => {
    const engine = new SimulationEngine();
    const policy = contacts(engine);
    expect(policy).toBeInstanceOf(PlayerContactCoordination);

    const beforeBattery = engine.economy.getSocialBattery();
    const sent = engine.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE', buddyId: 'maya', text: 'how was your day?',
    });
    expect(sent.success).toBe(true);
    expect(engine.economy.getSocialBattery()).toBe(beforeBattery - 1);
    expect(engine.social.getMessages('maya').at(-1)?.text).toBe('how was your day?');
  });

  it('rejects unknown handles without creating actors, messages or spent battery', () => {
    const engine = new SimulationEngine();
    const before = engine.exportSnapshot();
    const rosterSize = engine.social.getBuddies().length;
    const result = engine.dispatchAction({
      type: 'ADD_CONTACT', handle: 'no-such-online-handle',
    });
    expect(result.success).toBe(false);
    expect(engine.social.getBuddies()).toHaveLength(rosterSize);
    expect(engine.economy.getSocialBattery()).toBe(before.player.socialBattery);
  });

  it('keeps saved reception hints in the same World flag store as the public read', () => {
    const engine = new SimulationEngine();
    engine.world.setFlag('reception_maya_1', 'warm');
    expect(contacts(engine).getReceptionHint('maya', 1))
      .toBe(engine.getReceptionHint('maya', 1));
    expect(engine.getReceptionHint('maya', 2)).toBe('');
  });
});

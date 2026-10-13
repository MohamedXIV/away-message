import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { WorldNarrativeCommands } from '../../src/engine/kernel/WorldNarrativeCommands';

function worldCommands(engine: SimulationEngine): WorldNarrativeCommands {
  return (engine as unknown as { worldCommands: WorldNarrativeCommands }).worldCommands;
}

describe('WorldNarrativeCommands — no second flag/event timeline', () => {
  it('routes current World and deprecated narrative aliases to the same flags', () => {
    const engine = new SimulationEngine();
    const owner = worldCommands(engine);
    expect(owner).toBeInstanceOf(WorldNarrativeCommands);

    expect(engine.dispatchAction({
      type: 'WORLD_SET_FLAG', key: 'kernel:world', value: 'world',
    }).success).toBe(true);
    expect(engine.dispatchAction({
      type: 'NARRATIVE_SET_FLAG', key: 'kernel:narrative', value: 'alias',
    }).success).toBe(true);

    expect(engine.world.getFlag('kernel:world')).toBe('world');
    expect(engine.world.getFlag('kernel:narrative')).toBe('alias');
    expect(engine.exportSnapshot().world.flags['kernel:narrative']).toBe('alias');
  });

  it('does not handle unrelated Social commands or modify the shared roster', () => {
    const engine = new SimulationEngine();
    const before = engine.social.getBuddies().length;
    const result = worldCommands(engine).dispatch({
      type: 'SOCIAL_REMOVE_BUDDY', buddyId: 'maya',
    }, engine.clock.getTotalMinutes());
    expect(result).toBeNull();
    expect(engine.social.getBuddies()).toHaveLength(before);
  });
});

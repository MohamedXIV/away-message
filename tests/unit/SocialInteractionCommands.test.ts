import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { SocialInteractionCommands } from '../../src/engine/kernel/SocialInteractionCommands';
import { buildCharacter } from '../../src/engine/CharacterEngine';

function socialCommands(engine: SimulationEngine): SocialInteractionCommands {
  return (engine as unknown as { core: { socialCommands: SocialInteractionCommands } }).core.socialCommands;
}

describe('SocialInteractionCommands — canonical actor roster and messages', () => {
  it('routes public player messages into the same Social/Needs domain truth', () => {
    const engine = new SimulationEngine();
    const handler = socialCommands(engine);
    const before = engine.needs.getSocialBattery();
    expect(handler).toBeInstanceOf(SocialInteractionCommands);
    const result = engine.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE', buddyId: 'maya', text: 'hi from the kernel',
    });
    expect(result.success).toBe(true);
    expect(engine.social.getMessages('maya').at(-1)?.text).toBe('hi from the kernel');
    expect(engine.needs.getSocialBattery()).toBe(before - 1);
  });

  it('registers one real buddy and fans out through shared Social events', () => {
    const engine = new SimulationEngine();
    const actor = buildCharacter({
      id: 'social_command_buddy',
      handle: 'social_command_buddy',
      displayName: 'Social Command Buddy',
      archetype: 'student',
      status: 'acquaintance',
      metVia: 'nightboard',
      createdDay: 1,
    }).definition;
    const before = engine.social.getBuddies().length;

    const result = engine.dispatchAction({
      type: 'SOCIAL_ADD_BUDDY', buddy: actor, silent: true,
    });

    expect(result.success).toBe(true);
    expect(engine.social.getBuddies()).toHaveLength(before + 1);
    expect(engine.social.getBuddy(actor.id)?.id).toBe(actor.id);
    expect(engine.social.getCoreMemories(actor.id).some(
      (memory) => memory.kind === 'first_meeting',
    )).toBe(true);
  });

  it('leaves world actions to the distinct world router', () => {
    const engine = new SimulationEngine();
    const result = socialCommands(engine).dispatch({
      type: 'WORLD_SET_FLAG', key: 'not_processed', value: true,
    }, engine.clock.getTotalMinutes());
    expect(result).toBeNull();
    expect(engine.world.getFlag('not_processed')).toBeUndefined();
  });
});

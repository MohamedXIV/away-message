import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { MyPlaceEngine } from '../../src/engine/MyPlaceEngine';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';

describe('#213 MyPlace actor provenance and generated-world pages', () => {
  it('does not resurrect a legacy actor binding when the profile is missing', () => {
    const empty = new MyPlaceEngine(new EventBus(), { npcProfiles: {} });
    expect(empty.getNpcProfile('maya_x')).toBeUndefined();
    expect(empty.getBoundActorIdForProfile('maya_x')).toBeNull();
    expect(empty.getBoundActorIdForProfile('tacocart_ryan')).toBeNull();

    const generated = Object.values(buildFreshSandboxSocialState('cast-site-fixture-01').buddies ?? {})[0]!;
    empty.ensureNpcProfile({
      username: generated.handle, displayName: generated.displayName,
      archetype: generated.archetype, reach: generated.reach, actorId: generated.id,
    });
    expect(empty.getBoundActorIdForProfile(generated.handle)).toBe(generated.id);
    expect(empty.getAllNpcProfiles()).toHaveProperty(generated.handle);
    expect(empty.getBoundActorIdForProfile('maya_x')).toBeNull();
  });

  it('keeps historical seed aliases only when the authored page really exists', () => {
    const legacy = new MyPlaceEngine(new EventBus());
    expect(legacy.getBoundActorIdForProfile('maya_x')).toBe('maya');
    expect(legacy.getBoundActorIdForProfile('not-a-profile')).toBeNull();
  });
});

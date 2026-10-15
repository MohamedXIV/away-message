import { describe, expect, it } from 'vitest';
import { buildCharacter } from '../../src/engine/CharacterEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { RelationshipContinuity } from '../../src/engine/kernel/RelationshipContinuity';
import { STRAINED_ANNOYANCE, DISTANT_ANNOYANCE } from '../../src/engine/SocialEngine';

function fixture() {
  const owners = createCoreDomainOwners();
  const actorId = 'continuity_fixture';
  owners.social.registerBuddy(buildCharacter({
    id: actorId,
    displayName: 'Continuity Fixture',
    handle: 'continuity_fixture',
    archetype: 'student',
    status: 'acquaintance',
    reach: 'local',
    metVia: 'work',
    createdDay: 1,
  }).definition);
  return { owners, actorId, cycle: new RelationshipContinuity(owners) };
}

describe('RelationshipContinuity', () => {
  it('governs one confrontation then a distant status using existing World and Social truth', () => {
    const { owners, actorId, cycle } = fixture();
    owners.social.adjustRelationship(actorId, {
      annoyance: STRAINED_ANNOYANCE,
    });
    cycle.checkSharpRelationship(actorId, owners.clock.getTotalMinutes());

    expect(owners.world.getFlag(`strained_${actorId}`)).toBe(true);
    expect(owners.world.getFlag(`sharp_${actorId}`)).toBe('confronted');
    expect(owners.world.getFlag('sharp_active')).toBe(actorId);
    expect(owners.social.getBuddy(actorId)?.status).toBe('acquaintance');

    owners.social.adjustRelationship(actorId, {
      annoyance: DISTANT_ANNOYANCE,
    });
    cycle.checkSharpRelationship(actorId, owners.clock.getTotalMinutes());

    expect(owners.social.getBuddy(actorId)?.status).toBe('distant');
    expect(owners.world.getFlag(`sharp_${actorId}`)).toBe('distant');
  });

  it('returns distant actors after their canonical cooling window', () => {
    const { owners, actorId, cycle } = fixture();
    owners.social.setBuddyStatus(actorId, 'distant');
    owners.world.setFlag(`distant_${actorId}_until`, 5);
    owners.world.setFlag('sharp_active', actorId);

    cycle.processRelationshipDaily(4);
    expect(owners.social.getBuddy(actorId)?.status).toBe('distant');

    cycle.processRelationshipDaily(5);
    expect(owners.social.getBuddy(actorId)?.status).toBe('acquaintance');
    expect(owners.world.getFlag(`sharp_${actorId}`)).toBe('returned');
    expect(owners.world.getFlag('sharp_active')).toBe('');
  });

  it('expires promises exactly once without duplicating memory or social consequences', () => {
    const { owners, actorId, cycle } = fixture();
    const promise = owners.social.addPromise(
      actorId, 'I will help you tomorrow', 1, 2,
    );
    expect(promise).not.toBeNull();

    cycle.processRelationshipDaily(3);
    const saved = owners.social.getPromises(actorId);
    expect(saved.find((entry) => entry.id === promise!.id)?.status).toBe('broken');
    const coreMemories = owners.social.getCoreMemories(actorId);
    cycle.processRelationshipDaily(3);
    expect(owners.social.getCoreMemories(actorId)).toEqual(coreMemories);
  });
});

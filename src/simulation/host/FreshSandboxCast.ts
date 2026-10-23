import { buildCharacter } from '../../engine/CharacterEngine';
import { pickTemplateName } from '../../engine/characterTemplates';
import { seedCharacterIds } from '../../engine/seedCharacters';
import type { CharacterArchetype, SocialEngineState } from '../../engine/types';

/** #213: one-shot NEW GAME roster seed, not a second character authority.
 * The resulting definitions persist through the regular SocialEngine save.
 * Legacy authored seeds remain available to DEV fixtures and earlier worlds.
 */
const START_ROLES: readonly { archetype: CharacterArchetype; reach: 'local' | 'remote'; roles: readonly string[] }[] = [
  { archetype: 'coworker', reach: 'local', roles: ['cart-owner', 'shift-worker'] },
  { archetype: 'artist', reach: 'local', roles: ['diner-staff', 'rain-lover'] },
  { archetype: 'regular', reach: 'local', roles: ['landlord', 'cafe-regular'] },
  { archetype: 'nightowl', reach: 'local', roles: ['canal-regular'] },
  { archetype: 'student', reach: 'local', roles: ['crammer'] },
  { archetype: 'trader', reach: 'local', roles: ['hardware-modder'] },
  { archetype: 'artist', reach: 'remote', roles: ['tape-trader'] },
  { archetype: 'nightowl', reach: 'remote', roles: ['board-moderator'] },
];

export function buildFreshSandboxSocialState(seed: string): SocialEngineState {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(seed)) throw new Error('Invalid new-world cast seed');
  const taken = new Set(seedCharacterIds());
  const buddies: NonNullable<SocialEngineState['buddies']> = {};
  const relationships: SocialEngineState['relationships'] = {};
  const presence: SocialEngineState['presence'] = {};
  const conversations: SocialEngineState['conversations'] = {};
  for (const [index, slot] of START_ROLES.entries()) {
    const picked = pickTemplateName(slot.archetype, `${seed}:resident:${index}`, taken);
    taken.add(picked.id);
    taken.add(picked.handle);
    const actor = buildCharacter({
      id: picked.id, displayName: picked.displayName, handle: picked.handle,
      archetype: slot.archetype, metVia: slot.reach === 'remote' ? 'nightboard' : 'intro',
      reach: slot.reach, roles: [...slot.roles], status: 'stranger', createdDay: 1,
    }).definition;
    buddies[actor.id] = actor;
    relationships[actor.id] = { ...actor.initialRelationships };
    presence[actor.id] = { status: 'offline', awayMessage: '' };
    conversations[actor.id] = [];
  }
  return {
    relationships, presence, conversations, buddies,
    removedSeedActorIds: seedCharacterIds(),
    knownHandles: {}, // A roster identity is not automatically known by the player.
  };
}

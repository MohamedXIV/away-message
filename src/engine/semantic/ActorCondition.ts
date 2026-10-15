import type { ActorCondition, BuddyLifecycleStatus, RelationshipStage } from '../types';

/** One canonical availability/contact record; friendship remains a derived relationship. */
export function conditionFromLegacyStatus(status?: BuddyLifecycleStatus): ActorCondition {
  if (status === 'gone') return { lifecycle: 'departed', contact: 'open' };
  if (status === 'blocked') return { lifecycle: 'active', contact: 'blocked' };
  if (status === 'distant') return { lifecycle: 'active', contact: 'distant' };
  return { lifecycle: 'active', contact: 'open' };
}

export function validActorCondition(raw: unknown): raw is ActorCondition {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const value = raw as Partial<ActorCondition>;
  return (value.lifecycle === 'active' || value.lifecycle === 'departed')
    && (value.contact === 'open' || value.contact === 'distant' || value.contact === 'blocked');
}

export function projectLegacyBuddyStatus(condition: ActorCondition, stage: RelationshipStage): BuddyLifecycleStatus {
  if (condition.lifecycle === 'departed') return 'gone';
  if (condition.contact === 'blocked') return 'blocked';
  if (condition.contact === 'distant') return 'distant';
  return stage === 'strained' ? 'acquaintance' : stage;
}
import type {
  BuddyCharacter, BuddyPresence, RelationshipDimensions, RelationshipStage,
} from '../types';
import type { FidelityTier, LifePressureView } from '../life/types';
import type { WorldModifier } from '../WorldModifiers';

/**
 * Pure, bounded semantic query inputs. Canonical ownership remains in
 * Social, NPC Life and World. Never persist these derived booleans.
 */
export interface ActorSemanticInputs {
  actor: Pick<BuddyCharacter, 'id' | 'reach' | 'roles' | 'status'>;
  presence?: Pick<BuddyPresence, 'status'>;
  relationship?: RelationshipDimensions;
  relationshipStage: RelationshipStage;
  knownToPlayer: boolean;
  pressure?: LifePressureView | null;
  lifeFidelity: FidelityTier;
  focused?: boolean;
}

export interface SemanticDecision {
  allowed: boolean;
  reasons: string[];
}

export type SemanticFidelity = 'focused' | 'important_local' | 'background_local' | 'remote_known';

export interface ActorSemanticView {
  actorId: string;
  reach: 'local' | 'remote';
  roles: string[];
  lifecycle: 'active' | 'distant' | 'departed' | 'blocked';
  connection: 'unknown' | 'known' | 'blocked';
  relationship: {
    stage: RelationshipStage;
    trusted: boolean;
    conflicted: boolean;
  };
  fidelity: SemanticFidelity;
  canChatNow: SemanticDecision;
  canMeetInPerson: SemanticDecision;
}

export function deriveActorSemantics(input: ActorSemanticInputs): ActorSemanticView {
  const { actor, pressure, relationship: r, presence } = input;
  const reach = actor.reach === 'remote' ? 'remote' : 'local';
  const lifecycle = actor.status === 'gone' ? 'departed'
    : actor.status === 'blocked' ? 'blocked'
    : actor.status === 'distant' ? 'distant' : 'active';
  // friend/close/acquaintance on the legacy actor status do not own stage truth.
  const connection = lifecycle === 'blocked' ? 'blocked'
    : input.knownToPlayer ? 'known' : 'unknown';
  const trusted = Boolean(r && r.trust >= 65 && r.suspicion < 40 && r.resentment < 40);
  const conflicted = Boolean(r && (r.annoyance >= 60 || r.resentment >= 60 || r.suspicion >= 65));
  const fidelity: SemanticFidelity = reach === 'remote' ? 'remote_known'
    : input.focused ? 'focused'
    : input.lifeFidelity === 'important_local' ? 'important_local' : 'background_local';

  const chatBlockers: string[] = [];
  if (connection === 'unknown') chatBlockers.push('unknown_contact');
  if (lifecycle === 'blocked') chatBlockers.push('blocked_contact');
  if (lifecycle === 'departed') chatBlockers.push('actor_departed');
  if (lifecycle === 'distant') chatBlockers.push('distant_contact');
  if (presence?.status === 'offline') chatBlockers.push('offline');
  if (presence?.status === 'busy' || pressure?.interruptionTolerance === 'do_not_disturb') {
    chatBlockers.push('busy');
  }

  const meetingBlockers: string[] = [];
  if (reach === 'remote') meetingBlockers.push('remote_reach');
  if (lifecycle === 'blocked') meetingBlockers.push('blocked_contact');
  if (lifecycle === 'departed') meetingBlockers.push('actor_departed');
  if (lifecycle === 'distant') meetingBlockers.push('distant_contact');
  return {
    actorId: actor.id, reach, roles: [...(actor.roles ?? [])], lifecycle, connection,
    relationship: { stage: input.relationshipStage, trusted, conflicted },
    fidelity,
    canChatNow: { allowed: chatBlockers.length === 0, reasons: chatBlockers },
    canMeetInPerson: { allowed: meetingBlockers.length === 0, reasons: meetingBlockers },
  };
}

/** Source-backed, non-authoritative life influence; consumers own any effects. */
export interface SemanticInfluenceView {
  kind: string;
  value?: number | string | boolean;
  sourceEventId: string;
  validFromMinute: number;
  validUntilMinute?: number;
}

export function projectLifeInfluences(modifiers: readonly WorldModifier[]): SemanticInfluenceView[] {
  return modifiers.filter(m => m.domain === 'life').slice(0, 16).map(m => ({
    kind: m.kind,
    ...(m.value !== undefined ? { value: m.value } : {}),
    sourceEventId: m.sourceEventId,
    validFromMinute: m.startsAtMinute,
    ...(m.endsAtMinute !== undefined ? { validUntilMinute: m.endsAtMinute } : {}),
  }));
}

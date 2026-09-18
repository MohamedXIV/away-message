export type ActorCameraMode = 'eye_level' | 'city_topdown';
export type ActorPresentationTier = 'full_character' | 'silhouette_large' | 'silhouette_small' | 'background' | 'hidden';

export interface ActorPresentationContext {
  actorId: string;
  cameraMode: ActorCameraMode;
  /** Authored view-relative distance/depth normalized for presentation tuning. */
  viewDistance: number;
  authoredVisible: boolean;
  focused: boolean;
  selected: boolean;
  /** Simulation geography is carried for identity/context, never tier selection. */
  worldPosition?: Readonly<{ x: number; y: number; z: number }>;
}

export interface ActorPresentation {
  actorId: string;
  tier: ActorPresentationTier;
}

export function resolveActorPresentation(context: Readonly<ActorPresentationContext>): ActorPresentation {
  if (!context.authoredVisible) return { actorId: context.actorId, tier: 'hidden' };
  if (context.focused || context.selected) return { actorId: context.actorId, tier: 'full_character' };

  if (context.cameraMode === 'city_topdown') {
    return { actorId: context.actorId, tier: context.viewDistance >= 0.9 ? 'background' : 'silhouette_small' };
  }

  if (context.viewDistance <= 0.3) return { actorId: context.actorId, tier: 'full_character' };
  if (context.viewDistance <= 0.65) return { actorId: context.actorId, tier: 'silhouette_large' };
  return { actorId: context.actorId, tier: 'background' };
}

export type ActorInteractionAction = 'inspect' | 'greet' | 'talk' | 'wave' | 'ask_for_help';
export type ActorRelationshipContext = 'stranger' | 'acquaintance' | 'friend';

export interface ActorInteractionContext {
  actorId: string;
  knownIdentity: boolean;
  canonicalDisplayName: string;
  observableLabel?: string;
  relationship: ActorRelationshipContext;
  busy: boolean;
  workerRoleKnown: boolean;
}

export interface ActorInteractionProjection {
  actorId: string;
  label: string;
  actions: ActorInteractionAction[];
}

/**
 * Presentation projection only: callers must supply knowledge/relationship/role truth
 * from their owning systems. This function never discovers or mutates simulation state.
 */
export function buildActorInteractionProjection(context: Readonly<ActorInteractionContext>): ActorInteractionProjection {
  const label = context.knownIdentity
    ? context.canonicalDisplayName
    : (context.observableLabel ?? 'Someone');

  const actions: ActorInteractionAction[] = ['inspect'];
  if (context.busy) {
    if (context.relationship !== 'stranger') actions.push('wave');
    return { actorId: context.actorId, label, actions };
  }

  actions.push('greet');
  if (context.relationship !== 'stranger') actions.push('talk', 'wave');
  if (context.workerRoleKnown) actions.push('ask_for_help');

  return { actorId: context.actorId, label, actions };
}

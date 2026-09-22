export type ActorCameraMode = 'eye_level' | 'city_topdown';
export type ActorPresentationTier = 'full_character' | 'silhouette_large' | 'silhouette_small' | 'background' | 'hidden';
export type ActorFacingFamily = 'front' | 'front_3q_left' | 'front_3q_right' | 'side_left' | 'side_right' | 'back_3q' | 'back';

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

/** Authored composition data. It deliberately contains no town-space coordinates. */
export interface ActorViewPlacement {
  viewId: string;
  cameraMode: ActorCameraMode;
  x: number;
  y: number;
  distance: number;
  facing: ActorFacingFamily;
  visible: boolean;
  scale?: number;
  anchorId?: string;
}

export interface ActorViewProjection extends ActorPresentation {
  viewId: string;
  x: number;
  y: number;
  facing: ActorFacingFamily;
  scale: number;
  anchorId?: string;
}

/**
 * Joins a persistent actor identity to authored view placement. Changing views
 * changes only this transient projection; it never creates, destroys, or copies
 * character simulation state.
 */
export function projectActorIntoView(
  actorId: string,
  placement: Readonly<ActorViewPlacement>,
  state: Readonly<{ focused?: boolean; selected?: boolean }> = {},
): ActorViewProjection {
  const presentation = resolveActorPresentation({
    actorId,
    cameraMode: placement.cameraMode,
    viewDistance: placement.distance,
    authoredVisible: placement.visible,
    focused: state.focused ?? false,
    selected: state.selected ?? false,
  });
  return {
    ...presentation,
    viewId: placement.viewId,
    x: placement.x,
    y: placement.y,
    facing: placement.facing,
    scale: placement.scale ?? 1,
    ...(placement.anchorId ? { anchorId: placement.anchorId } : {}),
  };
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

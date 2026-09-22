import { describe, expect, it } from 'vitest';
import {
  buildActorInteractionProjection,
  projectActorIntoView,
  resolveActorPresentation,
  type ActorPresentationContext,
} from '../../src/world/actorPresentation';

const baseContext = (): ActorPresentationContext => ({
  actorId: 'actor_alpha',
  cameraMode: 'eye_level',
  viewDistance: 0.2,
  authoredVisible: true,
  focused: false,
  selected: false,
  worldPosition: { x: 10, y: 20, z: 0 },
});

describe('actor presentation policy', () => {
  it('is deterministic and driven by authored view distance rather than town XYZ', () => {
    const first = resolveActorPresentation(baseContext());
    const moved = resolveActorPresentation({
      ...baseContext(),
      worldPosition: { x: 900, y: -400, z: 12 },
    });

    expect(first).toEqual({ actorId: 'actor_alpha', tier: 'full_character' });
    expect(moved).toEqual(first);
  });

  it('uses eye-level distance tiers and authored visibility', () => {
    expect(resolveActorPresentation({ ...baseContext(), viewDistance: 0.45 }).tier).toBe('silhouette_large');
    expect(resolveActorPresentation({ ...baseContext(), viewDistance: 0.8 }).tier).toBe('background');
    expect(resolveActorPresentation({ ...baseContext(), authoredVisible: false }).tier).toBe('hidden');
  });

  it('keeps city top-down lightweight while focus promotes the same actor', () => {
    expect(resolveActorPresentation({ ...baseContext(), cameraMode: 'city_topdown' }).tier).toBe('silhouette_small');
    expect(resolveActorPresentation({ ...baseContext(), cameraMode: 'city_topdown', focused: true }).tier).toBe('full_character');
    expect(resolveActorPresentation({ ...baseContext(), cameraMode: 'city_topdown', selected: true }).tier).toBe('full_character');
  });

  it('projects knowledge-safe labels and context-sensitive actions for the real actor', () => {
    const stranger = buildActorInteractionProjection({
      actorId: 'actor_alpha',
      knownIdentity: false,
      canonicalDisplayName: 'Secret Canonical Name',
      observableLabel: 'Someone by the window',
      relationship: 'stranger',
      busy: false,
      workerRoleKnown: false,
    });
    const friend = buildActorInteractionProjection({
      actorId: 'actor_alpha',
      knownIdentity: true,
      canonicalDisplayName: 'Alex',
      relationship: 'friend',
      busy: false,
      workerRoleKnown: false,
    });
    const worker = buildActorInteractionProjection({
      actorId: 'actor_alpha',
      knownIdentity: false,
      canonicalDisplayName: 'Secret Canonical Name',
      observableLabel: 'The cashier',
      relationship: 'stranger',
      busy: false,
      workerRoleKnown: true,
    });
    const busy = buildActorInteractionProjection({ ...friend, canonicalDisplayName: 'Alex', knownIdentity: true, relationship: 'friend', busy: true, workerRoleKnown: false });

    expect(stranger.actorId).toBe('actor_alpha');
    expect(stranger.label).toBe('Someone by the window');
    expect(stranger.label).not.toContain('Secret');
    expect(stranger.actions).toEqual(['inspect', 'greet']);
    expect(friend.actions).toEqual(['inspect', 'greet', 'talk', 'wave']);
    expect(worker.actions).toEqual(['inspect', 'greet', 'ask_for_help']);
    expect(busy.actions).toEqual(['inspect', 'wave']);
  });

  it('projects one persistent actor through different authored views without changing identity', () => {
    const near = projectActorIntoView('actor_alpha', {
      viewId: 'view_near',
      cameraMode: 'eye_level',
      x: 0.35,
      y: 0.7,
      distance: 0.2,
      facing: 'front_3q_left',
      visible: true,
    });
    const far = projectActorIntoView('actor_alpha', {
      viewId: 'view_far',
      cameraMode: 'eye_level',
      x: 0.8,
      y: 0.45,
      distance: 0.75,
      facing: 'side_right',
      visible: true,
    });

    expect(near).toMatchObject({ actorId: 'actor_alpha', viewId: 'view_near', tier: 'full_character', x: 0.35, y: 0.7 });
    expect(far).toMatchObject({ actorId: 'actor_alpha', viewId: 'view_far', tier: 'background', x: 0.8, y: 0.45 });
    expect(near.actorId).toBe(far.actorId);
  });

  it('keeps focus transient while authored placement remains unchanged', () => {
    const placement = {
      viewId: 'view_near',
      cameraMode: 'eye_level' as const,
      x: 0.35,
      y: 0.7,
      distance: 0.55,
      facing: 'front' as const,
      visible: true,
    };
    const normal = projectActorIntoView('actor_alpha', placement);
    const focused = projectActorIntoView('actor_alpha', placement, { focused: true });
    const returned = projectActorIntoView('actor_alpha', placement);

    expect(normal.tier).toBe('silhouette_large');
    expect(focused.tier).toBe('full_character');
    expect(returned).toEqual(normal);
  });
});

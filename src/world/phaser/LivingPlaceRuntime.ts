import { createSemanticInteractionIntent, createViewTransitionIntent } from './presentationAdapter';
import type { WorldCameraFocus, WorldInteractionIntent, WorldSceneProjection } from './types';

type RuntimeObjectState = Record<string, unknown>;

export interface LivingPlaceRuntimeSnapshot {
  projection: WorldSceneProjection;
  objectState: Record<string, RuntimeObjectState>;
}

function cloneProjection(projection: WorldSceneProjection): WorldSceneProjection {
  return structuredClone(projection);
}

export class LivingPlaceRuntime {
  private projection: WorldSceneProjection;
  private readonly objectState = new Map<string, RuntimeObjectState>();

  constructor(initialProjection: WorldSceneProjection) {
    this.projection = cloneProjection(initialProjection);
  }

  getCurrentProjection(): WorldSceneProjection {
    return cloneProjection(this.projection);
  }

  getNeighborViewIds(): string[] {
    const current = this.projection.availableViews.find((view) => view.id === this.projection.viewId);
    return [...(current?.neighbors ?? [])];
  }

  transitionToNeighbor(targetViewId: string): WorldInteractionIntent {
    if (!this.getNeighborViewIds().includes(targetViewId)) {
      throw new Error(`View ${targetViewId} is not an authored neighbor of ${this.projection.viewId}`);
    }
    return createViewTransitionIntent(targetViewId);
  }

  applyProjection(nextProjection: WorldSceneProjection): void {
    if (nextProjection.placeId !== this.projection.placeId) {
      throw new Error('LivingPlaceRuntime cannot apply a projection from a different place');
    }
    this.projection = cloneProjection(nextProjection);
  }

  openFocus(focus: WorldCameraFocus): void {
    this.projection = {
      ...this.projection,
      focus: { ...focus },
    };
  }

  closeFocus(): void {
    this.projection = {
      ...this.projection,
      focus: null,
    };
  }

  setObjectState(instanceId: string, state: RuntimeObjectState): void {
    this.objectState.set(instanceId, structuredClone(state));
  }

  getObjectState(instanceId: string): RuntimeObjectState | undefined {
    const state = this.objectState.get(instanceId);
    return state ? structuredClone(state) : undefined;
  }

  interact(anchorId: string, interactionId: string, payload?: Record<string, unknown>): WorldInteractionIntent {
    const anchor = this.projection.anchors.find((candidate) => candidate.id === anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} is not visible in view ${this.projection.viewId}`);
    }

    const interaction = anchor.interactions.find((candidate) => candidate.id === interactionId);
    if (!interaction) {
      throw new Error(`Interaction ${interactionId} is not authored for anchor ${anchorId}`);
    }

    return createSemanticInteractionIntent(anchor.id, interaction.capability, interaction.name, payload);
  }

  getSnapshot(): LivingPlaceRuntimeSnapshot {
    return {
      projection: cloneProjection(this.projection),
      objectState: Object.fromEntries(
        [...this.objectState.entries()].map(([instanceId, state]) => [instanceId, structuredClone(state)])
      ),
    };
  }
}

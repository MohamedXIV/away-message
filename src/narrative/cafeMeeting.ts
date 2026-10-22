import type { SimulationEngine } from '../engine/SimulationEngine';
import type { NarrativeFrame } from './contracts';
import type { NarrativeCoordinator } from './NarrativeCoordinator';
import { createSimulationNarrative } from './SimulationNarrativeAdapter';
import { CAFE_MEETING_INTERACTION_ID } from './flows';

export interface CafeMeetingNarrative {
  coordinator: NarrativeCoordinator;
  frame: NarrativeFrame;
}

/**
 * Start the authored café flow only for a canonical in-person guest at the
 * requested place. Presence remains owned by Social/NPC movement reads.
 */
export function startCafeMeetingNarrative(
  engine: SimulationEngine,
  actorId: string,
  placeId: string,
): CafeMeetingNarrative | null {
  if (!actorId || !placeId) return null;
  const guest = engine.getCafeGuestRead(placeId, actorId).guest;
  if (guest?.actorId !== actorId) return null;
  const { coordinator } = createSimulationNarrative(engine);
  const started = coordinator.requestInteraction({
    interactionId: CAFE_MEETING_INTERACTION_ID,
    actorId,
    placeId,
  });
  if (!started.started) {
    coordinator.end();
    return null;
  }
  return { coordinator, frame: coordinator.advanceToChoices() };
}

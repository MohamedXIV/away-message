import type { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import { GENERATED_VENUE_SERVICES } from '../../engine/worldContent.generated';
import { createSimulationNarrative } from '../../narrative/SimulationNarrativeAdapter';
import { CAFE_MEETING_INTERACTION_ID } from '../../narrative/flows';
import type { NarrativeFrame } from '../../narrative/contracts';
import type { NarrativeCoordinatorState } from '../../narrative/NarrativeCoordinator';
import type { SimulationCafeNarrativeCommand, SimulationCafeNarrativeResult } from './SimulationHostProtocol';

const cafeVenue = (() => {
  const venue = GENERATED_VENUE_SERVICES.find(service => service.tags.includes('cafe'));
  if (!venue) throw new Error('Authored café venue is unavailable');
  return venue;
})();

/**
 * One Worker-only authored conversation bound to canonical physical presence.
 * No UI-provided actor IDs, venue IDs, full graphs, effects or Ink payloads.
 */
export function createWorkerCafeNarrative(engine: SimulationKernel) {
  const { coordinator } = createSimulationNarrative(engine);
  let actor: SimulationCafeNarrativeResult['actor'] = null;
  let lastFrame: NarrativeFrame | null = null;

  function reset(): SimulationCafeNarrativeResult {
    coordinator.end();
    actor = null;
    lastFrame = null;
    return { active: false, actor: null, frame: null };
  }

  function requirePresent(requestedActorId?: string) {
    if (engine.getWorldRead().playerLocation !== 'cafe') {
      throw new Error('You must be at Starlight Café to meet someone in person.');
    }
    const guest = engine.getCafeGuestRead(cafeVenue.placeId, requestedActorId).guest;
    if (!guest || (requestedActorId && guest.actorId !== requestedActorId)) {
      throw new Error('No player-known contact is physically present at the café.');
    }
    return guest;
  }

  function present(frame: NarrativeFrame): SimulationCafeNarrativeResult {
    lastFrame = frame;
    return {
      active: true,
      actor,
      frame: {
        text: frame.text.slice(0, 4000),
        tags: frame.tags.slice(0, 16).map(tag => tag.slice(0, 80)),
        choices: frame.choices.slice(0, 8).map(choice => ({
          id: choice.id.slice(0, 80), text: choice.text.slice(0, 180),
        })),
        canContinue: frame.canContinue,
      },
    };
  }

  /** Optional slot sidecar; never include an NPC roster or owner graph. */
  function checkpoint(): { version: 1; actorId: string; coordinator: NarrativeCoordinatorState } | null {
    if (!actor || !lastFrame?.choices.length) return null;
    try { requirePresent(actor.actorId); }
    catch { reset(); return null; }
    const snapshot = {
      version: 1 as const,
      actorId: actor.actorId,
      coordinator: coordinator.save(),
    };
    // Bounded sidecar rather than unbounded, user-facing text/history export.
    return JSON.stringify(snapshot).length <= 65536 ? snapshot : null;
  }

  /** Malformed or departed-guest sidecars are rejected without losing world state. */
  function restore(input: unknown): boolean {
    reset();
    try {
      if (!input || typeof input !== 'object' ||
          JSON.stringify(input).length > 65536) return false;
      const saved = input as {
        version?: unknown; actorId?: unknown; coordinator?: NarrativeCoordinatorState;
      };
      if (saved.version !== 1 || typeof saved.actorId !== 'string' ||
          saved.actorId.length < 1 || saved.actorId.length > 128) return false;
      const state = saved.coordinator;
      if (!state || state.version !== 1 ||
          state.session?.flowId !== 'cafe_meeting' ||
          state.session?.actorId !== saved.actorId ||
          state.session?.placeId !== cafeVenue.placeId ||
          state.host?.flowId !== 'cafe_meeting') return false;
      const guest = requirePresent(saved.actorId);
      coordinator.load(state);
      const frame = coordinator.advanceToChoices();
      if (!frame.choices.length) { reset(); return false; }
      actor = { actorId: guest.actorId, displayName: guest.displayName };
      lastFrame = frame;
      return true;
    } catch {
      reset();
      return false;
    }
  }

  return {
    checkpoint,
    restore,
    run(command: SimulationCafeNarrativeCommand): SimulationCafeNarrativeResult {
      if (!command || typeof command !== 'object') {
        throw new Error('Invalid café narrative command.');
      }
      if (command.kind === 'end') return reset();
      if (command.kind === 'current') {
        if (!actor || !lastFrame) return reset();
        try { requirePresent(actor.actorId); }
        catch { return reset(); }
        return present(lastFrame);
      }
      if (command.kind === 'startCafe') {
        if (actor) throw new Error('Finish the current café conversation first.');
        const guest = requirePresent();
        const result = coordinator.requestInteraction({
          interactionId: CAFE_MEETING_INTERACTION_ID,
          actorId: guest.actorId,
          placeId: cafeVenue.placeId,
        });
        if (!result.started) throw new Error('The authored café conversation is unavailable.');
        actor = { actorId: guest.actorId, displayName: guest.displayName };
        return present(coordinator.advanceToChoices());
      }
      if (command.kind === 'choose') {
        if (!actor) throw new Error('No active café conversation.');
        try { requirePresent(actor.actorId); }
        catch (cause) {
          reset();
          throw cause;
        }
        const current = coordinator.getCurrentFrame();
        if (!Number.isSafeInteger(command.choiceIndex) || command.choiceIndex < 0 ||
          !current || command.choiceIndex >= current.choices.length) {
          throw new Error('Unknown or stale authored café choice.');
        }
        const chosen = coordinator.choose(command.choiceIndex);
        return present(chosen.canContinue && chosen.choices.length === 0
          ? coordinator.advanceToChoices() : chosen);
      }
      throw new Error('Unknown café narrative operation.');
    },
  };
}

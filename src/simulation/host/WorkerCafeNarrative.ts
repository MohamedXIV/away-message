import type { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import { GENERATED_VENUE_SERVICES } from '../../engine/worldContent.generated';
import { createSimulationNarrative } from '../../narrative/SimulationNarrativeAdapter';
import { CAFE_MEETING_INTERACTION_ID } from '../../narrative/flows';
import type { NarrativeFrame } from '../../narrative/contracts';
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

  function reset(): SimulationCafeNarrativeResult {
    coordinator.end();
    actor = null;
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

  return {
    run(command: SimulationCafeNarrativeCommand): SimulationCafeNarrativeResult {
      if (!command || typeof command !== 'object') {
        throw new Error('Invalid café narrative command.');
      }
      if (command.kind === 'end') return reset();
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

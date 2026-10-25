import type { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import { createSimulationNarrative } from '../../narrative/SimulationNarrativeAdapter';
import { PULSE_CONTEXTUAL_FLOWS } from '../../narrative/flows';
import type { NarrativeCoordinator } from '../../narrative/NarrativeCoordinator';
import type { SimulationPulseNarrativeCommand, SimulationPulseNarrativeResult } from './SimulationHostProtocol';

const MAX_CHOICES = 8;

/** A deliberately bounded first offline Pulse flow. Every choice comes from
 * compiled Ink inside the authoritative Worker. The player never injects
 * an arbitrary sentence into a pretend natural-language parser.
 */
export function createWorkerPulseNarrative(engine: SimulationKernel) {
  function prepare(actorId: string): {
    coordinator: NarrativeCoordinator;
    choices: SimulationPulseNarrativeResult['choices'];
  } {
    if (!engine.getChromeRead().pulseInstalled) {
      throw new Error('Install Pulse Messenger to chat.');
    }
    if (!actorId || actorId.length > 128 || !engine.social.isKnown(actorId)) {
      throw new Error('This contact is not in your buddy list.');
    }
    const actor = engine.getPlayerActorRead(actorId)?.actor;
    if (!actor || actor.lifecycle === 'departed' || actor.connection === 'blocked') {
      throw new Error('This contact is unavailable.');
    }
    // Prioritize canonical contact and relationship truth over flavor roles.
    // Only mutual, typed shared memories can unlock reminiscence: never
    // expose private NPC memory text or pretend the player knows a secret.
    const hasSharedMemory = engine.social.getCoreMemories(actorId).some(memory =>
      memory.kind === 'shared_moment'
      && memory.meaning?.participants.includes('player')
      && memory.meaning.participants.includes(actorId));
    const key = actor.relationship.conflicted ? 'repair'
      : hasSharedMemory ? 'reminisce'
      : actor.relationship.trusted ? 'trusted'
      : actor.reach === 'remote' ? 'remote'
      : actor.roles.includes('diner-staff') ? 'nearby'
      : actor.roles.includes('canal-regular') ? 'night'
      : actor.roles.includes('shift-worker') ? 'shift'
      : null;
    // Without a matching contextual flow the original Ink check-in remains
    // available. All choices/effects still originate from inkjs inside Worker.
    const flow = key ? PULSE_CONTEXTUAL_FLOWS[key] : undefined;
    const { coordinator } = createSimulationNarrative(engine, flow ? [flow] : undefined);
    const started = coordinator.handleSemanticEvent({
      kind: 'conversation_started', channel: 'pulse', actorId,
    });
    if (!started.started) throw new Error('There is no authored conversation for this contact.');
    const frame = coordinator.advanceToChoices();
    const choices = frame.choices.slice(0, MAX_CHOICES).map(choice => ({
      id: choice.id, text: choice.text.trim().slice(0, 180),
    }));
    if (choices.length === 0) throw new Error('No reply choices are available yet.');
    return { coordinator, choices };
  }

  return {
    run(command: SimulationPulseNarrativeCommand): SimulationPulseNarrativeResult {
      if (!command || (command.kind !== 'choices' && command.kind !== 'choose')) {
        throw new Error('Invalid Pulse conversation command.');
      }
      const { coordinator, choices } = prepare(command.actorId);
      if (command.kind === 'choices') {
        return { revision: engine.getMessengerRead(0).revision, actorId: command.actorId, choices };
      }
      if (!Number.isSafeInteger(command.choiceIndex)
        || command.choiceIndex < 0 || command.choiceIndex >= choices.length
        || typeof command.expectedText !== 'string'
        || choices[command.choiceIndex]?.text !== command.expectedText) {
        throw new Error('This reply is no longer available. Choose another.');
      }
      const outgoing = choices[command.choiceIndex]!.text;
      const sent = engine.dispatchAction({
        type: 'SOCIAL_SEND_MESSAGE', buddyId: command.actorId, text: outgoing,
      });
      if (!sent.success) throw new Error(sent.error ?? 'Message could not be sent.');
      // Social is the sole message owner. Offline contacts receive an outbound
      // message but do not spontaneously answer as if they were online.
      let reply: string | null = null;
      if (engine.getPlayerActorRead(command.actorId)?.actor.canChatNow.allowed) {
        const chosen = coordinator.choose(command.choiceIndex);
        const response = chosen.canContinue && chosen.choices.length === 0
          ? coordinator.advanceToChoices() : chosen;
        const authored = response.text.trim().slice(0, 500);
        if (authored) {
          const received = engine.dispatchAction({
            type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: command.actorId, text: authored,
            tags: ['ink_pulse', 'authored'],
          });
          if (!received.success) throw new Error(received.error ?? 'Reply could not be delivered.');
          reply = authored;
        }
      }
      return { revision: engine.getMessengerRead(0).revision,
        actorId: command.actorId, choices: prepare(command.actorId).choices,
        sent: outgoing, reply };
    },
  };
}

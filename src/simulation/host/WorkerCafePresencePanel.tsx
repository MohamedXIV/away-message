import { useEffect, useMemo, useState } from 'react';
import type { SimulationCafeGuestRead, SimulationWorldRead } from '../../engine/kernel/SimulationPublication';
import { GENERATED_VENUE_SERVICES } from '../../engine/worldContent.generated';
import { PhysicalWorldBoundary } from '../../world/phaser/PhysicalWorldBoundary';
import { createWorldSceneProjection } from '../../world/phaser/presentationAdapter';
import type { WorkerGameSession } from './WorkerGameSession';
import type { SimulationCafeNarrativeResult } from './SimulationHostProtocol';

/** Authored Phaser geometry is presentation; the Worker alone owns who is here. */
const cafeVenue = (() => {
  const venue = GENERATED_VENUE_SERVICES.find(service => service.tags.includes('cafe'));
  if (!venue) throw new Error('Authored café venue is unavailable');
  return venue;
})();

export function WorkerCafePresencePanel({
  session, world, revision,
}: {
  session: WorkerGameSession;
  world: SimulationWorldRead;
  revision: number;
}) {
  const [read, setRead] = useState<SimulationCafeGuestRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<SimulationCafeNarrativeResult | null>(null);
  const [dialogueBusy, setDialogueBusy] = useState(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void session.read({ kind: 'cafeGuest' }).then(result => {
      if (!alive) return;
      setRead(result);
      setError(null);
    }).catch(cause => {
      if (!alive) return;
      setRead(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { alive = false; };
  }, [session, revision]);

  // A cold-loaded Worker restores the saved authored choice point from the
  // same atomic save document. No narrative state is reconstructed in React.
  useEffect(() => {
    let active = true;
    void session.cafeNarrative({ kind: 'current' }).then(result => {
      if (active && result.active) setDialogue(result);
    }).catch(cause => {
      if (active) setDialogueError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session]);

  // Revision mismatch immediately invalidates older presence evidence.
  const verified = read?.revision === revision && read.placeId === cafeVenue.placeId;
  const guest = verified ? read.guest : null;
  const projection = useMemo(() => createWorldSceneProjection({
    placeId: cafeVenue.placeId,
    timeOfDay: world.time.timeOfDay,
    minuteOfDay: world.time.hour * 60 + world.time.minute,
    environment: world.environment,
    isInterior: true,
    actorByAnchorId: guest ? { fixture_cafe_customer_anchor: guest.actorId } : {},
  }), [world, guest?.actorId]);

  const interact = async (command: Parameters<WorkerGameSession['cafeNarrative']>[0]) => {
    if (dialogueBusy) return;
    setDialogueBusy(true);
    setDialogueError(null);
    try {
      const result = await session.cafeNarrative(command);
      setDialogue(result.active ? result : null);
    } catch (cause) {
      setDialogueError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDialogueBusy(false);
    }
  };
  // The UI does not enable choices against a stale guest projection.
  const sameGuest = verified && Boolean(dialogue?.actor && guest?.actorId === dialogue.actor.actorId);

  return (
    <section data-testid="worker-cafe-scene"
      className="space-y-2 rounded border border-amber-800/40 bg-slate-900 p-3">
      <h3 className="text-sm font-semibold text-amber-200">Inside Starlight Café</h3>
      <div className="relative h-72 overflow-hidden rounded border border-slate-700 bg-black">
        <PhysicalWorldBoundary projection={projection} visualMode="production" className="h-full w-full" />
      </div>
      <p data-testid="worker-cafe-presence" role="status" className="text-xs text-slate-300">
        {error ? 'Unable to check who is here: ' + error
          : !verified ? 'Checking who is here…'
          : guest ? guest.displayName + ' is here at the café.'
          : 'No one you know is here right now.'}
      </p>
      {!dialogue && verified && guest && (
        <button type="button" disabled={dialogueBusy}
          className="rounded border border-amber-500 px-3 py-2 text-sm text-amber-200 disabled:opacity-50"
          onClick={() => void interact({ kind: 'startCafe' })}>
          Talk with {guest.displayName}
        </button>
      )}
      {dialogue?.frame && (
        <div data-testid="worker-cafe-dialogue"
          className="space-y-3 rounded border border-amber-700/50 bg-slate-950 p-4 text-sm">
          <p className="text-xs font-bold text-amber-300">{dialogue.actor?.displayName ?? 'Café guest'} · in person</p>
          <p data-testid="worker-cafe-dialogue-text" className="whitespace-pre-wrap leading-relaxed">
            {dialogue.frame.text}
          </p>
          <div className="flex flex-wrap gap-2">
            {dialogue.frame.choices.map((choice, index) => (
              <button type="button" key={choice.id}
                disabled={dialogueBusy || !sameGuest}
                className="rounded border border-amber-800 px-3 py-2 text-left disabled:opacity-40"
                onClick={() => void interact({ kind: 'choose', choiceIndex: index })}>
                {choice.text}
              </button>
            ))}
          </div>
          {!sameGuest && <p role="status" className="text-amber-200">
            Checking that your guest is still here before the next choice.
          </p>}
          <button type="button" disabled={dialogueBusy}
            className="rounded border border-slate-600 px-3 py-2 text-xs disabled:opacity-40"
            onClick={() => void interact({ kind: 'end' })}>Finish conversation</button>
        </div>
      )}
      {dialogueError && <p role="alert" className="text-xs text-red-300">{dialogueError}</p>}
      <p className="text-xs text-slate-500">
        A contact being online does not mean they are here in person.
      </p>
    </section>
  );
}

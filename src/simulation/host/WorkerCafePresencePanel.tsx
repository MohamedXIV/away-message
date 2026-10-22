import { useEffect, useMemo, useState } from 'react';
import type { SimulationCafeGuestRead, SimulationWorldRead } from '../../engine/kernel/SimulationPublication';
import { GENERATED_VENUE_SERVICES } from '../../engine/worldContent.generated';
import { PhysicalWorldBoundary } from '../../world/phaser/PhysicalWorldBoundary';
import { createWorldSceneProjection } from '../../world/phaser/presentationAdapter';
import type { WorkerGameSession } from './WorkerGameSession';

/** Authored Phaser geometry is presentation; the Worker alone owns who is here. */
const cafeVenue = GENERATED_VENUE_SERVICES.find(service => service.tags.includes('cafe'));
if (!cafeVenue) throw new Error('Authored café venue is unavailable');

export function WorkerCafePresencePanel({
  session, world, revision,
}: {
  session: WorkerGameSession;
  world: SimulationWorldRead;
  revision: number;
}) {
  const [read, setRead] = useState<SimulationCafeGuestRead | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <p className="text-xs text-slate-500">
        A contact being online does not mean they are here in person.
      </p>
    </section>
  );
}

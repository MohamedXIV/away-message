import { useEffect, useMemo, useState } from 'react';
import type { SimulationAction, ActionResult } from '../../engine/types';
import type { SimulationWorldRead } from '../../engine/kernel/SimulationPublication';
import { PhysicalWorldBoundary } from '../../world/phaser/PhysicalWorldBoundary';
import { createWorldSceneProjection } from '../../world/phaser/presentationAdapter';
import type { WorldInteractionIntent } from '../../world/phaser/types';

/** The same authored Phaser world as RoomScene, driven exclusively by a
 * worker-owned bounded WorldRead. Phaser renders, but never owns gameplay.
 */
export function WorkerPhysicalRoom({
  world, dispatch, onOpenCity, onOpenDesktop,
}: {
  world: SimulationWorldRead;
  dispatch: (action: SimulationAction) => Promise<ActionResult>;
  onOpenCity: () => void;
  onOpenDesktop: () => void;
}) {
  const [preferredView, setPreferredView] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { setPreferredView(undefined); }, [world.residencePlaceId]);
  const projection = useMemo(() => createWorldSceneProjection({
    placeId: world.residencePlaceId,
    ...(preferredView ? { viewId: preferredView } : {}),
    timeOfDay: world.time.timeOfDay,
    minuteOfDay: world.time.hour * 60 + world.time.minute,
    environment: world.environment,
    isInterior: true,
  }), [world, preferredView]);

  const act = (action: SimulationAction, label: string) => {
    void dispatch(action).then(result => {
      setNotice(result.success ? label : result.error || 'Interaction rejected');
    }).catch(error => setNotice(error instanceof Error ? error.message : String(error)));
  };

  const onIntent = (intent: WorldInteractionIntent) => {
    if (intent.type === 'VIEW_TRANSITION' && intent.targetViewId) {
      setPreferredView(intent.targetViewId);
      return;
    }
    if (intent.type !== 'INTERACTION') return;
    switch (intent.capability) {
      case 'prepare_drink':
        act({ type: 'PLAYER_INTERACT_ROOM', activity: 'tea' }, 'Prepared tea');
        break;
      case 'shower':
        act({ type: 'PLAYER_INTERACT_ROOM', activity: 'shower' }, 'Took a shower');
        break;
      case 'observe_window':
        act({ type: 'PLAYER_INTERACT_ROOM', activity: 'window' }, 'Observed the window');
        break;
      case 'sleep':
        act({ type: 'PLAYER_REST_OR_SLEEP' }, 'Rested until morning');
        break;
      case 'use_computer':
        if (world.pcBootState === 'desktop') onOpenDesktop();
        else setNotice('Computer not bootable. Open Desktop → Computer & Setup.');
        break;
      case 'leave_room':
        onOpenCity();
        break;
      default:
        if (intent.capability?.startsWith('inspect_') || intent.capability?.startsWith('open_')) {
          setNotice(intent.name || 'Inspected the room');
        }
    }
  };

  return (
    <section className="flex min-h-[460px] flex-col gap-2" data-testid="worker-physical-room">
      <header className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <span>Authored Phaser residence: {projection.placeName} · {projection.viewName}</span>
        <div className="flex flex-wrap gap-2">
          {projection.availableViews.map(view => (
            <button key={view.id} type="button"
              aria-label={'Room view: ' + view.name}
              className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800"
              onClick={() => setPreferredView(view.id)}>
              {view.name}
            </button>
          ))}
        </div>
      </header>
      <div className="relative h-[420px] w-full overflow-hidden rounded border border-slate-700 bg-black">
        <PhysicalWorldBoundary
          projection={projection}
          onIntent={onIntent}
          visualMode="production"
          className="h-full w-full"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
          onClick={onOpenCity}>Leave room / City map</button>
        <button className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
          onClick={() => onIntent({ type: 'INTERACTION', capability: 'shower' })}>
          Shower
        </button>
        <button className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
          onClick={() => onIntent({ type: 'INTERACTION', capability: 'prepare_drink' })}>
          Prepare tea
        </button>
        <button className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
          onClick={() => onIntent({ type: 'INTERACTION', capability: 'observe_window' })}>
          Observe window
        </button>
      </div>
      {notice && <p role="status" data-testid="worker-room-notice"
        className="text-xs text-amber-200">{notice}</p>}
    </section>
  );
}

import type { SimulationState } from '../types';
import type { OsRelease } from '../OsCatalog';
import type { PulseRelease } from '../PulseCatalog';
import type { MyPlaceRelease } from '../MyPlaceCatalog';
import type { CoreDomainOwners } from './CoreDomainOwners';

function cloneOsRelease(rel: OsRelease): OsRelease {
  return {
    ...rel,
    changelog: [...rel.changelog],
    requirements: { ...rel.requirements },
  };
}

function clonePulseRelease(rel: PulseRelease): PulseRelease {
  return {
    ...rel,
    changelog: [...rel.changelog],
    requirements: { ...rel.requirements },
  };
}

function cloneMyPlaceRelease(rel: MyPlaceRelease): MyPlaceRelease {
  return {
    ...rel,
    changelog: [...rel.changelog],
    features: { ...rel.features },
  };
}

/**
 * Recursively freezes an object tree to prevent callers from mutating
 * public projection snapshots and internal domain structures.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object') {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Assembles the existing Core-compatible read projection from a single
 * domain-owner graph. It does NOT own state or keep a second snapshot.
 *
 * The old public state shape remains until #172's bounded projections and
 * #174's current-format persistence cutover.
 */
export function projectCoreState(
  owners: CoreDomainOwners,
  activeView: SimulationState['activeView'],
): Readonly<SimulationState> {
  const vfsState = owners.vfs.getState();
  const downloadState = owners.downloads.getState();
  const deliveryState = owners.delivery.getState();
  const worldState = owners.world.getState();
  const osState = owners.os.getState();
  const pulseState = owners.pulse.getState();
  const myplaceState = owners.myplace.getState();
  const economyState = owners.economy.getState();

  // Sandbox world state is canonical; narrative is deprecated alias (kept with buddyKnowledge for compat)
  const narrativeAlias = {
    activeBeatId: null as string | null,
    completedBeats: [] as string[],
    flags: { ...worldState.flags },
    appointments: worldState.appointments.map((a) => ({
      ...a,
      origin: a.origin ? { ...a.origin } : undefined,
    })),
    windowObservationHistory: [...worldState.windowObservationHistory],
    triggeredEvents: worldState.triggeredEvents.map((e) => ({ ...e })),
    buddyKnowledge: Object.fromEntries(
      Object.entries(worldState.buddyKnowledge).map(([k, v]) => [k, v.map((e) => ({ ...e }))]),
    ),
  };

  const clonedWorld = {
    flags: { ...worldState.flags },
    appointments: worldState.appointments.map((a) => ({
      ...a,
      origin: a.origin ? { ...a.origin } : undefined,
    })),
    windowObservationHistory: [...worldState.windowObservationHistory],
    triggeredEvents: worldState.triggeredEvents.map((e) => ({ ...e })),
    buddyKnowledge: Object.fromEntries(
      Object.entries(worldState.buddyKnowledge).map(([k, v]) => [k, v.map((e) => ({ ...e }))]),
    ),
  };

  const newState: SimulationState = {
    version: 1,
    time: { ...owners.clock.getTime() },
    player: {
      ...economyState,
      pantry: { ...economyState.pantry },
    },
    needs: { ...owners.needs.getState() },
    mood: { ...owners.mood.getState() },
    hardware: { ...owners.hardware.getState() },
    os: {
      ...osState,
      installedPatchIds: [...osState.installedPatchIds],
      lastInstallLog: osState.lastInstallLog ? [...osState.lastInstallLog] : [],
      proceduralCatalog: osState.proceduralCatalog ? osState.proceduralCatalog.map(cloneOsRelease) : [],
    },
    pulse: {
      ...pulseState,
      installedPatchIds: [...pulseState.installedPatchIds],
      lastUpdateLog: pulseState.lastUpdateLog ? [...pulseState.lastUpdateLog] : [],
      proceduralCatalog: pulseState.proceduralCatalog ? pulseState.proceduralCatalog.map(clonePulseRelease) : [],
    },
    myplace: {
      ...myplaceState,
      userProfile: {
        ...myplaceState.userProfile,
        interests: [...myplaceState.userProfile.interests],
        top8: myplaceState.userProfile.top8.map((t) => ({ ...t })),
      },
      guestbook: Object.fromEntries(
        Object.entries(myplaceState.guestbook).map(([k, v]) => [
          k,
          v.map((e) => ({ ...e })),
        ]),
      ),
      proceduralCatalog: myplaceState.proceduralCatalog ? myplaceState.proceduralCatalog.map(cloneMyPlaceRelease) : [],
    },
    vfs: {
      ...vfsState,
      files: { ...vfsState.files },
    },
    downloads: downloadState.tasks.map((t) => ({ ...t })),
    deliveries: {
      orders: deliveryState.orders.map((o) => ({
        ...o,
        items: o.items.map((i) => ({ ...i })),
      })),
    },
    installedSoftware: owners.software.getInstalledSoftware(),
    social: owners.social.getState(),
    world: clonedWorld,
    narrative: narrativeAlias,
    telemetry: {
      stats: owners.telemetry.getStats(),
      logs: [...owners.telemetry.getLogs()],
    },
    activeView,
  };
  return deepFreeze(structuredClone(newState));
}

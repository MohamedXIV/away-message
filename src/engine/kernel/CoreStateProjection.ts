import type { SimulationState } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';

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
    // Sync hardware osVersion to OsEngine truth
    const hwState = owners.hardware.getState();
    if ((hwState as any).osVersion !== osState.currentOsId) {
      (owners.hardware as any).state.osVersion = osState.currentOsId;
    }

    // Sandbox world state is canonical; narrative is deprecated alias (kept with buddyKnowledge for compat)
    const narrativeAlias = {
      activeBeatId: null as string | null,
      completedBeats: [] as string[],
      flags: { ...worldState.flags },
      appointments: worldState.appointments.map((a) => ({ ...a })),
      windowObservationHistory: [...worldState.windowObservationHistory],
      triggeredEvents: [...worldState.triggeredEvents],
      buddyKnowledge: { ...worldState.buddyKnowledge },
    };

    const newState: Readonly<SimulationState> = {
      version: 1,
      time: owners.clock.getTime(),
      player: owners.economy.getState(),
      needs: owners.needs.getState(),
      mood: owners.mood.getState(),
      hardware: owners.hardware.getState(),
      os: osState,
      pulse: pulseState,
      myplace: myplaceState,
      vfs: vfsState,
      downloads: downloadState.tasks,
      deliveries: deliveryState,
      installedSoftware: owners.software.getInstalledSoftware(),
      social: owners.social.getState(),
      world: worldState,
      narrative: narrativeAlias,
      telemetry: {
        stats: owners.telemetry.getStats(),
        logs: [...owners.telemetry.getLogs()],
      },
      activeView,
    };
  return newState;
}

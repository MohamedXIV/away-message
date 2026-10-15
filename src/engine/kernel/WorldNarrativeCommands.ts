import type { ActionResult, SimulationAction } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';

/**
 * World event/flag/appointment commands and intentionally retained narrative
 * aliases all write to the ONE WorldEventsEngine + shared EventBus.
 * No second narrative timeline, beat list or appointment store exists.
 */
export class WorldNarrativeCommands {
  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'world' | 'events'>,
    private readonly publishState: () => void,
  ) {}

  public dispatch(action: SimulationAction, currentMinutes: number): ActionResult | null {
    switch (action.type) {
      case 'WORLD_SET_FLAG': {
        this.owners.world.setFlag(action.key, action.value);
        this.owners.events.emit('world:flag_changed', { key: action.key, value: action.value });
        this.publishState();
        return { success: true };
      }

      case 'WORLD_TRIGGER_EVENT': {
        const evt = this.owners.world.triggerEventById(action.eventId, currentMinutes);
        if (!evt) return { success: false, error: `Event not found or already triggered: ${action.eventId}` };
        this.publishState();
        return { success: true, data: evt };
      }

      case 'WORLD_ADD_OBSERVATION': {
        this.owners.world.addWindowObservation(action.entry);
        this.publishState();
        return { success: true };
      }

      case 'WORLD_SCHEDULE_APPOINTMENT': {
        const appt = this.owners.world.scheduleAppointment(action.appointment);
        this.owners.events.emit('world:appointment_scheduled', { appointment: appt });
        this.publishState();
        return { success: true, data: appt };
      }

      // Deprecated narrative aliases — routed to world
      case 'NARRATIVE_TRIGGER_BEAT': {
        // No-op in sandbox: beats removed. Keep for compat, emit but don't store.
        this.owners.events.emit('narrative:beat_triggered', { beatId: (action as any).beatId });
        this.publishState();
        return { success: true };
      }

      case 'NARRATIVE_SET_FLAG': {
        this.owners.world.setFlag(action.key, action.value);
        this.owners.events.emit('world:flag_changed', { key: action.key, value: action.value });
        this.publishState();
        return { success: true };
      }

      case 'NARRATIVE_SCHEDULE_APPOINTMENT': {
        const appt = this.owners.world.scheduleAppointment(action.appointment);
        this.owners.events.emit('world:appointment_scheduled', { appointment: appt });
        this.publishState();
        return { success: true, data: appt };
      }

      default:
        return null;
    }
  }
}

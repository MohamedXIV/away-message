import type { ActionResult, SimulationAction } from '../types';
import type { DesktopStorageCommands } from './DesktopStorageCommands';
import type { SocialInteractionCommands } from './SocialInteractionCommands';
import type { WorldNarrativeCommands } from './WorldNarrativeCommands';
import type { PlayerEconomyCommands } from './PlayerEconomyCommands';
import type { PlayerRoutineCommands } from './PlayerRoutineCommands';
import type { PlayerHardwareCommands } from './PlayerHardwareCommands';
import type { SimulationControlCommands } from './SimulationControlCommands';

export interface CommandHandlers {
  control: SimulationControlCommands;
  economy: PlayerEconomyCommands;
  routine: PlayerRoutineCommands;
  hardware: PlayerHardwareCommands;
  desktop: DesktopStorageCommands;
  social: SocialInteractionCommands;
  world: WorldNarrativeCommands;
}

/**
 * Authoritative Core command router. Composes focused domain command handlers,
 * ensures each command executes exactly once, and returns an authoritative ActionResult.
 */
export class CoreCommandRouting {
  constructor(private readonly handlers: CommandHandlers) {}

  public dispatch(action: SimulationAction, currentMinutes: number): ActionResult {
    const result =
      this.handlers.control.dispatch(action, currentMinutes) ??
      this.handlers.economy.dispatch(action, currentMinutes) ??
      this.handlers.routine.dispatch(action, currentMinutes) ??
      this.handlers.hardware.dispatch(action, currentMinutes) ??
      this.handlers.desktop.dispatch(action, currentMinutes) ??
      this.handlers.social.dispatch(action, currentMinutes) ??
      this.handlers.world.dispatch(action, currentMinutes);

    if (result !== null) {
      return result;
    }

    return {
      success: false,
      error: `Unhandled action: ${(action as any).type}`,
    };
  }
}

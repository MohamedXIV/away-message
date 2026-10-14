import type { ActionResult, SimulationAction } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';

/**
 * Player hardware/OS upgrade commands.
 * Coordinates with Economy, HardwareEngine, OsEngine, and Telemetry.
 */
export class PlayerHardwareCommands {
  constructor(
    private readonly owners: Pick<
      CoreDomainOwners,
      'economy' | 'hardware' | 'telemetry'
    >,
    private readonly publishState: () => void,
    _advanceGameMinutes?: (minutes: number, reason: string) => void,
  ) {}

  public dispatch(action: SimulationAction, currentMinutes: number): ActionResult | null {
    switch (action.type) {
      case 'HARDWARE_UPGRADE_RAM': {
        if (!this.owners.economy.canAfford(action.cost)) {
          return { success: false, error: `Cannot afford RAM upgrade ($${action.cost.toFixed(2)}).` };
        }
        this.owners.economy.spendCash(action.cost, 'RAM Upgrade');
        const upgraded = this.owners.hardware.upgradeRam(action.ramMB);
        if (!upgraded) return { success: false, error: 'Failed to upgrade RAM.' };
        this.owners.telemetry.logEvent('hardware', 'ram_upgraded', currentMinutes, {
          ramMB: action.ramMB,
          cost: action.cost,
        });
        this.publishState();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_CONNECTION': {
        if (!this.owners.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford Internet upgrade ($${action.cost.toFixed(2)}).`,
          };
        }
        this.owners.economy.spendCash(action.cost, 'Internet Plan Upgrade');
        this.owners.hardware.upgradeConnection(action.connectionType);
        this.owners.telemetry.logEvent('hardware', 'connection_upgraded', currentMinutes, {
          connection: action.connectionType,
        });
        this.publishState();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_OS': {
        return {
          success: false,
          error: 'Legacy OS upgrades are retired. Buy, insert, and boot from owned setup media instead.',
        };
      }

      default:
        return null;
    }
  }
}

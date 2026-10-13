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
      'economy' | 'hardware' | 'telemetry' | 'os' | 'clock'
    >,
    private readonly advanceGameMinutes: (minutes: number, reason: string) => void,
    private readonly publishState: () => void,
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
        if (!this.owners.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford OS upgrade package ($${action.cost.toFixed(2)}).`,
          };
        }
        const hwState = this.owners.hardware.getState();
        const can = this.owners.os.canInstall(action.targetOs as any, hwState as any, this.owners.clock.getTime().day);
        if (!can.ok) return { success: false, error: can.reasons.join(' ') };
        const targetRel = can.release!;
        // Allocate disk upfront
        if (!this.owners.hardware.allocateDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024)) {
          return {
            success: false,
            error: `Not enough disk for ${targetRel.displayName} (${targetRel.installSizeGB}GB required). Free some space.`,
          };
        }
        this.owners.economy.spendCash(action.cost, `OS Upgrade (${targetRel.displayName})`);
        const res = this.owners.os.beginInstall(action.targetOs as any, hwState as any, this.owners.clock.getTime().day, currentMinutes);
        if (!res.success) {
          // refund disk on failure
          this.owners.hardware.freeDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024);
          return { success: false, error: res.error };
        }
        const ramFactor = hwState.ramMB < 768 ? 1.6 : hwState.ramMB < 1024 ? 1.2 : 1.0;
        const installMinutes = Math.round((22 + targetRel.installSizeGB * 14) * ramFactor) + (res.rebootCount ?? 2) * 3;
        this.advanceGameMinutes(installMinutes, `OS Install: ${targetRel.displayName} + ${res.rebootCount ?? 2} reboots`);
        // Sync hardware osVersion truth explicitly
        (this.owners.hardware as any).state.osVersion = this.owners.os.getCurrentOsId();
        this.owners.telemetry.logEvent('hardware', 'os_upgraded', currentMinutes, {
          targetOs: action.targetOs,
          displayName: targetRel.displayName,
          installMinutes,
          reboots: res.rebootCount,
          log: this.owners.os.getInstallLog().slice(-3).join(' | '),
        });
        this.publishState();
        return { success: true, data: { ...res, release: targetRel, installMinutes } };
      }

      default:
        return null;
    }
  }
}

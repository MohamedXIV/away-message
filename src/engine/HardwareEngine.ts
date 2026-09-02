import {
  HardwareState,
  ConnectionType,
  OsVersion,
  SoftwareRequirement,
  RamPressure,
} from './types';
import { EventBus } from './EventBus';
import { isMinOsSatisfied, getReleaseById } from './OsCatalog';

export class HardwareEngine {
  private state: HardwareState;
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialState?: Partial<HardwareState>) {
    this.eventBus = eventBus;
    this.state = {
      cpuTier: initialState?.cpuTier ?? 1,
      cpuName: initialState?.cpuName ?? 'Single-Core Orion x86 450MHz',
      ramMB: initialState?.ramMB ?? 512,
      hddTotalGB: initialState?.hddTotalGB ?? 40.0,
      hddFreeGB: initialState?.hddFreeGB ?? 7.0,
      connectionType: initialState?.connectionType ?? 'dsl_256k',
      connectionSpeedKbps: initialState?.connectionSpeedKbps ?? 256,
      osVersion: initialState?.osVersion ?? 'Orion_4.8',
      soundCardInstalled: initialState?.soundCardInstalled ?? true,
      speakersInstalled: initialState?.speakersInstalled ?? false,
      webcamInstalled: initialState?.webcamInstalled ?? false,
    };
  }

  public getState(): Readonly<HardwareState> {
    return { ...this.state };
  }

  public checkRequirements(req: SoftwareRequirement): { compatible: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // OS Check — use catalog ordering so 5.0/6.1/7.0-beta etc are understood
    if (!isMinOsSatisfied(this.state.osVersion as any, req.minOs as any)) {
      const cur = getReleaseById(this.state.osVersion as any);
      const need = getReleaseById(req.minOs as any);
      reasons.push(`Requires ${need ? need.displayName : req.minOs} or later (Current: ${cur ? cur.displayName : this.state.osVersion}).`);
    }

    // RAM Check
    if (this.state.ramMB < req.minRamMB) {
      reasons.push(`Requires at least ${req.minRamMB} MB RAM (Installed: ${this.state.ramMB} MB).`);
    }

    // CPU Check
    if (this.state.cpuTier < req.minCpuTier) {
      reasons.push(`Requires CPU Tier ${req.minCpuTier} or higher.`);
    }

    // Disk Check
    const requiredGB = req.requiredDiskBytes / (1024 * 1024 * 1024);
    if (this.state.hddFreeGB < requiredGB) {
      reasons.push(`Insufficient disk space. Requires ${requiredGB.toFixed(2)} GB (Free: ${this.state.hddFreeGB.toFixed(2)} GB).`);
    }

    return {
      compatible: reasons.length === 0,
      reasons,
    };
  }

  public calculateRamPressure(runningAppsMemoryMB: number): RamPressure {
    let osBaselineMB = 64;
    const rel = getReleaseById(this.state.osVersion as any);
    if (rel) osBaselineMB = rel.ramOverheadMB;
    else if (String(this.state.osVersion).includes('7.0')) osBaselineMB = 195;
    else if (String(this.state.osVersion).includes('6.')) osBaselineMB = 160;
    else if (String(this.state.osVersion).includes('5.')) osBaselineMB = 96;
    const totalUsedMB = osBaselineMB + runningAppsMemoryMB;
    const freeMB = Math.max(0, this.state.ramMB - totalUsedMB);
    const pressureRatio = totalUsedMB / this.state.ramMB;

    let status: 'nominal' | 'elevated' | 'critical' = 'nominal';
    if (pressureRatio >= 0.9) {
      status = 'critical';
    } else if (pressureRatio >= 0.75) {
      status = 'elevated';
    }

    return {
      totalRamMB: this.state.ramMB,
      usedRamMB: totalUsedMB,
      freeRamMB: freeMB,
      pressureRatio,
      status,
    };
  }

  public upgradeRam(newRamMB: number): boolean {
    if (newRamMB <= this.state.ramMB) return false;
    const oldRam = this.state.ramMB;
    this.state.ramMB = newRamMB;

    this.eventBus.emit('hardware:upgraded', {
      component: 'RAM',
      oldValue: `${oldRam}MB`,
      newValue: `${newRamMB}MB`,
    });
    return true;
  }

  public upgradeConnection(newType: ConnectionType): boolean {
    const speedMap: Record<ConnectionType, number> = {
      dialup_56k: 56,
      dsl_256k: 256,
      dsl_512k: 512,
      dsl_1m: 1024,
    };
    const oldType = this.state.connectionType;
    this.state.connectionType = newType;
    this.state.connectionSpeedKbps = speedMap[newType];

    this.eventBus.emit('hardware:upgraded', {
      component: 'Internet',
      oldValue: oldType,
      newValue: newType,
    });
    return true;
  }

  public upgradeOs(targetOs: OsVersion): { success: boolean; error?: string } {
    // Delegates to OsCatalog for any version (4.8/5.0/6.0/7.0/patches), kept for backward compat
    if (this.state.osVersion === targetOs) {
      return { success: false, error: `Already running ${targetOs}.` };
    }
    try {
      const { getReleaseById } = require('./OsCatalog');
      const rel = getReleaseById(targetOs as any);
      if (rel) {
        if (this.state.ramMB < rel.requirements.minRamMB) {
          return { success: false, error: `${rel.displayName} setup failed: Requires at least ${rel.requirements.minRamMB} MB RAM. Please upgrade memory first.` };
        }
        if (this.state.hddFreeGB < rel.requirements.minDiskGB) {
          return { success: false, error: `${rel.displayName} setup failed: Requires at least ${rel.requirements.minDiskGB} GB free disk space.` };
        }
        const prevOs = this.state.osVersion;
        this.state.osVersion = targetOs;
        this.state.hddFreeGB = Math.max(0.5, Number((this.state.hddFreeGB - rel.installSizeGB).toFixed(2)));
        this.eventBus.emit('hardware:os_migrated', { from: prevOs, to: targetOs } as any);
        return { success: true };
      }
    } catch {}
    // Fallback to legacy 6.0 check
    if (targetOs === 'Orion_6.0') {
      if (this.state.ramMB < 768) return { success: false, error: 'Orion OS 6.0 setup failed: Requires at least 768 MB RAM. Please upgrade memory first.' };
      if (this.state.hddFreeGB < 2.0) return { success: false, error: 'Orion OS 6.0 setup failed: Requires at least 2.0 GB free disk space.' };
    }
    const prevOs = this.state.osVersion;
    this.state.osVersion = targetOs;
    this.state.hddFreeGB = Math.max(0.5, Number((this.state.hddFreeGB - 1.5).toFixed(2)));
    this.eventBus.emit('hardware:os_migrated', { from: prevOs, to: targetOs } as any);
    return { success: true };
  }

  public allocateDiskSpaceBytes(bytes: number): boolean {
    const gb = bytes / (1024 * 1024 * 1024);
    if (this.state.hddFreeGB < gb) return false;
    this.state.hddFreeGB = Number((this.state.hddFreeGB - gb).toFixed(3));
    return true;
  }

  public freeDiskSpaceBytes(bytes: number): void {
    const gb = bytes / (1024 * 1024 * 1024);
    this.state.hddFreeGB = Math.min(this.state.hddTotalGB, Number((this.state.hddFreeGB + gb).toFixed(3)));
  }

  public loadState(state: HardwareState): void {
    this.state = { ...state };
  }
}

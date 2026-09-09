// src/engine/PulseEngine.ts
// Mirrors OsEngine but for Pulse Messenger — version lineage, requirements, install realism.

import { EventBus } from './EventBus';
import { isMinOsSatisfied } from './OsCatalog';
import {
  getAllPulseReleases,
  getPulseReleaseById,
  getProceduralPulseReleases,
  restoreProceduralPulseReleases,
  registerProceduralPulseRelease,
  type PulseRelease,
} from './PulseCatalog';
import type { HardwareState, OsVersion } from './types';

export interface PulseEngineState {
  // Empty string is the persisted save-compatible representation of "not installed".
  currentPulseId: string;
  installedPatchIds: string[];
  lastUpdateAtMinute?: number;
  lastUpdateLog?: string[];
  pendingReboot?: boolean;
  proceduralCatalog?: PulseRelease[];
}

export class PulseEngine {
  private eventBus: EventBus;
  private currentPulseId: string | null;
  private installedPatchIds: Set<string> = new Set();
  private lastUpdateAtMinute?: number;
  private lastUpdateLog: string[] = [];
  private pendingReboot = false;

  constructor(eventBus: EventBus, initialState?: Partial<PulseEngineState>) {
    this.eventBus = eventBus;
    this.currentPulseId = initialState?.currentPulseId || 'pulse_5.2';
    if (initialState?.installedPatchIds) {
      for (const id of initialState.installedPatchIds) this.installedPatchIds.add(id);
    }
    this.lastUpdateAtMinute = initialState?.lastUpdateAtMinute;
    this.lastUpdateLog = initialState?.lastUpdateLog ?? [];
    this.pendingReboot = initialState?.pendingReboot ?? false;
    if (initialState?.proceduralCatalog) {
      try {
        restoreProceduralPulseReleases(initialState.proceduralCatalog as unknown as PulseRelease[]);
      } catch {}
    }
  }

  public getCurrentRelease(): PulseRelease {
    return getPulseReleaseById(this.currentPulseId ?? '') ?? getPulseReleaseById('pulse_5.2')!;
  }

  public getCurrentPulseId(): string | null {
    return this.currentPulseId;
  }

  public syncInstalledVersion(version: string | null): void {
    if (version === null) {
      this.currentPulseId = null;
      this.installedPatchIds.clear();
      return;
    }

    const release = getAllPulseReleases().find((candidate) => candidate.version === version);
    if (!release) {
      throw new Error(`Unknown installed Pulse version: ${version}`);
    }
    this.currentPulseId = release.id;
  }

  public getState(): PulseEngineState {
    let procedural: PulseRelease[] = [];
    try {
      procedural = getProceduralPulseReleases();
    } catch {
      procedural = [];
    }
    return {
      currentPulseId: this.currentPulseId ?? '',
      installedPatchIds: Array.from(this.installedPatchIds),
      lastUpdateAtMinute: this.lastUpdateAtMinute,
      lastUpdateLog: [...this.lastUpdateLog],
      pendingReboot: this.pendingReboot,
      proceduralCatalog: procedural,
    };
  }

  public loadState(state: Partial<PulseEngineState>): void {
    if (Object.prototype.hasOwnProperty.call(state, 'currentPulseId')) {
      this.currentPulseId = state.currentPulseId || null;
    }
    if (state.installedPatchIds) {
      this.installedPatchIds.clear();
      for (const id of state.installedPatchIds) this.installedPatchIds.add(id);
    }
    this.lastUpdateAtMinute = state.lastUpdateAtMinute;
    this.lastUpdateLog = state.lastUpdateLog ? [...state.lastUpdateLog] : [];
    this.pendingReboot = state.pendingReboot ?? false;
    if (state.proceduralCatalog) {
      try {
        restoreProceduralPulseReleases(state.proceduralCatalog as unknown as PulseRelease[]);
      } catch {}
    }
  }

  public canInstall(targetId: string, hw: HardwareState, currentOs: OsVersion, currentDay: number): { ok: boolean; reasons: string[]; release?: PulseRelease } {
    const target = getPulseReleaseById(targetId);
    if (!target) return { ok: false, reasons: [`Unknown Pulse release: ${targetId}`] };
    const reasons: string[] = [];
    if (target.releaseDay > currentDay) reasons.push(`Not yet released (Day ${target.releaseDay}, today Day ${currentDay}).`);
    if (target.id === this.currentPulseId) reasons.push(`Already on ${target.displayName}.`);
    if (target.requirements.minRamMB > hw.ramMB) reasons.push(`Requires ${target.requirements.minRamMB}MB RAM (have ${hw.ramMB}MB).`);
    if (target.requirements.minDiskMB > hw.hddFreeGB * 1024) reasons.push(`Requires ${target.requirements.minDiskMB}MB free (have ${(hw.hddFreeGB * 1024).toFixed(0)}MB).`);
    if (!isMinOsSatisfied(currentOs, target.requirements.minOs)) {
      reasons.push(`Requires ${target.requirements.minOs} or later (have ${currentOs}).`);
    }
    return { ok: reasons.length === 0, reasons, release: target };
  }

  public getAvailableReleases(currentDay: number, _hw: HardwareState, _currentOs: OsVersion): PulseRelease[] {
    return getAllPulseReleases()
      .filter((r) => r.releaseDay <= currentDay)
      .filter((r) => r.id !== this.currentPulseId)
      .filter((r) => !this.installedPatchIds.has(r.id));
  }

  public beginInstall(targetId: string, hw: HardwareState, currentOs: OsVersion, currentDay: number, currentMinute: number): { success: boolean; error?: string; release?: PulseRelease } {
    const check = this.canInstall(targetId, hw, currentOs, currentDay);
    if (!check.ok) return { success: false, error: check.reasons.join(' ') };
    const target = check.release!;
    this.lastUpdateLog = [];
    this.log(`Checking ${target.displayName}…`);
    this.log(`Copying ${target.installSizeMB}MB…`);
    const isPatch = target.kind === 'patch' || target.kind === 'hotfix';
    if (isPatch) {
      this.installedPatchIds.add(target.id);
      this.lastUpdateAtMinute = currentMinute;
      this.log(`Patch ${target.version} applied.`);
    } else {
      const prev = this.currentPulseId;
      this.currentPulseId = target.id;
      this.lastUpdateAtMinute = currentMinute;
      this.log(`Upgraded ${prev ?? 'not installed'} → ${target.id} (${target.version}).`);
    }
    this.eventBus.emit('software:installed' as any, { software: { appId: 'app.pulse', version: target.version } });
    return { success: true, release: target };
  }

  public registerProceduralRelease(release: PulseRelease): PulseRelease {
    const added = registerProceduralPulseRelease(release);
    this.eventBus.emit('world:global_event_triggered' as any, { event: { id: `pulse_${release.id}`, title: release.displayName, category: 'pulse_update' } });
    return added;
  }

  public syncFromWorldState(world: { triggeredEvents: Array<{ id: string; title: string; category: string; triggerDay: number }> }, _currentDay: number): void {
    for (const evt of world.triggeredEvents.filter((e) => (e.category as string) === 'pulse_update')) {
      if (getPulseReleaseById(evt.id)) continue;
    }
  }

  private log(msg: string): void {
    this.lastUpdateLog.push(msg);
    if (this.lastUpdateLog.length > 20) this.lastUpdateLog = this.lastUpdateLog.slice(-20);
  }

  public getInstallLog(): string[] {
    return [...this.lastUpdateLog];
  }
}

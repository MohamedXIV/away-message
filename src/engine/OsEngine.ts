// src/engine/OsEngine.ts
// Core OS simulation — the sole authority for installed Orion lineage and setup state.

import { EventBus } from './EventBus';
import {
  compareOsVersions,
  getAllReleases,
  getProceduralReleases,
  getReleaseById,
  isMinOsSatisfied,
  isOsAtLeast,
  registerProceduralRelease,
  restoreProceduralReleases,
  type OsRelease,
  type OsThemeId,
} from './OsCatalog';
import { pickOsTemplate, templateToRelease } from '../ai/osReleaseTemplates';
import type { HardwareState, OsVersion, SoftwareRequirement } from './types';

export type OsInstallPhase =
  | 'idle'
  | 'checking'
  | 'copying'
  | 'configuring'
  | 'rebooting'
  | 'finalizing'
  | 'rolling_back';

export type OsInstallResult = {
  success: boolean;
  error?: string;
  previousOs?: OsVersion | null;
  newOs?: OsVersion;
  rebootCount?: number;
};

export interface OsEngineState {
  currentOsId: OsVersion | null;
  installedPatchIds: OsVersion[];
  lastBootAtMinute?: number;
  lastInstallAtMinute?: number;
  lastInstallLog?: string[];
  pendingReboot?: boolean;
  proceduralCatalog?: OsRelease[];
}

function hasOwn<T extends object>(value: T | undefined, key: PropertyKey): boolean {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

export class OsEngine {
  private eventBus: EventBus;
  private currentOsId: OsVersion | null;
  private installedPatchIds: Set<OsVersion> = new Set();
  private lastBootAtMinute?: number;
  private lastInstallAtMinute?: number;
  private lastInstallLog: string[] = [];
  private pendingReboot = false;
  private installPhase: OsInstallPhase = 'idle';

  constructor(eventBus: EventBus, initialState?: Partial<OsEngineState>) {
    this.eventBus = eventBus;
    this.currentOsId = hasOwn(initialState, 'currentOsId')
      ? (initialState?.currentOsId ?? null)
      : null;

    for (const id of initialState?.installedPatchIds ?? []) {
      this.installedPatchIds.add(id as OsVersion);
    }
    this.lastBootAtMinute = initialState?.lastBootAtMinute;
    this.lastInstallAtMinute = initialState?.lastInstallAtMinute;
    this.lastInstallLog = initialState?.lastInstallLog ? [...initialState.lastInstallLog] : [];
    this.pendingReboot = initialState?.pendingReboot ?? false;

    if (initialState?.proceduralCatalog) {
      try {
        restoreProceduralReleases(initialState.proceduralCatalog);
      } catch {
        // A bad procedural cache must never fabricate or replace the installed OS.
      }
    }
  }

  public getCurrentRelease(): OsRelease | null {
    if (this.currentOsId === null) return null;
    return getReleaseById(this.currentOsId) ?? null;
  }

  public getCurrentOsId(): OsVersion | null {
    return this.currentOsId;
  }

  public getState(): OsEngineState {
    return {
      currentOsId: this.currentOsId,
      installedPatchIds: Array.from(this.installedPatchIds),
      lastBootAtMinute: this.lastBootAtMinute,
      lastInstallAtMinute: this.lastInstallAtMinute,
      lastInstallLog: [...this.lastInstallLog],
      pendingReboot: this.pendingReboot,
      proceduralCatalog: getProceduralReleases(),
    };
  }

  public loadState(state: Partial<OsEngineState>): void {
    if (hasOwn(state, 'currentOsId')) {
      this.currentOsId = state.currentOsId ?? null;
    }
    if (state.installedPatchIds) {
      this.installedPatchIds.clear();
      for (const id of state.installedPatchIds) this.installedPatchIds.add(id as OsVersion);
    }
    this.lastBootAtMinute = state.lastBootAtMinute;
    this.lastInstallAtMinute = state.lastInstallAtMinute;
    this.lastInstallLog = state.lastInstallLog ? [...state.lastInstallLog] : [];
    this.pendingReboot = state.pendingReboot ?? false;
    if (state.proceduralCatalog) {
      try {
        restoreProceduralReleases(state.proceduralCatalog);
      } catch {
        // Procedural release cache is best-effort; installed OS state remains authoritative.
      }
    }
  }

  public canInstall(
    targetId: OsVersion,
    hw: HardwareState,
    currentDay: number,
  ): { ok: boolean; reasons: string[]; release?: OsRelease } {
    const target = getReleaseById(targetId);
    if (!target) return { ok: false, reasons: [`Unknown OS release: ${targetId}`] };

    const reasons: string[] = [];
    const current = this.getCurrentRelease();

    if (target.releaseDay > currentDay) {
      reasons.push(`Not yet released (available Day ${target.releaseDay}, today Day ${currentDay}).`);
    }
    if (this.currentOsId !== null && target.id === this.currentOsId) {
      reasons.push(`Already running ${target.displayName}.`);
    }

    // Upgrade/downgrade lineage rules apply only when there is an installed OS.
    // Fresh-install media policy is intentionally deferred to #9.
    if (current && this.currentOsId !== null) {
      if (compareOsVersions(target.version || String(target.id), current.version || String(this.currentOsId)) < 0) {
        if (!target.id.includes('beta') || this.currentOsId !== 'Orion_7.0') {
          if (target.kind !== 'hotfix' || target.requirements.requiresOs !== this.currentOsId) {
            if (compareOsVersions(target.version, current.version) < 0 && target.family !== current.family) {
              reasons.push(`Downgrade from ${current.displayName} to ${target.displayName} not supported.`);
            }
          }
        }
      }

      if (target.requirements.requiresFamily && target.requirements.requiresFamily !== current.family) {
        if (!isOsAtLeast(this.currentOsId, 'Orion_5.0' as OsVersion) && target.family === '5.x') {
          // Existing 4.x -> 5.x upgrade path remains valid.
        } else if (target.family === '5.x' && current.family !== '4.x') {
          reasons.push(
            `Requires ${target.requirements.requiresFamily} base — cannot install ${target.displayName} over ${current.displayName}.`,
          );
        }
      }
    }

    if (hw.ramMB < target.requirements.minRamMB) {
      reasons.push(`Requires ${target.requirements.minRamMB}MB RAM (installed ${hw.ramMB}MB).`);
    }
    if (hw.cpuTier < target.requirements.minCpuTier) {
      reasons.push(`Requires CPU Tier ${target.requirements.minCpuTier} (installed ${hw.cpuTier}).`);
    }
    if (hw.hddFreeGB < target.requirements.minDiskGB) {
      reasons.push(`Requires ${target.requirements.minDiskGB}GB free (free ${hw.hddFreeGB.toFixed(1)}GB).`);
    }

    if (
      (target.kind === 'patch' || target.kind === 'hotfix') &&
      target.requirements.requiresOs &&
      target.requirements.requiresOs !== this.currentOsId &&
      !this.installedPatchIds.has(target.requirements.requiresOs)
    ) {
      reasons.push(`Requires ${target.requirements.requiresOs} first.`);
    }

    return { ok: reasons.length === 0, reasons, release: target };
  }

  public getAvailableReleases(currentDay: number, _hw: HardwareState): OsRelease[] {
    return getAllReleases()
      .filter((release) => release.releaseDay <= currentDay)
      .filter((release) => release.id !== this.currentOsId)
      .filter((release) => !this.installedPatchIds.has(release.id as OsVersion));
  }

  public getInstalledReleases(): OsRelease[] {
    const current = this.getCurrentRelease();
    const patches = Array.from(this.installedPatchIds)
      .map((id) => getReleaseById(id))
      .filter(Boolean) as OsRelease[];
    return current ? [current, ...patches] : [];
  }

  public getTheme(): OsThemeId | null {
    return this.getCurrentRelease()?.theme ?? null;
  }

  public getRamOverheadMB(): number {
    const current = this.getCurrentRelease();
    if (!current) return 0;

    let overhead = current.ramOverheadMB;
    for (const patchId of this.installedPatchIds) {
      const patch = getReleaseById(patchId);
      if (patch) overhead += Math.max(0, patch.ramOverheadMB - current.ramOverheadMB);
    }
    return overhead;
  }

  public getBootTimeSeconds(): number {
    const current = this.getCurrentRelease();
    if (!current) return 0;
    return current.bootTimeSeconds + (this.pendingReboot ? 6 : 0);
  }

  public beginInstall(
    targetId: OsVersion,
    hw: HardwareState,
    currentDay: number,
    currentMinute: number,
  ): OsInstallResult {
    const check = this.canInstall(targetId, hw, currentDay);
    if (!check.ok) return { success: false, error: check.reasons.join(' ') };
    const target = check.release!;

    this.installPhase = 'checking';
    this.lastInstallLog = [];
    this.log(`Checking ${target.displayName}…`);
    this.log(
      `Requirements: ${target.requirements.minRamMB}MB RAM, ${target.requirements.minDiskGB}GB disk — OK`,
    );
    this.log(`Copying ${target.installSizeGB}GB payload…`);

    this.installPhase = 'copying';
    const ramFactor = hw.ramMB < 768 ? 1.6 : hw.ramMB < 1024 ? 1.2 : 1.0;
    const minutes = Math.round((18 + target.installSizeGB * 12) * ramFactor);
    void minutes;

    this.installPhase = 'configuring';
    this.log(`Migrating drivers for ${target.family}…`);
    if (target.kind === 'beta') this.log('Beta watermark will appear on desktop.');
    if (target.kind === 'patch' || target.kind === 'hotfix') this.log('Patch — single reboot.');

    this.installPhase = 'rebooting';
    const reboots = target.kind === 'patch' || target.kind === 'hotfix' ? 1 : 2;
    for (let i = 1; i <= reboots; i += 1) {
      this.log(`Reboot ${i}/${reboots}… dark → Orion POST → progress bar`);
    }
    this.log('Finalizing — building icon cache, restoring wallpaper.');

    const previousOs = this.currentOsId;
    const isPatchOrHotfix = target.kind === 'patch' || target.kind === 'hotfix';
    if (isPatchOrHotfix) {
      this.installedPatchIds.add(target.id as OsVersion);
      this.lastInstallAtMinute = currentMinute;
    } else {
      this.currentOsId = target.id as OsVersion;
      this.lastInstallAtMinute = currentMinute;
      this.lastBootAtMinute = currentMinute;
    }

    this.pendingReboot = false;
    this.installPhase = 'idle';
    this.eventBus.emit('hardware:os_migrated', {
      from: previousOs,
      to: target.id as OsVersion,
    });
    return {
      success: true,
      previousOs,
      newOs: target.id as OsVersion,
      rebootCount: reboots,
    };
  }

  public checkCompatibility(req: SoftwareRequirement): { compatible: boolean; reasons: string[] } {
    if (this.currentOsId === null) {
      return { compatible: false, reasons: ['No operating system installed.'] };
    }

    const reasons: string[] = [];
    if (!isMinOsSatisfied(this.currentOsId, req.minOs)) {
      const current = this.getCurrentRelease();
      const required = getReleaseById(req.minOs);
      reasons.push(
        `Requires ${required ? required.displayName : req.minOs} or later (Current: ${current?.displayName ?? this.currentOsId}).`,
      );
    }
    return { compatible: reasons.length === 0, reasons };
  }

  public registerProceduralRelease(release: OsRelease): OsRelease {
    const added = registerProceduralRelease(release);
    this.eventBus.emit('world:global_event_triggered' as any, {
      event: { id: `os_${release.id}`, title: release.displayName, category: 'os_release' },
    });
    return added;
  }

  public syncFromWorldState(
    world: {
      triggeredEvents: Array<{
        id: string;
        title: string;
        description: string;
        category: string;
        triggerDay: number;
        siteUrl?: string;
      }>;
      pendingEvents?: unknown[];
    },
    _currentDay: number,
  ): void {
    try {
      const all = getAllReleases() as OsRelease[];
      for (const evt of world.triggeredEvents.filter((event) => event.category === 'os_release')) {
        const existsByName = all.some(
          (release) =>
            release.displayName.toLowerCase() === evt.title.toLowerCase() || release.id === evt.id,
        );
        if (existsByName) continue;

        let family: OsRelease['family'] = '7.x';
        if (evt.title.includes('5.')) family = '5.x';
        else if (evt.title.includes('6.')) family = '6.x';
        else if (evt.title.includes('7.')) family = '7.x';
        if (!evt.title.toLowerCase().includes('orion')) continue;

        const template = pickOsTemplate(`os-sync:${evt.id}`, family, evt.triggerDay);
        const release = templateToRelease(template, evt.triggerDay, evt.id);
        release.displayName = evt.title.slice(0, 60);
        release.version = template.version;
        if (getReleaseById(release.id as OsVersion)) continue;
        try {
          registerProceduralRelease(release);
        } catch {
          // Duplicate/racing procedural releases are harmless.
        }
      }

      const pending = (
        world as unknown as {
          pendingEvents?: Array<{ id: string; title: string; category: string; triggerDay: number }>;
        }
      ).pendingEvents;
      if (Array.isArray(pending)) {
        for (const evt of pending.filter((event) => event.category === 'os_release')) {
          if (all.some((release) => release.displayName.toLowerCase() === evt.title.toLowerCase())) continue;
          if (!evt.title.toLowerCase().includes('orion')) continue;

          let family: OsRelease['family'] = '7.x';
          if (evt.title.includes('5.')) family = '5.x';
          else if (evt.title.includes('6.')) family = '6.x';
          const template = pickOsTemplate(`os-pending:${evt.id}`, family, evt.triggerDay);
          const release = templateToRelease(template, evt.triggerDay, evt.id);
          release.displayName = evt.title.slice(0, 60);
          release.channel = 'beta';
          release.kind = 'beta';
          if (getReleaseById(release.id as OsVersion)) continue;
          try {
            registerProceduralRelease(release);
          } catch {
            // Duplicate/racing procedural releases are harmless.
          }
        }
      }
    } catch {
      // World-generated releases are additive and must never break the installed OS.
    }
  }

  private log(message: string): void {
    this.lastInstallLog.push(message);
    if (this.lastInstallLog.length > 40) this.lastInstallLog = this.lastInstallLog.slice(-40);
  }

  public getInstallLog(): string[] {
    return [...this.lastInstallLog];
  }

  public getInstallPhase(): OsInstallPhase {
    return this.installPhase;
  }
}

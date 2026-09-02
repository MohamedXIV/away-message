// src/engine/OsEngine.ts
// Core OS simulation — owns lineage, requirements, install realism, boot, and AI-generated releases.
// This is the authority; HardwareEngine delegates OS checks to here.

import { EventBus } from './EventBus';
import {
  getAllReleases,
  getReleaseById,
  getProceduralReleases,
  restoreProceduralReleases,
  isOsAtLeast,
  isMinOsSatisfied,
  compareOsVersions,
  STATIC_OS_CATALOG,
  registerProceduralRelease,
  type OsRelease,
  type OsThemeId,
} from './OsCatalog';
import { pickOsTemplate, templateToRelease } from '../ai/osReleaseTemplates';
import type { HardwareState, OsVersion, SoftwareRequirement } from './types';

export type OsInstallPhase = 'idle' | 'checking' | 'copying' | 'configuring' | 'rebooting' | 'finalizing' | 'rolling_back';
export type OsInstallResult = { success: boolean; error?: string; previousOs?: OsVersion; newOs?: OsVersion; rebootCount?: number };

export interface OsEngineState {
  currentOsId: OsVersion;
  installedPatchIds: OsVersion[];
  lastBootAtMinute?: number;
  lastInstallAtMinute?: number;
  lastInstallLog?: string[];
  pendingReboot?: boolean;
  proceduralCatalog?: OsRelease[];
}

export class OsEngine {
  private eventBus: EventBus;
  private currentOsId: OsVersion;
  private installedPatchIds: Set<OsVersion> = new Set();
  private lastBootAtMinute?: number;
  private lastInstallAtMinute?: number;
  private lastInstallLog: string[] = [];
  private pendingReboot = false;
  private installPhase: OsInstallPhase = 'idle';

  constructor(eventBus: EventBus, initialState?: Partial<OsEngineState & HardwareState>) {
    this.eventBus = eventBus;
    this.currentOsId = (initialState?.currentOsId as OsVersion) ?? (initialState?.osVersion as OsVersion) ?? ('Orion_4.8' as OsVersion);
    if ((initialState as OsEngineState)?.installedPatchIds) {
      for (const id of (initialState as OsEngineState).installedPatchIds!) this.installedPatchIds.add(id as OsVersion);
    }
    this.lastBootAtMinute = (initialState as OsEngineState)?.lastBootAtMinute;
    this.lastInstallAtMinute = (initialState as OsEngineState)?.lastInstallAtMinute;
    this.lastInstallLog = (initialState as OsEngineState)?.lastInstallLog ?? [];
    this.pendingReboot = (initialState as OsEngineState)?.pendingReboot ?? false;
  }

  public getCurrentRelease(): OsRelease {
    return getReleaseById(this.currentOsId) ?? STATIC_OS_CATALOG[0]!;
  }

  public getCurrentOsId(): OsVersion {
    return this.currentOsId;
  }

  public getState(): OsEngineState {
    return {
      currentOsId: this.currentOsId,
      installedPatchIds: Array.from(this.installedPatchIds) as OsVersion[],
      lastBootAtMinute: this.lastBootAtMinute,
      lastInstallAtMinute: this.lastInstallAtMinute,
      lastInstallLog: [...this.lastInstallLog],
      pendingReboot: this.pendingReboot,
      proceduralCatalog: getProceduralReleases(),
    };
  }

  public loadState(state: Partial<OsEngineState>): void {
    if (state.currentOsId) this.currentOsId = state.currentOsId as OsVersion;
    if (state.installedPatchIds) {
      this.installedPatchIds.clear();
      for (const id of state.installedPatchIds) this.installedPatchIds.add(id as OsVersion);
    }
    this.lastBootAtMinute = state.lastBootAtMinute;
    this.lastInstallAtMinute = state.lastInstallAtMinute;
    this.lastInstallLog = state.lastInstallLog ? [...state.lastInstallLog] : [];
    this.pendingReboot = state.pendingReboot ?? false;
    if ((state as OsEngineState).proceduralCatalog) {
      try {
        restoreProceduralReleases((state as OsEngineState).proceduralCatalog!);
      } catch {}
    }
  }

  // --- Version ordering helpers ---
  public canInstall(targetId: OsVersion, hw: HardwareState, currentDay: number): { ok: boolean; reasons: string[]; release?: OsRelease } {
    const target = getReleaseById(targetId);
    if (!target) return { ok: false, reasons: [`Unknown OS release: ${targetId}`] };
    const reasons: string[] = [];

    if (target.releaseDay > currentDay) reasons.push(`Not yet released (available Day ${target.releaseDay}, today Day ${currentDay}).`);
    if (target.id === this.currentOsId) reasons.push(`Already running ${target.displayName}.`);
    // Downgrade guard: must be newer than current
    if (compareOsVersions((target.version || target.id) as string, (this.getCurrentRelease().version || this.currentOsId) as string) < 0) {
      // Allow patches that are numerically higher but same family? compare already handles
      // If target is behind current, block
      if (!target.id.includes('beta') || this.currentOsId !== 'Orion_7.0') {
        // Simple: if target version < current version and not a hotfix for current, block
        if (target.kind !== 'hotfix' || target.requirements.requiresOs !== this.currentOsId) {
          // Don't hard-block hotfixes, but block true downgrades
          if (compareOsVersions(target.version, this.getCurrentRelease().version) < 0 && target.family !== this.getCurrentRelease().family) {
            // cross-family downgrade
            reasons.push(`Downgrade from ${this.getCurrentRelease().displayName} to ${target.displayName} not supported.`);
          }
        }
      }
    }
    if (hw.ramMB < target.requirements.minRamMB) reasons.push(`Requires ${target.requirements.minRamMB}MB RAM (installed ${hw.ramMB}MB).`);
    if (hw.cpuTier < target.requirements.minCpuTier) reasons.push(`Requires CPU Tier ${target.requirements.minCpuTier} (installed ${hw.cpuTier}).`);
    if (hw.hddFreeGB < target.requirements.minDiskGB) reasons.push(`Requires ${target.requirements.minDiskGB}GB free (free ${hw.hddFreeGB.toFixed(1)}GB).`);
    if (target.requirements.requiresOs && target.requirements.requiresOs !== this.currentOsId && !this.installedPatchIds.has(target.requirements.requiresOs) && target.requirements.requiresOs !== this.currentOsId) {
      // For patches that require specific base
      if (target.kind === 'patch' || target.kind === 'hotfix') {
        reasons.push(`Requires ${target.requirements.requiresOs} first.`);
      }
    }
    if (target.requirements.requiresFamily && target.requirements.requiresFamily !== this.getCurrentRelease().family) {
      // e.g., 5.0 requires 4.x base — if already on 6.x, this is a downgrade path
      if (!isOsAtLeast(this.currentOsId, 'Orion_5.0' as OsVersion) && target.family === '5.x') {
        // ok
      } else if (target.family === '5.x' && this.getCurrentRelease().family !== '4.x') {
        reasons.push(`Requires ${target.requirements.requiresFamily} base — cannot install ${target.displayName} over ${this.getCurrentRelease().displayName}.`);
      }
    }

    return { ok: reasons.length === 0, reasons, release: target };
  }

  public getAvailableReleases(currentDay: number, _hw: HardwareState): OsRelease[] {
    return getAllReleases()
      .filter((r) => r.releaseDay <= currentDay)
      .filter((r) => r.id !== this.currentOsId)
      .filter((r) => !this.installedPatchIds.has(r.id as OsVersion));
  }

  public getInstalledReleases(): OsRelease[] {
    const patches = Array.from(this.installedPatchIds).map((id) => getReleaseById(id as OsVersion)).filter(Boolean) as OsRelease[];
    return [this.getCurrentRelease(), ...patches];
  }

  public getTheme(): OsThemeId {
    return this.getCurrentRelease().theme;
  }

  public getRamOverheadMB(): number {
    // Base + patches add a little
    let overhead = this.getCurrentRelease().ramOverheadMB;
    for (const pid of this.installedPatchIds) {
      const p = getReleaseById(pid as OsVersion);
      if (p) overhead += Math.max(0, p.ramOverheadMB - this.getCurrentRelease().ramOverheadMB);
    }
    return overhead;
  }

  public getBootTimeSeconds(): number {
    let t = this.getCurrentRelease().bootTimeSeconds;
    if (this.pendingReboot) t += 6; // pending reboot adds hesitation
    return t;
  }

  // --- Realistic install simulation (multi-phase, time & disk, reboot) ---
  public beginInstall(targetId: OsVersion, hw: HardwareState, currentDay: number, currentMinute: number): OsInstallResult {
    const check = this.canInstall(targetId, hw, currentDay);
    if (!check.ok) return { success: false, error: check.reasons.join(' ') };
    const target = check.release!;

    this.installPhase = 'checking';
    this.lastInstallLog = [];
    this.log(`Checking ${target.displayName}…`);
    this.log(`Requirements: ${target.requirements.minRamMB}MB RAM, ${target.requirements.minDiskGB}GB disk — OK`);
    this.log(`Copying ${target.installSizeGB}GB payload…`);

    // Simulate disk cost is handled by caller (HardwareEngine.allocate), we just track
    this.installPhase = 'copying';
    // 30-90 minutes simulated install time based on size & RAM pressure
    const ramFactor = hw.ramMB < 768 ? 1.6 : hw.ramMB < 1024 ? 1.2 : 1.0;
    const minutes = Math.round((18 + target.installSizeGB * 12) * ramFactor);
    void minutes; // caller advances time via SimulationEngine

    this.installPhase = 'configuring';
    this.log(`Migrating drivers for ${target.family}…`);
    if (target.kind === 'beta') this.log('Beta watermark will appear on desktop.');
    if (target.kind === 'patch' || target.kind === 'hotfix') this.log('Patch — single reboot.');

    this.installPhase = 'rebooting';
    const reboots = target.kind === 'patch' || target.kind === 'hotfix' ? 1 : 2;
    for (let i = 1; i <= reboots; i++) this.log(`Reboot ${i}/${reboots}… dark → Orion POST → progress bar`);
    this.log('Finalizing — building icon cache, restoring wallpaper.');

    // Commit
    const previousOs = this.currentOsId;
    const isPatchOrHotfix = target.kind === 'patch' || target.kind === 'hotfix';
    if (isPatchOrHotfix) {
      this.installedPatchIds.add(target.id as OsVersion);
      this.lastInstallAtMinute = currentMinute;
      this.pendingReboot = false;
      this.installPhase = 'idle';
      this.eventBus.emit('hardware:os_migrated' as any, { from: previousOs, to: target.id, kind: target.kind });
      return { success: true, previousOs, newOs: target.id as OsVersion, rebootCount: reboots };
    } else {
      this.currentOsId = target.id as OsVersion;
      this.lastInstallAtMinute = currentMinute;
      this.lastBootAtMinute = currentMinute;
      this.pendingReboot = false;
      this.installPhase = 'idle';
      this.eventBus.emit('hardware:os_migrated' as any, { from: previousOs, to: target.id, kind: target.kind });
      return { success: true, previousOs, newOs: target.id as OsVersion, rebootCount: reboots };
    }
  }

  public checkCompatibility(req: SoftwareRequirement): { compatible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const current = this.currentOsId;
    if (!isMinOsSatisfied(current, req.minOs as OsVersion)) {
      const curRel = this.getCurrentRelease();
      const needRel = getReleaseById(req.minOs as OsVersion);
      reasons.push(`Requires ${needRel ? needRel.displayName : req.minOs} or later (Current: ${curRel.displayName}).`);
    }
    return { compatible: reasons.length === 0, reasons };
  }

  // For AI-generated procedural OS releases — governed
  public registerProceduralRelease(release: OsRelease): OsRelease {
    const added = registerProceduralRelease(release);
    this.eventBus.emit('world:global_event_triggered' as any, { event: { id: `os_${release.id}`, title: release.displayName, category: 'os_release' } });
    return added;
  }

  // Sync world os_release events → ensure an installable OsRelease exists (templated, governed)
  public syncFromWorldState(world: { triggeredEvents: Array<{ id: string; title: string; description: string; category: string; triggerDay: number; siteUrl?: string }>; pendingEvents?: unknown[] }, _currentDay: number): void {
    try {
      const all = getAllReleases() as OsRelease[];
      for (const evt of world.triggeredEvents.filter((e) => e.category === 'os_release')) {
        // If an OS with same displayName or id already exists, skip
        const existsByName = all.some((r) => r.displayName.toLowerCase() === evt.title.toLowerCase() || r.id === evt.id);
        if (existsByName) continue;
        // Infer family from title
        let family: OsRelease['family'] = '7.x';
        if (evt.title.includes('5.')) family = '5.x';
        else if (evt.title.includes('6.')) family = '6.x';
        else if (evt.title.includes('7.')) family = '7.x';
        else if (evt.title.toLowerCase().includes('5.')) family = '5.x';
        // Only create for plausible OS title containing "Orion"
        if (!evt.title.toLowerCase().includes('orion')) continue;
        // Pick template for that family
        const tmpl = pickOsTemplate(`os-sync:${evt.id}`, family, evt.triggerDay);
        const release = templateToRelease(tmpl, evt.triggerDay, evt.id);
        // Override with event's title to keep world ↔ OS in sync
        release.displayName = evt.title.slice(0, 60);
        release.version = tmpl.version; // keep template version for ordering
        // Avoid duplicate id
        if (getReleaseById(release.id as any)) continue;
        try { registerProceduralRelease(release); } catch {}
      }
      // Also handle pending os_release that are near future — pre-register so TechMart shows "coming soon"
      const pending = (world as unknown as { pendingEvents?: Array<{ id: string; title: string; category: string; triggerDay: number }> }).pendingEvents;
      if (Array.isArray(pending)) {
        for (const evt of pending.filter((e) => e.category === 'os_release')) {
          if (all.some((r) => r.displayName.toLowerCase() === evt.title.toLowerCase())) continue;
          if (!evt.title.toLowerCase().includes('orion')) continue;
          let family: OsRelease['family'] = '7.x';
          if (evt.title.includes('5.')) family = '5.x';
          else if (evt.title.includes('6.')) family = '6.x';
          const tmpl = pickOsTemplate(`os-pending:${evt.id}`, family, evt.triggerDay);
          const release = templateToRelease(tmpl, evt.triggerDay, evt.id);
          release.displayName = evt.title.slice(0, 60);
          release.channel = 'beta';
          release.kind = 'beta';
          if (getReleaseById(release.id as any)) continue;
          try { registerProceduralRelease(release); } catch {}
        }
      }
    } catch {}
  }

  private log(msg: string): void {
    this.lastInstallLog.push(msg);
    if (this.lastInstallLog.length > 40) this.lastInstallLog = this.lastInstallLog.slice(-40);
  }

  public getInstallLog(): string[] {
    return [...this.lastInstallLog];
  }

  public getInstallPhase(): OsInstallPhase {
    return this.installPhase;
  }
}

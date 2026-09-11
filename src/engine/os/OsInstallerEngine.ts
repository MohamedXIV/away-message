// src/engine/os/OsInstallerEngine.ts
// Retro OS installation wizard state machine, supporting upgrade and clean-format modes.

import { getReleaseById, type OsRelease } from '../OsCatalog';
import type { OsVersion, HardwareState } from '../types';
import type { ModularHardwareState } from '../hardware/types';

export type OsInstallPhase =
  | 'idle'
  | 'checking'
  | 'mode_select'
  | 'formatting'
  | 'copying'
  | 'configuring'
  | 'rebooting'
  | 'finished'
  | 'error';

export interface OsInstallState {
  phase: OsInstallPhase;
  targetOs: OsVersion | null;
  mode: 'upgrade' | 'clean';
  progressPercent: number;
  statusMessage: string;
  errorMessage: string | null;
  startedAtMinute: number;
  durationMinutes: number;
}

export function checkOsInstallEligibility(
  targetOs: OsVersion,
  hw: HardwareState,
  _modular?: ModularHardwareState
): { ok: boolean; reason?: string; release?: OsRelease } {
  const rel = getReleaseById(targetOs);
  if (!rel) {
    return { ok: false, reason: `Unknown OS release: ${targetOs}` };
  }

  // RAM requirement
  if (hw.ramMB < rel.requirements.minRamMB) {
    return {
      ok: false,
      reason: `Setup requires at least ${rel.requirements.minRamMB} MB of system memory. Detected: ${hw.ramMB} MB.`,
      release: rel,
    };
  }

  // Disk space requirement
  if (hw.hddFreeGB < rel.requirements.minDiskGB) {
    return {
      ok: false,
      reason: `Setup requires at least ${rel.requirements.minDiskGB} GB of free hard disk space. Available: ${hw.hddFreeGB} GB.`,
      release: rel,
    };
  }

  // CPU requirement
  if (hw.cpuTier < rel.requirements.minCpuTier) {
    return {
      ok: false,
      reason: `Setup requires a CPU Tier ${rel.requirements.minCpuTier} or higher.`,
      release: rel,
    };
  }

  return { ok: true, release: rel };
}

export function createInitialInstallState(): OsInstallState {
  return {
    phase: 'idle',
    targetOs: null,
    mode: 'upgrade',
    progressPercent: 0,
    statusMessage: '',
    errorMessage: null,
    startedAtMinute: 0,
    durationMinutes: 25,
  };
}

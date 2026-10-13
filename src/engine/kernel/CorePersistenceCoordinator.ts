import type { SimulationState } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import { projectCoreState } from './CoreStateProjection';
import type {
  FullSimulationSnapshot,
  SaveSlotRecord,
  NarrativeStateRecord,
} from '../../persistence/schema';

/**
 * Authoritative Core-level persistence coordinator.
 * Reads domain states once during export and restores Core authorities
 * in a deterministic, dependency-safe sequence on reload.
 */
export class CorePersistenceCoordinator {
  public exportSnapshot(
    owners: CoreDomainOwners,
    activeView: SimulationState['activeView'],
  ): SimulationState {
    const projected = projectCoreState(owners, activeView);
    return JSON.parse(JSON.stringify(projected)) as SimulationState;
  }

  public exportFullSnapshot(
    owners: CoreDomainOwners,
    activeView: SimulationState['activeView'],
    saveSlotId = 'slot_1',
    saveName?: string,
  ): FullSimulationSnapshot {
    const state = projectCoreState(owners, activeView);
    const now = Date.now();

    const saveSlot: SaveSlotRecord = {
      id: saveSlotId,
      name: saveName || `Day ${state.time.day} • ${state.time.timeOfDay}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      day: state.time.day,
      totalMinutes: state.time.totalMinutes,
      clockState: {
        day: state.time.day,
        hour: state.time.hour,
        minute: state.time.minute,
        totalMinutes: state.time.totalMinutes,
        timeOfDay: state.time.timeOfDay,
        isPaused: owners.clock.isPaused(),
      },
      playerState: {
        cash: state.player.cash,
        energy: state.player.energy,
        fatigue: state.player.fatigue,
        socialBattery: state.player.socialBattery ?? 100,
        rentDueDay: state.player.rentDueDay,
        rentAmount: state.player.rentAmount,
        rentPaid: state.player.rentPaid,
        consecutiveLateWarnings: 0,
      },
      hardwareState: {
        cpuTier: state.hardware.cpuTier,
        ramMB: state.hardware.ramMB,
        hddTotalGB: state.hardware.hddTotalGB,
        hddFreeGB: state.hardware.hddFreeGB,
        connectionType: state.hardware.connectionType,
        connectionSpeedKbps: state.hardware.connectionSpeedKbps,
        osVersion: state.os.currentOsId as any,
        theme: (owners.os.getTheme() as any) || 'orion_4_8',
        wallpaper: 'default',
      },
      narrativeFlags: { ...state.world.flags },
      meta: { os: state.os, worldEvents: state.world.triggeredEvents.length },
    };

    const worldState: NarrativeStateRecord[] = [
      { key: 'world_flags', value: state.world.flags, updatedAt: now },
      { key: 'world_appointments', value: state.world.appointments, updatedAt: now },
      { key: 'world_windowHistory', value: state.world.windowObservationHistory, updatedAt: now },
      { key: 'world_triggeredEvents', value: state.world.triggeredEvents, updatedAt: now },
      { key: 'world_buddyKnowledge', value: state.world.buddyKnowledge, updatedAt: now },
    ];

    const osState: NarrativeStateRecord[] = [
      { key: 'os_state', value: state.os, updatedAt: now },
      { key: 'os_pulse_state', value: state.pulse, updatedAt: now },
      { key: 'os_myplace_state', value: state.myplace, updatedAt: now },
    ];

    return {
      saveSlot,
      vfsFiles: Object.values(state.vfs.files).map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        parentPath: f.parentPath,
        kind: f.kind as any,
        sizeBytes: f.sizeBytes,
        content: f.content,
        appAssociation: f.appAssociation,
        metadata: f.metadata as any,
        createdAt: f.createdAtMinute,
        modifiedAt: f.modifiedAtMinute,
      })),
      downloads: state.downloads.map((d) => ({
        id: d.id,
        sourceId: d.sourceId,
        url: d.sourceUrl,
        fileName: d.fileName,
        destinationPath: `${d.targetDirectory}/${d.fileName}`,
        totalBytes: d.totalBytes,
        downloadedBytes: d.downloadedBytes,
        sourceMaxKbps: d.sourceMaxKbps,
        status: d.status as any,
        resumable: d.resumable,
        startedAt: d.startedAtMinute,
        completedAt: d.completedAtMinute,
      })),
      installedSoftware: state.installedSoftware.map((s) => ({
        appId: s.appId,
        version: s.version,
        installPath: s.installPath,
        occupiedSizeBytes: s.installedBytes,
        isPortable: s.isPortable,
        bundledComponents: [],
        registeredInAddRemove: !s.isPortable,
        desktopShortcut: s.shortcuts.length > 0,
        startMenuEntry: true,
        installedAt: s.installedAtMinute,
      })),
      messages: Object.entries(state.social.conversations).flatMap(([buddyId, msgs]) =>
        msgs.map((m) => ({
          id: m.id,
          buddyId,
          sender: m.senderId as any,
          text: m.text,
          timestamp: m.timestampMinute,
          day: m.day,
          isRead: m.isRead,
        })),
      ),
      relationships: Object.entries(state.social.relationships).map(([buddyId, r]) => ({
        buddyId,
        familiarity: r.familiarity,
        trust: r.trust,
        comfort: r.comfort,
        respect: r.respect,
        annoyance: r.annoyance,
        lastInteractionDay: state.time.day,
        unlockedNotes: [],
        flags: {},
      })),
      narrativeState: worldState,
      worldState,
      osState,
      telemetryLogs: state.telemetry.logs.map((l) => ({
        timestamp: l.timestampMinutes,
        gameDay: Math.floor(l.timestampMinutes / 1440) + 1,
        gameMinutes: l.timestampMinutes,
        eventType: `${l.category}:${l.action}`,
        payload: l.data ?? {},
      })),
      pulseState: undefined,
    };
  }

  public loadSnapshot(
    owners: CoreDomainOwners,
    snapshot: SimulationState,
  ): SimulationState['activeView'] {
    owners.clock.setTotalMinutes(snapshot.time.totalMinutes);
    owners.needs.loadState((snapshot as any).needs ?? snapshot.player);
    owners.economy.loadState(snapshot.player);
    owners.mood.loadState((snapshot as any).mood);
    owners.hardware.loadState(snapshot.hardware);

    // OsEngine — load from dedicated os field or fallback to hardware osVersion
    const osSrc = (snapshot as any).os ?? { currentOsId: (snapshot as any).hardware?.osVersion };
    if (osSrc) {
      try {
        owners.os.loadState(osSrc);
      } catch {}
      // Explicit write-boundary hardware sync
      const osId = owners.os.getCurrentOsId();
      (owners.hardware as any).state.osVersion = osId;
    }

    // PulseEngine
    const pulseSrc = (snapshot as any).pulse ?? { currentPulseId: 'pulse_5.2' };
    if (pulseSrc) {
      try {
        owners.pulse.loadState(pulseSrc);
      } catch {}
    }

    // MyPlaceEngine
    const myplaceSrc = (snapshot as any).myplace;
    if (myplaceSrc) {
      try {
        owners.myplace.loadState(myplaceSrc);
      } catch {}
    }

    // World state
    const worldSrc = (snapshot as any).world ?? (snapshot as any).narrative;
    if (worldSrc) {
      owners.world.loadState(worldSrc);
      // Re-sync procedural OS/MyPlace from world after load
      try {
        owners.os.syncFromWorldState(
          { triggeredEvents: worldSrc.triggeredEvents ?? [], pendingEvents: [] } as any,
          owners.clock.getTime().day,
        );
        owners.myplace.syncFromWorldState(
          { triggeredEvents: worldSrc.triggeredEvents ?? [] } as any,
          owners.clock.getTime().day,
          owners.clock.getTotalMinutes(),
        );
      } catch {}
    }

    owners.vfs.restoreState(snapshot.vfs);
    owners.downloads.restoreState({
      tasks: snapshot.downloads,
      maxConcurrentBrowser: 1,
      maxConcurrentFlashFetch: 4,
    });
    owners.social.restoreState(snapshot.social);
    owners.telemetry.loadState(snapshot.telemetry.stats, snapshot.telemetry.logs);

    // Final explicit hardware osVersion sync
    (owners.hardware as any).state.osVersion = owners.os.getCurrentOsId();

    return snapshot.activeView;
  }
}

import {
  SimulationState,
  SimulationAction,
  ActionResult,
  NarrativeState,
} from './types';
import { GameClock } from './GameClock';
import { EventBus } from './EventBus';
import { EconomyEngine } from './EconomyEngine';
import { HardwareEngine } from './HardwareEngine';
import { FileSystemEngine } from './FileSystemEngine';
import { DownloadManager } from './DownloadManager';
import { SoftwareRegistry } from './SoftwareRegistry';
import { SocialEngine } from './SocialEngine';
import { TelemetryEngine } from './TelemetryEngine';

export class SimulationEngine {
  public readonly clock: GameClock;
  public readonly events: EventBus;
  public readonly economy: EconomyEngine;
  public readonly hardware: HardwareEngine;
  public readonly vfs: FileSystemEngine;
  public readonly downloads: DownloadManager;
  public readonly software: SoftwareRegistry;
  public readonly social: SocialEngine;
  public readonly telemetry: TelemetryEngine;

  private activeView: 'pc' | 'room' | 'cafe' | 'work' = 'pc';
  private narrative: NarrativeState = {
    activeBeatId: null,
    completedBeats: [],
    flags: {},
    appointments: [],
    windowObservationHistory: [],
  };
  private subscribers: Set<(state: Readonly<SimulationState>) => void> = new Set();

  constructor(initialState?: Partial<SimulationState>) {
    this.events = new EventBus();
    this.clock = new GameClock({
      initialDay: initialState?.time?.day ?? 1,
      initialHour: initialState?.time?.hour ?? 8,
      initialMinute: initialState?.time?.minute ?? 0,
    });
    this.economy = new EconomyEngine(this.events, initialState?.player);
    this.hardware = new HardwareEngine(this.events, initialState?.hardware);
    this.vfs = new FileSystemEngine(this.events, initialState?.vfs);
    this.downloads = new DownloadManager(
      {
        eventBus: this.events,
        vfs: this.vfs,
        getConnectionSpeedKbps: () => this.hardware.getState().connectionSpeedKbps,
      },
      initialState?.downloads ? { tasks: initialState.downloads, maxConcurrentBrowser: 1, maxConcurrentFlashFetch: 4 } : undefined
    );
    this.software = new SoftwareRegistry(
      this.events,
      this.vfs,
      {
        getOsVersion: () => this.hardware.getState().osVersion,
        getRamMb: () => this.hardware.getState().ramMB,
        getCpuTier: () => this.hardware.getState().cpuTier,
      },
      initialState?.installedSoftware
    );
    this.social = new SocialEngine(this.events, initialState?.social);
    this.telemetry = new TelemetryEngine(
      this.events,
      initialState?.telemetry?.stats,
      initialState?.telemetry?.logs
    );

    if (initialState?.narrative) {
      this.narrative = { ...initialState.narrative };
    }
    this.activeView = initialState?.activeView ?? 'pc';

    this.registerInternalEventHandlers();
  }

  private registerInternalEventHandlers(): void {
    this.events.on('time:day_changed', ({ newDay }) => {
      this.economy.handleDayTransition(newDay);
    });

    this.events.on('economy:cash_changed', ({ newCash }) => {
      this.telemetry.updateCashBounds(newCash);
    });
  }

  public getState(): Readonly<SimulationState> {
    const vfsState = this.vfs.getState();
    const downloadState = this.downloads.getState();

    return {
      version: 1,
      time: this.clock.getTime(),
      player: this.economy.getState(),
      hardware: this.hardware.getState(),
      vfs: vfsState,
      downloads: downloadState.tasks,
      installedSoftware: this.software.getInstalledSoftware(),
      social: this.social.getState(),
      narrative: {
        activeBeatId: this.narrative.activeBeatId,
        completedBeats: [...this.narrative.completedBeats],
        flags: { ...this.narrative.flags },
        appointments: this.narrative.appointments.map(a => ({ ...a })),
        windowObservationHistory: [...this.narrative.windowObservationHistory],
      },
      telemetry: {
        stats: this.telemetry.getStats(),
        logs: [...this.telemetry.getLogs()],
      },
      activeView: this.activeView,
    };
  }

  public advanceRealTime(deltaRealSeconds: number): void {
    if (deltaRealSeconds <= 0 || this.clock.isPaused()) return;

    this.telemetry.recordPlayTime(deltaRealSeconds, this.activeView);
    const tickResult = this.clock.tickRealTime(deltaRealSeconds);

    if (tickResult.elapsedMinutes > 0) {
      const currentMinutes = this.clock.getTotalMinutes();
      this.downloads.advanceTime(tickResult.elapsedMinutes, currentMinutes);
      this.social.updatePresence(currentMinutes);

      this.events.emit('time:tick', {
        time: tickResult.time,
        deltaMinutes: tickResult.elapsedMinutes,
      });

      if (tickResult.dayChanged) {
        const prevDay = tickResult.time.day - 1;
        this.events.emit('time:day_changed', {
          newDay: tickResult.time.day,
          previousDay: prevDay,
          time: tickResult.time,
        });
      }

      this.notifySubscribers();
    }
  }

  public advanceGameMinutes(minutes: number, reason?: string): void {
    if (minutes <= 0) return;

    const jumpResult = this.clock.advanceMinutes(minutes);
    const currentMinutes = this.clock.getTotalMinutes();
    this.downloads.advanceTime(minutes, currentMinutes);
    this.social.updatePresence(currentMinutes);

    this.events.emit('time:jump', {
      jumpMinutes: minutes,
      time: jumpResult.newTime,
      reason,
    });

    if (jumpResult.dayChanged) {
      this.events.emit('time:day_changed', {
        newDay: jumpResult.newTime.day,
        previousDay: jumpResult.previousTime.day,
        time: jumpResult.newTime,
      });
    }

    this.notifySubscribers();
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    const currentMinutes = this.clock.getTotalMinutes();

    switch (action.type) {
      case 'TIME_ADVANCE_MINUTES': {
        this.advanceGameMinutes(action.minutes, action.reason);
        return { success: true };
      }

      case 'TIME_SET_PAUSED': {
        this.clock.setPaused(action.paused);
        this.notifySubscribers();
        return { success: true };
      }

      case 'VIEW_SWITCH': {
        this.activeView = action.view;
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_EARN_CASH': {
        this.economy.earnCash(action.amount, action.reason);
        this.telemetry.logEvent('economy', 'cash_earned', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_SPEND_CASH': {
        const ok = this.economy.spendCash(action.amount, action.reason);
        if (!ok) return { success: false, error: 'Insufficient funds.' };
        this.telemetry.logEvent('economy', 'cash_spent', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_WORK_SHIFT': {
        const shiftRes = this.economy.performWorkShift(action.durationMinutes, action.wage);
        if (!shiftRes.success) return { success: false, error: shiftRes.error };
        this.advanceGameMinutes(action.durationMinutes ?? 240, 'Work Shift');
        this.telemetry.logEvent('economy', 'shift_worked', currentMinutes, {
          wage: shiftRes.earnedWage,
          hours: shiftRes.hours,
        });
        return { success: true, data: shiftRes };
      }

      case 'PLAYER_PAY_RENT': {
        const rentRes = this.economy.payRent();
        if (!rentRes.success) return { success: false, error: rentRes.error };
        this.telemetry.logEvent('economy', 'rent_paid', currentMinutes, {
          day: this.clock.getTime().day,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_PAY_INTERNET': {
        const netRes = this.economy.payInternetBill();
        if (!netRes.success) return { success: false, error: netRes.error };
        this.telemetry.logEvent('economy', 'internet_bill_paid', currentMinutes);
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_REST_OR_SLEEP': {
        const wakeHour = action.wakeHour ?? 8;
        const jump = this.clock.jumpToNextMorning(wakeHour);
        const hoursSlept = jump.elapsedMinutes / 60;
        this.economy.restOrSleep(hoursSlept);
        const newTotalMinutes = this.clock.getTotalMinutes();
        this.downloads.advanceTime(jump.elapsedMinutes, newTotalMinutes);
        this.social.updatePresence(newTotalMinutes);

        if (jump.dayChanged) {
          this.events.emit('time:day_changed', {
            newDay: jump.newTime.day,
            previousDay: jump.previousTime.day,
            time: jump.newTime,
          });
        }

        this.telemetry.logEvent('room', 'sleep', currentMinutes, {
          hoursSlept,
          wakeDay: jump.newTime.day,
        });
        this.notifySubscribers();
        return { success: true, data: jump };
      }

      case 'PLAYER_INTERACT_ROOM': {
        const durations: Record<string, number> = {
          tea: 6,
          coffee: 5,
          meal: 15,
          shower: 12,
          window: 4,
        };
        const dur = durations[action.activity] ?? 10;
        this.advanceGameMinutes(dur, `Room interaction: ${action.activity}`);
        if (action.activity === 'tea' || action.activity === 'coffee') {
          this.economy.restoreEnergy(5);
        } else if (action.activity === 'meal') {
          this.economy.restoreEnergy(15);
        } else if (action.activity === 'window') {
          this.telemetry.recordWindowObservation();
        }
        this.telemetry.logEvent('room', `interact_${action.activity}`, currentMinutes);
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_RAM': {
        if (!this.economy.canAfford(action.cost)) {
          return { success: false, error: `Cannot afford RAM upgrade ($${action.cost.toFixed(2)}).` };
        }
        this.economy.spendCash(action.cost, 'RAM Upgrade');
        const upgraded = this.hardware.upgradeRam(action.ramMB);
        if (!upgraded) return { success: false, error: 'Failed to upgrade RAM.' };
        this.telemetry.logEvent('hardware', 'ram_upgraded', currentMinutes, {
          ramMB: action.ramMB,
          cost: action.cost,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_CONNECTION': {
        if (!this.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford Internet upgrade ($${action.cost.toFixed(2)}).`,
          };
        }
        this.economy.spendCash(action.cost, 'Internet Plan Upgrade');
        this.hardware.upgradeConnection(action.connectionType);
        this.telemetry.logEvent('hardware', 'connection_upgraded', currentMinutes, {
          connection: action.connectionType,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_OS': {
        if (!this.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford OS upgrade package ($${action.cost.toFixed(2)}).`,
          };
        }
        const osRes = this.hardware.upgradeOs(action.targetOs);
        if (!osRes.success) return { success: false, error: osRes.error };
        this.economy.spendCash(action.cost, `Operating System Upgrade (${action.targetOs})`);
        this.advanceGameMinutes(45, 'OS Upgrade Installation & Reboot');
        this.telemetry.logEvent('hardware', 'os_upgraded', currentMinutes, {
          targetOs: action.targetOs,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'DOWNLOAD_START': {
        try {
          const task = this.downloads.startDownload({
            sourceId: action.sourceId,
            sourceUrl: action.url,
            fileName: action.fileName,
            totalBytes: action.totalBytes,
            sourceMaxKbps: action.sourceMaxKbps,
            fileKind: action.fileKind,
            appAssociation: action.appAssociation,
            manager: action.manager,
            currentMinute: currentMinutes,
          });
          this.notifySubscribers();
          return { success: true, data: task };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'DOWNLOAD_PAUSE': {
        const ok = this.downloads.pauseDownload(action.taskId);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'DOWNLOAD_RESUME': {
        const ok = this.downloads.resumeDownload(action.taskId);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'DOWNLOAD_CANCEL': {
        const ok = this.downloads.cancelDownload(action.taskId);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'VFS_CREATE_FILE': {
        try {
          const file = this.vfs.createFile(action.file, currentMinutes);
          this.notifySubscribers();
          return { success: true, data: file };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_DELETE_FILE': {
        const ok = this.vfs.deletePermanently(action.path);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'VFS_MOVE_TRASH': {
        try {
          const trashed = this.vfs.moveToTrash(action.path, currentMinutes);
          this.notifySubscribers();
          return { success: true, data: trashed };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_RESTORE_TRASH': {
        try {
          const restored = this.vfs.restoreFromTrash(action.trashPath, currentMinutes);
          this.notifySubscribers();
          return { success: true, data: restored };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_EMPTY_TRASH': {
        const reclaimed = this.vfs.emptyTrash();
        this.notifySubscribers();
        return { success: true, data: { bytesReclaimed: reclaimed } };
      }

      case 'SOFTWARE_INSTALL': {
        try {
          const wizard = this.software.startInstallerWizard(action.softwareId);
          if (!wizard.compatibilityResult.isCompatible) {
            return {
              success: false,
              error: 'Software incompatible with current system specifications.',
            };
          }
          if (action.selectedOptions) {
            for (const [k, v] of Object.entries(action.selectedOptions)) {
              wizard.selectedOptions.acceptedBundledOffers[k] = v;
            }
          }
          const installed = this.software.completeInstallation(wizard.sessionId, currentMinutes);
          this.telemetry.logEvent('software', 'installed', currentMinutes, {
            softwareId: action.softwareId,
          });
          this.notifySubscribers();
          return { success: true, data: installed };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOFTWARE_UNINSTALL': {
        const ok = this.software.uninstallSoftware(action.installedId);
        this.telemetry.logEvent('software', 'uninstalled', currentMinutes, {
          installedId: action.installedId,
        });
        this.notifySubscribers();
        return { success: ok };
      }

      case 'SOCIAL_SEND_MESSAGE': {
        const msg = this.social.sendMessage(
          action.buddyId,
          'player',
          action.buddyId,
          action.text,
          currentMinutes,
          false,
          action.tags,
          (action as any).imageUrl,
          (action as any).imagePrompt,
          (action as any).imageCaption
        );
        this.notifySubscribers();
        return { success: true, data: msg };
      }

      case 'SOCIAL_RECEIVE_MESSAGE': {
        const msg = this.social.sendMessage(
          action.buddyId,
          action.buddyId,
          'player',
          action.text,
          action.timestampMinute ?? currentMinutes,
          action.deliveredAway ?? false,
          action.tags,
          (action as any).imageUrl,
          (action as any).imagePrompt,
          (action as any).imageCaption
        );
        this.notifySubscribers();
        return { success: true, data: msg };
      }

      case 'SOCIAL_APPLY_ACTION': {
        try {
          const rels = this.social.applySocialAction(action.buddyId, action.socialAction);
          this.notifySubscribers();
          return { success: true, data: rels };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'NARRATIVE_TRIGGER_BEAT': {
        this.narrative.activeBeatId = action.beatId;
        if (!this.narrative.completedBeats.includes(action.beatId)) {
          this.narrative.completedBeats.push(action.beatId);
        }
        this.events.emit('narrative:beat_triggered', { beatId: action.beatId });
        this.notifySubscribers();
        return { success: true };
      }

      case 'NARRATIVE_SET_FLAG': {
        this.narrative.flags[action.key] = action.value;
        this.notifySubscribers();
        return { success: true };
      }

      case 'NARRATIVE_SCHEDULE_APPOINTMENT': {
        const appt = {
          ...action.appointment,
          isCompleted: false,
          isMissed: false,
        };
        this.narrative.appointments.push(appt);
        this.notifySubscribers();
        return { success: true, data: appt };
      }

      default:
        return { success: false, error: `Unhandled action: ${(action as any).type}` };
    }
  }

  public subscribe(listener: (state: Readonly<SimulationState>) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getState());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    const currentState = this.getState();
    for (const listener of this.subscribers) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[SimulationEngine] Subscriber error:', err);
      }
    }
  }

  public exportSnapshot(): SimulationState {
    return JSON.parse(JSON.stringify(this.getState()));
  }

  public loadSnapshot(snapshot: SimulationState): void {
    this.clock.setTotalMinutes(snapshot.time.totalMinutes);
    this.economy.loadState(snapshot.player);
    this.hardware.loadState(snapshot.hardware);
    this.vfs.restoreState(snapshot.vfs);
    this.downloads.restoreState({
      tasks: snapshot.downloads,
      maxConcurrentBrowser: 1,
      maxConcurrentFlashFetch: 4,
    });
    this.social.restoreState(snapshot.social);
    this.telemetry.loadState(snapshot.telemetry.stats, snapshot.telemetry.logs);
    this.narrative = { ...snapshot.narrative };
    this.activeView = snapshot.activeView;
    this.notifySubscribers();
  }
}

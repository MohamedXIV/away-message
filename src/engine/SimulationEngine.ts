import {
  SimulationState,
  SimulationAction,
  ActionResult,
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
import { WorldEventsEngine } from './WorldEventsEngine';
import { OsEngine } from './OsEngine';

export class SimulationEngine {
  public readonly clock!: GameClock;
  public readonly events!: EventBus;
  public readonly economy!: EconomyEngine;
  public readonly hardware!: HardwareEngine;
  public readonly os!: OsEngine;
  public readonly vfs!: FileSystemEngine;
  public readonly downloads!: DownloadManager;
  public readonly software!: SoftwareRegistry;
  public readonly social!: SocialEngine;
  public readonly telemetry!: TelemetryEngine;
  public readonly world!: WorldEventsEngine;

  private activeView: 'pc' | 'room' | 'cafe' | 'work' = 'pc';
  private subscribers: Set<(state: Readonly<SimulationState>) => void> = new Set();
  private _procGenPending = false;
  private _procGenLastDay = 0;

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
    // World before OS so Os can sync from world
    const worldInitial = (initialState as any)?.world ?? (initialState as any)?.narrative;
    this.world = new WorldEventsEngine(this.events, worldInitial);
    // OsEngine is core — sync with hardware osVersion
    const osInitial = (initialState as any)?.os ?? { currentOsId: initialState?.hardware?.osVersion };
    this.os = new OsEngine(this.events, { currentOsId: osInitial.currentOsId ?? initialState?.hardware?.osVersion, ...(osInitial as object) });
    // Keep hardware.osVersion in sync with OsEngine (source of truth)
    (this.hardware as any).state.osVersion = this.os.getCurrentOsId();
    // Restore any procedural OS releases that were world-generated (for old saves)
    try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, this.clock.getTime().day); } catch {}
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
        getOsVersion: () => this.os.getCurrentOsId() as any,
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

    // Rehydrate world events that may have been due before load
    try {
      this.world.checkAndTriggerEvents(this.clock.getTotalMinutes(), this.clock.getTime().day);
      this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, this.clock.getTime().day);
    } catch {}
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
    const worldState = this.world.getState();
    const osState = this.os.getState();
    // Sync hardware osVersion to OsEngine truth
    const hwState = this.hardware.getState();
    if ((hwState as any).osVersion !== osState.currentOsId) {
      (this.hardware as any).state.osVersion = osState.currentOsId;
    }

    // Sandbox world state is canonical; narrative is deprecated alias (kept with buddyKnowledge for compat)
    const narrativeAlias = {
      activeBeatId: null as string | null,
      completedBeats: [] as string[],
      flags: { ...worldState.flags },
      appointments: worldState.appointments.map((a) => ({ ...a })),
      windowObservationHistory: [...worldState.windowObservationHistory],
      triggeredEvents: [...worldState.triggeredEvents],
      buddyKnowledge: { ...worldState.buddyKnowledge },
    };

    return {
      version: 1,
      time: this.clock.getTime(),
      player: this.economy.getState(),
      hardware: this.hardware.getState(),
      os: osState,
      vfs: vfsState,
      downloads: downloadState.tasks,
      installedSoftware: this.software.getInstalledSoftware(),
      social: this.social.getState(),
      world: worldState,
      narrative: narrativeAlias,
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
      this.world.checkAndTriggerEvents(currentMinutes, tickResult.time.day);
      try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, tickResult.time.day); } catch {}

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
        this.maybeScheduleProceduralGeneration();
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
    this.world.checkAndTriggerEvents(currentMinutes, jumpResult.newTime.day);
    try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, jumpResult.newTime.day); } catch {}

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
      this.maybeScheduleProceduralGeneration();
    }

    this.notifySubscribers();
  }

  // Governed procedural queue — keeps 2-3 future days filled. Throttled, non-blocking, template fallback if AI unavailable.
  private maybeScheduleProceduralGeneration(): void {
    const pending = this.world.getPendingEvents().length;
    if (pending >= 3) return;
    const currentDay = this.clock.getTime().day;
    if (this._procGenPending || this._procGenLastDay === currentDay) return;
    this._procGenPending = true;
    this._procGenLastDay = currentDay;
    const totalMinutes = this.clock.getTotalMinutes();
    // Fire-and-forget, never blocks simulation
    import('./ProceduralDirector')
      .then(({ ProceduralDirector }) => {
        const dir = new ProceduralDirector(this.world);
        return dir.generateNextBatch(currentDay, totalMinutes, { maxEvents: 2, useAI: true });
      })
      .catch(() => {})
      .finally(() => {
        this._procGenPending = false;
        // Notify so UI (CityWire) updates pending count
        try { this.notifySubscribers(); } catch {}
      });
  }

  public async generateProceduralEventsNow(options?: { maxEvents?: number; useAI?: boolean }): Promise<import('./types').GlobalEvent[]> {
    const currentDay = this.clock.getTime().day;
    const totalMinutes = this.clock.getTotalMinutes();
    const { ProceduralDirector } = await import('./ProceduralDirector');
    const dir = new ProceduralDirector(this.world);
    const res = await dir.generateNextBatch(currentDay, totalMinutes, {
      maxEvents: options?.maxEvents ?? 2,
      useAI: options?.useAI ?? true,
    });
    this.notifySubscribers();
    return res.events;
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
        this.world.checkAndTriggerEvents(newTotalMinutes, jump.newTime.day);

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
          this.world.addWindowObservation(`window_day${this.clock.getTime().day}_${this.clock.getTotalMinutes()}`);
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
        // Core OS engine handles all lineage, RAM/disk/stability, and multi-reboot realism
        const hwState = this.hardware.getState();
        const can = this.os.canInstall(action.targetOs as any, hwState as any, this.clock.getTime().day);
        if (!can.ok) return { success: false, error: can.reasons.join(' ') };
        const targetRel = can.release!;
        // Allocate disk upfront (heavy OS simulation)
        if (!this.hardware.allocateDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024)) {
          return { success: false, error: `Not enough disk for ${targetRel.displayName} (${targetRel.installSizeGB}GB required). Free some space.` };
        }
        this.economy.spendCash(action.cost, `OS Upgrade (${targetRel.displayName})`);
        const res = this.os.beginInstall(action.targetOs as any, hwState as any, this.clock.getTime().day, currentMinutes);
        if (!res.success) {
          // refund disk on failure
          this.hardware.freeDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024);
          return { success: false, error: res.error };
        }
        // Realistic time: copying + reboots + finalizing (OsEngine logs minutes in install, we simulate)
        const ramFactor = hwState.ramMB < 768 ? 1.6 : hwState.ramMB < 1024 ? 1.2 : 1.0;
        const installMinutes = Math.round((22 + targetRel.installSizeGB * 14) * ramFactor) + (res.rebootCount ?? 2) * 3;
        this.advanceGameMinutes(installMinutes, `OS Install: ${targetRel.displayName} + ${res.rebootCount ?? 2} reboots`);
        // Sync hardware osVersion truth
        (this.hardware as any).state.osVersion = this.os.getCurrentOsId();
        // OS overhead already modeled via OsEngine.getRamOverheadMB() — HardwareEngine.calculateRamPressure reads it via sync? Keep hardware ramOverhead minimal here
        this.telemetry.logEvent('hardware', 'os_upgraded', currentMinutes, {
          targetOs: action.targetOs,
          displayName: targetRel.displayName,
          installMinutes,
          reboots: res.rebootCount,
          log: this.os.getInstallLog().slice(-3).join(' | '),
        });
        this.notifySubscribers();
        return { success: true, data: { ...res, release: targetRel, installMinutes } };
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

      case 'WORLD_SET_FLAG': {
        this.world.setFlag(action.key, action.value);
        this.events.emit('world:flag_changed', { key: action.key, value: action.value });
        this.notifySubscribers();
        return { success: true };
      }

      case 'WORLD_TRIGGER_EVENT': {
        const evt = this.world.triggerEventById(action.eventId, currentMinutes);
        if (!evt) return { success: false, error: `Event not found or already triggered: ${action.eventId}` };
        this.notifySubscribers();
        return { success: true, data: evt };
      }

      case 'WORLD_ADD_OBSERVATION': {
        this.world.addWindowObservation(action.entry);
        this.notifySubscribers();
        return { success: true };
      }

      case 'WORLD_SCHEDULE_APPOINTMENT': {
        const appt = this.world.scheduleAppointment(action.appointment);
        this.events.emit('world:appointment_scheduled', { appointment: appt });
        this.notifySubscribers();
        return { success: true, data: appt };
      }

      // Deprecated narrative aliases — routed to world
      case 'NARRATIVE_TRIGGER_BEAT': {
        // No-op in sandbox: beats removed. Keep for compat, emit but don't store.
        this.events.emit('narrative:beat_triggered', { beatId: (action as any).beatId });
        this.notifySubscribers();
        return { success: true };
      }

      case 'NARRATIVE_SET_FLAG': {
        this.world.setFlag(action.key, action.value);
        this.events.emit('world:flag_changed', { key: action.key, value: action.value });
        this.notifySubscribers();
        return { success: true };
      }

      case 'NARRATIVE_SCHEDULE_APPOINTMENT': {
        const appt = this.world.scheduleAppointment(action.appointment);
        this.events.emit('world:appointment_scheduled', { appointment: appt });
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

  public exportFullSnapshot(saveSlotId = 'slot_1', saveName?: string): import('../persistence/schema').FullSimulationSnapshot {
    const state = this.getState();
    const now = Date.now();
    const saveSlot: import('../persistence/schema').SaveSlotRecord = {
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
        isPaused: this.clock.isPaused(),
      },
      playerState: {
        cash: state.player.cash,
        energy: state.player.energy,
        fatigue: state.player.fatigue,
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
        theme: (this.os.getTheme() as any) || 'orion_4_8',
        wallpaper: 'default',
      },
      narrativeFlags: { ...state.world.flags },
      meta: { os: state.os, worldEvents: state.world.triggeredEvents.length },
    };
    // Build worldState records from world
    const worldState: import('../persistence/schema').NarrativeStateRecord[] = [
      { key: 'world_flags', value: state.world.flags, updatedAt: now },
      { key: 'world_appointments', value: state.world.appointments, updatedAt: now },
      { key: 'world_windowHistory', value: state.world.windowObservationHistory, updatedAt: now },
      { key: 'world_triggeredEvents', value: state.world.triggeredEvents, updatedAt: now },
      { key: 'world_buddyKnowledge', value: state.world.buddyKnowledge, updatedAt: now },
    ];
    const osState: import('../persistence/schema').NarrativeStateRecord[] = [
      { key: 'os_state', value: state.os, updatedAt: now },
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

  public loadSnapshot(snapshot: SimulationState): void {
    this.clock.setTotalMinutes(snapshot.time.totalMinutes);
    this.economy.loadState(snapshot.player);
    this.hardware.loadState(snapshot.hardware);
    // OsEngine — load from dedicated os field or fallback to hardware osVersion
    const osSrc = (snapshot as any).os ?? { currentOsId: (snapshot as any).hardware?.osVersion };
    if (osSrc) {
      try { this.os.loadState(osSrc); } catch {}
      // Sync hardware
      const osId = this.os.getCurrentOsId();
      (this.hardware as any).state.osVersion = osId;
    }
    // Re-sync procedural OS from world after load (for saves that had world os_release events)
    try {
      const worldSrc = (snapshot as any).world ?? (snapshot as any).narrative;
      if (worldSrc) this.os.syncFromWorldState({ triggeredEvents: worldSrc.triggeredEvents ?? [], pendingEvents: [] } as any, this.clock.getTime().day);
    } catch {}
    this.vfs.restoreState(snapshot.vfs);
    this.downloads.restoreState({
      tasks: snapshot.downloads,
      maxConcurrentBrowser: 1,
      maxConcurrentFlashFetch: 4,
    });
    this.social.restoreState(snapshot.social);
    this.telemetry.loadState(snapshot.telemetry.stats, snapshot.telemetry.logs);
    const worldSrc = (snapshot as any).world ?? (snapshot as any).narrative;
    if (worldSrc) this.world.loadState(worldSrc);
    this.activeView = snapshot.activeView;
    this.notifySubscribers();
  }
}

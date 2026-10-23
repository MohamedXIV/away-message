import type { CoreDomainOwners } from './CoreDomainOwners';

/**
 * One clock / one domain graph. There is no independent time state here.
 *
 * The coordinator owns the ordering of authoritative minute-boundary work,
 * while domain owners keep their own truth and existing daily behavior stays
 * with the owning system. The old inherited executor is a temporary caller
 * on the unmerged #171 branch only.
 */
type MinuteOwners = Pick<
  CoreDomainOwners,
  | 'clock'
  | 'telemetry'
  | 'downloads'
  | 'needs'
  | 'social'
  | 'world'
  | 'environment'
  | 'os'
  | 'myplace'
  | 'events'
>;

export type TimeView = 'pc' | 'room' | 'cafe' | 'work' | 'city';
export type TimeAdvanceMode = 'realtime' | 'jump';

/**
 * Two deliberately different simulation policies:
 * - coarse: one aggregate domain boundary, required for long sleep/work/travel;
 * - minute: replay the exact normal minute boundary, explicitly capped so
 *   500-NPC worlds cannot accidentally process multi-day loops on one message.
 */
export type MinuteAdvanceGranularity = 'coarse' | 'minute';
export const MAX_MINUTE_ACCURATE_ADVANCE = 60;

export interface TimeAdvancementHooks {
  currentView(): TimeView;
  processDeliveries(): void;
  processJobReplies(): void;
  sweepBusyLeaveLines(atMinute: number): void;
  /**
   * The MyPlace authored-voice side effect still lives in Social coordination
   * until its domain cutover. Start async work; never await it in the tick.
   */
  scheduleDailyProfileUpdate(mode: TimeAdvanceMode, day: number, atMinute: number): void;
  /** Procedural generation and newcomer discovery are daily domain hooks. */
  processNewDay(day: number): void;
  /** The existing subscription contract stays until bounded #172 publication. */
  publishState(): void;
}

export class TimeAdvancement {
  constructor(
    private readonly owners: MinuteOwners,
    private readonly hooks: TimeAdvancementHooks,
  ) {}

  /**
   * Called only when the canonical clock moved by whole game minutes.
   * Never infer simulation time from rendering frame count.
   */
  private applyElapsedMinutes(elapsed: number, atMinute: number, day: number): void {
    const { downloads, needs, social, world, environment, os, myplace } = this.owners;
    downloads.advanceTime(elapsed, atMinute);
    needs.advanceTime(elapsed);
    this.hooks.processDeliveries();
    this.hooks.processJobReplies();
    social.updatePresence(atMinute);
    this.hooks.sweepBusyLeaveLines(atMinute);
    world.checkAndTriggerEvents(atMinute, day);
    environment.publishIfChanged({ atMinute });
    try {
      os.syncFromWorldState({
        triggeredEvents: world.getTriggeredEvents(),
        pendingEvents: world.getPendingEvents(),
      } as any, day);
    } catch {
      // Preserve the existing non-blocking procedural catalog recovery.
    }
    try {
      myplace.syncFromWorldState({
        triggeredEvents: world.getTriggeredEvents(),
      } as any, day, atMinute);
    } catch {
      // Preserve the existing non-blocking MyPlace recovery.
    }
  }

  advanceRealTime(deltaRealSeconds: number): void {
    const { clock, telemetry, events } = this.owners;
    if (deltaRealSeconds <= 0 || clock.isPaused()) return;

    telemetry.recordPlayTime(deltaRealSeconds, this.hooks.currentView());
    const tickResult = clock.tickRealTime(deltaRealSeconds);

    // #170 invariant: a render-frame callback cannot wake all NPCs until the
    // authoritative clock has advanced by at least one whole game minute.
    if (tickResult.elapsedMinutes <= 0) return;

    const atMinute = clock.getTotalMinutes();
    this.applyElapsedMinutes(tickResult.elapsedMinutes, atMinute, tickResult.time.day);

    if (tickResult.dayChanged) {
      this.hooks.scheduleDailyProfileUpdate('realtime', tickResult.time.day, atMinute);
    }

    events.emit('time:tick', {
      time: tickResult.time,
      deltaMinutes: tickResult.elapsedMinutes,
    });

    if (tickResult.dayChanged) {
      events.emit('time:day_changed', {
        newDay: tickResult.time.day,
        previousDay: tickResult.time.day - 1,
        time: tickResult.time,
      });
      this.hooks.processNewDay(tickResult.time.day);
    }

    this.hooks.publishState();
  }

  advanceGameMinutes(minutes: number, reason?: string): void {
    if (minutes <= 0) return;

    const { clock, events } = this.owners;
    const jumpResult = clock.advanceMinutes(minutes);
    const atMinute = clock.getTotalMinutes();
    this.applyElapsedMinutes(minutes, atMinute, jumpResult.newTime.day);

    if (jumpResult.dayChanged) {
      this.hooks.scheduleDailyProfileUpdate('jump', jumpResult.newTime.day, atMinute);
    }

    events.emit('time:jump', {
      jumpMinutes: minutes,
      time: jumpResult.newTime,
      reason,
    });

    if (jumpResult.dayChanged) {
      events.emit('time:day_changed', {
        newDay: jumpResult.newTime.day,
        previousDay: jumpResult.previousTime.day,
        time: jumpResult.newTime,
      });
      this.hooks.processNewDay(jumpResult.newTime.day);
    }

    this.hooks.publishState();
  }
}

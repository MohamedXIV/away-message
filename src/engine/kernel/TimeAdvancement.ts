import type { TimeJumpResult } from '../types';
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
  | 'mood'
  | 'os'
  | 'myplace'
  | 'events'
>;

export type TimeView = 'pc' | 'room' | 'cafe' | 'work' | 'city';
export type TimeAdvanceMode = 'realtime' | 'jump';

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
    const { downloads, needs, social, world, environment, mood, os, myplace } = this.owners;
    downloads.advanceTime(elapsed, atMinute);
    needs.advanceTime(elapsed);
    this.hooks.processDeliveries();
    this.hooks.processJobReplies();
    social.updatePresence(atMinute);
    this.hooks.sweepBusyLeaveLines(atMinute);
    world.checkAndTriggerEvents(atMinute, day);
    environment.publishIfChanged({ atMinute });
    try {
      mood.publishIfChanged();
    } catch {
      // Mood context is best-effort during fast jumps
    }
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

  applyTimeJump(
    jumpResult: TimeJumpResult,
    reason?: string,
    options?: { skipPublish?: boolean },
  ): void {
    if (jumpResult.elapsedMinutes <= 0) return;

    const { clock, events } = this.owners;
    const atMinute = clock.getTotalMinutes();
    this.applyElapsedMinutes(jumpResult.elapsedMinutes, atMinute, jumpResult.newTime.day);

    if (jumpResult.dayChanged) {
      this.hooks.scheduleDailyProfileUpdate('jump', jumpResult.newTime.day, atMinute);
    }

    events.emit('time:jump', {
      jumpMinutes: jumpResult.elapsedMinutes,
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

    if (!options?.skipPublish) {
      this.hooks.publishState();
    }
  }

  advanceGameMinutes(
    minutes: number,
    reason?: string,
    options?: { skipPublish?: boolean },
  ): void {
    if (minutes <= 0) return;
    const jumpResult = this.owners.clock.advanceMinutes(minutes);
    this.applyTimeJump(jumpResult, reason, options);
  }
}

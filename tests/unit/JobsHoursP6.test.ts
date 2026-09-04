import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { GIGS, jobRoll, replyDelayMinutes, decideApplication } from '../../src/engine/JobDirector';
import { isOptionOpen, openHoursLabel } from '../../src/world/data/roomInteractables';
import { isOutingOpen } from '../../src/engine/OutingDirector';
import { computeSleepPlan, sleepQualityNote } from '../../src/world/modals/SleepTransitionModal';

describe('P6 place hours (pure)', () => {
  it('opens/closes by hour with overnight wrap', () => {
    expect(isOptionOpen({ openHours: [11, 22] }, 12)).toBe(true);
    expect(isOptionOpen({ openHours: [11, 22] }, 22)).toBe(false);
    expect(isOptionOpen({ openHours: [11, 22] }, 3)).toBe(false);
    expect(isOptionOpen({}, 3)).toBe(true);
    expect(isOptionOpen({ openHours: [22, 2] }, 23)).toBe(true);
    expect(isOptionOpen({ openHours: [22, 2] }, 3)).toBe(false);
    expect(openHoursLabel([11, 22])).toBe('11:00–22:00');
    expect(isOutingOpen('diner_soup', 12)).toBe(true);
    expect(isOutingOpen('diner_soup', 23)).toBe(false);
    expect(isOutingOpen('canal_walk', 3)).toBe(true);
    expect(isOutingOpen('laundromat', 6)).toBe(false);
  });
});

describe('P6 sleep planner (pure)', () => {
  it('wake-at mode rolls to the next occurrence', () => {
    expect(computeSleepPlan(22, 0, 'wake_at', 8, 8)).toEqual({ hours: 10, outHour: 8, outMinute: 0, outDayOffset: 1 });
    expect(computeSleepPlan(6, 0, 'wake_at', 8, 8)).toEqual({ hours: 2, outHour: 8, outMinute: 0, outDayOffset: 0 });
  });

  it('duration mode converts to an exact alarm (capped 0.5–12h)', () => {
    expect(computeSleepPlan(22, 30, 'duration', 8, 2)).toEqual({ hours: 2, outHour: 0, outMinute: 30, outDayOffset: 1 });
    expect(computeSleepPlan(10, 0, 'duration', 8, 2)).toEqual({ hours: 2, outHour: 12, outMinute: 0, outDayOffset: 0 });
    expect(computeSleepPlan(10, 0, 'duration', 8, 99).hours).toBe(12);
  });

  it('warns about rough nights and naps', () => {
    expect(sleepQualityNote(3, 8)).toContain('rough');
    expect(sleepQualityNote(14, 2)).toContain('nap');
    expect(sleepQualityNote(23, 8)).toContain('Full');
  });
});

describe('P6 job board rules (pure)', () => {
  it('lists four gigs with contacts and odds', () => {
    expect(Object.keys(GIGS)).toEqual(['cart_helper', 'diner_dishwasher', 'flyer_run', 'night_stock']);
    expect(GIGS.cart_helper!.contactBuddyId).toBe('ryan');
    expect(GIGS.night_stock!.minEnergy).toBe(60);
  });

  it('replies in 4–10h, deterministically', () => {
    const delay = replyDelayMinutes('cart_helper', 1000);
    expect(delay).toBeGreaterThanOrEqual(240);
    expect(delay).toBeLessThanOrEqual(600);
    expect(replyDelayMinutes('cart_helper', 1000)).toBe(delay);
  });

  it('decides by relationship: vetoes, bonuses, clamps', () => {
    expect(decideApplication({ baseOdds: 90, contactStage: 'friend', contactGone: true, roll: 0 }).accepted).toBe(false);
    expect(decideApplication({ baseOdds: 90, contactStage: 'strained', contactGone: false, roll: 0 }).accepted).toBe(false);
    const boosted = decideApplication({ baseOdds: 80, contactStage: 'close', contactGone: false, roll: 90 });
    expect(boosted.odds).toBe(95); // 80+15 clamped
    expect(boosted.accepted).toBe(true); // 90 < 95
    expect(decideApplication({ baseOdds: 80, contactStage: 'close', contactGone: false, roll: 95 }).accepted).toBe(false);
    expect(jobRoll('x')).toBe(jobRoll('x'));
  });
});

describe('P6 job applications (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('rejects unknown gigs, double applications and exhaustion', () => {
    expect(sim.dispatchAction({ type: 'JOB_APPLY', gigId: 'moon' }).success).toBe(false);
    expect(sim.dispatchAction({ type: 'JOB_APPLY', gigId: 'cart_helper' }).success).toBe(true);
    expect(sim.dispatchAction({ type: 'JOB_APPLY', gigId: 'cart_helper' }).success).toBe(false);
    (sim.economy as any).state.energy = 10;
    expect(sim.dispatchAction({ type: 'JOB_APPLY', gigId: 'flyer_run' }).success).toBe(false);
  });

  it('replies after the delay with accept or reject (white-box branch)', () => {
    sim.dispatchAction({ type: 'JOB_APPLY', gigId: 'flyer_run' });
    const applied = sim.world.getFlag('jobapp_flyer_run') as number;
    expect(applied).toBeGreaterThan(0);
    // Not yet: reply needs 4-10h
    sim.advanceGameMinutes(60, 'one hour');
    expect(sim.social.getMessages('henderson').some((m) => m.tags?.includes('job'))).toBe(false);
    // Past the deterministic delay → exactly one reply
    const delay = replyDelayMinutes('flyer_run', applied);
    sim.advanceGameMinutes(delay, 'waiting for reply');
    const jobMsgs = sim.social.getMessages('henderson').filter((m) => m.tags?.includes('job'));
    expect(jobMsgs.length).toBe(1);
    const expected = decideApplication({
      baseOdds: GIGS.flyer_run!.baseOdds,
      contactStage: sim.social.getRelationshipStage('henderson'),
      contactGone: false,
      roll: jobRoll(`job:flyer_run:${applied}`),
    });
    if (expected.accepted) {
      expect(jobMsgs[0]!.tags).toContain('accepted');
      const appt = sim.world.getAppointments().find((a) => a.id.startsWith('gig_flyer_run_'))!;
      expect(appt).toBeDefined();
      expect(appt.wageOverride).toBe(20);
      expect(appt.status).toBe('confirmed');
    } else {
      expect(jobMsgs[0]!.tags).toContain('rejected');
    }
  });

  it('strained contacts always reject', () => {
    for (let i = 0; i < 8; i++) sim.social.applySocialAction('ryan', 'dismissive');
    sim.dispatchAction({ type: 'JOB_APPLY', gigId: 'cart_helper' });
    const applied = sim.world.getFlag('jobapp_cart_helper') as number;
    sim.advanceGameMinutes(replyDelayMinutes('cart_helper', applied) + 1, 'waiting');
    const msgs = sim.social.getMessages('ryan').filter((m) => m.tags?.includes('job'));
    expect(msgs.length).toBe(1);
    expect(msgs[0]!.tags).toContain('rejected');
  });

  it('closed outings fail honestly at night', () => {
    sim.advanceGameMinutes(15 * 60, 'to 23:00'); // 08:00 → 23:00
    const res = sim.dispatchAction({ type: 'PLAYER_CITY_OUTING', outingId: 'diner_soup' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('closed');
  });
});

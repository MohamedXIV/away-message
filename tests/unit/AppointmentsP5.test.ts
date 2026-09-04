import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  parseMeetupProposal,
  isMeetupCancelText,
  decideRsvp,
  decideNpcShow,
  appointmentRoll,
  locationLabel,
  LOCATION_SLOTS,
  pickCoopDetail,
  SHIFT_WAGE,
} from '../../src/engine/AppointmentDirector';

describe('P5 meetup parsing (pure rules)', () => {
  it('parses explicit proposals with day + location', () => {
    expect(parseMeetupProposal('lets meet at the cafe tomorrow?')).toEqual({ locationId: 'cafe', dayOffset: 1 });
    expect(parseMeetupProposal('coffee tonight?')).toEqual({ locationId: 'cafe', dayOffset: 0 });
    expect(parseMeetupProposal('work together tomorrow, my shift is brutal')).toEqual({ locationId: 'work', dayOffset: 1 });
    expect(parseMeetupProposal('see you at the motel lobby this weekend')).toEqual({ locationId: 'motel_lobby', dayOffset: 3 });
  });

  it('rejects vague, cancel-flavoured or oversized lines', () => {
    expect(parseMeetupProposal('we should hang out sometime')).toBeNull(); // no day word
    expect(parseMeetupProposal('that movie was great')).toBeNull();
    expect(parseMeetupProposal('lets meet tomorrow, actually i cant make it')).toBeNull(); // cancel wins
    expect(parseMeetupProposal('x'.repeat(201))).toBeNull();
  });

  it('detects cancellations', () => {
    expect(isMeetupCancelText("sorry, i can't make it tomorrow")).toBe(true);
    expect(isMeetupCancelText('rain check?')).toBe(true);
    expect(isMeetupCancelText('lets meet tomorrow!')).toBe(false);
  });

  it('decides RSVP and show by rules', () => {
    expect(decideRsvp({ stage: 'strained', mood: 'steady', roll: 99 })).toBe('no');
    expect(decideRsvp({ stage: 'friend', mood: 'warm', roll: 99 })).toBe('yes');
    expect(decideRsvp({ stage: 'close', mood: 'off', roll: 0 })).toBe('maybe');
    expect(decideNpcShow({ rsvp: 'no', stage: 'friend', mood: 'warm', roll: 99 })).toBe(false);
    expect(decideNpcShow({ rsvp: 'yes', stage: 'friend', mood: 'warm', roll: 99 })).toBe(true);
    expect(decideNpcShow({ rsvp: 'yes', stage: 'strained', mood: 'steady', roll: 0 })).toBe(false);
    expect(decideNpcShow({ rsvp: 'yes', stage: 'strained', mood: 'steady', roll: 99 })).toBe(true);
    expect(appointmentRoll('same')).toBe(appointmentRoll('same'));
    expect(locationLabel('cafe')).toBe('the cafe');
    expect(LOCATION_SLOTS.cafe.start).toBe(1080);
  });
});

describe('P5 live meetings (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('creates an appointment from chat with immediate RSVP for tomorrow plans', () => {
    const appt = sim.handleMeetupChat('maya', 'lets meet at the cafe tomorrow?', 1);
    expect(appt).not.toBeNull();
    expect(appt!.targetDay).toBe(2);
    expect(appt!.locationId).toBe('cafe');
    const stored = sim.world.getAppointments().find((a) => a.id === appt!.id)!;
    expect(stored.status).toBe('confirmed');
    expect(['yes', 'maybe']).toContain(stored.rsvp);
    const rsvpMsgs = sim.social.getMessages('maya').filter((m) => m.tags?.includes('rsvp'));
    expect(rsvpMsgs.length).toBe(1);
  });

  it('refuses double-booking and unknown buddies', () => {
    expect(sim.handleMeetupChat('maya', 'coffee tomorrow?', 1)).not.toBeNull();
    expect(sim.handleMeetupChat('maya', 'coffee tomorrow?', 1)).toBeNull(); // one open plan max
    expect(sim.handleMeetupChat('ghost', 'coffee tomorrow?', 1)).toBeNull();
  });

  it('cancels the open plan on cancel phrasing and remembers it', () => {
    sim.handleMeetupChat('ryan', 'tacos at the cafe tomorrow?', 1);
    const res = sim.handleMeetupChat('ryan', "sorry, i can't make it", 1);
    expect(res).toBeNull();
    const appts = sim.world.getAppointments().filter((a) => a.characterId === 'ryan');
    expect(appts[appts.length - 1]!.status).toBe('cancelled');
    expect(sim.social.getCoreMemories('ryan').some((m) => m.text.includes('Cancelled'))).toBe(true);
  });

  it('resolves happened when both show (cafe visit tracked)', () => {
    const before = sim.social.getRelationships('maya')!;
    sim.handleMeetupChat('maya', 'lets meet at the cafe tomorrow?', 1);
    // Day 2: player walks to the cafe, then the day rolls over
    sim.advanceGameMinutes(24 * 60, 'sleep'); // into day 2 morning (8:00 + 24h? lands day 2 08:00)
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'cafe' });
    sim.advanceGameMinutes(24 * 60, 'sleep into day 3');
    const appt = sim.world.getAppointments().find((a) => a.characterId === 'maya')!;
    const npcShowed = appt.npcShowed === true;
    if (npcShowed) {
      expect(appt.status).toBe('happened');
      expect(appt.isCompleted).toBe(true);
      expect(sim.social.getCoreMemories('maya').some((m) => m.kind === 'shared_moment')).toBe(true);
      expect(sim.social.getRelationships('maya')!.trust).toBeGreaterThanOrEqual(before.trust);
    } else {
      // NPC flaked by rules — apology path also resolves the meeting as missed
      expect(appt.status).toBe('missed');
      expect(sim.social.getMessages('maya').some((m) => m.tags?.includes('apology'))).toBe(true);
    }
  });

  it('marks missed + salty when the player stands the NPC up', () => {
    const appt = sim.handleMeetupChat('ryan', 'work together tomorrow?', 1)!;
    // Never visit work, roll into day 3
    sim.advanceGameMinutes(2 * 24 * 60, 'two days pass');
    const stored = sim.world.getAppointments().find((a) => a.id === appt.id)!;
    expect(['happened', 'missed']).toContain(stored.status);
    if (stored.npcShowed && !stored.playerShowed) {
      expect(stored.isMissed).toBe(true);
      expect(sim.social.getMessages('ryan').some((m) => m.tags?.includes('missed'))).toBe(true);
      expect(sim.social.getCoreMemories('ryan').some((m) => m.text.includes('Stood up'))).toBe(true);
    }
  });

  it('tracks cafe/work visits as same-day attendance flags', () => {
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'cafe' });
    expect(sim.world.getFlag('visited_cafe_1')).toBe(true);
    expect(sim.world.getFlag('visited_work_1')).not.toBe(true);
  });
});

describe('P5.2 joint work (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('parses archive proposals', () => {
    expect(parseMeetupProposal('help me sort the logs tomorrow night?')).toEqual({ locationId: 'archive', dayOffset: 1 });
    expect(parseMeetupProposal('help index the archive tonight')).toEqual({ locationId: 'archive', dayOffset: 0 });
    expect(LOCATION_SLOTS.archive.start).toBe(1320);
    expect(locationLabel('archive')).toBe('the archive room');
  });

  it('picks deterministic co-op details per appointment', () => {
    expect(pickCoopDetail('appt_x', 'shift')).toBe(pickCoopDetail('appt_x', 'shift'));
    expect(typeof pickCoopDetail('appt_x', 'archive')).toBe('string');
  });

  it('a completed side shift pays wages, doubles dims and leaves a detailed memory', () => {
    const relBefore = sim.social.getRelationships('ryan')!;
    sim.handleMeetupChat('ryan', 'work together tomorrow?', 1);
    sim.advanceGameMinutes(24 * 60, 'sleep into day 2');
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'work' });
    const cashBeforeResolve = sim.getState().player.cash;
    sim.advanceGameMinutes(24 * 60, 'sleep into day 3');
    const appt = sim.world.getAppointments().find((a) => a.characterId === 'ryan')!;
    if (appt.npcShowed && appt.playerShowed) {
      expect(appt.status).toBe('happened');
      // Day-3 transition: $10 sundry + $4 forced chips (starving from travel) + shift wage
      expect(sim.getState().player.cash).toBe(cashBeforeResolve - 10 - 4 + SHIFT_WAGE);
      const relAfter = sim.social.getRelationships('ryan')!;
      expect(relAfter.familiarity).toBeGreaterThan(relBefore.familiarity + 4); // double camaraderie
      const mem = sim.social.getCoreMemories('ryan').find((m) => m.kind === 'shared_moment' && m.text.includes('side shift'))!;
      expect(mem).toBeDefined();
      expect(sim.social.getMessages('ryan').some((m) => m.tags?.includes('shift'))).toBe(true);
    } else {
      // NPC flaked by rules — still a resolved meeting, just not the co-op path
      expect(appt.status).toBe('missed');
    }
  });

  it('an archive night needs real effort: 2+ DMs that day', () => {
    sim.handleMeetupChat('nora', 'help me sort the logs tomorrow?', 1);
    sim.advanceGameMinutes(24 * 60, 'sleep into day 2');
    // One DM is not enough for archive attendance
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'nora', text: 'ready when you are' });
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'nora', text: 'starting with the 1987 box' });
    sim.advanceGameMinutes(24 * 60, 'sleep into day 3');
    const appt = sim.world.getAppointments().find((a) => a.characterId === 'nora')!;
    expect(appt.playerShowed).toBe(true);
    if (appt.npcShowed) {
      expect(appt.status).toBe('happened');
      expect(sim.social.getMessages('nora').some((m) => m.tags?.includes('archive'))).toBe(true);
      expect(sim.social.getCoreMemories('nora').some((m) => m.text.includes('archive'))).toBe(true);
    }
  });

  it('a single DM does not count as archive attendance', () => {
    sim.handleMeetupChat('nora', 'help index the archive tomorrow?', 1);
    sim.advanceGameMinutes(24 * 60, 'sleep into day 2');
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'nora', text: 'hey' });
    sim.advanceGameMinutes(24 * 60, 'sleep into day 3');
    const appt = sim.world.getAppointments().find((a) => a.characterId === 'nora')!;
    expect(appt.playerShowed).toBe(false);
  });
});

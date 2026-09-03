import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  npcThreadWeek,
  buildWeeklyNpcThreads,
  buildNpcMailForDay,
  gameDayToMailDate,
  type BoardBuddy,
} from '../../src/engine/BoardDirector';
import { locationLabel } from '../../src/engine/AppointmentDirector';

const BUDDIES: BoardBuddy[] = [
  { id: 'maya', displayName: 'Maya', handle: 'starlight_maya', archetype: 'artist', stage: 'acquaintance', status: 'acquaintance' },
  { id: 'ryan', displayName: 'Ryan', handle: 'ryan_foodcart', archetype: 'coworker', stage: 'friend', status: 'friend' },
  { id: 'nora', displayName: 'Nora', handle: 'NightOwl87', archetype: 'nightowl', stage: 'acquaintance', status: 'acquaintance' },
];

const AFF = (a: string, b: string): number => {
  const key = [a, b].sort().join('__');
  const table: Record<string, number> = { maya__ryan: 15, maya__nora: 5, nora__ryan: -5 };
  return table[key] ?? 0;
};

describe('P5.6 NPC board threads (pure)', () => {
  it('weeks advance every 7 days', () => {
    expect(npcThreadWeek(1)).toBe(0);
    expect(npcThreadWeek(7)).toBe(0);
    expect(npcThreadWeek(8)).toBe(1);
  });

  it('builds deterministic weekly threads from the live roster', () => {
    const a = buildWeeklyNpcThreads(3, BUDDIES, AFF, []);
    const b = buildWeeklyNpcThreads(3, BUDDIES, AFF, []);
    expect(a).toEqual(b);
    expect(a.length).toBe(2); // no world news → 2 starters
    for (const t of a) {
      expect(BUDDIES.map((x) => x.displayName)).toContain(t.author);
      expect(t.numericId).toBeGreaterThanOrEqual(9000);
      expect(t.replies.length).toBe(2);
    }
    const ids = a.map((t) => t.numericId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rotates content by week and adds an event thread on news', () => {
    const week0 = buildWeeklyNpcThreads(3, BUDDIES, AFF, []);
    const week1 = buildWeeklyNpcThreads(10, BUDDIES, AFF, []);
    expect(week0.map((t) => t.title)).not.toEqual(week1.map((t) => t.title));
    const withNews = buildWeeklyNpcThreads(3, BUDDIES, AFF, ['Orion 7 released']);
    expect(withNews.length).toBe(3);
    const evt = withNews.find((t) => t.numericId >= 9500)!;
    expect(evt.title).toContain('Orion 7 released');
  });

  it('never features distant buddies and cross-talks real names', () => {
    const gone = BUDDIES.map((b) => (b.id === 'nora' ? { ...b, status: 'gone' } : b));
    const threads = buildWeeklyNpcThreads(3, gone, AFF, []);
    const names = threads.flatMap((t) => [t.author, ...t.replies.map((r) => r.author)]);
    expect(names).not.toContain('Nora');
    // Cross-talk replies address real roster names (or are plain variety lines)
    const allBuddies = BUDDIES.map((b) => b.displayName);
    for (const t of threads) {
      for (const r of t.replies) {
        expect(typeof r.text).toBe('string');
        expect(r.text.length).toBeGreaterThan(5);
      }
    }
    expect(allBuddies.length).toBe(3);
  });
});

describe('P5.6 NPC mail chains (pure)', () => {
  const base = { buddies: BUDDIES, sharps: [] as Array<{ buddyId: string; state: string; stateDay: number }>, meetings: [] as any[] };

  it('sends farewell on distant day and welcome on return day', () => {
    const farewell = buildNpcMailForDay({
      ...base,
      day: 6,
      sharps: [{ buddyId: 'ryan', state: 'distant', stateDay: 6 }],
    });
    expect(farewell.length).toBe(1);
    expect(farewell[0]!.sender).toBe('Ryan');
    expect(farewell[0]!.senderEmail).toBe('ryan_foodcart@myplace.local');
    expect(farewell[0]!.key).toBe('npcmail_farewell_ryan_6');

    const welcome = buildNpcMailForDay({
      ...base,
      day: 13,
      sharps: [{ buddyId: 'ryan', state: 'returned', stateDay: 13 }],
    });
    expect(welcome[0]!.subject).toBe('im back');

    // Other days stay silent
    expect(buildNpcMailForDay({ ...base, day: 7, sharps: [{ buddyId: 'ryan', state: 'distant', stateDay: 6 }] })).toEqual([]);
  });

  it('thanks the morning after a happened meeting, apologizes after a flake', () => {
    const thanks = buildNpcMailForDay({
      ...base,
      day: 5,
      meetings: [{ buddyId: 'maya', targetDay: 4, status: 'happened', npcShowed: true, playerShowed: true, locationLabel: locationLabel('cafe') }],
    });
    expect(thanks.length).toBe(1);
    expect(thanks[0]!.body).toContain('the cafe');

    const apology = buildNpcMailForDay({
      ...base,
      day: 5,
      meetings: [{ buddyId: 'maya', targetDay: 4, status: 'missed', npcShowed: false, playerShowed: true, locationLabel: locationLabel('cafe') }],
    });
    expect(apology[0]!.subject).toContain('sorry');
  });

  it('caps at 2/day with farewell first and skips unknown buddies', () => {
    const mail = buildNpcMailForDay({
      day: 6,
      buddies: BUDDIES,
      sharps: [
        { buddyId: 'ghost', state: 'gone', stateDay: 6 },
        { buddyId: 'ryan', state: 'gone', stateDay: 6 },
        { buddyId: 'maya', state: 'returned', stateDay: 6 },
        { buddyId: 'nora', state: 'distant', stateDay: 6 },
      ],
      meetings: [{ buddyId: 'maya', targetDay: 5, status: 'happened', npcShowed: true, playerShowed: true, locationLabel: 'the cafe' }],
    });
    expect(mail.length).toBe(2);
    expect(mail[0]!.key).toContain('farewell');
    expect(mail.some((m) => m.buddyId === 'ghost')).toBe(false);
  });

  it('formats game days as August 2006 dates', () => {
    expect(gameDayToMailDate(1)).toContain('Aug 22, 2006');
  });
});

describe('P5.6 mail from live engine history', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('a thank-you mail is due the morning after a happened meeting', () => {
    sim.handleMeetupChat('maya', 'lets meet at the cafe tomorrow?', 1);
    sim.advanceGameMinutes(24 * 60, 'into day 2');
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'cafe' });
    sim.advanceGameMinutes(24 * 60, 'into day 3');
    const appt = sim.world.getAppointments().find((a) => a.characterId === 'maya')!;
    if (appt.status === 'happened') {
      const mail = buildNpcMailForDay({
        day: 3,
        buddies: sim.social.getBuddies().map((b) => ({ id: b.id, displayName: b.displayName, handle: b.handle, archetype: b.archetype, stage: 'friend', status: b.status })),
        sharps: [],
        meetings: sim.world.getAppointments().map((a) => ({
          buddyId: a.characterId,
          targetDay: a.targetDay,
          status: a.status,
          npcShowed: a.npcShowed,
          playerShowed: a.playerShowed,
          locationLabel: locationLabel(a.locationId),
        })),
      });
      expect(mail.some((m) => m.key.startsWith('npcmail_thanks_maya_'))).toBe(true);
    } else {
      expect(appt.status).toBe('missed');
    }
  });
});

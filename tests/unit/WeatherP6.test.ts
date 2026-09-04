import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  getWeatherForDay,
  getForecast,
  gameDayName,
  gameDayLabel,
  isWetWeather,
  isSevereWeather,
  shiftWageBonus,
  weatherLineForDay,
} from '../../src/engine/WeatherEngine';
import { buildWeeklyWeatherThread } from '../../src/engine/BoardDirector';
import { decideNpcShow, appointmentRoll, SHIFT_WAGE } from '../../src/engine/AppointmentDirector';
import type { BoardBuddy } from '../../src/engine/BoardDirector';

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

describe('P6.2 deterministic weather', () => {
  it('runs a stable 14-day cycle with storms every 15th day', () => {
    expect(getWeatherForDay(1).condition).toBe('overcast');
    expect(getWeatherForDay(2).condition).toBe('rain');
    expect(getWeatherForDay(6).condition).toBe('fog');
    expect(getWeatherForDay(10).condition).toBe('heat');
    expect(getWeatherForDay(15).condition).toBe('storm');
    expect(getWeatherForDay(30).condition).toBe('storm');
    expect(getWeatherForDay(2)).toEqual(getWeatherForDay(2));
    expect(getForecast(1, 3).map((w) => w.day)).toEqual([1, 2, 3]);
  });

  it('matches the August 2006 calendar (day 1 = Tue Aug 22)', () => {
    expect(gameDayName(1)).toBe('Tue');
    expect(gameDayLabel(1)).toContain('Aug 22, 2006');
  });

  it('classifies helpers for gameplay rules', () => {
    expect(isWetWeather('rain')).toBe(true);
    expect(isWetWeather('clear')).toBe(false);
    expect(isSevereWeather('fog')).toBe(true);
    expect(isSevereWeather('storm')).toBe(true);
    expect(isSevereWeather('rain')).toBe(false);
    expect(shiftWageBonus('heat')).toBe(6);
    expect(shiftWageBonus('rain')).toBe(0);
    expect(weatherLineForDay(2)).toContain('Weather today:');
  });
});

describe('P6.2 Maya loves the rain', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('wet days never leave Maya at off (one-step lift), strained stays cold', () => {
    for (let day = 1; day <= 60; day++) {
      const cond = getWeatherForDay(day).condition;
      const mood = sim.social.getDailyMood('maya', day);
      if (isWetWeather(cond)) expect(mood).not.toBe('off');
    }
    for (let i = 0; i < 8; i++) sim.social.applySocialAction('maya', 'dismissive');
    expect(sim.social.getDailyMood('maya', 2)).toBe('cold'); // day 2 is rain — strained wins
  });
});

describe('P6.2 fog excuses and heat bonuses (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('severe weather excuses an absence: missed, no hard feelings', () => {
    // Day 6 is fog: schedule on day 5 for day 6, never visit
    const appt = sim.handleMeetupChat('maya', 'lets meet at the cafe tomorrow?', 5)!;
    expect(appt.targetDay).toBe(6);
    sim.advanceGameMinutes(6 * 24 * 60, 'six days pass');
    const stored = sim.world.getAppointments().find((a) => a.id === appt.id)!;
    const expectedShow = decideNpcShow({
      rsvp: stored.rsvp,
      stage: 'acquaintance',
      mood: sim.social.getDailyMood('maya', 6),
      roll: appointmentRoll(`${appt.id}:show`),
    });
    if (expectedShow) {
      expect(stored.status).toBe('missed');
      expect(stored.isMissed).toBe(true);
      expect(sim.social.getRelationships('maya')!.annoyance).toBe(0); // excused: no dismissive
      expect(sim.social.getCoreMemories('maya').some((m) => m.text.includes('Severe weather'))).toBe(true);
      expect(sim.social.getMessages('maya').some((m) => m.tags?.includes('missed'))).toBe(false); // no salty line
    } else {
      expect(stored.status).toBe('missed'); // NPC flaked instead — apology path
    }
  });

  it('heat-wave shifts pay the bonus wage', () => {
    // Day 10 is heat: schedule on day 9 for day 10
    const appt = sim.handleMeetupChat('ryan', 'work together tomorrow?', 9)!;
    expect(appt.targetDay).toBe(10);
    sim.advanceGameMinutes(9 * 24 * 60, 'nine days pass');
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'work' });
    const cashBeforeResolve = sim.getState().player.cash;
    sim.advanceGameMinutes(24 * 60, 'into day 11');
    const stored = sim.world.getAppointments().find((a) => a.id === appt.id)!;
    if (stored.npcShowed && stored.playerShowed) {
      expect(stored.status).toBe('happened');
      // Day-11 transition: $10 sundry + $4 chips, then wage 24 + 6 heat bonus
      expect(sim.getState().player.cash).toBe(cashBeforeResolve - 10 - 4 + (SHIFT_WAGE + 6));
    } else {
      expect(stored.status).toBe('missed');
    }
  });
});

describe('P6.2 weekly weather thread', () => {
  it('leads with the week’s most dramatic day, authored by its lover', () => {
    const t = buildWeeklyWeatherThread(3, BUDDIES, getWeatherForDay, gameDayName, AFF)!;
    expect(t.numericId).toBe(9600);
    expect(t.author).toBe('Maya'); // week 0 peaks at rain — her weather
    expect(t.body).toContain('Tue');
    const storm = buildWeeklyWeatherThread(15, BUDDIES, getWeatherForDay, gameDayName, AFF)!;
    expect(storm.title).toContain('STORM');
    expect(storm.numericId).toBe(9602);
    // Deterministic
    expect(buildWeeklyWeatherThread(3, BUDDIES, getWeatherForDay, gameDayName, AFF)).toEqual(t);
  });
});

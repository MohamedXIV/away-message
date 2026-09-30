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
import { seedCharacterWithRole } from '../../src/engine/seedCharacters';

const BUDDIES: BoardBuddy[] = [
  { id: 'artist_friend', displayName: 'Aria', handle: 'aria_mix', archetype: 'artist', stage: 'acquaintance', status: 'acquaintance' },
  { id: 'coworker_friend', displayName: 'Cal', handle: 'cal_cart', archetype: 'coworker', stage: 'friend', status: 'friend' },
  { id: 'night_friend', displayName: 'Nox', handle: 'nox_logs', archetype: 'nightowl', stage: 'acquaintance', status: 'acquaintance' },
];

const AFF = (a: string, b: string): number => {
  const key = [a, b].sort().join('__');
  const table: Record<string, number> = {
    artist_friend__coworker_friend: 15,
    artist_friend__night_friend: 5,
    coworker_friend__night_friend: -5,
  };
  return table[key] ?? 0;
};

describe('P6.2 deterministic weather', () => {
  it('runs a stable repeating weather pattern with governed storm intervals', () => {
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

describe('P6.2 rain-sensitive character role', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('wet days lift a rain-lover role without overriding strained relationships', () => {
    const rainLoverId = seedCharacterWithRole('rain-lover')?.id;
    expect(rainLoverId).toBeTruthy();
    if (!rainLoverId) return;

    for (let day = 1; day <= 60; day++) {
      const cond = getWeatherForDay(day).condition;
      const mood = sim.social.getDailyMood(rainLoverId, day);
      if (isWetWeather(cond)) expect(mood).not.toBe('off');
    }
    for (let i = 0; i < 8; i++) sim.social.applySocialAction(rainLoverId, 'dismissive');
    expect(sim.social.getDailyMood(rainLoverId, 2)).toBe('cold');
  });
});

describe('P6.2 fog excuses and heat bonuses (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('severe weather excuses an absence: missed, no hard feelings', () => {
    // Day 6 is fog: schedule on day 5 for day 6, never visit
    const rainLoverId = seedCharacterWithRole('rain-lover')?.id;
    expect(rainLoverId).toBeTruthy();
    if (!rainLoverId) return;
    const appt = sim.handleMeetupChat(rainLoverId, 'lets meet at the cafe tomorrow?', 5)!;
    expect(appt.targetDay).toBe(6);
    sim.advanceGameMinutes(6 * 24 * 60, 'six days pass');
    const stored = sim.world.getAppointments().find((a) => a.id === appt.id)!;
    const expectedShow = decideNpcShow({
      rsvp: stored.rsvp,
      stage: 'acquaintance',
      mood: sim.social.getDailyMood(rainLoverId, 6),
      roll: appointmentRoll(`${appt.id}:show`),
    });
    if (expectedShow) {
      expect(stored.status).toBe('missed');
      expect(stored.isMissed).toBe(true);
      expect(sim.social.getRelationships(rainLoverId)!.annoyance).toBe(0); // excused: no dismissive
      expect(sim.social.getCoreMemories(rainLoverId).some((m) => m.text.includes('Severe weather'))).toBe(true);
      expect(sim.social.getMessages(rainLoverId).some((m) => m.tags?.includes('missed'))).toBe(false); // no salty line
    } else {
      expect(stored.status).toBe('missed'); // NPC flaked instead — apology path
    }
  });

  it('heat-wave shifts pay the bonus wage', () => {
    // Day 10 is heat: schedule on day 9 for day 10
    const cartOwnerId = seedCharacterWithRole('cart-owner')?.id;
    expect(cartOwnerId).toBeTruthy();
    if (!cartOwnerId) return;
    const appt = sim.handleMeetupChat(cartOwnerId, 'work together tomorrow?', 9)!;
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
    expect(t.author).toBe('Aria'); // artist fixture wins this deterministic weather thread
    expect(t.body).toContain('Tue');
    const storm = buildWeeklyWeatherThread(15, BUDDIES, getWeatherForDay, gameDayName, AFF)!;
    expect(storm.title).toContain('STORM');
    expect(storm.numericId).toBe(9602);
    // Deterministic
    expect(buildWeeklyWeatherThread(3, BUDDIES, getWeatherForDay, gameDayName, AFF)).toEqual(t);
  });
});

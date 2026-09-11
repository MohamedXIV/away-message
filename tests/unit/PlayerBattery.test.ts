// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildCharacter } from '../../src/engine/CharacterEngine';

function send(engine: SimulationEngine, buddyId: string, text: string) {
  return engine.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId, text });
}

/** A genuine stranger (low familiarity → 'stranger' stage). */
function addStranger(engine: SimulationEngine): string {
  const { definition } = buildCharacter({
    id: 'shy_poet', displayName: 'Wren', handle: 'shy_poet', archetype: 'nightowl',
    initialRelationships: { familiarity: 0, trust: 5, comfort: 5, respect: 10, annoyance: 0 },
    status: 'stranger', metVia: 'nightboard', createdDay: 1,
  });
  engine.social.registerBuddy(definition);
  return definition.id;
}

describe('Social battery meter', () => {
  it('starts full and spends 1 per everyday DM', () => {
    const engine = new SimulationEngine();
    expect(engine.economy.getSocialBattery()).toBe(100);
    const res = send(engine, 'maya', 'hey, how was your day');
    expect(res.success).toBe(true);
    expect(engine.economy.getSocialBattery()).toBe(99);
  });

  it('blocks sends at zero (full block) with inner voice, storing nothing', () => {
    const engine = new SimulationEngine();
    const stranger = addStranger(engine);
    // Flirty at stranger stage: offlimits → drain to zero + apology owed
    const bold = send(engine, stranger, 'you looked really cute today');
    expect(bold.success).toBe(true); // the line lands…
    expect(engine.economy.getSocialBattery()).toBe(0); // …then wipes the meter
    const before = engine.social.getMessages('maya').length;
    const blocked = send(engine, 'maya', 'hey, are you there?');
    expect(blocked.success).toBe(false);
    expect(String(blocked.error)).toMatch(/tomorrow|nothing left|empty|have to/i);
    expect(engine.social.getMessages('maya')).toHaveLength(before);
  });

  it('demands an apology from the burned buddy, then heals +15', () => {
    const engine = new SimulationEngine();
    const stranger = addStranger(engine);
    send(engine, stranger, 'you looked really cute today');
    expect(engine.economy.getSocialBattery()).toBe(0);
    // Anything but an apology is refused by that buddy…
    const notSorry = send(engine, stranger, 'hello?');
    expect(notSorry.success).toBe(false);
    expect(String(notSorry.error)).toMatch(/sorry|apolog/i);
    // …an apology passes free and repays +15
    const sorry = send(engine, stranger, 'sorry, that came out wrong');
    expect(sorry.success).toBe(true);
    expect(engine.economy.getSocialBattery()).toBe(15);
    // And normal talk resumes (cost 1)
    expect(send(engine, stranger, 'how are you').success).toBe(true);
    expect(engine.economy.getSocialBattery()).toBe(14);
  });

  it('recharges with sleep and quiet days (capped at 100)', () => {
    const engine = new SimulationEngine();
    for (let i = 0; i < 20; i++) send(engine, 'maya', `note ${i}`);
    expect(engine.economy.getSocialBattery()).toBe(80);
    engine.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
    expect(engine.economy.getSocialBattery()).toBe(100); // 80 + 30, capped
    // Quiet day: no player lines on day 2 → +10 on the day-3 pass (stays capped)
    engine.advanceGameMinutes(1440, 'day 2');
    engine.advanceGameMinutes(1440, 'day 3');
    expect(engine.economy.getSocialBattery()).toBe(100);
  });

  it('blocks outings when the meter cannot cover them', () => {
    const engine = new SimulationEngine();
    expect(engine.dispatchAction({ type: 'TRAVEL_TO', to: 'canal', mode: 'walk' }).success).toBe(true);
    const stranger = addStranger(engine);
    send(engine, stranger, 'you looked really cute today'); // drain to 0
    const outing = engine.dispatchAction({ type: 'PLAYER_CITY_OUTING', outingId: 'canal_walk' });
    expect(outing.success).toBe(false);
    expect(String(outing.error)).toMatch(/going out|have to/i);
  });

  it('blocks new appointments at zero but honors existing ones', () => {
    const engine = new SimulationEngine();
    expect(engine.handleMeetupChat('maya', 'lets meet at the cafe tomorrow', 1)).not.toBeNull();
    expect(engine.economy.getSocialBattery()).toBe(95); // 100 − 5 planning cost
    const stranger = addStranger(engine);
    send(engine, stranger, 'you looked really cute today'); // drain to 0
    expect(engine.handleMeetupChat('nora', 'lets meet at the cafe tomorrow', 1)).toBeNull();
  });

  it('stores the reception hint for the NPC reply (rules-studied, AI paraphrases)', () => {
    const engine = new SimulationEngine();
    const stranger = addStranger(engine);
    send(engine, stranger, 'you looked really cute today');
    expect(engine.getReceptionHint(stranger, 1)).toContain('distant');
    expect(engine.getReceptionHint('maya', 1)).toBe('');
  });
});

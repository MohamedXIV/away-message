import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { MyPlaceEngine } from '../../src/engine/MyPlaceEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  pickGuestbookLine,
  pickGuestbookReplyLine,
  pickTop8NewsLine,
} from '../../src/engine/characterTemplates';
import { appointmentRoll } from '../../src/engine/AppointmentDirector';

function countAllGuestbook(sim: SimulationEngine): number {
  let total = 0;
  for (const key of ['maya_x', 'tacocart_ryan', 'nightowl87']) {
    total += sim.myplace.getGuestbook(key).length;
  }
  return total;
}

describe('P5.4 Top 8 engine (MyPlaceEngine)', () => {
  it('validates and caps Top 8 rewrites', () => {
    const engine = new MyPlaceEngine(new EventBus());
    expect(engine.setNpcTop8('ghost', [])).toBe(false);
    const many = Array.from({ length: 12 }, (_, i) => ({ handle: `u${i}`, name: `U${i}`, avatar: '📷' }));
    expect(engine.setNpcTop8('maya_x', many)).toBe(true);
    expect(engine.getNpcProfile('maya_x')!.top8.length).toBe(8);
    expect(engine.setNpcTop8('maya_x', [{ handle: '  ', name: '', avatar: '' } as any, { handle: 'ok', name: 'Ok', avatar: '' }])).toBe(true);
    expect(engine.getNpcProfile('maya_x')!.top8.map((t) => t.handle)).toEqual(['ok']);
  });

  it('fills template placeholders deterministically', () => {
    const line = pickGuestbookLine('s1', 'Maya');
    expect(line).toBe(pickGuestbookLine('s1', 'Maya'));
    expect(line).toContain('Maya');
    expect(line).not.toContain('{name}');
    expect(pickGuestbookReplyLine('s1')).toBe(pickGuestbookReplyLine('s1'));
    const news = pickTop8NewsLine('s1', 'Maya', 2);
    expect(news).toContain('Maya');
    expect(news).toContain('#2');
  });
});

describe('P5.4 live Top 8 (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('re-ranks Top 8 from live affinities on periodic days', () => {
    // Day 4 (4 % 3 === 1) triggers the refresh
    sim.advanceGameMinutes(3 * 24 * 60, 'three days pass');
    const top8 = sim.myplace.getNpcProfile('maya_x')!.top8;
    expect(top8.length).toBeGreaterThanOrEqual(2);
    // Ryan leads: affinity 15 + friend bonus 20 = 35, the highest seed score
    expect(top8[0]!.name).toBe('Ryan');
    expect(sim.world.getFlag('top3_maya_x')).toContain('ryan');
  });

  it('celebrates Top 3 entries (positive-only, once per day)', () => {
    sim.advanceGameMinutes(3 * 24 * 60, 'three days pass');
    const news = sim.social.getMessages('ryan').filter((m) => m.tags?.includes('top8'));
    // Ryan enters Maya's top 3 from a blank slate, is friend-stage → exactly one celebration
    expect(news.length).toBe(1);
    expect(news[0]!.text).toContain('#1');
  });
});

describe('P5.4 guestbook life (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('adds NPC-to-NPC notes on day change', () => {
    const before = countAllGuestbook(sim);
    sim.advanceGameMinutes(24 * 60, 'one day passes');
    expect(countAllGuestbook(sim)).toBe(before + 2);
  });

  it('owners reply to yesterday player notes when the roll allows', () => {
    // Player signs Maya's book on day 3; roll into day 4 and check the deterministic roll
    sim.advanceGameMinutes(2 * 24 * 60, 'two days pass'); // now day 3
    const minuteDay3 = 2 * 1440 + 600;
    sim.myplace.addGuestbookComment('maya_x', 'wanderer06', 'love this page!', minuteDay3);
    sim.advanceGameMinutes(24 * 60, 'into day 4');
    const entries = sim.myplace.getGuestbook('maya_x');
    const replied = entries.some((e) => e.minute > minuteDay3 && e.author === 'maya_x');
    expect(replied).toBe(appointmentRoll('maya_x:4:gbreply') < 60);
  });

  it('co-comments profile updates from mutual friends (deterministic roll)', () => {
    const before = sim.myplace.getGuestbook('maya_x').length;
    (sim as any).maybeCoCommentProfileUpdate('maya_x', 5, 5000);
    const after = sim.myplace.getGuestbook('maya_x').length;
    expect(after - before).toBe(appointmentRoll('maya_x:5:gbco') < 50 ? 1 : 0);
  });
});

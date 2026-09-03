import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  computeRoomMood,
  pickDirectTarget,
  buildRoomContext,
  roomMoodInstruction,
  directAddressInstruction,
  type RoomPair,
} from '../../src/engine/RoomDirector';
import { pickRoomExitLine, ROOM_EXIT_LINES } from '../../src/engine/characterTemplates';

function pair(aId: string, aName: string, bId: string, bName: string, affinity: number): RoomPair {
  return { aId, aName, bId, bName, affinity };
}

describe('P5.3 room mood (pure rules)', () => {
  it('defaults to steady with no pairs', () => {
    expect(computeRoomMood([])).toEqual({ mood: 'steady', score: 0 });
  });

  it('grades the lounge seed ties as warm (avg +5)', () => {
    const pairs = [
      pair('maya', 'Maya', 'ryan', 'Ryan', 15),
      pair('maya', 'Maya', 'nora', 'Nora', 5),
      pair('ryan', 'Ryan', 'nora', 'Nora', -5),
    ];
    expect(computeRoomMood(pairs)).toEqual({ mood: 'warm', score: 5 });
  });

  it('lets one bitter pair tense the room despite a warm average', () => {
    const pairs = [
      pair('maya', 'Maya', 'ryan', 'Ryan', 40),
      pair('ryan', 'Ryan', 'nora', 'Nora', -30),
    ];
    expect(computeRoomMood(pairs).mood).toBe('tense');
  });

  it('detects lively and cold rooms', () => {
    expect(computeRoomMood([pair('a', 'A', 'b', 'B', 30), pair('a', 'A', 'c', 'C', 20)]).mood).toBe('lively');
    expect(computeRoomMood([pair('a', 'A', 'b', 'B', -15), pair('a', 'A', 'c', 'C', -12)]).mood).toBe('cold');
  });
});

describe('P5.3 direct address (pure rules)', () => {
  const others = [
    { id: 'ryan', name: 'Ryan', affinity: 15 },
    { id: 'nora', name: 'Nora', affinity: -28 },
  ];

  it('stays player-facing on high rolls, weak ties or solitude', () => {
    expect(pickDirectTarget('maya', others, 25)).toBeNull();
    expect(pickDirectTarget('maya', others, 99)).toBeNull();
    expect(pickDirectTarget('maya', [], 0)).toBeNull();
    expect(pickDirectTarget('maya', [{ id: 'x', name: 'X', affinity: 5 }], 0)).toBeNull();
  });

  it('picks the strongest tie with the right tone', () => {
    // |-28| > |15| → Nora with friction tone
    expect(pickDirectTarget('maya', others, 10)).toEqual({ id: 'nora', name: 'Nora', affinity: -28, tone: 'friction' });
    expect(pickDirectTarget('maya', [{ id: 'ryan', name: 'Ryan', affinity: 35 }], 0)).toEqual({ id: 'ryan', name: 'Ryan', affinity: 35, tone: 'duet' });
    expect(pickDirectTarget('maya', [{ id: 'ryan', name: 'Ryan', affinity: 15 }], 0)?.tone).toBe('neutral');
  });

  it('builds injectable context and instructions', () => {
    const ctx = buildRoomContext('Orion Lounge', 'warm', [
      pair('maya', 'Maya', 'ryan', 'Ryan', 15),
      pair('ryan', 'Ryan', 'nora', 'Nora', -28),
    ]);
    expect(ctx).toContain('warm');
    expect(ctx).toContain('Maya↔Ryan');
    expect(ctx).toContain('+15');
    expect(ctx).toContain('-28');
    expect(buildRoomContext('X', 'steady', [])).toBe('Room mood: steady.');
    expect(roomMoodInstruction('tense')).toContain('shorter');
    expect(directAddressInstruction({ id: 'nora', name: 'Nora', affinity: 35, tone: 'duet' })).toContain('Nora');
  });

  it('picks deterministic exit lines from the pool', () => {
    const line = pickRoomExitLine('seed1');
    expect(line).toBe(pickRoomExitLine('seed1'));
    expect(ROOM_EXIT_LINES).toContain(line);
  });
});

describe('P5.3 weighted affinity bumps (SocialEngine)', () => {
  let social: SocialEngine;
  beforeEach(() => { social = makeSocial(); });
  function makeSocial(): SocialEngine {
    return new SocialEngine(new EventBus());
  }

  it('applies mood-weighted points under the same daily cap', () => {
    // lively turn: +3
    expect(social.bumpRoomAffinity(['maya', 'nora'], 2, 3)).toBe(1);
    expect(social.getAffinity('maya', 'nora')).toBe(5 + 3);
    // second lively turn hits the +6 cap (3 used, 3 left)
    social.bumpRoomAffinity(['maya', 'nora'], 2, 3);
    expect(social.getAffinity('maya', 'nora')).toBe(5 + 6);
    // further bumps same day are capped out
    expect(social.bumpRoomAffinity(['maya', 'nora'], 2, 3)).toBe(0);
  });

  it('cold rooms bump nothing and points clamp to 0..3', () => {
    expect(social.bumpRoomAffinity(['maya', 'nora'], 2, 0)).toBe(0);
    expect(social.getAffinity('maya', 'nora')).toBe(5);
    social.bumpRoomAffinity(['maya', 'nora'], 3, 99); // clamps to 3
    expect(social.getAffinity('maya', 'nora')).toBe(5 + 3);
  });
});

describe('P5.3 lounge mood from live seeds (SimulationEngine)', () => {
  it('grades the default lounge as warm', () => {
    const sim = new SimulationEngine();
    const ids = ['maya', 'ryan', 'nora'];
    const pairs: RoomPair[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.push({
          aId: ids[i]!, aName: sim.social.getBuddy(ids[i]!)?.displayName || ids[i]!,
          bId: ids[j]!, bName: sim.social.getBuddy(ids[j]!)?.displayName || ids[j]!,
          affinity: sim.social.getAffinity(ids[i]!, ids[j]!),
        });
      }
    }
    expect(computeRoomMood(pairs).mood).toBe('warm');
    // Souring one tie flips the room to tense
    sim.social.adjustAffinity('ryan', 'nora', -30);
    pairs.find((p) => (p.aId === 'ryan' && p.bId === 'nora') || (p.aId === 'nora' && p.bId === 'ryan'))!.affinity = sim.social.getAffinity('ryan', 'nora');
    expect(computeRoomMood(pairs).mood).toBe('tense');
  });
});

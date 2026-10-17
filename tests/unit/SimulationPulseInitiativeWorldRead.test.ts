import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';
import { WorldEventsEngine } from '../../src/engine/WorldEventsEngine';
import { EventBus } from '../../src/engine/EventBus';
import { planInitiatives } from '../../src/apps/pulse/utils/initiatives';
import type { GlobalEvent } from '../../src/engine/types';

const event = (index: number, day: number, at: number): GlobalEvent => ({
  id: `pulse_news_${index}`,
  title: `News headline ${index}`,
  description: `News body ${index}`,
  category: 'city_news',
  triggerDay: day,
  knowledgePrompt: `The report ${index} just arrived.`,
  isTriggered: true,
  triggeredAtMinute: at,
});

describe('#172 source-owned Pulse initiative topics and known NPC context', () => {
  it('preserves stable event order with tied and non-monotonic timestamps, and caps the daily window', () => {
    const world = new WorldEventsEngine(new EventBus());
    const events = Array.from({ length: 500 }, (_, index) =>
      event(index, index % 4 === 0 ? 10 : index % 4 === 1 ? 9 : 7, 100 + ((index * 17) % 43)));
    world.loadState({ triggeredEvents: events });
    const baseline = world.getTriggeredEvents().filter(e =>
      (e.triggerDay === 10 || e.triggerDay === 9) && e.title.trim().length > 3);
    const full = vi.spyOn(world, 'getTriggeredEvents');
    const state = vi.spyOn(world, 'getState');
    const actual = world.getInitiativeEventTitlesRead(10);
    expect(actual).toEqual(baseline.slice(-256).map(({ title, triggerDay }) => ({ title, triggerDay })));
    expect(actual).toHaveLength(250);
    expect(world.getInitiativeEventTitlesRead(200)).toEqual([]);
    expect(JSON.parse(JSON.stringify(actual))).toEqual(actual);
    actual[0]!.title = 'MUTATED_BY_UI';
    expect(world.getInitiativeEventTitlesRead(10)[0]!.title).not.toBe('MUTATED_BY_UI');
    expect(full).not.toHaveBeenCalled();
    expect(state).not.toHaveBeenCalled();

    const overflow = Array.from({ length: 330 }, (_, index) => event(500 + index, 10, 100 + ((index * 13) % 41)));
    world.loadState({ triggeredEvents: overflow });
    const sorted = world.getTriggeredEvents();
    full.mockClear();
    expect(world.getInitiativeEventTitlesRead(10)).toEqual(sorted.slice(-256).map(({ title, triggerDay }) => ({ title, triggerDay })));
    expect(world.getInitiativeEventTitlesRead(10)).toHaveLength(256);
    expect(full).not.toHaveBeenCalled();
  });

  it('keeps a buddy prompt identical to legacy filtered chronological events without a full World sort', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const events = Array.from({ length: 320 }, (_, index) => event(index, index % 3 === 0 ? 30 : 1, (index * 53) % 117));
    game.world.loadState({ triggeredEvents: events });
    const idKnowledge = new Map(game.world.getBuddyKnowledge(actor.id).map(entry => [entry.eventId, entry] as const));
    const old = game.world.getTriggeredEvents().filter(e => e.triggerDay <= 1 && idKnowledge.has(e.id)).slice(-4);
    const expected = old.map(e => {
      const k = idKnowledge.get(e.id);
      return `- [Day ${e.triggerDay}] ${e.title}${k ? ` [${k.attitude}]` : ''}: ${e.knowledgePrompt}${k ? ` — you feel: "${k.personalTake}"` : ''}`;
    }).join('\n') || 'No known major world events yet.';
    const all = vi.spyOn(game.world, 'getTriggeredEvents');
    const full = vi.spyOn(game.world, 'getState');
    const out = game.world.getKnowledgeContextForBuddy(actor.id, 1, 4);
    expect(out).toBe(expected);
    expect(game.world.getKnowledgeContextForBuddy(actor.id, 0, 4)).toBe('No known major world events yet.');
    expect(all).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
  });

  it('planner produces exactly the same deterministic plans while reading one roster and no broad event feed', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const input = {
      day: game.clock.getTime().day,
      blockedIds: ['absent_actor'],
      initiatedToday: {},
      maxCount: 12,
      salt: 'login',
    };
    // Deliberately use the legacy interface for independent reference output.
    const previous = planInitiatives({ social: game.social, world: {
      getTriggeredEvents: () => game.world.getTriggeredEvents(),
    } }, input);
    const full = vi.spyOn(game, 'getState');
    const roster = vi.spyOn(game.social, 'getBuddies');
    const worldFeed = vi.spyOn(game.world, 'getTriggeredEvents');
    const result = planInitiatives(game, input);
    expect(result).toEqual(previous);
    expect(roster).toHaveBeenCalledTimes(1);
    expect(worldFeed).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  }, 30_000);
});

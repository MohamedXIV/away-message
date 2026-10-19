import { describe, expect, it, vi } from 'vitest';
import { WorldEventsEngine } from '../../src/engine/WorldEventsEngine';
import { EventBus } from '../../src/engine/EventBus';
import type { GlobalEvent } from '../../src/engine/types';

function fixtureEvent(index: number, day: number, minute: number): GlobalEvent {
  return {
    id: `publication_world_news_${index}`,
    title: `Headline ${index}`,
    description: `Body ${index}`,
    category: 'city_news',
    knowledgePrompt: `The world heard report ${index}.`,
    triggerDay: day,
    isTriggered: true,
    triggeredAtMinute: minute,
    ...(index % 7 === 0 ? { siteUrl: `http://news${index}.local/` } : {}),
  };
}

function legacyKnowledge(events: GlobalEvent[], day: number, limit: number): string {
  const recent = [...events]
    .sort((a, b) => (a.triggeredAtMinute ?? 0) - (b.triggeredAtMinute ?? 0))
    .filter(e => e.triggerDay <= day).slice(-limit);
  if (!recent.length) return 'No major world events yet — early days, quiet internet.';
  return recent.map(e => `- [Day ${e.triggerDay}] ${e.title}: ${e.knowledgePrompt}`).join('\n');
}

function legacyArticles(events: GlobalEvent[], day: number) {
  return [...events]
    .sort((a, b) => (a.triggeredAtMinute ?? 0) - (b.triggeredAtMinute ?? 0))
    .filter(e => e.triggerDay <= day)
    .sort((a, b) => (b.triggeredAtMinute ?? 0) - (a.triggeredAtMinute ?? 0))
    .slice(0, 12)
    .map(e => ({
      id: e.id,
      headline: e.title,
      body: e.description,
      byline: `CityWire Staff // Day ${e.triggerDay}`,
      day: e.triggerDay,
      category: e.category,
      siteUrl: e.siteUrl,
    }));
}

describe('#172 bounded global knowledge and CityWire owner reads', () => {
  it('preserves legacy CityWire ordering under 500 events, day gating, timestamp ties and URLs', () => {
    const events = Array.from({ length: 500 }, (_, index) =>
      fixtureEvent(index, index % 5 === 0 ? 9 : index % 5 === 1 ? 11 : 10, (index * 13) % 37));
    const world = new WorldEventsEngine(new EventBus());
    world.loadState({ triggeredEvents: events });
    const all = vi.spyOn(world, 'getTriggeredEvents');
    const state = vi.spyOn(world, 'getState');

    for (const day of [1, 9, 10, 11, 100]) {
      const actual = world.getCityWireArticles(day);
      expect(actual).toEqual(legacyArticles(events, day));
      expect(actual.length).toBeLessThanOrEqual(12);
      expect(JSON.parse(JSON.stringify(actual))).toEqual(JSON.parse(JSON.stringify(legacyArticles(events, day))));
    }
    expect(all).not.toHaveBeenCalled();
    expect(state).not.toHaveBeenCalled();
    const read = world.getCityWireArticles(11);
    const originalHeadline = read[0]!.headline;
    read[0]!.headline = 'TAMPERED_BY_UI';
    expect(world.getCityWireArticles(11)[0]!.headline).toBe(originalHeadline);
  });

  it('keeps AI world prompt context byte-identical for supported 1–16 event windows', () => {
    const events = Array.from({ length: 480 }, (_, index) =>
      fixtureEvent(index, index % 3 === 0 ? 4 : 3, (index * 17) % 61));
    const world = new WorldEventsEngine(new EventBus());
    world.loadState({ triggeredEvents: events });
    const all = vi.spyOn(world, 'getTriggeredEvents');
    const state = vi.spyOn(world, 'getState');
    for (const day of [1, 3, 4, 9]) {
      for (const limit of [1, 4, 8, 16]) {
        expect(world.getKnowledgeContext(day, limit)).toBe(legacyKnowledge(events, day, limit));
      }
    }
    expect(world.getKnowledgeContext(9, 1000)).toBe(legacyKnowledge(events, 9, 16));
    expect(world.getKnowledgeContext(9, 0)).toBe(legacyKnowledge(events, 9, 1));
    expect(all).not.toHaveBeenCalled();
    expect(state).not.toHaveBeenCalled();
  });

  it('stays history-bounded and has no snapshot rebuild with many tied latest events', () => {
    const world = new WorldEventsEngine(new EventBus());
    const events = Array.from({ length: 700 }, (_, index) =>
      fixtureEvent(index, 1, index < 400 ? 400 : 700));
    world.loadState({ triggeredEvents: events });
    const all = vi.spyOn(world, 'getTriggeredEvents');
    const state = vi.spyOn(world, 'getState');
    expect(world.getCityWireArticles(1)).toEqual(legacyArticles(events, 1));
    expect(world.getKnowledgeContext(1, 4)).toBe(legacyKnowledge(events, 1, 4));
    expect(world.getCityWireArticles(-1)).toEqual([]);
    expect(world.getKnowledgeContext(-1)).toBe('No major world events yet — early days, quiet internet.');
    expect(all).not.toHaveBeenCalled();
    expect(state).not.toHaveBeenCalled();
  });
});

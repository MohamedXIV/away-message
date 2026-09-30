import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { NarrativeEngine } from '../../src/narrative/NarrativeEngine';
import { parseNarrativeTag, parseAllNarrativeTags } from '../../src/narrative/tagParser';
import type { StoryKnot } from '../../src/narrative/types';

describe('NarrativeEngine & semantic tag subsystem', () => {
  let sim: SimulationEngine;
  let narrative: NarrativeEngine;
  let actorId: string;

  beforeEach(() => {
    sim = new SimulationEngine();
    actorId = sim.social.getBuddies()[0]?.id ?? 'fixture_actor';
    const knots: StoryKnot[] = [
      {
        id: 'optional_local_event',
        characterId: actorId,
        day: 2,
        prerequisites: [{ type: 'relationship', buddyId: actorId, dimension: 'trust', op: '>=', value: 0 }],
        lines: [{ id: 'line_1', speaker: actorId, text: 'Want to grab coffee sometime?' }],
      },
    ];
    narrative = new NarrativeEngine(knots);
  });

  it('parses generic semantic tags', () => {
    const beat = parseNarrativeTag('# beat:local_event_complete');
    expect(beat.type).toBe('beat');

    const social = parseNarrativeTag(`# social:${actorId}:empathy`);
    expect(social.type).toBe('social');
    if (social.type === 'social') expect(social.buddyId).toBe(actorId);

    const appointment = parseNarrativeTag(
      '# schedule:appointment:coffee_meet:3:900:960:cafe:Coffee together',
    );
    expect(appointment.type).toBe('schedule_appointment');

    const parsed = parseAllNarrativeTags([
      '# beat:test_beat',
      '# effect:flag:visited:true',
      `# social:${actorId}:work_camaraderie`,
    ]);
    expect(parsed.map((tag) => tag.type)).toEqual(['beat', 'effect_flag', 'social']);
  });

  it('injects generic actor-keyed relationship maps', () => {
    const snapshot = narrative.injectContext(sim.getState());
    expect(snapshot.sim_current_day).toBe(1);
    expect(snapshot.sim_player_cash).toBe(38);
    expect(snapshot.sim_buddies_familiarity[actorId]).toBeTypeOf('number');
    expect(snapshot.sim_buddies_trust[actorId]).toBeTypeOf('number');
    expect(Object.keys(snapshot.sim_buddies_trust)).toContain(actorId);
  });

  it('evaluates actor-generic conditions', () => {
    narrative.injectContext(sim.getState());
    const trust = sim.social.getRelationships(actorId)?.trust ?? 0;

    expect(
      narrative.evaluateCondition({
        type: 'relationship',
        buddyId: actorId,
        dimension: 'trust',
        op: '>=',
        value: trust,
      }),
    ).toBe(true);

    expect(narrative.isKnotEligible(narrative.getKnot('optional_local_event')!)).toBe(false);
    sim.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 1440, reason: 'next sandbox day' });
    narrative.injectContext(sim.getState());
    expect(narrative.isKnotEligible(narrative.getKnot('optional_local_event')!)).toBe(true);
  });

  it('serializes optional authored state without implying campaign completion', () => {
    narrative.startKnot('optional_local_event');
    narrative.setFlag('local_detail_seen', true);
    const saved = narrative.getState();

    const restored = new NarrativeEngine([narrative.getKnot('optional_local_event')!]);
    restored.restoreState(saved);

    expect(restored.getFlag('local_detail_seen')).toBe(true);
    expect(restored.getState().visitedKnotIds).toContain('optional_local_event');
  });
});

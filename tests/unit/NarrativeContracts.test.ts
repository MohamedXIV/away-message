import { describe, it, expect } from 'vitest';
import {
  validateNarrativeEffectRequest,
  queryNarrativeContext,
  NarrativeContextQueryError,
  NarrativeContextProjectionSchema,
  NarrativeEffectRequestSchema,
  InkRuntimeStateSchema,
} from '../../src/narrative/contracts';

describe('Narrative contracts', () => {
  const projection = NarrativeContextProjectionSchema.parse({
    currentDay: 2,
    currentTimeMinute: 600,
    timeOfDay: 'afternoon',
    player: { cash: 38, energy: 80, fatigue: 20, cashBand: 'low' },
    actor: {
      id: 'actor_1',
      reach: 'local',
      roles: ['classmate'],
      lifecycle: 'active',
      connection: 'known',
      relationshipStage: 'friend',
      trusted: true,
      conflicted: false,
    },
    location: { placeId: 'cafe', coLocated: true },
    obligation: { id: 'obl_1', kind: 'education', description: 'study' },
    scenario: { instanceId: 'scn_1', hookId: 'hook_a' },
    knowledge: { playerKnows: ['fact_x'] },
    flags: { visited: true },
    completedBeats: ['beat_1'],
  });

  it('queryNarrativeContext accepts approved keys', () => {
    expect(queryNarrativeContext(projection, 'current_day')).toBe(2);
    expect(queryNarrativeContext(projection, 'player_cash')).toBe(38);
    expect(queryNarrativeContext(projection, 'actor_trusted')).toBe(true);
    expect(queryNarrativeContext(projection, 'location_co_located')).toBe(true);
    expect(queryNarrativeContext(projection, 'has_obligation')).toBe(true);
    expect(queryNarrativeContext(projection, 'flag', 'visited')).toBe(true);
    expect(queryNarrativeContext(projection, 'completed_beat', 'beat_1')).toBe(true);
    expect(queryNarrativeContext(projection, 'player_knows', 'fact_x')).toBe(true);
    expect(queryNarrativeContext(projection, 'actor_can_meet_in_person')).toBe(true);
  });

  it('queryNarrativeContext rejects unknown keys', () => {
    expect(() => queryNarrativeContext(projection, 'raw_state')).toThrow(NarrativeContextQueryError);
    expect(() => queryNarrativeContext(projection, 'actor_secret')).toThrow();
  });

  it('validateNarrativeEffectRequest accepts approved operations', () => {
    const cases = [
      { type: 'world_set_flag', key: 'k', value: true },
      { type: 'world_trigger_event', eventId: 'evt_1' },
      { type: 'social_act', buddyId: 'b1', action: 'empathy' },
      { type: 'unlock', targetType: 'app', targetId: 'photobox' },
      { type: 'request_effect', effectId: 'study_together', payload: { courseId: 'c1' } },
      {
        type: 'schedule_appointment',
        appointment: {
          id: 'a1',
          characterId: 'b1',
          locationId: 'cafe',
          targetDay: 2,
          startMinute: 900,
          endMinute: 960,
          description: 'coffee',
        },
      },
    ];
    for (const c of cases) {
      const r = validateNarrativeEffectRequest(c);
      expect(r.ok).toBe(true);
    }
  });

  it('validateNarrativeEffectRequest rejects unknown semantic effects', () => {
    const r = validateNarrativeEffectRequest({ type: 'request_effect', effectId: 'does_not_exist', payload: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('unknown or unapproved');
    const r2 = validateNarrativeEffectRequest({ type: 'request_effect', effectId: 'social_act', payload: {} });
    expect(r2.ok).toBe(true);
  });

  it('validateNarrativeEffectRequest rejects unknown/malformed', () => {
    const bad = [
      { type: 'money_mutate', amount: 5 },
      { type: 'world_set_flag', key: '', value: true },
      { type: 'social_act', buddyId: 'b1', action: 'not_a_real_action' },
      { type: 'request_effect', effectId: 'x', payload: { a: { b: { c: { d: { e: 1 } } } } } },
      { type: 'request_effect', effectId: 'x', payload: Array.from({ length: 100 }, (_, i) => i) as any },
      'not an object',
      null,
    ];
    for (const b of bad) {
      const r = validateNarrativeEffectRequest(b);
      expect(r.ok).toBe(false);
    }
  });

  it('InkRuntimeState schema validates', () => {
    const r = InkRuntimeStateSchema.safeParse({ version: 1, storyStateJson: '{"a":1}' });
    expect(r.success).toBe(true);
    const r2 = InkRuntimeStateSchema.safeParse({ version: 2, storyStateJson: '{}' });
    expect(r2.success).toBe(false);
  });

  it('NarrativeEffectRequestSchema is a discriminated union', () => {
    const r = NarrativeEffectRequestSchema.safeParse({ type: 'unknown_op' });
    expect(r.success).toBe(false);
  });
});

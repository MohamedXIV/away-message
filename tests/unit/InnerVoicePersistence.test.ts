import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function stripInnerVoice(snapshot: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  delete clone.innerVoice;
  return clone;
}

describe('Inner Voice persistence (cooldown/notable-history only)', () => {
  it('8. save/reload does not immediately replay an already-suppressed notable thought', () => {
    const first = new SimulationEngine({});
    const notable = first.requestInnerThought(
      {
        kind: 'economy_pressure',
        topic: 'missed rent',
        semanticMeaning: 'i realize rent is due tomorrow and my cash is short',
        tone: 'uneasy',
        priority: 90,
        source: 'economy:rent',
        knowledgeRefs: ['player:economy:cash'],
        cooldownKey: 'economy:rent_due',
        presentation: 'urgent',
        knowledge: { economyHint: 'cash is short, rent due tomorrow' },
      },
      400,
    );
    expect(notable).not.toBeNull();

    const snapshot = first.exportSnapshot();
    const second = new SimulationEngine(snapshot as never);
    const replay = second.requestInnerThought(
      {
        kind: 'economy_pressure',
        topic: 'missed rent',
        semanticMeaning: 'i realize rent is due tomorrow and my cash is short',
        tone: 'uneasy',
        priority: 90,
        source: 'economy:rent',
        knowledgeRefs: ['player:economy:cash'],
        cooldownKey: 'economy:rent_due',
        presentation: 'urgent',
        knowledge: { economyHint: 'cash is short, rent due tomorrow' },
      },
      410,
    );
    expect(replay).toBeNull();
  });

  it('old snapshots without innerVoice state load with clean defaults', () => {
    const first = new SimulationEngine({});
    const snapshot = JSON.parse(JSON.stringify(first.exportSnapshot())) as Record<string, unknown>;
    delete snapshot.innerVoice;

    const reloaded = new SimulationEngine(snapshot as never);
    const thought = reloaded.requestInnerThought(
      {
        kind: 'street_detail',
        topic: 'neon flicker',
        semanticMeaning: 'i notice the corner mart sign flicker once',
        tone: 'curious',
        priority: 10,
        source: 'world:street',
        knowledgeRefs: ['visible:place:corner_mart'],
        cooldownKey: 'street:neon',
        presentation: 'ambient',
        knowledge: { visiblePlaceId: 'corner_mart' },
      },
      100,
    );
    expect(thought).not.toBeNull();
    expect(reloaded.exportSnapshot().innerVoice).toBeDefined();
  });

  it('4. Inspect/Think through the facade does not mutate gameplay state', () => {
    const engine = new SimulationEngine({});
    const before = stripInnerVoice(engine.exportSnapshot() as unknown as Record<string, unknown>);
    const intent = engine.requestInspectThought(
      {
        topic: 'chipped mug',
        semanticMeaning: 'i turn the chipped mug over in my hands',
        source: 'inspect:item',
        knowledgeRefs: ['visible:object:chipped_mug'],
        knowledge: { visiblePlaceId: 'room104', visibleObjects: ['chipped mug'] },
      },
      200,
    );
    expect(intent).not.toBeNull();
    expect(intent?.presentation).toBe('inspect');
    const after = stripInnerVoice(engine.exportSnapshot() as unknown as Record<string, unknown>);
    expect(after).toEqual(before);
  });
});

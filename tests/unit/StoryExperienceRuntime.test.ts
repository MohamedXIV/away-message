import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { StoryExperienceRuntime } from '../../src/engine/kernel/StoryExperienceRuntime';

function runtime(engine: SimulationEngine): StoryExperienceRuntime {
  return (engine as unknown as { story: StoryExperienceRuntime }).story;
}

describe('StoryExperienceRuntime — authored Scenario and Inner Voice ownership', () => {
  it('keeps public Scenario/Inner Voice reads attached to the same owned instances', () => {
    const engine = new SimulationEngine();
    const story = runtime(engine);

    expect(story).toBeInstanceOf(StoryExperienceRuntime);
    expect(story.getScenarioState()).toEqual(engine.getScenarioState());
    expect(story.getInnerVoiceEngine()).toBe(engine.getInnerVoiceEngine());
    expect(story.getInnerVoiceState()).toEqual(engine.getInnerVoiceState());

    const observation = { knowledgeFacts: [], colocatedActorIds: [] };
    expect(story.getScenarioProjection(observation)).toEqual(engine.getScenarioProjection(observation));
    expect(story.getScenarioHookOpportunities(observation))
      .toEqual(engine.getScenarioHookOpportunities(observation));
  });

  it('loads precisely persisted scenario bindings without rerolling a new authored set', () => {
    const source = new SimulationEngine();
    const saved = source.exportSnapshot();
    const owners = createCoreDomainOwners(saved);
    const story = new StoryExperienceRuntime(owners, saved.scenarios, 'intentionally-different-seed', saved.innerVoice);

    expect(story.getScenarioState()).toEqual(saved.scenarios);
    expect(story.getInnerVoiceState()).toEqual(saved.innerVoice);

    story.loadState(saved.scenarios, saved.innerVoice);
    expect(story.getScenarioState()).toEqual(saved.scenarios);
    expect(story.getInnerVoiceState()).toEqual(saved.innerVoice);

    const restored = new SimulationEngine(saved);
    expect(restored.getScenarioState()).toEqual(saved.scenarios);
    expect(restored.getInnerVoiceState()).toEqual(saved.innerVoice);
  });

  it('reloading through the public save path reuses the single authored/presentation owners', () => {
    const engine = new SimulationEngine();
    const initialStory = runtime(engine);
    const initialVoice = engine.getInnerVoiceEngine();
    const saved = engine.exportSnapshot();

    engine.loadSnapshot(saved);

    expect(runtime(engine)).toBe(initialStory);
    expect(engine.getInnerVoiceEngine()).toBe(initialVoice);
    expect(engine.getScenarioState()).toEqual(saved.scenarios);
    expect(engine.getInnerVoiceState()).toEqual(saved.innerVoice);
  });
});

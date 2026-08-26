import { NarrativeEngine } from './NarrativeEngine';
import { InkAdapter } from './InkAdapter';
import { ALL_STORY_KNOTS } from './data/allKnots';
import { SimulationEngine } from '../engine/SimulationEngine';

export function createNarrativeEngine(): NarrativeEngine {
  const engine = new NarrativeEngine(undefined, ALL_STORY_KNOTS);
  return engine;
}

export function createInkAdapter(
  simulationEngine: SimulationEngine,
  narrativeEngine?: NarrativeEngine
): InkAdapter {
  const narrative = narrativeEngine || createNarrativeEngine();
  return new InkAdapter(simulationEngine, narrative);
}

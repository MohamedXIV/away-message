// Public import retained for consumers; no executable legacy engine remains.
export { SimulationKernel as SimulationEngine } from './kernel/SimulationKernel';
export type { LiveSimulationState } from './kernel/SimulationKernel';
export { resolvePcBootState } from './kernel/ComputerOwnershipRuntime';
export type { PcBootState, OsInstallMode, OsInstallPlan } from './kernel/ComputerOwnershipRuntime';
export type {
  EncounterCandidate, EncounterDecision, EncounterDecisionInput,
  EncounterDirectorState, EncounterPlayerTransitRead,
} from './encounters';

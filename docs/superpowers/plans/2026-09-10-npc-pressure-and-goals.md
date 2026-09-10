# Lightweight NPC Life Pressure and Bounded Personal Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded semantic NPC decision state (fatigue band, stress band, broad mood, interruption tolerance, optional money band, need pressure) and small bounded personal goals without player-meter duplication or sims-style continuous simulation.

**Architecture:** Pressure and personal goals are pure semantic life state within `src/engine/life/`. They project into `LifeMatrixSnapshot` and generate `CharacterObligation` instances with `sourceKind: 'personal_goal'`. Existing authorities (`SocialEngine`, `EconomyEngine`, `JobDirector`, `AppointmentDirector`, `WorldEventsEngine`, `TransitNetwork`) remain authoritative and are never copied. Three fidelity tiers (`important_local`, `local_offscreen`, `background_remote`) keep background simulation cheap and event-driven.

**Tech Stack:** TypeScript, Vitest, existing `src/engine/life/` projection package.

**Spec:** GitHub issue #43 and `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md`.

## Global Constraints

- **Not a Sims meter simulation**: No high-frequency per-minute or continuous numeric meter decay. Use categorical/bounded bands and event-driven updates.
- **Authority laws**: Never copy relationship values from `SocialEngine`, player economy/body state from `EconomyEngine`, appointment/job outcomes, world events, or transit timing into NPC pressure/goals.
- **AI boundary**: AI/provider availability has zero effect on canonical goal creation or completion.
- **Temporary persistence hold**: PR #63 / #18 owns the shared `SimulationState`/save migration seam. While active, do NOT modify global `SimulationState`, save format/version, generic snapshot migration, or unrelated `SimulationEngine*` persistence wiring. Design and test isolated serialization/hydration helpers locally.
- **Fidelity tiers**:
  - `important_local`: current pressure + bounded goals + full intent evaluation
  - `local_offscreen`: coarse/event-driven pressure updates; time jumps produce equivalent outcomes
  - `background_remote`: abstract life state; no per-minute meter simulation

---

### Task 1: Semantic pressure and personal goal contracts & types

**Files:**
- Modify: `src/engine/life/types.ts`
- Create: `tests/unit/LifeNpcPressureAndGoals.test.ts`

**Interfaces:**
- `FatigueBand`: `'rested' | 'normal' | 'tired' | 'exhausted'`
- `StressBand`: `'calm' | 'normal' | 'stressed' | 'overwhelmed'`
- `BroadMood`: `'content' | 'cheerful' | 'melancholy' | 'anxious' | 'irritable' | 'focused' | 'neutral'`
- `InterruptionTolerance`: `'open' | 'flexible' | 'busy' | 'do_not_disturb'`
- `MoneyBand`: `'tight' | 'stable' | 'flush'`
- `NeedPressureKind`: `'rest' | 'social' | 'quiet' | 'errand' | 'meal'`
- `FidelityTier`: `'important_local' | 'local_offscreen' | 'background_remote'`
- `GoalKind`: `'save_purchase' | 'find_work' | 'improve_relationship' | 'distance_relationship' | 'spend_time' | 'attend_event' | 'practical_task' | 'upgrade_gear' | 'change_circumstance'`
- `GoalStatus`: `'active' | 'completed' | 'paused' | 'abandoned'`
- `PersonalGoal`: `{ id, actorId, kind, description, targetId?, priority, status, progress, createdDay, targetDay?, metadata? }`
- Extend `LifePressureView` with semantic bands and needs.
- Extend `LifeMatrixSnapshot` with `goals: PersonalGoal[]` and `fidelityTier?: FidelityTier`.

- [ ] **Step 1: Write RED tests** in `tests/unit/LifeNpcPressureAndGoals.test.ts` covering contract shapes, bounded types, and zero mutation.
- [ ] **Step 2: Add contract types** to `src/engine/life/types.ts`.
- [ ] **Step 3: Run `npx vitest run tests/unit/LifeNpcPressureAndGoals.test.ts`** and verify green contract assertions.

### Task 2: Pure deterministic NPC pressure evaluation and fidelity tiers

**Files:**
- Create: `src/engine/life/Pressure.ts`
- Modify: `src/engine/life/index.ts`
- Modify: `tests/unit/LifeNpcPressureAndGoals.test.ts`

**Interfaces:**
- `deriveDefaultNpcPressure(actorId, traits, routine)`
- `advanceNpcPressure(state, fromMinute, toMinute, context)`
- `projectLifePressureView(state, atMinute)`
- Off-screen time jump produces equivalent deterministic pressure outcome.
- Background remote tier receives abstract updates, no per-minute meter simulation.

- [ ] **Step 1: Write RED tests** for deterministic initialization from traits/routine, time-jump equivalence, and tier differentiation.
- [ ] **Step 2: Implement `src/engine/life/Pressure.ts`.**
- [ ] **Step 3: Run focused vitest tests.**

### Task 3: Bounded personal goal initialization, policy, and evaluation

**Files:**
- Create: `src/engine/life/Goals.ts`
- Modify: `src/engine/life/index.ts`
- Modify: `tests/unit/LifeNpcPressureAndGoals.test.ts`

**Interfaces:**
- `MAX_ACTIVE_GOALS_PER_ACTOR = 3`
- `initializeActorGoals(actorId, archetypeId, seed, traits, bonds?, events?)`
- `evaluateGoalProgress(goal, sources, atMinute)`
- Goals are bounded, stable for the same seed/identity, read authorities without copying them, and offline-safe with zero AI dependency.

- [ ] **Step 1: Write RED tests** for stable initialization, bounded count, social read-without-copy, and AI independence.
- [ ] **Step 2: Implement `src/engine/life/Goals.ts`.**
- [ ] **Step 3: Run focused vitest tests.**

### Task 4: Obligation projection for personal goals

**Files:**
- Modify: `src/engine/life/Obligations.ts`
- Modify: `tests/unit/LifeObligations.test.ts`
- Modify: `tests/unit/LifeNpcPressureAndGoals.test.ts`

**Interfaces:**
- `buildCharacterObligations(snapshot)` projects active goals as `sourceKind: 'personal_goal'` obligations.
- Derived IDs: `goal:<actorId>:<goalId>`.
- Priority mapped from goal priority.

- [ ] **Step 1: Write RED tests** proving active personal goals project into obligations without duplicating goals.
- [ ] **Step 2: Update `Obligations.ts`** to project personal goals.
- [ ] **Step 3: Run focused vitest tests.**

### Task 5: Isolated persistence contracts & hydration/migration helpers

**Files:**
- Create: `src/engine/life/Persistence.ts`
- Modify: `src/engine/life/index.ts`
- Modify: `tests/unit/LifeNpcPressureAndGoals.test.ts`

**Interfaces:**
- `serializePersonalGoals(goals)` / `hydratePersonalGoals(data)`
- `serializeNpcPressure(pressure)` / `hydrateNpcPressure(data)`
- Missing/old save data migrates cleanly to neutral default state.
- Strictly isolated: does NOT touch global `SimulationState` or `SAVE_FORMAT_VERSION` during PR #63 hold.

- [ ] **Step 1: Write RED tests** for round-trip serialization and old save neutral default migration.
- [ ] **Step 2: Implement `src/engine/life/Persistence.ts`.**
- [ ] **Step 3: Run focused vitest tests.**

### Task 6: LifeSources, LifeSnapshot, and SimulationEngine integration

**Files:**
- Modify: `src/engine/life/LifeSources.ts`
- Modify: `src/engine/life/LifeSnapshot.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify: `tests/integration/LifeMatrixCompatibility.test.ts`

**Interfaces:**
- `buildLifeMatrixSnapshot` populates `pressure`, `goals`, and `fidelityTier`.
- `SimulationEngine` exposes `getNpcPressure(actorId)` and `getPersonalGoals(actorId)`.
- No mutation of existing systems or save format.

- [ ] **Step 1: Write RED integration tests** in `tests/integration/LifeMatrixCompatibility.test.ts`.
- [ ] **Step 2: Connect sources, snapshot, and simulation facade.**
- [ ] **Step 3: Run integration tests + typecheck + build.**

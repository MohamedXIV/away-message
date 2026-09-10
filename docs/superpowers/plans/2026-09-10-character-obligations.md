# Character Obligations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic source-backed CharacterObligations without creating a second appointment/job/social ledger.

**Architecture:** Obligations are an on-demand planning projection over `LifeMatrixSnapshot`. Existing SocialEngine and WorldEventsEngine remain authoritative. Agenda is preferred as the current routine planning view; schedule windows are fallback input so the same block is not projected twice. Accepted jobs remain real appointments and carry only explicit job provenance on that appointment.

**Tech Stack:** TypeScript, Vitest, existing `src/engine/life/` projection package.

**Spec:** GitHub issue #42 and `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md`.

## Global Constraints

- Never add a persisted obligation ledger while the obligation can be reconstructed from existing source truth.
- Never let obligations independently declare appointment attendance, wages, promise resolution, world-event completion, delivery state, or transit timing.
- No route planning, departure execution, generic GOAP, LLM-generated obligations, or presence rewrite.
- Stable source state must produce stable obligation IDs and order.
- All public projections return defensive values and must not mutate source systems.

---

### Task 1: Obligation semantic contract

**Files:**
- Modify: `src/engine/life/types.ts`
- Create: `src/engine/life/Obligations.ts`
- Create: `tests/unit/LifeObligations.test.ts`
- Modify: `src/engine/life/index.ts`

**Interfaces:**
- Produces `ObligationSourceKind`, `ObligationFlexibility`, `ObligationStatus`, `CharacterObligation`.
- Produces `buildCharacterObligations(snapshot: LifeMatrixSnapshot): CharacterObligation[]`.

- [ ] **Step 1: Write RED type/projection tests** proving deterministic IDs/order and no duplicate output across repeated calls.
- [ ] **Step 2: Run `npx vitest run tests/unit/LifeObligations.test.ts`** and confirm failure is the missing obligation contract/projector.
- [ ] **Step 3: Add the minimal contracts and an empty-source-safe deterministic projector.** Obligation IDs are derived only from actor + source kind + source id/window, never random/time-of-day wall clock.
- [ ] **Step 4: Run focused tests + `npx tsc --noEmit`.**
- [ ] **Step 5: Commit `feat(life): add character obligation contracts`.**

### Task 2: Routine, agenda, appointment, and promise projection

**Files:**
- Modify: `src/engine/life/Obligations.ts`
- Modify: `tests/unit/LifeObligations.test.ts`

**Interfaces:**
- Agenda entries for the snapshot day supersede raw routine windows as planning input; routine windows are used only when no agenda exists.
- Appointment owner status maps read-only: `happened -> satisfied`, `missed -> missed`, `cancelled -> cancelled`, otherwise `pending`.
- Only open promises with `dueDay` become obligations; undated social-memory promises remain non-obligations.

- [ ] **Step 1: Write RED cases** for one appointment => one obligation, changed/cancelled source reflection, agenda-vs-routine dedupe, actionable dated promise, and undated promise exclusion.
- [ ] **Step 2: Run focused RED.**
- [ ] **Step 3: Implement pure projection and stable sorting** by earliest/preferred/latest time, then source kind and id.
- [ ] **Step 4: Run focused tests + life foundation suites.**
- [ ] **Step 5: Commit `feat(life): project source-backed obligations`.**

### Task 3: Preserve accepted-job provenance on the owning appointment

**Files:**
- Modify: `src/engine/types/index.ts`
- Modify: `src/engine/SimulationEngineCore.ts`
- Modify: `src/engine/life/types.ts`
- Modify: `src/engine/life/LifeSources.ts`
- Modify: `tests/unit/JobsHoursP6.test.ts` or current job acceptance test
- Modify: `tests/unit/LifeObligations.test.ts`

**Interfaces:**
- Add optional appointment provenance equivalent to `origin?: { kind: 'job'; id: string }`.
- Job acceptance writes only `{ kind: 'job', id: gig.id }` onto the existing appointment. Wage, acceptance outcome and appointment status remain owned where they are today.
- Life projection carries this provenance defensively; it does not parse `gig_*` appointment ids.

- [ ] **Step 1: Write RED proving an accepted gig appointment carries the real gig id and still creates exactly one obligation.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Add the optional provenance field at job-appointment creation and project it read-only.** No save version bump; old appointments simply have no origin.
- [ ] **Step 4: Run job, appointment, persistence and obligation suites.**
- [ ] **Step 5: Commit `feat(life): preserve job appointment provenance`.**

### Task 4: Simulation facade

**Files:**
- Modify: `src/engine/SimulationEngine.ts`
- Modify: `tests/integration/LifeMatrixCompatibility.test.ts`

**Interfaces:**
- Produces `getCharacterObligations(actorId: string): CharacterObligation[]` by calling `getLifeSnapshot(actorId)` then the pure projector; missing actors return `[]`.

- [ ] **Step 1: Write RED facade/no-mutation test.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Add the on-demand facade only; no tick hook/cache/save field.**
- [ ] **Step 4: Run focused + build/typecheck.**
- [ ] **Step 5: Commit `feat(life): expose character obligations`.**

### Task 5: Reconstruction and authority gate

**Files:**
- Modify: `tests/integration/LifeMatrixCompatibility.test.ts`

- [ ] **Step 1: Add save/reload equivalence:** project obligations before export, load the existing snapshot into a fresh engine, project again, and assert equivalent obligations without any persisted obligation field.
- [ ] **Step 2: Add repeated-read/no-mutation assertion and full-source change reflection.**
- [ ] **Step 3: Run `npm run content:check`, `npx tsc --noEmit`, `npm run build`, baseline guard, and full tests.**
- [ ] **Step 4: Audit final diff for any second ledger, copied outcomes, route/transit logic, UI/renderer imports or AI calls.**
- [ ] **Step 5: Update PR evidence and merge only on a fresh exact-head green gate.**

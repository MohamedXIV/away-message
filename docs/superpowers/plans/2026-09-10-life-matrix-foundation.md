# Life Matrix Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a renderer-neutral, read-only Life Matrix compatibility seam over Away Message's existing character/social/world authorities without changing current gameplay behavior or duplicating state.

**Architecture:** Introduce a focused `src/engine/life/` package whose first responsibility is projection only. It reads existing SocialEngine, world appointment/event state, current schedules/agendas, and the authoritative game clock through narrow adapter interfaces, then returns deterministic immutable life snapshots. No relationship, appointment, job, event, transit, delivery, or presence state moves into the new package in this slice.

**Tech Stack:** TypeScript strict mode, Vitest, existing pure-TS simulation, existing SocialEngine/WorldEventsEngine/SimulationEngineCore APIs.

**Spec:** `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md`

## Global Constraints

- Start implementation only from the latest safe base after Issue #14 / PR #4 integration work is complete or explicitly handed off.
- Do not create a second relationship graph, appointment store, job ledger, event catalog, transit planner, delivery ledger, or location truth.
- Life Matrix foundation is read-only in this plan: it must not mutate existing authorities.
- Preserve all existing SocialEngine relationship dimensions, directed NPC bonds, affinity, traits, memories/promises, agendas, and social outcomes.
- Preserve existing appointment RSVP/show/cancel logic and WorldEventsEngine trigger/knowledge logic byte-for-byte unless a failing compatibility test proves a necessary adapter change.
- No save-format bump in this plan; the new projection has no canonical mutable state.
- No LLM calls in Life Matrix projection or planning contracts.
- Same authoritative input state + same actor ID + same time must produce the same snapshot.
- New public types belong under `src/engine/life/`, not in React/Phaser.
- Run focused RED→GREEN tests first, then `npx tsc --noEmit`, `npm run build`, and `npm run test` with zero new failures beyond the documented baseline.

---

## File Structure

Create:

```text
src/engine/life/
  types.ts             # semantic, renderer-neutral Life Matrix read-model types
  LifeSources.ts       # narrow read-only source interfaces/adapters
  LifeSnapshot.ts      # deterministic snapshot projector
  index.ts             # public package exports

tests/unit/
  LifeMatrixTypes.test.ts
  LifeSources.test.ts
  LifeSnapshot.test.ts

tests/integration/
  LifeMatrixCompatibility.test.ts
```

Modify only when the focused tests are green:

```text
src/engine/SimulationEngineCore.ts
  # expose a read-only getLifeSnapshot(actorId) facade; no tick behavior change
```

Do **not** modify in this plan:

```text
src/engine/SocialEngine.ts          # unless only a missing read-only accessor is proven necessary
src/engine/AppointmentDirector.ts   # source behavior remains authoritative
src/engine/JobDirector.ts           # source behavior remains authoritative
src/engine/DeliveryEngine.ts        # source behavior remains authoritative
src/engine/CityMap.ts               # transit migration is #35
src/engine/types/index.ts           # avoid expanding the monolithic compatibility root unless integration forces it
persistence save version/migrations # no mutable Life Matrix state yet
```

---

### Task 1: Define the semantic Life Matrix read-model contracts

**Files:**
- Create: `src/engine/life/types.ts`
- Create: `tests/unit/LifeMatrixTypes.test.ts`

**Interfaces:**
- Produces: `LifeMatrixSnapshot`, `LifeRoutineWindow`, `LifeAgendaEntry`, `LifeRelationshipView`, `LifePromiseView`, `LifeAppointmentView`, `LifeWorldEventView`, `LifePresenceView`, `LifePressureView`.
- Consumes: existing IDs and primitive values only; no concrete engine classes.

- [ ] **Step 1: Write the failing type/shape test**

Create `tests/unit/LifeMatrixTypes.test.ts` with a compile/runtime fixture that imports the proposed types and builds one valid snapshot:

```ts
import { describe, expect, it } from 'vitest';
import type { LifeMatrixSnapshot } from '../../src/engine/life/types';

describe('Life Matrix semantic contracts', () => {
  it('can represent an actor without owning source-system state', () => {
    const snapshot: LifeMatrixSnapshot = {
      actorId: 'sam',
      atMinute: 600,
      day: 1,
      minuteOfDay: 600,
      traits: {
        shyness: 40,
        warmth: 55,
        discipline: 80,
        spontaneity: 30,
        loyalty: 70,
      },
      playerRelationship: null,
      notableNpcBonds: [],
      promises: [],
      routineWindows: [],
      agenda: [],
      appointments: [],
      worldEvents: [],
      presence: { messengerStatus: 'offline' },
      pressure: {},
    };

    expect(snapshot.actorId).toBe('sam');
    expect(snapshot.appointments).toEqual([]);
  });
});
```

Expected `types.ts` contract:

```ts
export interface LifeRoutineWindow {
  day: number;
  startMinute: number;
  endMinute: number;
  status: string;
  awayMessage: string;
}

export interface LifeAgendaEntry {
  id: string;
  kind: string;
  label: string;
  day: number;
  startMinute: number;
  endMinute?: number;
}

export interface LifeRelationshipView {
  targetId: string;
  familiarity: number;
  trust: number;
  comfort: number;
  respect: number;
  annoyance: number;
  affection: number;
  attraction: number;
  suspicion: number;
  resentment: number;
}

export interface LifePromiseView {
  id?: string;
  text: string;
  dueDay?: number;
  fulfilled?: boolean;
}

export interface LifeAppointmentView {
  id: string;
  characterId: string;
  locationId: string;
  targetDay: number;
  startMinute: number;
  endMinute?: number;
  rsvp?: string;
  status?: string;
}

export interface LifeWorldEventView {
  id: string;
  title: string;
  category: string;
  triggerDay: number;
  triggeredAtMinute?: number;
}

export interface LifePresenceView {
  messengerStatus: string;
  awayMessage?: string;
}

export interface LifePressureView {
  departure?: number;
  fatigue?: number;
  stress?: number;
}

export interface LifeMatrixSnapshot {
  actorId: string;
  atMinute: number;
  day: number;
  minuteOfDay: number;
  traits: {
    shyness: number;
    warmth: number;
    discipline: number;
    spontaneity: number;
    loyalty: number;
  };
  playerRelationship: LifeRelationshipView | null;
  notableNpcBonds: LifeRelationshipView[];
  promises: LifePromiseView[];
  routineWindows: LifeRoutineWindow[];
  agenda: LifeAgendaEntry[];
  appointments: LifeAppointmentView[];
  worldEvents: LifeWorldEventView[];
  presence: LifePresenceView;
  pressure: LifePressureView;
}
```

Use `Readonly`/readonly arrays where convenient, but keep the semantic fields above stable for this plan.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/unit/LifeMatrixTypes.test.ts
```

Expected: FAIL because `src/engine/life/types.ts` does not exist.

- [ ] **Step 3: Implement the minimal semantic types**

Create `src/engine/life/types.ts` using the contract above. Do not import React, Phaser, Inochi2D, TinyBase, or concrete engine classes.

- [ ] **Step 4: Run the focused test and typecheck**

Run:

```bash
npx vitest run tests/unit/LifeMatrixTypes.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/life/types.ts tests/unit/LifeMatrixTypes.test.ts
git commit -m "feat(life): define Life Matrix read-model contracts"
```

---

### Task 2: Add narrow read-only source interfaces

**Files:**
- Create: `src/engine/life/LifeSources.ts`
- Create: `tests/unit/LifeSources.test.ts`

**Interfaces:**
- Consumes: existing SocialEngine/world/clock data through callbacks.
- Produces: `LifeSources` and `createLifeSources(...)` adapter factory.
- Must not expose mutating methods from source engines.

- [ ] **Step 1: Write a failing source-boundary test**

Create `tests/unit/LifeSources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLifeSources } from '../../src/engine/life/LifeSources';

describe('Life Matrix source boundary', () => {
  it('exposes reads without exposing source mutation', () => {
    const sources = createLifeSources({
      getBuddy: (id) => id === 'sam' ? ({ id: 'sam', schedule: {} } as any) : undefined,
      getTraits: () => ({ shyness: 40, warmth: 55, discipline: 80, spontaneity: 30, loyalty: 70 }),
      getPlayerRelationship: () => null,
      getNpcBonds: () => [],
      getPromises: () => [],
      getAgenda: () => [],
      getPresence: () => ({ status: 'offline', awayMessage: '' }),
      getAppointments: () => [],
      getTriggeredEvents: () => [],
    });

    expect(sources.getTraits('sam').discipline).toBe(80);
    expect('applySocialAction' in (sources as object)).toBe(false);
    expect('adjustNpcBond' in (sources as object)).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/LifeSources.test.ts
```

Expected: FAIL because `LifeSources.ts` does not exist.

- [ ] **Step 3: Implement read-only source interfaces**

Use callback interfaces rather than storing engine classes:

```ts
import type {
  LifeAgendaEntry,
  LifeAppointmentView,
  LifePresenceView,
  LifePromiseView,
  LifeRelationshipView,
  LifeWorldEventView,
} from './types';

export interface LifeSourceAdapterInput {
  getBuddy(actorId: string): { id: string; schedule: Record<number, unknown[]> } | undefined;
  getTraits(actorId: string): LifeMatrixSnapshot['traits'];
  getPlayerRelationship(actorId: string): LifeRelationshipView | null;
  getNpcBonds(actorId: string): LifeRelationshipView[];
  getPromises(actorId: string): LifePromiseView[];
  getAgenda(actorId: string, day: number): LifeAgendaEntry[];
  getPresence(actorId: string): LifePresenceView;
  getAppointments(): LifeAppointmentView[];
  getTriggeredEvents(): LifeWorldEventView[];
}

export type LifeSources = Readonly<LifeSourceAdapterInput>;

export function createLifeSources(input: LifeSourceAdapterInput): LifeSources {
  return Object.freeze({ ...input });
}
```

Import `LifeMatrixSnapshot` or factor `LifeTraits` from `types.ts` instead of duplicating the trait shape.

No callback in this interface may mutate source state.

- [ ] **Step 4: Run focused tests + typecheck**

```bash
npx vitest run tests/unit/LifeMatrixTypes.test.ts tests/unit/LifeSources.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/life/LifeSources.ts tests/unit/LifeSources.test.ts src/engine/life/types.ts
git commit -m "feat(life): add read-only Life Matrix source boundary"
```

---

### Task 3: Build deterministic immutable Life Matrix snapshots

**Files:**
- Create: `src/engine/life/LifeSnapshot.ts`
- Create: `tests/unit/LifeSnapshot.test.ts`

**Interfaces:**
- Consumes: `LifeSources`, `actorId`, `atMinute`.
- Produces: `buildLifeMatrixSnapshot(sources, actorId, atMinute): LifeMatrixSnapshot | null`.

- [ ] **Step 1: Write failing deterministic projection tests**

Create fixtures with one actor, one routine window, one agenda item, one promise, one appointment, one NPC bond, and one world event. Test:

```ts
const a = buildLifeMatrixSnapshot(sources, 'sam', 600);
const b = buildLifeMatrixSnapshot(sources, 'sam', 600);
expect(a).toEqual(b);
expect(a).not.toBe(b);
expect(a?.appointments.map((x) => x.id)).toEqual(['appt_1']);
expect(a?.agenda.map((x) => x.id)).toEqual(['agenda_1']);
expect(buildLifeMatrixSnapshot(sources, 'ghost', 600)).toBeNull();
```

Also mutate returned nested arrays/objects in a local copy where TypeScript permits test casting, then rebuild and assert the source fixture is unchanged. This proves no live references escape.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/LifeSnapshot.test.ts
```

Expected: FAIL because `buildLifeMatrixSnapshot` is missing.

- [ ] **Step 3: Implement minimal projection**

Create `src/engine/life/LifeSnapshot.ts`:

```ts
import type { LifeSources } from './LifeSources';
import type { LifeMatrixSnapshot } from './types';

export function buildLifeMatrixSnapshot(
  sources: LifeSources,
  actorId: string,
  atMinute: number,
): LifeMatrixSnapshot | null {
  const buddy = sources.getBuddy(actorId);
  if (!buddy) return null;

  const day = Math.max(1, Math.floor(atMinute / 1440) + 1);
  const minuteOfDay = ((atMinute % 1440) + 1440) % 1440;

  return {
    actorId,
    atMinute,
    day,
    minuteOfDay,
    traits: { ...sources.getTraits(actorId) },
    playerRelationship: cloneRelationship(sources.getPlayerRelationship(actorId)),
    notableNpcBonds: sources.getNpcBonds(actorId).map(cloneRelationship).filter(Boolean) as any,
    promises: sources.getPromises(actorId).map((x) => ({ ...x })),
    routineWindows: projectRoutineWindows(buddy.schedule, day),
    agenda: sources.getAgenda(actorId, day).map((x) => ({ ...x })),
    appointments: sources.getAppointments()
      .filter((x) => x.characterId === actorId)
      .map((x) => ({ ...x })),
    worldEvents: sources.getTriggeredEvents().map((x) => ({ ...x })),
    presence: { ...sources.getPresence(actorId) },
    pressure: {},
  };
}
```

Implement typed helper functions without `any` in production code. `projectRoutineWindows` must translate the actor's existing schedule blocks for the requested day/week key without changing their semantics. Preserve current weekly/day fallback behavior used by SocialEngine; do not invent flexible windows yet.

- [ ] **Step 4: Prove deterministic deep-copy behavior**

```bash
npx vitest run tests/unit/LifeSnapshot.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/life/LifeSnapshot.ts tests/unit/LifeSnapshot.test.ts
git commit -m "feat(life): project deterministic character life snapshots"
```

---

### Task 4: Adapt the real Away authorities without changing them

**Files:**
- Modify only if needed for read access: `src/engine/SocialEngine.ts`
- Create: `tests/integration/LifeMatrixCompatibility.test.ts`
- Create or extend: `src/engine/life/LifeSources.ts`

**Interfaces:**
- Consumes: `SocialEngine`, `WorldEventsEngine`, canonical world appointment state.
- Produces: `createSimulationLifeSources(sim): LifeSources` or an equivalent factory that is imported by SimulationEngineCore, not by UI code.

- [ ] **Step 1: Write a failing integration test against a real `SimulationEngine`**

The test must prove existing social truth is reflected, not re-created:

```ts
import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationLifeSources } from '../../src/engine/life/LifeSources';
import { buildLifeMatrixSnapshot } from '../../src/engine/life/LifeSnapshot';

describe('Life Matrix compatibility with existing Away authorities', () => {
  it('reads existing relationship, agenda, presence and world state without mutating it', () => {
    const sim = new SimulationEngine();
    const before = sim.exportSnapshot();
    const buddy = sim.social.getBuddies()[0]!;
    const sources = createSimulationLifeSources(sim);
    const life = buildLifeMatrixSnapshot(sources, buddy.id, sim.clock.getTotalMinutes());

    expect(life?.actorId).toBe(buddy.id);
    expect(life?.traits).toEqual(sim.social.getTraits(buddy.id));
    expect(sim.exportSnapshot()).toEqual(before);
  });
});
```

Add assertions mapping one existing promise/agenda/appointment if the fixture already provides one; otherwise create it using public existing APIs before capturing `before`.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/LifeMatrixCompatibility.test.ts
```

Expected: FAIL because the simulation adapter factory is missing.

- [ ] **Step 3: Implement the adapter using existing public reads**

Prefer current methods already present in SocialEngine/WorldEventsEngine. If one required read is missing, add the smallest read-only accessor returning a defensive copy. Do not add mutation methods or move existing state.

The adapter should map:

```text
SocialEngine.getBuddy/getBuddies
SocialEngine.getTraits
SocialEngine relationship reads
SocialEngine.getNpcBond / bounded notable-bond enumeration
SocialEngine.getOpenPromises
SocialEngine.getAgenda
SocialEngine.getPresence
WorldEventsEngine.getTriggeredEvents
world appointment state read
```

If there is no bounded NPC-bond enumeration today, add one focused accessor such as:

```ts
public getNpcBondsFrom(actorId: string): Array<{ targetId: string; bond: NpcBondState }>
```

It must return copies and must not expose the internal Map.

- [ ] **Step 4: Run compatibility + existing social suites**

```bash
npx vitest run \
  tests/integration/LifeMatrixCompatibility.test.ts \
  tests/unit/RelationshipsP4.test.ts \
  tests/unit/CharacterLivesV4.test.ts
npx tsc --noEmit
```

If the exact Character Lives filename differs, use the current repository file containing the v4 save/relationship tests inspected during planning. Do not skip the existing relationship regression coverage.

Expected: PASS with existing social behavior unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/engine/life src/engine/SocialEngine.ts tests/integration/LifeMatrixCompatibility.test.ts
git commit -m "feat(life): adapt existing Away authorities into life snapshots"
```

Only include `SocialEngine.ts` in the commit if a read-only accessor was actually necessary.

---

### Task 5: Expose the read-only snapshot through the simulation facade

**Files:**
- Create: `src/engine/life/index.ts`
- Modify: `src/engine/SimulationEngineCore.ts`
- Modify or create test: `tests/integration/LifeMatrixCompatibility.test.ts`

**Interfaces:**
- Produces: `SimulationEngineCore.getLifeSnapshot(actorId: string): LifeMatrixSnapshot | null`.
- Consumes: current authoritative clock + source adapter factory.

- [ ] **Step 1: Write a failing facade test**

Add:

```ts
it('exposes a read-only life snapshot at the authoritative clock minute', () => {
  const sim = new SimulationEngine();
  const buddy = sim.social.getBuddies()[0]!;
  const life = sim.getLifeSnapshot(buddy.id);

  expect(life?.actorId).toBe(buddy.id);
  expect(life?.atMinute).toBe(sim.clock.getTotalMinutes());
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/LifeMatrixCompatibility.test.ts
```

Expected: FAIL because `getLifeSnapshot` does not exist.

- [ ] **Step 3: Implement the facade with no tick changes**

In `SimulationEngineCore.ts`, construct the adapter on demand and return the pure snapshot:

```ts
public getLifeSnapshot(actorId: string): LifeMatrixSnapshot | null {
  return buildLifeMatrixSnapshot(
    createSimulationLifeSources(this),
    actorId,
    this.clock.getTotalMinutes(),
  );
}
```

Do not add calls from `advanceRealTime`, `advanceGameMinutes`, `processCharacterLivesDaily`, `updatePresence`, or appointment/job/event handlers in this task.

Create `src/engine/life/index.ts` exporting only the semantic types and public pure functions needed by engine/tests.

- [ ] **Step 4: Run focused and broad verification**

```bash
npx vitest run tests/integration/LifeMatrixCompatibility.test.ts
npx vitest run tests/unit/LifeMatrixTypes.test.ts tests/unit/LifeSources.test.ts tests/unit/LifeSnapshot.test.ts
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/life src/engine/SimulationEngineCore.ts tests/integration/LifeMatrixCompatibility.test.ts
git commit -m "feat(life): expose read-only Life Matrix snapshots"
```

---

### Task 6: Prove the foundation causes zero simulation behavior drift

**Files:**
- Modify: `tests/integration/LifeMatrixCompatibility.test.ts`
- No production changes unless the test exposes a real adapter bug.

**Interfaces:**
- Proves: projection is observational only and survives ordinary time advancement/save snapshot reads without changing outcomes.

- [ ] **Step 1: Add a before/after equivalence test**

Create two fresh engines from the same initial state. On engine A, repeatedly call `getLifeSnapshot()` around time advancement. On engine B, never call Life Matrix APIs. Advance both through the same deterministic sequence, then compare exported snapshots:

```ts
const a = new SimulationEngine();
const b = new SimulationEngine();
const actorId = a.social.getBuddies()[0]!.id;

for (const minutes of [30, 90, 240, 1440]) {
  a.getLifeSnapshot(actorId);
  a.advanceGameMinutes(minutes, 'life compatibility test');
  a.getLifeSnapshot(actorId);

  b.advanceGameMinutes(minutes, 'life compatibility test');
}

expect(a.exportSnapshot()).toEqual(b.exportSnapshot());
```

If existing procedural async generation makes the exact whole-snapshot comparison unstable, disable only that existing source through a documented test fixture or compare all authoritative synchronous roots explicitly. Do not weaken the assertion to a shallow smoke test.

- [ ] **Step 2: Run the equivalence test**

```bash
npx vitest run tests/integration/LifeMatrixCompatibility.test.ts
```

Expected: PASS. A failure means the projection leaks mutation and must be fixed before proceeding.

- [ ] **Step 3: Run the repository gates**

```bash
npm run content:check
npx tsc --noEmit
npm run build
npm run test
```

Expected: zero new failures relative to the documented branch baseline.

- [ ] **Step 4: Inspect final diff for authority violations**

Verify manually that the PR contains none of:

```text
new relationship storage
new appointment storage
new world-event storage
new job storage
new travel calculation
new delivery storage
new canonical presence state
new save-version field
React/Phaser imports inside src/engine/life
AI/provider calls inside src/engine/life
```

- [ ] **Step 5: Commit verification-only adjustments if any**

If no source adjustment was needed, do not create an empty commit. If test-only changes were needed:

```bash
git add tests/integration/LifeMatrixCompatibility.test.ts
git commit -m "test(life): prove read-only compatibility with existing simulation"
```

---

## Completion Gate

Issue implementing this plan is complete only when:

- `src/engine/life/` exists as a small projection package;
- `getLifeSnapshot(actorId)` reads real Away state through narrow adapters;
- current relationships, directed bonds, affinity, traits, promises, agendas, appointments, presence, and world-event context remain owned by their existing systems;
- projection is deterministic and defensive-copy safe;
- repeatedly observing Life Matrix snapshots does not change simulation outcomes;
- no save migration is introduced;
- content check, typecheck, build, focused tests, and the repository test gate meet current project policy.

## What Comes Next — Not Part of This Plan

After this foundation merges, write separate plans/issues for:

1. source-backed `CharacterObligation` records and projections;
2. lightweight NPC pressure + bounded personal goals;
3. deterministic `CharacterIntent` selection;
4. #35/#37 departure/transit/arrival integration;
5. coherent physical/device/online presence resolution;
6. typed world-event modifiers;
7. #24 physical commerce/parcel integration;
8. late Encounter Director over truthful co-location.

Do not start these by expanding the foundation PR.
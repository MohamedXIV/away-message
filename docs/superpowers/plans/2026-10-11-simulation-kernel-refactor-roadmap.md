# Simulation Kernel Refactor Roadmap

Date: 2026-10-11

Canonical design: `docs/15-SIMULATION-KERNEL-AND-RUNTIME-BOUNDARY.md`

Semantic model: `docs/17-SEMANTIC-WORLD-AND-CHARACTER-MODEL.md`

Tracking epic: #168

## Goal

Strengthen the existing TypeScript/web architecture so Away Message can safely grow into Senior Year, larger social populations, longer chat histories and later university-scale simulation without rewriting the presentation stack.

This roadmap preserves the good pure domain logic and replaces the runtime shell around it.

## Dependency shape

```text
#169 Baseline
  ↓
#170 Remove population work from RAF
  ↓
#171 Composed SimulationKernel
  ↓
#187 Semantic world/character model
  ├──────────────────┐
  ↓                  ↓
#172 Projections   #173 Social/history split
  └──────────┬───────┘
             ↓
#174 Persistence + deterministic identity
             ↓
#175 SimulationHost + Dedicated Worker
             ↓
#176 Rust/WASM/native spike + decision
             ↓
#177 School-ready integration gate
```

Where file overlap is low, #172/#173 preparation may proceed in parallel after #171 establishes the target ownership boundary.

---

## P0 — measure and stop obviously unnecessary work

### #169 — Baseline

Capture deterministic 20/100/250/500 actor fixtures.

Measure:
- zero-minute realtime call;
- one game-minute advancement;
- coarse jumps;
- intent/Life Matrix;
- NPC mobility;
- state publication;
- social/history snapshot growth;
- save/export cost.

Do not optimize the fixture while measuring it.

### #170 — RAF decoupling

The first behavioral refactor.

Normal RAF frames with no elapsed simulation minute must not run population-wide life/mobility work.

Preserve existing transit commitments and coarse-jump determinism.

This issue should produce the first direct before/after benchmark win.

---

## P1 — rebuild the runtime shell, not the game rules

### #171 — Composition-first kernel

Replace historical inheritance growth with a composed kernel and explicit domain ownership.

Do not rewrite pure subsystems merely to move files.

Temporary compatibility facades are allowed only with named deletion conditions.

### #187 — Semantic world/character model

Establish the typed meaning layer over canonical domain truth before UI/Ink/Worker consumers hard-code another generation of engine internals.

Required separations include:
- actor lifecycle/contact state vs derived relationship stage;
- world fact vs actor knowledge vs claim/rumor vs player knowledge;
- structured semantic memory vs prose presentation;
- canonical state vs derived semantics;
- meaningful fidelity tiers for local/background/remote actors.

Use small typed TypeScript contracts for semantic context, pure queries, validated commands/effects, typed influences and semantic events **only where real consumers need them**.

Do not build a general-purpose scripting language, GOAP planner or universal ModifierEngine.

### #172 — Bounded publication

Replace giant normal state publication with:
- revision;
- changed domains/events;
- bounded query/projection models.

Full snapshots become explicit persistence/debug operations.

The contract must be serializable for a Worker.

### #173 — Social decomposition / cold chat history

Split responsibilities without splitting social authority.

Keep sparse NPC bonds.

Move old transcript bodies/photos/attachments out of normal hot-world publication and support paged conversation reads.

### #174 — Persistence / deterministic identity cleanup

Use the pre-freeze policy now.

Reconcile the current slot API and remove obsolete live compatibility paths where safe.

Replace wall-clock/random IDs in canonical simulation records where they harm deterministic replay/testing.

---

## P2 — execution isolation

### #175 — SimulationHost + Dedicated Worker

Introduce the stable host/client contract.

Browser production architecture:

```text
main thread
React + Phaser + CharacterRenderer + Audio
            ↕
       SimulationHost
            ↕
Dedicated Worker
            ↓
TypeScript SimulationKernel
```

Use one canonical worker writer.

No SharedArrayBuffer requirement.

No worker-per-domain architecture.

---

## P3 — Rust decision, not Rust enthusiasm

### #176 — Spike

Only after TS Worker measurements exist.

Benchmark a minimal equivalent Rust kernel slice through:
- Rust/WASM Worker;
- native Rust reference where useful.

Compare performance **and**:
- serialization cost;
- browser packaging;
- debugging;
- test ergonomics;
- build complexity.

Choose and record one explicit architecture decision.

A result of "stay TypeScript" is a successful spike.

---

## Gate

### #177 — School-ready runtime

Re-run the scale suite and prove:
- no render-frame-driven population simulation;
- one canonical writer;
- composition-first ownership;
- semantic truth/knowledge/memory/relationship boundaries from #187;
- fidelity-aware character simulation with no remote physical work;
- bounded UI projections;
- chat history not hot snapshot baggage;
- clean current persistence;
- Worker-hosted browser simulation;
- Rust decision captured;
- tiny generic class/exam-style scheduling fixtures coexist with work/appointments/transit.

Do not start full Senior Year implementation inside this gate.

---

## Verification policy

Every implementation issue must preserve the repository's normal checks:

```text
npm run content:check   # when relevant
npx tsc --noEmit
npm run build
npm run test
node scripts/verify-vitest-baseline.mjs --self-test
node scripts/verify-vitest-baseline.mjs
```

Add focused deterministic tests for the changed architecture before broad cleanup.

Performance tests should record measurements rather than use fragile wall-clock CI assertions unless a stable regression threshold can be justified.

---

## Migration strategy

Prefer strangler-style replacement:

```text
old facade
   ↓
new kernel boundary underneath
   ↓
move one owner/path at a time
   ↓
delete compatibility seam
```

Avoid a long-lived second simulation engine.

Do not let old and new systems both own the same state.

---

## Relationship to Production Phase A

Production Phase A remains the canonical first real art/playable-slice plan.

This refactor is a newer explicit user-approved technical prerequisite for larger life-sim expansion.

Do not discard completed Production Phase A work or reopen presentation architecture without evidence.

Where possible:
- keep art/content lanes independent;
- avoid changing Phaser contracts unless the new bounded projection seam requires it;
- resume/continue production work after the simulation refactor gate without another engine redesign.

---

## Exit

When #177 closes, the project should be ready to create the Senior Year / Education epic on top of:
- generic obligations/scheduler;
- semantic context/query/command boundaries;
- structured knowledge/memory and derived relationship semantics;
- fidelity-aware character simulation;
- scalable social state;
- bounded history;
- worker-isolated simulation;
- a measured Rust decision.

The next architecture question should then be driven by actual Education gameplay needs or measured scale limits, not speculative engine anxiety.

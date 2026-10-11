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

#### Recorded pre-refactor evidence (2026-10-11)

Measured on PR #189 head `59a3f84acdd173775be49f22cf3dc4d3cb991e5a` with Node `v22.23.3` on Linux `6.18.44`, x64, AMD EPYC 9V74 80-Core Processor (3 CPUs reported by the VM). The runner used 7 samples and 2 warmups by default; 60-minute advancement and `exportSnapshot()` used 3 samples and 1 warmup. Times are median / nearest-rank p95 in milliseconds. With these sample counts, p95 is the maximum sample.

| Actors | Local / remote | Zero-minute realtime | +1 game minute | +60 game minutes | All-actor intent pass |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 16 / 4 | 0.981 / 1.082 | 1.735 / 2.411 | 1.788 / 1.890 | 0.700 / 2.461 |
| 100 | 76 / 24 | 5.178 / 7.109 | 10.043 / 13.523 | 10.949 / 11.193 | 4.382 / 4.982 |
| 250 | 189 / 61 | 22.330 / 32.991 | 47.556 / 63.298 | 45.232 / 45.726 | 19.978 / 34.322 |
| 500 | 376 / 124 | 76.524 / 77.753 | 164.223 / 180.296 | 174.225 / 195.385 | 72.924 / 76.329 |

| Actors | Cold `getState()` | Cached `getState()` | `SocialEngine.getState()` | `exportSnapshot()` | Serialized snapshot bytes | Heap used after setup bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 0.367 / 0.686 | 0.017 / 0.042 | 0.084 / 0.085 | 1.630 / 1.671 | 106,943 | 22,258,288 |
| 100 | 0.521 / 1.347 | 0.012 / 0.015 | 0.249 / 0.318 | 8.241 / 9.579 | 570,609 | 29,375,976 |
| 250 | 1.592 / 2.678 | 0.012 / 0.014 | 0.719 / 0.904 | 20.065 / 20.228 | 1,440,843 | 33,234,672 |
| 500 | 5.883 / 11.164 | 0.012 / 0.013 | 1.407 / 2.127 | 41.758 / 45.480 | 2,891,299 | 96,102,616 |

| Messages | `SocialEngine.getState()` median / p95 ms | Serialized social snapshot bytes |
| ---: | ---: | ---: |
| 0 | 0.042 / 0.081 | 70,746 |
| 100 | 0.046 / 0.069 | 97,036 |
| 1,000 | 0.121 / 0.127 | 334,206 |
| 5,000 | 0.175 / 2.537 | 1,390,086 |

Interpretation: a single zero-minute realtime call rises from 0.981 ms at 20 actors to 76.524 ms at 500; the 500-actor intent pass is 72.924 ms. Cold state construction and export also grow with population, while cached `getState()` stays near 0.012 ms at 100–500 actors. At 5,000 messages the serialized social snapshot is about 1.39 MB. These results support the RAF population-work, Life Matrix scaling, broad snapshot, history-growth, and export-cost risks above.

Caveats: pressure and NPC mobility planning/progression are included in the realtime and game-minute totals, not isolated as separate timings. Heap used is the process's absolute reading after fixture setup, not a per-fixture allocation delta; it varied across repeat runs. A second run on the same VM produced identical serialized sizes and similar 500-actor medians (zero-minute 77.234 ms, +1 minute 162.303 ms, +60 minutes 170.525 ms), but tail samples and heap readings varied, so the first run is the recorded baseline and values are comparative rather than publication-grade. No production simulation optimization was included.

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

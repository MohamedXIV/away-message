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

Measured on PR #189 code head `d3cca57f68e63b0d9cb46c1ce33934f3a8380316` with Node `v22.23.3` on Linux `6.18.44`, x64, AMD EPYC 9V74 80-Core Processor (3 CPUs reported by the VM). The runner used the default 7 samples and 2 warmups; 60-minute advancement and `exportSnapshot()` used 3 samples and 1 warmup. Times are median / nearest-rank p95 in milliseconds. At these sample counts p95 is the maximum sample. The total roster includes authored seed actors; mobility samples cover the local actors only.

| Actors | Local / remote | Zero-minute realtime | +1 game minute | +60 game minutes | All-actor intent pass | NPC mobility planning | NPC mobility progression |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 16 / 4 | 0.852 / 3.784 | 2.023 / 4.290 | 1.845 / 1.983 | 0.588 / 2.057 | 0.343 / 0.863 | 0.096 / 0.113 |
| 100 | 76 / 24 | 6.988 / 8.991 | 11.044 / 12.362 | 9.529 / 10.389 | 6.232 / 7.599 | 1.684 / 3.021 | 0.479 / 0.669 |
| 250 | 189 / 61 | 25.928 / 36.981 | 51.435 / 61.498 | 50.267 / 50.654 | 20.988 / 24.113 | 2.743 / 6.170 | 1.113 / 2.007 |
| 500 | 376 / 124 | 84.569 / 89.131 | 178.687 / 185.847 | 169.787 / 175.859 | 82.663 / 93.123 | 4.687 / 5.267 | 2.807 / 3.628 |

| Actors | Cold `getState()` | Cached `getState()` | `SocialEngine.getState()` | `exportSnapshot()` | Serialized snapshot bytes | Heap used after setup bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 0.341 / 0.558 | 0.017 / 0.080 | 0.089 / 0.166 | 1.927 / 1.951 | 106,943 | 17,968,192 |
| 100 | 0.562 / 1.012 | 0.012 / 0.016 | 0.255 / 0.811 | 8.468 / 9.423 | 570,609 | 32,462,520 |
| 250 | 1.822 / 2.837 | 0.011 / 0.013 | 0.845 / 1.442 | 21.268 / 22.001 | 1,440,843 | 27,226,840 |
| 500 | 6.839 / 10.496 | 0.011 / 0.014 | 1.559 / 2.017 | 48.181 / 67.379 | 2,891,299 | 65,163,072 |

| Messages | `SocialEngine.getState()` median / p95 ms | Serialized social snapshot bytes |
| ---: | ---: | ---: |
| 0 | 0.043 / 0.068 | 70,746 |
| 100 | 0.047 / 0.051 | 97,036 |
| 1,000 | 0.093 / 0.113 | 334,206 |
| 5,000 | 0.223 / 1.850 | 1,390,086 |

Interpretation: the zero-minute realtime median grows from 0.852 ms at 20 actors to 84.569 ms at 500, and the all-actor intent pass reaches 82.663 ms at 500. This supports the RAF population-work and Life Matrix scaling risks. Cold state construction and export grow with roster size while cached `getState()` stays near 0.011–0.017 ms. Isolated mobility planning and progression also scale with local actors. At 5,000 messages the serialized social snapshot is about 1.39 MB, supporting the history-growth risk. Export reaches 48.181 ms at 500, supporting the serialization-cost risk.

Two runs on the same VM had identical serialized sizes. At 500 actors, repeat medians were similar: zero-minute realtime 84.569 / 86.802 ms; +1 minute 178.687 / 177.826 ms; +60 minutes 169.787 / 179.147 ms; intent pass 82.663 / 81.692 ms; mobility planning 4.687 / 4.100 ms; mobility progression 2.807 / 2.343 ms; cold state 6.839 / 7.857 ms; export 48.181 / 47.529 ms. Heap readings varied (65.2 MB / 77.4 MB at 500 actors) and tail samples sometimes varied, so the first run is the recorded baseline and these results are comparative rather than publication-grade.

Caveats: isolated mobility timings use deterministic synthetic route-backed intents for local actors and measure pure planning/progression separately; fixture construction and state cloning are outside each timed region. Realtime/game-minute timings include current engine work, including pressure and mobility. Heap used is the process's absolute reading after setup, not a per-fixture allocation delta. No production simulation optimization was included.

### #170 — RAF decoupling

The first behavioral refactor.

Normal RAF frames with no elapsed simulation minute must not run population-wide life/mobility work.

Preserve existing transit commitments and coarse-jump determinism.

#### Recorded before/after evidence (2026-10-11)

Compared #169 measured code head `d3cca57f68e63b0d9cb46c1ce33934f3a8380316` with #170 measured code head `4331939457f720158fd52f10c03417b886626501`. Both runs used Node `v22.23.3` on Linux `6.18.44`, x64, AMD EPYC 9V74 80-Core Processor (3 CPUs reported). Benchmark configuration was unchanged: 7 samples / 2 warmups, median / nearest-rank p95 in milliseconds. With seven samples, p95 is the maximum sample.

| Actors | Local / remote | #169 zero-minute realtime | #170 zero-minute realtime | Median reduction |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 16 / 4 | 0.852 / 3.784 | 0.006 / 0.148 | 99.30% |
| 100 | 76 / 24 | 6.988 / 8.991 | 0.008 / 0.206 | 99.89% |
| 250 | 189 / 61 | 25.928 / 36.981 | 0.009 / 0.009 | 99.97% |
| 500 | 376 / 124 | 84.569 / 89.131 | 0.009 / 0.010 | 99.99% |

A second run on the #170 code head returned zero-minute medians / p95 of 0.007 / 0.090, 0.004 / 0.005, 0.008 / 0.008, and 0.009 / 0.010 ms at 20 / 100 / 250 / 500 actors. The 500-actor median fell from 84.569 ms to 0.009 ms, a 99.99% reduction. The sub-millisecond tails varied between runs, while the 500-actor result repeated exactly. These measurements show the RAF path now avoids the population-wide pressure and mobility passes.

At 500 actors, the separate +1 minute and +60 minute medians were 157.253 ms and 160.862 ms after the change (178.687 ms and 169.787 ms in #169); the all-actor intent pass was 75.864 ms (82.663 ms in #169). The absolute snapshot sizes and conversation serialization sizes matched the #169 run. The local/remote partitions, synthetic mobility fixture and benchmark setup were unchanged. Mobility planning/progression logic itself was not modified; the new regression test confirms equivalent NPC state and one boundary pass across different realtime chunk sizes.

Caveats: the same Node/VM and default sample configuration were used, but these remain comparative microbenchmarks. The recorded p95 is the maximum of seven samples, and the near-zero RAF path is sensitive to sub-millisecond scheduling noise. No Rust, workers, Life Matrix rules, transit rules, pressure logic, or NPC mobility logic were changed; this issue changes only when existing NPC passes run.

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

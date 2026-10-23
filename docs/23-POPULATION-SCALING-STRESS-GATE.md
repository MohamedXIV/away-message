# Population Scaling and Deterministic Stress Gate

Status: **Implemented population-scaling evidence for #177; #177 remains open.**

Date: 2026-10-21

Tracking: Epic #168, gate #177. This work is independent of the #175 Dedicated Worker migration and does not modify its branch or PR.

Canonical context:
- `docs/15-SIMULATION-KERNEL-AND-RUNTIME-BOUNDARY.md`
- `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md`
- `docs/superpowers/plans/2026-10-11-simulation-kernel-refactor-roadmap.md`

## 1. Scope

This slice proves that the canonical composed simulation can be exercised at **20, 100, 250 and 500 NPCs** with:

- verified population materialization;
- repeatable fixtures from an explicit seed;
- real scheduled NPC work and route-backed travel;
- deterministic snapshots across identical runs;
- bounded presentation projections;
- current-format persistence round-trips;
- measured scaling without brittle wall-clock CI thresholds.

It is not the complete #177 gate. Worker-hosted browser acceptance, the Rust decision and generic class/exam scheduling fixtures remain owned by #175, #176 and the wider #177 integration work. No production simulation optimization was performed in this change.

| #177 gate area | This change |
| --- | --- |
| Deterministic 20/100/250/500 actor fixtures | Covered |
| Zero-minute RAF does not wake population work | Covered |
| Normal and multi-day scheduled simulation | Covered |
| Deterministic digests and current-format round-trip | Covered |
| Bounded presentation projections / read purity | Covered |
| Worker-hosted browser simulation | Not covered; #175 |
| Rust/WASM decision | Not covered; #176 |
| Generic class/exam scheduling fixture | Not covered; wider #177 |

## 2. Fixture model

Implementation: `src/engine/benchmark/PopulationScaleGate.ts`, built on the existing canonical benchmark factory in `src/engine/benchmark/SimulationBenchmarkFixture.ts`.

For each tier:

1. A fresh `SimulationEngine` (the composed `SimulationKernel` public alias) starts with the authored seed roster.
2. Additional actors are created through `buildCharacter` and registered through `SocialEngine.registerBuddy`. IDs remain `bench_####`; no legacy character name is required or protected.
3. The seed `away-177-population-v1` deterministically varies generated archetype, reach, `metVia` and initial relationship dimensions. The requested total count is asserted after materialization.
4. Every local actor is placed at a canonical authored entry position through `relocateActorToGeneratedPlaceEntry`.
5. Every local actor receives a same-day agenda block through `SocialEngine.setAgenda`.
6. Every tenth local actor receives a same-day appointment through `WorldEventsEngine.scheduleAppointment`, selecting a destination reachable from that actor's origin through the real `TravelPlanner`.
7. Up to 24 local and 8 remote actors are learned through `SocialEngine.learnHandle`.
8. Six bounded messages per known contact are written through `SocialEngine.sendMessage`.

At 500 actors the fixture contains 377 local and 123 remote actors, 377 agenda entries, 38 route-backed appointments and 192 seeded messages. All operations use supported owner APIs. No trip, pressure, relationship or message record is injected directly.

### Content limitations

- Generated transit content currently exposes exactly one route pair with authored entry positions: `place_a1 -> place_b1` (37 minutes). The fixture records and uses the actual routes returned by `planTravel`; it does not invent destinations. When content grows, local actors are distributed across all discovered route origins.
- Destination-bearing NPC obligations currently come from player appointments/jobs. There is no separate public NPC-only job scheduler. The fixture therefore describes a bounded share of local actors as having same-day plans with the player. The synthetic player does not attend, so multi-day appointment resolution mostly records `missed`; NPC travel still happens and remains canonical. This is expected fixture behavior, not a correctness failure.
- Twenty-five percent remote reach is approximate because it is a per-actor deterministic hash. The tier prints the actual counts.
- The fixture uses the four authored seed actors already present in a fresh engine. Generated actors are full canonical `BuddyCharacter` definitions with schedules, traits and relationships, not inert placeholder objects.

## 3. Workloads

Runner: `tools/benchmark-population-scale.ts` (`npm run bench:population`).

### A. Idle baseline

- Starts from a prepared snapshot.
- Measures one `advanceRealTime(1/60)` frame and a 30-frame burst on fresh engines.
- Asserts the authoritative clock does not move, the publication revision does not change, and the canonical digest is unchanged.

### B. Normal world advancement

- One warm minute stabilizes persisted Life entries; the cold first minute is measured separately.
- Measures three consecutive one-minute ticks from the same prepared snapshot, per tick and per sample total.
- Verifies the clock advanced exactly, population stayed exact, agenda work is present, appointment actors selected travel intents, route-backed trips were created, and remote actors acquired no local trip or XYZ state.
- Replays the same warm snapshot twice and asserts identical canonical digests at every tier.

### C. Extended simulation

- Advances three full days in 1,440-minute jumps from a warm snapshot.
- Uses identical chunking within and across compared runs.
- Reports per-day jump distribution, first-to-last day trend, message/agenda/trip counts, appointment resolution, snapshot size and process heap observations.
- Asserts population stability, no remote physical work and bounded projections.
- Late MyPlace async profile completions are flushed outside timed regions before cross-run comparison.

### D. Semantic read pressure

- Bounded presentation reads: HUD, world, chrome, presence, situation, messenger, Pulse contacts, conversation page, selected actor.
- Targeted Life/relationship/actor reads for up to 32 known contacts.
- An all-local-actor `getCharacterIntent` pass.
- Asserts every read leaves the canonical digest unchanged and all projection counts respect their caps.

### E. Persistence

- Measures synchronous and asynchronous full snapshot export separately from gameplay.
- Restores a fresh engine through the constructor and compares canonical digests.
- Reports serialized snapshot size independently.

## 4. Determinism definition

`populationScaleDigest()` computes SHA-256 over the exported snapshot after recursively sorting object keys. It excludes only `telemetry`, which contains wall-clock timestamps (`Date.now()`, `realTimestampMs`, session start time and play-time) and is observation metadata rather than simulation truth.

All simulation domains remain in the digest: player/needs/mood, Social, World, environment, Life, mobility, spatial positions, physical/venue/residence/scenario state and conversations.

Same-seed run order is identical because generated actor properties, messages, agenda IDs and appointment IDs are deterministic. Message IDs and world-time timestamps are canonical.

### Known core divergence: coarse jumps versus minute ticks

A coarse `advanceGameMinutes(30)` is **not** state-equivalent to 30 consecutive `advanceGameMinutes(1)` calls at the current head. The observed divergence includes:

- `player` and `needs` snapshots;
- Life pressure mood (`cheerful` versus `content` in a 100-actor reproduction);
- a `cumulativeWorkMinutes` field that is only materialized by the incremental path.

Minimal reproduction:

```ts
const a = createSimulationBenchmarkFixture(100).engine;
const b = createSimulationBenchmarkFixture(100).engine;
a.advanceGameMinutes(30);
for (let i = 0; i < 30; i += 1) b.advanceGameMinutes(1);
// exportSnapshot() differs in player, needs and npcLives.
```

This gate does **not** assert coarse-jump equivalence and always compares runs that use the same chunking. Fixing it belongs to the owning time/needs/Life architecture (likely an explicit fast-forward integration step or documented coarse-jump semantics), not to benchmark code. It should be decided before #177 closes because education terms will rely on long advances.

## 5. Measured results

Environment recorded in `docs/benchmarks/2026-10-21-population-scale.json`:

- Node `v24.22.0`
- Linux `6.8.0-1064-azure`, x64
- Intel Xeon Platinum 8370C, 2 vCPUs, 8.3 GB reported memory
- Base head `61fcf6607bb0a947f868d8ff66ac62220b03a2b1`; measurements include the #177 branch working tree at run time

Times are milliseconds, median / nearest-rank p95. With three samples, p95 is the maximum sample. No wall-clock value gates the run.

### Fixture composition

| Actors | Seed actors | Local / remote | Known contacts | Agendas | Appointments | Routes | Seeded messages |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 4 | 17 / 3 | 20 | 17 | 2 | 1 | 120 |
| 100 | 4 | 77 / 23 | 32 | 77 | 8 | 1 | 192 |
| 250 | 4 | 189 / 61 | 32 | 189 | 19 | 1 | 192 |
| 500 | 4 | 377 / 123 | 32 | 377 | 38 | 1 | 192 |

### A. Idle presentation frames

| Actors | Single frame | 30-frame burst | Mean per frame | Clock changed | Digest changed |
| ---: | ---: | ---: | ---: | :---: | :---: |
| 20 | 0.020 / 0.050 | 0.039 / 0.505 | 0.001 | no | no |
| 100 | 0.011 / 0.022 | 0.030 / 0.070 | 0.001 | no | no |
| 250 | 0.008 / 0.011 | 0.017 / 0.018 | 0.001 | no | no |
| 500 | 0.007 / 0.007 | 0.016 / 0.061 | 0.001 | no | no |

A render frame still updates presentation telemetry, but performs no population-wide Life or mobility work until the clock crosses a whole game minute.

### B. Normal world advancement

| Actors | Cold first minute | Steady tick p50 / p95 | 3-tick total p50 | Trips created | Agenda entries | Intent split |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 20 | 6.018 / 6.429 | 8.062 / 19.935 | 24.639 | 2 active | 17 | 2 prepare, 15 goal |
| 100 | 75.743 / 103.284 | 70.805 / 105.595 | 222.590 | 8 active | 77 | 8 prepare, 69 goal |
| 250 | 575.207 / 575.207 | 381.615 / 460.411 | 1,202.578 | 19 active | 189 | 19 prepare, 170 goal |
| 500 | 1,588.550 / 1,588.550 | 1,542.211 / 1,647.295 | 4,673.840 | 38 active | 377 | 38 prepare, 339 goal |

### C. Extended multi-day advancement

| Actors | Day jump p50 / p95 | First -> last day (first sample) | Messages | Agenda entries | Trips | Appointment outcomes | Snapshot bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 20 | 19.536 / 48.047 | 19.068 -> 20.559 (1.08x) | 133 | 12 | 2 | 2 happened | 187,148 |
| 100 | 164.658 / 180.001 | 90.678 -> 164.658 (1.82x) | 206 | 56 | 8 | 2 happened, 6 missed | 794,124 |
| 250 | 541.509 / 977.979 | 533.941 -> 977.979 (1.83x) | 206 | 133 | 19 | 2 happened, 17 missed | 1,882,297 |
| 500 | 1,979.058 / 3,633.710 | 1,979.058 -> 3,633.710 (1.84x) | 205 | 250 | 38 | 3 happened, 35 missed | 3,704,641 |

Population stayed exact at every tier. The first-to-last trend is reported, not thresholded; extended tiers have one sample. It is consistent with state accumulation and day-boundary work but is not proof of a leak. Re-run with more samples before treating it as a regression.

### D. Semantic read pressure

| Actors | Targeted actor pass | All-actor intent pass | Messenger | Pulse contacts | Conversation page | Chrome |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 5.913 | 1.974 | 0.062 | 0.022 | 0.004 | 0.125 |
| 100 | 26.698 | 31.394 | 0.099 | 0.069 | 0.003 | 0.200 |
| 250 | 68.471 | 241.175 | 0.058 | 0.125 | 0.003 | 0.087 |
| 500 | 128.499 | 917.060 | 0.119 | 0.066 | 0.002 | 0.183 |

Projection payloads stay bounded from 100 through 500 actors:

- messenger read: 32 contacts, 6,191-6,192 bytes;
- Pulse contacts: 34 entries, 5,344-5,345 bytes;
- conversation page: 7 messages, 1,775-1,776 bytes;
- HUD/world/chrome/presence/situation payloads: under 2.2 KB each.

All reads left the canonical digest unchanged.

### E. Persistence

| Actors | Export sync | Export async | Restore constructor | Snapshot bytes |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 1.791 / 1.813 | 2.310 | 1.795 | 147,969 |
| 100 | 8.421 / 8.921 | 6.613 | 5.212 | 657,906 |
| 250 | 17.111 / 17.746 | 28.842 | 8.730 | 1,570,901 |
| 500 | 42.089 / 42.089 | 33.943 | 20.195 | 3,105,903 |

Every exported snapshot restored to the identical canonical digest.

### Scaling summary

| Actors | Tick p50 vs 20 | Tick p50 vs previous tier | Tick p50 per local actor | Export p50 vs 20 |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 1.00x | - | 0.474 | 1.00x |
| 100 | 8.78x | 8.78x | 0.920 | 4.70x |
| 250 | 47.34x | 5.39x | 2.019 | 9.55x |
| 500 | 191.29x | 4.04x | 4.091 | 23.50x |

The measured tick cost grows much faster than population. The all-actor intent pass grows from about 2 ms at 20 actors to about 917 ms at 500, roughly quadratic (464x for 25x actors).

### Repeatability check

A second full run on the same head and host also passed all 52 checks. Key medians:

| Actors | Tick p50 | Day-jump p50 | Export p50 | All-actor intent p50 | First->last day trend |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 9.469 | 13.658 | 1.892 | 1.873 | 1.93x |
| 100 | 96.638 | 166.577 | 8.567 | 30.730 | 2.40x |
| 250 | 367.028 | 451.574 | 20.827 | 186.006 | 2.07x |
| 500 | 1,366.349 | 2,411.971 | 39.552 | 874.213 | 1.37x |

Tick, export and all-actor intent results stay in the same range (roughly 10-35% run-to-run movement, with the noisiest small absolute values at 20 actors). The first-to-last day trend is not stable across runs (1.37x-2.40x), so it is reported as observed behavior only. This is why no wall-clock threshold gates the suite.

Despite timing noise, the canonical normal, extended multi-day and restored snapshots produced **byte-identical digests across both separate processes at all four tiers**. Setup also reproduces identically from the same seed. The committed JSON is the first run; this second run was a local repeatability check and is not committed separately.

## 6. Findings and proposed follow-up

1. **All-actor Life reads dominate tick cost.** Each whole-minute boundary performs `primeNpcMobility` (intent reads for local actors) and then `progressNpcMobility` (intent reads again), while `getLifeSnapshot` builds bonds by scanning the full roster. This produces the superlinear normal-tick scaling. Owner-side options include a Social bond adjacency index, a per-minute Life snapshot cache, or only reading intents for actors with due obligations. This gate does not change production behavior.
2. **Coarse-jump semantics are not equivalent to repeated ticks.** Documented above with a minimal reproduction; resolve before education-scale time skips depend on it.
3. **Presentation reads are bounded and side-effect free**, and zero-minute frames do not wake population work. These #170/#172 invariants hold at 500 actors.
4. **Transit and appointment fixture content is thin.** Only one route pair exists; player appointments are the current supported destination-bearing obligation. Expand authored transit and NPC-owned obligations before treating mobility timings as representative of a full town.
5. **Persistence is not the problem at these sizes.** Export remains tens of milliseconds and snapshot size is roughly linear.

## 7. Reproduction

```bash
npm ci
npm run bench:population
```

Write machine-readable output:

```bash
POP_SCALE_OUTPUT=docs/benchmarks/2026-10-21-population-scale.json npm run bench:population
```

Fast smoke profile:

```bash
POP_SCALE_SAMPLES=1 POP_SCALE_WARMUPS=0 POP_SCALE_TICKS=1 POP_SCALE_DAYS=1 \
  npx tsx tools/benchmark-population-scale.ts
```

Targeted correctness tests:

```bash
npx vitest run tests/integration/PopulationScale.test.ts
```

Environment overrides:

| Variable | Default | Meaning |
| --- | ---: | --- |
| `POP_SCALE_SAMPLES` | per-tier plan | Override sample count for all workloads |
| `POP_SCALE_WARMUPS` | per-tier plan | Override warmups |
| `POP_SCALE_TICKS` | 3 | Measured normal ticks per sample |
| `POP_SCALE_DAYS` | 3 | Multi-day jump count |
| `POP_SCALE_IDLE_FRAMES` | 30 | Sub-minute frames in one burst (capped at 59) |
| `POP_SCALE_OUTPUT` | unset | Write JSON results to this path |

The runner exits non-zero only when a correctness check fails. It never fails because a wall-clock threshold changed.

## 8. #175 Worker integration note

The fixtures and workloads are headless and depend only on the public simulation surface: construct/load, `advanceRealTime`, `advanceGameMinutes`, owner reads, snapshot export/restore and canonical digests. They do not import React, Phaser, desktop UI, Worker code or PR #204.

After #175 lands:

1. Reuse the same seed, populations, tick counts and day counts.
2. Route fixture setup through the `SimulationHost` command/query contract instead of direct engine calls. The operations to translate are: register generated definitions, relocate actors to authored origins, set agendas, schedule appointments, learn handles and seed messages.
3. Run the same A-E workloads, but report transport round-trip time separately from kernel time.
4. Compare canonical digests and bounded projection sizes against the direct-engine evidence in this report. Worker serialization must not alter simulation truth.
5. Keep the Worker benchmark opt-in and avoid adding wall-clock thresholds to normal CI.

No changes to `feat/175-single-worker-simulation-host` or PR #204 are part of this work.

## 9. Files

- `src/engine/benchmark/SimulationBenchmarkFixture.ts` — optional deterministic actor seed policy.
- `src/engine/benchmark/PopulationScaleGate.ts` — fixture adapter, digest, async flush and metrics.
- `tests/integration/PopulationScale.test.ts` — seven correctness tests across all tiers.
- `tools/benchmark-population-scale.ts` — A-E runner and correctness gate.
- `docs/benchmarks/2026-10-21-population-scale.json` — machine-readable measured results.
- `package.json` — `bench:population` script.

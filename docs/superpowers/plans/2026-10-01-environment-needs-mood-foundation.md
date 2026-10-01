# Environment / Needs / Mood Foundation Roadmap

Date: 2026-10-01

Canonical design: `docs/12-ENVIRONMENT-PLAYER-NEEDS-AND-MOOD.md`

Tracking epic: #128

Implementation issues: #129, #130, #131, #132

Final living-world gate: #29

## Baseline

Start from clean `main` established before implementation:

```text
16afe931b45a702ea9ca8fecdaca44b240cdc2fa
```

At this baseline:

- PR #115 / #36 is merged/closed;
- PR #117 / #28 is merged/closed;
- no feature PR is open;
- final Verify #1040 is green;
- 213/213 Vitest files pass;
- 1428/1428 tests pass;
- obsolete #25 Inochi hookset CI probe has been removed;
- the old Residence implementation branch contains zero unique commits.

Live GitHub state overrides this SHA if `main` advances.

## Goal

Move Away Message from incremental, overlapping ownership toward four explicit contracts:

```text
Environment authority
Player Needs authority
Mood authority
Stable Game Context read API
```

Do this before expanding more apps, world interactions, or Life Matrix behavior that would otherwise bind to legacy state.

## Dependency graph

```text
#129 Environment ─────────────┐
                              ├──> #131 Mood ──────┐
#130 Player Needs ────────────┘                   │
                                                  ├──> #132 Game Context + migration
#129 Environment ─────────────────────────────────┘
#130 Player Needs ────────────────────────────────┘
                                                        │
                                                        ▼
                                                       #29
```

#129 and #130 may proceed independently when branch coordination is safe.

#131 requires stable read seams from Environment and Needs.

#132 is the integration/migration slice and should happen after all three owners exist.

## Phase A — #129 EnvironmentEngine

Primary outcomes:

- establish one canonical Environment snapshot;
- keep deterministic base weather as a pure internal provider;
- extend WorldEvents modifiers with typed environment effects;
- add deterministic modifier precedence/caps/provenance;
- add current/at/forecast query capabilities;
- expose semantic change events;
- add a renderer adapter but do not migrate every consumer yet.

Do not:

- put weather truth in Phaser;
- add real-world weather service dependencies;
- let world events mutate weather state directly;
- add Mood behavior here beyond seams needed for future reads.

Exit condition:

Environment is authoritative and independently testable.

## Phase B — #130 PlayerNeedsEngine

Primary outcomes:

- establish Player Needs state/engine;
- migrate canonical energy/fatigue/hunger/health/sleep-debt/social-battery ownership;
- narrow Economy toward financial responsibility;
- orchestrate cross-domain actions from Simulation rather than Finance owning body state;
- make semantic derived bands available.

Explicit exclusions:

- canonical player XYZ/location;
- Place/Space membership;
- pantry/physical item ownership;
- Mood.

Compatibility shims are temporary and must be labeled as such.

Exit condition:

new code can use Player Needs without reading body/social-resource truth from Economy.

## Phase C — #131 MoodEngine

Primary outcomes:

- persisted baseline + required transient semantic effects;
- derived contextual influences;
- deterministic decay/expiry;
- provenance/explanation;
- stable Mood bands/read snapshot;
- typed Mood change event.

Key invariant:

Contextual influences reconcile by stable identity. They never append a fresh numerical penalty/bonus every tick.

Exit condition:

Mood is useful and deterministic while remaining independent from Needs/Finance/relationships.

## Phase D — #132 Game Context + migrations

Build the stable public read facade and migrate real consumers.

Required migration order should minimize duplicate truth:

1. WeatherBuddy/software weather reads;
2. Phaser Environment presentation;
3. audio environment parameters;
4. player Needs/Mood UI;
5. Inner Voice semantic context;
6. applicable Life Matrix/world/activity consumers.

During this phase remove:

- direct consumer imports of weather implementation;
- duplicate weather classifiers where canonical semantics now exist;
- new body-state reads from Economy;
- compatibility projections with zero consumers.

Exit condition:

real game-facing systems read the new authorities through stable contracts.

## Phase E — #29 integration gate

Use #29 to prove the larger living-world architecture with the new foundation in place.

The environment/player-state proof should include:

- one world event changing environment through typed modifiers;
- one physical place observing the same environment as an app;
- consistent audio;
- Mood contextual reconciliation;
- safe Inner Voice context;
- current-format save/reload;
- large time jump/expiry;
- no legacy authority resurfacing.

## Branch / PR policy

- one canonical branch/PR per issue;
- branch from current `main`;
- do not reuse old #115/#117 branches;
- do not mix unrelated physical-world cleanup into #129–#132;
- do not weaken full-suite verification to ship a refactor;
- reconcile current `main` before Ready/merge;
- squash merge and delete branch.

## Verification

For every issue:

```bash
npm run content:check   # whenever generated content is touched
npx tsc --noEmit
npm run build
node scripts/verify-vitest-baseline.mjs --self-test
node scripts/verify-vitest-baseline.mjs
```

Add focused tests first, but exact-head full verification remains the merge gate.

Browser/manual proof is required when a slice changes visible Environment/Needs/Mood presentation rather than only headless contracts.

## Agent handoff rule

Every implementation PR must state:

- exact head SHA;
- which authority moved/changed;
- old compatibility path retained, if any;
- why it is still needed;
- which consumers remain unmigrated;
- focused tests;
- full exact-head verification;
- next dependency-ready issue.

Do not leave future agents to infer authority from the diff.

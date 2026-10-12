# Decision — Clean Simulation Replacement, Atomic Production Cutover

Status: **ACCEPTED — canonical / supersedes incremental-strangler advice for #171**

Decision date: 2026-10-12

Owner: Away Message project

Tracking: Epic #168, primary implementation #171; coordinated with #187, #172, #173, #174, #175, and final gate #177.

Related designs:
- `docs/15-SIMULATION-KERNEL-AND-RUNTIME-BOUNDARY.md`
- `docs/17-SEMANTIC-WORLD-AND-CHARACTER-MODEL.md`
- `docs/16-INK-NARRATIVE-AUTHORING-AND-GENERATIVE-INTERNET.md`
- `docs/superpowers/plans/2026-10-11-simulation-kernel-refactor-roadmap.md`

## 1. Decision in one paragraph

**Rebuild the simulation orchestration as a clean, composed, single-writer kernel and perform an atomic production cutover.** We explicitly authorize rewriting, deleting, consolidating, and reorganizing existing simulation code when necessary for coherent ownership. Do **not** preserve old architecture for its own sake. The obsolete `SimulationEngineCore -> SimulationEngineLegacyFacade -> SimulationEngine` inheritance implementation must be retired as a live production execution path **before #171 is merged/closed**. Temporary migration scaffolding is permissible **inside the implementation branch while developing**, not as an indefinite merged coexistence of old and new engines. Preserve valid gameplay rules, deterministic behavior, and domain invariants; do not preserve accidental coupling, inherited method layouts, dead aliases, or obsolete development-save migration paths merely because they existed.

This replaces the earlier recommendation to land a long-lived strangler architecture with legacy facades still operating under a new kernel. Whenever the earlier documents suggest keeping a compatibility shell **after #171**, this decision takes precedence.

## 2. Why change the plan?

The inherited engine grew across approximately 5,200 lines in three orchestration layers, making canonical state ownership and execution paths difficult to audit.

A partial refactor could yield:

```text
new SimulationKernel ↔ old SimulationEngine ↔ LegacyFacade ↔ old owners
```

That would be more complicated than the starting point. The user explicitly prioritizes **long-term code clarity and a real architectural replacement** over minimizing the size of the rewrite.

The completed #169/#170 measurements and regression tests remain the baseline:
- #169 baseline: 500-actor zero-minute realtime median 84.569 ms;
- #170 after minute-boundary gating: 0.009 ms at 500 actors;
- #170 also preserved deterministic NPC state across realtime chunk sizes.

These are measured results for the RAF path, **not** evidence that the rest of simulation is fast or that #171 will automatically speed up minute-advancement.

## 3. Scope — what can be rewritten

Approved, as needed:
- engine orchestration/inheritance and cross-domain coordination;
- overgrown Social orchestration where architectural ownership is wrong (coordinate with #173);
- old compatibility methods, duplicate authorities, runtime aliases and dead paths;
- startup/dispatch/public simulation entrypoints and their dependent call sites;
- outdated implementation-coupled tests, replacing them with behavior/contract tests.

Do **not** rewrite the entire game indiscriminately. Existing pure, correct and reusable domain logic (Life Matrix obligations/intent, NPC transit planning, spatial containment/presence, residence, environment, Scenario rules, etc.) should normally be **reused directly**. Rewriting a domain is justified when actual ownership/design defects require it, not to make every file "new."

Retain React/Vite/Phaser 4/Inochi/browser product and all existing authority rules.

## 4. Required target boundaries

```text
React / Phaser / OS / Ink (presenters, consumers)
               │
    public simulation commands / queries
               │
       composed SimulationKernel
       (one canonical writer)
               │
     explicit domain-owned services
  Clock / Scheduler / Life / Social / Knowledge
  Spatial / Transit / Residence / Physical World
  Finance / Needs / Mood / Environment / Scenario
               │
      bounded semantic projections
```

The name/location of a `SimulationHost` transport wrapper is finalized by #175; **do not create or ship a competing Worker authority in #171**. The kernel must be headless and suitable for a single-worker host later.

Architecture laws:
- exactly one authoritative owner per canonical fact;
- composition and explicit interfaces/dependencies rather than inheritance growth;
- do not replace the old monolith with a new mega-`SimulationKernel.ts`;
- group code by real responsibility/cohesion, not one file for every ten lines;
- no universal rule DSL, speculative GOAP, reflection-based engine, or global ModifierEngine;
- semantic reads/effects should support #187 without leaking mutable domain internals;
- no silent duplication of Social, Knowledge, relationships, reach, spatial/travel, or Scenario ownership;
- simulation cadence remains independent of render FPS.

## 5. Atomic cutover — what it means

One coherent, reviewable **production-facing cutover** on the canonical #171 feature branch/PR. The branch can contain several large, logical commits and internal intermediate states; the final merge must be complete and runnable.

At the point #171 is merged:

1. All production simulation constructors, dispatch paths, reads, tick/time advancement, save/export and subscriptions use the new composed implementation.
2. There is **no old engine running in parallel**, not even as a dormant fallback or "just-in-case" adapter.
3. The obsolete inheritance chain is eliminated. Delete obsolete files/classes, or replace a required public import path with a small **forwarding-only** module that delegates exclusively to the new kernel, contains no domain rules/state, and is explicitly identified as a public API alias rather than a legacy runtime. No `LegacyFacade` implementation may remain in the runtime path.
4. Existing domain authorities are connected and exercised; no unreferenced subsystem copied over for appearance.
5. Remove stale imports/exports, dead adapters, copied methods, old migration glue, unused branches and obsolete tests.
6. No two canonical state stores can independently accept or resolve the same command.
7. The old and new engines do not coexist in merged `main` merely to allow a later "cleanup issue."

**Allowed during development only:** temporary dual implementations, migration scripts and compatibility glue inside the unmerged branch to make progress. These must be removed before the merge gate.

**Allowed after cutover:** narrow stable public API exports or type aliases only if actual consumers require them, provided they have *zero independent behavior, state, ticking, or mutation* and are not a hidden legacy engine. A simple name/entrypoint compatibility alias is not permission to keep the old architecture.

Do not split the cutover into many merged PRs that leave both engines alive in `main`. Pre-cutover PRs are acceptable **only** for independently complete, production-safe preparatory pure modules/contracts that do not introduce a second authority or an orphaned half-wired runtime. If that cannot be guaranteed, keep everything on one branch until the coherent cutover.

## 6. Design #171 with #187 and #173 in mind

Before writing the kernel, map the domain-ownership boundaries and the public call graph.

Coordinate the **target design** with:
- #187: lifecycle/contact vs derived relationship status; knowledge/claim/memory separation; small semantic contexts/queries; correct local/remote identity/fidelity;
- #173: Social decomposition and cold transcript ownership; no duplicate Social graph;
- #172: bounded projections and revisions, with full snapshots only for persistence/debug;
- #174: one current-format persistence model and deterministic IDs;
- #175: serializable, headless Worker-ready host protocol;
- Ink #179–#185: narrative consumes semantic meaning and requests validated effects; it is not simulation truth.

This does **not** require pulling all of those issues into one giant #171 PR. It requires choosing seams now that will not be torn down again immediately. Later issues may implement their own domain changes without becoming second authority systems.

## 7. Mandatory audit before removal

Inventory and trace each active production path:
- engine construction/setup and dependency injection;
- time advancing (realtime, jumps, pause/resume);
- commands/actions and their domain effect routing;
- queries and selectors (including implicit UI/Zustand/Phaser reads);
- events/listeners, subscriptions and invalidation;
- persistence/export/load;
- social communications, environment/world transitions, transit/mobility, scenario triggers;
- offline behavior and generated content integration.

For each path record:
- current consumer;
- authoritative domain owner;
- destination API/module;
- replacement test;
- whether old code is deleted.

Do not mistake "no obvious import" for proof that a runtime path is dead. Validate via code search, runtime wiring/contract tests, and static typecheck.

## 8. Verification and merge gate

Before merging #171:
- current authored/procedural character behavior is valid without protected named NPCs;
- no duplicate domain authority, ticking, history ownership, or hidden fallback;
- local/remote reach and physical-presence rules remain intact;
- deterministic time chunking, scheduled obligations, travel, social outcomes, scenario flow and offline play remain correct;
- saved current-format state round-trips or clearly rejects incompatible *pre-freeze development* saves;
- all production entrypoints demonstrably use the composed kernel;
- zero-minute RAF cannot wake population-wide simulation work;
- compare 20/100/250/500 performance to the recorded #169/#170 baselines; do not impose unmeasured speedup promises;
- `npm run content:check` where applicable, `npx tsc --noEmit`, `npm run build`, full `npm run test`, and baseline guard self-test/full guard succeed; run focused regression tests for wiring, state authority and cutover.

Tests protecting gameplay invariants remain authoritative. Tests protecting accidental implementation details may be replaced **only with equivalent or stronger behavior/contract coverage**. Never delete failing tests just to make the rewrite pass.

Deliver an explicit **legacy-retirement proof** in PR #171:
- removed old classes/files/entrypoints;
- full active production wiring map;
- tests that cover each migrated boundary;
- list of retained intentional aliases (if any) and proof that they are delegation-only;
- known gaps or non-goals.

A partial/new-and-old merge cannot close #171.

## 9. Branch/PR and handoff instructions

- FIRST inspect actual live `main`, #171, #168, #187, #172/#173 and open PRs. Reuse the canonical implementation branch/PR if already present.
- Follow repository `AGENTS.md`; do not delegate unless explicitly instructed.
- Establish the domain-ownership/call-graph plan, then build the clean replacement.
- Commit cohesive batches on an isolated feature branch.
- Do not ask for approval after each small edit; finish a meaningful, verified cutover before merging.
- Use the existing measured baseline and run verification on the exact head.
- If technical/external blockers prevent final cutover, **leave the PR open and #171 incomplete**, documenting precisely what remains. Do not merge a hybrid solution and rename it success.
- The user's current request is **documentation only**: recording this decision is not authorization to start the #171 implementation in the documentation PR.

## 10. Explicit supersession

This decision supersedes earlier phrases such as:
- "strangler migration" *when interpreted as allowing a long-lived dual engine in merged main*;
- "LegacyFacade/Core shell remains acceptable with a bounded removal path" as a #171 closure condition;
- "retired or reduced to a deliberately thin compatibility shell" if that shell retains any old simulation behavior/authority.

It does **not** supersede the measured #169/#170 evidence, core sandbox design, existing correct domain rules, safety/testing standards, or later Worker/Rust evaluation order.

**Final law: we preserve gameplay truth, not legacy shape.**

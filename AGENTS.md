# AGENTS.md — Away Message (read this FIRST, every session)

> Living rules for all agents (human-directed AI) working on this repo.
> If a rule below contradicts a user request, the user wins — but say so explicitly.
> If the workflow changes, update this file in the same PR. Stale rules are worse than none.

## What this is
Cozy open-ended life-sim set in 2005: a desktop OS sim (React 19 + Vite + Tailwind + Zustand + Dexie)
where a dynamic roster of characters can chat with live AI, remember meaningful history,
and live governed sandbox lives. Online AI-heavy, offline-safe via templates.

## Delivery-first execution contract (2026-10-18; applies to EVERY agent)

**Optimize for completed, usable game deliverables, not the number of commits, PRs,
architecture layers, tests, or status reports.** Safety, canonical authority,
correctness and actual acceptance criteria still apply; speed does not excuse
invented evidence or data loss.

1. **Inspect and finish real work.** At each work invocation, read the live
   `main` HEAD, open issues/PRs, issue dependencies, exact-head checks and relevant
   prior handoffs. Prefer finishing an existing canonical branch/PR and its
   acceptance criteria over creating competing work, another tracking issue,
   a new scaffold, or a speculative abstraction.
2. **"Continue" means execute.** Select the highest-impact, dependency-ready
   work and implement a meaningful coherent batch in that run. Do not stop after
   a small helper, test-only change, design note, or status report when the
   integration is already specified and executable. Only stop for a genuine
   blocker, unsafe action requiring approval, or completed acceptance boundary.
3. **Plan backward from an end-to-end result.** State the target behavior and
   acceptance proof first; implement all dependent pieces together (domain
   owner, persistence, UI, integration, tests) when they belong to one vertical
   slice. A technically correct internal seam is a checkpoint, **not** a
   finished feature when users cannot yet exercise the required behavior.
4. **Use cohesive batches, not micro-commits.** Explore and run focused checks
   while implementing, then commit/push a reasonable integrated chunk. Avoid
   a push/full-CI/report cycle after each minor edit. Keep PRs reviewable and
   reduce long-lived stacked Draft PRs; finish or explicitly unblock the
   existing work before accumulating more work in progress.
5. **Verification must be risk-proportionate, never fictional.** During a batch,
   run affected unit/integration tests, typecheck and relevant builds as
   available. At a coherent milestone, release/merge boundary, or after
   broad/high-risk changes, run the full green suite and relevant browser/
   performance/asset checks. If CI automatically triggers per push, batch
   pushes rather than repeatedly paying for redundant full runs. Do not mark
   skipped gates as passed, suppress failures to claim progress, or bypass
   required repository/branch protections.
6. **No speculative infrastructure treadmill.** New architecture,
   generalization, compatibility code, Worker/Rust experiments and additional
   documents must be justified by a currently needed acceptance condition or
   measured blocker. Prefer the smallest safe implementation that completes
   the product behavior. Before the approved save freeze, do not slow down
   feature delivery to preserve disposable historical development saves;
   refuse incompatible formats cleanly and **never silently lose current
   canonical state**.
7. **Keep the game visible.** Infrastructure is a means to better gameplay.
   Reassess open product lanes (production art/playable scene, character kit,
   narrative/Ink, interaction/content) instead of tunneling indefinitely on
   backend refactoring. Advance independent dependency-ready lanes where
   feasible without conflicting ownership, unapproved delegation, or breaking
   the canonical work branch.
8. **Report outcomes rather than activity.** A useful milestone report states
   what actually works, what was verified on which exact HEAD, remaining
   acceptance gaps, and the next concrete deliverable. Distinguish
   `implemented`, `CI green`, `production-wired`, `playable` and
   `human/device-accepted`. Commit counts, test counts and green badges are
   evidence, **not** the definition of finished gameplay.
9. **Close the loop.** Once acceptance is genuinely met, prepare the existing
   PR for review/integration, update issue/roadmap status truthfully, and move
   to the next dependency-ready issue rather than extending a completed
   branch with unrelated polish. Respect explicit user permissions for
   merges, release, external agents and other high-impact actions; never
   imply approval or closure that has not occurred.

**Default decision test:** "Will this batch remove a real blocker or make a
complete part of Away Message playable, shippable, or objectively closer to
its acceptance gate?" If not, simplify or change the task. Do not treat
production-art work as optional merely because the simulation still has
interesting refactor opportunities.

## Product identity — do not regress

Away Message is an **open-ended sandbox**, not a fixed campaign.

There is no mandatory protagonist NPC, romance, meeting, café scene, or named core cast. Legacy named actors may survive temporarily as ordinary authored content, migration data, or test fixtures, but **the game must remain valid if any of them is renamed, replaced, never generated, never met, or removed**.

Progression is systemic and open-ended: residence, work, money, hardware/software, internet discovery, relationships, town knowledge, travel, possessions, activities, and character lives continue without a canonical final day or completion gate.

The current implementation still contains legacy named/core-character IDs and compatibility behavior. Treat those as migration/fixture reality, **not** as a permanent product rule that future systems may hard-code around.

The physical world is **one simulated town organized into geographic/social districts**, presented through authored living places rather than a continuous open-world city. Local walking and a first-class bus network connect places; player and NPC travel share authoritative simulation truth.

The player's residence is **dynamic life/economy state, never a sacred room/place ID**. No production residence may become an architectural fixture, fallback, canonical test subject, guaranteed start, permanent `home`, delivery target, or implicit facility provider. `home` resolves from current Residence/Tenancy state.

The approved living-character direction is a **Life Matrix orchestration layer over Away's existing authorities**. It enriches routines, obligations, goals, pressure, departure and intent without replacing the stronger relationship/social systems already implemented.

The approved narrative-framing direction supports **optional semi-baked Scenarios / Story Threads**. A Scenario is authored situation + dynamic semantic role binding + optional hooks over canonical simulation. It is not a fixed campaign, quest authority, named-character requirement, or replacement for Social/Life Matrix/Knowledge/WorldEvents. A Scenario may fail to instantiate, remain dormant forever, or resolve without a dedicated quest UI.

The approved authored-narrative direction now restores **real Ink/inkjs** as Away's text-first conversation/narrative authoring language, tracked by #179–#185. This does **not** restore a fixed campaign or give Ink game-state authority. Simulation/domain owners decide truth and valid outcomes; Ink owns authored flow, branching/recombination, local flow state and intended conversational meaning; AI is an optional realization layer with bounded freedom. Canonical social actors already use one `BuddyCharacter` identity model with `reach: local | remote`: reach controls physical scope, not whether the person is "real." Surface-only forum/site handles are not automatically canonical actors and must use a governed promotion/binding path before entering Social.

**Production Phase A — First Production Art & Playable Slice** remains the approved production/art direction. On 2026-10-11 the user approved **Simulation Kernel & Runtime Boundary refactor** (#168–#177) as a bounded prerequisite before Senior Year / Education; #169/#170 are completed. On **2026-10-12** the user explicitly **superseded the incremental/strangler migration plan for #171** with a **Clean Simulation Replacement + Atomic Production Cutover**. Rewriting/deleting the old orchestration is authorized; do not merge a hybrid new-kernel/old-LegacyFacade runtime. All production entrypoints must move to a composed single-writer kernel, and the obsolete inheritance implementation must be removed before #171 merges. Preserve useful pure domain rules and React/Phaser product boundaries, not legacy code shape. Coordinate #171's architecture with #187/#173/#172 upfront; #175 Worker and #176 measured Rust decision remain separate later issues. Canonical precedence: `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md`. After #177, return to gameplay/content/Production Phase A unless new evidence justifies another change.

The approved spatial-presence direction keeps **WHERE**, **WHY/WHAT**, and **HOW IT IS SHOWN** separate. Local physical actors may have canonical future-ready `(x,y,z)` town-space positions; Place/Space membership is derived from authored containment; purpose/activity/role is separate state; venue operations execute already-approved local intent; actor representation (full puppet/silhouette/background/hidden) is transient presentation driven by the authored camera/view, not simulation identity.

## Commands (run from repo root)
- `npm run build` (tsc + vite), `npm run test` (full vitest suite), `npx tsc --noEmit`
- `npm run content:pull` regenerates runtime content from `content/store.json`; `npm run content:check` must detect zero generated drift.
- `npm run build:itch` → `itch/away-message-demo.zip` (index.html at zip root, relative `./` base)
- Full suite is fully green (zero known failures). The former 3 `tests/unit/WorldScenes.test.ts` room-action baselines (tea/meal/window) were fixed by the trailing-`notifySubscribers()` correction in the `PLAYER_INTERACT_ROOM` handler plus the noodles `+10` expectation fix.
- Repository CI uses `scripts/verify-vitest-baseline.mjs` to accept only a fully green suite. Any failure makes CI fail until the code is fixed or this documentation and guard are intentionally updated.

## Non-negotiable workflow
1. **One feature = one branch** (`feat/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`). `main` stays green/releasable.
2. **PR + squash-merge + delete branch.** Never push features straight to main, never commit to a stale main without pulling.
3. **CHANGELOG.md** (Keep a Changelog, player language): every release batch updates it. Never per-commit entries.
4. **Version bumps on release batches only.** `package.json` SemVer (`src/version.ts` mirrors it) is independent from the save-FORMAT version.
5. **Pre-release save policy:** until an explicit save-compatibility freeze is declared for a content-complete Alpha/Beta/release milestone, historical development saves are disposable. Breaking persisted-state changes may invalidate/reset dev saves instead of carrying migration code, legacy aliases, obsolete fields, or architecture shims. Keep a version/compatibility check sufficient to refuse incompatible saves cleanly rather than corrupting them. Do **not** spend feature time writing historical dev-save migrations unless the user explicitly requests preservation for a specific test fixture/current branch. After a future save-compatibility freeze is declared, the policy changes: breaking save changes require an explicit format/version bump, deterministic migration path, and release-note discipline; newer-than-current saves remain refused.

## External agent workflow

- OpenCode and Antigravity CLI (`agy`) may run outside the Codex sandbox when the user explicitly requests delegation or the task plan calls for it. Use the operating-system approval flow when required; never use a dangerous permission bypass automatically.
- Prefer the newest Gemini Flash model exposed by `agy models`. At the time of writing this is `gemini-3.8-flash-high` for implementation and UI work; use the newest available Flash variant for review when appropriate. Do not silently switch to a different model family.
- Before launching `agy`, check its quota when the CLI exposes a reliable percentage. Warn below 20%; if no reliable percentage is available, say so rather than inventing one.
- Every external-agent prompt must bound the objective, allowed paths, out-of-scope areas, assumptions, acceptance criteria, verification commands, and deliverable. Workers must stop on material ambiguity and must not invent APIs, assets, requirements, architecture, or test results.
- Prefer an isolated branch or worktree for edits. Codex reviews the actual diff and command output before accepting changes, and retains final scope, visual, interaction, and release-signoff responsibility.
- This repository is a React/Vite/Tailwind/Zustand/Dexie/Phaser web game. Do not configure or use Unity MCP for `away-message`.

## Clean replacement / no hybrid engine law (2026-10-12)

**Canonical for #171:** `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md` supersedes earlier advice to land a long-lived "strangler" runtime with old inherited facades underneath. On the unmerged implementation branch, temporary migration code is permitted; by merge time **all production paths must use only the composed kernel** and obsolete Core/LegacyFacade inheritance execution must be deleted. There must be a single writer/owner per canonical fact. Prove wiring, deterministic behavior, current-format save safety, tests and #169/#170 performance comparison. Pure, valid domain algorithms should be reused; rewrite incorrect ownership freely. Tests of gameplay invariants remain mandatory; implementation-shaped tests may change only with equivalent/stronger contract coverage. No obsolete dev-save compatibility burden before the save freeze. Avoid both an oversized kernel monolith and needless tiny files. No #171 merge/closure with a partially wired or dual-running architecture. Do not start #175 Worker or #176 Rust in #171.

## Verification policy — focused during development, full at acceptance boundaries
- **During one coherent implementation batch:** run relevant focused unit/integration tests, `npx tsc --noEmit` and applicable build/content checks where available. Fix failures before advancing. Do not demand a full repository run between every tiny edit or every micro-commit.
- **Before declaring a major milestone complete, requesting merge/release, or completing broad/high-risk changes:** `npm run content:check` when applicable, `npx tsc --noEmit`, `npm run build`, full `npm run test` (zero failures), plus relevant browser/performance and exact-head acceptance gates. Run `node scripts/verify-vitest-baseline.mjs --self-test` and `node scripts/verify-vitest-baseline.mjs` for the full-suite baseline guard when the complete gate is due.
- Repository CI and required branch protections remain authoritative. If auto-CI runs on every push, reduce pushes by batching meaningful changes; **do not bypass gates or downgrade a failure to green**. If a local/remote runner is unavailable, disclose the unverified part and never invent results.
- Verify fixes by executing code/tests, not by reading alone. Distinguish unit success, full-suite success, browser/runtime proof and human acceptance; do not claim skipped evidence. Prefer not to consume GitHub Actions minutes needlessly when suitable local checks are available.

## Canonical design docs
Read the relevant core docs before changing a system.

- Physical town/transit: `docs/08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` plus `docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`.
- Residence/housing/living-space progression: `docs/10-RESIDENCE-HOUSING-AND-SPACE-PROGRESSION.md` plus #85–#88.
- Spatial presence / venue activities / actor presentation: `docs/11-SPATIAL-PRESENCE-VENUES-AND-ACTOR-PRESENTATION.md` plus #92–#95.
- Environment/weather, Player Needs, Mood, and public Game Context authority: `docs/12-ENVIRONMENT-PLAYER-NEEDS-AND-MOOD.md`, execution roadmap `docs/superpowers/plans/2026-10-01-environment-needs-mood-foundation.md`, plus #128–#132.
- Optional Scenarios / Story Threads: `docs/13-SCENARIOS-AND-STORY-THREADS.md` plus `docs/superpowers/plans/2026-10-01-scenario-story-thread-roadmap.md`.
- Production Phase A / first real art playable slice: `docs/14-FIRST-PRODUCTION-ART-AND-PLAYABLE-SLICE.md` plus `docs/superpowers/plans/2026-10-03-first-production-art-playable-slice.md`.
- Simulation Kernel / scalable runtime boundary: `docs/15-SIMULATION-KERNEL-AND-RUNTIME-BOUNDARY.md` plus `docs/superpowers/plans/2026-10-11-simulation-kernel-refactor-roadmap.md`, tracked by #168–#177.
- Ink narrative authoring / generative fake internet: `docs/16-INK-NARRATIVE-AUTHORING-AND-GENERATIVE-INTERNET.md` plus `docs/superpowers/plans/2026-10-11-ink-narrative-runtime-roadmap.md`, tracked by #179–#185.
- Semantic world / character model: `docs/17-SEMANTIC-WORLD-AND-CHARACTER-MODEL.md`, primarily tracked by #187 inside #168.
- **NEW #171 decision (READ BEFORE IMPLEMENTING):** `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md` — clean replacement, atomic production cutover, zero long-lived legacy runtime.
- Living characters / Life Matrix / Orion salvage: `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md` plus `docs/superpowers/plans/2026-09-10-orion-salvage-roadmap.md`.
- First Life Matrix implementation slice: `docs/superpowers/plans/2026-09-10-life-matrix-foundation.md`.

If a useful Orion concept overlaps an existing Away system, follow the salvage design's `KEEP AWAY / MERGE / ADAPT ORION / REJECT` decision instead of creating a parallel engine.

## Architecture map (read before touching)
- `src/engine/` — simulation truth. The `SimulationEngineCore -> SimulationEngineLegacyFacade -> SimulationEngine` inheritance implementation is **legacy migration input only**, and must **not survive #171 in production**. #171 performs a clean, complete cutover to composed `SimulationKernel`, retaining correct pure domain authority and deleting the obsolete live execution paths. Do **not** keep a new kernel plus inherited legacy runtime or independent fallback. Narrow public forwarding aliases are permissible only if actually required and strictly stateless/behaviorless; never preserve old simulation authority under an alias. #172/#173/#174/#175 then build on the chosen ownership seams; read `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md` first. `SocialEngine` remains canonical social truth until its owner is replaced, never duplicated. Finance, Player Needs, Mood, Environment and Game Context remain separated under `docs/12-ENVIRONMENT-PLAYER-NEEDS-AND-MOOD.md`.
- Residence/Tenancy root authority is tracked by #85/#102. Authored physical graph modernization is tracked by #98/#100 and generic physical affordance/context runtime by #103. Residence must resolve through canonical Place/spatial state rather than create a second location or interaction authority.
- `src/engine/life/` — Life Matrix seam tracked by #40 onward. It owns semantic life projection/intent orchestration only; it must not become a second store for relationships, appointments, jobs, events, commerce, transit, physical position, or venue execution.
- Semantic simulation contracts introduced under #187 sit **between canonical domain truth and consumers**. Prefer small typed scopes/context, pure queries, validated domain commands/effects, provenance-carrying influences and semantic events. They are not a second world model and must not become a general scripting DSL, GOAP planner or universal ModifierEngine.
- `src/narrative/` — current TypeScript StoryKnots and the legacy-named `InkAdapter` are migration input during #179–#185. Target architecture is `NarrativeHost + NarrativeCoordinator + InkRuntime (inkjs)` over bounded simulation projections/events. Ink owns authored conversational flow and local narrative variables only; canonical consequences remain with domain owners.
- Scenario runtime may bind semantic roles, coordinate pre-game initialization through canonical owners, observe simulation, and keep scenario-local provenance/hook lifecycle. It must not become NarrativeEngine 2, SocialEngine 2, Life Matrix 2, or a duplicate quest-state copy of canonical location/relationship/job/item/knowledge truth.
- Spatial/venue work tracked by #92–#95 should extend existing engine/world seams with the smallest readable packages. Exact paths are implementation details, but keep canonical XYZ/containment and venue activity truth in pure TypeScript, not Phaser.
- `src/engine/CityMap.ts` — current/legacy travel graph and migration input. Its `bus: true` edge flags and direct bus quote behavior are **not** the final transit architecture. Planned authority is the generated district/place/stop/line content plus `src/engine/transit/TransitNetwork.ts` / `TravelPlanner.ts` tracked by #35.
- `content/store.json` + `src/tools/content/schema.ts` + `src/tools/content/codegen.ts` — authorable content source/validation/codegen. New districts, places, spatial bounds/entry positions, venue roles/stations/services/activity templates, transit stops/lines, residences/fixture capabilities, and other authorable world/life definitions must flow through this pipeline rather than becoming a second hardcoded TypeScript catalog. Per-save mutable life/spatial/activity state remains simulation/save truth, not content.
- `src/apps/` — OS apps (pulse, mailbox, ailab, browser…); `src/internet/sites/` — `.local` web; `src/world/` — physical presentation being migrated toward generic Phaser living-place runtime; `src/desktop/` — OS shell.
- `src/persistence/` — Dexie + snapshot slots (`slots.ts` = the save API; legacy multi-table `SaveManager` is NOT the live path). Before save-compat freeze, incompatible development snapshots may be cleanly rejected/reset rather than migrated.
- `src/ai/` — providers/service/schemas; `src/menu/` — boot menu; `src/store/` — zustand.

## Design laws (do not break)
- **Simulation decides truth; Ink authors meaning; AI realizes wording.** All canonical game decisions are deterministic rules + seeded rolls owned by simulation/domain systems. Ink may author flow, choices, branching/recombination, local narrative variables, and the intended semantic content of approved conversations/discoveries; it never owns canonical money, relationships, knowledge, location, schedules, transit, items, events, school/work outcomes, or CharacterIntent. AI may realize/rephrase only an approved semantic plan, except explicitly L3 generative fake-net surfaces where it may invent claims/opinions/rumors that remain noncanonical. AI never decides timing, outcomes, knowledge, or consequence commits.
- **Environment has one resolved simulation truth.** Base climate/weather rules plus typed `WorldEventsEngine` modifiers resolve through the Environment authority. Phaser, audio, WeatherBuddy, Mood and other consumers observe the same semantic snapshot; renderers and apps never invent canonical weather.
- **Finance, Player Needs and Mood are separate authorities.** Finance owns money/rent/bills/payments; Player Needs owns energy/fatigue/hunger/health/sleep debt/social battery; Mood owns affect. Spatial position and physical inventory remain with their existing authorities. Cross-domain actions are orchestrated rather than making one engine a god object.
- **Mood changes are semantic and explainable.** Consumers submit semantic effects/context, not arbitrary raw numeric deltas. Contextual influences reconcile by stable identity and must not stack once per tick; transient effects carry provenance, bounded duration/decay and deterministic duplicate behavior.
- **Game Context is the consumer read boundary.** Apps/renderers/narrative systems should read Environment/Needs/Mood through stable read-only contracts and typed semantic events, not import concrete engine implementations or duplicate thresholds.
- **Scenario is framing, not authority.** Scenario definitions bind semantic roles and optional hooks; normal domain systems still own relationships, knowledge, location, jobs, appointments, items, events, transit and outcomes. Store references/provenance instead of copies.
- **Scenario roles are dynamic.** Never require `maya`, another sacred actor ID, a mandatory romance, or a fixed encounter. Failed role binding may legitimately mean the Scenario does not instantiate for that save.
- **Scenario presentation is optional.** A thread may remain hidden, surface through Inner Voice/search/dialogue, or later gain journal/mini-quest UX. Do not build a mandatory quest tracker unless explicitly approved.
- **Production art must prove the generic runtime, not bypass it.** Asset IDs live in content definitions; gameplay rules do not hard-code production asset paths, one residence renderer, one actor, or one public-place implementation.
- **Mutable visuals stay modular.** Beds, desks, rugs, lamps, PCs, parcels, player decor and other stateful/replaceable objects must remain separate from the static room image when gameplay changes them.
- **Evaluate art in runtime.** Do not freeze the whole-game visual style from concept sheets alone. Compare at most a small number of serious treatments inside the real Phaser/React composition with lighting, weather, characters and interaction.
- **Production Phase A is a slice, not content completion.** One strong residence, one modular prop kit, one production character, one hero public place, one street/bus-stop set and one bus interior are enough to prove the pipeline. Do not expand to every district/character/place before the slice gate passes.
- **WHERE is not WHY/WHAT.** Canonical physical location/spatial position is separate from actor purpose, activity, role, intent and consequence. Do not encode `AtWork`/`AtStore`/`AtCafe` as a substitute for both physical position and activity state.
- **XYZ is simulation geography, not a free-roam mandate.** Local physical actors may use canonical `{x,y,z}` town-space positions; include `z` now for future floors/height while current content normally uses `0`. Do not infer that this requires continuous movement, a navmesh, or realtime 3D.
- **Containment decides membership; triggers report change.** Place/Space membership is derived deterministically from authored spatial bounds/footprints and canonical position. Enter/Exit triggers/events are consequences for consumers, never the sole source of physical-location truth. Phaser overlap/render state cannot create canonical presence.
- **Authored view placement is separate from world coordinates.** Screen X/Y, view-relative depth/distance, facing and scale belong to View presentation. Do not build a general town-coordinate-to-screen projection engine just to place silhouettes or characters.
- **Venue operations are local affordances, not a second NPC brain.** Life Matrix/CharacterIntent keeps WHY/WHEN authority. Venue roles/stations/services/resources and bounded ActivityInstances answer WHAT can happen here now and HOW it progresses locally. They must not duplicate relationships, schedules, obligations, jobs/wages, transit, inventory/ownership, appointment outcomes or WorldEvent truth.
- **Anchors/stations are semantic occupancy, not pathfinding nodes.** They may express role compatibility, capacity, target object/service and view placement. Offscreen transitions may be semantic/time-based; onscreen movement may be a short tween/animation. Neither creates a city navmesh.
- **Actor representation is presentation-only.** Full puppet, silhouette, background representation and hidden state are derived from active authored camera mode + view-relative distance/depth + visibility + focus/interaction. Do not persist `isSilhouette` as character truth and do not use town XYZ as the default silhouette-tier calculation.
- **Persistent silhouettes are real people.** Clicking one resolves the same actor identity and a knowledge-safe contextual interaction projection. Unknown actors must not leak canonical names or hidden roster metadata. Interaction may promote the actor to full CharacterRenderer presentation without changing simulation identity.
- **Residence is dynamic state, never a production-room identity.** `home` resolves from current Residence/Tenancy state into normal Place/spatial rules. Direct physical actions come from concrete reachable objects; composed requirements resolve from reachable inventory/containers/resources/tools; genuine destination/service policy may remain Place-level.
- **Residence ownership domains stay distinct.** Motel/landlord fixtures and service-tier features may affect rent and remain with the property. Player-owned belongings are physical item instances and may move with the player. Do not use one ownership flag or baked background permutation to represent both.
- **Mutable residence visuals stay modular where gameplay requires change.** Replaceable beds/desks/chairs, player rugs/decor, parcels and other stateful objects must not be permanently baked into a full-room image if the game needs to swap/move/hide them. Use authored per-view assets/layers through the generic Phaser place runtime.
- **3D blockouts are production reference, not runtime.** Use blockouts to lock architecture, proportions, camera/view composition and AI-generation references; the shipped physical world remains authored 2D/2.5D Phaser presentation unless a later explicit decision changes it.
- **Life Matrix orchestrates intent; it does not replace domain authorities.** `SocialEngine` keeps relationships/bonds/affinity/traits/memories/promises/social outcomes; appointments keep appointment truth; jobs/economy keep work outcomes; `WorldEventsEngine` keeps event truth; delivery/ownership keeps orders/items; transit keeps route/service/travel-time truth. Life Matrix reads those systems and selects semantic intention.
- **Obligations are source-backed.** An appointment/job/promise/event/commerce obligation references its owning record; do not copy RSVP, wages, relationship deltas, parcel contents, event status, or travel timing into competing Life Matrix truth.
- **Schedules create pressure and intention, not teleportation.** Routine/agenda boundaries may produce preparation, departure or activity pressure. Normal cross-place movement progresses through departure → transit → arrival using shared town truth.
- **Presence is a projection of one person's life.** Physical place/spatial membership, in-transit state, remote/off-town state, device context and messenger availability must not contradict one another. A renderer or open app never creates presence truth.
- **One town, one simulation.** A `District` is a geographic/social grouping of canonical places, never a game level, separate Phaser scene graph authority, save partition, clock, or second world state.
- **No open-world requirement.** Do not introduce continuous WASD/isometric/top-down city traversal, player street pathfinding, traffic simulation, or vehicle physics just to connect places. The physical experience is authored living places plus simulated walking/transit between them.
- **Transit is domain truth, not presentation.** Bus stops, lines, service windows, waits, fares, transfers, disruptions, active trips, and arrival timing come from generated content + pure simulation. React/Phaser may request/present a trip but never compute or mutate authoritative transit results independently.
- **Player and NPC mobility share the town.** NPCs may choose policies/preferences, but they cannot invent impossible shortcuts outside the same route/service model the player uses.
- **Transit presentation is optional, transit state is not.** A bus stop may be a normal living Place and a bus ride may use a reusable interior view, but skipping/compressing presentation must advance exactly the same authoritative itinerary once.
- **Physical existence and player knowledge differ.** A character, district, place, stop, line, residence listing or event may exist in simulation before the player knows it. UI/projectors/AI must not reveal undiscovered truth merely because it exists in state.
- **Dynamic roster is the product direction.** Legacy named IDs may remain in current tests/content during migration. Do not create new architecture that requires any specific identity, protects a character because of its name, or makes a gameplay role/path character-specific when a role/capability can own it. Pre-freeze historical saves do not create an obligation to retain those IDs forever.
- **Reach is physical scope, not a second character class.** A canonical `BuddyCharacter` may be `local` or `remote` while keeping the same actor identity, relationships, memories and conversation history. Remote actors must not acquire town XYZ, physical co-location, in-person availability or required art merely because they have a MyPlace/Pulse/forum presence. Conversely, an anonymous/forum/generated-site identity is not automatically a BuddyCharacter; promotion into Social must be explicit, deduplicated, knowledge-safe and assign reach from canonical evidence rather than a UI default.
- **Store truth; derive semantics.** Do not persist a boolean universe such as `canChat`, `isLonely`, `isExamAnxious` or `isTrusted` when those meanings can be derived deterministically from canonical facts, relationships, obligations, pressure and context. World fact, actor knowledge, claim/rumor, personal memory and player knowledge are distinct concepts. Important memories should carry semantic provenance rather than using prose as the only truth.
- **Character lifecycle is not friendship.** Relationship stage remains derived from relationship dimensions. Do not use one status enum to simultaneously mean friend/close, blocked/contact state and departed/archive lifecycle.
- **Fidelity changes cost, never identity.** Important local, background/offscreen local and remote known actors may receive different simulation detail, but promotion/demotion never forks actor identity or rewrites relationships/history.
- **Preserve current social safety/rarity rules while migrating, but do not elevate legacy identity exceptions into new architecture.** Any future generalized lifecycle rule must be role/state-driven and explicitly tested.
- **Offline-first:** every AI feature ships a template fallback that works with no key (see `makeFallback*`, `pickTemplate*`, `ARCHETYPE_*` pools). AI outage must never break the tick — wrap in try/catch.
- **Governed generation:** Zod-validate every model output; cap everything (memories, promises, affinities, guestbooks, links); era lock 1998–2006; fictional `.local` URLs only, never real ones.
- **Prompt hygiene:** never quote internal labels (Stage/Mood/brackets) literally; AI must not claim photos it didn't send or events/knowledge not available to that character.

## Code conventions
- Prefer editing existing files; never create files unless required. No proactive docs/*.md; create/update docs when a user request, issue acceptance criteria, architecture change, or approved plan requires them.
- Specialized reads over bash (Read/Grep/Glob); `bash` is for real commands (git/npm/build/test), chained with `&&`.
- Windows + PowerShell: quote spaced paths, use `workdir` param (never `cd`), `Select-Object -First` for truncating (never `head`).
- Minimize unnecessary complexity and churn, **not** the size of a justified coherent batch. Keep changes scoped and reviewable; avoid both giant monoliths and one-file-per-ten-lines fragmentation. Preserve indentation and re-read edited regions before finalizing.
- Short, factual communication. Reference code as `file_path:line_number`. Never emit emojis unless asked.

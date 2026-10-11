# AGENTS.md — Away Message (read this FIRST, every session)

> Living rules for all agents (human-directed AI) working on this repo.
> If a rule below contradicts a user request, the user wins — but say so explicitly.
> If the workflow changes, update this file in the same PR. Stale rules are worse than none.

## What this is
Cozy open-ended life-sim set in 2005: a desktop OS sim (React 19 + Vite + Tailwind + Zustand + Dexie)
where a dynamic roster of characters can chat with live AI, remember meaningful history,
and live governed sandbox lives. Online AI-heavy, offline-safe via templates.

## Product identity — do not regress

Away Message is an **open-ended sandbox**, not a fixed campaign.

There is no mandatory protagonist NPC, romance, meeting, café scene, or named core cast. Legacy named actors may survive temporarily as ordinary authored content, migration data, or test fixtures, but **the game must remain valid if any of them is renamed, replaced, never generated, never met, or removed**.

Progression is systemic and open-ended: residence, work, money, hardware/software, internet discovery, relationships, town knowledge, travel, possessions, activities, and character lives continue without a canonical final day or completion gate.

The current implementation still contains legacy named/core-character IDs and compatibility behavior. Treat those as migration/fixture reality, **not** as a permanent product rule that future systems may hard-code around.

The physical world is **one simulated town organized into geographic/social districts**, presented through authored living places rather than a continuous open-world city. Local walking and a first-class bus network connect places; player and NPC travel share authoritative simulation truth.

The player's residence is **dynamic life/economy state, never a sacred room/place ID**. No production residence may become an architectural fixture, fallback, canonical test subject, guaranteed start, permanent `home`, delivery target, or implicit facility provider. `home` resolves from current Residence/Tenancy state.

The approved living-character direction is a **Life Matrix orchestration layer over Away's existing authorities**. It enriches routines, obligations, goals, pressure, departure and intent without replacing the stronger relationship/social systems already implemented.

The approved narrative-framing direction supports **optional semi-baked Scenarios / Story Threads**. A Scenario is authored situation + dynamic semantic role binding + optional hooks over canonical simulation. It is not a fixed campaign, quest authority, named-character requirement, or replacement for Social/Life Matrix/Knowledge/WorldEvents. A Scenario may fail to instantiate, remain dormant forever, or resolve without a dedicated quest UI.

**Production Phase A — First Production Art & Playable Slice** remains the approved production/art direction. However, on 2026-10-11 the user explicitly approved one bounded technical prerequisite before Senior Year / Education expansion: **Simulation Kernel & Runtime Boundary refactor** (#168–#177). This is a deliberate exception to the earlier “no new engine architecture by default” rule. Preserve the existing React + Phaser product architecture and good pure domain systems; fix render-frame-driven population work, replace inheritance-heavy simulation orchestration with composition, introduce bounded projections and a Dedicated Worker host, then make the Rust decision from benchmarks. After #177, do not continue architecture work by inertia; return to gameplay/content/Production Phase A unless new evidence justifies another change.

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

## Verification before every push
`npm run content:check` when generated content is touched → `npx tsc --noEmit` clean → `npm run build` succeeds → full `npm run test` with zero new failures.
For exact repository CI policy, run `node scripts/verify-vitest-baseline.mjs --self-test` then `node scripts/verify-vitest-baseline.mjs`; the latter is green only for a fully green suite and rejects any failure.
Verify fixes by execution (run the code/tests), not by reading. Trust evidence over speculation; state discrepancies plainly.

## Canonical design docs
Read the relevant core docs before changing a system.

- Physical town/transit: `docs/08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` plus `docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`.
- Residence/housing/living-space progression: `docs/10-RESIDENCE-HOUSING-AND-SPACE-PROGRESSION.md` plus #85–#88.
- Spatial presence / venue activities / actor presentation: `docs/11-SPATIAL-PRESENCE-VENUES-AND-ACTOR-PRESENTATION.md` plus #92–#95.
- Environment/weather, Player Needs, Mood, and public Game Context authority: `docs/12-ENVIRONMENT-PLAYER-NEEDS-AND-MOOD.md`, execution roadmap `docs/superpowers/plans/2026-10-01-environment-needs-mood-foundation.md`, plus #128–#132.
- Optional Scenarios / Story Threads: `docs/13-SCENARIOS-AND-STORY-THREADS.md` plus `docs/superpowers/plans/2026-10-01-scenario-story-thread-roadmap.md`.
- Production Phase A / first real art playable slice: `docs/14-FIRST-PRODUCTION-ART-AND-PLAYABLE-SLICE.md` plus `docs/superpowers/plans/2026-10-03-first-production-art-playable-slice.md`.
- Simulation Kernel / scalable runtime boundary: `docs/15-SIMULATION-KERNEL-AND-RUNTIME-BOUNDARY.md` plus `docs/superpowers/plans/2026-10-11-simulation-kernel-refactor-roadmap.md`, tracked by #168–#177.
- Living characters / Life Matrix / Orion salvage: `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md` plus `docs/superpowers/plans/2026-09-10-orion-salvage-roadmap.md`.
- First Life Matrix implementation slice: `docs/superpowers/plans/2026-09-10-life-matrix-foundation.md`.

If a useful Orion concept overlaps an existing Away system, follow the salvage design's `KEEP AWAY / MERGE / ADAPT ORION / REJECT` decision instead of creating a parallel engine.

## Architecture map (read before touching)
- `src/engine/` — simulation truth. The current `SimulationEngineCore -> SimulationEngineLegacyFacade -> SimulationEngine` inheritance chain is migration input during #168–#177, not the target growth model. Preserve the good domain authorities while moving orchestration toward a composed `SimulationKernel`, bounded serializable projections, and a `SimulationHost` that can run the canonical TypeScript simulation in one Dedicated Worker. `SocialEngine` remains canonical social truth while its responsibilities/history storage are decomposed; do not create a second relationship graph. See `docs/15-SIMULATION-KERNEL-AND-RUNTIME-BOUNDARY.md`. Finance, Player Needs, Mood, Environment and Game Context remain separated according to `docs/12-ENVIRONMENT-PLAYER-NEEDS-AND-MOOD.md`.
- Residence/Tenancy root authority is tracked by #85/#102. Authored physical graph modernization is tracked by #98/#100 and generic physical affordance/context runtime by #103. Residence must resolve through canonical Place/spatial state rather than create a second location or interaction authority.
- `src/engine/life/` — Life Matrix seam tracked by #40 onward. It owns semantic life projection/intent orchestration only; it must not become a second store for relationships, appointments, jobs, events, commerce, transit, physical position, or venue execution.
- Scenario runtime may bind semantic roles, coordinate pre-game initialization through canonical owners, observe simulation, and keep scenario-local provenance/hook lifecycle. It must not become NarrativeEngine 2, SocialEngine 2, Life Matrix 2, or a duplicate quest-state copy of canonical location/relationship/job/item/knowledge truth.
- Spatial/venue work tracked by #92–#95 should extend existing engine/world seams with the smallest readable packages. Exact paths are implementation details, but keep canonical XYZ/containment and venue activity truth in pure TypeScript, not Phaser.
- `src/engine/CityMap.ts` — current/legacy travel graph and migration input. Its `bus: true` edge flags and direct bus quote behavior are **not** the final transit architecture. Planned authority is the generated district/place/stop/line content plus `src/engine/transit/TransitNetwork.ts` / `TravelPlanner.ts` tracked by #35.
- `content/store.json` + `src/tools/content/schema.ts` + `src/tools/content/codegen.ts` — authorable content source/validation/codegen. New districts, places, spatial bounds/entry positions, venue roles/stations/services/activity templates, transit stops/lines, residences/fixture capabilities, and other authorable world/life definitions must flow through this pipeline rather than becoming a second hardcoded TypeScript catalog. Per-save mutable life/spatial/activity state remains simulation/save truth, not content.
- `src/apps/` — OS apps (pulse, mailbox, ailab, browser…); `src/internet/sites/` — `.local` web; `src/world/` — physical presentation being migrated toward generic Phaser living-place runtime; `src/desktop/` — OS shell.
- `src/persistence/` — Dexie + snapshot slots (`slots.ts` = the save API; legacy multi-table `SaveManager` is NOT the live path). Before save-compat freeze, incompatible development snapshots may be cleanly rejected/reset rather than migrated.
- `src/ai/` — providers/service/schemas; `src/menu/` — boot menu; `src/store/` — zustand.

## Design laws (do not break)
- **Rules decide, AI paraphrases.** All canonical game decisions are deterministic rules + seeded rolls. AI may phrase only approved semantic text surfaces (NPC chat, player reply suggestions, and Player Inner Voice). AI never decides timing, outcomes, knowledge, or state changes. Never let the model own relationships, goals, obligations, current location, routes, fares, schedule truth, item/money changes, event truth, or consequence commits.
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
- **Preserve current social safety/rarity rules while migrating, but do not elevate legacy identity exceptions into new architecture.** Any future generalized lifecycle rule must be role/state-driven and explicitly tested.
- **Offline-first:** every AI feature ships a template fallback that works with no key (see `makeFallback*`, `pickTemplate*`, `ARCHETYPE_*` pools). AI outage must never break the tick — wrap in try/catch.
- **Governed generation:** Zod-validate every model output; cap everything (memories, promises, affinities, guestbooks, links); era lock 1998–2006; fictional `.local` URLs only, never real ones.
- **Prompt hygiene:** never quote internal labels (Stage/Mood/brackets) literally; AI must not claim photos it didn't send or events/knowledge not available to that character.

## Code conventions
- Prefer editing existing files; never create files unless required. No proactive docs/*.md; create/update docs when a user request, issue acceptance criteria, architecture change, or approved plan requires them.
- Specialized reads over bash (Read/Grep/Glob); `bash` is for real commands (git/npm/build/test), chained with `&&`.
- Windows + PowerShell: quote spaced paths, use `workdir` param (never `cd`), `Select-Object -First` for truncating (never `head`).
- Keep edits minimal and local; preserve exact indentation; re-read edited regions before finalizing.
- Short, factual communication. Reference code as `file_path:line_number`. Never emit emojis unless asked.

# AGENTS.md — Away Message (read this FIRST, every session)

> Living rules for all agents (human-directed AI) working on this repo.
> If a rule below contradicts a user request, the user wins — but say so explicitly.
> If the workflow changes, update this file in the same PR. Stale rules are worse than none.

## What this is
Cozy life-sim set in 2005: a desktop OS sim (React 19 + Vite + Tailwind + Zustand + Dexie)
where a dynamic roster of characters can chat with live AI, remember meaningful history,
and live governed sandbox lives. Online AI-heavy, offline-safe via templates.

The current implementation still contains legacy named/core-character IDs and compatibility behavior. Treat those as migration/fixture reality, **not** as a permanent product rule that future systems may hard-code around.

The physical world is **one simulated town organized into geographic/social districts**, presented through authored living places rather than a continuous open-world city. Local walking and a first-class bus network connect places; player and NPC travel share authoritative simulation truth.

The player's residence is **dynamic life/economy state, not a sacred room ID**. Room 104 may remain as an authored/reference motel room, but no core system may assume the player starts there, permanently lives there, receives all deliveries there, or has facilities merely because Room 104 once served as the flagship fixture. `home` resolves from current Residence/Tenancy state.

The approved living-character direction is a **Life Matrix orchestration layer over Away's existing authorities**. It enriches routines, obligations, goals, pressure, departure and intent without replacing the stronger relationship/social systems already implemented.

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
- Living characters / Life Matrix / Orion salvage: `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md` plus `docs/superpowers/plans/2026-09-10-orion-salvage-roadmap.md`.
- First Life Matrix implementation slice: `docs/superpowers/plans/2026-09-10-life-matrix-foundation.md`.

If a useful Orion concept overlaps an existing Away system, follow the salvage design's `KEEP AWAY / MERGE / ADAPT ORION / REJECT` decision instead of creating a parallel engine.

## Architecture map (read before touching)
- `src/engine/` — simulation truth: `SimulationEngine` orchestrates; `SocialEngine` (roster/relationships/memory), `WorldEventsEngine` (global events), `EconomyEngine` (body/cash), `CharacterEngine/Director/Templates`, `AppointmentDirector`, `RoomDirector`, `BoardDirector`, `WeatherEngine`, `CityMap`, `DeliveryEngine`, `JobDirector`, `BodyDirector`, `OutingDirector`.
- Residence/Tenancy authority is tracked by #85/#86. It must resolve the player's current residence through canonical Place state rather than create a second location catalog or a permanent Room 104 alias.
- `src/engine/life/` — planned Life Matrix seam tracked by #40/#41 onward. It owns semantic life projection/intent orchestration only; it must not become a second store for relationships, appointments, jobs, events, commerce, transit, or physical presence.
- `src/engine/CityMap.ts` — current/legacy travel graph and migration input. Its `bus: true` edge flags and direct bus quote behavior are **not** the final transit architecture. Planned authority is the generated district/place/stop/line content plus `src/engine/transit/TransitNetwork.ts` / `TravelPlanner.ts` tracked by #35.
- `content/store.json` + `src/tools/content/schema.ts` + `src/tools/content/codegen.ts` — authorable content source/validation/codegen. New districts, places, transit stops/lines, residences/fixture capabilities, and other authorable world/life definitions must flow through this pipeline rather than becoming a second hardcoded TypeScript catalog. Per-save mutable life state remains simulation/save truth, not content.
- `src/apps/` — OS apps (pulse, mailbox, ailab, browser…); `src/internet/sites/` — `.local` web; `src/world/` — physical presentation being migrated toward generic Phaser living-place runtime; `src/desktop/` — OS shell.
- `src/persistence/` — Dexie + snapshot slots (`slots.ts` = the save API; legacy multi-table `SaveManager` is NOT the live path). Before save-compat freeze, incompatible development snapshots may be cleanly rejected/reset rather than migrated.
- `src/ai/` — providers/service/schemas; `src/menu/` — boot menu; `src/store/` — zustand.

## Design laws (do not break)
- **Rules decide, AI paraphrases.** All canonical game decisions are deterministic rules + seeded rolls. AI may phrase only approved semantic text surfaces (NPC chat, player reply suggestions, and Player Inner Voice). AI never decides timing, outcomes, knowledge, or state changes. Never let the model own relationships, goals, obligations, current location, routes, fares, schedule truth, item/money changes, event truth, or consequence commits.
- **Residence is dynamic state, not Room 104.** `home` resolves from current Residence/Tenancy state. Residence definitions reuse canonical Place/Space/View/Anchor content. Missing facilities (private bathroom, kitchenette, storage, desk, delivery anchor, etc.) remain genuinely absent unless the current residence or another valid place provides them.
- **Residence ownership domains stay distinct.** Motel/landlord fixtures and service-tier features may affect rent and remain with the property. Player-owned belongings are physical item instances and may move with the player. Do not use one ownership flag or baked background permutation to represent both.
- **Mutable residence visuals stay modular where gameplay requires change.** Replaceable beds/desks/chairs, player rugs/decor, parcels and other stateful objects must not be permanently baked into a full-room image if the game needs to swap/move/hide them. Use authored per-view assets/layers through the generic Phaser place runtime.
- **3D blockouts are production reference, not runtime.** Use blockouts to lock architecture, proportions, camera/view composition and AI-generation references; the shipped physical world remains authored 2D/2.5D Phaser presentation unless a later explicit decision changes it.
- **Life Matrix orchestrates intent; it does not replace domain authorities.** `SocialEngine` keeps relationships/bonds/affinity/traits/memories/promises/social outcomes; appointments keep appointment truth; jobs/economy keep work outcomes; `WorldEventsEngine` keeps event truth; delivery/ownership keeps orders/items; transit keeps route/service/travel-time truth. Life Matrix reads those systems and selects semantic intention.
- **Obligations are source-backed.** An appointment/job/promise/event/commerce obligation references its owning record; do not copy RSVP, wages, relationship deltas, parcel contents, event status, or travel timing into competing Life Matrix truth.
- **Schedules create pressure and intention, not teleportation.** Routine/agenda boundaries may produce preparation, departure or activity pressure. Normal cross-place movement progresses through departure → transit → arrival using shared town truth.
- **Presence is a projection of one person's life.** Physical place, in-transit state, remote/off-town state, device context and messenger availability must not contradict one another. A renderer or open app never creates presence truth.
- **One town, one simulation.** A `District` is a geographic/social grouping of canonical places, never a game level, separate Phaser scene graph authority, save partition, clock, or second world state.
- **No open-world requirement.** Do not introduce continuous WASD/isometric/top-down city traversal, player street pathfinding, traffic simulation, or vehicle physics just to connect places. The physical experience is authored living places plus simulated walking/transit between them.
- **Transit is domain truth, not presentation.** Bus stops, lines, service windows, waits, fares, transfers, disruptions, active trips, and arrival timing come from generated content + pure simulation. React/Phaser may request/present a trip but never compute or mutate authoritative transit results independently.
- **Player and NPC mobility share the town.** NPCs may choose policies/preferences, but they cannot invent impossible shortcuts outside the same route/service model the player uses.
- **Transit presentation is optional, transit state is not.** A bus stop may be a normal living Place and a bus ride may use a reusable interior view, but skipping/compressing presentation must advance exactly the same authoritative itinerary once.
- **Physical existence and player knowledge differ.** A character, district, place, stop, line, residence listing or event may exist in simulation before the player knows it. UI/projectors/AI must not reveal undiscovered truth merely because it exists in state.
- **Dynamic roster is the product direction.** Legacy IDs such as `maya`, `ryan`, `nora`, and `henderson` may remain in current tests/content during migration. Do not create new architecture that requires those identities, protects them because of their names, or makes a gameplay role/path character-specific when a role/capability can own it. Pre-freeze historical saves do not create an obligation to retain these IDs forever.
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

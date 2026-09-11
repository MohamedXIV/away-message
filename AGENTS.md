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

The approved living-character direction is a **Life Matrix orchestration layer over Away's existing authorities**. It enriches routines, obligations, goals, pressure, departure and intent without replacing the stronger relationship/social systems already implemented.

## Commands (run from repo root)
- `npm run build` (tsc + vite), `npm run test` (full vitest suite), `npx tsc --noEmit`
- `npm run content:pull` regenerates runtime content from `content/store.json`; `npm run content:check` must detect zero generated drift.
- `npm run build:itch` → `itch/away-message-demo.zip` (index.html at zip root, relative `./` base)
- Full suite currently has exactly **3 pre-existing failures**, all in `tests/unit/WorldScenes.test.ts` under `4. Simulation Engine Room Action Integration`:
  - `executes tea interaction (advances 6m, restores 5 energy)`
  - `executes instant noodles meal (advances 15m, restores 15 energy)`
  - `executes window observation (advances 4m, logs telemetry)`
- Repository CI uses `scripts/verify-vitest-baseline.mjs` to accept only those exact three identities. Any additional, missing, or unexpectedly fixed baseline failure makes CI fail until this documentation and guard are intentionally updated.

## Non-negotiable workflow
1. **One feature = one branch** (`feat/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`). `main` stays green/releasable.
2. **PR + squash-merge + delete branch.** Never push features straight to main, never commit to a stale main without pulling.
3. **CHANGELOG.md** (Keep a Changelog, player language): every release batch updates it. Never per-commit entries.
4. **Version bumps on release batches only.** `package.json` SemVer (`src/version.ts` mirrors it) is independent from the save-FORMAT version.
5. **Save-compat rule (absolute):** any breaking save change = bump `SAVE_FORMAT_VERSION` in `src/persistence/slots.ts` + migration path in `checkSaveCompatibility` + one CHANGELOG line. Newer-than-current saves are ALWAYS refused (silent corruption is worse than an honest error). Same discipline for Pulse `localStorage` version stamps (lenient there: warn, never refuse).

## Verification before every push
`npm run content:check` when generated content is touched → `npx tsc --noEmit` clean → `npm run build` succeeds → full `npm run test` with zero new failures.
For exact repository CI policy, run `node scripts/verify-vitest-baseline.mjs --self-test` then `node scripts/verify-vitest-baseline.mjs`; the latter is green only for the exact documented WorldScenes baseline and rejects any regression outside it.
Verify fixes by execution (run the code/tests), not by reading. Trust evidence over speculation; state discrepancies plainly.

## Canonical design docs
Read the relevant core docs before changing a system.

- Physical town/transit: `docs/08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` plus `docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`.
- Living characters / Life Matrix / Orion salvage: `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md` plus `docs/superpowers/plans/2026-09-10-orion-salvage-roadmap.md`.
- First Life Matrix implementation slice: `docs/superpowers/plans/2026-09-10-life-matrix-foundation.md`.

If a useful Orion concept overlaps an existing Away system, follow the salvage design's `KEEP AWAY / MERGE / ADAPT ORION / REJECT` decision instead of creating a parallel engine.

## Architecture map (read before touching)
- `src/engine/` — simulation truth: `SimulationEngine` orchestrates; `SocialEngine` (roster/relationships/memory), `WorldEventsEngine` (global events), `EconomyEngine` (body/cash), `CharacterEngine/Director/Templates`, `AppointmentDirector`, `RoomDirector`, `BoardDirector`, `WeatherEngine`, `CityMap`, `DeliveryEngine`, `JobDirector`, `BodyDirector`, `OutingDirector`.
- `src/engine/life/` — planned Life Matrix seam tracked by #40/#41 onward. It owns semantic life projection/intent orchestration only; it must not become a second store for relationships, appointments, jobs, events, commerce, transit, or physical presence.
- `src/engine/CityMap.ts` — current/legacy travel graph and migration input. Its `bus: true` edge flags and direct bus quote behavior are **not** the final transit architecture. Planned authority is the generated district/place/stop/line content plus `src/engine/transit/TransitNetwork.ts` / `TravelPlanner.ts` tracked by #35.
- `content/store.json` + `src/tools/content/schema.ts` + `src/tools/content/codegen.ts` — authorable content source/validation/codegen. New districts, places, transit stops/lines, and other authorable world/life definitions must flow through this pipeline rather than becoming a second hardcoded TypeScript catalog. Per-save mutable life state remains simulation/save truth, not content.
- `src/apps/` — OS apps (pulse, mailbox, ailab, browser…); `src/internet/sites/` — `.local` web; `src/world/` — room/cafe physical presentation being migrated toward generic Phaser living-place runtime; `src/desktop/` — OS shell.
- `src/persistence/` — Dexie + snapshot slots (`slots.ts` = the save API; legacy multi-table `SaveManager` is NOT the live path).
- `src/ai/` — providers/service/schemas; `src/menu/` — boot menu; `src/store/` — zustand.

## Design laws (do not break)
- **Rules decide, AI paraphrases.** All canonical game decisions are deterministic rules + seeded rolls. AI may phrase only approved semantic text surfaces (NPC chat, player reply suggestions, and Player Inner Voice). AI never decides timing, outcomes, knowledge, or state changes. Never let the model own relationships, goals, obligations, current location, routes, fares, schedule truth, item/money changes, event truth, or consequence commits.
- **Life Matrix orchestrates intent; it does not replace domain authorities.** `SocialEngine` keeps relationships/bonds/affinity/traits/memories/promises/social outcomes; appointments keep appointment truth; jobs/economy keep work outcomes; `WorldEventsEngine` keeps event truth; delivery/ownership keeps orders/items; transit keeps route/service/travel-time truth. Life Matrix reads those systems and selects semantic intention.
- **Obligations are source-backed.** An appointment/job/promise/event/commerce obligation references its owning record; do not copy RSVP, wages, relationship deltas, parcel contents, event status, or travel timing into competing Life Matrix truth.
- **Schedules create pressure and intention, not teleportation.** Routine/agenda boundaries may produce preparation, departure or activity pressure. Normal cross-place movement progresses through departure → transit → arrival using shared town truth.
- **Presence is a projection of one person's life.** Physical place, in-transit state, remote/off-town state, device context and messenger availability must not contradict one another. A renderer or open app never creates presence truth.
- **One town, one simulation.** A `District` is a geographic/social grouping of canonical places, never a game level, separate Phaser scene graph authority, save partition, clock, or second world state.
- **No open-world requirement.** Do not introduce continuous WASD/isometric/top-down city traversal, player street pathfinding, traffic simulation, or vehicle physics just to connect places. The physical experience is authored living places plus simulated walking/transit between them.
- **Transit is domain truth, not presentation.** Bus stops, lines, service windows, waits, fares, transfers, disruptions, active trips, and arrival timing come from generated content + pure simulation. React/Phaser may request/present a trip but never compute or mutate authoritative transit results independently.
- **Player and NPC mobility share the town.** NPCs may choose policies/preferences, but they cannot invent impossible shortcuts outside the same route/service model the player uses.
- **Transit presentation is optional, transit state is not.** A bus stop may be a normal living Place and a bus ride may use a reusable interior view, but skipping/compressing presentation must advance exactly the same authoritative itinerary once.
- **Physical existence and player knowledge differ.** A character, district, place, stop, line or event may exist in simulation before the player knows it. UI/projectors/AI must not reveal undiscovered truth merely because it exists in state.
- **Dynamic roster is the product direction.** Legacy IDs such as `maya`, `ryan`, `nora`, and `henderson` may remain in saves/tests/content during migration and should keep compatibility through normalization/aliases where needed. Do not create new architecture that requires those identities, protects them because of their names, or makes a gameplay role/path character-specific when a role/capability can own it.
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

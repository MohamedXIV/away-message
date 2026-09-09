# AGENTS.md — Away Message (read this FIRST, every session)

> Living rules for all agents (human-directed AI) working on this repo.
> If a rule below contradicts a user request, the user wins — but say so explicitly.
> If the workflow changes, update this file in the same PR. Stale rules are worse than none.

## What this is
Cozy life-sim set in 2005: a desktop OS sim (React 19 + Vite + Tailwind + Zustand + Dexie)
where NPCs (Maya/Ryan/Nora/Henderson + procedural buddies) chat with live AI, remember
everything, and live governed sandbox lives. Online AI-heavy, offline-safe via templates.

The physical world is **one simulated town organized into geographic/social districts**, presented through authored living places rather than a continuous open-world city. Local walking and a first-class bus network connect places; player and NPC travel share authoritative simulation truth.

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
Read the relevant core docs before changing a system. For physical-town work, `docs/08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` is canonical together with the linked spec/implementation plan under `docs/superpowers/`.

## Architecture map (read before touching)
- `src/engine/` — simulation truth: `SimulationEngine` orchestrates; `SocialEngine` (roster/relationships/memory), `WorldEventsEngine` (global events), `EconomyEngine` (body/cash), `CharacterEngine/Director/Templates`, `AppointmentDirector`, `RoomDirector`, `BoardDirector`, `WeatherEngine`, `CityMap`, `DeliveryEngine`, `JobDirector`, `BodyDirector`, `OutingDirector`.
- `src/engine/CityMap.ts` — current/legacy travel graph and migration input. Its `bus: true` edge flags and direct bus quote behavior are **not** the final transit architecture. Planned authority is the generated district/place/stop/line content plus `src/engine/transit/TransitNetwork.ts` / `TravelPlanner.ts` tracked by #35.
- `content/store.json` + `src/tools/content/schema.ts` + `src/tools/content/codegen.ts` — authorable content source/validation/codegen. New districts, places, transit stops/lines, and other physical-world definitions must flow through this pipeline rather than becoming a second hardcoded TypeScript catalog.
- `src/apps/` — OS apps (pulse, mailbox, ailab, browser…); `src/internet/sites/` — `.local` web; `src/world/` — room/cafe physical presentation being migrated toward generic Phaser living-place runtime; `src/desktop/` — OS shell.
- `src/persistence/` — Dexie + snapshot slots (`slots.ts` = the save API; legacy multi-table `SaveManager` is NOT the live path).
- `src/ai/` — providers/service/schemas; `src/menu/` — boot menu; `src/store/` — zustand.

## Design laws (do not break)
- **Rules decide, AI paraphrases.** All game decisions are deterministic rules + seeded rolls. AI may phrase text only through explicitly approved semantic narrative/chat surfaces. Never let the model pick moments, outcomes, routes, fares, schedule truth, or state changes.
- **One town, one simulation.** A `District` is a geographic/social grouping of canonical places, never a game level, separate Phaser scene graph authority, save partition, clock, or second world state.
- **No open-world requirement.** Do not introduce continuous WASD/isometric/top-down city traversal, player street pathfinding, traffic simulation, or vehicle physics just to connect places. The physical experience is authored living places plus simulated walking/transit between them.
- **Transit is domain truth, not presentation.** Bus stops, lines, service windows, waits, fares, transfers, disruptions, active trips, and arrival timing come from generated content + pure simulation. React/Phaser may request/present a trip but never compute or mutate authoritative transit results independently.
- **Player and NPC mobility share the town.** Normal cross-place NPC schedules create departure → in-transit → arrival continuity through the same route/travel-time network as the player wherever practical; do not teleport an NPC merely because a schedule boundary or UI view changed.
- **Transit presentation is optional, transit state is not.** A bus stop may be a normal living Place and a bus ride may use a reusable interior view, but skipping/compressing presentation must advance exactly the same authoritative itinerary once.
- **Physical existence and player knowledge differ.** A district/place/stop/line may exist in simulation before the player knows it. UI/projectors must not reveal undiscovered content just because it exists in generated data.
- **Offline-first:** every AI feature ships a template fallback that works with no key (see `makeFallback*`, `pickTemplate*`, `ARCHETYPE_*` pools). AI outage must never break the tick — wrap in try/catch.
- **Governed generation:** Zod-validate every model output; cap everything (memories, promises, affinities, guestbooks, links); era lock 1998–2006; fictional `.local` URLs only, never real ones.
- **Canonical buddy ids** are short (`maya/ryan/nora/henderson`); display handles are separate. Normalize on load (`normalizeBuddyId`); core 4 are code-owned and protected (never distant/gone/blocked/removed).
- **One active sharp/strained event at a time**; core buddies cap at `strained`.
- **Prompt hygiene:** never quote internal labels (Stage/Mood/brackets) literally; AI must not claim photos it didn't send or events not listed.

## Code conventions
- Prefer editing existing files; never create files unless required. No proactive docs/*.md; create/update docs when a user request, issue acceptance criteria, architecture change, or approved plan requires them.
- Specialized reads over bash (Read/Grep/Glob); `bash` is for real commands (git/npm/build/test), chained with `&&`.
- Windows + PowerShell: quote spaced paths, use `workdir` param (never `cd`), `Select-Object -First` for truncating (never `head`).
- Keep edits minimal and local; preserve exact indentation; re-read edited regions before finalizing.
- Short, factual communication. Reference code as `file_path:line_number`. Never emit emojis unless asked.

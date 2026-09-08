# AGENTS.md — Away Message (read this FIRST, every session)

> Living rules for all agents (human-directed AI) working on this repo.
> If a rule below contradicts a user request, the user wins — but say so explicitly.
> If the workflow changes, update this file in the same PR. Stale rules are worse than none.

## What this is
Cozy life-sim set in 2005: a desktop OS sim (React 19 + Vite + Tailwind + Zustand + Dexie)
where NPCs (Maya/Ryan/Nora/Henderson + procedural buddies) chat with live AI, remember
everything, and live governed sandbox lives. Online AI-heavy, offline-safe via templates.

## Commands (run from repo root)
- `npm run build` (tsc + vite), `npm run test` (full vitest suite), `npx tsc --noEmit`
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
`npx tsc --noEmit` clean → `npm run build` succeeds → full `npm run test` with zero new failures.
For exact repository CI policy, run `node scripts/verify-vitest-baseline.mjs --self-test` then `node scripts/verify-vitest-baseline.mjs`; the latter is green only for the exact documented WorldScenes baseline and rejects any regression outside it.
Verify fixes by execution (run the code/tests), not by reading. Trust evidence over speculation; state discrepancies plainly.

## Architecture map (read before touching)
- `src/engine/` — simulation truth: `SimulationEngine` orchestrates; `SocialEngine` (roster/relationships/memory), `WorldEventsEngine` (global events), `EconomyEngine` (body/cash), `CharacterEngine/Director/Templates`, `AppointmentDirector`, `RoomDirector`, `BoardDirector`, `WeatherEngine`, `CityMap`, `DeliveryEngine`, `JobDirector`, `BodyDirector`, `OutingDirector`.
- `src/apps/` — OS apps (pulse, mailbox, ailab, browser…); `src/internet/sites/` — `.local` web; `src/world/` — room/cafe canvas scenes; `src/desktop/` — OS shell.
- `src/persistence/` — Dexie + snapshot slots (`slots.ts` = the save API; legacy multi-table `SaveManager` is NOT the live path).
- `src/ai/` — providers/service/schemas; `src/menu/` — boot menu; `src/store/` — zustand.

## Design laws (do not break)
- **Rules decide, AI paraphrases.** All game decisions are deterministic rules + seeded rolls. AI only ever phrases text inside chat. Never let the model pick moments, outcomes, or state changes.
- **Offline-first:** every AI feature ships a template fallback that works with no key (see `makeFallback*`, `pickTemplate*`, `ARCHETYPE_*` pools). AI outage must never break the tick — wrap in try/catch.
- **Governed generation:** Zod-validate every model output; cap everything (memories, promises, affinities, guestbooks, links); era lock 1998–2006; fictional `.local` URLs only, never real ones.
- **Canonical buddy ids** are short (`maya/ryan/nora/henderson`); display handles are separate. Normalize on load (`normalizeBuddyId`); core 4 are code-owned and protected (never distant/gone/blocked/removed).
- **One active sharp/strained event at a time**; core buddies cap at `strained`.
- **Prompt hygiene:** never quote internal labels (Stage/Mood/brackets) literally; AI must not claim photos it didn't send or events not listed.

## Code conventions
- Prefer editing existing files; never create files unless required. No proactive docs/*.md.
- Specialized reads over bash (Read/Grep/Glob); `bash` is for real commands (git/npm/build/test), chained with `&&`.
- Windows + PowerShell: quote spaced paths, use `workdir` param (never `cd`), `Select-Object -First` for truncating (never `head`).
- Keep edits minimal and local; preserve exact indentation; re-read edited regions before finalizing.
- Short, factual communication. Reference code as `file_path:line_number`. Never emit emojis unless asked.

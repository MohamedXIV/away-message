# Ink Acceptance Gate (#185)

Date: 2026-10-22

Canonical direction: `docs/16-INK-NARRATIVE-AUTHORING-AND-GENERATIVE-INTERNET.md`

Parent epic: #179

## Assessment

All twelve gate criteria are covered by executable evidence on the canonical
composed SimulationKernel. The gate does not require the separate #175 Worker
transport; PR #204 remains an independent hosting change.

Primary executable suite:
`tests/integration/InkNarrativeGate.test.ts` (one test group per criterion
cluster), plus the #180–#184 focused suites.

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Real Ink drives authored branching/recombination | `InkRuntime`/`NarrativeHost` compile/load tests; café choices produce different authored branches and social actions |
| 2 | Canonical facts read through bounded projections/queries | Coordinator context source uses HUD, needs, actor read, café guest read and scenario reads; gate spies on `getState` and asserts zero calls during flow start/advance |
| 3 | Ink local variables cannot duplicate money/location/relationship/world truth | Scenario `hook_seen` exists only in saved host state; canonical snapshot/HUD/roster unchanged; no `hook_seen` in engine state |
| 4 | Semantic effects validated by owning domains | Host rejects unknown effect ids; café effects dispatch canonical `SOCIAL_APPLY_ACTION`; fake-net runtimes bind no effect owner and reject pending effects |
| 5 | Local buddy uses L0–L2 and interacts physically only from canonical presence | Café flow plan is L2; `getCafeGuestRead` gates the helper; presence is `at_place`/can interact only while the canonical actor is there |
| 6 | Remote buddy uses L0–L2, keeps continuity, cannot appear physically | Remote L2 plan; unknown NPC place; no café guest; presence physical `remote`; messages/memories/handles preserved |
| 7 | Remote→local→remote preserves identity/history | `setActorReach` round-trip keeps id, relationships, memories, messages and handles; trips/XYZ are evicted on return to remote |
| 8 | Surface-only identity can remain noncanonical indefinitely | NightBoard authors stay `surface_only`; repeated builds never add roster entries |
| 9 | Explicit promotion binds one `BuddyCharacter` with correct reach | `SOCIAL_PROMOTE_SURFACE_IDENTITY` creates one remote `northbank_owl`; rebuilds do not duplicate it; flow authorship stays surface-only without an explicit actor binding |
| 10 | Scenario hook→Ink works without Scenario authority duplication | Real `old_debt` hook starts the Ink flow; only ScenarioDirector consumes the hook; coordinator save contains references, not facts/consumed lists |
| 11 | Fake-net L3 generation cannot create canonical facts | All six provenance labels are validated; canonical facts require an owner-provided value; AI authority wording falls back; world/transit/board/roster snapshots are unchanged |
| 12 | Representative loop remains playable with AI/network disabled | Café Ink opening/choices + canonical social effect, NightBoard and CanalWatch offline flows, Scenario hook flow and Pulse messaging run with no injected AI; `fetch` spy is never called |

## Playable surfaces

- **Café (in-person):** `CafeScene` now starts `cafe-meeting.ink` through
  `startCafeMeetingNarrative`, which refuses actors without canonical café
  presence. The authored opener and three choices render in the dialogue box;
  a choice is sent/recorded through canonical Social and commits its validated
  effect. The authored response is recorded and the flow then yields to the
  existing free-form conversation.
- **NightBoard:** the board keeps its static, deterministic NPC-authored and
  world-event-derived threads, plus an authored Ink thread with provenance
  labels and governed #181 promotion for surface authors.
- **CanalWatch:** `canalwatch.local` is a searchable authored generated-site
  flow with sections, a guestbook claim, a clue and provenance labels.

## Deliberate boundaries

- Fake-net flows are read-only; they have no effect owner and cannot mutate
  WorldEvents, Transit, Scenario, Social or Knowledge.
- AI realization remains optional and injected. The gate and all playable
  surfaces use authored offline text; AI failures/timeouts fall back.
- The legacy `InkAdapter`/StoryKnot path is unmounted, its catalog is empty and
  it has no production-authoring role. Its mechanical deletion plan remains
  `docs/16` §17.2.
- No real public-internet dependency is introduced.

## Commands

```bash
npx tsc --noEmit
npm run ink:compile
npm run content:check
npm run build
npm run test
node scripts/verify-vitest-baseline.mjs --self-test
node scripts/verify-vitest-baseline.mjs
```

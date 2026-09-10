# Districts and Transit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task-by-task with review checkpoints.

**Goal:** Replace Away Message's flat city/bus-edge abstraction with a data-driven district and TransitNetwork model shared by player and NPC travel, while preserving authored living-place presentation and avoiding open-world traversal.

**Architecture:** Extend the existing Content UI/TinyBase → validation/codegen pipeline with district/place/stop/line definitions. Add a pure TypeScript `TransitNetwork` + time-dependent `TravelPlanner` as the only route/fare/time authority. Persist committed trips in simulation state, then migrate player travel and NPC schedule continuity onto that shared contract. React/Phaser only project and present the resulting state.

**Tech Stack:** TypeScript, TinyBase content schema/codegen, Vitest, existing SimulationEngine/Character systems, React town navigation, Phaser 4 generic physical-place runtime from #19/#20.

**Spec:** `docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`

## Global Constraints

- Start implementation only after required blocker issues are merged and fetch the actual latest integration base first.
- Do not branch from a SHA copied from this plan.
- Preserve current useful `CityMap.ts` behavior while migrating; do not delete the existing `$2` bus/walking behavior before compatibility tests exist.
- One town, one simulation. Districts are not levels, scene classes, save partitions, or separate clocks.
- Bus lines/stops/service/fare/timing are domain truth. React and Phaser must never invent them.
- Player and NPC mobility consume the same route planner.
- No WASD/open-world city traversal, traffic simulation, vehicle physics, or drivable bus work belongs here.
- Use TDD for every task: RED test → smallest GREEN implementation → refactor while green.
- Run `npm run content:check`, `npx tsc --noEmit`, `npm run build`, targeted tests, then `npm run test` before declaring each implementation PR ready.
- Any persisted-state breaking change requires an explicit save-format bump and deterministic migration under the repository's save law.
- Do not mix unrelated PC/OS work into these branches.

---

## Task 1 — Extend generated content with districts, places, stops, and bus lines

**Issue:** #17 prerequisite for #35

**Files:**
- Modify: `content/store.json`
- Modify: `src/tools/content/schema.ts`
- Modify: `src/tools/content/codegen.ts`
- Modify: `tools/pull-content.ts` only if generated output is split
- Modify: `src/engine/coreBuddies.generated.ts` through `npm run content:pull`, never by hand
- Modify/Create tests: `tests/unit/ContentStore.test.ts` and/or focused `tests/unit/TownContent.test.ts`

### Step 1: Write failing content validation tests

Add a minimal valid fixture containing two districts, several places, two stops, and one line. Add RED cases for:

- missing `districtId` target;
- missing stop target;
- line with fewer than two stops;
- invalid `segmentMinutes` length;
- non-positive segment/headway;
- negative fare;
- invalid service window;
- place access entry referencing a missing stop.

Run the focused test and confirm failure is caused by missing district/transit schema support.

### Step 2: Add TinyBase table schemas

Add tables equivalent to:

```text
districts
places
transitStops
busLines
```

Encode ordered arrays/compound structures using the same deterministic JSON-cell convention already used by current content tables where appropriate.

Keep mutable service state and player knowledge out of content.

### Step 3: Add semantic cross-reference validation

In `validateContent()` validate all relationships and service invariants from the spec. Error messages must identify table/id/field so Content UI users can fix the row without code archaeology.

Run focused tests to GREEN.

### Step 4: Generate typed registries

Extend `generateRegistrySource()` to emit stable generated types/constants for districts, places, stops and lines. If `coreBuddies.generated.ts` becomes semantically unreasonable, split generated world data into a focused generated file but keep one `content:pull`/`content:check` contract.

Run:

```bash
npm run content:pull
npm run content:check
```

### Step 5: Add an initial migration fixture

Represent the current CityMap places and first transit seed in content. Preserve the current `$2` evaluation fare and bus-capable relationships as migration inputs.

Do not yet switch runtime authority in this task.

### Step 6: Verify and commit

Run content check, typecheck, build, focused tests and full tests. Commit only the content/schema/codegen slice.

---

## Task 2 — Introduce `TransitNetwork` and deterministic `TravelPlanner`

**Issue:** #35

**Files:**
- Create: `src/engine/transit/TransitNetwork.ts`
- Create: `src/engine/transit/TravelPlanner.ts`
- Create: `src/engine/transit/types.ts`
- Create: `tests/unit/TravelPlanner.test.ts`
- Modify: `src/engine/CityMap.ts` only to add a compatibility adapter after the new planner is green
- Modify: `tests/unit/CityMapP7.test.ts`

### Step 1: RED — same-place and walk-only plans

Write tests requiring:

- same-place plan = zero minutes/fare/legs;
- local direct walk returns exact authored minutes;
- rain applies the existing `1.25` walking multiplier deterministically.

### Step 2: GREEN — smallest network projection

Build an immutable runtime network from generated definitions. Add lookups by district/place/stop/line and pure helpers for local walking/access edges.

### Step 3: RED — direct bus with wait

Fixture:

```text
Line R1
A Stop → B Stop
service 06:00–23:00
headway 20
segment 12 min
fare $2
```

At 06:07, require 13 minutes wait + 12 minutes ride plus authored access walks.

### Step 4: GREEN — time-dependent line expansion

Implement deterministic next-service lookup at any stop by accumulating preceding line segment times from the first-stop departure series.

### Step 5: RED — transfer and tie-breaks

Add tests for:

- one-transfer itinerary;
- transfer wait derived from actual second-line schedule;
- earliest arrival wins;
- then lower fare;
- then fewer transfers;
- then fewer walk minutes;
- final lexical stable tie-break.

### Step 6: GREEN — earliest-arrival search

Implement a small Dijkstra-style search storing absolute arrival minute as node cost. Keep the graph/search code readable; the authored town network is small.

### Step 7: RED/GREEN — service failures and modifiers

Test and implement:

- service ended;
- closed line;
- closed stop;
- explicit line delay;
- headway multiplier;
- failure leaves state untouched.

### Step 8: Route policies

Test and implement `fastest`, `cheapest`, `walk_only`, and `prefer_bus` exactly as the design spec defines.

### Step 9: Compatibility adapter

Update `CityMap.ts` so legacy callers can obtain equivalent quotes through the new planner while migration is underway. Keep old tests green and add a test proving the legacy `$2` bus expectation is preserved for the seeded case.

Do not leave legacy edge calculation as a second authority after callers migrate.

### Step 10: Verify and commit

Run targeted planner/CityMap tests, then full gates.

---

## Task 3 — Commit and persist active player travel

**Issue:** #35

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify the current player travel/action coordinator that calls `CityMap.quoteTravel()`
- Modify: `tests/unit/SimulationEngine.test.ts`
- Modify: `tests/unit/CityMapP7.test.ts`
- Modify: `tests/unit/SaveRoundTrip.test.ts`
- Modify save migration/version files only if persisted shape requires it

### Step 1: RED — planning must not mutate

Test that requesting a quote changes neither cash, time nor location.

### Step 2: RED — committing charges once

Test that choosing a `$2` itinerary:

- creates `ActiveTravelState`;
- records immutable committed plan;
- deducts exactly `$2` once;
- does not instantly claim destination arrival before travel resolution.

### Step 3: GREEN — active trip state

Add the smallest persisted active-travel state defined by the spec and an authoritative simulation command to commit a quoted plan after revalidating its start conditions.

### Step 4: RED/GREEN — leg advancement

Cover:

- wait → bus → final walk boundaries;
- exact arrival minute;
- location/presence during transit;
- idempotent arrival consequence.

### Step 5: RED/GREEN — compressed trip

Add one simulation path that advances an entire remaining trip for presentation skip. It must produce the same final clock/cash/location state as advancing the legs normally.

### Step 6: Save/reload

Round-trip a save while waiting and while aboard a bus. Require identical itinerary/current leg/arrival time/farePaid after reload.

A restored clock already beyond arrival must resolve arrival once, not replay fare or side effects.

### Step 7: Verify and commit

Run save, SimulationEngine and travel tests plus full gates.

---

## Task 4 — Make NPC schedules create departure/travel/arrival continuity

**Issue:** #37

**Files:**
- Modify: `src/engine/CharacterEngine.ts`
- Modify: `src/engine/CharacterDirector.ts`
- Modify: `src/engine/AppointmentDirector.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify/Create: `tests/unit/CharacterLives.test.ts`
- Modify: `tests/unit/CharacterDirector.test.ts`
- Modify: `tests/unit/AppointmentsP5.test.ts`
- Create focused `tests/unit/CharacterTransit.test.ts` if clearer

### Step 1: RED — remove normal schedule teleport assumption

Create a character whose next scheduled place requires travel. At the schedule boundary assert they do not instantly become present at the destination.

### Step 2: Add mobility state

Represent character state equivalent to:

```text
AtPlace
AboutToLeave
InTransit
AtPlace
```

Reuse existing state fields where they already express these concepts; do not create duplicate truth.

### Step 3: RED/GREEN — departure planning

Given a desired appointment/work arrival minute, query the shared planner and choose a practical departure that can arrive on time. If no on-time plan exists, expose deterministic lateness rather than teleporting.

### Step 4: RED/GREEN — arrival consequences

Route actual arrival/lateness into existing appointment/job/social consequence hooks. Transit must not own relationship consequences.

### Step 5: RED/GREEN — service edge cases

Cover:

- missed last bus;
- walk fallback where valid;
- no route/cancel policy where configured;
- weather changes walking timing;
- large time jump equals minute-by-minute result.

### Step 6: Transit co-location

Add pure query helpers/tests proving two actors can truthfully overlap:

- at the same stop during intersecting wait intervals;
- on the same line/segment during intersecting ride intervals.

Do not generate dialogue here.

### Step 7: Presence integrity

Test that an in-transit NPC is not simultaneously projected as physically present at origin and destination, and that online-presence logic does not use renderer visibility as truth.

### Step 8: Persistence

Save/reload an NPC mid-trip and verify exact continuity and associated appointment/purpose reference.

### Step 9: Verify and commit

Run character/appointment/transit tests plus full gates.

---

## Task 5 — Add town/district knowledge and scalable navigation projection

**Issue:** #36

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/engine/transit/TownKnowledge.ts`
- Create a knowledge-safe town navigation projector in the engine/presentation boundary
- Modify the existing city-map React surface rather than adding a competing map system
- Create: `tests/unit/TownKnowledge.test.ts`
- Modify: `tests/unit/CityMapP7.test.ts` during migration

### Step 1: RED — unknown content stays hidden

Create known and unknown districts/places/stops/lines. Require navigation projection to expose only what player knowledge permits.

### Step 2: GREEN — knowledge state

Add state equivalent to:

```text
district: unknown | known
place: unknown | heard | mapped | visited | familiar
stop: unknown | known | used
line: unknown | known | used
```

Knowledge changes visibility, not network existence.

### Step 3: RED/GREEN — district grouping

Require projected town navigation to group known places and stops under their generated `districtId` while preserving canonical IDs.

### Step 4: RED/GREEN — travel choices

At a selected origin/destination, present simulation-generated alternatives such as walk and bus with total/wait/ride/walk time and fare. React must receive already-computed quotes.

### Step 5: Discovery hooks

Add semantic commands/hooks for existing systems to reveal a district/place/stop/line from:

- NPC information;
- web/job/email content;
- signage/timetable inspection;
- successful travel.

Do not add gamey XP bars.

### Step 6: Verify and commit

Run knowledge/navigation tests, then standard gates.

---

## Task 6 — Make bus stops normal living Places

**Issues:** #20 + #36

**Blockers:** generic Phaser place runtime must already exist.

**Files:**
- Modify generated content tables for one test bus-stop place/view/anchors
- Extend the generic Place/View presentation registry/runtime from #20; do not create `BusStopScene.ts` if generic content can express it
- Add focused integration test under `tests/unit/WorldScenes.test.ts` or a new `tests/unit/TransitPlaces.test.ts`

### Step 1: RED — stop uses generic place runtime

Require a generated transit stop linked to a normal `placeId` to resolve through the same Place/View path as other physical places.

### Step 2: Author one representative stop

Give it one hero view with anchors/hotspots for:

- route/timetable board;
- bench/shelter/sign;
- rider slots;
- optional poster/notice focus.

### Step 3: Service projection

The board interaction receives current service from the simulation. The Phaser view cannot invent the next bus or fare.

### Step 4: Living environment integration

Consume #21/#22 for current weather, wetness, lighting, traffic/ambience. Keep all behavior generic/data-driven.

### Step 5: Rider placement

Populate known/persistent NPC rider anchors only from physical/transit presence truth. Ambient anonymous background extras may use the general ambient-actor system if they are not persistent characters.

### Step 6: Verify and commit

Run world-scene/transit tests and full gates.

---

## Task 7 — Build reusable bus-interior presentation

**Issue:** #36

**Files:**
- Add generated Place/View content for one reusable bus interior
- Extend the generic physical-world renderer with contextual active-trip binding
- Integrate CharacterRenderer anchors from #25 and audio/environment contracts from #21/#22
- Create: `tests/unit/BusRidePresentation.test.ts`

### Step 1: RED — renderer cannot create a trip

Test that opening bus presentation with no active bus leg fails safely/does not mutate simulation.

### Step 2: GREEN — bind to active bus leg

Resolve:

- current line;
- boarding/alighting stops;
- remaining simulated duration;
- district/route exterior context;
- actual co-located riders.

### Step 3: Window/exterior treatment

Drive moving exterior/window layers from route/district/time/weather presentation data. Do not simulate literal bus coordinates through an open world.

### Step 4: RED/GREEN — skip equivalence

Compare a displayed ride and an immediately skipped ride. Both must advance exactly the committed trip duration once and reach the same canonical state.

### Step 5: RED/GREEN — rider continuity

A known NPC shown aboard must be backed by transit co-location state. Leaving the bus removes presentation when the NPC's itinerary says they alighted.

### Step 6: Audio and lighting

Bind engine/road/rain/interior ambience to semantic audio events and active environmental state, never raw route-specific special cases.

### Step 7: Verify and commit

Run focused presentation tests, world integration and full gates.

---

## Task 8 — Retire duplicate CityMap/transit authority and run final gate

**Issue:** #29

**Files:**
- Modify/remove legacy authority in `src/engine/CityMap.ts`
- Modify remaining callers discovered by repository search
- Update/remove obsolete `tests/unit/CityMapP7.test.ts` expectations only after equivalent new coverage exists
- Update canonical docs only if implementation reveals a deliberate approved design change

### Step 1: Search for duplicate authority

Repository-search for:

```text
quoteTravel
BUS_FARE
bus: true
CityMap
location =
```

Classify every hit as migrated caller, compatibility adapter, test fixture, or unrelated use.

### Step 2: RED — guard against legacy bus authority

Add a focused architecture test or static assertion appropriate to the repo that fails if production code outside the migration adapter continues to compute bus fare/time from edge booleans.

### Step 3: Remove compatibility path

Once every caller is migrated, delete obsolete edge-bus route calculation and keep only any local walking data that still has a justified role. Generated TransitNetwork becomes the single transit authority.

### Step 4: End-to-end canonical scenario

Run the #29 scenario including:

- two districts;
- one local walk;
- one cross-district bus trip;
- real stop/wait/line/fare;
- living stop;
- bus interior or compressed ride;
- save/reload mid-trip;
- one NPC departure → transit → arrival using the same line;
- truthful player/NPC co-location;
- no duplicate fare/arrival side effects.

### Step 5: Final verification

Run:

```bash
npm run content:check
npx tsc --noEmit
npm run build
npm run test
```

If packaging/runtime dependencies changed because #19/#22/#25 also landed, perform the repository's production/itch smoke test as required by #29.

### Step 6: Review before merge

Review the final diff for:

- accidental open-world assumptions;
- duplicate transit catalogs;
- hardcoded route IDs in React/Phaser;
- schedule teleports;
- save migration omissions;
- hidden-knowledge leaks;
- direct renderer state mutations.

Only then mark #29/epic completion conditions satisfied.

---

## Completion checkpoint

This plan is complete when Away Message can truthfully say:

```text
The town is one living simulation.
Districts make it understandable.
Places make it intimate.
Bus lines make distance/time/social movement real.
Player and NPCs travel through the same world.
The game never needed to render every street between them.
```

# Technical Architecture

## 1. Platform

Browser-first Web application.

No backend required.

No authentication required.

No real public internet requests required for gameplay.

No desktop wrapper required.

---

## 2. Stack

### Runtime
- TypeScript, strict
- React
- Phaser 4.x
- Ink
- inkjs
- Zustand
- Zod
- Dexie / IndexedDB

### Tooling
- Vite
- Vitest
- Playwright
- ESLint/formatting as appropriate

---

## 3. Responsibility boundaries

```text
React / DOM
  Fake OS
  Browser
  Messenger
  Email
  Installers
  File manager UI
  Terminal UI
  Town/district navigation
  Human-readable travel choices
  Menus

Phaser
  Motel room
  Window/street
  Café
  Work/physical scenes
  Bus-stop living views
  Optional bus-interior presentation
  Layered 2D presentation
  Ambient effects

Ink + inkjs
  Authored narrative flow
  Dialogue text
  Choices
  Narrative tags

Pure TypeScript Simulation
  Authoritative time
  Money
  Energy
  PC hardware
  Software state
  Downloads
  Files
  Character schedules
  Hidden relationships
  Events
  World state
  Appointments
  Bills
  District/place geography projection
  TransitNetwork/service state
  Walking/bus route planning
  Waits/fares/transfers/arrival timing
  Active player/NPC travel
  Physical presence and co-location truth
  Player town/route knowledge

Persistence
  Versioned save/load
  Active travel continuity
```

---

## 4. Golden rule

> **Simulation never imports React, Phaser, or Ink runtime UI code.**

Domain systems should be testable without rendering the game.

React and Phaser may depend on application/domain interfaces.

Narrative adapter may read/write through a controlled simulation API.

For transit specifically:

> **Presentation can request or display a trip; it cannot invent a trip.**

React/Phaser never independently calculate or mutate fares, service availability, waits, transfers, routes, or arrival time.

---

## 5. One-town architecture

The canonical physical-world model is:

```text
ONE SimulationEngine / WorldState
        ↓
District definitions/grouping
        ↓
Canonical Place definitions
        ↓
walking links + TransitNetwork
        ↓
ActiveTravelState
        ↓
current physical Place/View presentation
```

A `District` is a geographic/social grouping, never:

- a separate simulation;
- a separate clock;
- a save partition;
- a required Phaser scene class;
- a level with duplicated world state.

The game does not require a continuous open-world town scene. Phaser renders the active authored physical place/view while pure simulation continues to own the rest of town.

See `08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` and `docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`.

---

## 6. Content pipeline and generated definitions

Authorable world/transit definitions follow the existing pipeline:

```text
Content UI Manager
      ↓
content/store.json / TinyBase content
      ↓
src/tools/content/schema.ts
      ↓
src/tools/content/codegen.ts
      ↓
content:pull / content:check
      ↓
generated typed runtime registries
```

The generated content should eventually include definitions equivalent to:

- districts;
- places/spaces/views/anchors;
- transit stops;
- place↔stop walking access;
- bus lines and ordered stops;
- normal service windows/headways;
- segment travel times;
- initial fare/service metadata;
- physical items/containers/assets/lights/audio as tracked by #17.

Mutable per-save facts such as active trips, delays/closures, stock, item locations, and player knowledge do not belong in content definitions.

Runtime systems consume generated typed registries rather than reading raw content storage directly.

---

## 7. Suggested repository layout

The current repository already uses `src/engine/` for domain truth. Preserve that reality rather than forcing a speculative rename. New transit code should fit cleanly under it.

```text
src/
  engine/
    SimulationEngine.ts
    CityMap.ts                 # migration/compatibility input, not final bus authority
    transit/
      types.ts
      TransitNetwork.ts
      TravelPlanner.ts
      TownKnowledge.ts
    CharacterEngine.ts
    CharacterDirector.ts
    AppointmentDirector.ts
    WeatherEngine.ts
    WorldEventsEngine.ts
    ...

  tools/
    content/
      schema.ts
      codegen.ts

  world/
    PhaserGame.ts
    place-runtime/
    views/
    focus/
    anchors/
    ambient/

  apps/
    ... actual software/OS surfaces ...

  persistence/
    ... versioned snapshot/save path ...

content/
  store.json

docs/
  ...

tests/
  unit/
  integration/
  e2e/
```

Exact names can differ. Preserve the boundaries.

---

## 8. Simulation engine

Representative interface:

```ts
interface SimulationEngine {
  getState(): GameState;
  dispatch(action: GameAction): void;
  advanceGameMinutes(minutes: number): void;
  advanceRealTime(seconds: number): void;
}
```

`advanceRealTime` converts through one configured time scale.

`advanceGameMinutes` is the same authoritative path used for:
- tea,
- shower,
- work,
- sleep,
- meetings,
- waiting for transit,
- bus/walking travel,
- compressed/skipped ride presentation.

Do not manually update each subsystem after time jumps.

A skipped bus presentation must resolve through the same authoritative time/travel path as a shown ride.

---

## 9. Game state

Use a versioned serializable state.

High-level representative shape:

```ts
interface GameState {
  meta: SaveMeta;
  clock: GameClockState;
  player: PlayerState;
  economy: EconomyState;
  pc: PcState;
  files: FileSystemState;
  software: SoftwareState;
  downloads: DownloadState;
  browser: BrowserState;
  contacts: ContactState;
  relationships: RelationshipState;
  world: WorldState;
  transit: TransitState;
  townKnowledge: TownKnowledgeState;
  events: EventState;
  narrative: NarrativeState;
}
```

Exact storage may remain nested under existing state objects if cleaner. Avoid duplicate truth merely to match this example.

Avoid storing React component state as authoritative game state.

---

## 10. TransitNetwork and TravelPlanner

`TransitNetwork` is an immutable runtime projection of generated definitions plus explicit service-state inputs.

It owns/knows:

- districts/places/stops/lines as definitions;
- place-to-stop access;
- ordered stop topology;
- normal service windows/headways;
- segment durations;
- line/stop availability modifiers.

`TravelPlanner` is pure TypeScript and returns deterministic itinerary proposals containing combinations of:

```text
walk
wait
bus
transfer wait/walk
bus
final walk
```

A quote exposes enough data to present:

- departure/arrival;
- total time;
- walking time;
- waiting time;
- ride time;
- fare;
- lines/stops;
- transfers.

For the small authored network, use a readable time-dependent earliest-arrival search rather than transit-industry infrastructure.

The first migration preserves the current CityMap `$2` bus tuning as an evaluation default while replacing `bus: true` edge flags with first-class lines/stops.

---

## 11. Active travel state

Planning and travel commitment are separate.

```text
quote
  ↓ no mutation
choose
  ↓
commit authoritative plan
  ↓ fare charged once
ActiveTravelState
  ↓
wait / walk / bus legs
  ↓
arrival once
```

Persist enough committed state to survive save/reload without rerouting or recharging:

- actor;
- origin/destination;
- committed itinerary;
- departure/expected arrival;
- current leg/progress boundary;
- fare-paid marker/value;
- optional appointment/obligation purpose reference.

Large time jumps across travel must produce the same final state as incremental progression.

---

## 12. NPC mobility

Character schedules express intended place/time outcomes; they should not normally set a distant destination instantly at the schedule boundary.

Target conceptual state:

```text
AtPlace
  ↓
AboutToLeave
  ↓
InTransit
  ↓
Arrived / AtPlace
```

NPC mobility uses the same TravelPlanner as the player wherever practical. Character preferences may choose among valid plans, but cannot invent routes outside the network.

Appointments/jobs/social systems own the consequences of lateness or arrival. Transit supplies truthful movement and timing only.

Transit state should expose deterministic co-location evidence when actors overlap at the same stop or bus segment. Social/narrative systems decide whether that overlap becomes an event.

---

## 13. Town knowledge

Physical existence and player knowledge are different state.

The town may contain a district/place/stop/line before the player knows it.

A bounded knowledge model may distinguish states such as:

```text
unknown
heard/address learned
mapped
visited
familiar
```

React navigation receives a knowledge-safe projection rather than the complete generated town catalog.

NPC routing is not limited by what the player knows.

---

## 14. Zustand

Use Zustand for:
- UI/window/view coordination,
- subscriptions to simulation state,
- transient presentation state.

Do not make it the only place where domain rules live.

A reasonable pattern:
- simulation engine owns serializable domain state,
- Zustand exposes selected state and dispatch helpers to React.

Town/district selection may be transient UI state; discovered places/routes and active travel are domain/save state.

---

## 15. Zod / semantic validation

Validate:
- content files,
- save data,
- narrative effect tags,
- software definitions,
- website definitions,
- district/location definitions,
- stop/line cross-references,
- service windows/headways/segment times,
- place-to-stop access relationships.

Fail loudly in development for invalid content.

---

## 16. Persistence

Use IndexedDB through Dexie/current snapshot save APIs.

Persist:
- versioned save state,
- message history,
- installed programs,
- downloads,
- files,
- browser changes,
- narrative state,
- window observations,
- discovered/known town content,
- dynamic transit service state when relevant,
- active player/NPC trips required for continuity.

Use localStorage only for:
- volume,
- UI scale,
- accessibility settings,
- developer flags,
- other explicitly presentation-only preferences.

Autosave:
- sleep,
- work completion,
- purchase,
- install/uninstall,
- major narrative beat,
- periodic interval,
- other existing repository-safe points.

Do not autosave in a way that can double-charge or duplicate transit commitment/arrival effects.

---

## 17. Save migrations

Every save includes or resolves through the repository's save-format/version policy.

Migrations must be explicit.

Any breaking persisted district/transit/active-trip change follows the same absolute save-compat rule documented in `AGENTS.md`.

---

## 18. Determinism

Use seeded randomness for ambient/systemic content that affects saved outcomes.

Goals:
- reproducible tests,
- stable save/load,
- stable travel routes for the same state,
- fewer "why did this change after refresh?" bugs.

Purely cosmetic random animation need not be saved.

Bus/service disruptions that affect outcomes are explicit deterministic world/service state, not random renderer effects.

---

## 19. Fake browser

Do not use real iframe navigation.

The browser maps a fictional URL to an internal page component/content record.

Website content can be React components or data-driven renderers.

The browser owns presentation/navigation history.

The simulation owns:
- unlocks,
- dynamic content flags,
- download tasks,
- purchases,
- town knowledge changes caused by discovering an address/route/place.

This lets the digital world reveal the physical town without giving website components world authority.

---

## 20. Window manager

Required:
- open
- close
- minimize
- focus/z-order
- drag

Resize is optional if it increases risk.

Closing UI does not destroy domain state.

---

## 21. Phaser integration

Phaser receives projections such as:
- current place/space/view definition,
- current time band,
- weather,
- world entities,
- interaction availability,
- transit-stop service projection when rendering a stop,
- active bus-leg presentation context when rendering an optional bus interior,
- physically present rider/NPC anchors from simulation.

Phaser emits semantic intents such as:
- hotspot clicked,
- location action,
- travel request,
- inspect timetable,
- board selected committed trip,
- skip ride presentation.

Phaser does **not**:
- calculate fare,
- decide the next bus,
- invent wait time,
- reroute an actor,
- set destination arrival because an animation ended,
- spawn a persistent known NPC rider without simulation presence.

Do not use Phaser `update()` as the single source of game time.

---

## 22. Bus-stop and bus-interior presentation

A bus stop uses the generic physical `Place → Space → View → Focus → Anchor` runtime. It is not a bespoke transport UI scene class unless a later proven technical need requires one.

A reusable bus interior is presentation bound to an already active bus leg. It may show:

- route/district exterior window treatment;
- current weather/time lighting;
- riders from transit co-location;
- spatial/semantic audio;
- contextual physical interactions.

Skipping the scene cannot alter the committed itinerary's duration or fare.

---

## 23. Runtime tick

Use an application-level loop while the game is unpaused.

Conceptually:

```ts
onFrameOrInterval(deltaSeconds) {
  simulation.advanceRealTime(deltaSeconds);
}
```

The exact scheduling mechanism may use `requestAnimationFrame` or a controlled timer.

The simulation must tolerate:
- variable frame rate,
- tab throttling within reason,
- explicit time jumps,
- trips crossing multiple leg boundaries in one update.

---

## 24. Pause

An explicit game pause/settings state may stop simulation.

Opening:
- browser,
- Messenger,
- terminal,
does not pause time.

Town/district map presentation also does not become a second clock or silently pause unless the global game pause policy says so.

---

## 25. No external dependency for core play

The evaluation build must remain playable if:
- public internet is unavailable,
- external AI service is unavailable,
- analytics is unavailable.

All core game/town/transit content is local.

---

## 26. Performance

This is a 2D, text-heavy game with a small authored transit network.

Prioritize:
- responsive input,
- fast window operations,
- no unnecessary re-renders,
- efficient image loading,
- lazy loading larger location assets,
- trivially fast deterministic route planning,
- no duplicated physical-scene runtime after navigation.

Do not prematurely introduce:
- ECS,
- microservices,
- complex DI containers,
- server database,
- event-bus maze,
- traffic simulation,
- GTFS tooling,
- per-meter NPC navigation.

Readable TypeScript wins.

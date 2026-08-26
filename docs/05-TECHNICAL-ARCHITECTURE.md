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
  Menus

Phaser
  Motel room
  Window/street
  Café
  Work/physical scenes
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

Persistence
  Versioned save/load
```

---

## 4. Golden rule

> **Simulation never imports React, Phaser, or Ink runtime UI code.**

Domain systems should be testable without rendering the game.

React and Phaser may depend on application/domain interfaces.

Narrative adapter may read/write through a controlled simulation API.

---

## 5. Suggested repository layout

```text
src/
  app/
    App.tsx
    routes/
    bootstrap/

  simulation/
    SimulationEngine.ts
    GameClock.ts
    state/
    actions/
    systems/
      downloads/
      software/
      economy/
      characters/
      schedules/
      world/
      events/

  computer/
    desktop/
    windows/
    apps/
      browser/
      messenger/
      file-manager/
      installer/
      terminal/
      settings/

  world/
    PhaserGame.ts
    scenes/
    location-runtime/
    hotspots/
    ambient/

  narrative/
    NarrativeRuntime.ts
    InkAdapter.ts
    effects/
    compiled/

  content/
    characters/
    software/
    websites/
    locations/
    schedules/
    events/
    economy/

  persistence/
    db.ts
    save-schema.ts
    migrations.ts

  ui/
    hud/
    notifications/
    debug/

  styles/
    tokens.css
    os-old.css
    os-new.css
    websites/

narrative/
  main.ink
  characters/
  arcs/
  ambient/

tests/
  unit/
  integration/
  e2e/
```

Exact names can differ. Preserve the boundaries.

---

## 6. Simulation engine

Suggested interface:

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
- meetings.

Do not manually update each subsystem after time jumps.

---

## 7. Game state

Use a versioned serializable state.

High-level:

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
  events: EventState;
  narrative: NarrativeState;
}
```

Avoid storing React component state as authoritative game state.

---

## 8. Zustand

Use Zustand for:
- UI/window/view coordination,
- subscriptions to simulation state,
- transient presentation state.

Do not make it the only place where domain rules live.

A reasonable pattern:
- simulation engine owns serializable domain state,
- Zustand exposes selected state and dispatch helpers to React.

---

## 9. Zod

Validate:
- content files,
- save data,
- narrative effect tags,
- software definitions,
- website definitions,
- location definitions.

Fail loudly in development for invalid content.

---

## 10. Persistence

Use IndexedDB through Dexie.

Persist:
- versioned save state,
- message history,
- installed programs,
- downloads,
- files,
- browser changes,
- narrative state,
- window observations.

Use localStorage only for:
- volume,
- UI scale,
- accessibility settings,
- developer flags.

Autosave:
- sleep,
- work completion,
- purchase,
- install/uninstall,
- major narrative beat,
- periodic interval.

---

## 11. Save migrations

Every save includes:
- schema version,
- created timestamp,
- updated timestamp,
- optional seed.

Migrations must be explicit.

The evaluation build should include at least a simple migration framework even if only one version exists initially.

---

## 12. Determinism

Use seeded randomness for ambient/systemic content that affects saved outcomes.

Goals:
- reproducible tests,
- stable save/load,
- fewer "why did this change after refresh?" bugs.

Purely cosmetic random animation need not be saved.

---

## 13. Fake browser

Do not use real iframe navigation.

The browser maps a fictional URL to an internal page component/content record.

Website content can be React components or data-driven renderers.

The browser owns:
- navigation history,
- address text,
- bookmarks,
- home page.

The simulation owns:
- unlocks,
- dynamic content flags,
- download tasks,
- purchases.

---

## 14. Window manager

Required:
- open
- close
- minimize
- focus/z-order
- drag

Resize is optional if it increases risk.

Closing UI does not destroy domain state.

---

## 15. Phaser integration

Phaser receives:
- location definition,
- current time band,
- weather,
- world entities,
- interaction availability.

Phaser emits:
- hotspot clicked,
- location action,
- travel intent.

Do not use Phaser `update()` as the single source of game time.

---

## 16. Runtime tick

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
- explicit time jumps.

---

## 17. Pause

An explicit game pause/settings state may stop simulation.

Opening:
- browser,
- Messenger,
- terminal,
does not pause time.

---

## 18. No external dependency for core play

The evaluation build must remain playable if:
- public internet is unavailable,
- external AI service is unavailable,
- analytics is unavailable.

All game content is local.

---

## 19. Performance

This is a 2D, text-heavy game.

Prioritize:
- responsive input,
- fast window operations,
- no unnecessary re-renders,
- efficient image loading,
- lazy loading larger location assets.

Do not prematurely introduce:
- ECS,
- microservices,
- complex DI containers,
- server database,
- event-bus maze.

Readable TypeScript wins.

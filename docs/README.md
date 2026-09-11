# Mid-2000s Internet Life Sim — Evaluation Build Docs

**This package contains exactly 11 core files.**

It defines a complete playable evaluation version of the game, not a commercial shipping build and not a small vertical slice.

## Read order

1. `00-VISION-AND-EVALUATION.md`
2. `01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md`
3. `02-WORLD-ART-AND-PRESENTATION.md`
4. `03-COMPUTER-OS-AND-SOFTWARE.md`
5. `04-INTERNET-SOCIAL-AND-NARRATIVE.md`
6. `05-TECHNICAL-ARCHITECTURE.md`
7. `06-CONTENT-DATA-AND-INK.md`
8. `07-IMPLEMENTATION-AND-ACCEPTANCE.md`
9. `08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md`
10. `09-MANUS-RUN-CONSTRAINTS.md`

This README is the eleventh core file.

Detailed implementation specs/plans under `docs/superpowers/` supplement these core documents and may grow independently.

Current cross-cutting architecture supplements:
- `docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`
- `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md`
- `docs/superpowers/plans/2026-09-10-orion-salvage-roadmap.md`
- `docs/superpowers/plans/2026-09-10-life-matrix-foundation.md`

## Goal

Build a complete small game that can answer whether the concept is worth continuing.

Target:
- roughly 14 in-game days,
- beginning → progression → midpoint → physical social meeting → evaluation ending,
- enough content and systems to judge the lived experience,
- provisional art is allowed,
- final art direction is intentionally not frozen.

## Canonical stack

- TypeScript — strict
- Vite
- React + DOM + CSS
- Phaser 4.x
- Ink + inkjs
- Zustand
- Zod
- Dexie / IndexedDB
- Vitest
- Playwright

Not required for the evaluation build:
- backend,
- runtime LLM,
- Electron,
- Tauri,
- real external websites,
- real host filesystem access.

## Highest-priority architecture rule

> **Rendering observes simulation; rendering does not create reality.**

The pure TypeScript simulation owns:
- time,
- money,
- energy,
- PC hardware,
- files,
- downloads,
- software state,
- character routine/schedule truth,
- hidden relationships, directed NPC bonds and affinity,
- memories/promises and social outcomes,
- appointments and jobs/work outcomes,
- world events and character knowledge,
- Life Matrix projections, source-backed obligations and semantic CharacterIntents,
- world state,
- district/place geography,
- transit service state,
- player/NPC travel plans and active trips,
- fares, waits, transfers, and arrival timing,
- coherent physical/transit/device/online presence projections.

React, Phaser, and Ink present or interact with that truth.

## Canonical town model

> **One simulated town, organized into districts, connected by local walking and real bus lines, presented through authored living places.**

This means:
- districts are geographic/social groupings, not levels or separate simulations;
- the game does not require a continuous open-world/WASD city;
- bus stops, lines, service windows, waits, fares, transfers, and disruptions are simulation/content truth rather than UI shortcuts;
- player and NPC mobility share the same travel network wherever practical;
- a bus stop may be a normal one-view living place and a bus interior may be a reusable contextual living scene;
- place/route knowledge can be discovered gradually without changing whether those places/routes physically exist.

See `08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` for the complete direction.

## Canonical living-character model

> **Life Matrix orchestrates what a person intends to do; it does not replace the Away systems that already own relationships, appointments, jobs, events, commerce, or travel.**

Away already has substantial character/social machinery. Preserve it and build on it:

```text
SocialEngine
  = relationships, directed NPC bonds, affinity, traits,
    memories/promises and social consequences

Appointment / Job / WorldEvents / Delivery authorities
  = their own source records and consequences

TransitNetwork
  = route/service/wait/fare/travel-time truth

Life Matrix
  = routine pressure + source-backed obligations
    + lightweight NPC pressure/goals
    + deterministic semantic CharacterIntent
```

The useful Orion concepts are therefore integrated selectively:
- routine becomes pressure/flexible intent rather than a teleport command;
- obligations reference their source authority instead of copying its outcome state;
- important NPCs may have lightweight state pressure and a small set of personal goals;
- schedules create preparation/departure/travel/arrival continuity;
- local/remote/in-transit are states of the same person identity;
- physical/device/messenger presence must remain mutually coherent;
- world events can publish bounded modifiers consumed by the owning domains;
- later encounter surfacing may choose among truthful co-located opportunities, but may not spawn reality for dramatic convenience.

Do **not** import Orion's continuous isometric village, WASD city traversal, per-meter whole-town NPC simulation, duplicate relationship graph, duplicate appointment/job/delivery/event stores, or LLM-owned canonical life decisions.

See `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md` for the salvage matrix and `docs/superpowers/plans/2026-09-10-orion-salvage-roadmap.md` for sequencing.

## Cross-project rules

### Provider neutrality

The game specification must remain usable by any implementation workflow.

Only `09-MANUS-RUN-CONSTRAINTS.md` contains provider-specific execution constraints.

### Complete evaluation build, not shipping build

Do not spend evaluation time on:
- Steam integration,
- achievements,
- cloud infrastructure,
- final localization,
- production analytics backend,
- final soundtrack,
- commercial packaging,
- production-scale content quantity.

### Background continuity

No major system may depend on currently being visible.

Examples:
- downloads continue with the browser closed,
- contacts change status with Messenger closed,
- messages can arrive while the player is away,
- street state changes while the player uses the computer,
- NPCs can be traveling between districts while no physical scene shows them,
- an NPC may be preparing for or executing a real obligation while the player is elsewhere,
- sleep/work/time-jumps advance all systems through the same authoritative simulation path.

### Web-first separation

**React / DOM**
- fake OS
- browser
- Messenger
- email
- installers
- terminal
- file manager
- town/district navigation and readable travel choices
- menus

**Phaser**
- motel room
- window/street
- café
- work/physical locations
- bus stops and optional bus-interior presentation
- layered 2D presentation
- ambient motion and effects

**Pure TypeScript simulation**
- relationships/social consequences through existing social authority
- Life Matrix projection, obligations and CharacterIntent
- district/place/transit definitions projected from generated content
- route planning
- walking/bus timing
- service availability
- active travel
- player/NPC presence and arrival truth
- world-event modifiers consumed through domain boundaries

**Ink**
- authored prose
- branching dialogue
- narrative choices
- semantic narrative tags

### Ink is not the world database

Ink may read approved simulation context and emit validated semantic effects.

Do not duplicate authoritative money, time, hardware, download, schedule, relationship, obligation, character intent, district, route, travel, appointment, job, event, item, or presence truth inside Ink.

### Art style remains provisional

Do not lock:
- pixel art vs illustrated,
- final resolution,
- final character rendering,
- final palette.

Do lock:
- layered location architecture,
- time-of-day support,
- modular ambient elements,
- replaceable character presentation slots,
- data-driven art references,
- authored-place presentation instead of open-world traversal.

### Do not fake core systems

A core mechanic must be backed by real state.

Bad examples:
- decorative download bar with no download task,
- fake RAM label that changes nothing,
- installer animation with no compatibility/install state,
- contact that only goes online when Messenger opens,
- bus animation whose fare/time/arrival is invented by the renderer,
- NPC appearing in another district because a UI screen changed,
- Life Matrix declaring a meeting successful instead of the appointment owner,
- copying a relationship score into a separate life-system graph and letting the copies drift.

### Prefer data-driven content

New software, characters, routine definitions, websites, districts, locations, transit stops/lines, life-policy definitions, goals/templates, and observations should be addable through focused definitions without rewriting unrelated systems where the data is authorable.

Per-save mutable state — current relationships, active goals/obligations when irreducible, active travel, item instances, event state — remains simulation/save truth, not content-table truth.

### Keep architecture simple

Do not introduce without proven need:
- ECS,
- complex DI container,
- microservices,
- server database,
- real network dependency,
- runtime LLM,
- desktop wrapper,
- traffic simulation,
- vehicle physics,
- GTFS-scale transit infrastructure,
- GOAP/general-purpose planner,
- monolithic LifeMatrixEngine owning unrelated domains.

### Breadth before polish

Reach an end-to-end playable beginning-to-ending build before deeply polishing one app or location.

The final implementation phase is for:
- bug fixing,
- pacing,
- persistence reliability,
- content validation,
- test completion,
- cleanup.

Do not add major new systems during final verification.

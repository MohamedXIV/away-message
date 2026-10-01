# Away Message — Open-Ended Sandbox Docs

**This package contains exactly 14 core files.**

It defines the current open-ended sandbox product direction. Historical evaluation-era material must not be treated as current product authority.

## Read order

1. `00-VISION-AND-SANDBOX.md`
2. `01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md`
3. `02-WORLD-ART-AND-PRESENTATION.md`
4. `03-COMPUTER-OS-AND-SOFTWARE.md`
5. `04-INTERNET-SOCIAL-AND-NARRATIVE.md`
6. `05-TECHNICAL-ARCHITECTURE.md`
7. `06-CONTENT-DATA-AND-NARRATIVE.md`
8. `07-IMPLEMENTATION-AND-ACCEPTANCE.md`
9. `08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md`
10. `09-MANUS-RUN-CONSTRAINTS.md`
11. `10-RESIDENCE-HOUSING-AND-SPACE-PROGRESSION.md`
12. `11-SPATIAL-PRESENCE-VENUES-AND-ACTOR-PRESENTATION.md`
13. `12-ENVIRONMENT-PLAYER-NEEDS-AND-MOOD.md`

This README is the fourteenth core file.

Detailed implementation specs/plans under `docs/superpowers/` supplement these core documents and may grow independently.

Current cross-cutting architecture supplements:
- `docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`
- `docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md`
- `docs/superpowers/plans/2026-09-10-orion-salvage-roadmap.md`
- `docs/superpowers/plans/2026-09-10-life-matrix-foundation.md`
- `docs/superpowers/plans/2026-10-01-environment-needs-mood-foundation.md`

## Goal

Build an open-ended life sandbox where the player can keep living, working, upgrading, browsing, moving, meeting people and changing relationships without a scripted final day.

There is no mandatory named NPC, romance route, café meeting, or named-character progression path. Named characters may exist as ordinary authored inhabitants or temporary fixtures, but systems must resolve actors through roles, capabilities, relationships, location, knowledge and current state.

## Canonical stack

- TypeScript — strict
- Vite
- React + DOM + CSS
- Phaser 4.x
- Zustand
- Zod
- Dexie / IndexedDB
- Vitest
- Playwright

Not required for the core sandbox:
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
- current Residence/Tenancy state,
- district/place geography,
- canonical player/NPC physical spatial truth including future-ready XYZ where implemented,
- local purpose/activity/venue participation as separate state from physical location,
- transit service state,
- player/NPC travel plans and active trips,
- fares, waits, transfers, and arrival timing,
- coherent physical/transit/device/online presence projections.

React, Phaser, and Ink present or interact with that truth.

## Active authority correction — #128–#132

The next foundation pass intentionally changes some current implementation boundaries before more systems depend on them.

Target ownership:

- **Environment** resolves deterministic base weather plus typed WorldEvents modifiers into one semantic snapshot/forecast.
- **Finance** owns cash/rent/bills/payments rather than the player's body.
- **Player Needs** owns energy, fatigue, hunger, health, sleep debt and social battery.
- **Mood** is a separate explainable state built from contextual influences plus bounded transient semantic effects.
- **Game Context** becomes the stable read-only boundary used by apps, Phaser/audio, Inner Voice and future systems.

Current `WeatherEngine` and combined `EconomyEngine` behavior are migration input during this work, not permanent product authority. Do not build new consumers around those accidental seams.

See `12-ENVIRONMENT-PLAYER-NEEDS-AND-MOOD.md`, the 2026-10-01 foundation roadmap, and #128–#132.

## Canonical residence model

> **The player's home is the current residence, not a sacred room ID.**

This means:
- Room 104 may remain an authored/reference motel room, but is not the guaranteed starting or permanent home;
- `home` resolves from Residence/Tenancy state to a canonical Place;
- the player may start from a small set of affordable rooms with real trade-offs;
- a cheapest-valid room may have no private bathroom and no kitchenette;
- landlord/motel-owned fixtures may affect rent and remain with the property;
- player-owned belongings are physical item instances that can move with the player;
- later progression may move the player to a better motel room or a small authored apartment elsewhere in town;
- residences reuse the same generic `Place → Space → View → Focus → Anchor` runtime as other physical locations.

Important living-space art should normally use:

```text
3D blockout / spatial reference
→ authored camera views
→ Gen-AI generation / paint pass
→ separate stateful/replaceable layers where needed
→ Phaser 4 composition
```

The blockout is production reference, not a realtime-3D runtime decision.

See `10-RESIDENCE-HOUSING-AND-SPACE-PROGRESSION.md` and #85–#88.

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

## Canonical spatial / venue / actor-presentation model

> **WHERE, WHY/WHAT, and HOW IT IS SHOWN are separate concerns.**

The approved bridge is:

```text
Life Matrix / CharacterIntent
= WHY / WHEN

Spatial presence
= WHERE in one future-ready XYZ town-space

Venue operations / ActivityInstance
= WHAT the actor is doing locally and what the place can currently provide

Authored View presentation
= HOW the actor/place appears to the player
```

This means:
- physical actors may use canonical `{ x, y, z }` world positions; `z` exists for future floors/height but is normally `0` today;
- current mostly single-floor interiors may keep positions consistent with the surrounding town/district coordinate space;
- Place/Space membership is derived from authored containment/bounds rather than being invented by a renderer trigger;
- enter/exit triggers are useful derived events, not physical-location authority;
- purpose/activity/role remain separate from location — the same café position may mean work, leisure, shopping, meeting, waiting, or sheltering from rain;
- Life Matrix keeps WHY/WHEN authority; venue operations only resolve locally available roles/stations/services/resources and bounded activity phases;
- anchors/stations are semantic occupancy/interaction points, not pathfinding/navmesh nodes;
- player and NPCs still move between authored places through semantic travel, not free movement;
- persistent actors may render as a full puppet, silhouette, lightweight/background representation, or hidden state based on camera mode + view-relative distance/depth + focus;
- silhouette tiering should not require town-coordinate-to-screen projection math;
- clicking a real actor silhouette resolves the same actor identity and knowledge-safe contextual interactions;
- interaction may promote a silhouette to full character presentation without changing simulation identity.

See `11-SPATIAL-PRESENCE-VENUES-AND-ACTOR-PRESENTATION.md` and #92–#95.

## Pre-release save policy

Until the project explicitly declares a save-compatibility freeze for a content-complete Alpha/Beta/release milestone, **historical development saves are disposable**.

Breaking persisted-state changes may invalidate/reset old dev saves instead of preserving obsolete fields, aliases, dual authorities, or migration chains.

The current save version still needs to validate and round-trip correctly, and incompatible/newer saves must be refused cleanly rather than silently corrupted.

After an explicit future freeze, migrations become mandatory from the supported baseline forward.

`AGENTS.md` is the workflow authority for this policy.

## Cross-project rules

### Provider neutrality

The game specification must remain usable by any implementation workflow.

Only `09-MANUS-RUN-CONSTRAINTS.md` contains provider-specific execution constraints.

### Sandbox scope, not shipping ceremony

Do not spend sandbox-development time on:
- Steam integration,
- achievements,
- cloud infrastructure,
- final localization,
- production analytics backend,
- final soundtrack,
- commercial packaging,
- production-scale content quantity.

The goal is breadth, coherence and long-running systemic life—not a scripted campaign completion.

### Background continuity

No major system may depend on currently being visible.

Examples:
- downloads continue with the browser closed,
- contacts change status with Messenger closed,
- messages can arrive while the player is away,
- street state changes while the player uses the computer,
- residence/tenancy truth remains stable regardless of which view is rendered,
- NPCs can be traveling between districts while no physical scene shows them,
- an NPC may be preparing for or executing a real obligation while the player is elsewhere,
- an actor may continue a bounded venue activity while the Place is offscreen,
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
- housing/listing/tenancy presentation where appropriate
- menus

**Phaser**
- current residence
- window/street
- café
- work/physical locations
- bus stops and optional bus-interior presentation
- layered 2D/2.5D presentation
- full-character/silhouette/background actor projection for the active authored view
- ambient motion and effects

**Pure TypeScript simulation**
- relationships/social consequences through existing social authority
- Life Matrix projection, obligations and CharacterIntent
- Residence/Tenancy truth
- district/place/transit definitions projected from generated content
- actor spatial position + derived physical containment where implemented
- venue role/station/activity truth where irreducible
- route planning
- walking/bus timing
- service availability
- active travel
- player/NPC presence and arrival truth
- world-event modifiers consumed through domain boundaries

**Governed narrative / AI surfaces**
- optional authored prose and semantic narrative data
- AI-paraphrased dialogue where enabled
- validated semantic effects only
- no ownership of canonical simulation truth

### Narrative text is not the world database

Authored or AI-generated narrative text may read approved simulation context and may emit only validated semantic effects.

Do not duplicate authoritative money, time, hardware, download, schedule, relationship, obligation, character intent, residence, district, route, travel, appointment, job, event, item, spatial location, venue activity, or presence truth inside Ink.

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
- replaceable/stateful residence visual layers where gameplay requires them,
- replaceable character presentation slots,
- bounded silhouette/background actor representation for populated views,
- data-driven art references,
- authored-place presentation instead of open-world traversal,
- 3D-blockout-as-reference rather than runtime 3D for the current art pipeline.

### Do not fake core systems

A core mechanic must be backed by real state.

Bad examples:
- decorative download bar with no download task,
- fake RAM label that changes nothing,
- installer animation with no compatibility/install state,
- contact that only goes online when Messenger opens,
- a hard-coded `home -> room_104` alias treated as permanent product truth,
- a kitchenette/shower hotspot appearing in a room that does not actually provide that facility,
- a rug/PC/parcel baked into a full-room image while domain state says it moved,
- bus animation whose fare/time/arrival is invented by the renderer,
- NPC appearing in another district because a UI screen changed,
- actor `placeId` changing only because a Phaser overlap fired while canonical position says otherwise,
- `AtWork` being used as a substitute for both physical location and activity state,
- a venue graph inventing employment, relationships, route timing, money or item ownership,
- a silhouette creating or deleting a persistent actor because camera distance changed,
- Life Matrix declaring a meeting successful instead of the appointment owner,
- copying a relationship score into a separate life-system graph and letting the copies drift.

### Prefer data-driven content

New software, characters, routine definitions, websites, districts, locations, residence-capable places, fixture/capability definitions, transit stops/lines, spatial bounds/entry positions, venue roles/stations/services/activity templates, presentation camera modes/actor-placement metadata, life-policy definitions, goals/templates, and observations should be addable through focused definitions without rewriting unrelated systems where the data is authorable.

Per-save mutable state — current relationships, current Residence/Tenancy, active goals/obligations when irreducible, actor XYZ/activity state, active travel, item instances, event state — remains simulation/save truth, not content-table truth.

### Keep architecture simple

Do not introduce without proven need:
- ECS,
- complex DI container,
- microservices,
- server database,
- real network dependency,
- desktop wrapper,
- traffic simulation,
- vehicle physics,
- GTFS-scale transit infrastructure,
- GOAP/general-purpose planner,
- monolithic LifeMatrixEngine owning unrelated domains,
- city navmesh/per-meter actor pathfinding,
- general town-coordinate-to-screen projection engine merely for silhouettes,
- realtime 3D world/residence runtime merely because 3D blockouts are used for visual production.

### Breadth before polish

Reach an end-to-end playable beginning-to-ending build before deeply polishing one app, one room, or one location.

The final implementation phase is for:
- bug fixing,
- pacing,
- current-format persistence reliability,
- content validation,
- test completion,
- cleanup.

Do not add major new systems during final verification.
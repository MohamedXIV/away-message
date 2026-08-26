# Mid-2000s Internet Life Sim — Evaluation Build Docs

**This package contains exactly 10 files.**

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
9. `09-MANUS-RUN-CONSTRAINTS.md`

This README is the tenth file.

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
- character schedules,
- hidden relationships,
- appointments,
- events,
- world state.

React, Phaser, and Ink present or interact with that truth.

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
- websites
- menus

**Phaser**
- motel room
- window/street
- café
- work/physical locations
- layered 2D presentation
- ambient motion and effects

**Ink**
- authored prose
- branching dialogue
- narrative choices
- semantic narrative tags

### Ink is not the world database

Ink may read approved simulation context and emit validated semantic effects.

Do not duplicate authoritative money, time, hardware, download, schedule, or relationship truth inside Ink.

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
- data-driven art references.

### Do not fake core systems

A core mechanic must be backed by real state.

Bad examples:
- decorative download bar with no download task,
- fake RAM label that changes nothing,
- installer animation with no compatibility/install state,
- contact that only goes online when Messenger opens.

### Prefer data-driven content

New software, characters, schedules, websites, locations, and observations should be addable through focused definitions without rewriting unrelated systems.

### Keep architecture simple

Do not introduce without proven need:
- ECS,
- complex DI container,
- microservices,
- server database,
- real network dependency,
- runtime LLM,
- desktop wrapper.

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

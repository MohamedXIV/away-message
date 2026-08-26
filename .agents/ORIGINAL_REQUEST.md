# Original User Request

## Initial Request — 2026-08-22T02:49:41+03:00

Build a complete, playable 14-day evaluation build of the mid-2000s Internet Life Sim ("Away Message") strictly following the specifications in `docs/`. The game combines an authoritative pure TypeScript simulation of time, money, and computing with React/DOM fake desktop OS/websites, Phaser 2D layered physical scenes, compiled Ink narrative social arcs, and robust local persistence.

Working directory: f:/_WIP/away-message
Integrity mode: development

## Reference Material
- Specifications and acceptance guidelines in `docs/` (`00-VISION-AND-EVALUATION.md` through `07-IMPLEMENTATION-AND-ACCEPTANCE.md`, `README.md`).

## Requirements

### R1. Authoritative Continuous Simulation Engine
Implement a centralized simulation engine that owns time, player finances, energy, hardware specifications, running software, download tasks, file system records, character schedules, hidden relationship dimensions, appointments, and world state. All systems must advance through the same authoritative timeline during real-time play, background execution across views, and in-game time jumps (tea, shower, work shifts, sleep).

### R2. Diegetic Computer & Operating System Ecosystem
Provide a simulated PC environment featuring two distinct OS generations (Orion OS 4.8 and Orion OS 6.x) with authentic retro desktop shells, window management (open, close, minimize, drag, z-index), file management, data-driven installers with optional bundled components/toolbars, Add/Remove Programs, a functioning terminal utility, and software requirements gating (RAM, CPU tier, OS compatibility).

### R3. Fake Internet & Exploration Network
Deliver a local browser routing to 15+ distinct, period-authentic websites (search engine, software directory, classifieds/auctions, hardware store, webmail, message boards, local news, job listings, and digital gold exchange) featuring free-text search indexing, cross-site narrative rabbit holes, and real simulated file downloads that run continuously in the background.

### R4. Authored Narrative, Social Progression & Physical World
Implement an Ink-driven narrative engine communicating with the simulation via semantic effect and social action tags. Model deterministic character schedules and multi-dimensional hidden relationships (familiarity, trust, comfort, respect, annoyance) across major character arcs (Ryan, Maya, Nora). Support 2D layered physical locations (motel room, window observations, street, workplace, café) with time-of-day variations and real-world scheduled meetings.

### R5. Persistence, Telemetry & Automated Verification Harness
Persist all game state, message histories, downloaded files, installed software, and narrative progression in IndexedDB via Dexie with schema versioning. Include a local evaluation telemetry exporter and a comprehensive automated test suite (Vitest unit/integration tests, content validation, and Playwright end-to-end scenarios covering the 14-day loop).

## Acceptance Criteria

### Continuous Simulation & Architecture
- [ ] A single authoritative simulation clock drives all game systems across both PC and physical world views.
- [ ] Downloads, contact schedules, and incoming messages continue progressing when the browser or Messenger windows are closed and when the player is away from the PC.
- [ ] Explicit in-game time jumps (sleep, work, making tea, showering, window viewing) advance all subsystems via the unified simulation engine.
- [ ] No domain simulation state is owned directly by UI components (React, Phaser, or Ink).

### Computer & Software Progression
- [ ] Starting PC configuration matches initial spec (Orion OS 4.8, 512 MB RAM, 40 GB HDD, 256 kbps DSL) with Voyager Browser preinstalled and Pulse Messenger uninstalled.
- [ ] Software downloads create persistent file records in the simulated filesystem that can launch interactive installers.
- [ ] Installers validate system requirements, occupy disk space, create application shortcuts, and register in Add/Remove Programs (excluding portable apps).
- [ ] Bundled software options (e.g. WeatherBuddy extras/SearchMate) modify browser settings and startup behavior, which can be cleanly uninstalled or remediated via SafeSweep.
- [ ] Upgrading hardware (RAM, storage, internet tier) and installing Orion OS 6 unlocks newer applications (e.g. PhotoBox, newer Pulse features) and reduces download times.
- [ ] Terminal utility executes core commands (`help`, `dir`, `cd`, `type`, `cls`, `ping`, `ipconfig`) against the simulated filesystem and network.

### Social Simulation & Narrative Arcs
- [ ] Messenger displays contacts with schedule-driven statuses (online, away, offline) and typing indicators.
- [ ] Contacts can initiate conversations independently or send messages while the player is away.
- [ ] Hidden relationship dimensions update strictly through semantic social actions without visible numeric progress bars.
- [ ] Ink narrative is compiled to JSON, validated, and gated by simulation state; semantic effect tags reliably trigger simulation actions (e.g. scheduling appointments).
- [ ] Physical social meeting at the café executes with time advancement and causes tangible changes in subsequent online conversations.

### Fake Internet & Discovery
- [ ] Local browser resolves 15+ internal websites without external network dependencies.
- [ ] Free-text search matches keywords to relevant curated pages, updating dynamically as in-game days progress.
- [ ] At least two multi-step rabbit holes (software recommendations and user identity discovery) are fully discoverable and traversable.

### Economy, Progression & Ending
- [ ] Work shifts consume scheduled time, deplete energy, and grant income.
- [ ] Motel rent and internet bills create recurring financial decisions where player must manage trade-offs between hardware upgrades and obligations.
- [ ] The full 14-day evaluation story arc can be played from Day 1 to the Day 14 evaluation completion screen in a single continuous save.
- [ ] After Day 14 completion, the player can continue in free-play mode.

### Persistence & Verification
- [ ] Game state, files, installed apps, messages, and narrative progress serialize and restore losslessly via IndexedDB across browser reloads.
- [ ] Automated Vitest suite passes all unit and integration tests for clock, downloads, installer, schedules, economy, relationships, and content schema validation.
- [ ] Playwright E2E test suite executes and passes core scenarios (A: Core download/install/chat loop, B: Software literacy & toolbar cleanup, C: OS 6 upgrade & PhotoBox unlock, D: Social meeting at café, E: Save/reload state fidelity, F: Day 1 to Day 14 end-to-end completion).
- [ ] Local telemetry data can be exported as JSON capturing playtime, days completed, upgrade history, and narrative milestones.

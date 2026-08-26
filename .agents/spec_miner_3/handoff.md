# Handoff Report — Spec Miner 3 (Narrative Architecture & Testing Strategy)

**Agent**: `spec_miner_3` (Specification Miner)  
**Parent**: `orchestrator_1` (39d67808-5c38-467e-ba13-2fc112f01e1c)  
**Deliverable Artifact**: `f:/_WIP/away-message/.agents/spec_miner_3/analysis.md`  
**Date**: 2026-08-22  

---

## 1. Observation

Direct observations from authoritative specifications:
1. `docs/00-VISION-AND-EVALUATION.md` (lines 305–311, 422–610):
   - Establishes the 14-day evaluation structure: Days 1–3 opening loop (work shift, Pulse download, tea/window waiting, first Ryan chat, PhotoBox failure, WeatherBuddy/SearchMate toolbar); Days 4–6 internet expansion (FindIt, CityWire, BidBay, NightBoard forum rabbit hole, used RAM listing, Nora/NightOwl87 introduction); Day 7 weekly motel rent due ($140–$160); Days 8–9 hardware RAM upgrade (1GB) and Orion OS 6 transition unlocking PhotoBox 3.0; Day 10 Maya café invitation; Days 11–12 physical café meeting and online aftermath; Day 13 contained mystery rabbit hole; Day 14 evaluation checkpoint and free play transition.
2. `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` (lines 314–335, 390–420, 520–560, 565–580):
   - Mandates authored deterministic narrative using `inkjs` communicating with the pure TypeScript simulation engine via semantic tags (`# beat:...`, `# effect:...`, `# social:...`).
   - Defines 5 hidden relationship dimensions: `familiarity`, `trust`, `comfort`, `respect`, `annoyance` (and optional attraction) without visible numeric feedback.
   - Defines major evaluation character arcs: Ryan (`ryan_foodcart`), Maya (`starlight_maya`), Nora (`NightOwl87`), Mr. Henderson (`motel_office`).
3. `docs/02-WORLD-ART-AND-PRESENTATION.md` (lines 45–100, 279–320):
   - Specifies Phaser 2D layered location architecture: Background, Midground, Foreground, Interactive Props, Character Layer, Ambient Animated Layers, Lighting Overlays, and 5 Time-of-day variants (`morning`, `day`, `evening`, `night`, `late_night`).
   - Defines room interactables (PC Desk, Bed, Kettle, Window, Door) and persistent street entities (repeated man in tan jacket, cleaner, recurring car).
4. `docs/06-CONTENT-DATA-AND-INK.md` (lines 163–245):
   - Specifies Ink build pipeline: `narrative/*.ink` compiled to JSON, loaded by `inkjs`, reading injected read-only context variables from simulation, and emitting validated semantic effect tags.
5. `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` (lines 397–500):
   - Mandates comprehensive automated testing: pure TypeScript Vitest unit/integration suites (clock, downloads, software requirements gating, schedules, economy, relationships, persistence round-trip) and Playwright E2E 4-Tier test architecture (Tier 1: Feature Coverage; Tier 2: Boundary & Corner Cases; Tier 3: Cross-Feature Combinations; Tier 4: Real-World Scenarios).
6. `ORIGINAL_REQUEST.md` (lines 15–69):
   - Reaffirms acceptance criteria: authoritative continuous simulation clock, zero-mock criteria, background continuity across views, 14-day playable loop with telemetry JSON export.

---

## 2. Logic Chain

1. **Narrative-Simulation Decoupling**: Observation (2) & (4) prove that Ink must never own authoritative simulation truth (money, time, hardware, downloads, schedules, or raw relationship numbers). Ink receives read-only context state and emits validated semantic tags (`# effect:...` and `# social:...`). The simulation engine processes these tags into state changes.
2. **Day-by-Day Progression Pacing**: Observation (1) structures the 14 days into distinct thematic phases: Opening (Days 1–3) $\rightarrow$ Expansion (Days 4–6) $\rightarrow$ Economic Pressure (Day 7) $\rightarrow$ Hardware/OS Transition (Days 8–9) $\rightarrow$ Social Climax & Physical Meeting (Days 10–12) $\rightarrow$ Contained Mystery (Day 13) $\rightarrow$ Resolution & Free Play (Day 14).
3. **Physical Staging in Phaser**: Observation (3) dictates that Phaser scenes observe simulation time and state without owning the clock. Window observations and room actions execute deterministic time jumps (e.g. tea: 6 min, shower: 12 min, café: 75 min) that advance the unified simulation engine.
4. **4-Tier E2E Testing Strategy**: Observation (5) & (6) demand a zero-mock testing strategy. Tier 1 guarantees feature coverage ($\ge 5$ tests per feature domain); Tier 2 guarantees boundary/edge handling ($\ge 5$ tests per domain); Tier 3 validates cross-feature workflows (e.g. background download + tea + chat, WeatherBuddy infection + SafeSweep cleanup); Tier 4 validates full 14-day golden and alternative playthroughs.

---

## 3. Caveats

- **Provisional Art Direction**: Visual styling in the evaluation build (pixel art vs 2D illustrated) is deliberately provisional and not frozen per `docs/02-WORLD-ART-AND-PRESENTATION.md`. The asset architecture (layers, hotspots, time variants) is strictly frozen.
- **Provider Media Constraints**: Provider-specific generation quotas in `docs/09-MANUS-RUN-CONSTRAINTS.md` do not alter the engine-agnostic game specification or acceptance criteria.

---

## 4. Conclusion

The authoritative specification for the 14-day narrative architecture, buddy character profiles, Ink engine integration, 2D physical bedroom scenes, evaluation endings, and the 4-Tier automated testing strategy has been completely extracted and documented in `f:/_WIP/away-message/.agents/spec_miner_3/analysis.md`. The design is fully validated, deterministic, decoupled, and ready for test-driven implementation.

---

## 5. Verification Method

1. **Inspect Analysis Document**:
   - Verify `f:/_WIP/away-message/.agents/spec_miner_3/analysis.md` contains the complete 14-day arc table, buddy profile matrix, Ink variable and tag specification, Phaser scene layer diagram, and 4-tier Playwright testing matrices.
2. **Schema & Cross-Reference Check**:
   - Compare `analysis.md` narrative beats against `docs/00-VISION-AND-EVALUATION.md` §4 and testing specifications against `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` §9–11.
3. **Execution Plan Validation**:
   - Ensure the Vitest test suites and Playwright E2E scenarios map 1:1 to the acceptance criteria defined in `ORIGINAL_REQUEST.md`.

## 2026-08-26T00:53:00Z

You are Worker 3 (Milestone 5 Playwright E2E & Telemetry Test Suite).
Your working directory is `f:/_WIP/away-message/.agents/worker_m5_e2e/`.
You MUST read `f:/_WIP/away-message/.agents/ORIGINAL_REQUEST.md` first before starting work.
Also read `f:/_WIP/away-message/PROJECT.md`, `f:/_WIP/away-message/TEST_INFRA.md`, `f:/_WIP/away-message/.agents/spec_miner_m5_1/analysis.md`, and `f:/_WIP/away-message/.agents/spec_miner_m5_1/handoff.md`.

## Exclusive File Ownership
You exclusively own:
- `tests/e2e/` (all files: `fixtures/`, `helpers/`, `tier1_features/`, `tier2_boundaries/`, `tier3_combinations/`, `tier4_scenarios/`)
- `playwright.config.ts` (if needed for test runner configuration)
- Exposing test simulation helpers (e.g. `window.__simEngine` fast-forward hook in `src/main.tsx` if needed for high-speed E2E test runs)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective & Implementation Requirements
1. **Playwright E2E Infrastructure & Fixtures**:
   - Set up `tests/e2e/fixtures/testFixture.ts` and helpers for interacting with Orion OS Desktop, Window Manager, Pulse Messenger, Voyager Browser, 2D Room View, Café Scene, and Day 14 Resolution Modal.
   - Support deterministic simulation fast-forwarding (`advanceGameMinutes` / `restOrSleep`) so that 14-day playthroughs run swiftly.
2. **Tier 1: Feature Coverage Tests (`tests/e2e/tier1_features/`)**:
   - Comprehensive tests for: Desktop Window Management, Dial-up / DSL connection, Voyager web browsing & fake internet sites, Pulse Messenger chatting, RetroAmp audio playback, ZipMate / FlashFetch downloads, Software installation, 2D Room view switching & interactables, Café scene dialogue, Economy & Rent payment.
3. **Tier 2: Boundary & Edge Case Tests (`tests/e2e/tier2_boundaries/`)**:
   - Gating PhotoBox on OS 4.8 / low RAM, WeatherBuddy adware injection & SafeSweep removal, Rent check failure & eviction warning, VFS disk space exhaustion, dialup disconnection during download.
4. **Tier 3: Cross-Feature Combinations (`tests/e2e/tier3_combinations/`)**:
   - Pairwise interaction tests: downloading while making tea in Room Scene, adware toolbar injection while browsing, upgraded hardware enabling high-tier software, rent deduction during sleep.
5. **Tier 4: Scenarios A through F (`tests/e2e/tier4_scenarios/`)**:
   - **Scenario A**: Core download/install/chat fantasy loop.
   - **Scenario B**: Software literacy & adware toolbar cleanup.
   - **Scenario C**: OS 6.0 upgrade & PhotoBox 3.0 unlock.
   - **Scenario D**: Physical café meeting with Maya & post-meeting relationship shift.
   - **Scenario E**: Save/reload persistence fidelity (Dexie reload retains exact state).
   - **Scenario F**: Full Day 1 to Day 14 end-to-end evaluation completion modal and Free-Play transition.
6. **Telemetry Exporter Verification**:
   - Verify `telemetry.json` export via Day 14 Resolution Modal or TelemetryEngine.
7. **Execution & Verification**:
   - Run the complete Playwright test suite (`npx playwright test`).
   - Run all Vitest suites (`npm run test:unit`, `npm run test:integration`).
   - Run production build (`npm run build`).
   - Document all test run results in `f:/_WIP/away-message/.agents/worker_m5_e2e/handoff.md`.
   - Send completion message to parent (`70c941bc-bf61-4568-bd4a-5250491d3781`).

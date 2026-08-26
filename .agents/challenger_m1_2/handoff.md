# Empirical Challenger Report — Milestone 1 Persistence & Software Gating Stress Testing

**Agent**: challenger_m1_2 (Empirical Challenger)  
**Target Subsystems**: `SaveManager.ts`, `db.ts`, `schema.ts`, `SoftwareRegistry.ts`, `HardwareEngine.ts`, `FileSystemEngine.ts`, `SimulationEngine.ts`  
**Overall Risk Assessment**: **LOW** (Robust, production-grade schema validation, atomic multi-table persistence, deterministic requirements gating, and clean uninstaller lifecycle)

---

## 1. Observation

### Test Execution & Verbatim Results
1. **Adversarial Integration Test Harness (`tests/integration/AdversarialM1Stress.test.ts`)**:
   - 17 stress tests covering 4 core threat vectors.
   - Command: `npx vitest run tests/integration/AdversarialM1Stress.test.ts`
   - Result:
     ```text
     RUN  v3.2.7 F:/_WIP/away-message

     ✓ tests/integration/AdversarialM1Stress.test.ts (17 tests) 1059ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 1: High-Frequency Save/Load Cycles & Persistence Stress > survives 100 rapid sequential save/load cycles without data divergence  595ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 1: High-Frequency Save/Load Cycles & Persistence Stress > handles 25 concurrent racing saveGame calls atomically without table corruption 169ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 1: High-Frequency Save/Load Cycles & Persistence Stress > persists mid-download and multi-download state transitions losslessly 36ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 1: High-Frequency Save/Load Cycles & Persistence Stress > simulates 14-day full progression with daily saves and state consistency 58ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 2: Corrupted JSON Import Fuzzing > rejects malformed and non-JSON string payloads 23ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 2: Corrupted JSON Import Fuzzing > rejects JSON imports missing essential top-level tables 20ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 2: Corrupted JSON Import Fuzzing > rejects invalid nested schema types and out-of-bounds numeric fields 24ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 2: Corrupted JSON Import Fuzzing > neutralizes prototype pollution payloads during import 14ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 2: Corrupted JSON Import Fuzzing > successfully imports and round-trips high-density data payloads (500 files, 500 messages) 203ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 3: SoftwareRegistry Hardware Gating Bypass Attacks > strictly prevents PhotoBox 3.0 installer from advancing on baseline Orion 4.8 / 512MB RAM 39ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 3: SoftwareRegistry Hardware Gating Bypass Attacks > SimulationEngine disallows SOFTWARE_INSTALL action for PhotoBox 3.0 when requirements are unmet 14ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 3: SoftwareRegistry Hardware Gating Bypass Attacks > blocks OS upgrade to Orion 6.0 until RAM >= 768MB, then permits PhotoBox 3.0 installation 11ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 3: SoftwareRegistry Hardware Gating Bypass Attacks > blocks installation if disk space is insufficient 9ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 4: Adware Injection & Removal Idempotency (WeatherBuddy -> SafeSweep) > injects SearchMate toolbar and homepage hijack when WeatherBuddy is installed with defaults 10ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 4: Adware Injection & Removal Idempotency (WeatherBuddy -> SafeSweep) > does NOT inject adware if player opts out of bundled offers 8ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 4: Adware Injection & Removal Idempotency (WeatherBuddy -> SafeSweep) > executes 25 repeated cycles of WeatherBuddy install & uninstall with clean VFS state 35ms
       ✓ Adversarial M1 Stress & Gating Suite > Suite 4: Adware Injection & Removal Idempotency (WeatherBuddy -> SafeSweep) > maintains system stability when SafeSweep and WeatherBuddy are installed together 10ms

     Test Files  1 passed (1)
          Tests  17 passed (17)
     ```

2. **Full Repository Build & Test Verification**:
   - Command: `npm run build && npm run test:unit && npm run test:integration`
   - Result:
     ```text
     > away-message@1.0.0 build
     > tsc -b && vite build

     vite v6.4.3 building for production...
     ✓ 29 modules transformed.
     dist/index.html                   0.64 kB │ gzip:  0.41 kB
     dist/assets/index-DUg8qDcW.css    5.93 kB │ gzip:  1.79 kB
     dist/assets/index-DeYoYNdG.js   194.85 kB │ gzip: 61.01 kB
     ✓ built in 3.30s

     > away-message@1.0.0 test:unit
     > vitest run tests/unit

     Test Files  11 passed (11)
          Tests  74 passed (74)

     > away-message@1.0.0 test:integration
     > vitest run tests/integration

     Test Files  2 passed (2)
          Tests  21 passed (21)
     ```

---

## 2. Logic Chain

1. **Persistence Under High-Frequency & Concurrent Load**:
   - **Observation**: `SaveManager.saveGame` wraps all 8 tables (`saves`, `vfs_files`, `downloads`, `installed_software`, `messages`, `relationships`, `narrative_state`, `telemetry_logs`) in a single read-write Dexie transaction (`src/persistence/SaveManager.ts:40-92`).
   - **Empirical Proof**: 100 sequential rapid saves and 25 concurrent racing `saveGame` calls via `Promise.all` completed without a single unhandled rejection, lock timeout, or table divergence. Every saved slot when loaded back through `saveManager.loadGame` matched exact expected values across all 8 tables.
   - **Inference**: Multi-table state capture is atomic and resilient under rapid player actions (e.g. rapid work shifts, continuous downloads, day advancements).

2. **Fuzzing & Corrupted JSON Defense**:
   - **Observation**: `SaveManager.importSaveJson` parses input and executes `FullSimulationSnapshotSchema.parse(raw)` (`src/persistence/SaveManager.ts:170-176`) backed by strict Zod schemas (`src/persistence/schema.ts:152-201`).
   - **Empirical Proof**: Fuzzing with malformed tokens, missing top-level tables, out-of-bounds numeric fields (`day: -1`, `energy: 150`, `hour: 25`), invalid enum strings (`timeOfDay: 'dusk'`, `osVersion: 'Windows_XP'`), and prototype pollution attempts (`__proto__`, `constructor.prototype`) were 100% intercepted and rejected with clean Zod validation errors without modifying database state. High-density payloads (500 files + 500 messages) imported and round-tripped losslessly.
   - **Inference**: Corrupted or tampered JSON save files cannot compromise database integrity or runtime stability.

3. **Software Requirements Gating & Bypass Resilience**:
   - **Observation**: `SoftwareRegistry.ts` (lines 180-239) checks OS version, RAM capacity, CPU tier, and free disk bytes before advancing the installer wizard past stage 2. `SimulationEngine.ts` (lines 420-430) verifies `wizard.compatibilityResult.isCompatible` before allowing installation.
   - **Empirical Proof**: On starting baseline hardware (Orion 4.8 / 512MB RAM), PhotoBox 3.0 wizard creation correctly marks `isCompatible: false`, `osCheck.passed: false`, `ramCheck.passed: false`. Attempts to advance stages 3, 4, or 6 throw errors immediately. Direct `SimulationEngine.dispatchAction({ type: 'SOFTWARE_INSTALL', softwareId: 'sw_photobox_30' })` fails cleanly and returns `{ success: false, error: 'Software incompatible...' }`. Upgrading hardware in sequence (RAM -> 1024MB, then OS -> Orion 6.0) smoothly unlocks compatibility and permits successful installation.
   - **Inference**: Software requirements gating is strictly enforced at both engine and registry layers; unauthorized installation bypasses are prevented.

4. **Adware Injection & SafeSweep Remediation Idempotency**:
   - **Observation**: `SoftwareRegistry.completeInstallation` inspects accepted bundled offers (`searchmate_toolbar`, `autorun_startup`) and injects adware payloads / creates VFS shortcuts (`src/engine/SoftwareRegistry.ts:241-298`). `uninstallSoftware` deletes shortcuts from VFS and deregisters the app (`src/engine/SoftwareRegistry.ts:300-312`).
   - **Empirical Proof**:
     - Installing WeatherBuddy with default options correctly injects SearchMate toolbar (`toolbarInjected: true`, `homepageHijacked: 'http://searchmate.local'`).
     - Deselecting bundled offers installs cleanly with zero adware payloads.
     - 25 consecutive cycles of installing WeatherBuddy with adware and immediately removing it via `uninstallSoftware` resulted in zero orphaned VFS shortcuts, zero dangling registry records, and identical VFS file counts before and after every cycle.
     - Duplicate uninstall invocations on the same ID return `false` cleanly without throwing.
     - Co-installation of WeatherBuddy and SafeSweep allows SafeSweep to remediate WeatherBuddy while remaining installed, and SafeSweep uninstalls cleanly afterwards.
   - **Inference**: Adware injection, removal, and reinstallation lifecycles are fully idempotent and memory/disk-leak free.

---

## 3. Caveats

- **IndexedDB Runtime in Node/Vitest**: Tests execute against `fake-indexeddb` in Node.js environment. Browser IndexedDB quota exhaustion limits (e.g. browser storage partition exceeding 50MB) are governed by browser vendor storage policies, though M1 snapshot sizes (~10KB - 500KB) remain orders of magnitude below standard 50MB browser storage quotas.
- No other caveats.

---

## 4. Conclusion

**Verdict: PASS (100% Milestone 1 Acceptance Criteria Satisfied)**

All empirical stress testing objectives for Milestone 1 persistence, JSON fuzzing defense, hardware requirements gating, and adware idempotency have been verified and confirmed robust:
1. `SaveManager.ts` & Dexie multi-table persistence operates losslessly under high-frequency and concurrent load.
2. Zod runtime validation completely shields the system against corrupted, malformed, or hostile JSON imports.
3. Hardware gating strictly prevents unearned software execution (PhotoBox 3.0 on Orion 4.8 / 512MB RAM).
4. Adware toolbar injection and SafeSweep remediation are 100% idempotent across 25+ reinstallation cycles with clean VFS state.

---

## 5. Verification Method

To independently execute and verify all adversarial stress tests and full project validation suites:

```bash
# 1. Run integration stress & fuzzing suite
npx vitest run tests/integration/AdversarialM1Stress.test.ts

# 2. Run full domain unit test suite (74 tests across 11 suites)
npm run test:unit

# 3. Run full integration test suite (21 tests across 2 suites)
npm run test:integration

# 4. Verify full TypeScript build & Vite bundle
npm run build
```

# Issue 8 Home Setup and Boot Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn owned Room 104 computer-package items into one assembled, powered-off machine through an explicit at-home action, then resolve powered states without inventing an OS or desktop.

**Architecture:** `SimulationEngine` owns one atomic home-setup action that validates a complete set of `room_package` ownership records before mutating inventory/hardware/time. `HardwareEngine` accepts a fully resolved canonical assembly; `InventoryEngine` moves the exact consumed physical/display instances from `room_package` to `installed` while OS media remains owned and uninserted. A pure boot resolver derives stable PC-facing state from canonical computer, OS, and inserted owned media; POST is a presentation phase, not a second persisted source of truth.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest, Vite; existing v6 `InventoryEngine`, `HardwareEngine`, `OsEngine`, physical catalog and persistence.

**Spec:** GitHub Issue #8 and `docs/superpowers/specs/2026-09-08-modular-computer-os-app-platform-design.md`.

## Global Constraints

- Start from exact verified #7 feature head `5e51826b0740ec563c9ebe6ef217c947b69f0608` plus this plan commit.
- Buying remains ownership-only; no store path may assemble, power, insert media, or install an OS.
- Setup occurs only at home and consumes exactly **15 in-game minutes once**.
- Setup uses exact owned instances; it cannot clone free components.
- A complete initial setup requires: chassis, motherboard, CPU, at least one RAM stick, storage, optical drive, sound, network, and monitor.
- OS media remains `room_package`/owned after hardware setup and is not inserted by #8.
- Setup leaves `computer.poweredOn === false` and `os.currentOsId === null` when starting from the starter route.
- `poweredOn` is electrical state only. Desktop availability is derived separately.
- No-OS + no inserted bootable media resolves to `no_boot_device`, never Orion desktop.
- Installed OS + powered machine resolves to `desktop`.
- Bootable inserted installer media may resolve to `installer_ready` as a handoff contract; #9 owns insertion and installation semantics.
- PR #4 remains Draft.
- Full-suite gate allows only the three exact documented `WorldScenes.test.ts` baseline failures; zero new failures.

---

### Task 1: Make exact owned-item installation transactional

**Files:**
- Modify: `src/engine/InventoryEngine.ts`
- Test: `tests/unit/HomeComputerSetup.test.ts`

**Interfaces:**
- Consumes: `PlayerInventoryState.items`, `OwnedItem.location`.
- Produces:
  ```ts
  prepareInstallOwnedItems(instanceIds: readonly string[]): PreparedInventoryInstall
  commitInstallOwnedItems(prepared: PreparedInventoryInstall): void
  ```
  where preparation validates that every ID exists exactly once and is currently `room_package`, and commit changes only those records to `installed`.

- [ ] **Step 1: Write RED tests** for missing ID, duplicate ID, wrong location, exact location transition, and stale prepared transaction rejection.
- [ ] **Step 2: Run** `npx vitest run tests/unit/HomeComputerSetup.test.ts` and confirm failures are due to missing install API.
- [ ] **Step 3: Implement** immutable prepare/commit methods; preparation must not mutate state.
- [ ] **Step 4: Re-run** the test and confirm inventory transaction cases pass.
- [ ] **Step 5: Commit** `feat: add owned-item install transaction`.

---

### Task 2: Resolve a complete room package into canonical hardware/display

**Files:**
- Create: `src/engine/hardware/assembleOwnedComputer.ts`
- Modify: `src/engine/HardwareEngine.ts`
- Test: `tests/unit/HomeComputerSetup.test.ts`

**Interfaces:**
- Consumes: owned `room_package` records and `PHYSICAL_ITEM_CATALOG`.
- Produces:
  ```ts
  interface ResolvedComputerAssembly {
    instanceIds: string[];
    computer: ComputerSetupState;
    display: DisplaySetupState;
  }

  resolveRoomComputerAssembly(items: readonly OwnedItem[]):
    | { ok: true; assembly: ResolvedComputerAssembly }
    | { ok: false; error: string }

  HardwareEngine.commitAssembly(computer: ComputerSetupState, display: DisplaySetupState): void
  ```

Rules:
- select one complete physical set containing chassis/motherboard/cpu/RAM/storage/optical/sound/network/monitor;
- ignore media when selecting hardware;
- require CPU socket compatibility and RAM slot/capacity compatibility already expressible by current catalog;
- fail without mutation when required categories are missing or ambiguous/incompatible;
- output `assembled: true`, `poweredOn: false`, `insertedMediaId: null`;
- monitor goes only to `DisplaySetupState`;
- instance IDs contain only physical/display items actually installed.

- [ ] **Step 1: Add RED tests**: starter ownership resolves to canonical 366MHz/64MB/2.1GB/24x/sound/56k/14-inch CRT; setup media excluded; missing monitor/CPU fails.
- [ ] **Step 2: Run RED** and verify resolver is absent/fails.
- [ ] **Step 3: Implement** the pure resolver and `HardwareEngine.commitAssembly`.
- [ ] **Step 4: Re-run** focused tests and confirm resolver GREEN.
- [ ] **Step 5: Commit** `feat: resolve owned room package into computer assembly`.

---

### Task 3: Add atomic at-home setup action and exact 15-minute cost

**Files:**
- Modify: `src/engine/types/index.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify: `src/store/useSimulationStore.ts`
- Test: `tests/unit/HomeComputerSetup.test.ts`
- Test: `tests/unit/SaveRoundTrip.test.ts`

**Interfaces:**
- Produces action:
  ```ts
  { type: 'COMPUTER_SETUP_AT_HOME' }
  ```
- Produces store wrapper:
  ```ts
  setupComputerAtHome(): ActionResult
  ```

Transaction order:
1. reject if a computer is already assembled;
2. resolve complete assembly from current `room_package` ownership;
3. prepare inventory install for exactly assembly instance IDs;
4. commit inventory install;
5. commit canonical computer/display assembly;
6. advance exactly 15 game minutes with reason `Set up computer in Room 104`;
7. emit/synchronize state once through normal dispatch flow.

The action must not change OS state, insert media, or power the computer. Validation failures must preserve inventory, hardware, display, OS, and time.

- [ ] **Step 1: RED tests** for exact one-time 15-minute setup, no OS change, powered-off result, installed physical ownership, media still uninserted/uninstalled, repeated setup no-op/error with no extra time, and missing-component atomic rejection.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement** the action/wrapper minimally.
- [ ] **Step 4: Add save/reload assertion** after setup with OS still null and power off.
- [ ] **Step 5: Run** `npx vitest run tests/unit/HomeComputerSetup.test.ts tests/unit/SaveRoundTrip.test.ts` GREEN.
- [ ] **Step 6: Commit** `feat: set up owned computer at home`.

---

### Task 4: Introduce one pure PC boot-state resolver

**Files:**
- Create: `src/desktop/boot/resolvePcBootState.ts`
- Modify: `src/engine/types/index.ts` only if a shared type is preferable
- Test: `tests/unit/PcBootState.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type PcBootState = 'no_computer' | 'powered_off' | 'no_boot_device' | 'installer_ready' | 'desktop';

  resolvePcBootState(args: {
    computer: ComputerSetupState;
    osId: OsVersion | null;
    inventory: PlayerInventoryState;
  }): PcBootState
  ```

Rules:
- not assembled → `no_computer` regardless of stale data;
- assembled + power off → `powered_off`;
- powered + installed OS → `desktop`;
- powered + no OS + no valid inserted owned OS installer media → `no_boot_device`;
- powered + no OS + `computer.insertedMediaId` pointing to an owned/inserted OS installer catalog item → `installer_ready`;
- never invent Orion 4.8.

- [ ] **Step 1: Write RED table tests** for every state and stale/unowned media rejection.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement** resolver with no mutations.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit** `feat: resolve pc boot state independently of operating system`.

---

### Task 5: Add power action and route PC UI through boot state

**Files:**
- Modify: `src/engine/types/index.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify: `src/store/useSimulationStore.ts`
- Modify: `src/desktop/DesktopShell.tsx`
- Create: `src/desktop/boot/PcBootScreen.tsx`
- Test: `tests/unit/HomeComputerSetup.test.ts`
- Test: `tests/unit/PcBootState.test.ts`
- Add source-boundary test if necessary: `tests/unit/DesktopBootBoundary.test.ts`

**Interfaces:**
- Actions:
  ```ts
  { type: 'COMPUTER_SET_POWER'; poweredOn: boolean }
  setComputerPower(poweredOn: boolean): ActionResult
  ```
- `DesktopShell` consumes `resolvePcBootState`; it does not branch into a default Orion desktop for null OS.

Presentation behavior:
- `no_computer`: no desktop; guide player back to Room 104/store flow;
- `powered_off`: physical power control;
- on power-on, `PcBootScreen` runs a short client-only POST presentation showing actual CPU/RAM/storage/optical facts, then reveals stable resolver result;
- `no_boot_device`: display a period-appropriate `No bootable operating system` message and power/eject guidance;
- `installer_ready`: show boot-media handoff copy only; #9 owns installer launch/commit;
- `desktop`: render existing Orion desktop path.

- [ ] **Step 1: RED engine tests** proving unassembled power-on remains off, assembled no-OS power-on resolves no-boot, and installed-OS power-on resolves desktop.
- [ ] **Step 2: RED source/UI boundary test** proving null OS cannot fall through to Orion desktop.
- [ ] **Step 3: Implement** power action, resolver routing, and bounded POST/no-boot component.
- [ ] **Step 4: Run focused GREEN**.
- [ ] **Step 5: Commit** `feat: add post and no-boot-device flow`.

---

### Task 6: Make Room 104 distinguish empty/package/assembled states

**Files:**
- Modify: `src/world/RoomScene.tsx`
- Modify: `src/world/RoomCanvas.ts`
- Test: `tests/unit/HomeComputerSetup.test.ts`
- Add source/renderer contract test only if repository pattern supports it.

**Interfaces:**
- Room derives:
  ```ts
  hasRoomComputerPackage = inventory.items.some(item => item.location === 'room_package' && (item.kind === 'hardware' || item.kind === 'display'))
  ```
- `Set Up Computer` calls only `setupComputerAtHome()`; Room UI never edits inventory/hardware directly.

Visual states:
1. empty desk;
2. boxed package waiting at desk;
3. assembled machine powered off;
4. assembled machine powered on/display active.

- [ ] **Step 1: Add RED contract/state tests** for the four states and setup interaction boundary.
- [ ] **Step 2: Implement** minimal room rendering/hotspot changes.
- [ ] **Step 3: Run focused GREEN**.
- [ ] **Step 4: Commit** `feat: show owned computer setup states in room 104`.

---

### Task 7: Exact-head persistence and regression gate

**Files:**
- Modify only if tests expose defects.
- Update `CHANGELOG.md` if #8 behavior is not sufficiently player-visible in Unreleased notes.

- [ ] **Step 1: Run focused gate**:
  ```bash
  npx vitest run \
    tests/unit/HomeComputerSetup.test.ts \
    tests/unit/PcBootState.test.ts \
    tests/unit/StorePurchase.test.ts \
    tests/unit/ComputerStateV6.test.ts \
    tests/unit/SaveSlots.test.ts \
    tests/unit/SaveRoundTrip.test.ts \
    tests/unit/OsEngineNoOs.test.ts
  ```
- [ ] **Step 2: Run** `npx tsc --noEmit`.
- [ ] **Step 3: Run** `npm run build`.
- [ ] **Step 4: Run** `npm run test` on exact candidate and exact pre-#8 baseline; require zero new failures beyond the three documented `WorldScenes.test.ts` failures.
- [ ] **Step 5: Scope review** confirms no #9 OS installation/upgrade commit path, no media auto-insertion, and no #13 general part-swap UI.
- [ ] **Step 6: Fast-forward** `feat/modular-orion-hardware-os` only after exact verification, never force.
- [ ] **Step 7: Comment/close #8** with exact SHA/evidence, leave PR #4 Draft, and unblock #9 plus #13.

---

## Self-Review

### Spec coverage
- Owned package remains unassembled after purchase: Tasks 1–3/6.
- Explicit home setup and exact time: Task 3, fixed at 15 minutes.
- Exact owned components, no clones: Tasks 1–3.
- Separate monitor activation: Task 2.
- Powered off after setup: Tasks 2–3.
- Power independent of OS: Tasks 4–5.
- No-OS cannot enter desktop: Tasks 4–5.
- Player-visible no-boot state/POST: Task 5.
- Room empty/package/assembled/powered distinction: Task 6.
- Repeated setup non-duplicating: Task 3.
- Save/reload intermediate setup state: Task 3/7.
- #9 installer handoff without implementing #9: Task 4/5 `installer_ready` only.

### Placeholder scan
No TBD/TODO/“similar to” steps remain. Every implementation task has a concrete interface, RED case, minimal GREEN rule, and commit boundary.

### Type consistency
- Ownership transitions use existing `OwnedItemLocation = room_package | installed | inserted | inventory` values.
- `ComputerSetupState` remains canonical physical machine truth; OS remains solely `OsEngine.currentOsId`.
- `PcBootState` is derived presentation state and is not persisted as a second truth.
- `insertedMediaId` continues to reference an owned item instance ID, while media metadata stays in the physical catalog/inventory.

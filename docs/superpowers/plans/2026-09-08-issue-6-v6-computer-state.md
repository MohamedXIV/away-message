# Issue #6 — v6 Computer State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed v5 hardware/OS state with a v6 canonical model where owned inventory, computer setup, display setup, and installed OS are independent, while preserving old saves and keeping existing callers alive through a non-authoritative hardware projection.

**Architecture:** `HardwareEngine` will own two separate canonical runtime states—`ComputerSetupState` and `DisplaySetupState`—and derive the legacy-style `HardwareState` projection from them. A small `InventoryEngine` will own `PlayerInventoryState` for later store transactions. `OsEngine` becomes the only OS authority and supports `currentOsId: null`. v5 saves migrate deterministically into the new roots; the old flat `hardware` snapshot is treated only as a compatibility projection and is never a v6 source of truth.

**Tech Stack:** TypeScript, React 19/Vite application runtime, Zustand integration, Dexie save slots, Zod schemas, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-modular-computer-os-app-platform-design.md`

## Global Constraints

- Fresh game: no assembled computer, no active monitor, no installed OS, empty physical inventory.
- `OsEngine.currentOsId` is `OsVersion | null` and is the sole OS truth.
- Hardware and display are separate canonical states even if one engine coordinates them.
- `SimulationState.hardware` may remain temporarily for compatibility, but it is a derived read-only projection and is ignored as a v6 restore authority.
- No fake no-PC values: CPU tier 0, RAM 0, disk 0, connection null/0, sound false.
- `ModularHardwareState` may remain temporarily as a legacy/catalog adapter until #7, but it is not the canonical persisted runtime model.
- Save format becomes v6; v5 → v6 migration is pure, deterministic, and preserves working v5 machines.
- A v5 no-PC save must not materialize Orion 4.8 from the old default fallback.
- The known broken starter purchase may create only a narrow one-time recovery marker in #6; #7 consumes it into actual ownership.
- Do not implement store purchase behavior, room setup UX, OS media install flow, generic app installation, download refactors, or part-swapping UX in #6.
- Follow TDD: write failing test, verify RED, implement minimal behavior, verify GREEN, then commit.
- Final verification for #6: `npx tsc --noEmit`, targeted tests, `npm run build`, then `npm run test`; zero new failures beyond the documented baseline.

---

## File Structure and Responsibilities

### Create

- `src/engine/hardware/state.ts` — pure constructors, legacy modular → canonical conversion, and effective hardware projection. No event bus or UI logic.
- `src/engine/InventoryEngine.ts` — minimal owner for `PlayerInventoryState` (`getState`, `loadState`); #7 will add transactional purchase behavior.
- `src/persistence/migrations/v6ComputerState.ts` — pure v5 → v6 snapshot migration and narrow broken-starter recovery detection.
- `tests/unit/ComputerStateV6.test.ts` — canonical empty state, legacy conversion, and no-fake-default regression tests.
- `tests/unit/OsEngineNoOs.test.ts` — nullable OS authority tests.

### Modify

- `src/engine/types/index.ts` — define canonical v6 state interfaces; make `OsEngineState.currentOsId` nullable; redefine compatibility `HardwareState` without OS/modular authority; extend `SimulationState` with `computer`, `display`, and `inventory`.
- `src/engine/hardware/types.ts` — add canonical computer/display/ownership-adjacent hardware types while retaining `ModularHardwareState` strictly as the temporary legacy/catalog adapter used by #7.
- `src/engine/hardware/HardwareManager.ts` — remove OS from compatibility conversion and eliminate optimistic no-PC fallbacks.
- `src/engine/HardwareEngine.ts` — store canonical computer/display state; derive `HardwareState`; remove OS mutation/branching.
- `src/engine/OsEngine.ts` — support no installed OS safely in all read APIs and compatibility checks.
- `src/engine/SimulationEngine.ts` — construct/serialize canonical roots, instantiate `InventoryEngine`, remove hardware↔OS synchronization, keep transitional `HARDWARE_UPGRADE_OS` behavior routed through `OsEngine` only.
- `src/engine/SoftwareRegistry.ts` — accept nullable OS from its dependency contract so a no-OS simulation compiles and reports incompatibility; full generic app behavior remains #10.
- `src/world/modals/SiliconSparesModal.tsx` — only compile-safe read changes required by #6, e.g. display current OS from `state.os.currentOsId`; do not implement #7 purchase semantics here.
- `src/persistence/slots.ts` — bump save format to 6, chain v6 migration, write canonical summary data without using hardware as OS authority.
- `src/persistence/schema.ts` — allow no OS in slot summary metadata and align types with v6 save records.
- `tests/unit/ModularHardware.test.ts` — keep low-level modular/catalog tests that remain valid; remove assertions that hardware owns OS or that instant bundle install is the canonical contract.
- `tests/unit/HardwareEngine.test.ts` — adapt to zero/no-machine effective values and canonical computer/display state.
- `tests/unit/SaveSlots.test.ts` — add v5 → v6 working-PC/no-PC/recovery migration cases.
- `tests/unit/SaveRoundTrip.test.ts` — prove canonical v6 roots round-trip.
- `tests/unit/SimulationEngine.test.ts` — prove fresh simulation exposes no PC/display/OS and no OS shadow copy in hardware.
- `CHANGELOG.md` — document v6 migration and player-visible lifecycle correction.

## Canonical Interfaces

Add these interfaces in `src/engine/types/index.ts` or re-export equivalents from `src/engine/hardware/types.ts` without duplicate definitions:

```ts
export type OwnedItemKind = 'hardware' | 'display' | 'media';
export type OwnedItemLocation = 'inventory' | 'room_package' | 'installed' | 'inserted';

export interface OwnedItem {
  instanceId: string;
  catalogItemId: string;
  kind: OwnedItemKind;
  location: OwnedItemLocation;
}

export interface LegacyRecoveryState {
  starterBundlePurchaseLost: boolean;
  consumed: boolean;
}

export interface PlayerInventoryState {
  items: OwnedItem[];
  legacyRecovery?: LegacyRecoveryState;
}

export interface ComputerSetupState {
  assembled: boolean;
  poweredOn: boolean;
  chassis: import('../hardware/types').ChassisComponent | null;
  motherboard: import('../hardware/types').MotherboardComponent | null;
  cpu: import('../hardware/types').CpuComponent | null;
  ramSticks: import('../hardware/types').RamStickComponent[];
  storage: import('../hardware/types').StorageComponent[];
  opticalDrives: import('../hardware/types').OpticalDriveComponent[];
  soundCard: import('../hardware/types').SoundCardComponent | null;
  networkCard: import('../hardware/types').NetworkCardComponent | null;
  insertedMediaId: string | null;
}

export interface DisplaySetupState {
  monitor: import('../hardware/types').MonitorComponent | null;
}

export interface HardwareState {
  hasComputer: boolean;
  isPoweredOn: boolean;
  cpuTier: number;
  cpuName: string;
  ramMB: number;
  hddTotalGB: number;
  hddFreeGB: number;
  connectionType: ConnectionType | null;
  connectionSpeedKbps: number;
  soundCardInstalled: boolean;
  speakersInstalled: boolean;
  webcamInstalled: boolean;
}

export interface OsEngineState {
  currentOsId: OsVersion | null;
  installedPatchIds: OsVersion[];
  // existing metadata fields remain unchanged
}
```

Add a minimal chassis definition in `src/engine/hardware/types.ts`:

```ts
export interface ChassisComponent {
  id: string;
  name: string;
}
```

`SimulationState` must expose all four distinct views:

```ts
interface SimulationState {
  // existing fields...
  hardware: HardwareState; // derived compatibility projection only
  computer: ComputerSetupState;
  display: DisplaySetupState;
  inventory: PlayerInventoryState;
  os: OsEngineState;
}
```

---

### Task 1: Canonical v6 types and pure state/projection helpers

**Files:**
- Create: `src/engine/hardware/state.ts`
- Create: `tests/unit/ComputerStateV6.test.ts`
- Modify: `src/engine/types/index.ts`
- Modify: `src/engine/hardware/types.ts`
- Modify: `src/engine/hardware/HardwareManager.ts`

**Interfaces:**
- Produces: `createEmptyComputerSetup(): ComputerSetupState`
- Produces: `createEmptyDisplaySetup(): DisplaySetupState`
- Produces: `createEmptyInventoryState(): PlayerInventoryState`
- Produces: `projectEffectiveHardware(computer: ComputerSetupState): HardwareState`
- Produces: `legacyModularToCanonical(modular: ModularHardwareState): { computer: ComputerSetupState; display: DisplaySetupState }`
- Produces: `canonicalToLegacyModular(computer: ComputerSetupState, display: DisplaySetupState): ModularHardwareState | undefined`
- Consumes: existing modular component definitions and legacy bundle objects.

- [ ] **Step 1: Write RED tests for an empty canonical machine**

Create `tests/unit/ComputerStateV6.test.ts` with tests equivalent to:

```ts
import { describe, expect, it } from 'vitest';
import {
  createEmptyComputerSetup,
  createEmptyDisplaySetup,
  projectEffectiveHardware,
} from '../../src/engine/hardware/state';

describe('v6 computer state', () => {
  it('represents an empty desk without invented hardware', () => {
    const computer = createEmptyComputerSetup();
    const display = createEmptyDisplaySetup();
    const effective = projectEffectiveHardware(computer);

    expect(computer.assembled).toBe(false);
    expect(computer.poweredOn).toBe(false);
    expect(display.monitor).toBeNull();
    expect(effective).toMatchObject({
      hasComputer: false,
      isPoweredOn: false,
      cpuTier: 0,
      ramMB: 0,
      hddTotalGB: 0,
      hddFreeGB: 0,
      connectionType: null,
      connectionSpeedKbps: 0,
      soundCardInstalled: false,
    });
  });
});
```

Add a second RED test converting `createScrapYardBundle()` and asserting monitor is returned in `display.monitor`, not in `ComputerSetupState`, while CPU/RAM/storage remain in `computer`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/unit/ComputerStateV6.test.ts
```

Expected: FAIL because the v6 types/helpers do not exist yet.

- [ ] **Step 3: Add canonical types and pure constructors**

Implement the interfaces above. In `hardware/state.ts`, use these exact empty defaults:

```ts
export function createEmptyComputerSetup(): ComputerSetupState {
  return {
    assembled: false,
    poweredOn: false,
    chassis: null,
    motherboard: null,
    cpu: null,
    ramSticks: [],
    storage: [],
    opticalDrives: [],
    soundCard: null,
    networkCard: null,
    insertedMediaId: null,
  };
}

export function createEmptyDisplaySetup(): DisplaySetupState {
  return { monitor: null };
}

export function createEmptyInventoryState(): PlayerInventoryState {
  return { items: [] };
}
```

`projectEffectiveHardware()` must return zero/unavailable values when `computer.assembled === false`; for assembled machines it sums RAM, uses primary storage index `0`, and reads CPU/network/sound from the canonical components. Do not accept an OS parameter.

- [ ] **Step 4: Implement temporary modular adapters without making them canonical**

`legacyModularToCanonical()` maps the v5/catalog object to:

```ts
{
  computer: {
    assembled: modular.hasComputer,
    poweredOn: modular.isPoweredOn,
    chassis: modular.hasComputer ? { id: 'chassis_legacy_beige_atx', name: 'Beige ATX Chassis' } : null,
    motherboard: modular.motherboard ?? null,
    cpu: modular.cpu ?? null,
    ramSticks: [...(modular.ramSticks ?? [])],
    storage: modular.storage ? [modular.storage] : [],
    opticalDrives: modular.opticalDrive ? [modular.opticalDrive] : [],
    soundCard: modular.soundCard ?? null,
    networkCard: modular.networkCard ?? null,
    insertedMediaId: modular.insertedDisc?.id ?? null,
  },
  display: { monitor: modular.monitor ?? null },
}
```

`canonicalToLegacyModular()` exists only for the still-unmigrated store/UI code; it returns `undefined` unless the canonical machine has all required legacy adapter parts and a monitor. It must never contain or accept an OS version.

- [ ] **Step 5: Remove OS/fake fallback behavior from `HardwareManager`**

Delete the `osVersion` parameter from `toLegacyHardwareState` or replace that helper with `projectEffectiveHardware`. No helper may return `512MB`, `40GB`, or DSL simply because a machine/part is absent.

- [ ] **Step 6: Re-run focused tests**

Run:

```bash
npx vitest run tests/unit/ComputerStateV6.test.ts tests/unit/ModularHardware.test.ts
```

Expected: canonical v6 tests PASS; old modular tests may now fail only where they assert the abandoned OS/monitor-as-canonical contract. Update those assertions in Task 2, not by reintroducing coupling.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/engine/types/index.ts src/engine/hardware/types.ts src/engine/hardware/state.ts src/engine/hardware/HardwareManager.ts tests/unit/ComputerStateV6.test.ts
git commit -m "refactor: define v6 computer and display state"
```

---

### Task 2: Make HardwareEngine own canonical computer/display state only

**Files:**
- Modify: `src/engine/HardwareEngine.ts`
- Modify: `tests/unit/HardwareEngine.test.ts`
- Modify: `tests/unit/ModularHardware.test.ts`

**Interfaces:**
- Consumes: Task 1 constructors/projections/adapters.
- Produces: `getComputerState(): Readonly<ComputerSetupState>`
- Produces: `getDisplayState(): Readonly<DisplaySetupState>`
- Produces: `getState(): Readonly<HardwareState>` as a derived compatibility projection.
- Produces: `getModularState(): ModularHardwareState | undefined` as a deprecated adapter only.
- Produces: `checkHardwareRequirements(req: Pick<SoftwareRequirement, 'minRamMB' | 'minCpuTier' | 'requiredDiskBytes'>): { compatible: boolean; reasons: string[] }`
- Produces: `calculateRamPressure(runningAppsMemoryMB: number, osBaselineMB: number): RamPressure`

- [ ] **Step 1: Write RED HardwareEngine tests**

Add tests equivalent to:

```ts
it('starts with no assembled machine and no fake effective specs', () => {
  const engine = new HardwareEngine(new EventBus());
  expect(engine.getComputerState().assembled).toBe(false);
  expect(engine.getDisplayState().monitor).toBeNull();
  expect(engine.getState()).toMatchObject({
    hasComputer: false,
    cpuTier: 0,
    ramMB: 0,
    hddTotalGB: 0,
    connectionType: null,
    connectionSpeedKbps: 0,
  });
});
```

Add a test proving `checkHardwareRequirements` fails on a no-PC machine for RAM/CPU/disk rather than passing through defaults.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run tests/unit/HardwareEngine.test.ts
```

Expected: FAIL because HardwareEngine still owns flat defaults and OS state.

- [ ] **Step 3: Replace HardwareEngine private state**

Use:

```ts
private computer: ComputerSetupState;
private display: DisplaySetupState;
```

Constructor inputs are canonical partial states, with Task 1 empty constructors as defaults. `getState()` always calls `projectEffectiveHardware(this.computer)`.

Keep `getModularState()` only as a compatibility adapter calling `canonicalToLegacyModular(this.computer, this.display)` so #7 can remove its callers later.

- [ ] **Step 4: Remove OS authority from HardwareEngine**

Remove:
- `osVersion` field/default;
- OS check inside `checkRequirements`;
- OS family lookups inside RAM pressure;
- hardware-owned OS mutation in `upgradeOs`.

For RAM pressure, callers supply `this.os.getRamOverheadMB()` from SimulationEngine/host code.

For the transitional `HARDWARE_UPGRADE_OS` action, do not keep `HardwareEngine.upgradeOs`; Task 3 routes that action to `OsEngine` so there is one OS writer.

- [ ] **Step 5: Keep legacy modular install compile-compatible but OS-neutral**

Until #7 replaces the store, `installModularHardware(modular, _ignoredLegacyOs?)` may remain as a deprecated adapter. It must:

1. map the legacy modular object through `legacyModularToCanonical`;
2. set computer/display from that result;
3. preserve `modular.isPoweredOn` rather than forcing power on;
4. ignore the legacy OS argument entirely;
5. emit only hardware/display change events.

Add a test proving passing `'Orion_6.0'` to this legacy adapter cannot alter any OS state because HardwareEngine has no OS field.

- [ ] **Step 6: Update modular tests to the new boundary**

Keep tests for RAM calculation, storage calculation, slot validation, and authored bundle completeness. Replace the old `toLegacyHardwareState(workstation, 'Orion_6.0')` assertion with `projectEffectiveHardware(legacyModularToCanonical(workstation).computer)` and assert there is no `osVersion` key.

Do not keep the old test asserting “install bundle + initial OS = canonical completed machine.”

- [ ] **Step 7: Verify Task 2**

Run:

```bash
npx vitest run tests/unit/ComputerStateV6.test.ts tests/unit/HardwareEngine.test.ts tests/unit/ModularHardware.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/engine/HardwareEngine.ts tests/unit/HardwareEngine.test.ts tests/unit/ModularHardware.test.ts
git commit -m "refactor: make hardware state OS-neutral"
```

---

### Task 3: Nullable OsEngine, InventoryEngine, and SimulationEngine single authority

**Files:**
- Create: `src/engine/InventoryEngine.ts`
- Create: `tests/unit/OsEngineNoOs.test.ts`
- Modify: `src/engine/OsEngine.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify: `src/engine/SoftwareRegistry.ts`
- Modify: `src/world/modals/SiliconSparesModal.tsx`
- Modify: `tests/unit/SimulationEngine.test.ts`

**Interfaces:**
- Consumes: canonical computer/display/inventory types from Task 1.
- Produces: `InventoryEngine.getState(): Readonly<PlayerInventoryState>` and `loadState(state: PlayerInventoryState): void`.
- Changes: `OsEngine.getCurrentOsId(): OsVersion | null`.
- Changes: `OsEngine.getCurrentRelease(): OsRelease | null`.
- Changes: `OsEngine.getTheme(): OsThemeId | null`.
- Rule: `OsEngine.getRamOverheadMB()` returns `0` when no OS is installed.
- Rule: `OsEngine.checkCompatibility(...)` returns incompatible with reason `No operating system installed.` when `currentOsId === null`.

- [ ] **Step 1: Write RED tests for nullable OS**

Create `tests/unit/OsEngineNoOs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { OsEngine } from '../../src/engine/OsEngine';

describe('OsEngine no-OS state', () => {
  it('does not invent Orion 4.8', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: null });
    expect(os.getCurrentOsId()).toBeNull();
    expect(os.getCurrentRelease()).toBeNull();
    expect(os.getTheme()).toBeNull();
    expect(os.getRamOverheadMB()).toBe(0);
  });

  it('persists and reloads explicit null', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: null });
    const restored = new OsEngine(new EventBus(), os.getState());
    expect(restored.getState().currentOsId).toBeNull();
  });
});
```

Add a compatibility test expecting `No operating system installed.`.

- [ ] **Step 2: Write RED SimulationEngine fresh-state test**

In `tests/unit/SimulationEngine.test.ts` add:

```ts
it('fresh simulation has independent empty computer, display, inventory, and OS roots', () => {
  const sim = new SimulationEngine();
  const state = sim.getState();

  expect(state.computer.assembled).toBe(false);
  expect(state.display.monitor).toBeNull();
  expect(state.inventory.items).toEqual([]);
  expect(state.os.currentOsId).toBeNull();
  expect(state.hardware.hasComputer).toBe(false);
  expect('osVersion' in state.hardware).toBe(false);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npx vitest run tests/unit/OsEngineNoOs.test.ts tests/unit/SimulationEngine.test.ts
```

Expected: FAIL on nullable OS/canonical roots.

- [ ] **Step 4: Implement nullable OsEngine reads safely**

Constructor must distinguish `undefined` from explicit `null`:

```ts
this.currentOsId = initialState && 'currentOsId' in initialState
  ? (initialState.currentOsId ?? null)
  : null;
```

Do not fall back to `initialState.osVersion` inside OsEngine. v5 legacy fallback belongs only in the v6 migration.

Any method needing the active release must branch on null. In particular:
- `getCurrentRelease()` → `null`;
- `getInstalledReleases()` → `[]` when no base OS;
- `getTheme()` → `null`;
- `getRamOverheadMB()` → `0`;
- `checkCompatibility()` → explicit no-OS failure;
- `loadState()` must assign `null` when the key is present;
- `canInstall()` must not call `.version`/`.family` on a missing current release. With no current OS, skip downgrade/base-family comparisons; media/fresh-install mode remains #9.

- [ ] **Step 5: Add minimal InventoryEngine**

Use immutable outward copies:

```ts
export class InventoryEngine {
  private state: PlayerInventoryState;

  constructor(initial?: Partial<PlayerInventoryState>) {
    this.state = {
      items: initial?.items ? initial.items.map((item) => ({ ...item })) : [],
      legacyRecovery: initial?.legacyRecovery ? { ...initial.legacyRecovery } : undefined,
    };
  }

  getState(): Readonly<PlayerInventoryState> {
    return {
      items: this.state.items.map((item) => ({ ...item })),
      legacyRecovery: this.state.legacyRecovery ? { ...this.state.legacyRecovery } : undefined,
    };
  }

  loadState(state: PlayerInventoryState): void {
    this.state = {
      items: state.items.map((item) => ({ ...item })),
      legacyRecovery: state.legacyRecovery ? { ...state.legacyRecovery } : undefined,
    };
  }
}
```

No add/remove/purchase methods in #6.

- [ ] **Step 6: Rewire SimulationEngine canonical roots**

Constructor reads `initialState.computer`, `initialState.display`, `initialState.inventory`, and `initialState.os`. For a fresh game, all use empty/null defaults.

Instantiate:

```ts
this.hardware = new HardwareEngine(this.events, {
  computer: initialState?.computer,
  display: initialState?.display,
});
this.inventory = new InventoryEngine(initialState?.inventory);
this.os = new OsEngine(this.events, initialState?.os);
```

Remove every mutation that copies `OsEngine.currentOsId` into HardwareEngine.

`getState()` must return:

```ts
hardware: this.hardware.getState(),
computer: this.hardware.getComputerState(),
display: this.hardware.getDisplayState(),
inventory: this.inventory.getState(),
os: this.os.getState(),
```

Fresh `activeView` remains `room` because `hardware.hasComputer` is false.

- [ ] **Step 7: Keep transitional OS-upgrade action single-authority**

Where `SimulationEngine` currently dispatches `HARDWARE_UPGRADE_OS`, route the OS write to `OsEngine` only. If the existing action charges cash, keep that legacy behavior temporarily for compatibility but call `this.os.beginInstall(...)`/the existing OsEngine install path and allocate disk through hardware. #9 removes the combined purchase/install action entirely.

No code path may write an OS identifier into HardwareEngine.

- [ ] **Step 8: Make nullable OS dependency compile-safe**

Change `SoftwareRegistry` dependency typing to `getOsVersion: () => OsVersion | null`. When null, its existing compatibility result should report OS check failed with current display text `None`; do not redesign app releases in #6.

In `SiliconSparesModal`, replace footer reads of `hardware.osVersion` with `state.os.currentOsId ?? 'No OS'`. Do not change purchase/install behavior beyond what is required to compile against the new HardwareState.

- [ ] **Step 9: Verify Task 3**

Run:

```bash
npx vitest run tests/unit/OsEngineNoOs.test.ts tests/unit/SimulationEngine.test.ts tests/unit/HardwareEngine.test.ts tests/unit/SoftwareRegistry.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add src/engine/InventoryEngine.ts src/engine/OsEngine.ts src/engine/SimulationEngine.ts src/engine/SoftwareRegistry.ts src/world/modals/SiliconSparesModal.tsx tests/unit/OsEngineNoOs.test.ts tests/unit/SimulationEngine.test.ts
git commit -m "refactor: make OsEngine the sole OS authority"
```

---

### Task 4: Save format v6 migration and bounded broken-purchase recovery marker

**Files:**
- Create: `src/persistence/migrations/v6ComputerState.ts`
- Modify: `src/persistence/slots.ts`
- Modify: `src/persistence/schema.ts`
- Modify: `tests/unit/SaveSlots.test.ts`

**Interfaces:**
- Produces: `migrateSnapshotToV6(snapshot: SimulationState, fromVersion: number): SimulationState`
- Produces: `isRecoverableBrokenStarterPurchase(snapshot: SimulationState): boolean`
- Consumes: Task 1 legacy modular conversion and empty-state helpers.

- [ ] **Step 1: Write RED migration tests for a working v5 PC**

Construct a v5-style snapshot with:
- `hardware.hasComputer = true`;
- modular CPU tier 2, 1024MB RAM, DSL 1M, monitor, optional inserted disc;
- `os.currentOsId = 'Orion_5.0'`.

Assert after `migrateSnapshotToV6`:

```ts
expect(migrated.computer.assembled).toBe(true);
expect(migrated.computer.cpu?.tier).toBe(2);
expect(migrated.computer.ramSticks[0]?.sizeMb).toBe(1024);
expect(migrated.display.monitor?.id).toBe(originalMonitorId);
expect(migrated.os.currentOsId).toBe('Orion_5.0');
expect(migrated.inventory.items.some((i) => i.location === 'installed')).toBe(true);
expect('osVersion' in migrated.hardware).toBe(false);
```

- [ ] **Step 2: Write RED migration test for v5 no-PC ghost Orion**

Create a v5 snapshot with:
- `hardware.hasComputer = false`;
- old flat fake defaults;
- `os.currentOsId = 'Orion_4.8'` from the legacy fallback;
- no `lastInstallAtMinute`, no OS patches.

Assert v6:

```ts
expect(migrated.computer.assembled).toBe(false);
expect(migrated.display.monitor).toBeNull();
expect(migrated.os.currentOsId).toBeNull();
expect(migrated.hardware.ramMB).toBe(0);
```

- [ ] **Step 3: Write RED bounded recovery tests**

The helper returns true only when all are true:
- source is a v5-style no-PC state;
- Day 1;
- player cash equals `$3.00` exactly after cent rounding;
- no assembled/modular working computer;
- no evidence of a real OS install (`lastInstallAtMinute` absent, no installed patches).

Expected marker:

```ts
inventory.legacyRecovery = {
  starterBundlePurchaseLost: true,
  consumed: false,
};
```

Add negative cases for cash `$2`, `$4`, Day 2, and an actually installed OS. Those must not receive the marker.

- [ ] **Step 4: Verify RED**

Run:

```bash
npx vitest run tests/unit/SaveSlots.test.ts
```

Expected: FAIL because v6 migration does not exist.

- [ ] **Step 5: Implement pure v6 migration**

In `v6ComputerState.ts`:

1. If canonical `computer`, `display`, `inventory`, and nullable `os` already exist, clone and return without re-migrating.
2. For working v5 modular hardware, call `legacyModularToCanonical`.
3. For working v5 flat-only hardware, first use the deterministic v5 modular backfill behavior already present, then convert to canonical state.
4. Create deterministic installed ownership rows for migrated components using instance IDs such as:
   - `migrated:chassis:0`
   - `migrated:motherboard:0`
   - `migrated:cpu:0`
   - `migrated:ram:0`, `migrated:ram:1`
   - `migrated:storage:0`
   - `migrated:optical:0`
   - `migrated:sound:0`
   - `migrated:network:0`
   - `migrated:monitor:0`
5. `catalogItemId` uses the component's existing `id`; location is `installed`.
6. If a legacy inserted disc exists, create one media ownership row `migrated:media:inserted` with location `inserted` and set `computer.insertedMediaId` to that instance ID.
7. Working-PC OS preservation priority: `snapshot.os.currentOsId` when non-null; otherwise legacy `hardware.osVersion`.
8. No-PC migration always sets OS to null regardless of the old fallback value unless there is explicit real-install evidence; this epic's intended v5 no-PC states have no valid installed OS.
9. Apply the narrow recovery marker only via `isRecoverableBrokenStarterPurchase`.
10. Recompute `hardware` from `projectEffectiveHardware(computer)`.

Do not mutate the input snapshot or nested arrays/objects.

- [ ] **Step 6: Bump and chain save format v6**

In `slots.ts`:

```ts
export const SAVE_FORMAT_VERSION = 6;
```

Update the header comment to describe v6. In `loadSlotSnapshot`, after v4/v5 migration:

```ts
if (version < 6) {
  upgraded = migrateSnapshotToV6(upgraded, version);
}
```

`saveSlot()` continues storing the full snapshot, but slot summary `hardwareState.osVersion` must be derived from `snapshot.os.currentOsId`, not `snapshot.hardware`. It may be `null`.

- [ ] **Step 7: Align persistence schema with nullable summary OS**

Change:

```ts
osVersion: string | null;
```

and Zod:

```ts
osVersion: z.string().regex(/^Orion_/).min(3).nullable(),
```

Do not add a Dexie `MIGRATIONS[]` entry merely for the snapshot document; `slots.ts` owns document migration as the existing comments state.

- [ ] **Step 8: Verify migration tests**

Run:

```bash
npx vitest run tests/unit/SaveSlots.test.ts tests/unit/ComputerStateV6.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```bash
git add src/persistence/migrations/v6ComputerState.ts src/persistence/slots.ts src/persistence/schema.ts tests/unit/SaveSlots.test.ts
git commit -m "feat: migrate save snapshots to v6 computer state"
```

---

### Task 5: v6 round-trip, compatibility regression, changelog, and issue gate

**Files:**
- Modify: `tests/unit/SaveRoundTrip.test.ts`
- Modify: `tests/unit/SimulationEngine.test.ts`
- Modify: `CHANGELOG.md`
- Potential compile-only modifications: only files reported by `npx tsc --noEmit` because their types still assume `hardware.osVersion`, `hardware.modular`, non-null `getCurrentOsId()`, or non-null `getCurrentRelease()`. Each such change must consume the new canonical source (`state.os`, `state.computer`, `state.display`) rather than restoring an old shadow field.

**Interfaces:**
- Consumes: all Task 1–4 public contracts.
- Produces: verified v6 snapshot round-trip and zero second OS authority.

- [ ] **Step 1: Add RED v6 save/restore regression**

In `SaveRoundTrip.test.ts`, construct or obtain a v6 state where:
- no PC/no display/no OS round-trips exactly; and
- a migrated working-PC state with monitor + OS round-trips preserving canonical roots.

Assert after restoring through `SimulationEngine`:

```ts
expect(restored.computer).toEqual(saved.computer);
expect(restored.display).toEqual(saved.display);
expect(restored.inventory).toEqual(saved.inventory);
expect(restored.os).toEqual(saved.os);
expect(restored.hardware).toEqual(projectEffectiveHardware(restored.computer));
expect('osVersion' in restored.hardware).toBe(false);
```

- [ ] **Step 2: Verify RED if any restore path still reads legacy hardware as authority**

Run:

```bash
npx vitest run tests/unit/SaveRoundTrip.test.ts tests/unit/SimulationEngine.test.ts
```

Expected before final wiring: any stale v5 constructor/restore assumptions fail.

- [ ] **Step 3: Fix restore/export paths only through canonical roots**

Ensure `SimulationEngine` constructor/export does not recreate computer/display/OS from `hardware` when canonical v6 roots are present. Legacy hardware fallback must exist only in `migrateSnapshotToV6`.

- [ ] **Step 4: Run TypeScript and replace stale read sites with canonical sources**

Run:

```bash
npx tsc --noEmit
```

For each compiler error caused by this issue's deliberate contract changes, apply only these mappings:

```text
hardware.osVersion          → state.os.currentOsId / engine.os.getCurrentOsId()
hardware.modular.monitor    → state.display.monitor
hardware.modular            → state.computer + state.display or engine.hardware.getModularState() only for temporary #7 catalog compatibility
non-null current OS display → currentOsId ?? 'No OS'
OS RAM overhead in hardware → engine.os.getRamOverheadMB() supplied to hardware calculation
```

Do not add casts that hide nullability and do not restore `osVersion` to HardwareState.

Re-run `npx tsc --noEmit` until it passes.

- [ ] **Step 5: Update CHANGELOG**

Add one concise v6 entry explaining:
- fresh games can persist no PC/no OS correctly;
- hardware/display/OS/inventory are now separate state;
- v5 working-PC saves migrate with equivalent effective hardware/display/OS;
- v5 no-PC saves no longer invent Orion 4.8.

- [ ] **Step 6: Run targeted v6 suite**

```bash
npx vitest run \
  tests/unit/ComputerStateV6.test.ts \
  tests/unit/HardwareEngine.test.ts \
  tests/unit/ModularHardware.test.ts \
  tests/unit/OsEngineNoOs.test.ts \
  tests/unit/SimulationEngine.test.ts \
  tests/unit/SaveSlots.test.ts \
  tests/unit/SaveRoundTrip.test.ts \
  tests/unit/SoftwareRegistry.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Run full test suite**

```bash
npm run test
```

Expected: no new failures relative to `AGENTS.md`. If the documented three `WorldScenes.test.ts` failures remain, record them as baseline rather than attributing them to #6.

- [ ] **Step 9: Commit Task 5**

```bash
git add CHANGELOG.md tests/unit/SaveRoundTrip.test.ts tests/unit/SimulationEngine.test.ts src tests
git commit -m "test: verify v6 computer state migration"
```

Before committing, inspect `git status --short` so this command does not accidentally include unrelated files.

- [ ] **Step 10: Update GitHub issue #6 with exact verification evidence**

Comment on #6 with:
- exact final head SHA;
- targeted test result;
- `npx tsc --noEmit` result;
- build result;
- full-suite result including documented baseline failures only;
- migration cases proven: working PC, no PC ghost OS, narrow recovery marker;
- statement that `HardwareState` no longer owns an OS value.

Close #6 only if every acceptance criterion is satisfied on that exact head. Do not start #7 before that gate is green.

---

## Plan Self-Review

### Spec coverage

- Fresh no-PC/no-display/no-OS state: Tasks 1–3.
- Separate canonical inventory/computer/display/OS roots: Tasks 1–3.
- OsEngine sole authority and nullable OS: Task 3.
- No fake hardware defaults: Tasks 1–2.
- v5 working-PC migration preservation: Task 4.
- v5 no-PC migration without ghost Orion: Task 4.
- narrow lost-$35 recovery marker: Task 4.
- save format v6 + schema + CHANGELOG: Tasks 4–5.
- compatibility projection is derived, not restored authority: Tasks 2, 4, 5.
- zero new regressions verification: Task 5.

### Intentional deferrals

The following are explicitly outside #6 and have dedicated child issues:
- purchase atomicity and owned bundle expansion → #7;
- room package/setup/POST → #8;
- owned OS media and fresh installer UX → #9;
- generic versioned app lifecycle → #10;
- OS host presentation → #11;
- neutral download/network services → #12;
- interactive part replacement and final display independence UX → #13;
- full end-to-end release gate → #14.

### Type consistency

The plan uses one nullable OS signature everywhere: `OsVersion | null`. Hardware projections never accept/return an OS identifier. Canonical display state owns the monitor. The temporary `ModularHardwareState` adapter may still contain a monitor for catalog compatibility until #7, but v6 snapshots do not use it as canonical runtime state.

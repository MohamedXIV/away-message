# Issue #6 — v6 Computer State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed v5 hardware/OS snapshot with a v6 model where inventory, computer setup, display setup, and installed OS are independent and old saves migrate deterministically.

**Architecture:** `HardwareEngine` owns two canonical runtime values, `ComputerSetupState` and `DisplaySetupState`, and derives the existing `HardwareState` compatibility projection from them. `InventoryEngine` owns physical/media ownership for later #7 transactions. `OsEngine` becomes the sole OS authority and permits `currentOsId: null`. v5 legacy hardware is interpreted only inside the v6 migration; a loaded v6 engine never reconstructs canonical state from its derived `hardware` projection.

**Tech Stack:** TypeScript, Vite/React 19 runtime, Zustand, Dexie, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-modular-computer-os-app-platform-design.md`

## Global Constraints

- Fresh game has no assembled PC, no connected monitor, no installed OS, and an empty physical inventory.
- `OsEngine.currentOsId: OsVersion | null` is the only installed/running OS truth.
- No-PC effective specs are CPU tier `0`, RAM `0`, disk `0`, network `null`/`0`, sound `false`.
- `SimulationState.hardware` remains temporarily only as a derived compatibility projection; v6 restore ignores it as authority.
- `ModularHardwareState` remains only as a temporary v5/catalog adapter until #7; canonical runtime state does not embed the monitor or OS.
- Save format becomes `6`; v5 → v6 migration is pure and deterministic.
- A v5 no-PC save does not acquire Orion 4.8 merely because old code defaulted to it.
- The known lost-$35 state may receive only a one-time recovery marker in #6. #7 converts that marker into store ownership.
- #6 does not implement atomic purchasing, Room 104 setup UX, OS-media installation UX, app-version architecture, download services, or part-swap UI.
- TDD per task: failing test → prove RED → minimal implementation → prove GREEN → commit.
- Final gate: `npx tsc --noEmit`, targeted tests, `npm run build`, `npm run test`; no new failures beyond the `AGENTS.md` baseline.

---

## File Map

### Create

- `src/engine/hardware/state.ts` — empty-state factories, v5 modular adapter conversion, flat-v5 conversion, effective hardware projection.
- `src/engine/InventoryEngine.ts` — minimal immutable owner of `PlayerInventoryState`.
- `src/persistence/migrations/v6ComputerState.ts` — pure v5 → v6 migration and lost-starter recovery detection.
- `tests/unit/ComputerStateV6.test.ts` — empty/projection/adapter tests.
- `tests/unit/OsEngineNoOs.test.ts` — nullable OS tests.

### Modify

- `src/engine/types/index.ts`
- `src/engine/hardware/types.ts`
- `src/engine/hardware/HardwareManager.ts`
- `src/engine/HardwareEngine.ts`
- `src/engine/OsEngine.ts`
- `src/engine/SimulationEngine.ts`
- `src/engine/SoftwareRegistry.ts`
- `src/world/modals/SiliconSparesModal.tsx`
- `src/persistence/slots.ts`
- `src/persistence/schema.ts`
- `tests/unit/ModularHardware.test.ts`
- `tests/unit/HardwareEngine.test.ts`
- `tests/unit/SimulationEngine.test.ts`
- `tests/unit/SaveSlots.test.ts`
- `tests/unit/SaveRoundTrip.test.ts`
- `CHANGELOG.md`

## Canonical Contracts

Define or re-export these exact shapes without duplicate sources of truth:

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
  lastBootAtMinute?: number;
  lastInstallAtMinute?: number;
  lastInstallLog?: string[];
  pendingReboot?: boolean;
  proceduralCatalog?: unknown[];
}
```

Add to `src/engine/hardware/types.ts`:

```ts
export interface ChassisComponent {
  id: string;
  name: string;
}
```

`SimulationState` exposes canonical roots plus the temporary projection:

```ts
hardware: HardwareState; // derived only
computer: ComputerSetupState;
display: DisplaySetupState;
inventory: PlayerInventoryState;
os: OsEngineState;
```

---

### Task 1: Define canonical state and pure conversions

**Files:**
- Create: `src/engine/hardware/state.ts`
- Create: `tests/unit/ComputerStateV6.test.ts`
- Modify: `src/engine/types/index.ts`
- Modify: `src/engine/hardware/types.ts`
- Modify: `src/engine/hardware/HardwareManager.ts`

**Produces:**

```ts
createEmptyComputerSetup(): ComputerSetupState
createEmptyDisplaySetup(): DisplaySetupState
createEmptyInventoryState(): PlayerInventoryState
projectEffectiveHardware(computer: ComputerSetupState): HardwareState
legacyModularToCanonical(modular: ModularHardwareState): { computer: ComputerSetupState; display: DisplaySetupState }
legacyFlatHardwareToCanonical(hardware: LegacyV5HardwareLike): { computer: ComputerSetupState; display: DisplaySetupState }
canonicalToLegacyModular(computer: ComputerSetupState, display: DisplaySetupState): ModularHardwareState | undefined
```

`LegacyV5HardwareLike` is a local interface in `hardware/state.ts` containing only the old fields required for migration: `hasComputer?`, `isPoweredOn?`, `cpuTier?`, `cpuName?`, `ramMB?`, `hddTotalGB?`, `hddFreeGB?`, `connectionType?`, `connectionSpeedKbps?`, `soundCardInstalled?`, and `modular?`.

- [ ] **Step 1: Add failing empty-state tests**

```ts
it('represents an empty desk without invented specs', () => {
  const computer = createEmptyComputerSetup();
  const display = createEmptyDisplaySetup();
  expect(display.monitor).toBeNull();
  expect(projectEffectiveHardware(computer)).toMatchObject({
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
```

Add a second test converting `createScrapYardBundle()` and assert the monitor lands in `display.monitor`, while CPU/RAM/storage land in `computer`.

- [ ] **Step 2: Prove RED**

```bash
npx vitest run tests/unit/ComputerStateV6.test.ts
```

Expected: FAIL because the helpers/types do not exist.

- [ ] **Step 3: Implement exact empty factories**

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

export const createEmptyDisplaySetup = (): DisplaySetupState => ({ monitor: null });
export const createEmptyInventoryState = (): PlayerInventoryState => ({ items: [] });
```

`projectEffectiveHardware()` returns the zero/unavailable values above when `assembled === false`; otherwise it sums RAM, uses `storage[0]` as the current primary drive, and reads CPU/network/sound from canonical parts. It never accepts an OS.

- [ ] **Step 4: Implement v5 modular conversion**

`legacyModularToCanonical()` maps the current required `ModularHardwareState` into a canonical computer plus independent display. Use `chassis_legacy_beige_atx` / `Beige ATX Chassis` as the deterministic chassis backfill. Convert single `storage`/`opticalDrive` fields into one-element arrays. Map legacy inserted disc ID into `computer.insertedMediaId`.

- [ ] **Step 5: Implement flat-v5 conversion without calling `migrateSnapshotToV5`**

`legacyFlatHardwareToCanonical()` must directly reproduce the deterministic v5 preservation values needed for flat saves, avoiding any import from `slots.ts` and therefore avoiding a migration cycle. Use:

```text
motherboard: mb_standard_atx / Standard ATX Slot-1 Board / 2 slots / 512MB per slot / Slot-1
CPU: cpu_pentium3_800 at tier 2, otherwise cpu_celeron_450 at tier 1
RAM: one migrated stick containing the old effective ramMB
storage: hdd_migrated using old total/free GB, 5400 RPM, throughput 1.0
optical: optical_cdrom_24x
sound: sound_sb16 when old soundCardInstalled !== false, otherwise pc-speaker profile
network: nic_migrated using old connection type/speed
monitor: mon_standard_15 / 15-inch Standard CRT / curvature .7 / scanlines .5 / bloom .4 / flicker true
```

This helper is used only by v5 migration.

- [ ] **Step 6: Remove fake/OS fallback from HardwareManager**

Replace `toLegacyHardwareState(state, osVersion)` usage with `projectEffectiveHardware`. No conversion helper may insert 512MB/40GB/DSL because hardware is absent.

- [ ] **Step 7: Prove GREEN**

```bash
npx vitest run tests/unit/ComputerStateV6.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/types/index.ts src/engine/hardware/types.ts src/engine/hardware/state.ts src/engine/hardware/HardwareManager.ts tests/unit/ComputerStateV6.test.ts
git commit -m "refactor: define v6 computer and display state"
```

---

### Task 2: Refactor HardwareEngine to canonical computer/display state

**Files:**
- Modify: `src/engine/HardwareEngine.ts`
- Modify: `tests/unit/HardwareEngine.test.ts`
- Modify: `tests/unit/ModularHardware.test.ts`

**Produces:**

```ts
getComputerState(): Readonly<ComputerSetupState>
getDisplayState(): Readonly<DisplaySetupState>
getState(): Readonly<HardwareState>
getModularState(): ModularHardwareState | undefined // deprecated #7 adapter only
checkHardwareRequirements(req: Pick<SoftwareRequirement, 'minRamMB' | 'minCpuTier' | 'requiredDiskBytes'>): { compatible: boolean; reasons: string[] }
calculateRamPressure(runningAppsMemoryMB: number, osBaselineMB: number): RamPressure
```

- [ ] **Step 1: Add failing HardwareEngine tests**

```ts
it('starts with no canonical machine and zero effective specs', () => {
  const hw = new HardwareEngine(new EventBus());
  expect(hw.getComputerState().assembled).toBe(false);
  expect(hw.getDisplayState().monitor).toBeNull();
  expect(hw.getState().ramMB).toBe(0);
  expect(hw.getState().connectionType).toBeNull();
});
```

Add a test proving hardware requirements fail on the empty machine.

- [ ] **Step 2: Prove RED**

```bash
npx vitest run tests/unit/HardwareEngine.test.ts
```

Expected: FAIL because HardwareEngine still owns the flat v5 bag.

- [ ] **Step 3: Replace private state**

```ts
private computer: ComputerSetupState;
private display: DisplaySetupState;
```

Constructor accepts `{ computer?: Partial<ComputerSetupState>; display?: Partial<DisplaySetupState> }`; missing values use Task 1 factories. `getState()` always derives via `projectEffectiveHardware(this.computer)`.

- [ ] **Step 4: Remove every OS responsibility**

Delete HardwareEngine's `osVersion` default/state, OS check in `checkRequirements`, OS lookup inside RAM pressure, and `upgradeOs`. RAM pressure receives `osBaselineMB` explicitly.

- [ ] **Step 5: Preserve the temporary modular adapter, but make it OS-neutral**

`getModularState()` returns `canonicalToLegacyModular(computer, display)`. `installModularHardware(modular, _ignoredLegacyOs?)` may remain only until #7; it maps through `legacyModularToCanonical`, preserves `modular.isPoweredOn`, ignores the OS argument, and emits hardware/display events. A test must prove passing `'Orion_6.0'` cannot create an OS field in HardwareEngine.

- [ ] **Step 6: Update modular tests**

Keep RAM/storage/slot/catalog tests. Replace the old OS-bearing legacy conversion assertion with:

```ts
const canonical = legacyModularToCanonical(createPowerWorkstationBundle());
const effective = projectEffectiveHardware(canonical.computer);
expect(effective.ramMB).toBe(256);
expect('osVersion' in effective).toBe(false);
```

Remove the test that treats instant bundle + OS installation as the canonical lifecycle.

- [ ] **Step 7: Prove GREEN and commit**

```bash
npx vitest run tests/unit/ComputerStateV6.test.ts tests/unit/HardwareEngine.test.ts tests/unit/ModularHardware.test.ts
git add src/engine/HardwareEngine.ts tests/unit/HardwareEngine.test.ts tests/unit/ModularHardware.test.ts
git commit -m "refactor: make hardware state OS-neutral"
```

---

### Task 3: Make OsEngine nullable and SimulationEngine the single OS authority

**Files:**
- Create: `src/engine/InventoryEngine.ts`
- Create: `tests/unit/OsEngineNoOs.test.ts`
- Modify: `src/engine/OsEngine.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify: `src/engine/SoftwareRegistry.ts`
- Modify: `src/world/modals/SiliconSparesModal.tsx`
- Modify: `tests/unit/SimulationEngine.test.ts`

**Produces/changes:**

```ts
InventoryEngine.getState(): Readonly<PlayerInventoryState>
InventoryEngine.loadState(state: PlayerInventoryState): void
OsEngine.getCurrentOsId(): OsVersion | null
OsEngine.getCurrentRelease(): OsRelease | null
OsEngine.getTheme(): OsThemeId | null
```

`OsEngine.getRamOverheadMB()` returns `0` when no OS exists. `checkCompatibility()` returns `No operating system installed.` when null.

- [ ] **Step 1: Add failing nullable-OS tests**

```ts
it('does not invent Orion 4.8', () => {
  const os = new OsEngine(new EventBus(), { currentOsId: null });
  expect(os.getCurrentOsId()).toBeNull();
  expect(os.getCurrentRelease()).toBeNull();
  expect(os.getTheme()).toBeNull();
  expect(os.getRamOverheadMB()).toBe(0);
});

it('round-trips explicit null', () => {
  const first = new OsEngine(new EventBus(), { currentOsId: null });
  const second = new OsEngine(new EventBus(), first.getState());
  expect(second.getCurrentOsId()).toBeNull();
});
```

- [ ] **Step 2: Add failing fresh SimulationEngine test**

```ts
const sim = new SimulationEngine();
const state = sim.getState();
expect(state.computer.assembled).toBe(false);
expect(state.display.monitor).toBeNull();
expect(state.inventory.items).toEqual([]);
expect(state.os.currentOsId).toBeNull();
expect(state.hardware.hasComputer).toBe(false);
expect('osVersion' in state.hardware).toBe(false);
```

- [ ] **Step 3: Prove RED**

```bash
npx vitest run tests/unit/OsEngineNoOs.test.ts tests/unit/SimulationEngine.test.ts
```

- [ ] **Step 4: Implement null-safe OsEngine**

Constructor distinguishes absent key from explicit null and defaults fresh engines to null. Do not read `HardwareState.osVersion` inside OsEngine.

Null behavior:
- `getCurrentRelease()` → null
- `getInstalledReleases()` → []
- `getTheme()` → null
- `getRamOverheadMB()` → 0
- `checkCompatibility()` → incompatible with `No operating system installed.`
- `loadState()` assigns null when the key is present
- `canInstall()` skips downgrade/current-family comparisons when no current release exists; #9 later adds media/fresh-install mode policy.

- [ ] **Step 5: Add minimal InventoryEngine**

```ts
export class InventoryEngine {
  private state: PlayerInventoryState;

  constructor(initial?: Partial<PlayerInventoryState>) {
    this.state = {
      items: initial?.items?.map((item) => ({ ...item })) ?? [],
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

Do not add purchase/add/remove methods yet.

- [ ] **Step 6: Rewire SimulationEngine**

Fresh construction:

```ts
this.hardware = new HardwareEngine(this.events, {
  computer: initialState?.computer,
  display: initialState?.display,
});
this.inventory = new InventoryEngine(initialState?.inventory);
this.os = new OsEngine(this.events, initialState?.os);
```

Remove both hardware↔OS synchronization blocks. `getState()` returns canonical roots from their owners and derives `hardware` only through HardwareEngine.

- [ ] **Step 7: Prevent the legacy OS action from becoming a first-install bypass**

For `HARDWARE_UPGRADE_OS`:
- if `this.os.getCurrentOsId() === null`, return `{ success: false, error: 'No operating system is installed. Boot from setup media to install one.' }` without charging cash or changing disk;
- if an OS already exists, temporarily route the existing upgrade behavior through `OsEngine` as the sole writer and hardware only for disk accounting.

This preserves old upgrade callers until #9 without allowing a magic first installation.

- [ ] **Step 8: Make nullable OS compile-safe at the immediate boundary**

`SoftwareRegistry` dependency becomes `getOsVersion: () => OsVersion | null`; null produces an OS compatibility failure with current text `None`. Do not generalize app releases here.

In `SiliconSparesModal`, replace footer `hardware.osVersion` reads with `state.os.currentOsId ?? 'No OS'`. Do not implement #7 purchasing in this task.

- [ ] **Step 9: Prove GREEN and commit**

```bash
npx vitest run tests/unit/OsEngineNoOs.test.ts tests/unit/SimulationEngine.test.ts tests/unit/HardwareEngine.test.ts tests/unit/SoftwareRegistry.test.ts
git add src/engine/InventoryEngine.ts src/engine/OsEngine.ts src/engine/SimulationEngine.ts src/engine/SoftwareRegistry.ts src/world/modals/SiliconSparesModal.tsx tests/unit/OsEngineNoOs.test.ts tests/unit/SimulationEngine.test.ts
git commit -m "refactor: make OsEngine the sole OS authority"
```

---

### Task 4: Add deterministic v5 → v6 migration

**Files:**
- Create: `src/persistence/migrations/v6ComputerState.ts`
- Modify: `src/persistence/slots.ts`
- Modify: `src/persistence/schema.ts`
- Modify: `tests/unit/SaveSlots.test.ts`

**Produces:**

```ts
migrateSnapshotToV6(snapshot: SimulationState, fromVersion: number): SimulationState
isRecoverableBrokenStarterPurchase(snapshot: SimulationState): boolean
```

- [ ] **Step 1: Add failing working-PC migration test**

Use a v5-style snapshot with `hasComputer: true`, modular monitor/CPU/RAM/network, and `os.currentOsId: 'Orion_5.0'`. Assert v6 preserves effective parts, moves monitor to `display.monitor`, keeps Orion 5.0 in `os`, creates installed ownership rows, and produces no `hardware.osVersion`.

- [ ] **Step 2: Add failing no-PC ghost-OS test**

Use a v5 snapshot with `hasComputer: false`, old flat default specs, `os.currentOsId: 'Orion_4.8'`, no install timestamp, and no patches. Assert v6 gives empty computer/display, null OS, and zero effective RAM/network.

- [ ] **Step 3: Add narrow recovery tests**

Recovery is true only when all are true:
- source version is v5;
- Day 1;
- cash rounded to cents is exactly `$3.00`;
- no working/modular computer;
- no `lastInstallAtMinute` and no installed OS patches.

Then migration adds only:

```ts
legacyRecovery: {
  starterBundlePurchaseLost: true,
  consumed: false,
}
```

Negative tests: `$2`, `$4`, Day 2, working PC, or explicit install evidence → no marker.

- [ ] **Step 4: Prove RED**

```bash
npx vitest run tests/unit/SaveSlots.test.ts
```

- [ ] **Step 5: Implement migration without importing `slots.ts` back into the migration**

Rules:
1. v5 modular working PC → `legacyModularToCanonical`.
2. v5 flat-only working PC → `legacyFlatHardwareToCanonical`.
3. Deterministic installed ownership IDs: `migrated:chassis:0`, `migrated:motherboard:0`, `migrated:cpu:0`, `migrated:ram:N`, `migrated:storage:0`, `migrated:optical:0`, `migrated:sound:0`, `migrated:network:0`, `migrated:monitor:0`.
4. `catalogItemId` uses each preserved component ID; migrated location is `installed`.
5. Legacy inserted disc becomes `migrated:media:inserted`, location `inserted`, and `computer.insertedMediaId` references that instance ID.
6. Working-PC OS priority: real `snapshot.os.currentOsId`, otherwise legacy `hardware.osVersion`.
7. No-PC migration sets OS null; the old 4.8 fallback is not real install evidence.
8. Apply the recovery marker only through `isRecoverableBrokenStarterPurchase`.
9. Recompute derived `hardware` from canonical computer.
10. Clone nested arrays/objects; never mutate input.

- [ ] **Step 6: Bump and chain v6 in slots.ts**

```ts
export const SAVE_FORMAT_VERSION = 6;
```

Migration order remains v4 → v5 → v6. `saveSlot()` derives summary OS only from `snapshot.os.currentOsId`.

- [ ] **Step 7: Make save-summary OS nullable**

In `schema.ts`:

```ts
osVersion: string | null;
```

and:

```ts
osVersion: z.string().regex(/^Orion_/).min(3).nullable(),
```

Do not add a Dexie `MIGRATIONS[]` entry for the snapshot document; existing repo policy keeps document migrations in `slots.ts`.

- [ ] **Step 8: Prove GREEN and commit**

```bash
npx vitest run tests/unit/SaveSlots.test.ts tests/unit/ComputerStateV6.test.ts
git add src/persistence/migrations/v6ComputerState.ts src/persistence/slots.ts src/persistence/schema.ts tests/unit/SaveSlots.test.ts
git commit -m "feat: migrate save snapshots to v6 computer state"
```

---

### Task 5: Round-trip and compile migration fallout without reintroducing shadow state

**Files:**
- Modify: `tests/unit/SaveRoundTrip.test.ts`
- Modify: `tests/unit/SimulationEngine.test.ts`
- Modify: `CHANGELOG.md`
- Modify only if TypeScript identifies a stale consumer: the exact source file containing that error. The permitted source substitutions are fixed below; no compatibility cast may restore removed state.

**Consumes:** Tasks 1–4 public contracts.

- [ ] **Step 1: Add failing round-trip assertions**

For both an empty v6 state and a migrated working-PC state:

```ts
expect(restored.computer).toEqual(saved.computer);
expect(restored.display).toEqual(saved.display);
expect(restored.inventory).toEqual(saved.inventory);
expect(restored.os).toEqual(saved.os);
expect(restored.hardware).toEqual(projectEffectiveHardware(restored.computer));
expect('osVersion' in restored.hardware).toBe(false);
```

- [ ] **Step 2: Run round-trip tests**

```bash
npx vitest run tests/unit/SaveRoundTrip.test.ts tests/unit/SimulationEngine.test.ts
```

Fix only restore/export paths that still treat v5 `hardware` as canonical. In v6, constructor restore consumes `computer`, `display`, `inventory`, and `os` directly.

- [ ] **Step 3: Run TypeScript and apply only these canonical substitutions**

```bash
npx tsc --noEmit
```

Every stale read caused by #6 must map as follows:

```text
hardware.osVersion       → state.os.currentOsId or engine.os.getCurrentOsId()
hardware.modular.monitor → state.display.monitor
hardware.modular         → state.computer/state.display; getModularState() only for temporary #7 store compatibility
non-null OS display text → currentOsId ?? 'No OS'
OS RAM baseline          → engine.os.getRamOverheadMB() passed into HardwareEngine RAM-pressure calculation
```

If TypeScript reports a file outside the File Map, add that exact file to the Task 5 commit and use only the mapping above. Do not use `as OsVersion` to erase nullability and do not restore `osVersion` or `modular` to `HardwareState`.

- [ ] **Step 4: Update CHANGELOG**

Document:
- save format v6;
- fresh saves can persist no PC/no OS honestly;
- computer/display/inventory/OS are separated;
- working v5 saves preserve effective machine/display/OS;
- no-PC v5 saves no longer invent Orion 4.8.

- [ ] **Step 5: Run the targeted #6 suite**

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

- [ ] **Step 6: Run project gates**

```bash
npx tsc --noEmit
npm run build
npm run test
```

Expected: typecheck/build pass; full tests contain zero new failures relative to the `AGENTS.md` baseline. If the documented three `WorldScenes.test.ts` failures remain, record them exactly as baseline.

- [ ] **Step 7: Commit verified fallout**

First inspect:

```bash
git status --short
```

Then stage only files changed for #6 and commit:

```bash
git commit -m "test: verify v6 computer state migration"
```

- [ ] **Step 8: Update and close GitHub #6 only on exact-head evidence**

Comment with exact head SHA, targeted result, typecheck, build, full-suite result, working-PC migration result, no-PC ghost-Orion result, recovery-marker result, and confirmation that `HardwareState` has no OS authority. Close #6 only if every acceptance criterion is satisfied. Do not begin #7 before that gate is green.

---

## Self-Review

**Spec coverage:** fresh empty state → Tasks 1–3; independent state roots → Tasks 1–3; sole nullable OS authority → Task 3; no fake hardware → Tasks 1–2; v5 preservation + no-PC behavior + recovery → Task 4; save v6/schema/changelog → Tasks 4–5; exact regression evidence → Task 5.

**Placeholder scan:** no `TODO`, `TBD`, “implement later”, or unnamed error-handling steps remain.

**Type consistency:** every OS API uses `OsVersion | null`; hardware projection contains no OS identifier; monitor authority is `DisplaySetupState`; the temporary `ModularHardwareState` is explicitly an adapter only. v6 migration converts flat v5 hardware directly through `legacyFlatHardwareToCanonical`, so there is no circular migration dependency.

**Scope boundary:** #7 purchase transactions, #8 setup/POST, #9 OS media/install UX, #10 app architecture, #11 OS presentation, #12 network/download services, #13 part-swap UX, and #14 end-to-end release proof remain separate issues.
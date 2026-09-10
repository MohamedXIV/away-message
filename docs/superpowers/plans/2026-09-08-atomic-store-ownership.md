# Atomic Store Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Silicon & Spares purchases one atomic SimulationEngine transaction that charges once and produces persisted physical/media ownership without assembling hardware, inserting media, powering a PC, or installing an OS.

**Architecture:** `hardware/catalog.ts` will separate authored physical item definitions from checkout SKUs. SKUs reference finite catalog items, while `InventoryEngine` allocates deterministic owned instances and persists per-SKU purchase counts. `SimulationEngine` intercepts one `STORE_PURCHASE_ITEM` action, validates the whole transaction, commits ownership, then uses the existing economy dispatch path for the single cash mutation/update. React becomes a thin caller of that action. The narrow v5 lost-$35 migration marker authorizes exactly one zero-charge starter transaction and is consumed by the same inventory commit.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest, existing SimulationEngine/EventBus/EconomyEngine/InventoryEngine, Vite.

**Spec:** `docs/superpowers/specs/2026-09-08-modular-computer-os-app-platform-design.md`

## Global Constraints

- PR #4 remains Draft; this issue does not make it release-ready.
- A fresh game still has no assembled computer, no display, no installed OS, and no installed Pulse.
- The `$35` starter remains 366 MHz / 64 MB / 2.1 GB / 24x CD-ROM / sound / 56k modem / 14-inch curved CRT.
- The starter package includes an Orion 4.8 setup CD as a separate owned media item; Orion is not preinstalled.
- Orion 4.8 minimum RAM is 64 MB.
- Pulse 5.2 minimum RAM is 64 MB.
- The exact starter path must have enough authored free disk for Orion 4.8 and Pulse 5.2 without bypassing requirement checks.
- Store purchase is ownership only. Setup/power/POST belongs to #8; media insertion/fresh OS install belongs to #9; app install lifecycle belongs to #10.
- All new Silicon & Spares physical purchases use `room_package` as the bounded delivery location for this epic. A future broader physical-world/carrying system may refine transport without changing ownership identity.
- The v5 lost-$35 recovery remains exact and bounded: it may only zero-charge the starter SKU when `inventory.legacyRecovery.starterBundlePurchaseLost === true && consumed === false`.
- Full-suite acceptance is no failures beyond the same three documented `WorldScenes.test.ts` baseline failures.
- Verification installs dependencies with `npm ci --legacy-peer-deps` only in the verifier harness because the current baseline dependency graph has the existing tinybase/Zod peer conflict; #7 does not alter dependencies.

---

## File Structure

- `src/engine/hardware/types.ts` — physical catalog/store-SKU contracts only; no transaction logic.
- `src/engine/hardware/catalog.ts` — finite physical item definitions and Silicon & Spares SKU composition.
- `src/engine/InventoryEngine.ts` — deterministic ownership allocation, purchase counts, and legacy-recovery consumption.
- `src/engine/types/index.ts` — persisted inventory additions, store action/result types.
- `src/engine/SimulationEngine.ts` — authoritative store transaction orchestration.
- `src/engine/OsCatalog.ts` — baseline Orion 4.8 authored requirement correction.
- `src/engine/PulseCatalog.ts` — baseline Pulse 5.2 authored requirement correction.
- `src/store/useSimulationStore.ts` — one `purchaseStoreItem` action wrapper.
- `src/world/modals/SiliconSparesModal.tsx` — render catalog + call transaction + show result; no domain mutation.
- `src/persistence/migrations/v6ComputerState.ts` — ensure migrated/new inventory initializes purchase-count state while preserving the exact recovery marker.
- `tests/unit/StoreCatalog.test.ts` — authored SKU composition and starter no-soft-lock invariants.
- `tests/unit/StorePurchase.test.ts` — engine transaction atomicity, ownership-only behavior, duplicate policy, and recovery.
- Existing v6 save/migration tests — persistence regressions for purchase counts/recovery where needed.

---

### Task 1: Author finite physical items and checkout-only SKUs

**Files:**
- Modify: `src/engine/hardware/types.ts`
- Modify: `src/engine/hardware/catalog.ts`
- Modify: `src/engine/OsCatalog.ts`
- Modify: `src/engine/PulseCatalog.ts`
- Create: `tests/unit/StoreCatalog.test.ts`

**Interfaces:**
- Consumes: existing hardware component interfaces and `OwnedItemKind`.
- Produces:
  ```ts
  type PhysicalCatalogComponentKind =
    | 'chassis' | 'motherboard' | 'cpu' | 'ram' | 'storage'
    | 'optical' | 'sound' | 'network' | 'monitor' | 'os_media';

  interface PhysicalCatalogItem {
    id: string;
    kind: 'hardware' | 'display' | 'media';
    componentKind: PhysicalCatalogComponentKind;
    component?: ChassisComponent | MotherboardComponent | CpuComponent |
      RamStickComponent | StorageComponent | OpticalDriveComponent |
      SoundCardComponent | NetworkCardComponent | MonitorComponent;
    media?: { type: 'os_installer'; title: string; osTarget: OsVersion };
  }

  interface StoreSkuContent {
    catalogItemId: string;
    quantity: number;
  }

  interface HardwareStoreItem {
    // existing presentation fields
    contents: StoreSkuContent[];
    repeatable: boolean;
  }

  const PHYSICAL_ITEM_CATALOG: Record<string, PhysicalCatalogItem>;
  function getPhysicalCatalogItem(id: string): PhysicalCatalogItem | undefined;
  ```

- [ ] **Step 1: Write RED catalog tests for the starter composition**

```ts
import { describe, expect, it } from 'vitest';
import { HARDWARE_STORE_INVENTORY, PHYSICAL_ITEM_CATALOG } from '../../src/engine/hardware/catalog';
import { getReleaseById } from '../../src/engine/OsCatalog';
import { getPulseReleaseById } from '../../src/engine/PulseCatalog';

describe('Silicon & Spares authored ownership catalog', () => {
  it('expands the $35 starter into ten ordinary owned definitions including separate Orion 4.8 media', () => {
    const starter = HARDWARE_STORE_INVENTORY.find((sku) => sku.id === 'bundle_scrapyard')!;
    expect(starter.price).toBe(35);
    expect(starter.repeatable).toBe(false);
    expect(starter.contents).toHaveLength(10);

    const defs = starter.contents.flatMap((entry) =>
      Array.from({ length: entry.quantity }, () => PHYSICAL_ITEM_CATALOG[entry.catalogItemId]),
    );
    expect(defs.every(Boolean)).toBe(true);
    expect(defs.filter((d) => d!.kind === 'hardware')).toHaveLength(8);
    expect(defs.filter((d) => d!.kind === 'display')).toHaveLength(1);
    expect(defs.filter((d) => d!.kind === 'media')).toHaveLength(1);
    expect(defs.find((d) => d!.kind === 'media')!.media?.osTarget).toBe('Orion_4.8');
  });

  it('keeps the exact starter capable of baseline Orion 4.8 then Pulse 5.2', () => {
    const starter = HARDWARE_STORE_INVENTORY.find((sku) => sku.id === 'bundle_scrapyard')!;
    const defs = starter.contents.map((entry) => PHYSICAL_ITEM_CATALOG[entry.catalogItemId]!);
    const ramMb = defs
      .filter((d) => d.componentKind === 'ram')
      .reduce((total, d) => total + (d.component && 'sizeMb' in d.component ? d.component.sizeMb : 0), 0);
    const storage = defs.find((d) => d.componentKind === 'storage')!.component!;
    const freeGb = 'freeBytes' in storage ? storage.freeBytes / 1_000_000_000 : 0;
    const os = getReleaseById('Orion_4.8')!;
    const pulse = getPulseReleaseById('pulse_5.2')!;

    expect(ramMb).toBeGreaterThanOrEqual(os.requirements.minRamMB);
    expect(freeGb).toBeGreaterThanOrEqual(os.requirements.minDiskGB);
    expect(ramMb).toBeGreaterThanOrEqual(pulse.requirements.minRamMB);
    expect((freeGb - os.installSizeGB) * 1000).toBeGreaterThanOrEqual(pulse.requirements.minDiskMB);
  });
});
```

- [ ] **Step 2: Run the new catalog tests and verify RED**

Run:
```bash
npx vitest run tests/unit/StoreCatalog.test.ts
```
Expected: FAIL because SKUs do not yet expose `contents/repeatable`, the physical catalog does not exist, and the starter requirements conflict.

- [ ] **Step 3: Implement the physical catalog and remove OS-from-bundle semantics**

Author these starter physical definitions with stable IDs:

```ts
const STARTER_CONTENT_IDS = [
  'chassis_scrapyard_beige_atx',
  'mb_standard_atx',
  'cpu_celeron_366',
  'ram_sdram_64_a',
  'hdd_quantum_2gb',
  'optical_cdrom_24x',
  'sound_sb16',
  'modem_v90_56k',
  'mon_beige_curved_14',
  'media_orion_48_setup',
] as const;
```

`media_orion_48_setup` must be:

```ts
{
  id: 'media_orion_48_setup',
  kind: 'media',
  componentKind: 'os_media',
  media: {
    type: 'os_installer',
    title: 'Orion OS 4.8 Setup CD',
    osTarget: 'Orion_4.8',
  },
}
```

Keep the starter HDD capacity at `2_100_000_000` bytes but change authored `freeBytes` to `1_800_000_000`. This leaves enough room for the 1.2GB Orion install and 32MB Pulse requirement while preserving the 2.1GB machine identity.

Remove `bundleConfig.installedOs` from `HardwareStoreItem`; bundle presentation copy must no longer say “pre-loaded”. Retain `createScrapYardBundle()` only as a legacy/test fixture helper, deriving its component values from the same authored definitions where practical.

Define purchase policy:
- Complete PC bundles: `repeatable: false` per SKU.
- OS media SKUs: `repeatable: false` per SKU.
- RAM/storage/monitor parts: `repeatable: true`.

Every SKU must have non-empty `contents`, and every referenced ID must exist in `PHYSICAL_ITEM_CATALOG`.

- [ ] **Step 4: Correct baseline authored requirements without bypasses**

In `OsCatalog.ts`:

```ts
// Orion 4.8 only
requirements: { minRamMB: 64, minCpuTier: 1, minDiskGB: 1.2 }
```

In `PulseCatalog.ts`:

```ts
// Pulse 5.2 only
requirements: { minOs: 'Orion_4.8' as OsVersion, minRamMB: 64, minDiskMB: 32 }
```

Do not lower later Pulse/Orion requirements in this task.

- [ ] **Step 5: Run catalog tests GREEN**

Run:
```bash
npx vitest run tests/unit/StoreCatalog.test.ts tests/unit/OsEngineNoOs.test.ts tests/unit/SoftwareRegistry.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit the catalog slice**

```bash
git add src/engine/hardware/types.ts src/engine/hardware/catalog.ts src/engine/OsCatalog.ts src/engine/PulseCatalog.ts tests/unit/StoreCatalog.test.ts
git commit -m "feat: author physical store sku contents"
```

---

### Task 2: Give InventoryEngine deterministic purchase ownership

**Files:**
- Modify: `src/engine/types/index.ts`
- Modify: `src/engine/hardware/state.ts`
- Modify: `src/engine/InventoryEngine.ts`
- Modify: `src/persistence/migrations/v6ComputerState.ts`
- Create: `tests/unit/StorePurchase.test.ts` (inventory-focused RED tests first)

**Interfaces:**
- Consumes: `StoreSkuContent`, `OwnedItemLocation`, `OwnedItem`.
- Produces:
  ```ts
  interface PlayerInventoryState {
    items: OwnedItem[];
    purchaseCounts: Record<string, number>;
    legacyRecovery?: LegacyRecoveryState;
  }

  interface PreparedInventoryPurchase {
    skuId: string;
    purchaseOrdinal: number;
    items: OwnedItem[];
    consumeLegacyStarterRecovery: boolean;
  }

  InventoryEngine.canPurchaseSku(skuId: string, repeatable: boolean): { ok: boolean; error?: string };
  InventoryEngine.preparePurchase(
    skuId: string,
    contents: readonly StoreSkuContent[],
    catalogKinds: Readonly<Record<string, OwnedItemKind>>,
    options?: { consumeLegacyStarterRecovery?: boolean; location?: OwnedItemLocation },
  ): PreparedInventoryPurchase;
  InventoryEngine.commitPurchase(prepared: PreparedInventoryPurchase): void;
  InventoryEngine.canClaimLegacyStarterRecovery(): boolean;
  ```

- [ ] **Step 1: Add RED tests for deterministic IDs, purchase counts, and one-time recovery**

```ts
it('allocates stable purchase instances without mutating until commit', () => {
  const inventory = new InventoryEngine();
  const prepared = inventory.preparePurchase(
    'part_ram_64mb',
    [{ catalogItemId: 'ram_sdram_64', quantity: 1 }],
    { ram_sdram_64: 'hardware' },
  );

  expect(inventory.getState().items).toHaveLength(0);
  expect(prepared.items[0]?.instanceId).toBe('purchase:part_ram_64mb:1:ram_sdram_64:1');
  inventory.commitPurchase(prepared);
  expect(inventory.getState().purchaseCounts.part_ram_64mb).toBe(1);
});

it('consumes the migrated starter recovery only when the prepared starter grant commits', () => {
  const inventory = new InventoryEngine({
    items: [],
    purchaseCounts: {},
    legacyRecovery: { starterBundlePurchaseLost: true, consumed: false },
  });
  expect(inventory.canClaimLegacyStarterRecovery()).toBe(true);
  const prepared = inventory.preparePurchase(
    'bundle_scrapyard',
    [{ catalogItemId: 'cpu_celeron_366', quantity: 1 }],
    { cpu_celeron_366: 'hardware' },
    { consumeLegacyStarterRecovery: true, location: 'room_package' },
  );
  inventory.commitPurchase(prepared);
  expect(inventory.getState().legacyRecovery?.consumed).toBe(true);
  expect(inventory.canClaimLegacyStarterRecovery()).toBe(false);
});
```

- [ ] **Step 2: Run the inventory tests RED**

Run:
```bash
npx vitest run tests/unit/StorePurchase.test.ts
```
Expected: FAIL because purchase counts and purchase APIs do not exist.

- [ ] **Step 3: Implement persisted purchase counts and deterministic instance allocation**

`createEmptyInventoryState()` must return:

```ts
{ items: [], purchaseCounts: {} }
```

`InventoryEngine` clone/load must deep-copy `purchaseCounts`.

Instance IDs use only persisted transaction order and authored IDs:

```ts
`purchase:${skuId}:${purchaseOrdinal}:${catalogItemId}:${unitOrdinal}`
```

No `Date.now()`, `Math.random()`, UUID generation, or render/UI state participates in identity.

`preparePurchase()` must throw/reject malformed content (unknown kind, quantity < 1) before mutation. `commitPurchase()` must:
1. append prepared items;
2. increment exactly that SKU count to `purchaseOrdinal`;
3. consume the legacy marker only when the prepared object explicitly requests it.

- [ ] **Step 4: Preserve/backfill purchaseCounts in v6 migration**

For v5→v6:

```ts
const inventory: PlayerInventoryState = { items: [], purchaseCounts: {} };
```

For already-v6 snapshots, `InventoryEngine` must tolerate an early-v6 snapshot without `purchaseCounts` by backfilling `{}` at load time.

- [ ] **Step 5: Run inventory + migration tests GREEN**

Run:
```bash
npx vitest run tests/unit/StorePurchase.test.ts tests/unit/ComputerStateV6.test.ts tests/unit/SaveSlots.test.ts tests/unit/SaveRoundTrip.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit the inventory slice**

```bash
git add src/engine/types/index.ts src/engine/hardware/state.ts src/engine/InventoryEngine.ts src/persistence/migrations/v6ComputerState.ts tests/unit/StorePurchase.test.ts tests/unit/ComputerStateV6.test.ts tests/unit/SaveSlots.test.ts tests/unit/SaveRoundTrip.test.ts
git commit -m "feat: persist deterministic store ownership"
```

---

### Task 3: Make SimulationEngine own one atomic store transaction

**Files:**
- Modify: `src/engine/types/index.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Extend: `tests/unit/StorePurchase.test.ts`

**Interfaces:**
- Consumes: `HARDWARE_STORE_INVENTORY`, `PHYSICAL_ITEM_CATALOG`, InventoryEngine purchase APIs, existing `PLAYER_SPEND_CASH` core action.
- Produces:
  ```ts
  interface StorePurchaseResultData {
    purchasedItemIds: string[];
    charged: number;
    recoveredLegacyPurchase: boolean;
  }

  type SimulationAction =
    | { type: 'STORE_PURCHASE_ITEM'; storeId: 'silicon_spares'; skuId: string }
    | ...;

  SimulationEngine.purchaseStoreItem(
    storeId: 'silicon_spares',
    skuId: string,
  ): ActionResult<StorePurchaseResultData>;
  ```

- [ ] **Step 1: Write RED engine transaction tests**

Add these exact behaviors to `StorePurchase.test.ts`:

```ts
it('charges $35 exactly once and grants all starter items without setting up a PC or OS', () => {
  const sim = new SimulationEngine();
  const result = sim.dispatchAction({
    type: 'STORE_PURCHASE_ITEM',
    storeId: 'silicon_spares',
    skuId: 'bundle_scrapyard',
  });

  expect(result.success).toBe(true);
  expect((result.data as StorePurchaseResultData).charged).toBe(35);
  expect(sim.getState().player.cash).toBe(3);
  expect(sim.getState().inventory.items).toHaveLength(10);
  expect(sim.getState().inventory.items.every((item) => item.location === 'room_package')).toBe(true);
  expect(sim.getState().computer.assembled).toBe(false);
  expect(sim.getState().computer.poweredOn).toBe(false);
  expect(sim.getState().display.monitor).toBeNull();
  expect(sim.getState().os.currentOsId).toBeNull();
});

it('is fully atomic on insufficient cash', () => {
  const sim = new SimulationEngine({ player: { cash: 10 } } as any);
  const before = sim.exportSnapshot();
  const result = sim.dispatchAction({ type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard' });
  expect(result.success).toBe(false);
  expect(sim.getState().player.cash).toBe(10);
  expect(sim.getState().inventory).toEqual(before.inventory);
});

it.each(['part_ram_64mb', 'part_mon_trinitron', 'disc_orion_50'])('purchase of %s creates ownership only', (skuId) => {
  const sim = new SimulationEngine({ player: { cash: 500 } } as any);
  const beforeComputer = sim.getState().computer;
  const beforeDisplay = sim.getState().display;
  const beforeOs = sim.getState().os;
  expect(sim.dispatchAction({ type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId }).success).toBe(true);
  expect(sim.getState().computer).toEqual(beforeComputer);
  expect(sim.getState().display).toEqual(beforeDisplay);
  expect(sim.getState().os).toEqual(beforeOs);
});
```

Also test:
- unknown store/SKU changes nothing;
- buying a non-repeatable starter/media SKU twice rejects the second transaction without a second charge;
- repeatable RAM can be purchased twice and creates two distinct instance IDs;
- exact migrated recovery starter transaction charges `0`, creates the same 10 items, marks recovery consumed, and a second attempt fails;
- a normal fresh player with `$3` and no recovery marker cannot claim a free starter.

- [ ] **Step 2: Run transaction tests RED**

Run:
```bash
npx vitest run tests/unit/StorePurchase.test.ts
```
Expected: FAIL because `STORE_PURCHASE_ITEM` is unhandled.

- [ ] **Step 3: Implement the transaction in the v6 facade**

`purchaseStoreItem()` algorithm:

```ts
if (storeId !== 'silicon_spares') return fail('Unknown store');
const sku = HARDWARE_STORE_INVENTORY.find((entry) => entry.id === skuId);
if (!sku) return fail('Unknown SKU');

const policy = this.inventory.canPurchaseSku(sku.id, sku.repeatable);
if (!policy.ok) return fail(policy.error!);

const recovered = sku.id === 'bundle_scrapyard' && this.inventory.canClaimLegacyStarterRecovery();
const charge = recovered ? 0 : sku.price;
if (!this.economy.canAfford(charge)) return fail('Not enough cash');

const kinds = Object.fromEntries(
  Object.entries(PHYSICAL_ITEM_CATALOG).map(([id, def]) => [id, def.kind]),
);
const prepared = this.inventory.preparePurchase(
  sku.id,
  sku.contents,
  kinds,
  { consumeLegacyStarterRecovery: recovered, location: 'room_package' },
);

const inventoryBefore = this.inventory.getState();
this.inventory.commitPurchase(prepared);
const debit = super.dispatchAction({
  type: 'PLAYER_SPEND_CASH',
  amount: charge,
  reason: `Silicon & Spares: ${sku.name}`,
});
if (!debit.success) {
  this.inventory.loadState(inventoryBefore);
  return fail(debit.error ?? 'Purchase failed');
}

this.v6CachedBase = null;
this.v6CachedState = null;
return success({ purchasedItemIds: prepared.items.map((i) => i.instanceId), charged: charge, recoveredLegacyPurchase: recovered });
```

Why this is one observable simulation update: ownership is committed before delegating to the existing core cash action; that core action is the only path that notifies SimulationEngine subscribers, so subscribers receive cash + ownership together. The explicit rollback handles the theoretically impossible post-validation debit rejection without leaking ownership.

For a zero-charge recovery, ensure the delegated action still reaches the core notification path. If the existing `PLAYER_SPEND_CASH` case does not notify for zero, add a dedicated protected core notification helper rather than emitting a second UI-side sync.

Do not call HardwareEngine, OsEngine, `insertDisc`, `installModularHardware`, `upgradeRam`, or monitor replacement from this transaction.

- [ ] **Step 4: Route the new action before the core fallback**

```ts
public override dispatchAction(action: SimulationAction) {
  if (action.type === 'STORE_PURCHASE_ITEM') {
    return this.purchaseStoreItem(action.storeId, action.skuId);
  }
  // existing v6 OS guard
  return super.dispatchAction(action);
}
```

- [ ] **Step 5: Run transaction and persistence tests GREEN**

Run:
```bash
npx vitest run tests/unit/StorePurchase.test.ts tests/unit/SaveSlots.test.ts tests/unit/SaveRoundTrip.test.ts
```
Expected: PASS, including purchase → save → reload preserving item instance IDs and `purchaseCounts`.

- [ ] **Step 6: Commit the engine transaction slice**

```bash
git add src/engine/types/index.ts src/engine/SimulationEngine.ts tests/unit/StorePurchase.test.ts tests/unit/SaveSlots.test.ts tests/unit/SaveRoundTrip.test.ts
git commit -m "feat: make store purchases atomic"
```

---

### Task 4: Make SiliconSparesModal a transaction client only

**Files:**
- Modify: `src/store/useSimulationStore.ts`
- Modify: `src/world/modals/SiliconSparesModal.tsx`
- Test: `tests/unit/StorePurchase.test.ts` plus static contract assertions where practical.

**Interfaces:**
- Consumes: `STORE_PURCHASE_ITEM`, `StorePurchaseResultData`, inventory state.
- Produces:
  ```ts
  purchaseStoreItem: (skuId: string) => ActionResult<StorePurchaseResultData>;
  ```

- [ ] **Step 1: Add RED static contract coverage for the store UI boundary**

Add a source-contract test (or equivalent focused assertion already used in this repo) that reads `SiliconSparesModal.tsx` and asserts the purchase implementation no longer contains:

```text
spendCash(
installModularHardware(
insertDisc(
addRamStick(
replaceMonitor(
```

and that it calls `purchaseStoreItem`.

- [ ] **Step 2: Run the UI boundary test RED**

Run:
```bash
npx vitest run tests/unit/StorePurchase.test.ts
```
Expected: FAIL against the existing direct-mutation modal.

- [ ] **Step 3: Add the Zustand wrapper**

In `SimulationStoreActions`:

```ts
purchaseStoreItem: (skuId: string) => ActionResult<StorePurchaseResultData>;
```

Implementation:

```ts
purchaseStoreItem: (skuId) =>
  get().dispatchAction({
    type: 'STORE_PURCHASE_ITEM',
    storeId: 'silicon_spares',
    skuId,
  }) as ActionResult<StorePurchaseResultData>,
```

- [ ] **Step 4: Replace `handleBuy` with a thin transaction call**

The modal must use only:

```ts
const purchaseStoreItem = useSimulationStore((s) => s.purchaseStoreItem);
const inventory = useSimulationStore((s) => s.state.inventory);

const handleBuy = (item: HardwareStoreItem) => {
  const result = purchaseStoreItem(item.id);
  if (!result.success) {
    soundManager.play('error');
    setPurchaseNotice(result.error ?? 'Purchase failed.');
    return;
  }
  soundManager.play('click');
  setPurchaseNotice(
    result.data?.recoveredLegacyPurchase
      ? `Milo checks his ledger: "You already paid for this." Your package is ready in Room 104.`
      : `Purchased ${item.name}. Your items are delivered to Room 104, ready to set up.`,
  );
};
```

UI affordability/ownership state must derive from cash + `inventory.purchaseCounts` + exact `legacyRecovery`, never `!hardware.hasComputer && cash < price`.

Remove `HardwareManager` mutation imports and direct `engine.hardware` writes from the modal.

Do not display “installed”, “set up”, or “disc inserted” after purchase.

- [ ] **Step 5: Run focused tests GREEN**

Run:
```bash
npx vitest run tests/unit/StorePurchase.test.ts tests/unit/StoreCatalog.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit the UI boundary slice**

```bash
git add src/store/useSimulationStore.ts src/world/modals/SiliconSparesModal.tsx tests/unit/StorePurchase.test.ts
git commit -m "refactor: route silicon spares through store transaction"
```

---

### Task 5: Persistence and exact-head regression gate

**Files:**
- Modify only if tests expose a persistence bug: `src/persistence/slots.ts`, `src/persistence/schema.ts`, or migration tests.
- Update: `CHANGELOG.md` only if the player-visible #7 ownership behavior is not already covered by the v6 entry.
- Test: all #7 focused tests + existing v6 persistence tests.

**Interfaces:**
- Consumes: final exact candidate SHA.
- Produces: evidence sufficient to close #7 and unblock #8.

- [ ] **Step 1: Run the focused gate**

```bash
npx vitest run \
  tests/unit/StoreCatalog.test.ts \
  tests/unit/StorePurchase.test.ts \
  tests/unit/ComputerStateV6.test.ts \
  tests/unit/SaveSlots.test.ts \
  tests/unit/SaveRoundTrip.test.ts \
  tests/unit/OsEngineNoOs.test.ts \
  tests/unit/SoftwareRegistry.test.ts
```
Expected: PASS.

- [ ] **Step 2: Run TypeScript**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Run production build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 4: Run full suite and compare against pre-#7 baseline**

```bash
npm run test
```
Expected: only the same three documented `WorldScenes.test.ts` failures; no new failures.

The verifier must also run the pre-#7 exact head `f5cc2c3cc6e873e424a96e5cef41bd5820e9cfd1` under the same Node/install command so the delta is explicit.

- [ ] **Step 5: Review exact candidate diff for scope**

Confirm there is no #8/#9 behavior:
- no automatic computer assembly;
- no power-on;
- no monitor installation;
- no media insertion;
- no OS install;
- no app install.

- [ ] **Step 6: Fast-forward the feature branch only after exact verification**

```bash
git push origin <verified-sha>:feat/modular-orion-hardware-os
```
Use a fast-forward ref update only; never force-update the feature branch.

- [ ] **Step 7: Comment and close #7 with exact evidence**

The completion comment must include:
- exact feature SHA;
- focused test counts/status;
- typecheck/build status;
- full-suite result and explicit delta against `f5cc2c3c...` baseline;
- confirmation that PR #4 remains Draft;
- statement that #8 is unblocked.

---

## Self-Review

### Spec coverage
- Atomic engine-owned purchase: Task 3.
- All-or-nothing insufficient funds: Task 3 RED/rollback test.
- Bundles expand into ordinary items: Task 1 + Task 2.
- Starter separate Orion 4.8 media: Task 1.
- Purchase does not assemble/install/insert: Task 3 + Task 4.
- Starter no-soft-lock: Task 1 exact authored invariant.
- Narrow legacy recovery and one-time consumption: Task 2 + Task 3.
- Explicit duplicate policy: Task 1 `repeatable` + Task 2 `purchaseCounts` + Task 3 tests.
- UI no direct domain mutation: Task 4.
- Persistence: Task 2 + Task 5.
- No new full-suite failures: Task 5 exact baseline comparison.

### Placeholder scan
No TBD/TODO/“similar to” implementation gaps remain. Every task has an explicit interface, RED command, minimal implementation rule, GREEN command, and commit boundary.

### Type consistency
- `HardwareStoreItem.contents` uses `StoreSkuContent[]` throughout.
- `OwnedItem.catalogItemId` always refers to `PHYSICAL_ITEM_CATALOG` IDs for new purchases.
- `purchaseCounts` is persisted in `PlayerInventoryState` and cloned/backfilled by InventoryEngine.
- `StorePurchaseResultData` is the shared SimulationEngine/Zustand/UI result payload.
- `STORE_PURCHASE_ITEM` is the sole Silicon & Spares write path.

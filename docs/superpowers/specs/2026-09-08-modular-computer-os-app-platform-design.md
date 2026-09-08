# Modular Computer, OS, and App Platform Design

**Date:** 2026-09-08  
**Branch:** `feat/modular-orion-hardware-os`  
**Epic:** #5  
**Implementation issues:** #6–#14

## Status

Approved architecture for replacing the partially coupled modular-PC implementation in PR #4.

This specification defines the persistent domain boundaries and player lifecycle. Child issues #6–#14 implement it in dependency order.

## Goal

Model the first computer as a believable sequence:

`no device → buy physical items → own/deliver them → set up hardware at home → POST/BIOS → install OS from owned media → install/version apps independently → apps consume OS host services → replace parts/display independently`

This is not a full PC-building simulator. PSU/GPU/cables and BIOS minutiae remain out of scope unless a current mechanic needs them.

## Problems being replaced

The current branch has useful presentation and component work, but the lifecycle is structurally inconsistent:

- bundles can immediately install hardware, power it on, and assign an OS;
- bundle data embeds `installedOs`;
- `HardwareEngine` and `OsEngine` both carry OS truth;
- `OsEngine` invents Orion 4.8 when no OS is supplied;
- monitor state is embedded in the computer;
- absent hardware can inherit fake fallback RAM/disk/network capability;
- store React code spends cash and directly mutates hardware/media;
- ordinary software may exist before an OS exists;
- app compatibility uses exact-version shortcuts;
- download simulation and downloader-app identity are mixed;
- `$35` recovery currently means “no PC + low cash = free claim”;
- OS setup assumes an upgrade more readily than a true first install.

The redesign fixes these roots instead of adding more compatibility patches.

## Non-negotiable invariants

1. Fresh game: no assembled PC, no active monitor, no installed OS, no Pulse install.
2. Inventory, computer setup, display setup, OS, and installed apps are separate persisted domains.
3. A store purchase creates ownership only.
4. Purchase is atomic: cash and ownership both change exactly once, or neither changes.
5. A bundle is a checkout SKU that expands into individually modeled owned items.
6. Monitor/display is independent from chassis/computer and from OS.
7. `OsEngine` is the only OS authority and supports `currentOsId: OsVersion | null`.
8. No subsystem may silently materialize Orion 4.8 for a no-OS machine.
9. Pulse, FlashFetch, RetroAmp, Voyager, future messengers, and future utilities use a generic versioned app model.
10. OS owns window chrome, shell, typography, transitions, and OS sound schemes.
11. Same app release may look/feel different under different compatible Orion releases without changing app version.
12. CRT/LCD effects derive from the active monitor profile only.
13. Network/download transfer truth is engine-owned; browsers/download-manager apps are clients through the OS host API.
14. Starter route must satisfy baseline Orion + baseline Pulse requirements without a soft-lock.
15. Save compatibility follows `AGENTS.md`; canonical redesign uses save format v6 with deterministic v5 migration.

## Canonical persisted boundaries

Exact type names may follow repository conventions, but the state must be equivalent to:

```ts
interface PlayerInventoryState {
  items: OwnedItem[];
  legacyStarterRecovery?: 'eligible' | 'consumed';
}

interface OwnedItem {
  instanceId: string;
  catalogItemId: string;
  kind: 'hardware' | 'display' | 'media';
  location: 'inventory' | 'room_package' | 'installed' | 'inserted';
}

interface ComputerSetupState {
  assembled: boolean;
  poweredOn: boolean;
  chassis: ChassisComponent | null;
  motherboard: MotherboardComponent | null;
  cpu: CpuComponent | null;
  ramSticks: RamStickComponent[];
  storage: StorageComponent[];
  opticalDrives: OpticalDriveComponent[];
  soundCard: SoundCardComponent | null;
  networkCard: NetworkCardComponent | null;
  insertedMediaId: string | null;
}

interface DisplaySetupState {
  monitor: MonitorComponent | null;
}

interface OsEngineState {
  currentOsId: OsVersion | null;
}
```

Owned item instance IDs are required so one RAM stick, monitor, or disc cannot be installed twice.

The old flat `HardwareState` may survive temporarily only as a **derived compatibility view**. It must not persist a second OS truth. No-machine effective capability is zero/unavailable, never 512MB/40GB/DSL fallback hardware.

## Store transaction

Silicon & Spares is for buying, not installing.

Authoritative engine API is equivalent to:

```ts
type StorePurchaseResult =
  | { success: true; purchasedItemIds: string[]; charged: number }
  | { success: false; error: string };

purchaseStoreItem(storeId: string, skuId: string): StorePurchaseResult;
```

Transaction order:

1. resolve SKU/availability;
2. validate cash;
3. expand SKU into owned item instances;
4. deduct cash exactly once;
5. publish one coherent state.

On failure, neither cash nor ownership changes.

React must not combine `spendCash()` with direct hardware/media/OS mutation.

## Exact starter-path decisions

The `$35` Scrap Yard Special remains the cheapest first computer and contains separately owned instances for:

- chassis/case;
- motherboard;
- Celeron-class 366 MHz CPU;
- **64 MB RAM**;
- 2.1 GB HDD;
- 24x CD-ROM;
- SoundBlaster-class sound card;
- 56k modem/network card;
- budget 14-inch curved CRT;
- **complimentary Orion 4.8 setup/recovery CD**, owned media, not preinstalled software.

To keep the authored starter coherent and period-appropriate:

- Orion 4.8 minimum RAM becomes **64 MB**;
- Pulse 5.2 minimum RAM becomes **64 MB**;
- existing disk/install-size rules may remain if the 2.1 GB drive still passes both installs;
- a catalog regression test must prove the exact starter machine can install Orion 4.8 and then Pulse 5.2.

Requirements are never bypassed in code to make the starter work.

## Room and setup lifecycle

Room 104 owns setup and part installation.

Room presentation distinguishes:

1. empty desk;
2. owned package waiting for setup;
3. assembled machine powered off;
4. assembled machine powered on/display active.

`Set Up Computer` consumes **15 in-game minutes exactly once**.

Setup assigns the owned starter parts and monitor to the desk. It does not install an OS and leaves the computer powered off.

Later part swaps also happen at home, never automatically at purchase time.

## Boot-state contract

Power state and OS state are independent.

```ts
type PcBootState =
  | 'powered_off'
  | 'post'
  | 'no_boot_device'
  | 'installer_boot'
  | 'os_booting'
  | 'desktop';
```

Rules:

- no assembled computer cannot boot;
- powered off never exposes desktop;
- powered on + no OS + no bootable media → POST then `no_boot_device`;
- powered on + compatible inserted bootable OS media → installer path even when OS is null;
- desktop is available only after a valid installed OS boots.

`activeView = 'pc'` is only a UI location; it does not imply a desktop exists.

## OS lifecycle

OS media are ordinary owned media items. Purchase, insert/eject, install, and upgrade are separate operations.

### First install

When `currentOsId === null`:

1. insert owned Orion setup media;
2. boot resolver enters installer path;
3. installer validates real assembled CPU/RAM/storage/media;
4. setup offers **Fresh Installation**, never “upgrade current installation”;
5. install consumes authored disk/time;
6. reboot runs;
7. successful engine commit sets `currentOsId`;
8. desktop becomes available.

### Upgrade

With a compatible existing OS, upgrade may be offered according to `OsCatalog` rules. Patch/hotfix base requirements remain explicit.

The old pay-and-upgrade action is removed: store purchase belongs to store domain; insertion belongs to hardware/media domain; OS install belongs to `OsEngine`/installer.

### Clean install

No decorative fake format option. Until destructive clean-install semantics are implemented and tested, hide/disable clean install. This epic requires fresh install + upgrade, not destructive formatting.

## Generic app lifecycle

All ordinary apps use a release model equivalent to:

```ts
interface AppReleaseDefinition {
  releaseId: string;
  appId: string;
  name: string;
  version: string;
  publisher: string;
  installedBytes: number;
  requirements: {
    minOs: OsVersion;
    minRamMB: number;
    minCpuTier: number;
    requiredDiskBytes: number;
  };
  features?: string[];
  installer: { kind: 'download' | 'disc' | 'bundled' };
}
```

Installability checks one authoritative path using:

- current OS from `OsEngine`;
- real `OsCatalog` ordering/capabilities;
- real assembled RAM/CPU/storage/free disk;
- installer source ownership/availability.

No OS means ordinary app install fails without mutation.

### Pulse

`PulseCatalog` stays as authored release data layered on the generic install system.

Installed software record is the canonical Pulse release/version. `PulseEngine` may keep social/runtime state and derive release-specific features from the installed release, but it must not carry a second drifting Pulse version.

Pulse update changes Pulse features/version only. Orion change changes OS presentation only.

### Voyager — resolved classification

Voyager is an **ordinary versioned application** in the generic software registry, not an intrinsic OS subsystem.

Orion install media may include a Voyager release through an explicit `installer.kind = 'bundled'` manifest entry. Therefore:

- Voyager does not exist before an OS is installed;
- installing an Orion release may explicitly install its bundled Voyager release;
- Voyager remains an app release with its own version truth and can later be updated independently;
- future browsers use the same app model.

## OS host and presentation

Preserve and expand:

- `src/desktop/host/OsHostContext.tsx`;
- centralized `WindowFrame`;
- `src/desktop/themes/os-themes.css`;
- OS-level sound hooks.

Apps consume stable host services for:

- window lifecycle/title/minimize/maximize/close;
- VFS;
- network/download services;
- audio/UI sounds;
- active OS/capabilities;
- effective hardware summary;
- notifications.

Apps do not branch on Orion generation merely for frame/font/taskbar/animation behavior.

Each Orion release resolves one central presentation profile containing:

- theme id;
- primary UI font stack;
- titlebar font/weight;
- sizing/density tokens;
- window border/radius/shadow/chrome;
- titlebar/buttons;
- taskbar/start/menu hooks;
- shell wallpaper defaults;
- open/close/minimize/restore transition profile;
- startup/shutdown/window sound scheme;
- optional shell capability flags.

No proprietary font files are added; safe system/font-stack fallbacks evoke the period.

Required proof: Pulse 5.2 stays Pulse 5.2 while Orion 4.8 → 5.0 changes only OS-owned frame/typeface/transitions/sound scheme.

## Network/download services

Use clear separation equivalent to:

- network service: adapter/connection state/effective bandwidth;
- download service: authoritative transfer tasks/bytes/allocation/persistence/VFS completion;
- browser downloader: client policy;
- FlashFetch/future managers: installed app client policies.

Closing/uninstalling a downloader UI does not delete completed files or redefine transfer truth.

Host network state reflects actual `offline`, connecting/dialing where modeled, or `connected`; it is not hardcoded connected.

Physical connection/hardware controls bandwidth, not Orion styling.

## Hardware replacement and display independence

At-home install/replace operations cover the currently modeled parts:

- motherboard;
- CPU;
- RAM;
- storage;
- optical drive;
- sound card;
- modem/network card;
- monitor.

CPU socket and RAM slot/capacity rules are validated before mutation.

Unsafe primary-storage replacement is blocked with an explicit reason until clone/migration semantics are intentionally designed; this epic does not silently destroy OS/VFS state.

Monitor is separate `DisplaySetupState`. `CRTOverlay` reads the active monitor profile directly.

Required proof:

- changing budget CRT → flatter Trinitron changes scanline/curvature/bloom/flicker only;
- Orion and Pulse versions remain unchanged;
- changing Orion while keeping the same monitor changes OS presentation while display effects stay unchanged.

## Save format v6

Set `SAVE_FORMAT_VERSION = 6` and add deterministic v5 → v6 migration.

### v5 working computer

If v5 has a real computer, preserve effective CPU/RAM/storage/network/display and preserve effective installed OS. Prefer explicit persisted `os.currentOsId`; fall back to legacy `hardware.osVersion` only for a real existing computer.

### v5 no computer

No assembled PC, no active monitor, and **no installed OS** after migration. Legacy `hardware.osVersion = Orion_4.8` is ignored when no computer existed because it was an engine fallback, not player ownership.

### Exact bounded `$35` broken-purchase recovery

There is no durable purchase ledger in the affected v5 store path, so migration must not infer payment from arbitrary `cash < 35`.

A one-time `legacyStarterRecovery = 'eligible'` marker is created **only** when all of these v5 conditions hold:

- save format is exactly 5;
- game day is exactly 1;
- cash is exactly `$3.00` (the `$38` starting balance minus the `$35` starter);
- `hardware.hasComputer !== true`;
- modular hardware is absent or also reports no computer;
- no explicit persisted OS state proves a real installed OS.

Claiming recovery creates ownership of the exact starter-package items and changes the marker to `consumed`. It does not assemble hardware or install Orion.

All other no-PC/low-cash saves receive no free machine. The old runtime `cash < item.price` heuristic is removed.

This intentionally favors false negatives over broad free-PC grants.

## Atomic error handling

These operations return explicit success/failure and leave state unchanged on failure:

- store purchase;
- hardware install/replace;
- media insert/eject;
- OS install commit;
- app install/update/uninstall.

React timers/animations reflect engine transitions; they never independently commit success.

Deterministic failure reasons include insufficient cash, incompatible socket/slot, insufficient RAM/disk, missing/unowned media, no OS, and no network.

## Testing strategy

Every issue follows:

`write failing test → verify RED → minimal implementation → verify GREEN → relevant regression → commit`

### #6 foundation

- fresh simulation has no PC/display/OS;
- no-PC capability is zero/unavailable;
- `OsEngine` persists/restores null;
- v5 working PC preserves capability + OS + monitor;
- v5 no-PC does not invent OS;
- one OS authority remains.

### #7–#13

Add focused tests for atomic purchase/ownership, setup/boot, OS media/install, generic app releases, OS presentation, network/download clients, and part/display swaps.

### #14 final lifecycle

Drive public engine/store APIs through:

`new game → $35 purchase → return home → 15m setup → no-OS boot → insert Orion media → fresh install → desktop → Pulse absent → install Pulse 5.2 → change Orion while Pulse stays 5.2 → change monitor while Orion/Pulse stay fixed → save/reload equivalence`

Also verify the three v5 migration cases: working PC, no PC, and exact bounded `$35` recovery signature.

## Implementation order

```text
#6 canonical state + v6 migration
 └─→ #7 atomic store ownership
      └─→ #8 at-home setup + BIOS/no-OS boot
           └─→ #9 OS media + fresh install/upgrade
                └─→ #10 generic versioned apps
                     └─→ #11 OS host + presentation
                          └─→ #12 neutral network/download service

#6 + #7 + #8 ─→ #13 part swaps + display independence

#6–#13 ─→ #14 integration/release gate
```

## Verification policy

Before PR #4 can become ready, #14 runs on the exact final head:

1. `npx tsc --noEmit`
2. `npm run build`
3. targeted unit/integration tests for #6–#13
4. `npm run test`
5. exact PR head/status/review inspection

Known baseline failures documented in `AGENTS.md` may still be reported; zero new failures are allowed.

## Out of scope

- PSU/GPU/cable simulation;
- BIOS tuning beyond useful POST/boot presentation;
- elaborate assembly minigame;
- ISP contract/billing simulation beyond existing mechanics;
- destructive clean-format semantics;
- unrelated refactors.

## Completion

Epic #5 is complete only when #6–#14 close with evidence and PR #4’s exact final head proves the canonical first-PC lifecycle, deterministic v6 migration, OS/app/display independence, and zero new regressions.
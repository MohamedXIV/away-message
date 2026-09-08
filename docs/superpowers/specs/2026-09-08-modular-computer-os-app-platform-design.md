# Modular Computer, OS, and App Platform Design

**Date:** 2026-09-08  
**Branch:** `feat/modular-orion-hardware-os`  
**Epic:** #5  
**Implementation issues:** #6–#14

## Status

Approved architecture for replacing the current partially coupled modular-PC implementation in PR #4.

This specification is intentionally architectural. It defines domain boundaries, lifecycle invariants, migration behavior, and integration contracts. Child issues #6–#14 implement the design in dependency order and carry their own test gates.

## Problem

The current branch contains several useful pieces—modular component definitions, retro OS setup presentation, `OsHostContext`, centralized `WindowFrame`, versioned Pulse releases, and monitor-driven CRT rendering—but the underlying lifecycle is inconsistent.

The most important defects are structural:

- buying a hardware bundle can immediately install hardware, power it on, and assign an OS;
- the hardware bundle itself contains `installedOs`, coupling software to physical hardware;
- `HardwareEngine` and `OsEngine` both carry OS state;
- `OsEngine` silently falls back to Orion 4.8, so “no installed OS” cannot be represented truthfully;
- the monitor is embedded in modular computer state even though it is a separate physical display;
- no-PC compatibility paths can inherit fake fallback specs such as large RAM/disk/network values;
- store UI directly spends cash and mutates hardware/media state, so purchase atomicity is not guaranteed;
- ordinary software can be materialized before an OS exists;
- app compatibility contains exact-version shortcuts instead of catalog ordering;
- download simulation and downloader-app identity are conceptually mixed;
- the current recovery for the broken `$35` purchase can grant a free machine based only on low cash plus no PC;
- the existing OS setup flow is primarily an upgrade flow and assumes an existing OS.

The redesign must fix these roots rather than continue patching symptoms.

## Design goals

The game must model the player’s first computer as a believable sequence of separately owned physical hardware, installed operating system, and installed applications:

`no device → buy physical items → own/deliver them → set up hardware at home → POST/BIOS → install OS from owned media → install/version apps independently → apps consume OS host services → replace parts/display independently`

The system must also remain simple enough for gameplay. This is not a full PC-building simulator; PSU, GPU, cables, BIOS configuration minutiae, and other hardware are out of scope unless a current mechanic requires them.

## Non-negotiable invariants

1. A fresh game starts with **no assembled computer, no active monitor, no installed OS, and no Pulse install**.
2. Hardware, display hardware, operating system, applications, and owned inventory are separate persisted domains.
3. A store purchase creates ownership only. It does not install a component, insert a disc, install an OS/app, or power a machine.
4. Store purchase is atomic: either cash and ownership both change once, or neither changes.
5. A bundle is only a store SKU that expands into individually modeled owned items.
6. The monitor is a separate physical attachment. It is not the OS and not synonymous with the PC chassis.
7. `OsEngine` is the sole authority for installed/running OS state and supports `currentOsId: OsVersion | null`.
8. No subsystem may invent Orion 4.8 merely because no OS value was supplied.
9. Ordinary applications are versioned software independent from Orion. Pulse, FlashFetch, RetroAmp, future messengers, and future utilities follow the same generic installability contract.
10. OS presentation—window chrome, typography, shell, window transitions, and sound scheme—is OS-owned.
11. The same app release can run under multiple compatible Orion generations and inherit the active OS presentation without changing the app release.
12. CRT curvature, scanlines, bloom, flicker, and future LCD behavior come only from the active display profile.
13. Network/download simulation remains engine-owned deterministic state; browsers and download-manager apps are clients through the OS host contract.
14. The cheapest intended starter path must be internally compatible with the baseline Orion + baseline Pulse path and must not soft-lock the player.
15. Save compatibility requirements in `AGENTS.md` are mandatory. The new canonical shape uses save format v6 with deterministic v5 migration.

## Canonical domain model

Exact final type names may follow repository conventions, but the persisted boundaries must be equivalent to the following.

```ts
interface PlayerInventoryState {
  items: OwnedItem[];
  legacyRecovery?: LegacyRecoveryState;
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
  // Existing install/update history fields may remain if useful.
}
```

### Ownership identity

Physical/media items need stable instance identity so one owned RAM stick cannot be installed twice and one monitor cannot simultaneously remain an uninstalled spare. Store catalog IDs describe products; owned item instance IDs describe the player’s actual copy.

### Installed hardware

Installed parts may be represented directly in `ComputerSetupState` or through stable references to owned item instances, whichever best fits existing code. The crucial invariant is conservation: installation moves/assigns one owned instance rather than cloning a catalog definition.

### Legacy `HardwareState`

The old flat `HardwareState` may temporarily survive as a derived compatibility view if too many existing systems consume it, but it must not be a second persisted truth. Any compatibility getter derives effective CPU/RAM/storage/network values from canonical computer/display state and derives OS only from `OsEngine` when needed by legacy callers.

No-machine effective values must be explicit zero/unavailable values, never optimistic fallback hardware.

## Store and ownership lifecycle

Silicon & Spares is a shop, not an installation screen.

The UI requests an engine-owned purchase transaction, conceptually:

```ts
type StorePurchaseResult =
  | { success: true; purchasedItemIds: string[]; charged: number }
  | { success: false; error: string };

purchaseStoreItem(storeId: string, skuId: string): StorePurchaseResult;
```

The engine transaction performs these steps in order:

1. resolve SKU and availability;
2. validate cash;
3. expand bundles into concrete owned item instances;
4. deduct cash once;
5. publish one coherent resulting simulation state.

If validation fails, no partial ownership or partial charge is allowed.

React code must not combine `spendCash()` with direct `installModularHardware()`, `replacePart()`, `insertDisc()`, or OS mutation.

## Starter package

The `$35` starter SKU remains useful as a convenience package, but internally it contains individually modeled items, approximately:

- chassis/case;
- motherboard;
- CPU;
- RAM stick(s);
- HDD;
- optical drive;
- sound card;
- modem/network card;
- budget 14-inch CRT;
- complimentary Orion 4.8 setup/recovery CD as a **separate owned media item**.

The complimentary Orion disc solves the first-day cash soft-lock without pretending the OS is preinstalled. The player may insert and install it later at home.

The existing authored requirement numbers must be reconciled with the starter path. The exact final RAM/CPU/disk numbers may change, but a catalog-level regression test must prove the starter machine satisfies baseline Orion and baseline Pulse requirements. The implementation must not bypass requirements merely to make the starter work.

## Room and machine lifecycle

Room 104 owns installation/setup interactions.

The room must distinguish four physical states:

1. empty desk;
2. owned package/parts waiting to be set up;
3. assembled machine powered off;
4. assembled machine powered on/display active.

Initial setup is a deliberate action, `Set Up Computer`, which consumes one authored amount of simulation time exactly once. Target duration is 10–15 in-game minutes; implementation chooses one fixed value and tests it.

Setup activates/assigns the owned starter parts and monitor but does **not** install an OS and does **not** leave the computer powered on.

Subsequent upgrades are also installed/swapped at home rather than in the store.

## Boot state model

Machine power state and OS availability are separate.

A powered-on computer should resolve into an explicit boot state, conceptually:

```ts
type PcBootState =
  | 'powered_off'
  | 'post'
  | 'no_boot_device'
  | 'installer_boot'
  | 'os_booting'
  | 'desktop';
```

The resolver considers assembled hardware, power, installed OS, storage, and inserted bootable media.

Important rules:

- no assembled machine cannot boot;
- powered off does not expose desktop;
- powered on with no OS and no bootable media shows POST then no-boot-device;
- powered on with compatible bootable OS media can enter installer flow even when `currentOsId === null`;
- desktop is available only when a valid installed OS successfully boots.

`activeView = 'pc'` is a UI location, not proof that Orion desktop exists.

## OS lifecycle

OS media are owned items. Purchase, insertion, installation, and upgrade are separate actions.

### Fresh install

When `currentOsId === null`:

1. player inserts owned bootable Orion media;
2. boot resolver enters installer path;
3. installer validates actual assembled hardware and free storage;
4. setup presents **Fresh Installation** only;
5. install consumes authored disk/time;
6. reboot occurs;
7. only after successful engine commit is `currentOsId` set;
8. desktop becomes available.

No-OS machines must not show an “Upgrade Current Installation” option.

### Upgrade

With an existing compatible OS, the installer may offer an upgrade when catalog rules permit it. Patch/hotfix releases enforce their base OS requirements.

The old combined “pay money and upgrade OS” action is removed. Store purchase belongs to store domain; media insertion belongs to hardware/media domain; OS installation belongs to `OsEngine` and installer domain.

### Clean install

A clean-install option may only be exposed when it has real tested semantics. If destructive format behavior is not implemented in this epic, hide/disable that option rather than presenting decorative UI that claims to wipe data while preserving everything.

## Application lifecycle

Ordinary applications use a generic release model, conceptually:

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
  installer?: { kind: 'download' | 'disc' | 'bundled' };
}
```

Installability uses one authoritative compatibility path based on:

- active installed OS from `OsEngine`;
- `OsCatalog` ordering/capabilities;
- real assembled RAM/CPU/storage;
- available disk;
- owned/downloaded installer source where required.

With no OS, ordinary app installation fails without mutating disk or registry.

### Pulse

`PulseCatalog` remains useful for authored Pulse release features. It becomes a specialized release catalog layered on top of the generic install infrastructure.

The installed software record is the canonical installed Pulse release/version. `PulseEngine` may own social/runtime state and derive release-specific feature availability from that canonical installed release, but it must not carry a second drifting Pulse-version truth.

Changing Pulse version affects Pulse-owned features. Changing Orion affects OS-owned presentation. These are independent axes.

### OS-bundled/system components

System utilities intentionally shipped with Orion may be represented as OS components. They must be explicit. Ordinary third-party applications must never appear merely because `SoftwareRegistry` was constructed.

Voyager needs one authored classification during implementation: either an Orion-bundled browser exposed only after a compatible Orion install, or separately installable software. It must never exist on a fresh machine with no OS.

## OS host and presentation

The existing `OsHostContext` and centralized `WindowFrame` are core architecture to preserve.

Applications consume stable OS services through the host boundary rather than importing Orion-generation behavior.

The host contract should expose at least:

- window lifecycle/title/minimize/maximize/close;
- VFS/file operations;
- network/download services;
- audio/UI sounds;
- active OS/capability information;
- effective hardware summary;
- notifications.

App code should not ask “am I Orion 5?” merely to decide frame, titlebar, typeface, taskbar behavior, or window animation.

### Presentation profile

Each Orion release resolves to one central presentation profile containing at least:

- theme id;
- primary UI font stack;
- titlebar font/weight;
- sizing/density tokens where needed;
- borders/radius/shadow/chrome tokens;
- titlebar/button treatment;
- taskbar/start/menu hooks;
- default wallpaper/shell defaults;
- open/close/minimize/restore animation profile;
- startup/shutdown/window sound scheme identifiers;
- optional shell capability flags.

Existing `os-themes.css` remains a styling foundation, but desktop/window components use the central resolver instead of scattered `version.includes('5.')`, `includes('6.')`, or `includes('7.')` routing.

No proprietary font files are added. Safe system/font-stack fallbacks evoke the period.

### Required proof

Install Pulse 5.2 on Orion 4.8, then change only the OS to Orion 5.0. Pulse remains 5.2 with the same Pulse-owned feature set, while the outer frame, typography, transitions, and OS sound scheme change.

## Network and download architecture

Engine transfer truth is app-neutral.

Use conceptual separation equivalent to:

- network/connection service: physical adapter + connection status + effective bandwidth;
- download/transfer service: authoritative queue, bytes, allocation, persistence, VFS completion;
- browser downloader: one client policy;
- FlashFetch/future managers: installable app clients with different capabilities.

Client capabilities may include concurrency, resume, or queue behavior, but bytes transferred and bandwidth allocation remain engine-owned.

`OsHostApi.network` or its refined equivalent exposes the service to applications.

Network status must reflect actual state (`offline`, connecting/dialing where modeled, `connected`) rather than always returning `connected`.

Physical network hardware/connection state controls bandwidth. OS theme does not.

## Hardware replacement and display independence

After initial setup, currently modeled parts can be installed/replaced at home through deterministic compatibility rules:

- motherboard;
- CPU;
- RAM;
- storage;
- optical drive;
- sound card;
- network card/modem;
- monitor/display.

CPU socket compatibility and RAM slot/capacity rules are enforced before mutation.

Unsafe replacement of the primary storage device must not silently destroy the OS/VFS. Until clone/migration semantics are deliberately implemented, blocking a destructive swap with a clear reason is preferable.

### Display

The active monitor lives in separate display state. `CRTOverlay` consumes that active monitor profile directly.

Replacing a budget CRT with a flatter Trinitron changes curvature/scanlines/bloom/flicker without changing Orion or Pulse versions. Conversely, changing Orion while keeping the same monitor changes OS presentation while display effects remain unchanged.

## Save format v6

This redesign changes persisted roots and therefore requires `SAVE_FORMAT_VERSION = 6`.

Migration must be pure and deterministic.

### v5 working-PC save

Preserve effective existing hardware, display, inserted media where representable, and the effective installed OS. A migrated player with a working v5 computer should remain playable with equivalent capability.

### v5 no-PC save

Migrate to:

- no assembled computer;
- no active monitor;
- no installed OS;
- no invented Orion 4.8 fallback.

### Broken `$35` legacy purchase

The current runtime heuristic `no PC && cash < $35 => Already Paid` is removed.

Recovery, if evidence from the exact v5 shape is sufficient to identify the known broken purchase path, becomes a narrow one-time migration/recovery marker that grants only the missing owned starter items and is consumed once.

If v5 data cannot distinguish that state safely from “player spent money elsewhere”, migration must prefer not granting a free PC and preserve the existing manual compatibility path only long enough to provide an explicit, bounded recovery action. The final #14 gate must document the chosen rule and prove arbitrary low-cash saves do not receive free hardware.

## Error handling and transaction rules

Domain operations return explicit failure reasons and leave state unchanged on failure.

Important atomic operations include:

- store purchase;
- hardware installation/replacement;
- media insertion/ejection;
- OS install commit;
- app install/update/uninstall.

UI timers or animations never commit domain success independently. They reflect engine state transitions.

Failures such as insufficient cash, incompatible socket, insufficient RAM, insufficient disk, missing/unowned media, no OS, or no network connection must be surfaced through deterministic engine results that React can display.

## Testing strategy

Implementation follows TDD per child issue:

`failing test → verify RED → minimal implementation → verify GREEN → relevant regression → commit`

### #6 foundation tests

- fresh simulation has no PC/display/OS;
- no-PC compatibility has zero/unavailable real capability;
- `OsEngine` persists/restores `null`;
- v5 working PC migration preserves capability + OS + monitor;
- v5 no-PC migration does not invent an OS;
- only one OS authority remains.

### Store/setup/install/app/display tests

Child issues #7–#13 add focused transaction and integration tests for ownership, setup, boot, OS media, app releases, OS presentation, network/download clients, and hardware swaps.

### Final integration gate

Issue #14 adds a public-API-oriented lifecycle test covering:

`new game → $35 purchase → return home → setup → no-OS boot → insert Orion media → fresh install → desktop → Pulse absent → install Pulse 5.2 → OS change preserves Pulse version but changes OS presentation → monitor change preserves OS/app versions but changes display profile → save/reload equivalence`

It also verifies v5 migration scenarios and searches the final branch for obsolete coupling/shims.

## Verification policy

Every child issue must pass its targeted tests and introduce no new suite failures.

Before PR #4 is made ready, issue #14 runs in this order:

1. `npx tsc --noEmit`
2. `npm run build`
3. targeted unit/integration tests for #6–#13
4. `npm run test`
5. exact final PR head/status/review inspection

Known baseline failures documented in `AGENTS.md` may be reported if still present; zero new failures are acceptable.

## Implementation order

```text
#6 canonical state + v6 migration
 └─→ #7 atomic store ownership
      └─→ #8 at-home setup + BIOS/no-OS boot
           └─→ #9 owned OS media + fresh install/upgrade
                └─→ #10 generic versioned apps
                     └─→ #11 OS host + presentation
                          └─→ #12 neutral network/download service

#6 + #7 + #8 ─→ #13 part swaps + display independence

#6–#13 ─→ #14 end-to-end/release gate
```

## Out of scope for this epic

- full PSU/GPU/cable simulation;
- BIOS tuning/minutiae beyond useful POST/boot presentation;
- elaborate PC assembly minigame;
- ISP billing/contracts unless already required by game systems;
- implementing every future Orion/Pulse release feature now;
- destructive clean-format UI unless real format semantics are implemented;
- unrelated refactoring outside the hardware/OS/app/desktop lifecycle.

## Completion definition

The architecture is complete only when #6–#14 are closed with evidence and PR #4’s exact final head proves the canonical first-PC flow, persistence/migration behavior, OS/app/display independence, and no new regressions.
# #175 — Single-Worker SimulationHost: executable P0/P1 and cutover contract

Dependency baseline: merged #171 composed kernel, #172 bounded change publication,
#173 canonical cold Social pages and #174 deterministic v6 persistence.

## What this branch implements

- `WorkerSimulationHost` is a main-thread RPC client only. It **never**
  constructs or holds a second SimulationKernel or domain-state graph.
- `simulation.worker.ts` is a real Vite module Worker with
  `SimulationWorkerRuntime`. Exactly one `SimulationKernel` is initialized
  inside the Worker and rejects repeated initialization.
- FIFO serializes commands, bounded queries, cold-history paging and explicit
  snapshot export/load **even across awaits**. Requests and results carry IDs.
- A closed set of player-safe bounded queries is available (HUD, world, status,
  actor, conversation, directory, file, messenger, presence, etc.). No arbitrary
  owner method calls or `getState()` are permitted over the wire.
- The source `SimulationChange` event preserves `unknown`; worker receipt
  is frozen anew on the client to isolate listeners. No full state ships on a
  routine revision. `exportSnapshot()` is intentionally an explicit full
  async operation.
- Worker crash, bad transport payload, disposal, and duplicate initialization
  fail closed. **No main-thread fallback** silently resumes a separate world.

## Acceptance / cutover boundary — NOT COMPLETE YET

The production game currently still constructs the synchronous Kernel through
`App.tsx` and `useSimulationStore`; renderer-facing domain method callers,
realtime ticker, autosave and slot cold reader attachment still need cutover
to the host. This isolated browser Worker is an **end-to-end contract proof**,
not a production alternative world. Do not merge #175 until the complete
browser-facing migration, save/restore, startup error handling and
multi-population stress gate pass without any concurrent main-thread writer.
Do not integrate just the Worker factory into App while leaving defaultEngine
alive in Zustand.

## Exact proof plan

- `SimulationWorkerRuntime.test.ts`: one initializer, actual Kernel commands,
  FIFO time advances, bounded projections, authorized actor reads, explicit
  async save/load, rejection without state mutation and no hot full-state read.
- `ScenarioI_SimulationWorker.spec.ts`: Chromium launches the real Vite module
  Worker, sends commands, receives source changes, performs a player-safe
  actor query, exports a real snapshot and restores the one Worker owner.
- `verify.yml`: run the isolated Worker browser proof for this feature PR;
  on production cutover it should become a normal required browser gate.

No Rust rewrite, multi-worker dispatch or Education content in this branch.


## P2 — Canonical Worker slot lifecycle (in-progress, same Draft PR)

The browser now has an explicit `openBrowserSimulationSlot(slotId)` path:
a freshly created Dedicated Worker calls the existing production
`loadSlotEngine` **inside the Worker**, including the validated cold
conversation page manifest, indices and generation-guarded reader. It
does not transmit the full save, construct a main-thread Kernel or
replace an unreadable slot with a silent new game. A rejected boot
leaves no playable worker and permits an intentional retry.

The explicit `saveBrowserSimulationSlot` path sends only the
UI-owned Pulse localStorage moment to the Worker; `saveSlot` still
owns the **single canonical IndexedDB transaction** writing the
v6 document and per-slot conversation archive pages. The Worker
then rebinds the live Social cold reader to the committed slot
generation after any overwrite. Pulse UI payload restoration stays
on the browser main thread via `restoreSlotPulse`. No duplicated
simulation owner has been introduced by this persistence change.

Acceptance added: real IndexedDB cold boot with 145-message
conversation, cold page reads, source-slot overwrite and rebind,
missing-slot refusal, restart in a fresh Worker runtime, plus a
Chromium browser Worker save/close/reopen cycle including Pulse
UI metadata and private read denial.

This is **not yet production UI cutover**. Existing
`App.tsx`/`useSimulationStore` and the React/Phaser direct
owner method call sites still own a synchronous main-thread
SimulationKernel in normal gameplay. Moving only the ticker or
boots before those dependent consumers are migrated would leave a
second authority alive and is expressly forbidden by #168/#175.

## P2 — One Worker-owned realtime clock (pre-cutover contract)

An explicit `setClockRunning(true/false)` command now enables a
**single 250ms Worker timer**, with elapsed real seconds measured using
the Worker's monotonic `performance.now()`. The client never sends
RAF-frame deltas in this mode; manual `advanceRealTime` is rejected
while the Worker timer is running to prevent two time sources.

Each timer sample is bounded to two real seconds, accumulated to at
most two pending seconds, and coalesced into a **single queued clock
job**. The same FIFO orders clock work with explicit commands and
asynchronous save/cold-history operations, so slow saves or world ticks
cannot enqueue an unbounded backlog. There is no global RAF
dependency in the canonical Worker owner.

A failing clock owner sends an explicit `fatal` transport notification;
the host rejects pending RPCs, terminates the Worker, and never boots
a hidden local fallback. Explicit stop and disposal cancel timers.
Headless simulations retain deterministic manual time advancement
without an implicit timer.

Unit tests use simulated timers for clock on/off, no double realtime
advances and fatal failure handling. Chromium launches a real module
Worker and verifies that its clock advances without caller-side RAF
requests, and remains stopped after explicit stop.

**Important:** the production React ticker is still on the main thread
until the complete UI cutover. These Worker time capabilities are
precutover owner contract proofs, not a shipped replacement yet.


## P3.1 / P3.2 — Worker-first React vertical slice (staged)

The full legacy application has ~400 production TypeScript/TSX files and
multiple synchronous owner methods. Replacing the global `SimulationEngine`
with an async proxy without migrating those consumers would create a broken
second state authority. Instead, `main.tsx` now has an **explicit opt-in**
`?runtime=worker` entry that dynamically imports `WorkerGameShell`
without ever evaluating `App`, `useSimulationStore` or its eagerly
constructed `defaultEngine`. Normal `/` still uses the legacy app
while the remaining UI is migrated. This is not yet the default route.

`WorkerGameSession` implements browser boot orchestration for **New Game**
and **Load Game**, one host at a time, bounded HUD/world/player-status
projection caching, serializable dispatch, minute advancement, explicit
slot saves, day-boundary autosave, phase/error state, restart and teardown.
It uses a stable `useSyncExternalStore` snapshot for React 19 and collapses
revision bursts into bounded asynchronous read sets, rejecting mixed
revisions and stale replies from a previous Worker generation.

The host now supports unsolicited fatal notifications even when no RPC is
outstanding. The session never falls back to a main-thread simulation
on startup or Worker crash; stale async boot results are disposed. Only
UI-owned localStorage data crosses to the Worker on save, and the canonical
slot/cold page reader stays inside the Worker.

`WorkerGameShell` is a deliberately small **playable engineering slice**
(time, room/world, status, pause, advance, save/load, back to menu);
it is not an alternate finished desktop/Phaser/Pulse renderer and cannot be
used as a reason to mark the production UI cutover complete. The existing
`App` route stays untouched semantically, preserving current playable
experience and test fixtures until the remaining domain APIs are converted.

Evidence: `WorkerGameSession.test.ts` asserts atomic boot replacement,
fatal handling, stale boot cancellation, bounded cache and once-per-day
autosave. `ScenarioJ_WorkerFirstUI.spec.ts` runs the real React
`/worker.html` entry, verifies no legacy `__simEngine/__simStore`,
executes New → pause → advance → save → menu → load, and checks
unreadable-save refusal without a shadow world.

**Remaining #175 before merge:** the ordinary gameplay entry `/`,
all legacy Zustand store conveniences, Pulse/desktop and Phaser authored
rendering must move onto the new bounded host and command ports. Then
switch the default route to this runtime and delete the eager local owner.
Prove autosave, cold history, restart, failure UX and 20/100/250/500
NPC scale using normal gameplay before review/merge. The opt-in slice is
an executable staging surface, not a completed production cutover.

**Build compatibility note:** Initial query-flag routing in `main.tsx`
delayed legacy debug-store initialization, causing six existing Chromium
living-world regressions. We reverted that routing and restored the
original eager main bootstrap. The isolated `worker.html` entry and
Vite multi-page build preserve both the old UI timing and a genuinely
Worker-only code graph; both paths have browser acceptance gates.


## P3.2 — Real authored consumers on the Worker-first route

This iteration migrates **two tangible player surfaces**, not just a
test-only HUD: the production `PhysicalWorldBoundary`/Phaser scene is
fed a `createWorldSceneProjection` derived from the Worker-owned
`SimulationWorldRead`, and its existing interaction intents route to
typed `SimulationAction` commands (tea/shower/window/sleep). View
transitions only change the local renderer view. Unsupported computer
setup/travel intents show an explicit not-yet-migrated notice rather than
mutating a shadow kernel.

The actual `BuddyItem` component from Pulse is reused in
`WorkerPulsePanel`, with identities exclusively from bounded,
player-known `getMessengerRead` data, presence from a separate
authorized `getPresenceRead`, and conversation pages from the
generation-/revision-guarded `getConversationReadAsync` Worker query.
Sending messages uses `SOCIAL_SEND_MESSAGE` against the SAME kernel.
No `SocialEngine.getBuddies()`, arbitrary chat map, Zustand store,
or sync engine methods are imported by either new consumer.

`WorkerGameSession.read()` is deliberately constrained to the
allowlisted `SimulationQuery` contract, with no generic method RPC.
Only the active Room or Pulse pane mounts the expensive renderer/reads;
the original normal-game route stays unchanged.

New Chromium acceptance (`ScenarioK_WorkerAuthoredConsumers`):
real Phaser canvas + shower gameplay time mutation with absent
`__simEngine/__simStore`; and **current-format v6 legacy-created
slot → Worker-only boot**, existing authorized conversation read,
BuddyItem rendering, new message send and source-backed redraw.
The legacy fixture is used only to prepare a saved world before
navigating away; it is never loaded alongside the Worker session.

**Not complete:** broad Desktop/Pulse windows, installation/download UI,
modal economy and transit, full live actor placement/rigging and normal
entrypoint still require migration. These partial authored consumers
cannot justify merging #175 or dropping the currently playable UI.


## P3.3 — OS window management and canonical VFS consumers (staged)

The Worker-only `worker.html` route now includes a **Desktop** pane.
It reuses the original `useWindowStore` for presentation-only
open/focus/minimize/restore/maximize/close semantics and the existing
`getOsPresentationProfile` for the owned OS theme; **neither module
imports or creates SimulationKernel**.

The canonical `SimulationKernel.getDesktopRead()` was added to the
typed, allowlisted Worker query protocol. `WorkerDesktop` reads
`desktop` and `chrome` projections at coherent revisions. When the
canonical OS is absent, it explicitly describes its windows as a
**technical migration surface**, not an in-world OS unlock. The full
legacy `DesktopShell`, `WindowFrame`, `Taskbar` and `OsHostProvider`
are NOT imported in the Worker-only entry because they still directly
depend on `useSimulationStore` and would construct a second owner.

Two concrete application workflows now run over the sole Worker owner:
`WorkerFileExplorer` displays bounded, paginated source-owned
`getDirectoryRead('C:/Documents')` metadata without full VFS cloning;
`WorkerNotepad` retrieves a single `getFileRead(path)` body and
issues `VFS_CREATE_FILE` to the canonical Kernel, matching the legacy
Notepad's save contract. Pulse contacts and bounded conversations
already migrated in P3.2 can now be opened, minimized, restored and
closed inside the OS window manager; window state stays purely in
the browser UI, not in the Worker domain authority.

Acceptance `ScenarioL_WorkerDesktopVfs.spec.ts` checks real
Notepad → canonical VFS file creation → minimize/restore/close →
File Explorer read → reopened Notepad read, plus Pulse window
minimize/restore/close. The browser asserts no legacy `__simEngine`
or `__simStore` is constructed on this Worker-only route.

**Still not accepted as full #175 cutover:** the complete native
Desktop windows, installation, downloads, transit/physical placement
and many legacy app imports still need worker-backed ports. The
normal-game `/` route deliberately remains on its known-good
synchronous owner until all gameplay is migrated and acceptance
benchmarks run. Do not merge an incomplete parallel/duplicate world.


## P3.4 — Physical computer, owned media, OS install and DownloadManager

The Worker-only desktop now opens a **Computer & Setup** panel,
using the existing `getAppRead()` hardware/download/software
projection and `getDesktopRead()` owned media + boot status.
The allowlisted Worker RPC `hardware` offers a finite set of
commands only: setup owned room package, power on/off, insert/eject
specific owned media, read authoritative OS installation preflight,
and commit its returned immutable plan. These forward **directly
into `SimulationKernel`'s existing published transactions**, not
a simulated setup wizard or an arbitrary reflective method name.

The Worker preflight requires an assembled machine, physical storage
and optical drive, and a genuinely owned inserted OS setup disc.
The preflight is read-only. Commit invokes the canonical transaction,
which repeats preflight and rejects stale/incompatible plans;
UI-only presentation progress does not install anything.
The UI exposes the existing `bundle_scrapyard` purchase from the
authored hardware catalog through `STORE_PURCHASE_ITEM`, enabling
a complete New Game → Purchase → Assemble → Insert owned Orion 4.8
CD → Preflight → Commit → Power On sequence **entirely in the Worker**.
The boot status and OS identity always come back from owner queries.

The same `getAppRead` supplies installed-software records and up to
256 canonical DownloadManager tasks. Existing
`SOFTWARE_UNINSTALL`, `DOWNLOAD_START`, `DOWNLOAD_PAUSE`,
`DOWNLOAD_RESUME` and `DOWNLOAD_CANCEL` actions operate on
the Worker owner. Manual URL entry is strictly an explicitly
labeled **in-game .local simulated download**, never external
browser networking. No second client-side download progress model
or invented installer state is introduced.

Unit acceptance extends `SimulationWorkerRuntime.test.ts` with
actual canonical owned starter purchase and OS install, non-mutating
preflight, rejection of an ejected/stale plan and accepted fresh
commit/time. Chromium `ScenarioM_WorkerPhysicalOs.spec.ts`
executes the full in-game PC setup/OS installation and save/reload,
plus a denial of missing owned media and external download URLs.
No local `__simEngine/__simStore` is constructed in these flows.

**Cutover still in progress:** `worker.html` remains an isolated
staging entry. The full legacy installer/OS wizard and default Desktop
continue using synchronous owners on `/` until all remaining
consumers and acceptance gates migrate. No false readiness claim.


## P3.5 — Worker-backed Oakhaven city routes

The staging game shell now offers the original Oakhaven city map, with
public static topology and owner-backed `WorldRead` for the player's
current location and weather. Route quotes are previews only.
Authoritative `TRAVEL_TO` commands execute inside the existing
Dedicated Worker, including time, fees, closures, energy and encounters.
The room door opens the city map; while away the room tab no longer
renders a misleading bedroom scene. A usable PC hotspot opens the
Worker desktop.

Chromium `ScenarioN_WorkerCityTravel.spec.ts` verifies travel from
home to the café, saving and reopening the updated location, returning
home, and the bus-unavailable walking route. This is an incremental
consumer cutover, not the final default-entry switch.

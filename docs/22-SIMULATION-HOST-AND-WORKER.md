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


## P3.6 — Save-slot isolation and Worker lifecycle hardening (staged)

An explicit Worker Save As now captures the **current** UI-owned Pulse moment
and commits that payload under the **destination slot** in the same canonical
v6 Worker save operation. Only a successful commit mirrors the payload to
the destination localStorage key. Loading a save restores Pulse under the
slot being opened, regardless of its earlier source slot identifier. A
failed save never switches the live Pulse identity; daily autosave copies
the moment to `autosave` without redirecting the active UI slot.

Day-boundary autosave is coalesced to one in-flight Worker transaction. A
failed IDB save remains eligible for retry at the next canonical revision,
not falsely marked complete. If another day passes while the transaction is
pending, the latest day is queued after completion, not as an overlapping
write. No UI-owned world or persistence fallback was added.

A delayed query from an **older, disposed Worker generation** can no longer
block the new generation's coherent HUD/world/player refresh or reset its
read lock. Unit tests cover retry, multi-day coalescing, failed manual
Save As, copied Pulse metadata, and old-generation read isolation. An
additional actual Chromium Worker-first flow saves Pulse metadata to
another slot, destroys its local copy, and verifies it reloads from the
Worker-owned canonical slot without starting the legacy world.

This fixes persistence/lifecycle hazards, **not** the remaining normal-game
entrypoint cutover. PR #204 stays Draft and #175 stays Open until the
remaining app registry/OS UI consumers and production-root Worker authority
are migrated, then final browser and 20/100/250/500 NPC acceptance runs.


## P3.7 — Two public desktop websites (staging consumer)

A **Town Sites** window now reads the existing public `getWebsiteRead()`
and `getJobBoardRead()` owner projections over explicitly allowlisted
Worker `website` and `jobBoard` queries. The former contains no more
than 256 public triggered events, the latter no more than 32 public gig
summaries. Neither transfers the Social graph, private NPC records, a
full WorldState or a general RPC/method selector.

This is a deliberately narrow Worker-facing **public read surface**, not
an assertion that the original Voyager/CityWire/Jobs browser UI and
application workflows have all been migrated. Those legacy components
still import the main-thread synchronous simulation store and must not
be mounted on `worker.html`. A mounted public-site window uses the
existing UI-only window store for taskbar minimize/restore/close.

Unit coverage checks source-backed bounds/no `getState()`; real Chromium
coverage checks both pages and window lifecycle without constructing a
legacy `__simEngine` or `__simStore`. Further app command ports and the
production entrypoint remain outstanding before #175 acceptance.


## P3.8 — One shared authored OS window frame (staged)

The original `WindowFrame` has been split along its existing seam: the
legacy adapter retains `useSimulationChrome` and `OsHostProvider`, while
`WindowFrameChrome` receives the OS identity directly and contains **the
same authored titlebar, pointer dragging/resizing, maximize/restore, close,
minimize, sound and distro motion/visual styles**. The Worker desktop now
mounts this presentation-only component with its bounded `ChromeRead`
without ever importing the old main-thread store or an OsHostProvider.
The temporary duplicate WorkerDesktopWindow implementation is deleted.
Existing legacy window callers still import `WindowFrame` unchanged.
The local `useWindowStore` remains UI-only, while all game/domain actions
still travel through the canonical Dedicated Worker.

Chromium acceptance extends the Worker Desktop/VFS scenario with actual
shared WindowFrame titlebar dragging, maximize/restore and a check that
no legacy `__simEngine`/`__simStore` was constructed; existing window
open/minimize/restore/close and normal-game browser smoke must also pass.
This **does not** migrate the old `Taskbar`, `OsHostProvider` app API,
`WindowManager`'s eager legacy registry, or production `/` routing.
Do not merge until those dependencies are addressed and #177 scale proven.


## P3.9 — Shared authored Mailbox with Worker-owned letters and deliveries

The original, 399-line `MailboxApp` presentation is now extracted as
`MailboxView`, taking the existing player-safe `SimulationMailboxRead`
model instead of importing `useSimulationMailbox` itself. The legacy app
keeps a thin synchronous adapter; the Worker desktop imports ONLY the
pure view. A finite allowlisted `mailbox` Worker query forwards to
`SimulationKernel.getMailboxRead()`, which caps recent NPC letters to
12 and serves a source-backed courier receipt tray. This does **not**
ship the Social graph or arbitrary private conversations to React.

The original local-only compose/sent/trash interactions remain local UI
behavior as before, not simulated canonical mail delivery. Browser
acceptance mounts the same legacy-authored Mailbox visuals in an actual
Worker-only OS window, exercises taskbar lifecycle and checks that no
synchronous `__simEngine`/`__simStore` is ever instantiated. Unit
coverage checks source-backed bounds and no world-snapshot export.

The full Desktop app registry, installer/browser flows and main `/`
entrypoint still have legacy synchronous dependencies. #175 remains a
Draft staging cutover, not an accepted production merge.


## P3.10 — Shared Orion Taskbar and Start Menu, canonical Worker actions

Extracted the actual OS-profile-driven Orion `TaskbarChrome` and
`StartMenuChrome` from their synchronous wrappers; the normal desktop
keeps both original `Taskbar` and `StartMenu` adapters. The Worker desktop
now mounts the SAME authored taskbar buttons/Start menus with window
minimize/restore, show-desktop, icon quick-launch, calendar/game-time from
bounded `ChromeRead`, and Worker-owned sleep via typed `dispatch`.
Worker Start resolves only currently ported app IDs (Browser to public
Town Sites, Explorer, Notepad, setup, installed Pulse); unavailable
programs are not offered as fictitious applications. The existing full
`SystemTray` depends on main-thread engine events, so the Worker uses a
small explicitly staged bounded-read tray until that consumer is ported.
Chromium tests cover Start/Documents, unsupported-program exclusion,
Settings opening and taskbar minimize/restore/show-desktop, with no
legacy synchronous engine module instantiated.

This is NOT normal `/` cutover; keep #204 Draft and #175 Open.


## P3.11 — Shared authored SystemTray Chrome

The actual Orion OS `SystemTray` presentation is now `SystemTrayChrome`
with typed `SimulationChromeRead` input. This preserves the original
volume/mute slider, Pulse unread tray and bounded sender previews,
network status indicators, downloader activity lights and game clock.
The legacy `SystemTray` wrapper owns its original live engine event
subscription for incoming-message sound (no restore/unread replay); the
Worker browser never imports that synchronous adapter and reads its
tray only through the allowlisted Worker-owned `chrome` query. UI-only
blink/volume controls run on the browser thread; no simulation clock
or NPC authority is duplicated in the tray.

The Worker still maps the network icon to its existing staged computer
setup window until full dial-up OS Host APIs are migrated. Chromium
verifies the original volume popup, Pulse tray/popups and Worker-only
single engine. #204 stays Draft until normal `/` and full app parity.


## P3.12 — One authored WindowManager for legacy and Worker desktops

The original `WindowManager` now delegates to presentation-only
`WindowManagerChrome`, which retains the same `useWindowStore` window order,
active/z-index filtering, frameless draggable header, modal layering,
Alt+F4 close/tray lifecycle and Alt+Tab focus cycling. The old manager
still owns its existing complete synchronous app registry and original
`WindowFrame` adapter; the Worker desktop injects the small allowlisted
Worker app renderer and shared `WindowFrameChrome` without importing
legacy AppRegistry code. This deletes the separate manual Worker window
mapping and gives the Worker the real authored keyboard/window manager
semantics, not a parallel implementation.

The renderer callback creates a stable `WorkerDesktopApp` component per
window so unrelated canonical minute revisions do not remount Notepad,
Mailbox compose or other local presentation state. Regression coverage
includes exact source boundaries and real Chromium Alt+Tab/Alt+F4 with two
separate Worker-owned windows, while the old browser normal-game smoke
must still pass. No production `/` cutover is claimed by this step.


## P3.13 — OS Host API seam and first reused host-dependent app

Extracted `OsHostApiContext` from the original `OsHostContext` so
app-visible OS services (window lifecycle, VFS, network/downloads, audio,
active OS/presentation/capabilities) no longer require importing the
synchronous simulation store. Original `OsHostProvider` keeps all its
legacy engine behavior through the **same** context; `useOsHost` remains
reexported from its old import for unported consumers.

The Worker adds a separate `WorkerOsHostProvider` backed solely by finite
`apps` and `file` reads and validated typed `VFS_CREATE_FILE`,
`VFS_DELETE_FILE`, `DOWNLOAD_START` and `DOWNLOAD_CANCEL` commands.
No arbitrary browser fetches: network requests are canonical simulated
HTTP `.local` URLs and are validated before dispatch. Real failures are
surfaced to the Worker OS app, not silently asserted successful.

The **original FlashFetch app** (not a clone) now reads queue/connection
truth and invokes the Worker Host API through the shared context; its
legacy browser rendering remains available unchanged except for the
import path to the pure Host hook. This first host-dependent migration
proves the seam for subsequent apps (installer, browser and OS tools)
without ever constructing a shadow main-thread simulation. Browser
acceptance tests original FlashFetch open, real-URL denial and unchanged
Worker-only engine isolation; unit checks the actual typed RPC boundary.

#175 is **not** production complete. Stage `/worker.html` remains
isolated. Full app parity, native `/` bootstrap, failure recovery and
NPC stress fixtures must still gate Ready/merge.


## P3.14a — Extracted authored DownloadHub presentation/catalog

The existing authored DownloadHub software catalog, dynamic event banner,
category tabs, status/progress buttons and exact 2006 visual layout now live
in `DownloadHubView`, with the legacy `DownloadHubSite` retaining the
original Host API actions and dynamically published world/Pulse reads as its
adapter. The pure view has no main-thread simulation, site router or Host
hook dependencies, and can be mounted with finite Worker-owned read models.
This step does not falsely claim the Worker browser/installer are shipped.


## P3.14b — Extracted original Voyager browser chrome

The legacy Voyager now renders through `VoyagerBrowserChrome`, retaining
its original 2006 OS title/menu/address bar, back/forward/refresh,
bookmarks, SearchMate toolbar slot, loading progress and file Save Page
controls. The original `VoyagerBrowserApp` remains the old owner adapter
for `InternetRouter`, generated AI sites, saved pages and history; the
pure visual chrome has no static imports from the site's engine-backed
route registry. This prepares the Worker adapter without instantiating a
second engine in the browser. No claim of full browser parity yet.


## P3.14c — Worker Voyager browser and DownloadHub canonical integration

Mounted the real authored `VoyagerBrowserChrome` and `DownloadHubView`
on the single Writer's browser desktop. DownloadHub reads owner-published
website event mirrors and app download queue; valid in-game `.local` file
links issue typed `DOWNLOAD_START` through the Worker Host, not fetch.
Offline downloads report a disconnected computer instead of claiming
success. Voyager Save Page commits real VFS text files through the Worker,
and browser history, address bar, bookmarks and tab/window chrome remain
UI-only. CityWire and Jobs use the bounded live public views.
Unported sites and external URLs explicitly report unavailability; the
legacy `InternetRouter` must never be imported in `worker.html` because
its static site map includes synchronous engine clients. Full site parity,
installer preview/commit, production root switch and stress remain gates.


## P3.15 — Installer proof and shared original Orion Wizard

The game now has a dedicated typed `installer` query that checks one
installer file, one matching canonical complete DownloadHub download,
its size/source provenance and a fixed authored software mapping.
The `SOFTWARE_INSTALL_FROM_DOWNLOAD` action repeats the same preflight
in the single Kernel before calling the existing `SOFTWARE_INSTALL`
owner transaction; compatibility is re-checked inside that commit.
A missing, forged, unsupported or incomplete file cannot install.
The exact original six-step Wizard presentation, including OS/RAM/disk
checks and offered opt-out boxes, is now `InstallerWizardView` with
an unchanged legacy adapter and a Worker adapter to follow. No shadow
SoftwareRegistry or fake completion is created on the browser thread.


## P3.15d — Authoritative download receipts and published software metadata

Installer installation now validates an exact `downloadTaskId` receipt minted
by `DownloadManager` **only after successful VFS file creation**, not by
searching the 256-task UI page. Owner-side `VFS_CREATE_FILE` rejects attempts
to inject that receipt. Disk-full/path collisions mark downloads failed, emit
`download:failed`, and preserve the prior VFS file without false completion.
The original authored DownloadHub catalog has moved unchanged to a pure
TypeScript module (no React or eager engine imports). Installer preflight
checks its published ID, URL, and byte size against the completed transfer:
arbitrary 1 KiB downloads cannot masquerade as the 6 MiB Pulse package. The
Worker tests exercise forged-size rejection, later real receipt acceptance,
and the install/shortcut opt-out path. Normal `/` legacy behavior is not
cut over; PR #204 stays Draft, #175 Open.


## P3.16 — Canonical installed-program Desktop and Start Menu projection

The bounded `desktop` read now includes only up to 64 installed-program
identity/version summaries, alongside the original VFS desktop shortcuts.
`WorkerInstalledAppLinks` joins **both owner-derived sources**: no installed
record or no actual shortcut means no desktop icon. This retains the installer
shortcut opt-out behavior. Pulse/FlashFetch shortcuts open their actual
Worker-backed windows; installed programs without a migrated UI remain
visible but disabled, not fake launchable placeholders. The unchanged
original `StartMenuChrome` accepts an optional installed-program roster,
with the same transparent unavailable state. Existing legacy route keeps
its previous behavior because that optional slot is absent. The Worker
Wizard only auto-launches Pulse/FlashFetch on a successful canonical
installation response, not on a failed or merely rendered completion
screen. These projected summaries are not a second software registry and
never create a main-thread simulation engine.


## P3.17a — Original WeatherBuddy on canonical Worker five-day forecast

The existing authored frog/weather/adware presentation is extracted unchanged
to `WeatherBuddyView`, shared with the original `WeatherBuddyApp`
legacy adapter. It has no engine, store, router or game clock dependencies.
The Worker protocol now exposes the already implemented
`SimulationKernel.getWeatherBuddyRead()` as an explicit bounded
`weatherBuddy` query (current conditions and exactly five forecast days).
`WorkerWeatherBuddyPanel` joins that read with the bounded `apps`
projection at **the same revision**, preserving the in-game SearchMate
banner, temperature conversion and original city/weather art. An
uninstalled WeatherBuddy remains unavailable; installation-backed desktop
shortcuts and Start Menu entries now enable its real Worker window.
The older `/` route keeps the existing bounded-read adapter. RetroAmp's
hardcoded "Add File" playback is deliberately deferred until actual VFS
file-open behavior is implemented, rather than claim false library parity.
This is staged parity, not the normal production root flip.


## P3.17b — Original SafeSweep UI on canonical uninstall decisions

`SafeSweepView` reuses the original authored 2006 scanner/results table,
but reads only a bounded installed-software list and awaits the actual
`SOFTWARE_UNINSTALL` reply before claiming a removal. Individual failed
commands stay visible with their owner errors. The earlier synthetic
tracking cookie is removed because no canonical file, registry entry or
download actually backed it; the scanner now explicitly describes its
limited installed-program checks rather than claiming a full file scan.
The legacy adapter still uses the original synchronous dispatcher,
whereas `WorkerSafeSweepPanel` uses only `apps` queries and typed
`session.dispatch`. Only an installed SafeSweep can be opened through
the Worker Start Menu/shortcut, and uninstalled software is never
silently fabricated on the main thread.


### P3.17 display authenticity
The original WeatherBuddy hard-coded `Humidity: 88%` readout has
been replaced by the normalized wind index already provided by its
canonical `EnvironmentWeatherSnapshot`; the frog's line now reflects the
actual current condition. The Weather domain has no humidity reading,
so the UI does not invent one. SafeSweep recognizes all SearchMate
toolbar, homepage hijack and autorun payload flags from installed
software rather than falsely clearing non-toolbar adware.


## P3.18 — True stored ZIP archives and ZipMate UI

The original authored ZipMate table and controls are shared by
`ZipMateView`, both the normal legacy adapter and staged
`WorkerZipMatePanel`. Hardcoded nonexistent demo archives and
cosmetic extraction timers are gone. Create ZIP takes 1–16 existing
Documents text files and writes a genuine uncompressed PKZIP STORE
container (local and central headers, CRC32) into the canonical VFS.
Because the codec currently supports STORE only, its savings display
is 0%, never an invented compression claim. ZIP binary is encoded
to VFS string storage but never serialized in the Worker archive
preview. The bounded `archive` query returns filename, byte
count and CRC32 only. Owner-only `VFS_ARCHIVE_EXTRACT` validates
headers, checksum, UTF-8, path names and all destination collisions
and free disk before writing actual prefixed text files into Documents.
Explorer opens real archive files via ZipMate, and installation-backed
shortcuts/Start Menu require a real ZipMate installation. Downloaded
archives without real stored binary payload explicitly report unreadable
rather than pretending to extract their previously nonexistent files.
Other compressed/encrypted/ZIP64 ZIP formats are unsupported for now.
No production `/` cutover or merge.

### Archive body privacy
The generic selected-file display projection now deliberately omits
binary ZIP payloads from `kind: archive` files. A verified ZIP's
member names, sizes and CRCs are published only through the bounded
`archive` read. The Worker unit test asserts even an explicit
`file` read of a ZIP cannot expose the owner-private base64 body.


## P3.19 — Actual PhotoBox illustrations and VFS exports

PhotoBox's original preset and filter controls are now shared by a pure
`PhotoBoxView` on the legacy main-thread adapter and Worker desktop.
The former placeholder emoji/gradient canvas is replaced by three
self-contained authored SVG **illustrations**. The owner-only typed
`PHOTOBOX_EXPORT_ARTWORK` command validates scene, filter bounds and
disk capacity, renders real SVG with the chosen visual adjustments and
writes `C:/Pictures/edited_{motel,diner,canal}.svg` only on actual
successful file creation. Duplicate saves fail honestly instead of
reporting a fictional PNG. A bounded VFS file read opens previously
saved PhotoBox artwork in a small picture preview; Explorer exposes
the canonical Pictures folder. Its Start Menu and desktop shortcut
appear as an available Worker app only after canonical installation.
The original Orion 6.0/768 MB eligibility gate is unchanged. This
does not claim photographic image capture, bitmap import/PNG editing
or full raster asset parity. No production root flip yet.

### PhotoBox owner-authorization and SVG provenance gate
The owner refuses `PHOTOBOX_EXPORT_ARTWORK` unless PhotoBox is
**installed** and the workstation has **Orion 6.0 + >=768 MB** at
dispatch time. A client call cannot bypass the original UI requirement.
Only byte-identical SVGs produced by the pure authored scene/filter
generator may render as stored photos; lookalike user-saved SVGs or
injected scripts are rejected by `verifiedPhotoBoxSvg`. The generic
selected-file projection additionally withholds image bodies larger
than 16 KiB. Worker integration tests cover the uninstalled refusal,
positive eligible installed-PC export, invalid filter, duplicate export,
and the absence of invented files following refusal.


## P3.20 — RetroAmp real PCM WAV and browser installation gate

The original retro music player no longer invents four nonexistent MP3s,
moves an imaginary timer, or appends a fake C:/Music track from Add File.
Its retro window and EQ/playlist controls remain original presentation;
a real HTML media element decodes explicitly selected VFS-backed RIFF
WAV audio. Web Audio filters, panning, and analyser follow playback
rather than random equalizer bars. No arbitrary MP3 codec or internet
music stream is claimed. The DownloadHub listing explicitly says that
MP3 decoding is not supported yet.

\`RETROAMP_IMPORT_SAMPLE\` is a typed single-writer Worker command:
only an installed RetroAmp on a booted OS can mint the authored
8-second PCM sample at \`C:/Music/Motel Night Loop.wav\`. The VFS
enforces normal disk/collision behavior. An existing file counts as
already imported only when its bytes, size, kind, and app association
match the authored WAV exactly. Generic file reads bound audio bodies
to 96,000 characters; the UI enumerates at most 16 Music entries and
opens at most 8 selected WAV files. Explorer may open one chosen
Music file in RetroAmp; installed shortcuts and the Start Menu link
are only enabled after a canonical installed program exists. The
original download/installer wizard can launch the just-installed
app. RetroAmp's authored minimum RAM is now 64 MB, appropriate for
the starter Orion 4.8 machine, without weakening higher-end apps'
hardware requirements.

\`RetroAmpSample.test.ts\` checks true RIFF/PCM bytes, owner
installation/boot gates, idempotence, and spoofed-file collisions.
\`ScenarioO_WorkerRetroAmpRealAudio.spec.ts\` exercises the real
mouse-driven journey through PC setup, local DownloadHub, canonical
world-minute transfer, installer, playback, and Clear/Add, without
a local engine or fabricated network/audio. This is a staging
acceptance route only; production \`/\` remains legacy until #175's
single-Worker cutover and #177's scale gate are satisfied.


### P3.20 corrective acceptance — Window/footer geometry and continuous playback

A real Chromium full install-to-play clickthrough exposed a contained-desktop
window geometry fault: the default cascaded Setup Wizard footer landed below
the OS taskbar, so pointer events were swallowed. Shared
`WindowFrameChrome` now clamps normal windows to the available desktop
work area above the taskbar (without rewriting the UI-only stored window
position). The shared installer wizard flex shell now allows its main contents
to scroll while the footer remains reachable, including in short Worker
desktops. Browser acceptance asserts the real Next buttons' boxes are above
the taskbar *before* clicking them; it does not force-click obstructed buttons.

The RetroAmp Worker adapter also retains the real media element across world
minute/other canonical revision notifications. Unchanged source-backed VFS
tracks preserve their React identity; only actual Music file changes replace
the playlist. Browser acceptance tags the playing audio element, advances
15 game minutes, and proves that element survives the revalidation. This
work is still on isolated `/worker.html`, without a production cutover.


### Chromium ScenarioO selector/accessibility correction

The post-geometry Chromium run reached the genuinely imported WAV (the
marquee and playlist both showed `Motel Night Loop`), but a broad
`getByText(/Motel Night Loop/)` locator had two correct matches and
Playwright failed in strict mode. The acceptance now asserts the explicit
one-track playlist heading and the exact named playlist entry rather
than selecting arbitrary duplicate display text. The original symbolic
transport controls now have accessible Play/Pause/Stop/Previous/Next
labels, benefiting keyboard/screen-reader testing without changing
the retro visual controls. Full audio playback proof still depends on
the latest exact-head Chromium result.


## P3.21 — Explicit Worker failure recovery and bounded boot watchdog

A Worker which never acknowledges a fresh initialization now fails after
30 seconds, or 60 seconds for a cold IndexedDB saved-slot boot. The
main-thread RPC transport clears these timers on every success, failure,
or disposal, rejects outstanding initialization, disposes its Worker,
and emits the same fail-closed signal as a native Worker error. There is
**no** main-thread SimulationKernel fallback or cached domain snapshot.

The Worker game shell's error state now explicitly warns that unsaved
progress is unrecoverable. The player may choose to recover the selected
saved slot, separately recover \`autosave\`, or intentionally start a
new game. Each path creates a **fresh** Dedicated Worker through the
same ordered initialization contract and retains the previous session
generation/old-window-stack teardown. No automatic overwrite, save on
fatal fault, or guessed successful recovery occurs.

\`WorkerSimulationHost.test.ts\` guards stalled fresh/cold boot,
successful acknowledgment and watchdog cleanup with fake time.
\`ScenarioP_WorkerFaultRecovery.spec.ts\` uses browser-only capture of
the **native Worker handle** to generate a real Worker \`error\` event;
it verifies that the HUD and app windows disappear on failure, that
no simulation exists on the main thread, and that explicit slot
recovery starts another Worker and restores only saved (not later
unsaved) progress. A second route reloads the entire browser page
and cold-loads the IndexedDB slot. These tests are staged on the
existing \`/worker.html\` route, with no production \`/\` cutover.


### P3.21 staged browser publication synchronization

First Chromium recovery run succeeded for the full-page cold-reload scenario;
the native-error scenario initially sampled the Worker HUD synchronously
after an \`advance\` RPC acknowledgement. The bounded React projection is
asynchronous, so the test occasionally read the preceding saved minute
and incorrectly concluded that no unsaved progress existed. The test now
polls until the **published** minute reaches the required unsaved value
before injecting a native Worker error. It then compares recovered time
with that verified higher value. No product command, saved-state contract
or recoverability expectation is weakened.


### P3.21 two-step clock publication barrier

The second Browser ScenarioP run showed the earlier **first** 15-minute
command was also reading before its HUD projection arrived. Therefore
the captured save baseline could be the prior minute, and the second
advance check could accidentally pass on the *first* change. The
browser test now records the initial minute and waits for its first
+15-minute published HUD before saving. It then explicitly awaits
a second +15 published HUD, crashes the native Worker, and verifies
the recovered slot is at least the saved baseline but strictly
earlier than the second change. The test continues to use actual
serializable commands and real IDB save/load; no owner is mocked.


## P3.22 — Worker-owned Orion Command Prompt

The missing Command Prompt is now a Worker-only desktop window, using the
same authored Orion WindowFrame / Start Menu / taskbar shell as other apps.
Presentation and bounded parsing/history live in React; **no** synchronous
SimulationEngine, VFS graph or fabricated network behavior is imported.

HELP, VER, CLS, EXIT, CD, DIR, TYPE, SAVE, DEL and UNZIP are implemented.
Directory listings request at most 32 entries from the Worker, explicitly
selected text files only are read (display capped at 8192 characters),
and SAVE mints at most 2048-character new .txt files under C:/Documents
using the canonical VFS_CREATE_FILE command. DEL delegates to the owner's
VFS_MOVE_TRASH; UNZIP delegates to VFS_ARCHIVE_EXTRACT with owner validation.
All commands report owner refusals and directory existence rather than
simulated success; PING/network commands explicitly return unsupported
instead of invented IPs or latency. Paths are confined to canonical C:
with traversal guards. UI history is bounded to 40 and output to 120 lines.

ScenarioQ proves Command Prompt -> Explorer -> Notepad -> Worker save ->
Worker cold-load on the same file, plus traversal and unsupported-command
behavior; a unit-level parser/action boundary suite tests limits and dispatch.
This extends the isolated Worker-first shell only: production '/' remains
on the legacy UI and #175/#177 stay OPEN until full parity and scale proof.


### P3.22 browser acceptance: real OS occlusion

First exact-head Chromium ScenarioQ proved HELP, CD, DIR, TYPE, SAVE and
unsupported-command responses, but the integration test tried to click
the desktop My Computer icon **through the open Command Prompt**. The
OS window correctly intercepted the click, so that test timed out,
while the independent traversal/false-network test passed. The
acceptance now minimizes Command Prompt with its actual titlebar
control before opening the desktop icon, checks that the window really
vanished, and uses a short actionable click timeout. This is a
test journey correction, not a bypass of normal window occlusion.


## P3.23 — Worker desktop System Utilities migration

The Worker-first desktop now mounts Recycle Bin, Add/Remove Programs and
Save / Load Game in the existing Orion window manager/taskbar/Start Menu.
These reuse canonical VFS/software/save ownership; no main-thread
SimulationEngine or legacy application wrappers are imported.

- Recycle Bin fetches only 32 trash-file metadata rows at a time. Restore
  and Empty are explicit \`VFS_RESTORE_TRASH\`/\`VFS_EMPTY_TRASH\` commands.
  Permanent empty requires an in-panel second confirmation.
- Add/Remove uses a new capped \`installedPrograms\` semantic query (64
  non-portable/portable records maximum, excluding hardware, download ledgers,
  VFS bodies and unrelated domain graph). A selected real installed ID is
  passed only to canonical \`SOFTWARE_UNINSTALL\`, with explicit confirmation.
- Save/Load uses the existing UI-only slot listing helper to enumerate
  three manual slots and autosave; the sole full simulation save/load remains
  in the Worker through \`WorkerGameSession.save/loadGame\`. A load releases
  the previous Worker, clears all old UI window state immediately, and
  cold-loads a fresh Dedicated Worker. The current slot cannot be deleted
  while its cold-conversation reader may reference its saved pages.
- New Chromium ScenarioR proves terminal-created/deleted VFS file restore,
  in-OS Save As + unsaved minute loss after cold load, and Add/Remove
  availability. All operations remain on the staging \`worker.html\` entry.

The main '/' entry still uses the synchronous UI. This does NOT complete
issue #175 or gate #177; production cutover remains blocked on remaining
legacy UI parity and independent performance evidence.


## P3.24 — AI Lab diagnostic inspector on canonical Worker (partial parity)

The original AI Lab imports the synchronous SimulationEngine and mixes
private developer diagnostics, BYOK provider benchmarking, procedural events,
OS releases, newcomer generation and character image generation. It must not
be imported into the Worker desktop unchanged.

The staging Worker desktop now has a read-only AI Lab Inspector backed by
the new labPage query. Its indices must be nonnegative safe integers capped
to 4096. The canonical Worker projects at most 16 actors, 16 appointments
and three truncated 160-character memories per actor, plus source-backed
body/rent and event totals. The 500-item image option list and complete
memories/promises NEVER cross postMessage. This diagnostic must not be
reused as a player-facing actor or relationship API.

The authored desktop handles minimize/restore and cold-session teardown.
The AI Lab's original generator, BYOK/provider settings, benchmarks, image,
OS release and newcomer injection remain unavailable and visibly labeled.
This partial milestone is not full app parity; root / is still the legacy
runtime. Keep #175 open and PR #204 Draft pending other cutover gates.


## P3.25 — Sparse Life bond projection

PR #205 identified superlinear CPU cost in whole-minute NPC ticks. The
Life Matrix previously enumerated every NPC for every actor and read an
explicitly neutral bond for every unrelated pair. The source-owned sparse
NPC relationship graph now maintains a derived lookup index containing only
directed edge keys, not copied relationship truth. Life projections return
immediately when an actor has no stored bonds and scan the canonical roster
only when a source actually has directed edges. All non-neutral semantics,
romance-only edges, output order and save format remain unchanged.

Tests compare the former exhaustive reference algorithm with the new
projection after reversed insertions, explicitly neutral bonds, directional
writes, romance, save/restore, actor removal, defensive copy mutation and
canonical Life reads. An empty-edge 72-actor probe asserts zero all-roster
and zero per-pair access. This does NOT settle coarse-time-jump semantics or
prove 500-NPC performance: rerun the independent #177 benchmark fixtures
against the combined head before the final production cutover.

## P3.26 — Worker-owned offline Lab procedural events

The developer AI Lab now supports the actual procedural world-event pipeline,
rather than a read-only inspector. The first migrated generator is deliberately
offline/deterministic: no AI settings, keys, or provider requests cross the
Dedicated Worker boundary.

- Typed allowlisted labProcedural commands preview or inject 1–3 events with
  a bounded seed and one of six supported categories / mixed category.
  The Worker validates all controls, including a mandatory expectedRevision
  on injection; invalid, oversized and stale requests fail explicitly.
- Both operations run the existing ProceduralDirector against the canonical
  Worker World owner using useAI:false and inject:false. Preview is side-effect
  free. Injection uses SimulationKernel.generateProceduralEvents to publish
  a single attributable, idempotent canonical world update.
- The desktop Lab panel displays the upcoming event title, description,
  day, category and NPC knowledge prompt. Preview confirmation is disabled
  when the session revision changes. No private world graph or AI key is
  sent to React.
- Unit tests verify pure preview, stale rejection, exact preview/commit
  parity, bounded response shape, invalid controls and persistence.
  The existing Chromium AI Lab gate also drives preview, injection,
  save and cold reopen using the real Worker and browser IndexedDB.

This is a scoped executable implementation, not full AI Lab migration.
Character/OS generators, optional provider-backed generation and benchmarks
are still intentionally unavailable. The default / entry still uses the
old synchronous runtime; PR #204 must remain Draft until final production
cutover, complete feature parity and combined #177 population verification.

### P3.26 cold-restore defect found and corrected

Chromium exposed an existing WorldState omission: triggered events survived
serialization but dynamically injected *future/pending* events were never
exported and could not survive a cold Worker. Moreover, hot load left queued
events from the previous world in memory. World now persists only
pendingProceduralEvents that are not derived from the authored catalog.
Cold/hot restoration clears the old queue, reconstructs catalog entries,
restores validated dynamic pending entries, and excludes triggered IDs.
The save schema stays free of duplicate authored catalog entries; when
no procedural queue exists the original snapshot shape is preserved.
The Worker test exercises a distinct cold runtime and also hot-load queue
eviction, rather than mistakenly reloading into the same populated owner.

## P3.27 — Worker-owned offline Orion OS release authoring

AI Lab can now preview and register a genuine future installable OS variant
inside the Dedicated Worker, without creating a main-thread SimulationKernel:

- A separate typed `labOs` command supports `preview` and `inject` for
  deterministic offline release templates in Orion families 5.x/6.x/7.x.
  Controls and payloads are bounded and validated; no API credentials,
  provider calls, OS catalog dumps or broad snapshots cross normal IPC.
- `SimulationKernel.previewOfflineLabOsRelease` derives the same build and
  candidate from the canonical world day and user-selected seed. A stable
  namespaced variant ID avoids clashes with authored core OS releases (which
  otherwise share template version IDs); `Math.random` is never used.
- Preview does not modify the world or OS catalog. Injection requires the
  current Worker revision and calls the existing canonical
  `registerLabOsRelease` transaction to register the installable release
  and its corresponding future `os_release` world announcement together.
- The AI Lab desktop panel exposes seed/family controls, a bounded preview
  (display name, build, hardware requirements and changelog), and explicit
  injection. Stale previews are disabled when the Worker revision changes.
- A unit Worker contract test proves repeatable previews, non-mutating reads,
  atomic world+catalog update, stale-revision rejection, malformed controls
  and OS/world snapshot survival in a new cold Worker. The real Chromium
  gate exercises the same preview/commit/save/cold-load user workflow.

This is offline OS authoring only. AI-provider-backed OS generation, character
authoring, provider benchmarks and the default route cutover remain pending.
Single Worker ownership, explicit save/load and the independent #177
population gate are still prerequisites before PR #204 can leave Draft.

## P3.28 — Governed newcomer creation in the canonical Worker

The Developer Character Lab now runs the existing deterministic
`CharacterDirector.generateNewcomer` template path against the sole
Worker-owned Social roster. This is executable Gameplay integration rather
than another independent React simulation:

- Typed `labCharacter` Preview/Inject controls allow a bounded seed,
  four genuine meeting sources (MyPlace, NightBoard, Pulse room, work), and
  a known archetype or random. The Worker rejects caller-provided actor
  state and invalid, stale or out-of-scope requests. The browser only gets
  an 8-field bounded identity/introduction preview; no actor schedule,
  private memory, relationship graph, traits or domain state leaks.
- Preview reads the canonical roster/handles and does not create an actor,
  relationship or Pulse message. Injection regenerates the same approved
  definition in the Worker and routes through the canonical
  `SOCIAL_ADD_BUDDY` action. The existing Social owner registers identity,
  first-meeting memory and introductory Pulse message in one trusted path.
  No direct mutation is performed from React.
- Online-source newcomers retain their remote identity and do not inherit
  a local town place; work newcomers remain local. This reuses the existing
  CharacterDirector source rule and will share the canonical ReachPolicy
  once separate #181 lands, without modifying #181's branch here.
- `expectedRevision` invalidates old previews after any world change,
  and save/restore retains generated identities. Headless Worker tests cover
  repeatable no-mutation preview, exact registration, remote/local
  semantics, bounded response, stale rejection, forged controls and cold
  restore. Chromium verifies preview, confirmed registration and cold
  slot load with zero main-thread engine.

Still deferred: AI/provider-backed generation and provider benchmarking;
moving the ordinary `/` production route from legacy to the Worker,
combined #177 population fixture and final full-route acceptance. PR #204
remains Draft and #175 OPEN until the requested end-to-end cutover.

## P3.29 — Opt-in Worker boot from the actual game root

The standard `index.html` no longer statically imports the legacy
`App`, synchronous `useSimulationStore` or its eager default
`SimulationEngine`. It uses an explicitly selected, mutually-exclusive
dynamic import in `src/main.tsx`:

- `/?runtime=worker`: boot the *same* canonical WorkerGameShell previously
  available only on `/worker.html`; no legacy engine/store is requested
  or instantiated on this page. Browser controls, Phaser, Orion OS, canonical
  save/restore, crash handling and bounded reads use the normal Worker path.
- `/?runtime=legacy` or plain `/`: use the pre-existing legacy UI and
  behavior while visual/content parity and the #177 scale gate are completed.
  The legacy debug globals are installed **only** in this branch.
- Any other runtime value is refused explicitly without starting either
  engine. A Worker startup failure cannot fall back to synchronous
  `SimulationEngine`.
- The Worker entry menu now offers an actual **Continue last save**, sourced
  exclusively from small IndexedDB slot summaries, never by constructing a
  main-thread engine or reading a full world snapshot. Explicit Load game,
  Save As, and fail-closed recovery still remain available.

The Worker browser gate now exercises the real **root URL**, proves no
legacy module request or test global in Worker mode, saves and reloads
with `Continue last save`, and checks invalid selectors fail closed.
This is **an opt-in release rehearsal, not the final default production
cutover**: plain `/` deliberately stays legacy until the authored shell
replaces the developer vertical slice and integration/#177 gates are green.

## P3.30 — Cross-runtime saved-world migration and intentional UI handoff

The classic MainMenu offers **Try Dedicated Worker Preview** as an explicit,
full-document navigation to `/?runtime=worker`. The Worker menu offers
**Return to classic interface** only when there is no active game session.
Both directions reload the document, so the old live engine or Dedicated
Worker cannot stay running alongside the new mode. Neither path implicitly
saves unsaved world changes; the UI reminds players to save first.

The browser gate now proves the **same canonical v6 slot** travels from
the old main-thread game to the Worker, advances there, is saved from its
Worker owner, then cold-loads in the legacy UI. The test verifies minute
continuity and the Worker route has no legacy engine globals; it separately
checks a Worker session is explicitly torn down before returning to the
classic menu. This is not a promise of backward compatibility for older
unsupported save versions, nor final default cutover to Worker gameplay.

Keep plain `/` on classic until the Worker presentation reaches authored
game parity, and #177 combined deterministic 20/100/250/500 benchmarks
are run on the same final head. No automatic fallback between live engines.

## P3.33 — Atomic play-screen projection (pending exact-head verification)

The live Worker UI now requests a single `gameView` query at boot and on
revision publication, rather than three separate `hud`, `world` and
`playerStatus` RPCs. The Worker FIFO computes only those three already
allowlisted projections in one turn and stamps the shared revision; it does
not export the full world. This eliminates clock-tick interleaving between
the three reads and reduces play-screen read-message overhead.

Unit acceptance covers source revision equality, absence of `getState()`
snapshot reads, headless time progression, one query per session refresh,
stale generation disposal and fail-closed malformed bundle rejection.

This is an intermediate performance/consistency milestone, not the plain
`/` default-Worker cutover or the #177 combined 20/100/250/500 stress gate.
Do not close #175 on this change alone.

## P3.34 — Factual Worker café guest and authored venue

A Worker-serializable `cafeGuest` read resolves the authored café venue
inside the Worker and asks the canonical Kernel for a player-known actor
who is physically present at that venue. Only a bounded
`{ revision, placeId, guest: null | { actorId, displayName } }` crosses IPC.
The UI clears stale guests on revision changes instead of confusing online
status with physical presence.

The Worker city café now renders the same authored Phaser place projection
as Classic and can perform its ordinary coffee outing via the existing
canonical `PLAYER_CITY_OUTING` receipt (time and money stay Worker-owned).
This intentionally does not pretend that full in-person chat or the new
Ink/Narrative flow is already migrated. Those remain parity requirements,
as do the ordinary root cutover and final combined population gate.

The same integration commit incorporates main's upstream NarrativeCoordinator
and Ink authoring work without touching the separate narrative agent branch.

## P3.35 — Worker-authored in-person Ink café dialogue (pending exact-head gate)

The player can talk with an actual player-known NPC physically present in
Starlight Café. The renderer sends only `startCafe`, a visible choice index,
or `end` through a typed `cafeNarrative` RPC—never an NPC identity, venue
ID, effect payload, full world snapshot or AI provider call.

The sole Worker uses `SimulationNarrativeAdapter` and the existing compiled
`cafe_meeting` Ink flow. Before starting and **before every subsequent
choice** it verifies that the player is at the café and the **same** actor is
still present in the authored venue. Social effects remain committed by
`SimulationKernel`. A departed guest/player ends the Worker narrative
session and prevents delayed choices from applying effects.

Active dialogue is deliberately ephemeral across a cold snapshot load for
this stage: the canonical world and relationship changes persist, but
in-progress Ink cursor persistence needs a separate final parity gate.
This adds authored offline conversation to the Worker, not generic
free-form AI chat, and does not yet authorize the plain `/` cutover.

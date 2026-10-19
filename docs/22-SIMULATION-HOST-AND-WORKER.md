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
`?runtime=worker` entry, verifies no legacy `__simEngine/__simStore`,
executes New → pause → advance → save → menu → load, and checks
unreadable-save refusal without a shadow world.

**Remaining #175 before merge:** the ordinary gameplay entry `/`,
all legacy Zustand store conveniences, Pulse/desktop and Phaser authored
rendering must move onto the new bounded host and command ports. Then
switch the default route to this runtime and delete the eager local owner.
Prove autosave, cold history, restart, failure UX and 20/100/250/500
NPC scale using normal gameplay before review/merge. The opt-in slice is
an executable staging surface, not a completed production cutover.

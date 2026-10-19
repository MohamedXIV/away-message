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

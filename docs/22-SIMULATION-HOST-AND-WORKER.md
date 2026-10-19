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

# Simulation Kernel & Runtime Boundary

Status: **Canonical pre-Education refactor direction**

Date: 2026-10-11

Tracking epic: #168

Execution roadmap: `docs/superpowers/plans/2026-10-11-simulation-kernel-refactor-roadmap.md`

## Purpose

Refactor Away Message's simulation runtime before Senior Year / Education expansion so the game can scale to a materially larger life-sim population without coupling canonical simulation work to render FPS, whole-world snapshot cloning, or the historical `SimulationEngine` inheritance stack.

This is a bounded architecture phase. It is not a rewrite of the product, Phaser renderer, React OS, or existing good domain logic.

The user explicitly approved this refactor as a priority even though the previous Production Phase A guidance said not to default to another engine-foundation phase. Production Phase A remains valid work; this document records the newer explicit decision that the simulation runtime should be strengthened before adding the larger school/university life layer.

---

## 1. Live-code findings that triggered the refactor

The decision is based on inspection of current `main`, not only prior design discussion.

### 1.1 Simulation orchestration has grown into an inheritance stack

Current structure:

```text
SimulationEngineCore.ts
~2669 lines / ~134 KB
        ↑
SimulationEngineLegacyFacade.ts
~1403 lines / ~51 KB
        ↑
SimulationEngine.ts
~1135 lines / ~39 KB
```

Together these represent roughly 5200 lines of simulation orchestration/compatibility behavior spread across three inherited layers.

The historical layering is understandable: each generation preserved previous behavior while adding new canonical authorities. It is no longer a good growth shape for Education, larger populations, or a worker boundary.

### 1.2 Population-wide work is tied to requestAnimationFrame

`src/store/useSimulationStore.ts` drives realtime simulation from `requestAnimationFrame`.

`GameClock.tickRealTime()` may legitimately advance zero whole game minutes on most frames. However the current legacy facade still runs:

- `advanceAllNpcPressuresToNow()`;
- `progressNpcMobility()`;

after every `advanceRealTime()` call.

`progressNpcMobility()` rebuilds current intents across the known buddy population before planning/progressing trips.

This means render frequency currently causes repeated population-wide simulation reads even when authoritative simulation time has not moved.

This must be fixed before population expansion.

### 1.3 State publication is broader than UI/runtime consumers need

The current engine subscription path builds broad simulation state and the Zustand listener then calls `getState()` again instead of consuming the already-published state.

State assembly includes large social structures and later facade layers add further physical, mobility, spatial, scenario, residence and other roots.

This is acceptable at current small scale but is a poor long-run contract for:
- hundreds of actors;
- long chat history;
- school terms and years;
- worker message passing.

### 1.4 SocialEngine contains too many responsibilities

`src/engine/SocialEngine.ts` is roughly 1600 lines with about 60 public methods.

It currently owns or coordinates:
- roster;
- player relationship dimensions;
- NPC↔NPC bonds;
- romance;
- presence;
- conversations;
- memories;
- promises;
- agenda;
- mediations;
- affinities;
- player reads;
- lifecycle state.

The sparse NPC bond representation is a good property and must be preserved. The problem is responsibility concentration and snapshot breadth, not the social model itself.

### 1.5 Conversation history is currently hot simulation state

`SocialEngine.getState()` materializes complete conversation arrays together with relationship and other simulation state.

A Senior Year / University-scale game may accumulate tens of thousands of messages over long saves. Full historical transcripts should not be cloned merely because world time or unrelated state changed.

### 1.6 Persistence still carries development-era layers

The current live save API is `src/persistence/slots.ts`, while historical layers remain in the repository:
- v5/v6 facades;
- migration shells;
- legacy multi-table `SaveManager`;
- multiple historical state tables/aliases.

Repository policy explicitly states that historical development saves are disposable until a future save-compatibility freeze. This is the correct time to simplify current-format persistence rather than preserving obsolete architecture indefinitely.

### 1.7 Canonical IDs are not uniformly deterministic

Some social records still use wall-clock/random values such as `Date.now()` and `Math.random()` for IDs.

This does not make normal gameplay invalid, but it weakens deterministic replay/headless simulation and makes future multi-target simulation testing harder.

---

## 2. What is already good and should be preserved

This phase is not a blanket rewrite.

### Life Matrix

`src/engine/life/Obligations.ts` and `Intent.ts` already express a good separation:
- source-backed obligations;
- deterministic semantic intent;
- no route execution;
- no wage/relationship consequence ownership;
- no renderer authority.

Education should later extend this model rather than create a separate student brain.

### Transit / NPC mobility

`src/engine/transit/NpcTrips.ts` is already largely pure, deterministic and source-backed. Its problem is how often the surrounding engine asks it to recompute, not its basic ownership model.

### Spatial truth

Canonical actor XYZ and deterministic containment are already separate from authored view placement and activity intent. Keep this separation.

### Residence / physical world

Residence/Tenancy and concrete physical item/location rules are suitable foundations for a student/young-adult life sim.

### Phaser presentation

The current presentation boundary is good:
- `PhysicalWorldBoundary`;
- `PhaserWorldRuntime`;
- `LivingPlaceRuntime`;
- `presentationAdapter`;
- actor presentation tiers.

Phaser remains presentation, not canonical world truth.

---

## 3. Target architecture

```text
React / DOM / Orion OS
Phaser 4 / CharacterRenderer / Audio
                │
                ▼
        SimulationClient
                │
                ▼
         SimulationHost
                │
       browser: Dedicated Worker
                │
                ▼
        SimulationKernel
          (composition)
           ├─ Clock
           ├─ EventScheduler
           ├─ Finance
           ├─ PlayerNeeds
           ├─ Mood
           ├─ Life
           ├─ Social
           ├─ Transit / Mobility
           ├─ Spatial
           ├─ Residence
           ├─ Physical World
           ├─ Environment / Events
           └─ Scenario
```

The canonical simulation has one writer.

Presentation may subscribe to bounded projections and semantic change notifications, but React/Phaser never become state authorities.

---

## 4. Simulation timing law

Render FPS is presentation only.

Bad:

```text
60 FPS
→ 60 population-wide life/mobility evaluations per second
```

Target:

```text
RAF
→ visuals only

authoritative game-minute/event boundary
→ simulation advances

next relevant boundary
→ scheduler wakes relevant systems
```

A simple minute-boundary scheduler is acceptable first. A future event queue may skip directly between relevant boundaries where semantics allow.

Do not optimize by spreading canonical state across many workers. Deterministic single-writer ownership is more valuable than speculative parallelism.

---

## 5. State publication law

Normal runtime consumers should not receive the entire persistent universe for every mutation.

Target publication shape:

```text
mutation
  ↓
revision
  ↓
changed domains / semantic events
  ↓
bounded projections
```

Examples:
- Clock/Player HUD projection;
- current Place projection;
- selected actor projection;
- messenger conversation summary/page;
- town/transit projection;
- residence projection;
- environment projection.

A full snapshot remains an explicit persistence/debug/export operation.

---

## 6. Social and conversation direction

Preserve one canonical social truth while decomposing implementation responsibilities.

Possible responsibility split:

```text
Social domain
├─ CharacterRegistry
├─ PlayerRelationships
├─ NpcRelationshipGraph
├─ Romance
├─ Presence
├─ ConversationStore
├─ SocialMemory / Promises
└─ Mediation / PlayerRead support
```

Exact filenames are not architectural law.

### Hot vs historical chat

Hot simulation state should contain only what active rules need, for example:
- last activity minute;
- unread count;
- recent semantic context;
- latest message summary;
- relationship consequences already committed.

Full transcripts, photos and attachments should live in paged persistence and be loaded by the messenger UI as needed.

---

## 7. Persistence direction

Before save freeze:
- preserve current-format safety;
- reject/reset incompatible development saves cleanly;
- remove obsolete migration/runtime shims when no longer useful;
- prefer one current save document contract;
- do not invest in preserving every historical development format.

Deterministic record identity should use world-owned sequence/seed/time identity where useful instead of wall-clock/random generation.

After a future explicit save-compatibility freeze, this freedom ends and migrations become mandatory.

---

## 8. Worker boundary

The browser target should gain a stable `SimulationHost` contract before Rust is considered production architecture.

Conceptual contract:

```ts
interface SimulationHost {
  dispatch(command: SimulationCommand): Promise<CommandResult>;
  query<T extends SimulationQuery>(query: T): Promise<QueryResult<T>>;
  subscribe(listener: (change: SimulationChange) => void): () => void;
  save(): Promise<SimulationSnapshot>;
  load(snapshot: SimulationSnapshot): Promise<void>;
}
```

Browser implementation:

```text
SimulationClient
  ↓
Dedicated Worker
  ↓
TypeScript SimulationKernel
```

React, Phaser, character rendering and audio remain on the main thread.

Start with ordinary structured message passing. Do not require `SharedArrayBuffer` or multi-worker coordination.

---

## 9. Rust decision

Rust is an implementation option behind `SimulationHost`, not a design requirement.

Do not port the current engine wholesale before fixing scheduling and publication architecture.

Decision sequence:

```text
clean TS kernel
→ Worker-hosted TS
→ repeat scale benchmarks
→ Rust/WASM/native spike
→ measured decision
```

Possible final decisions are all acceptable:
1. stay TypeScript Worker;
2. use Rust/WASM only for selected heavy pure subsystems;
3. progressively migrate canonical simulation core to Rust;
4. keep Rust only for future native/Tauri/headless tooling.

If later shipped through Tauri, the same host contract may map to native Rust while browser uses Worker/WASM or TS. Tauri is not required for this refactor.

---

## 10. Education readiness

This refactor is intentionally before Senior Year.

Education should later plug into generic scheduling/obligation infrastructure:

```text
Obligation / Scheduled Event
├─ work shift
├─ class
├─ exam
├─ appointment
├─ club meeting
├─ assignment deadline
└─ social commitment
```

The refactor gate may use tiny class/exam-like fixtures to prove scheduler generality, but it must not build school content.

---

## 11. Execution order

Tracked under #168:

1. #169 — capture scaling/snapshot baseline;
2. #170 — remove full-population work from RAF;
3. #171 — replace engine inheritance with composition;
4. #172 — revisions + bounded projections;
5. #173 — split SocialEngine / cold conversation history;
6. #174 — simplify persistence + deterministic identity;
7. #175 — SimulationHost + Dedicated Worker;
8. #176 — Rust/WASM/native benchmark spike and decision;
9. #177 — school-ready integration gate.

Some P1 work may overlap after P0 invariants are pinned, but avoid competing changes to the same engine shell without an explicit dependency plan.

---

## 12. Non-goals

This phase does not:
- replace Phaser;
- replace React/DOM;
- move to Unity or Godot;
- create a realtime 3D/open world;
- introduce a city navmesh;
- build the Senior Year itself;
- distribute simulation state across many workers;
- make AI a simulation authority;
- require Rust;
- declare save compatibility frozen.

---

## 13. Exit condition

This phase is complete when:
- zero-minute RAF frames do not perform full-population simulation planning;
- representative 20/100/250/500 NPC benchmark fixtures exist before and after;
- canonical orchestration is composition-first;
- UI/renderers consume bounded serializable projections;
- historical chat is not normal hot-world snapshot baggage;
- current persistence is simplified under pre-freeze policy;
- browser simulation runs through a Dedicated Worker and stable `SimulationHost`;
- deterministic/current-format tests remain green;
- Rust adoption/rejection is explicitly recorded from measurements;
- a tiny generic education-like scheduling fixture proves the runtime is ready for Senior Year without adding a separate school engine.

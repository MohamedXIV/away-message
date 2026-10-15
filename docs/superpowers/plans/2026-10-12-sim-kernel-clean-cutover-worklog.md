# #171 — Clean Simulation Kernel Cutover Worklog

Status: **PRODUCTION CUTOVER IMPLEMENTED — final exact-head verification and benchmark acceptance pending. PR #192 remains DRAFT.**

Decision: `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md`

Starting baseline: `main@1ea59b8b506cf851d9e334cda7701872c384ae3d`.

This document is a wiring and retirement ledger, not an alternative architecture. Every item here must either be completed and removed from the list or explicitly justified before #171 is merged.

## 1. Inherited executor retirement (2026-10-15)

The entire `SimulationEngineCore → SimulationEngineLegacyFacade → SimulationEngine` executable inheritance chain has been **deleted** from this unmerged branch.

| Old production path | Final disposition |
| --- | --- |
| `src/engine/SimulationEngineCore.ts` | **Deleted**. Core domain coordination is now an independent `kernel/CoreSimulationRuntime.ts` using one `CoreDomainOwners` graph. |
| `src/engine/SimulationEngineLegacyFacade.ts` | **Deleted**. NPC Life, mobility, spatial XYZ, encounters and computer inventory are now one independent `kernel/NpcComputerSimulationRuntime.ts`. |
| Inherited `src/engine/SimulationEngine.ts` | **Replaced**, not renamed: 10-line export-only public compatibility alias to `kernel/SimulationKernel.ts`. No constructor, inheritance, writer or fallback execution is left in the public file. |
| Physical/world upper-layer overrides | Replaced by `kernel/PhysicalSimulationRuntime.ts`, composed directly by the kernel alongside Core and NPC runtimes. |
| Legacy `exportFullSnapshot` | **Deleted** as a parallel old-format export; `exportSnapshot/loadSnapshot` now use the one current-format kernel contract. |

There are no executable inherited simulation base classes on this branch. Historical migration entries below document how the replacement was reached, not surviving production dependencies.

## 2. State authority table (target owners)

| Truth | Sole owner, not a second copy | Consumers |
| --- | --- | --- |
| Clock / minute / day | GameClock and kernel scheduler | Life, Social presence, apps, snapshots |
| Finance / player needs / mood | Finance / Needs / Mood | GameContext, daily obligations, UI |
| Social roster / relationships / remote reach | Social domain | Life Matrix, Pulse, Scenario, UI |
| NPC goals/pressure | Life state owner | Intent/Obligations, projections |
| NPC trips | NPC mobility state owner with pure NpcTrips | Spatial, encounter, transit UI |
| Actor XYZ | spatial-position owner | place/co-location, Phaser projection |
| Residence / owned physical items | Residence and physical-world owners | room/shops/deliveries |
| World events / environment | WorldEvents / Environment | narrative predicates, Life, OS |
| Scenario instances/hook lifecycle | ScenarioDirector | narrative / UI |
| Inner Voice cooldown/history | InnerVoiceEngine | presentation requests |
| Hardware / OS / software / VFS / downloads | existing respective owners | desktop apps, inventory, persistence |

These are *logical owner boundaries*. No `SimulationKernel` mega-file should clone their mutable state.

## 3. Production consumer cutover and call graph

```text
React components / OrionOS / Pulse / terminal / Phaser presentation
  ↕
src/store/useSimulationStore.ts (Zustand, public SimulationEngine alias)
  ├─ ticker → advanceRealTime
  ├─ typed actions → dispatchAction / explicit public APIs
  ├─ subscribed state → subscribe / getState
  └─ persistence/slots.ts → exportSnapshot / loadSnapshot
                        ↓
             kernel/SimulationKernel
             SINGLE command/time/load/publication boundary
               ├─ CoreSimulationRuntime
               │  ├─ CoreDomainOwners (one Clock/EventBus/Economy/Needs/Mood/
               │  │  Hardware/OS/Social/World/VFS/Software/etc.)
               │  ├─ TimeAdvancement
               │  └─ PlayerActionRuntime + existing domain policy coordinators
               ├─ NpcComputerSimulationRuntime
               │  ├─ ComputerOwnershipRuntime (one Inventory)
               │  ├─ NpcLifeRuntime (one goals/pressure)
               │  ├─ NpcMovementRuntime (one trips/XYZ)
               │  └─ EncounterRuntime (one cooldown/history)
               └─ PhysicalSimulationRuntime
                  ├─ ResidenceCoordination
                  ├─ MaterialWorldRuntime
                  ├─ PhysicalShopSessionRuntime / PhysicalGroceryFulfillment
                  ├─ ActiveTravelRuntime / VenueOperationsRuntime
                  └─ StoryExperienceRuntime (Scenario / Inner Voice)

tools/benchmark-simulation.ts → benchmark/SimulationBenchmarkFixture.ts
  → same public alias → same composed SimulationKernel
```

- [x] React/Zustand, OS/terminal and Phaser consumers still resolve the public `SimulationEngine` symbol to **the actual composed kernel**, with no inherited fallback or consumer-owned clock.
- [x] Ticker and explicit time actions converge on `TimeAdvancement` and a single canonical GameClock. NPC pressure/mobility work is scheduled only when a minute changes (#170).
- [x] Player/social/desktop/world/PC command routers delegate to canonical domain owners; retired OS upgrade command remains rejected.
- [x] One current-format `exportSnapshot/loadSnapshot` coordinate Core → software → NPC → physical/venue/travel/story hydration.
- [x] Core projection no longer writes hardware/OS metadata during reads. Mood reconciliation moved to write-time publication.
- [x] Time notifications are deferred until NPC minutes settle; subscribers receive the completed transaction, not an intermediate time state.
- [x] Historical public import alias is strictly an export rewire; no mutable store, executable engine superclass or fallback.
- [x] Benchmark fixtures, tests and save-slot consumers use the same public kernel construction path.

## 4. Implementation progress — unmerged canonical branch

- [x] `src/engine/kernel/CoreDomainOwners.ts`: explicit single shared domain-owner graph for the 18 current Core authorities, with no separate mutable world.
- [x] The old `SimulationEngineCore` constructor now temporarily delegates domain construction to that graph.
- [x] `src/engine/kernel/TimeAdvancement.ts`: composed time coordinator for zero-minute RAF gating, realtime and jump ordering, minute-boundary domain work, and daily event publication. No second clock or tick owner.
- [x] The legacy Core realtime/jump methods now delegate to the coordinator. Its authored MyPlace announcement callback remains in the old social orchestration until that owner is extracted; realtime and jump behavior remain intentionally distinct.
- [x] `src/engine/kernel/CoreStateProjection.ts`: Core-compatible read state projection assembled from the single domain graph. It does not persist or own an independent snapshot; the old cache remains until #172 bounded state publication.
- [x] `JobBoardCoordination.ts`: uses World-owned application flags and appointments, Social messages, Needs eligibility, deterministic delayed replies.
- [x] `GroceryDeliveryCoordination.ts`: uses Economy/pantry, DeliveryEngine courier orders and existing time advancement; no duplicate settlement.
- [x] `MyPlaceSocialCycle.ts`: owns the Top 8/guestbook daily policy over the canonical Social/MyPlace/World owners.
- [x] `AppointmentCoordination.ts`: the complete meeting lifecycle — parse/RSVP, scheduling, attendance, climate excuses, social consequences and wages — is no longer implemented inside the inherited Core.
- [x] `RentCoordination.ts`: daily reminder/overdue trail and payment messaging over the single Economy/World/Social owners.
- [x] `SocialPresenceCycle.ts`: owns polite offline leave lines and the one-per-day solitude recharge using the existing needs and Social state.
- [x] `RelationshipContinuity.ts`: moves sharp relationship escalation, witnessed affinity changes, due promises and distant returns to one cohesive Social/World policy.
- [x] Focused tests for all of the modules above, in addition to `CoreDomainOwners.test.ts` and `TimeAdvancement.test.ts`: test single-authority behavior, idempotence, current-format hydration, zero-minute rule, job timing, delivery settlements, MyPlace and relationship lifecycle.
- [x] **Verified implementation head:** `456d4785a7cf37bf530bf33bba76e4c1b3c50a0a`, GitHub Actions [Verify run 38283813813](https://github.com/MohamedXIV/away-message/actions/runs/38283813813) **SUCCESS**. Generated content, typecheck, build, full baseline guard, **237/237 files and 1,521/1,521 tests**, plus Browser living-world smoke all passed.
- [x] **NPC Life owner replacement:** `kernel/NpcLifeRuntime.ts` now owns NPC pressure/goals and all Life Matrix/intent/obligation reads. LegacyFacade's `npcLivesCache` field, hydration and population pass implementation were removed; wrappers use the single composed owner. Test: `NpcLifeRuntime.test.ts`.
- [x] **NPC mobility + spatial owner replacement:** `kernel/NpcMovementRuntime.ts` owns trip commitments, planned/departed/arrived progression, NPC place cache, actor XYZ, spatial transition emission and state hydration. Removed inherited `npcMobility` and `actorSpatialPositions` fields. Test: `NpcMovementRuntime.test.ts`.
- [x] **Encounter decision owner replacement:** `kernel/EncounterRuntime.ts` owns cooldown/one-shot encounter marks with explicit read-only access to NPC Life/Mobility/Social/World; `encounterDirector` no longer lives in the inherited façade. Test: `EncounterRuntime.test.ts`.
- [x] **#170 scheduling regression migrated to the composed owners:** `SimulationRealtimeScheduling.test.ts` now spies `NpcLifeRuntime.advanceAllNpcPressuresToNow` and `NpcMovementRuntime.progressNpcMobility` on the actual engine graph instead of deleted LegacyFacade private method names; no weakening of assertions about zero-minute population passes.
- [x] **Latest exact-code-head verification:** `d12ef635ccf85f577df3423cbc433f29871ede4c`, GitHub Actions [Verify run 38390902639](https://github.com/MohamedXIV/away-message/actions/runs/38390902639) **SUCCESS**: content check, typecheck, build, baseline guard, **240/240 test files, 1,529/1,529 tests**, and browser living-world smoke all pass.
- [x] **PC/Inventory ownership extraction:** `kernel/ComputerOwnershipRuntime.ts` now owns the sole `InventoryEngine` instance, coordinating owned hardware installation, device power, media insert/eject, OS preflight/install, PC setup and shop purchases over the existing Hardware/OS/Economy authorities. LegacyFacade's public `inventory` points to that **same instance**; old PC command implementations were removed. `ComputerOwnershipRuntime.test.ts` checks single-owner identity, save/load and no mutation on rejected transactions.
- [x] **Verified PC/Inventory implementation head:** `acc9db6142980ecdab43f4d22583d85fa0beb54c`, [Verify 38399873546](https://github.com/MohamedXIV/away-message/actions/runs/38399873546) **SUCCESS**: content check, typecheck, build, baseline guard, **241/241 files, 1,532/1,532 tests**, Browser living-world smoke.
- [x] **Authored Scenario + Inner Voice lifecycle extraction:** `kernel/StoryExperienceRuntime.ts` constructs the sole `ScenarioDirector` and presentation-only `InnerVoiceEngine`, selecting generated authored scenarios **only for true new saves** and hydrating exactly persisted scenario bindings/voice history on reload. The top-level inherited executor now delegates public APIs; no duplicated Scenario/InnerVoice state. Test: `StoryExperienceRuntime.test.ts`.
- [x] **Latest exact-code-head verification:** `a0bed17154b1ccab13933de77435dea7cda74251`, [Verify 38400667994](https://github.com/MohamedXIV/away-message/actions/runs/38400667994) **SUCCESS**: content check, typecheck, build, baseline guard, **242/242 files, 1,535/1,535 tests**, Browser living-world smoke.
- [x] **Residence/tenancy ownership:** `kernel/ResidenceCoordination.ts` now owns the canonical `ResidenceTenancy` and housing offer/move-in logic. It calls the material owner to reanchor owned items when changing homes and never owns a second Economy/clock. `ResidenceCoordination.test.ts` covers a unique current offer, save/load, fallback and rejected purchases.
- [x] **Venue activities ownership:** `kernel/VenueOperationsRuntime.ts` owns venue role assignments and activity instances, with explicit reads of spatial position, physical context and character intent. It advances from the same canonical time events. `VenueOperationsRuntime.test.ts` covers single owner, snapshot hydration and service reads.
- [x] **Active journey ownership:** `kernel/ActiveTravelRuntime.ts` owns a single committed trip; elapsed legs, player wait/bus encounter windows, fare payment and spatial arrival are coordinated via injected canonical owners. `ActiveTravelRuntime.test.ts` covers defensive reads, arrival idempotence and save/load identity.
- [x] **Material-world state ownership:** `kernel/MaterialWorldRuntime.ts` owns authoritative physical items, containers and object placements, inventory-to-residence anchoring and physical object/item transactions. Public `SimulationEngine` reads/commands temporarily delegate to this owner. Shop transactions use its canonical item state via an ephemeral `PhysicalItemEngine`; there is no independent duplicate store. `MaterialWorldRuntime.test.ts` covers defensive state projection, reload and idempotent reanchoring.
- [x] **Latest verified implementation head:** `2456786d2a45e6ade26762818e268757e04e7ca2`, [Verify 38415419553](https://github.com/MohamedXIV/away-message/actions/runs/38415419553) **SUCCESS**, generated content, TS typecheck, build, baseline guard, **246/246 test files, 1,549/1,549 tests**, and Browser living-world smoke PASS.
- [x] **Physical shop session authority and checkout decoupling:** `kernel/PhysicalShopSessionRuntime.ts` now owns persisted `PhysicalShopState` for all stores; item identities/locations are written only by `MaterialWorldRuntime`. The top-level engine no longer retains `physicalShopStates`. `PhysicalShopCheckout.ts` no longer imports `SimulationEngine`; its `PhysicalShopCashPort` exposes only `canAfford` and `spendCash`, preserving canonical Economy/command debit and validating the entire exact quote before cash changes. Tests: existing `PhysicalShopEngine.test.ts` updated for narrow cash port + rejected debit, and `PhysicalShopSessionRuntime.test.ts` for one state owner, paid/unpaid single-settlement and saves.
- [x] **Physical grocery fulfillment extraction:** `kernel/PhysicalGroceryFulfillment.ts` handles authored delivery target resolution, materializing one physical courier parcel via DeliveryEngine arrival callback, and physical pickup bags over canonical Economy/Needs/Delivery/World/Material owners. Delivery transactions still delegate into the same existing `GroceryDeliveryCoordination`; no duplicate courier queue/pantry/clock. Tests: `PhysicalGroceryFulfillment.test.ts` plus existing `PhysicalDeliveryIntegration.test.ts`.
- [x] **Shop exact-head verification:** `5cc91f0d2364441ea16d85f1c2fd2a0d203c049e`, GitHub Actions [Verify 38416943448](https://github.com/MohamedXIV/away-message/actions/runs/38416943448) **SUCCESS**: content/typecheck/build/baseline guard, **247/247 test files, 1,554/1,554 tests**, browser living-world smoke.
- [x] **Latest physical-fulfillment exact-head verification:** `efeb90593fa393c750ca82a7509e58288abd203d`, GitHub Actions [Verify 38417976805](https://github.com/MohamedXIV/away-message/actions/runs/38417976805) **SUCCESS**: content/typecheck/build/baseline guard, **248/248 test files, 1,556/1,556 tests**, browser living-world smoke.
- [x] **Completed in final cutover:** Core player city/contact/OS/Social command coordination; independent Core/NPC/Physical composition; one state/subscribe/load/export boundary; inherited executors deleted. Final exact-head benchmark/CI evidence is recorded separately below.
- [x] **NPC day policy ownership:** `kernel/NpcSocialLifeCycle.ts` now owns NPC agenda fills, seeded run-ins, NPC/NPC romance progress, mediation requests and backstory re-introductions. These are policy passes over canonical `SocialEngine`/World/clock/telemetry only, invoked from the existing authoritative day-change event. `NpcSocialLifeCycle.test.ts` covers owner reachability, deterministic social outcomes and non-duplicated agendas.
- [x] **MyPlace authored/realtime side effects moved:** `kernel/MyPlaceSocialCycle.ts` now also owns the daily profile-update announcement, realtime-only UI event/co-comment policy, initial/newcomer profile stubs and guestbook interactions. Existing `MyPlaceP5.test.ts` was rewired to target the actual domain owner; `MyPlaceSocialCycle.test.ts` now covers newcomer profiles.
- [x] **Bounded procedural orchestration moved:** `kernel/ProceduralWorldCycle.ts` owns the async generation pending/day gates and deterministic auto-discovery policy. It writes only to canonical `WorldEventsEngine` and invokes the original `SOCIAL_ADD_BUDDY` action via callback, no parallel roster/events.
- [x] **Current exact product-code verification:** `5f6ecd1ea3047a450db7b06740ab2be3ed83dfb3`, GitHub Actions [Verify #38431078397](https://github.com/MohamedXIV/away-message/actions/runs/38431078397) **SUCCESS**: content, typecheck, build, baseline guard, **249/249 files and 1,560/1,560 tests**, Browser living-world smoke. Earlier intermediate red runs were removed unused imports and one old test referencing a removed private Core method; both fixed before this verified head.
- [x] **Core line reduction in this batch:** relative to the previously verified physical fulfillment head `efeb9059`, `SimulationEngineCore.ts` changed by 26 additions and 430 deletions (net 404 lines removed), while substantive behavior moved to the above cohesive owners. This is **not** completion of inheritance removal.
- [x] **Player contact/battery command policy extracted:** `kernel/PlayerContactCoordination.ts` now owns social contact-by-handle discovery, NightBoard meet (through the existing one `SOCIAL_ADD_BUDDY` dispatch), player message battery gate and reception hints over canonical Social/Needs/World. Core only forwards public reception and dispatch cases. Test: `PlayerContactCoordination.test.ts`.
- [x] **City travel/outing policy extracted:** `kernel/CityActivityCoordination.ts` owns deterministic city travel, walk/bus cost, weather/fatigue/location gates, local outings and role-bound street encounters. Room/work location checks call its single reusable location rule. Economy, Needs, Social, World and clock remain authoritative. Test: `CityActivityCoordination.test.ts`.
- [x] **Desktop command ownership extracted:** `kernel/DesktopStorageCommands.ts` dispatches the existing download, VFS/trash and software-install/uninstall actions through the canonical DownloadManager, FileSystemEngine, SoftwareRegistry and World rent flag. No additional file tree/download task queue/install inventory. Test: `DesktopStorageCommands.test.ts`.
- [x] **Social and World command families extracted:** `kernel/SocialInteractionCommands.ts` routes messages, social actions, mediation, contact, registration and removal to the existing SocialEngine and policy coordinators. `kernel/WorldNarrativeCommands.ts` routes World flags/events/appointments plus obsolete narrative aliases to the one WorldEventsEngine/shared EventBus. No additional social graph, timeline or appointments. Tests: `SocialInteractionCommands.test.ts`, `WorldNarrativeCommands.test.ts`.
- [x] **Current exact product-code verification:** `c099991510f759643f6121b7b0371809010f3909`, GitHub Actions [Verify #38443058170](https://github.com/MohamedXIV/away-message/actions/runs/38443058170) **SUCCESS** — generated content check, TypeScript, build, baseline guard, **254/254 test files and 1,574/1,574 tests**, and Browser living-world smoke PASS. The first staging CI run found references to removed `SimulationEngine.requireLocation` and a test roster-count type assumption; both corrected before this exact-head run.
- [x] **Core source reduction:** `SimulationEngineCore.ts` is ~915 lines after this code head (from ~1,546 at the start of this command migration batch). This is **not** proof of no-inheritance cutover; the inherited Core constructor, dispatcher for remaining player/hardware commands, event handlers and state/save/subscribe methods still execute.
- [ ] **Atomic runtime cutover still open:** remaining Core player/time/economy/hardware command cases, daily event/roster/OS bootstrap, LegacyFacade transport dispatch/state/load shims, upper-layer state/export/load and subscriptions. Construct one independent composed production kernel, prove UI/Phaser/OS call graph, eliminate Core/LegacyFacade/Engine inheritance executors, clean read-side hardware OS mirroring, rerun all correctness/saves/determinism/performance benchmarks. **Do not merge the intermediate hybrid.**

### Known migration-era coupling to remove before #171 merges

- `SimulationEngineCore` is still an inherited executable class; **temporary on this Draft branch only**.
- `CoreStateProjection` currently retains the old hardware.osVersion compatibility mirror mutation to reproduce existing reads. Move this to an explicit OS/hardware synchronization write boundary before final cutover; do not treat it as a semantic pure projection forever.
- The authored profile updates, realtime message emission, guestbook co-comments and newcomer profile stubs have now moved to `MyPlaceSocialCycle`; keep the existing realtime-only presentation behavior in the final kernel and ensure it is invoked only from one authoritative time boundary.
- `getState()` still rebuilds broad Core shape and inherited upper layers; #171 must replace the super-call state layering before merging, while #172 later narrows publication.
- `#170` invariant must remain true after the inherited LegacyFacade time overrides are removed.

### Why this intermediate form is acceptable only on the branch

The old Core/LegacyFacade/Engine still orchestrate much of the runtime after the newly extracted stages. **The code does not yet satisfy the accepted ADR.** It must remain an open DRAFT PR until their live implementations have been retired and exact-head verification has passed. Do not merge this slice on its own.

## 5. No-hybrid merge proof required

Before marking the eventual #171 PR ready:

1. All production constructor/dispatch/time/read/subscribe/save/load entrypoints point to one composed implementation.
2. The old `SimulationEngineCore` and `SimulationEngineLegacyFacade` live implementations are removed, not just renamed.
3. Any retained `SimulationEngine.ts` import alias is a stateless forwarding-only entrypoint.
4. A source/consumer call-graph audit shows no production reachability of any old engine executor.
5. Contract tests cover state authority, #170 minute gating, deterministic time chunking, reach, NPC trip/position, Scenario, current save round trip and offline.
6. Exact-head content check/typecheck/build/full tests/baseline guards have recorded results.
7. 20/100/250/500 actor benchmarks are compared against #169/#170, with interpretation separating zero-minute and minute-advancement costs.

If any requirement fails, keep the PR in Draft and #171 open. Do not call it finished.


## 5. Final #171 evidence and acceptance ledger (2026-10-15)

**Implementation:** `kernel/SimulationKernel.ts` is the only executable public simulation root. `PlayerActionRuntime` replaces the 265-line inherited player dispatcher and coordinates domain-specific handlers without storing state. The Core, NPC/Computer and Physical coordinators compose **one shared Core-domain owner graph** and own non-overlapping explicit responsibility slices. The public alias `src/engine/SimulationEngine.ts` is export-only. The two inherited implementation files are absent.

**Single-writer protection:** `CoreDomainOwners` creates exactly one clock, event bus, Social, Economy, Needs, Mood, Hardware, OS, World, etc. `NpcComputerSimulationRuntime` owns the single inventory, NPC Life, trip/XYZ and encounter instances. `PhysicalSimulationRuntime` owns the single material/item and shop session state, housing, active travel, venue activities and authored narrative. The root holds no duplicate mutable entity registries and only coordinates construction, queries, time, dispatch, subscriptions and snapshot hydration. `getState()` does not publish Mood/OS writes; the explicit publication boundary reconciles Mood.

**Scheduling and publication:** only an actual changed authoritative minute runs population pressure/mobility. A public time/command transaction buffers subscriber publication until the NPC minute boundary settles; no population pass or unnecessary publication occurs on zero-minute RAF frames. Existing `TimeAdvancement` domain event ordering remains unchanged.

**Save semantics:** the old parallel v1 `exportFullSnapshot` path is removed; the one current-format `exportSnapshot/loadSnapshot` round-trip includes hardware/OS, inventory, NPC goals/mobility/XYZ/encounters, physical items/shops, housing, transit, venues, Scenario instances and Inner Voice without save-time Scenario rerolls.

**Verified milestone before the final clean-up:** implementation head `880485847edbb9dbd34dbfb066d13dca1ab77668` had [Verify 38699348508](https://github.com/MohamedXIV/away-message/actions/runs/38699348508) **SUCCESS**: content, TypeScript, build, baseline guard, **255/255 files and 1,578/1,578 tests**, Browser living-world smoke. Final exact-head verification is still required after later read/publication and retirement clean-up.

**Measured #171 intermediate performance:** [Verify 38699863052](https://github.com/MohamedXIV/away-message/actions/runs/38699863052) succeeded on code head `644236d07d23d740405695a0b77ea41695065862`. Linux, Node 22.23.3, AMD EPYC 7763, 4 CPUs, 7 samples / 2 warmups; values below are *measured medians in milliseconds*, not performance thresholds:

| Actors | Zero-minute RAF | +1 min | +60 min | Cold getState | Repeated getState | exportSnapshot |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 0.010 | 2.973 | 2.076 | 0.384 | 0.068 | 1.194 |
| 100 | 0.010 | 15.260 | 16.796 | 0.800 | 0.108 | 5.236 |
| 250 | 0.012 | 59.126 | 57.336 | 1.504 | 0.166 | 13.000 |
| 500 | 0.011 | 194.101 | 200.143 | 6.468 | 0.349 | 27.299 |

The #170 post-RAF-gate reference was **0.009 ms zero-minute median at 500 actors**, versus **84.569 ms** before #170. The new 0.011 ms intermediate #171 median preserves the no-population-work property, guarded by deterministic tests rather than fragile timing thresholds. #169/#170 used a different VM CPU (AMD EPYC 9V74); wall-clock medians cannot establish an apples-to-apples minute-advance speedup. Repeated full-state reads are notably slower than the older 0.011 ms cached reference; this is explicitly recorded as follow-on **#172 bounded projections**, not disguised as a #171 improvement. No arbitrary acceptance threshold has been invented for minute advancement.

**Outstanding before PR #192 Ready or merge:**
- [ ] A final **exact-code-head** successful Verify run after the latest atomic publication, pure state reads and retirement changes, including benchmark 20/100/250/500 and Browser living-world smoke.
- [ ] Record benchmark SHA and final measured medians on the verified code head (the intermediate report's embedded `GITHUB_SHA` was inconsistent with exact checkout; a dedicated `SIM_BENCH_HEAD_SHA` provenance input was added).
- [ ] Confirm no unresolved PR review threads or merge conflicts and no canonical branch changes.
- [ ] Mark Ready/merge/close #171 **only if** these evidence gates pass; do not treat a green intermediate milestone as final acceptance.

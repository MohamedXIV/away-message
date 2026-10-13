# #171 — Clean Simulation Kernel Cutover Worklog

Status: **IN PROGRESS — implementation branch only, NOT merge-ready**

Decision: `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md`

Starting baseline: `main@1ea59b8b506cf851d9e334cda7701872c384ae3d`.

This document is a wiring and retirement ledger, not an alternative architecture. Every item here must either be completed and removed from the list or explicitly justified before #171 is merged.

## 1. Live inheritance reality

| Live implementation | Responsibility today | Required disposition |
| --- | --- | --- |
| `src/engine/SimulationEngineCore.ts` | event bus + 18 core domain owners, daily coordination, story/social glue, clock/tick, commands, broad state, snapshot | Extract domain composition and cohesive coordinators; **delete the inherited runtime** |
| `src/engine/SimulationEngineLegacyFacade.ts` | **Now transitional:** 408-line legacy executor delegating PC/Inventory, NPC Life, trips/XYZ and Encounter to composed owners; still owns layered state/dispatch/load adapters | Cut over production routing and **delete the inherited runtime**, not rename it |
| `src/engine/SimulationEngine.ts` | **Now transitional:** all upper-layer physical state owners, physical-shop sessions and physical grocery fulfillment are composed; inherited class mainly retains forwarding, delivery-port callbacks, layered state/export/load and event wiring | Replace layered inherited execution, move wiring to final composed kernel and delete this runtime; public alias must be stateless forwarding only |

Existing pure domains such as `life/Intent.ts`, `life/Obligations.ts`, `transit/NpcTrips.ts`, `spatial/`, `residence/` and `scenario/` are candidates for direct reuse.

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

## 3. Production path inventory

**Update 2026-10-13:** NPC Life, Mobility/Spatial, Encounter, PC Inventory, Residence, Venue, Active Travel, Material World, physical-shop sessions, physical grocery fulfillment, authored Scenario and Inner Voice now have composed owners. Public APIs still traverse inherited Core/LegacyFacade/Engine on this **unmerged** branch; production wiring and inheritance retirement are NOT complete.

- [ ] **Construction and startup:** React `src/store/useSimulationStore.ts` creates one `SimulationEngine`; persistence/fixtures may create more independent game sessions, not duplicate authorities in one game.
- [ ] **Time:** `advanceRealTime` / `advanceGameMinutes` and time events must advance each canonical domain once and preserve #170 zero-minute gating.
- [ ] **Commands:** `dispatchAction` currently resides in `SimulationEngineCore`; public PC/physical/venue/travel commands are spread across upper layers. Route through one coherent command owner/API.
- [ ] **Reads:** `getState` is assembled/augmented in all three layers; remove super-call-based state layering, retain correct current-format projection/export semantics until #172.
- [ ] **Subscriptions:** `subscribe` and `notifySubscribers` live in Core and are read via Zustand; avoid a second event bus/snapshot publisher.
- [ ] **Persistence:** three `exportSnapshot`/`loadSnapshot` layers must become one coordinated current-format save/load path, not independent authority snapshots.
- [ ] **Social & Life:** lifecycle, NPC Life Matrix, relationships, presence and remote reach must preserve their existing meaning.
- [ ] **Mobility & spatial:** actor place/XYZ, transit and encounters must remain single-writer and deterministic.
- [ ] **Housing/physical/venue:** physical world, residence and active travel must not be re-created by separate engine instances.
- [ ] **Scenario/Inner Voice:** persisted Scenario instances and InnerVoice state must round-trip and be governed by existing owners.
- [ ] **Presentation/Ink/UI:** existing direct engine call sites must all be routed to new APIs, with no old executor fallback.

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
- [ ] **Still needed:** remaining Core Character Lives/daily gameplay/dispatch; unified **no-inheritance** command/time/read/subscribe/save/load API and consumer migration; deletion of Core/LegacyFacade/Engine inherited implementations; proof of no shadow publication/writer and exact-final-head 20/100/250/500 actor benchmarks.
- [ ] **Atomic runtime cutover still open:** Core's remaining large daily/dispatch handlers; LegacyFacade transport dispatch/state/load shims; upper-layer dispatch delegation and three-level state/export/load/subscriptions; single coordinated runtime construction and complete UI/Phaser/OS consumer call graph. **All three inherited runtime implementations must be deleted/retired** before merge, regardless of green intermediate tests.

### Known migration-era coupling to remove before #171 merges

- `SimulationEngineCore` is still an inherited executable class; **temporary on this Draft branch only**.
- `CoreStateProjection` currently retains the old hardware.osVersion compatibility mirror mutation to reproduce existing reads. Move this to an explicit OS/hardware synchronization write boundary before final cutover; do not treat it as a semantic pure projection forever.
- Existing daily MyPlace callback still lives in Core and invokes social authorship/render events. Extract an owned Social/day coordinator rather than importing named content seed identity into the core time scheduler.
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

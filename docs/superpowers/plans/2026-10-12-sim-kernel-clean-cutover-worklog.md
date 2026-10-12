# #171 — Clean Simulation Kernel Cutover Worklog

Status: **IN PROGRESS — implementation branch only, NOT merge-ready**

Decision: `docs/18-SIMULATION-CLEAN-REPLACEMENT-DECISION.md`

Starting baseline: `main@1ea59b8b506cf851d9e334cda7701872c384ae3d`.

This document is a wiring and retirement ledger, not an alternative architecture. Every item here must either be completed and removed from the list or explicitly justified before #171 is merged.

## 1. Live inheritance reality

| Live implementation | Responsibility today | Required disposition |
| --- | --- | --- |
| `src/engine/SimulationEngineCore.ts` | event bus + 18 core domain owners, daily coordination, story/social glue, clock/tick, commands, broad state, snapshot | Extract domain composition and cohesive coordinators; **delete the inherited runtime** |
| `src/engine/SimulationEngineLegacyFacade.ts` | inventory/PC, Life Matrix, NPC mobility, spatial presence, encounter state and transport compatibility | Move owners/queries and mutation orchestration into composed domain services; **delete the inherited runtime** |
| `src/engine/SimulationEngine.ts` | physical world, residence/tenancy, venue, active travel, Scenario, Inner Voice, public UI API | Replace with clean composed orchestration; a forwarding-only public import alias may remain **only** if it has no independent state/behavior |

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

## 4. First implemented code slice on this branch

- [x] `src/engine/kernel/CoreDomainOwners.ts`: composition root constructing each of the 18 existing core authorities **once**, with explicit dependencies/shared EventBus and no own mutable shadow world.
- [x] `SimulationEngineCore` constructor temporarily delegates owner construction to this factory; historical orchestration still exists **only on the unmerged branch**.
- [x] `tests/unit/CoreDomainOwners.test.ts`: construction, current snapshot hydration and identity-of-domain-owners checks.
- [ ] Exact-head focused/full tests — no executable repository environment currently connected in this ChatGPT session. Do not claim PASS.
- [ ] Subsequent extraction/cutover and deletion of all old inherited engine runtime.

### Why this intermediate form is acceptable only on the branch

The old Core/LegacyFacade/Engine still orchestrate runtime calls at this stage, so **the code is not complete by the accepted ADR**. It must remain an open DRAFT PR until their live implementations have been retired and verified. Do not create a second live SimulationKernel alongside them, and do not merge this slice on its own.

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

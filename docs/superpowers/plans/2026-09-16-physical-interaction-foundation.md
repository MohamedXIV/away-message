# #86 Physical Interaction Foundation Implementation Plan

**Goal:** Replace the superseded residence/place capability-bag implementation in PR #90 with the approved three-layer physical-interaction model while preserving dynamic Residence/Tenancy `home` authority.

**Architecture:** Residence/Tenancy chooses the current home `Place`. Genuine location-wide behavior remains explicit Place/service policy. Direct actions are object affordances. Multi-source actions use a pure contextual requirement resolver over accessible items, containers, tool capabilities, and resources. Static authored placements prove the graph in #86; scalable visual authoring and player-facing moving stay in #87/#88.

**Tech stack:** TypeScript, generated JSON content pipeline, Vitest, existing `PhysicalItemEngine`, `SimulationEngine`, GitHub Actions.

---

## Task 1: RED — define the authored physical-object contract

**Files:**
- Modify: `tests/unit/worldFixtures.ts`
- Modify: `tests/unit/WorldAnchors.test.ts`
- Modify: `tests/unit/WorldItemsSchema.test.ts` or add focused tests beside existing world-content tests

**Test first:** Add a minimal authored fixture proving:
- a Place has a genuine service policy (`canReceiveDelivery`);
- an Anchor is a placement slot accepting a practical category/tag;
- a Desk object can install in that anchor and expose a nested `work_surface` slot;
- a Computer can install in that nested slot and expose direct affordances (`use`, `inspect`);
- a Kettle-like provider can expose a semantic tool capability (`heat_water`);
- invalid target slots / incompatible placement are rejected.

**RED verification:** push only tests/fixtures and confirm CI/focused tests fail because schema/codegen/runtime definitions do not exist yet.

## Task 2: GREEN — extend content schema/codegen minimally

**Files:**
- Modify: `src/tools/content/schema.ts`
- Modify: `src/tools/content/codegen.ts`
- Modify: `content/store.json`
- Regenerate: `src/engine/worldContent.generated.ts`

**Implementation:** Add the smallest practical content shapes needed by Task 1:
- optional Place service-policy data;
- Anchor placement acceptance metadata;
- object definitions with direct affordances, optional child slots, tool capabilities/resources, optional container definition link;
- authored installed-object placements that target either an Anchor or a specific parent placement's child slot.

Validate referential integrity and placement compatibility deterministically. Keep object identity, affordance identity, and tool-capability identity separate. Do not add residence `canX` fields.

**GREEN verification:** focused world-content/schema tests pass; `content:check` has no generated drift.

## Task 3: RED/GREEN — pure physical interaction resolver

**Files:**
- Create: `src/engine/physical/PhysicalInteractionResolver.ts`
- Create: `tests/unit/PhysicalInteractionResolver.test.ts`

**RED tests:** prove:
1. current Place traversal returns installed object instances including nested children;
2. direct affordances come from the concrete accessible object and disappear when that object is absent from the graph;
3. a composed requirement can combine an item in player scope with a local `heat_water` provider and water resource;
4. the same item requirement can be satisfied from an accessible local container scope;
5. `allOf` / `anyOf` behave deterministically;
6. missing requirements fail without inventing Place capabilities.

**GREEN implementation:** pure functions/types only; no Residence knowledge inside the resolver. Context is virtual and does not mutate item ownership/location.

## Task 4: migrate #86 consumers away from the old capability-bag seam

**Files:**
- Modify: `src/engine/residence/ResidenceAuthority.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Modify: `tests/unit/ResidenceTenancy.test.ts`
- Modify: `tests/unit/ResidenceDelivery.test.ts`
- Update focused hardware/home tests as necessary

**TDD:**
- Keep Residence tests about current-home/tenancy authority only.
- Delete/replace assertions for `currentResidenceHasCapability` / `resolvePlaceCapabilityAnchor`.
- Delivery test: current home Place must allow delivery by service policy and resolve an explicit concrete target; no policy/target means defer/fail, no pantry fallback.
- Direct sleep/hygiene/computer paths must not be guarded by Residence `canX`; where legacy global actions remain, adapt them to resolve/target a concrete object affordance rather than a Place capability.
- Remove the stale `meal`-through-Residence-capability test. Recipe proof belongs to the contextual resolver.

## Task 5: remove obsolete pre-release compatibility residue

**Files:**
- Modify: `content/store.json`
- Regenerate: `src/engine/worldContent.generated.ts`
- Update tests that intentionally asserted obsolete aliases.

Remove permanent historical `home` alias metadata and any #86-only compatibility helpers that exist solely for pre-freeze dev saves.

## Task 6: exact-head verification and PR audit

Run/inspect on the exact head:
1. `npm run content:check`
2. `npx tsc --noEmit`
3. `npm run build`
4. `node scripts/verify-vitest-baseline.mjs --self-test`
5. `node scripts/verify-vitest-baseline.mjs`
6. focused #86/world/physical tests
7. full `npm run test`
8. GitHub exact-head CI/statuses + PR diff/review threads

Keep PR #90 Draft until all revised #86 acceptance criteria are satisfied. Merge only when exact-head verification is green and no old Place/Residence capability-bag authority remains.
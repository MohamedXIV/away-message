# Life Matrix Continuity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the completed Life Matrix slices compose end to end with Away's existing social, appointment/job, transit, presence, world-event, and persistence authorities without introducing a second authority.

**Architecture:** #48 is an integration gate, not a new engine. Add one integration suite that drives the real `SimulationEngine` facade and reads existing `getLifeSnapshot`, `getCharacterObligations`, `getCharacterIntent`, NPC mobility, #45 presence projection, WorldEvents modifiers, and original owner APIs. Production changes are allowed only when a RED exposes a real integration defect; any such fix stays in the owning subsystem rather than adding a `LifeMatrixEngine` or duplicated ledger.

**Tech Stack:** TypeScript, Vitest, existing `SimulationEngine`, Life Matrix read models, TransitNetwork/NPC mobility, SocialEngine, WorldEventsEngine, DeliveryEngine.

**Spec:** GitHub issue #48 (`[GATE] Prove Life Matrix character continuity end to end without authority duplication`) plus the merged Life Matrix contracts from #41/#42/#43/#44/#45/#46 and mobility contracts from #35/#37.

## Global Constraints

- Start from canonical `main@99be286b2cfa52dc090ea7c0da96f05329696a99`; re-check/reconcile if `main` advances before merge.
- Use a dynamic/local actor selected from the current roster; do not hard-code a Maya-only path.
- Existing SocialEngine identity, relationship, bond, memory, promise, and messenger truth remains canonical.
- Appointment/job/world-event/transit owners remain canonical; Life Matrix only projects/selects intent.
- No second relationship graph, appointment/job/event/delivery ledger, route calculator, renderer location truth, or AI-owned canonical intent/consequence.
- No save-format change unless a real defect requires it; if one is required, add deterministic old-save migration coverage.
- Do not touch `src/tooling/away-puppet/**` (#34 worker) or the Muse branch repairing `WorldScenes.test.ts` baseline failures.
- Every behavior correction follows strict RED → GREEN and exact-head verification.

---

### Task 1: Canonical actor → obligation → intent → departure → transit → presence

**Files:**
- Create: `tests/integration/LifeMatrixContinuityGate.test.ts`
- Modify production only if the failing integration test proves a defect in an existing owner.

**Interfaces:**
- Consumes: `SimulationEngine`, `getLifeSnapshot(actorId)`, `getCharacterObligations(actorId)`, `getCharacterIntent(actorId)`, `getNpcTrip(actorId)`, `getNpcPlaceState(actorId)`, `resolveCharacterPresenceFromSimulation(...)`.
- Produces: an end-to-end proof that one unchanged actor identity moves from local origin → planned departure → in-transit → arrival while its source-backed appointment and SocialEngine history remain owned by their original systems.

- [ ] **Step 1: Write the failing integration test**

Create a fixture from `new SimulationEngine({ npcMobility: { trips: {}, places: { [actorId]: 'place_a1' } } })`, where `actorId` is the first buddy whose `reach !== 'remote'`. Add SocialEngine history (promise plus one NPC bond action), then create a confirmed appointment at `place_b1` through `sim.world.scheduleAppointment(...)` far enough ahead for #37 planning.

Assert before clock movement:

```ts
const life = sim.getLifeSnapshot(actorId);
const obligations = sim.getCharacterObligations(actorId);
const intentA = sim.getCharacterIntent(actorId);
const intentB = sim.getCharacterIntent(actorId);

expect(intentB).toEqual(intentA);
expect(obligations).toContainEqual(expect.objectContaining({
  sourceKind: 'appointment',
  sourceId: appointment.id,
  actorId,
  destinationPlaceId: 'place_b1',
}));
expect(life?.promises).toContainEqual(expect.objectContaining({ id: promise.id }));
expect(life?.notableNpcBonds).toContainEqual(expect.objectContaining({ targetId: peerId }));
```

Advance one planning tick, capture the planned trip, advance to its departure, and assert:

```ts
expect(sim.getNpcPlaceState(actorId).status).toBe('in_transit');
const presence = resolveCharacterPresenceFromSimulation(sim, actorId, {
  playerPlaceId: 'place_a1',
  messagingDeviceContext: 'home_pc',
});
expect(presence?.physical.kind).toBe('in_transit');
expect(presence?.communication.status).not.toBe('online_active');
expect(presence?.availability.canInteractInPerson).toBe(false);
```

Verify the appointment is still `confirmed` and relationship/promise history is unchanged by planning/travel.

- [ ] **Step 2: Run the focused test and classify RED**

Run:

```bash
npx vitest run tests/integration/LifeMatrixContinuityGate.test.ts
```

Expected: either PASS using existing contracts, or FAIL at a concrete integration seam. If it passes immediately, the gate has proven this slice and no production code should be added. If it fails, record the exact owner responsible before changing code.

- [ ] **Step 3: Fix only a proven owner defect**

If RED exists, patch the smallest owning subsystem. Examples of allowed fixes:
- mobility progression if a due planned trip fails to commit;
- presence adapter if canonical transit/device truth is not projected;
- obligation/intent projection if provenance is lost.

Do **not** add a coordinator that copies these states.

- [ ] **Step 4: Re-run focused test to GREEN**

Run the same Vitest command and require no unexpected failures.

- [ ] **Step 5: Commit**

Commit the test and any minimal owner fix with a message scoped to `#48`.

---

### Task 2: Arrival, owner-owned outcome, and no authority duplication

**Files:**
- Modify: `tests/integration/LifeMatrixContinuityGate.test.ts`
- Production only if a RED proves an existing owner integration defect.

**Interfaces:**
- Consumes: trip `expectedArrivalMinute`, `WorldEventsEngine.updateAppointment`/appointment owner state, SocialEngine relationship/promise reads, Life Matrix obligation projection.
- Produces: proof that mobility stops at arrival and never commits social/appointment/economy consequences; original owner state changes are then reflected by projections without duplicate state.

- [ ] **Step 1: Add the failing owner-boundary test**

Continue a fresh canonical fixture through arrival. Before owner resolution assert:

```ts
expect(sim.getNpcTrip(actorId)?.status).toBe('arrived');
expect(sim.getNpcPlaceState(actorId)).toEqual({ status: 'at_place', placeId: 'place_b1' });
expect(sim.world.getAppointments().find(a => a.id === appointment.id)?.status).toBe('confirmed');
expect(sim.social.getRelationships(actorId)).toEqual(relationshipsBefore);
expect(sim.economy.getState().cash).toBe(cashBefore);
```

Then resolve through the appointment owner only:

```ts
sim.world.updateAppointment(appointment.id, { status: 'happened' });
expect(sim.getCharacterObligations(actorId)
  .find(o => o.sourceId === appointment.id)?.status).toBe('satisfied');
```

Assert no `obligations`, `intent`, or `presence` ledger appears in the persisted snapshot JSON.

- [ ] **Step 2: Run focused test and classify any RED**

Run the single integration file. A failure must name which original owner or projection is inconsistent.

- [ ] **Step 3: Apply minimal owner/projection correction only if required**

No new consequence engine, no Life Matrix relationship writes, no copied appointment outcome state.

- [ ] **Step 4: Re-run to GREEN and commit**

Require focused GREEN before proceeding.

---

### Task 3: Real WorldEvent modifier → real owner, with knowledge kept separate

**Files:**
- Modify: `tests/integration/LifeMatrixContinuityGate.test.ts`
- Production only if existing #46 consumer wiring is defective.

**Interfaces:**
- Consumes: `sim.world.triggerEventById('city_canal_festival', atMinute)`, `sim.world.queryActiveModifiers`, `sim.placeGroceryOrder`, `DeliveryEngine` canonical `readyMinute`, `deliveryEtaMinutes`.
- Produces: proof that a real event changes a real owning domain without WorldEvents/Life Matrix owning the resulting delivery ETA.

- [ ] **Step 1: Add a real consumer test**

Trigger `city_canal_festival` at the current authoritative minute, capture buddy knowledge before the query/order, and place a delivery through `SimulationEngine.placeGroceryOrder(...)`.

For the created order, assert its owner-created `readyMinute` contains the bounded 360-minute festival backlog:

```ts
const order = sim.delivery.getState().orders.find(o => o.id === result.data?.orderId)!;
expect(order.readyMinute - order.placedMinute - deliveryEtaMinutes(order.id)).toBe(360);
```

Also assert:
- the active delivery modifier has `sourceEventId === 'city_canal_festival'`;
- buddy knowledge is unchanged by modifier projection/consumption;
- the event state does not contain copied delivery order state;
- the order remains owned by `DeliveryEngine`.

- [ ] **Step 2: Run focused RED/GREEN**

Run only the gate file. If existing #46 wiring already passes, keep test-only proof. If it fails, patch only the existing WorldEvents→Delivery owner seam.

- [ ] **Step 3: Commit**

Commit the integration proof (and minimal fix only if required).

---

### Task 4: Save/reload mid-transit and large-jump equivalence across projections

**Files:**
- Modify: `tests/integration/LifeMatrixContinuityGate.test.ts`

**Interfaces:**
- Consumes: `exportSnapshot`, `new SimulationEngine(snapshot)`, NPC mobility, obligations, intent, #45 presence, event modifier projections.
- Produces: cross-system persistence/equivalence proof without persisted projections.

- [ ] **Step 1: Add save/reload mid-transit test**

Create the canonical actor/appointment fixture, depart, move one minute into active transit, export a snapshot, and construct a reloaded engine.

Assert at the same authoritative minute:

```ts
expect(reloaded.getNpcTrip(actorId)).toEqual(sim.getNpcTrip(actorId));
expect(reloaded.getCharacterObligations(actorId)).toEqual(sim.getCharacterObligations(actorId));
expect(reloaded.getCharacterIntent(actorId)).toEqual(sim.getCharacterIntent(actorId));
expect(resolveCharacterPresenceFromSimulation(reloaded, actorId, opts))
  .toEqual(resolveCharacterPresenceFromSimulation(sim, actorId, opts));
```

Assert snapshot JSON still contains no derived `obligations`, `characterIntent`, or coherent-presence ledger.

- [ ] **Step 2: Add large-jump vs incremental equivalence test**

Create two identical fresh fixtures. Advance one in a single interval that crosses planning/departure/arrival; advance the other minute-by-minute through the same interval. Compare:
- clock minute;
- NPC trip/place state;
- projected obligations;
- projected intent;
- projected presence;
- source appointment status;
- relevant SocialEngine relationship/promise state.

- [ ] **Step 3: Run focused test, fix only proven defects, re-run GREEN**

No changes merely to make snapshots byte-identical if the existing simulation contract intentionally contains unrelated ephemeral fields; compare the canonical/projected states named above.

- [ ] **Step 4: Commit**

Commit the persistence/equivalence gate.

---

### Task 5: Regression retention, audit, and exact-head gate

**Files:**
- Modify: `docs/superpowers/plans/2026-09-12-life-matrix-continuity-gate.md` only if implementation findings require factual notes.
- No production changes unless review finds a real defect.

**Interfaces:**
- Consumes: existing relationship, Character Lives, appointment, jobs, event, persistence, transit, presence suites.
- Produces: merge-ready #48 evidence.

- [ ] **Step 1: Run focused regression suites**

```bash
npx vitest run \
  tests/integration/LifeMatrixContinuityGate.test.ts \
  tests/integration/LifeMatrixCompatibility.test.ts \
  tests/integration/NpcMobilityContinuity.test.ts \
  tests/integration/TransitPersistence.test.ts \
  tests/unit/CharacterIntent.test.ts \
  tests/unit/CharacterPresence.test.ts \
  tests/unit/WorldEventModifiers.test.ts \
  tests/unit/AppointmentsP5.test.ts \
  tests/unit/RelationshipsP3.test.ts \
  tests/unit/CharacterLives.test.ts
```

- [ ] **Step 2: Audit persisted authority boundaries**

Review the final diff and the canonical snapshot assertions. Reject any introduced `LifeMatrixEngine`, duplicate relationship graph, obligation ledger, intent ledger, route calculator, or presence ledger.

- [ ] **Step 3: Run repository-standard exact-head gates**

```bash
npm run content:check
npx tsc --noEmit
npm run build
node scripts/verify-vitest-baseline.mjs --self-test
node scripts/verify-vitest-baseline.mjs
```

If Muse's WorldScenes baseline repair has merged meanwhile, rebase/merge current `main` first and use the updated repository baseline rather than preserving obsolete known failures.

- [ ] **Step 4: Final review**

Check PR diff, open review threads/comments, current `main`, and exact CI head. Fix every concrete review finding with RED → GREEN before merge.

- [ ] **Step 5: Merge and close #48**

Merge only when the exact final head is fully verified and current `main` has not introduced an unresolved conflict. The PR body must summarize which requirements were proven by existing architecture versus which defects (if any) required fixes.

import { describe, expect, it } from 'vitest';
import { deliveryEtaMinutes } from '../../src/engine/DeliveryEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { resolveCharacterPresenceFromSimulation } from '../../src/engine/life';

function firstLocalActor(sim: SimulationEngine): string {
  const actor = sim.social.getBuddies().find((buddy) => buddy.reach !== 'remote');
  if (!actor) throw new Error('Expected at least one local Away character.');
  return actor.id;
}

function engineAtPlaceA(): { sim: SimulationEngine; actorId: string; peerId: string } {
  const probe = new SimulationEngine();
  const actorId = firstLocalActor(probe);
  const peer = probe.social.getBuddies().find((buddy) => buddy.id !== actorId);
  if (!peer) throw new Error('Expected a second Away character for bond continuity.');

  const sim = new SimulationEngine({
    npcMobility: { trips: {}, places: { [actorId]: 'place_a1' } },
  });
  return { sim, actorId, peerId: peer.id };
}

function scheduleGateAppointment(sim: SimulationEngine, actorId: string, idSuffix = '') {
  const day = sim.clock.getTime().day;
  const appointment = sim.world.scheduleAppointment({
    id: `life_gate_appt_${actorId}${idSuffix}`,
    characterId: actorId,
    locationId: 'place_b1',
    targetDay: day,
    startMinute: 1080,
    endMinute: 1140,
    description: 'Life Matrix continuity gate meeting',
    status: 'confirmed',
    rsvp: 'yes',
  });
  if (!appointment) throw new Error('Expected appointment owner to record the fixture.');
  return appointment;
}

describe('Life Matrix end-to-end continuity gate (#48)', () => {
  it('keeps one actor coherent from source-backed obligation through departure and transit', () => {
    const { sim, actorId, peerId } = engineAtPlaceA();
    const day = sim.clock.getTime().day;

    const promise = sim.social.addPromise(
      actorId,
      'Bring the old magazine after the meeting.',
      day,
      day + 2,
    );
    if (!promise) throw new Error('Expected SocialEngine to record the promise.');

    const bond = sim.social.applyNpcSocialAction(actorId, peerId, 'warm_chat', day);
    if (!bond) throw new Error('Expected SocialEngine to record the NPC bond action.');

    const appointment = scheduleGateAppointment(sim, actorId);

    const relationshipBefore = sim.social.getRelationships(actorId);
    const life = sim.getLifeSnapshot(actorId);
    const obligations = sim.getCharacterObligations(actorId);
    const firstIntent = sim.getCharacterIntent(actorId);
    const secondIntent = sim.getCharacterIntent(actorId);

    expect(firstIntent).not.toBeNull();
    expect(secondIntent).toEqual(firstIntent);
    expect(obligations).toContainEqual(expect.objectContaining({
      sourceKind: 'appointment',
      sourceId: appointment.id,
      actorId,
      destinationPlaceId: 'place_b1',
    }));
    expect(life?.promises).toContainEqual(expect.objectContaining({
      id: promise.id,
      text: promise.text,
    }));
    expect(life?.notableNpcBonds).toContainEqual(expect.objectContaining({
      targetId: peerId,
      ...bond.dims,
    }));

    sim.advanceGameMinutes(60, 'life gate planning tick');
    const planned = sim.getNpcTrip(actorId);
    expect(planned).not.toBeNull();
    expect(planned?.status).toBe('planned');
    expect(planned?.sourceId).toBe(appointment.id);
    expect(sim.getNpcPlaceState(actorId)).toMatchObject({
      status: 'planned',
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
    });

    if (!planned) throw new Error('Expected #37 to plan the appointment trip.');
    sim.advanceGameMinutes(
      planned.plannedDepartureMinute - sim.clock.getTotalMinutes(),
      'life gate depart',
    );

    expect(sim.getNpcTrip(actorId)?.status).toBe('active');
    expect(sim.getNpcPlaceState(actorId).status).toBe('in_transit');

    const presence = resolveCharacterPresenceFromSimulation(sim, actorId, {
      playerPlaceId: 'place_a1',
      messagingDeviceContext: 'home_pc',
    });
    expect(presence).not.toBeNull();
    expect(presence?.actorId).toBe(actorId);
    expect(presence?.physical.kind).toBe('in_transit');
    expect(presence?.communication.status).not.toBe('online_active');
    expect(presence?.availability.canInteractInPerson).toBe(false);

    const storedAppointment = sim.world.getAppointments().find((entry) => entry.id === appointment.id);
    expect(storedAppointment?.status).toBe('confirmed');
    expect(storedAppointment?.isCompleted).toBe(false);
    expect(storedAppointment?.isMissed).toBe(false);
    expect(sim.social.getRelationships(actorId)).toEqual(relationshipBefore);
    expect(sim.social.getPromises(actorId)).toContainEqual(expect.objectContaining({
      id: promise.id,
      status: 'open',
    }));
    expect(sim.social.getNpcBond(actorId, peerId).dims).toEqual(bond.dims);
  });

  it('lets mobility arrive without committing consequences, then follows the appointment owner outcome', () => {
    const { sim, actorId } = engineAtPlaceA();
    const appointment = scheduleGateAppointment(sim, actorId, '_owner');
    const relationshipBefore = sim.social.getRelationships(actorId);
    const cashBefore = sim.economy.getState().cash;

    sim.advanceGameMinutes(60, 'life gate planning tick');
    const planned = sim.getNpcTrip(actorId);
    if (!planned) throw new Error('Expected a planned trip.');

    sim.advanceGameMinutes(
      planned.expectedArrivalMinute - sim.clock.getTotalMinutes(),
      'life gate travel to arrival',
    );

    expect(sim.getNpcTrip(actorId)?.status).toBe('arrived');
    expect(sim.getNpcPlaceState(actorId)).toEqual({
      status: 'at_place',
      placeId: 'place_b1',
    });

    const beforeOwnerDecision = sim.world.getAppointments().find((entry) => entry.id === appointment.id);
    expect(beforeOwnerDecision?.status).toBe('confirmed');
    expect(beforeOwnerDecision?.isCompleted).toBe(false);
    expect(beforeOwnerDecision?.isMissed).toBe(false);
    expect(sim.social.getRelationships(actorId)).toEqual(relationshipBefore);
    expect(sim.economy.getState().cash).toBe(cashBefore);

    const ownerResult = sim.world.updateAppointment(appointment.id, { status: 'happened' });
    expect(ownerResult).not.toBeNull();
    expect(sim.world.getAppointments().find((entry) => entry.id === appointment.id)?.status).toBe('happened');
    expect(sim.getCharacterObligations(actorId).find((obligation) => obligation.sourceId === appointment.id))
      .toMatchObject({ status: 'satisfied' });

    const persisted = JSON.stringify(sim.exportSnapshot());
    expect(persisted).not.toContain('"obligations"');
    expect(persisted).not.toContain('"characterIntent"');
    expect(persisted).not.toContain('"characterPresence"');
  });

  it('lets a real WorldEvent modifier affect DeliveryEngine without owning delivery or knowledge', () => {
    const sim = new SimulationEngine();
    const atMinute = sim.clock.getTotalMinutes();
    const triggered = sim.world.triggerEventById('city_canal_festival', atMinute);
    expect(triggered).not.toBeNull();

    const knowledgeBefore = sim.world.getBuddyKnowledgeMap();
    const modifiers = sim.world.queryActiveModifiers({ domain: 'delivery', atMinute });
    expect(modifiers).toHaveLength(1);
    expect(modifiers[0]).toMatchObject({
      sourceEventId: 'city_canal_festival',
      kind: 'courier_backlog',
      value: 360,
    });

    const orderResult = sim.placeGroceryOrder(
      [{ sku: 'noodles_cup', qty: 1 }],
      'delivery',
      atMinute,
    );
    expect(orderResult.success).toBe(true);
    if (!orderResult.data) throw new Error('Expected a delivery order result.');

    const order = sim.delivery.getState().orders.find((entry) => entry.id === orderResult.data?.orderId);
    if (!order) throw new Error('Expected DeliveryEngine to own the created order.');

    expect(order.readyMinute - order.placedMinute - deliveryEtaMinutes(order.id)).toBe(360);
    expect(sim.world.getBuddyKnowledgeMap()).toEqual(knowledgeBefore);
    expect(JSON.stringify(sim.world.getState())).not.toContain(order.id);
    expect(sim.delivery.getState().orders).toContainEqual(expect.objectContaining({
      id: order.id,
      readyMinute: order.readyMinute,
      status: 'transit',
    }));
  });
});

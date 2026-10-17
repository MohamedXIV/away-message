import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildNpcMailForDay, buildRecentNpcMail, type MailContext } from '../../src/engine/BoardDirector';

describe('#172 bounded player mailbox read', () => {
  it('matches legacy per-day mail ordering, two-per-day priority and last-ten cap without a calendar scan', () => {
    const ctx: Omit<MailContext, 'day'> = {
      buddies: ['a', 'b', 'c'].map(id => ({
        id, displayName: id.toUpperCase(), handle: id, stage: 'friend',
      })),
      sharps: [
        { buddyId: 'a', state: 'gone', stateDay: 2 },
        { buddyId: 'b', state: 'gone', stateDay: 2 },
        { buddyId: 'c', state: 'returned', stateDay: 2 },
        { buddyId: 'b', state: 'returned', stateDay: 17 },
        { buddyId: 'a', state: 'distant', stateDay: 4999 },
      ],
      meetings: [
        { buddyId: 'a', targetDay: 14, status: 'happened', npcShowed: true, playerShowed: true, locationLabel: 'the cafe' },
        { buddyId: 'c', targetDay: 17, status: 'missed', npcShowed: false, playerShowed: true, locationLabel: 'the park' },
        { buddyId: 'b', targetDay: 4998, status: 'happened', npcShowed: true, playerShowed: true, locationLabel: 'the cafe' },
      ],
    };
    const old: ReturnType<typeof buildNpcMailForDay> = [];
    for (let day = 1; day <= 5000; day++) old.push(...buildNpcMailForDay({ ...ctx, day }));
    expect(buildRecentNpcMail(ctx, 5000)).toEqual(old.slice(-10));
    expect(buildRecentNpcMail(ctx, 16)).toEqual(old.filter(mail => mail.day <= 16).slice(-10));
    expect(buildRecentNpcMail(ctx, 5000, 0)).toEqual([]);
    expect(buildRecentNpcMail(ctx, 5000, 2)).toEqual(old.slice(-2));
  });

  it('hides undiscovered NPC letters and exposes them after discovery without a broad state snapshot', () => {
    const game = new SimulationEngine();
    const seed = game.social.getBuddies()[0]!;
    const hidden = game.social.registerBuddy({
      ...seed, id: 'mailbox_hidden_actor', handle: 'mailbox_hidden_actor',
      displayName: 'HIDDEN_MAIL_SENDER', status: 'stranger', reach: 'remote',
    });
    game.world.setFlag(`sharp_${hidden.id}`, 'gone');
    game.world.setFlag(`sharp_${hidden.id}_day`, 1);
    const broad = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const roster = vi.spyOn(game.social, 'getBuddies');
    const before = game.getRevision();

    const privateRead = game.getMailboxRead();
    expect(privateRead.npcMails.every(mail => mail.buddyId !== hidden.id)).toBe(true);
    expect(JSON.stringify(privateRead)).not.toContain('HIDDEN_MAIL_SENDER');
    expect(roster).not.toHaveBeenCalled();
    expect(game.getRevision()).toBe(before);

    expect(game.social.learnHandle(hidden.id, hidden.handle)).toBe(true);
    const revealed = game.getMailboxRead();
    expect(revealed.npcMails.some(mail => mail.buddyId === hidden.id)).toBe(true);
    expect(revealed.npcMails.length).toBeLessThanOrEqual(12);
    expect(JSON.parse(JSON.stringify(revealed))).toEqual(revealed);
    expect(broad).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(roster).not.toHaveBeenCalled();
  });

  it('sends only relevant bounded courier receipt fields, never raw delivery owner internals', () => {
    const game = new SimulationEngine();
    for (let i = 0; i < 10; i++) {
      game.delivery.placeDelivery([{ sku: `parcel_${i}`, qty: 1 }], 10, 500 + i);
    }
    const source = game.delivery.getState().orders;
    const stateRead = vi.spyOn(game.delivery, 'getState');
    const all = game.getMailboxRead();
    expect(all.orders).toHaveLength(10);
    expect(all.orders[0]?.id).toBe(source[0]?.id);
    expect(JSON.stringify(all.orders)).not.toContain('deliveryTarget');
    expect(JSON.stringify(all.orders)).not.toContain('placedMinute');
    expect(JSON.stringify(all.orders)).not.toContain('"total"');
    all.orders[0]!.items[0]!.sku = 'bad actor';
    expect(stateRead).not.toHaveBeenCalled();
    stateRead.mockRestore();
    expect(game.delivery.getState().orders[0]?.items[0]?.sku).toBe('parcel_0');
  });
  it('preserves the previous mailbox sender and receipt semantics without source-wide clones', () => {
    const game = new SimulationEngine();
    const buddies = game.social.getBuddies().filter(buddy => game.social.isKnown(buddy.id));
    const expected = buddies.map(buddy => ({
      id: buddy.id, displayName: buddy.displayName, handle: buddy.handle,
      archetype: buddy.archetype, stage: game.social.getRelationshipStage(buddy.id),
      status: buddy.status, roles: buddy.roles,
    }));
    const projected = game.social.getKnownMailboxBuddies();
    expect(projected.map(({ id, displayName, handle, archetype, stage, status, roles }) => ({
      id, displayName, handle, archetype, stage, status, roles,
    }))).toEqual(expected);
    expect(game.social.getKnownMailboxBuddies(0)).toEqual([]);

    // Deliveries retain transit first, then the last three done receipts.
    for (let i = 0; i < 5; i++) {
      game.delivery.recordPickup([{ sku: `pickup_${i}`, qty: i + 1 }], 10, i);
    }
    for (let i = 0; i < 2; i++) {
      game.delivery.placeDelivery([{ sku: `courier_${i}`, qty: 1 }], 10, i + 10);
    }
    const old = game.delivery.getState().orders;
    const selected = [
      ...old.filter(order => order.status === 'transit'),
      ...old.filter(order => order.status === 'done').slice(-3),
    ].map(order => ({
      id: order.id, items: order.items.map(item => ({ sku: item.sku, qty: item.qty })),
      fulfillment: order.fulfillment, readyMinute: order.readyMinute, status: order.status,
    }));
    const rosterRead = vi.spyOn(game.social, 'getBuddies');
    const socialRead = vi.spyOn(game.social, 'getState');
    const deliveryRead = vi.spyOn(game.delivery, 'getState');
    const broad = vi.spyOn(game, 'getState');
    const view = game.getMailboxRead();
    expect(view.orders).toEqual(selected);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(JSON.stringify(view.orders)).not.toContain('deliveryTarget');
    expect(JSON.stringify(view.orders)).not.toContain('placedMinute');
    expect(rosterRead).not.toHaveBeenCalled();
    expect(socialRead).not.toHaveBeenCalled();
    expect(deliveryRead).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
    const name = projected[0];
    if (name) {
      name.displayName = 'SPOOFED';
      name.roles?.push('invented');
      const next = game.social.getKnownMailboxBuddies().find(buddy => buddy.id === name.id);
      expect(next?.displayName).not.toBe('SPOOFED');
      expect(next?.roles).not.toContain('invented');
    }
  });

});

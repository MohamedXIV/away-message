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
    expect(roster).toHaveBeenCalledTimes(1);
    expect(game.getRevision()).toBe(before);

    expect(game.social.learnHandle(hidden.id, hidden.handle)).toBe(true);
    const revealed = game.getMailboxRead();
    expect(revealed.npcMails.some(mail => mail.buddyId === hidden.id)).toBe(true);
    expect(revealed.npcMails.length).toBeLessThanOrEqual(12);
    expect(JSON.parse(JSON.stringify(revealed))).toEqual(revealed);
    expect(broad).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
  });

  it('sends only relevant bounded courier receipt fields, never raw delivery owner internals', () => {
    const game = new SimulationEngine();
    for (let i = 0; i < 10; i++) {
      game.delivery.placeDelivery([{ sku: `parcel_${i}`, qty: 1 }], 10, 500 + i);
    }
    const source = game.delivery.getState().orders;
    const all = game.getMailboxRead();
    expect(all.orders).toHaveLength(10);
    expect(all.orders[0]?.id).toBe(source[0]?.id);
    expect(JSON.stringify(all.orders)).not.toContain('deliveryTarget');
    expect(JSON.stringify(all.orders)).not.toContain('placedMinute');
    expect(JSON.stringify(all.orders)).not.toContain('"total"');
    all.orders[0]!.items[0]!.sku = 'bad actor';
    expect(game.delivery.getState().orders[0]?.items[0]?.sku).toBe('parcel_0');
  });
});

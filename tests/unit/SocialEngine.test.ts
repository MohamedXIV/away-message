import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';

describe('SocialEngine (dynamic roster, presence & hidden relationship dimensions)', () => {
  let eventBus: EventBus;
  let social: SocialEngine;
  let actorId: string;

  beforeEach(() => {
    eventBus = new EventBus();
    social = new SocialEngine(eventBus);
    actorId = social.getBuddies()[0]?.id ?? '';
  });

  it('initializes the authored seed roster through generic actor contracts', () => {
    const buddies = social.getBuddies();
    expect(buddies.length).toBeGreaterThan(0);
    expect(actorId).toBeTruthy();

    for (const buddy of buddies) {
      expect(buddy.id).toBeTruthy();
      expect(buddy.displayName).toBeTruthy();
      const rel = social.getRelationships(buddy.id);
      expect(rel).toBeDefined();
      expect(rel?.familiarity).toBeGreaterThanOrEqual(0);
      expect(rel?.trust).toBeGreaterThanOrEqual(0);
      expect(rel?.comfort).toBeGreaterThanOrEqual(0);
      expect(rel?.respect).toBeGreaterThanOrEqual(0);
      expect(rel?.annoyance).toBeGreaterThanOrEqual(0);
    }
  });

  it('updates presence for the live roster as sandbox time advances', () => {
    social.updatePresence(480);
    const morning = social.getBuddies().map((buddy) => social.getPresence(buddy.id)?.status);
    expect(morning.every((status) => ['online', 'away', 'offline'].includes(status ?? ''))).toBe(true);

    social.updatePresence(1380);
    const night = social.getBuddies().map((buddy) => social.getPresence(buddy.id)?.status);
    expect(night.every((status) => ['online', 'away', 'offline'].includes(status ?? ''))).toBe(true);
  });

  it('resolves capability roles from the live roster after seed content changes', () => {
    const seedHolder = social.getBuddyWithRole('diner-staff');
    expect(seedHolder).toBeDefined();
    if (!seedHolder) return;

    expect(social.removeBuddy(seedHolder.id)).toBe(true);

    const template = social.getBuddies()[0];
    expect(template).toBeDefined();
    if (!template) return;

    social.registerBuddy({
      ...template,
      id: 'dynamic_diner_staff',
      displayName: 'Dynamic Diner Staff',
      handle: 'dynamic_diner_staff',
      roles: ['diner-staff'],
      status: 'stranger',
      metVia: 'work',
      isProcedural: true,
      createdDay: 2,
    });

    expect(social.getBuddyWithRole('diner-staff')?.id).toBe('dynamic_diner_staff');
  });

  it('applies semantic social actions to any actor', () => {
    expect(actorId).toBeTruthy();
    const before = social.getRelationships(actorId)!;
    const updated = social.applySocialAction(actorId, 'empathy');
    expect(updated.familiarity).toBeGreaterThanOrEqual(before.familiarity);
    expect(updated.trust).toBeGreaterThanOrEqual(before.trust);

    const annoyed = social.applySocialAction(actorId, 'dismissive');
    expect(annoyed.annoyance).toBeGreaterThanOrEqual(updated.annoyance);
  });

  it('logs sent and received messages for any actor', () => {
    expect(actorId).toBeTruthy();
    let receivedEventFired = false;
    eventBus.on('social:message_received', ({ message }) => {
      receivedEventFired = true;
      expect(message.text).toBe('Hey, did you get settled in?');
    });

    const conversationId = `conv_${actorId}`;
    const msg = social.sendMessage(
      conversationId,
      actorId,
      'player',
      'Hey, did you get settled in?',
      500,
      false,
    );

    expect(msg.id).toBeDefined();
    expect(msg.isRead).toBe(false);
    expect(receivedEventFired).toBe(true);

    social.markAsRead(conversationId);
    expect(social.getMessages(conversationId)[0]?.isRead).toBe(true);
  });
});

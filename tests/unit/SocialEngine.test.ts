import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';

describe('SocialEngine (14-Day Schedules, Presence & 5 Hidden Dimensions)', () => {
  let eventBus: EventBus;
  let social: SocialEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    social = new SocialEngine(eventBus);
  });

  it('initializes all 4 key buddies with authentic baseline dimensions', () => {
    const ryan = social.getBuddy('ryan');
    const maya = social.getBuddy('maya');
    const nora = social.getBuddy('nora');
    const henderson = social.getBuddy('henderson');

    expect(ryan?.handle).toBe('ryan_foodcart');
    expect(maya?.handle).toBe('starlight_maya');
    expect(nora?.handle).toBe('NightOwl87');
    expect(henderson?.handle).toBe('motel_office');

    const mayaRels = social.getRelationships('maya');
    expect(mayaRels?.familiarity).toBe(10);
    expect(mayaRels?.trust).toBe(20);
    expect(mayaRels?.comfort).toBe(30);
    expect(mayaRels?.respect).toBe(40);
    expect(mayaRels?.annoyance).toBe(0);
  });

  it('updates buddy presence based on time of day', () => {
    // 08:00 AM on Day 1 (totalMinutes = 480)
    social.updatePresence(480);
    const hendersonPres = social.getPresence('henderson');
    expect(hendersonPres?.status).toBe('online'); // Office open 08:00 - 20:00

    // 23:00 PM on Day 1 (totalMinutes = 1380)
    social.updatePresence(1380);
    const noraPres = social.getPresence('nora');
    expect(noraPres?.status).toBe('online'); // Nora is online late night

    const hendersonNight = social.getPresence('henderson');
    expect(hendersonNight?.status).toBe('offline');
  });

  it('applies semantic social action deltas clamped to [0, 100]', () => {
    // Apply empathy action to Maya
    const updated = social.applySocialAction('maya', 'empathy');
    expect(updated.familiarity).toBe(13); // 10 + 3
    expect(updated.trust).toBe(24);       // 20 + 4
    expect(updated.comfort).toBe(35);     // 30 + 5
    expect(updated.respect).toBe(42);     // 40 + 2
    expect(updated.annoyance).toBe(0);    // clamped at 0

    // Apply dismissive action
    const annoyed = social.applySocialAction('maya', 'dismissive');
    expect(annoyed.annoyance).toBe(8);
  });

  it('logs sent and received messages with read status tracking', () => {
    let receivedEventFired = false;
    eventBus.on('social:message_received', ({ message }) => {
      receivedEventFired = true;
      expect(message.text).toBe('Hey did you get settled in?');
    });

    const msg = social.sendMessage(
      'conv_ryan',
      'ryan',
      'player',
      'Hey did you get settled in?',
      500,
      false
    );

    expect(msg.id).toBeDefined();
    expect(msg.isRead).toBe(false);
    expect(receivedEventFired).toBe(true);

    const msgs = social.getMessages('conv_ryan');
    expect(msgs.length).toBe(1);

    // Mark as read
    social.markAsRead('conv_ryan');
    const msgsAfter = social.getMessages('conv_ryan');
    expect(msgsAfter[0]?.isRead).toBe(true);
  });
});

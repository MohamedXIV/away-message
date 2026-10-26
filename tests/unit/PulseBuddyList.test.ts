import { describe, expect, it } from 'vitest';
import {
  buildPulseContactViews,
  formatPulseLastMessage,
  partitionPulseContacts,
  pulsePresenceLine,
} from '../../src/apps/pulse/components/PulseBuddyList';
import { pulseInitials } from '../../src/apps/pulse/components/PulseAvatar';
import { pulseConversationStateText } from '../../src/apps/pulse/components/PulseChatPane';

const messengerContacts = [
  { actorId: 'far', displayName: 'Far Friend', handle: 'far.friend', archetype: 'nightowl' as const,
    onlineStatus: 'offline' as const, relationshipStage: 'friend' as const, lastMessageMinute: 1500, unread: 0 },
  { actorId: 'near', displayName: 'Near Friend', handle: 'near.friend', archetype: 'coworker' as const,
    onlineStatus: 'online' as const, relationshipStage: 'acquaintance' as const, lastMessageMinute: 1445, unread: 3 },
  { actorId: 'busy', displayName: 'Busy Friend', handle: 'busy.friend', archetype: 'artist' as const,
    onlineStatus: 'busy' as const, relationshipStage: 'close' as const, lastMessageMinute: 1460, unread: 1 },
];

describe('#223 Pulse buddy list presentation', () => {
  it('uses canonical presence and sorts online buddies before offline ones', () => {
    const views = buildPulseContactViews(messengerContacts, {
      far: { status: 'offline', awayMessage: '' },
      near: { status: 'online', awayMessage: 'back online :)' },
      busy: { status: 'away', awayMessage: 'grabbing food' },
    });
    expect(views.map(view => view.actorId)).toEqual(['near', 'busy', 'far']);
    expect(views[0]).toMatchObject({
      status: 'online', awayMessage: 'back online :)', unread: 3,
    });
    const grouped = partitionPulseContacts(views);
    expect(grouped.online.map(view => view.actorId)).toEqual(['near', 'busy']);
    expect(grouped.offline.map(view => view.actorId)).toEqual(['far']);
  });

  it('separates away/busy labels from truthful last-message recency', () => {
    const [online, away, offline] = buildPulseContactViews(messengerContacts, {});
    expect(pulsePresenceLine(online!)).toBe('Online');
    expect(pulsePresenceLine(away!)).toBe('Busy');
    expect(pulsePresenceLine(offline!)).toBe('Last message Day 2, 01:00 AM');
    expect(formatPulseLastMessage(null)).toBe('');
    expect(formatPulseLastMessage(0)).toBe('Last message Day 1, 12:00 AM');
  });

  it('builds readable monograms without inventing portrait assets', () => {
    expect(pulseInitials('Near Friend')).toBe('NF');
    expect(pulseInitials('Maya')).toBe('MA');
    expect(pulseInitials('***')).toBe('?');
    expect(pulseInitials('  ')).toBe('?');
  });
});

describe('#223 Pulse conversation status', () => {
  const online = buildPulseContactViews(messengerContacts, {})[0]!;
  const offline = { ...online, status: 'offline' as const, displayName: 'Near Friend' };
  const away = { ...online, status: 'away' as const, displayName: 'Near Friend' };

  it('never claims an instant reply from an unavailable buddy', () => {
    expect(pulseConversationStateText('waiting_first', offline, false))
      .toContain('offline right now');
    expect(pulseConversationStateText('waiting_second', away, false))
      .toContain('away right now');
    expect(pulseConversationStateText('waiting_first', online, false))
      .toContain('Waiting for Near Friend to reply');
  });

  it('explains completed threads and in-flight sends', () => {
    expect(pulseConversationStateText('complete', online, false))
      .toContain('caught up');
    expect(pulseConversationStateText('first', online, true))
      .toBe('Sending your message…');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function registerUnknown(game: SimulationEngine, actorId: string) {
  const seed = game.social.getBuddies()[0]!;
  return game.social.registerBuddy({
    ...seed,
    id: actorId,
    handle: actorId,
    displayName: 'Undiscovered Contact',
    status: 'stranger',
    reach: 'remote',
  });
}

describe('#172 player-safe presence and canonical read-receipt publication', () => {
  it('projects only learned contacts and player status, preserving unknown internal presence', () => {
    const game = new SimulationEngine();
    const hidden = registerUnknown(game, 'hidden_presence_actor');
    game.social.updatePresence(game.clock.getTotalMinutes());
    game.social.setPlayerPresence({ status: 'away', awayMessage: 'Player is away' });

    const ownerAll = game.social.getPresenceSummary();
    expect(ownerAll).toHaveProperty(hidden.id);
    const ownerPresence = ownerAll[hidden.id]!;
    const full = vi.spyOn(game, 'getState');
    const socialState = vi.spyOn(game.social, 'getState');
    const before = game.getRevision();

    const safe = game.getPresenceRead();
    expect(safe.presence).not.toHaveProperty(hidden.id);
    expect(safe.presence.player?.awayMessage).toBe('Player is away');
    expect(JSON.stringify(safe)).not.toContain('hidden_presence_actor');
    expect(JSON.parse(JSON.stringify(safe))).toEqual(safe);
    expect(game.getRevision()).toBe(before);
    expect(game.social.getPresenceSummary()[hidden.id]).toEqual(ownerPresence);

    expect(game.social.learnHandle(hidden.id, hidden.handle)).toBe(true);
    const revealed = game.getPresenceRead();
    expect(revealed.presence[hidden.id]).toEqual(ownerPresence);
    revealed.presence[hidden.id]!.awayMessage = 'viewer tampering';
    expect(game.getPresenceRead().presence[hidden.id]).toEqual(ownerPresence);
    expect(full).not.toHaveBeenCalled();
    expect(socialState).not.toHaveBeenCalled();
  });

  it('publishes one social change only for a real known-contact unread receipt', () => {
    const game = new SimulationEngine();
    const hidden = registerUnknown(game, 'hidden_unread_actor');
    const visible = game.social.getBuddies()[0]!;
    expect(game.social.learnHandle(visible.id, visible.handle)).toBe(true);

    game.social.sendMessage(hidden.id, hidden.id, 'player', 'Private and unread', 500);
    game.social.sendMessage(visible.id, visible.id, 'player', 'Visible and unread', 501);
    expect(game.social.getConversationUnreadCounts()[hidden.id]).toBe(1);
    expect(game.getMessengerRead().unreadCounts[visible.id]).toBe(1);

    const broad = vi.spyOn(game, 'getState');
    const socialState = vi.spyOn(game.social, 'getState');
    const observed: Array<{ revision: number; domains: readonly string[] }> = [];
    const off = game.subscribeChanges(change => observed.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    observed.length = 0;
    const baseline = game.getRevision();

    expect(game.markConversationAsRead(hidden.id)).toBe(false);
    expect(game.getRevision()).toBe(baseline);
    expect(game.social.getConversationUnreadCounts()[hidden.id]).toBe(1);
    expect(observed).toHaveLength(0);

    expect(game.markConversationAsRead(visible.id)).toBe(true);
    expect(game.getRevision()).toBe(baseline + 1);
    expect(observed).toHaveLength(1);
    expect(observed[0]?.domains).toEqual(expect.arrayContaining(['social', 'unknown']));
    expect(game.getMessengerRead().unreadCounts[visible.id]).toBeUndefined();
    expect(game.getChromeRead().unreadPreviews.some(item => item.buddyId === visible.id)).toBe(false);

    const publishedRevision = game.getRevision();
    expect(game.markConversationAsRead(visible.id)).toBe(false);
    expect(game.markConversationAsRead('missing_contact')).toBe(false);
    expect(game.getRevision()).toBe(publishedRevision);
    expect(observed).toHaveLength(1);
    expect(broad).not.toHaveBeenCalled();
    expect(socialState).not.toHaveBeenCalled();

    off();
  });
});

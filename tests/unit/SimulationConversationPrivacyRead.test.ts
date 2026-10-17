import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 Pulse bounded player-knowledge boundary', () => {
  it('keeps undiscovered conversations and unread notifications private without altering canonical history', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies().find(buddy => !game.social.isKnown(buddy.id))!;
    expect(actor).toBeDefined();
    const privateText = 'HIDDEN_MESSAGE_FOR_UNLEARNED_HANDLE';
    game.social.sendMessage(actor.id, actor.id, 'player', privateText, 481);
    expect(game.social.getMessages(actor.id).at(-1)?.text).toBe(privateText);
    expect(game.social.getConversationUnreadCounts()[actor.id]).toBe(1);
    expect(game.social.getUnreadTraySummary(10).unreadCount).toBeGreaterThanOrEqual(1);

    const engineState = vi.spyOn(game, 'getState');
    const socialState = vi.spyOn(game.social, 'getState');
    const socialPage = vi.spyOn(game.social, 'getConversationPage');

    for (const page of [game.getConversationRead(actor.id), game.getConversationRead(actor.id, 20, 50)]) {
      expect(page).toEqual({
        revision: game.getRevision(), conversationId: actor.id,
        messages: [], total: 0, hasOlder: false,
      });
    }
    expect(socialPage).not.toHaveBeenCalled();
    expect(game.getMessengerRead().unreadCounts).not.toHaveProperty(actor.id);
    expect(game.getMessengerRead().contacts.some(contact => contact.actorId === actor.id)).toBe(false);
    const tray = game.getChromeRead();
    expect(tray.unreadPreviews.some(preview => preview.buddyId === actor.id)).toBe(false);
    expect(tray.unreadCount).toBe(0);
    expect(JSON.stringify({ tray, message: game.getConversationRead(actor.id) })).not.toContain(privateText);
    expect(engineState).not.toHaveBeenCalled();
    expect(socialState).not.toHaveBeenCalled();

    // Discovery unlocks the existing complete conversation, never inventing
    // messages, creating a duplicate cache, or silently rewriting their IDs.
    expect(game.social.learnHandle(actor.id, actor.handle)).toBe(true);
    const revealed = game.getConversationRead(actor.id, 0, 50);
    expect(revealed.total).toBe(1);
    expect(revealed.messages[0]?.text).toBe(privateText);
    expect(revealed.messages[0]?.id).toBe(game.social.getMessages(actor.id)[0]?.id);
    expect(game.getMessengerRead().unreadCounts[actor.id]).toBe(1);
    expect(game.getChromeRead().unreadPreviews.some(preview => preview.buddyId === actor.id)).toBe(true);
    expect(JSON.parse(JSON.stringify(revealed))).toEqual(revealed);
    expect(engineState).not.toHaveBeenCalled();
    expect(socialState).not.toHaveBeenCalled();
  });

  it('does not expose an arbitrary missing conversation ID as a private record', () => {
    const game = new SimulationEngine();
    const read = game.getConversationRead('nonexistent_unknown_actor');
    expect(read.messages).toEqual([]);
    expect(read.total).toBe(0);
    expect(read.hasOlder).toBe(false);
    expect(game.getMessengerRead().unreadCounts).not.toHaveProperty('nonexistent_unknown_actor');
  });
});

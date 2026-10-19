import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 bounded recent chat consumers and offline reply context', () => {
  it('reads only the newest six player-visible messages, independent of long private history', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    for (let i = 0; i < 125; i++) {
      game.social.sendMessage(actor.id, i % 2 ? 'player' : actor.id,
        i % 2 ? actor.id : 'player', `history-${i}`, 480 + i);
    }
    const full = vi.spyOn(game, 'getState');
    const legacyMessages = vi.spyOn(game.social, 'getMessages');

    // An unlearned handle cannot feed hidden transcripts into player-facing
    // AI reply suggestions; once learned, the very same history becomes visible.
    expect(game.getConversationRead(actor.id, 0, 6).messages).toEqual([]);
    expect(game.social.learnHandle(actor.id, actor.handle)).toBe(true);
    const recent = game.getConversationRead(actor.id, 0, 6);
    expect(recent.total).toBe(125);
    expect(recent.messages.map(m => m.text)).toEqual(
      Array.from({ length: 6 }, (_, index) => `history-${index + 119}`),
    );
    expect(JSON.stringify(recent)).not.toContain('history-0"');
    expect(full).not.toHaveBeenCalled();
    expect(legacyMessages).not.toHaveBeenCalled();
    expect(JSON.parse(JSON.stringify(recent))).toEqual(recent);
  });

  it('finds the latest tagged offline message without cloning full chat or confusing inbound turns', () => {
    const game = new SimulationEngine();
    const id = game.social.getBuddies()[0]!.id;
    const full = vi.spyOn(game.social, 'getMessages');
    expect(game.social.getLastOfflineMessageText(id)).toBeNull();
    for (let i = 0; i < 120; i++) {
      game.social.sendMessage(id, id, 'player', `normal-${i}`, 480 + i);
    }
    game.social.sendMessage(id, id, 'player', 'old offline link: example.local',
      601, true, ['offline-message']);
    for (let i = 0; i < 120; i++) {
      game.social.sendMessage(id, i % 2 === 0 ? 'player' : id,
        i % 2 === 0 ? id : 'player', `other-${i}`, 602 + i);
    }
    expect(game.social.getLastOfflineMessageText(id)).toBe('old offline link: example.local');
    game.social.sendMessage(id, 'player', id, 'outbound offline-labelled',
      730, false, ['offline-message']);
    // Only the contact's own offline messages are authoritative for the rule.
    expect(game.social.getLastOfflineMessageText(id)).toBe('old offline link: example.local');
    game.social.sendMessage(id, id, 'player', 'new offline without link',
      731, true, ['offline-message']);
    expect(game.social.getLastOfflineMessageText(id)).toBe('new offline without link');
    expect(full).not.toHaveBeenCalled();
  });
});

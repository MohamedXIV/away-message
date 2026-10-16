import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 MyPlace website owner publication', () => {
  it('commits profile edits once and suppresses identical owner writes', () => {
    const game = new SimulationEngine();
    const full = vi.spyOn(game, 'getState');
    const received: Array<{ revision: number; domains: readonly string[] }> = [];
    const off = game.subscribeChanges(change => received.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    received.length = 0;
    const baseline = game.getRevision();
    const profile = game.myplace.getUserProfile();
    expect(game.updateMyPlaceProfile({ headline: profile.headline })).toBe(false);
    expect(game.getRevision()).toBe(baseline);
    expect(received).toHaveLength(0);

    expect(game.updateMyPlaceProfile({
      headline: 'Building a quieter corner of Oakhaven', tiledBackground: 'stars',
      interests: ['Music', 'Coding'],
    })).toBe(true);
    expect(game.getRevision()).toBe(baseline + 1);
    expect(received).toHaveLength(1);
    expect(received[0]!.domains).toEqual(expect.arrayContaining(['myplace', 'unknown']));
    expect(game.getWebsiteRead().myplace.userProfile).toMatchObject({
      headline: 'Building a quieter corner of Oakhaven', tiledBackground: 'stars',
      interests: ['Music', 'Coding'],
    });
    expect(game.updateMyPlaceProfile({
      headline: 'Building a quieter corner of Oakhaven', tiledBackground: 'stars',
      interests: ['Music', 'Coding'],
    })).toBe(false);
    expect(game.getRevision()).toBe(baseline + 1);
    expect(received).toHaveLength(1);
    expect(full).not.toHaveBeenCalled();
    off();
  });

  it('makes guestbook posting visible to website readers through one canonical revision', () => {
    const game = new SimulationEngine();
    const full = vi.spyOn(game, 'getState');
    const events: number[] = [];
    const off = game.subscribeChanges(change => events.push(change.revision));
    events.length = 0;
    const before = game.getRevision();
    expect(game.postMyPlaceComment('maya_x', '  ')).toBe(false);
    expect(game.getRevision()).toBe(before);
    expect(game.postMyPlaceComment('maya_x', 'Hello from my room!')).toBe(true);
    expect(game.getRevision()).toBe(before + 1);
    expect(events).toHaveLength(1);
    const comments = game.getWebsiteRead().myplace.guestbook.maya_x;
    expect(comments?.[0]).toMatchObject({
      author: game.myplace.getUserProfile().username,
      text: 'Hello from my room!',
    });
    comments![0]!.text = 'UI tampering';
    expect(game.myplace.getGuestbook('maya_x')[0]?.text).toBe('Hello from my room!');
    expect(full).not.toHaveBeenCalled();
    off();
  });

  it('publishes a MyPlace upgrade and its procedural world announcement atomically', () => {
    const game = new SimulationEngine();
    game.advanceGameMinutes(3 * 1440, 'reach release day');
    const changes: Array<{ revision: number; domains: readonly string[] }> = [];
    const off = game.subscribeChanges(change => changes.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    changes.length = 0;
    const before = game.getRevision();
    const result = game.updateMyPlaceRelease('myplace_2.0');
    expect(result.success).toBe(true);
    expect(game.myplace.getCurrentMyPlaceId()).toBe('myplace_2.0');
    expect(game.getRevision()).toBe(before + 1);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.domains).toEqual(expect.arrayContaining(['myplace', 'world', 'unknown']));
    expect(game.getWebsiteRead().myplace.currentMyPlaceId).toBe('myplace_2.0');
    expect(game.world.getPendingEvents().some(event => event.id === 'myplace_2_0')).toBe(true);

    expect(game.updateMyPlaceRelease('myplace_2.0').success).toBe(false);
    expect(game.getRevision()).toBe(before + 1);
    expect(changes).toHaveLength(1);
    off();
  });
});

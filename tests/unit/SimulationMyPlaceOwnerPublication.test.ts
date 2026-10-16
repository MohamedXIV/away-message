import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { MyPlaceEngine } from '../../src/engine/MyPlaceEngine';
import { EventBus } from '../../src/engine/EventBus';

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
    // Set up a released day without running the normal NPC/world tick, which
    // legitimately auto-upgrades MyPlace before a manual upgrade can be tested.
    game.clock.setTotalMinutes(3 * 1440);
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
  it('publishes a late NPC profile and its social announcement once after the clock tick', async () => {
    const game = new SimulationEngine();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(game.myplace, 'maybeUpdateRandomNpcProfile').mockImplementation(async () => {
      await gate;
      game.myplace.updateNpcProfile('maya_x', { headline: 'A new day and a new headline' });
      return { username: 'maya_x', profile: game.myplace.getNpcProfile('maya_x')! };
    });
    const changes: Array<{ revision: number; domains: readonly string[] }> = [];
    const off = game.subscribeChanges(change => changes.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    game.advanceGameMinutes(2 * 1440, 'late MyPlace authoring');
    const baseline = game.getRevision();
    changes.length = 0;
    const full = vi.spyOn(game, 'getState');
    release();
    await vi.waitFor(() => expect(game.getRevision()).toBe(baseline + 1));
    expect(changes).toHaveLength(1);
    expect(changes[0]!.domains).toEqual(expect.arrayContaining(['myplace', 'social', 'unknown']));
    expect(game.getWebsiteRead().myplace.npcProfiles.maya_x?.headline)
      .toBe('A new day and a new headline');
    expect(JSON.parse(JSON.stringify(changes[0]))).toEqual(changes[0]);
    expect(full).not.toHaveBeenCalled();
    off();
  });

  it('does not publish a second revision when an async daily update selects nobody', async () => {
    const game = new SimulationEngine();
    vi.spyOn(game.myplace, 'maybeUpdateRandomNpcProfile').mockResolvedValue(null);
    const changes: number[] = [];
    const off = game.subscribeChanges(change => changes.push(change.revision));
    game.advanceGameMinutes(2 * 1440, 'empty daily profile update');
    const baseline = game.getRevision();
    const count = changes.length;
    await Promise.resolve();
    await Promise.resolve();
    expect(game.getRevision()).toBe(baseline);
    expect(changes).toHaveLength(count);
    off();
  });

  it('discards an in-flight NPC profile edit after loading a different snapshot', async () => {
    const owner = new MyPlaceEngine(new EventBus());
    const state = owner.getState();
    const hash = (input: string) => {
      let value = 0;
      for (const ch of input) value = (value * 31 + ch.charCodeAt(0)) >>> 0;
      return value;
    };
    const day = Array.from({ length: 100 }, (_, index) => index + 3)
      .find(candidate => hash(`${state.currentMyPlaceId}:${candidate}`) % 100 <= 35)!;
    expect(day).toBeDefined();
    const pending = owner.maybeUpdateRandomNpcProfile(day, day * 1440);
    owner.loadState(state);
    expect(await pending).toBeNull();
    expect(owner.getState()).toEqual(state);
  });

  it('scopes the real MyPlace page to one NPC without cloning global site state', () => {
    const game = new SimulationEngine();
    const all = vi.spyOn(game.myplace, 'getState');
    const allProfiles = vi.spyOn(game.myplace, 'getAllNpcProfiles');
    const broad = vi.spyOn(game, 'getState');
    const read = game.getMyPlacePageRead('maya_x');
    expect(read.profile?.username).toBe('maya_x');
    expect(read.userProfile.username).toBe('wanderer06');
    expect(read.guestbook).toEqual(game.myplace.getGuestbook('maya_x'));
    expect(JSON.stringify(read)).not.toContain('nightowl87');
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(all).not.toHaveBeenCalled();
    expect(allProfiles).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
  });

  it('does not leak mutable nested profile or guestbook arrays from read models', () => {
    const game = new SimulationEngine();
    const mine = game.myplace.getUserProfile();
    const npc = game.myplace.getNpcProfile('maya_x')!;
    const originalMine = [...mine.interests];
    const originalNpc = [...npc.interests];
    mine.interests.push('OUTSIDE_WRITE');
    npc.interests.push('OUTSIDE_WRITE');
    mine.top8.push({ handle: 'hacker', name: 'Hacker', avatar: 'X' });
    npc.top8.push({ handle: 'hacker', name: 'Hacker', avatar: 'X' });
    expect(game.myplace.getUserProfile().interests).toEqual(originalMine);
    expect(game.myplace.getNpcProfile('maya_x')!.interests).toEqual(originalNpc);
    expect(game.myplace.getUserProfile().top8).not.toContainEqual(expect.objectContaining({ handle: 'hacker' }));
    expect(game.myplace.getNpcProfile('maya_x')!.top8).not.toContainEqual(expect.objectContaining({ handle: 'hacker' }));

    expect(game.postMyPlaceComment('maya_x', 'A real entry')).toBe(true);
    const read = game.getMyPlacePageRead('maya_x');
    const revision = game.getRevision();
    read.profile!.interests.push('TAMPER');
    read.guestbook[0]!.text = 'TAMPER';
    read.userProfile.interests.push('TAMPER');
    expect(game.getRevision()).toBe(revision);
    expect(game.myplace.getGuestbook('maya_x')[0]!.text).toBe('A real entry');
    expect(game.myplace.getNpcProfile('maya_x')!.interests).toEqual(originalNpc);
    expect(game.myplace.getUserProfile().interests).toEqual(originalMine);
    const full = game.myplace.getState();
    full.npcProfiles.maya_x!.interests.push('TAMPER');
    full.userProfile.interests.push('TAMPER');
    expect(game.myplace.getNpcProfile('maya_x')!.interests).toEqual(originalNpc);
    expect(game.myplace.getUserProfile().interests).toEqual(originalMine);
  });

  it('refreshes one selected page on a real mutation with no broad owner reads', () => {
    const game = new SimulationEngine();
    const broad = vi.spyOn(game, 'getState');
    const all = vi.spyOn(game.myplace, 'getState');
    const revisions: number[] = [];
    const stop = game.subscribeChanges(change => revisions.push(change.revision));
    revisions.length = 0;
    const before = game.getMyPlacePageRead();
    expect(game.updateMyPlaceProfile({ headline: 'My new headline' })).toBe(true);
    const after = game.getMyPlacePageRead();
    expect(after.userProfile.headline).toBe('My new headline');
    expect(before.userProfile.headline).not.toBe(after.userProfile.headline);
    expect(revisions).toHaveLength(1);
    expect(broad).not.toHaveBeenCalled();
    expect(all).not.toHaveBeenCalled();
    stop();
  });

});

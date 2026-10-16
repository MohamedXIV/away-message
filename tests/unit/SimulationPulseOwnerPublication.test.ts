import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 Pulse direct-owner mutations and focused profile reads', () => {
  it('publishes and persists custom player away presence in canonical Social state', () => {
    const game = new SimulationEngine();
    const events: string[] = [];
    const off = game.events.on('social:status_changed', ({ buddyId }) => events.push(buddyId));
    const old = game.getRevision();
    const full = vi.spyOn(game, 'getState');
    game.social.setPlayerPresence({
      status: 'away', awayMessage: 'BRB real life', customAwayMessage: 'BRB real life',
    });
    game.publishExternalChange();
    expect(game.getRevision()).toBe(old + 1);
    expect(events.at(-1)).toBe('player');
    expect(game.getPresenceRead().presence.player?.status).toBe('away');
    expect(game.getPresenceRead().presence.player?.awayMessage).toBe('BRB real life');
    expect(full).not.toHaveBeenCalled();

    const snapshot = game.exportSnapshot(); // explicit persistence boundary
    expect(snapshot.social.presence.player?.awayMessage).toBe('BRB real life');
    const restored = new SimulationEngine(snapshot);
    expect(restored.social.getPresence('player')?.awayMessage).toBe('BRB real life');
    restored.social.setPlayerPresence({ status: 'online', awayMessage: '' });
    expect(restored.social.getPresence('player')?.status).toBe('online');
    off();
    full.mockRestore();
  });

  it('a profile read accesses one buddy only, never serializing all Social/World state', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const unrelated = game.social.getBuddies()[1]!;
    game.social.addCoreMemory(unrelated.id, {
      kind: 'shared_photo',
      text: 'SECRET_ONLY_OTHER_BUDDY', day: 1,
    });
    const giant = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const world = vi.spyOn(game.world, 'getState');
    const read = game.getPulseProfileRead(actor.id);
    expect(JSON.stringify(read)).not.toContain('SECRET_ONLY_OTHER_BUDDY');
    expect(read.photoMemories.every(memory => memory.kind === 'shared_photo')).toBe(true);
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(giant).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(world).not.toHaveBeenCalled();
  });

  it('atomically publishes a real group turn with its directed-address bonuses', () => {
    const game = new SimulationEngine();
    const ids = game.social.getBuddies().slice(0, 3).map(buddy => buddy.id);
    expect(ids).toHaveLength(3);
    const [a, b, c] = ids as [string, string, string];
    const beforeAB = game.social.getAffinity(a, b);
    const beforeBC = game.social.getAffinity(b, c);
    const seen: Array<{ revision: number; domains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => seen.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    seen.length = 0;
    const broad = vi.spyOn(game, 'getState');
    const socialBroad = vi.spyOn(game.social, 'getState');
    const beforeRevision = game.getRevision();

    expect(game.commitPulseRoomTurn(ids, 4, 2, [[a, b], [b, c]])).toBe(5);
    expect(game.social.getAffinity(a, b)).toBe(beforeAB + 3);
    expect(game.social.getAffinity(b, c)).toBe(beforeBC + 3);
    expect(game.getRevision()).toBe(beforeRevision + 1);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.domains).toEqual(expect.arrayContaining(['social', 'unknown']));
    expect(JSON.parse(JSON.stringify(seen[0]))).toEqual(seen[0]);
    expect(broad).not.toHaveBeenCalled();
    expect(socialBroad).not.toHaveBeenCalled();

    // Persistence is deliberately cold/explicit; caps and affinities survive.
    const snapshot = game.exportSnapshot();
    const restored = new SimulationEngine(snapshot);
    expect(restored.social.getAffinity(a, b)).toBe(beforeAB + 3);
    expect(restored.commitPulseRoomTurn([a, b], 4, 3)).toBe(1); // cap: +3 more
    expect(restored.social.getAffinity(a, b)).toBe(beforeAB + 6);
    broad.mockRestore();
    socialBroad.mockRestore();
    stop();
  });

  it('refuses to fabricate revisions for absent, cold, or already capped room turns', () => {
    const game = new SimulationEngine();
    const [a, b] = game.social.getBuddies().slice(0, 2).map(actor => actor.id);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    const changes: number[] = [];
    const stop = game.subscribeChanges(change => changes.push(change.revision));
    changes.length = 0;
    const baseline = game.getRevision();
    expect(game.commitPulseRoomTurn([a!, b!], 5, 0)).toBe(0);
    expect(game.commitPulseRoomTurn([a!], 5, 3, [[a!, b!]])).toBe(0);
    expect(game.commitPulseRoomTurn(['absent_one', 'absent_two'], 5, 2)).toBe(0);
    expect(game.getRevision()).toBe(baseline);
    expect(changes).toHaveLength(0);

    expect(game.commitPulseRoomTurn([a!, b!], 5, 3)).toBe(1);
    expect(game.commitPulseRoomTurn([a!, b!], 5, 3)).toBe(1);
    const capped = game.getRevision();
    expect(game.commitPulseRoomTurn([a!, b!], 5, 3, [[a!, b!]])).toBe(0);
    expect(game.getRevision()).toBe(capped);
    expect(changes).toHaveLength(2);
    expect(game.commitPulseRoomTurn([a!, b!], 6, 1)).toBe(1);
    expect(game.getRevision()).toBe(capped + 1);
    stop();
  });
  it('publishes delayed NPC scripted messages through the inbound command and bounded conversation', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    game.social.learnHandle(actor.id, actor.handle);
    const broad = vi.spyOn(game, 'getState');
    const source = vi.spyOn(game.social, 'getState');
    const observed: Array<readonly string[]> = [];
    const stop = game.subscribeChanges(change => observed.push(change.changedDomains));
    observed.length = 0;
    const revision = game.getRevision();
    const action = game.dispatchAction({
      type: 'SOCIAL_RECEIVE_MESSAGE',
      buddyId: actor.id,
      text: 'come by after the rain',
      timestampMinute: 955,
      tags: ['scripted'],
      imageUrl: 'data:image/png;base64,aGVsbG8=',
      imagePrompt: 'small Polaroid snapshot',
      imageCaption: 'rain on the street',
    });
    expect(action.success).toBe(true);
    expect(game.getRevision()).toBe(revision + 1);
    expect(observed).toHaveLength(1);
    expect(observed[0]).toEqual(expect.arrayContaining(['social', 'unknown']));
    const page = game.getConversationRead(actor.id, 0, 10);
    const message = page.messages.find(m => m.text === 'come by after the rain');
    expect(message).toBeDefined();
    expect(message?.senderId).toBe(actor.id);
    expect(message?.timestampMinute).toBe(955);
    expect(message?.tags).toContain('scripted');
    expect(message?.imageUrl).toBe('data:image/png;base64,aGVsbG8=');
    expect(JSON.parse(JSON.stringify(page))).toEqual(page);
    expect(broad).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
    stop();
  });

  it('deduplicates presence presets and emits a real revision only on changes', () => {
    const game = new SimulationEngine();
    // Player presence is absent until its first real command; initialize it
    // through the same canonical path before testing repeated no-ops.
    expect(game.setPlayerPresence({ status: 'online', awayMessage: '' })).toBe(true);
    const changes: Array<readonly string[]> = [];
    const stop = game.subscribeChanges(change => changes.push(change.changedDomains));
    changes.length = 0;
    const original = game.social.getPresence('player')!;
    expect(game.setPlayerPresence(original)).toBe(false);
    expect(changes).toHaveLength(0);
    expect(game.setPlayerPresence({ status: 'away', awayMessage: 'On the porch', customAwayMessage: 'On the porch' })).toBe(true);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual(expect.arrayContaining(['social', 'unknown']));
    expect(game.setPlayerPresence({ status: 'away', awayMessage: 'On the porch', customAwayMessage: 'On the porch' })).toBe(false);
    expect(changes).toHaveLength(1);
    expect(game.setPlayerPresence({ status: 'online', awayMessage: '', customAwayMessage: undefined })).toBe(true);
    expect(changes).toHaveLength(2);
    stop();
  });

  it('commits NPC promise capture and follow-through without false ledger publications', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const changes: Array<readonly string[]> = [];
    const stop = game.subscribeChanges(change => changes.push(change.changedDomains));
    changes.length = 0;
    const intentions = [{ text: 'I will bring that old camera tomorrow', dueDayOffset: 1 }];
    const start = game.getRevision();
    expect(game.commitPulseChatLedger(actor.id, intentions, false, 3)).toBe(true);
    expect(game.getRevision()).toBe(start + 1);
    expect(changes[0]).toEqual(expect.arrayContaining(['social', 'unknown']));
    expect(game.social.getOpenPromises(actor.id)).toHaveLength(1);
    expect(game.social.getOpenPromises(actor.id)[0]!.dueDay).toBe(4);
    expect(game.commitPulseChatLedger(actor.id, intentions, false, 3)).toBe(false);
    expect(game.getRevision()).toBe(start + 1);
    expect(game.commitPulseChatLedger(actor.id, [], true, 4)).toBe(true);
    expect(game.social.getOpenPromises(actor.id)).toHaveLength(0);
    expect(game.getRevision()).toBe(start + 2);
    expect(game.commitPulseChatLedger(actor.id, [], true, 4)).toBe(false);
    expect(game.getRevision()).toBe(start + 2);
    expect(changes).toHaveLength(2);
    stop();
  });

  it('publishes scheduled and cancelled meetup owner state even when cancel returns null', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const observed: Array<readonly string[]> = [];
    const stop = game.subscribeChanges(change => observed.push(change.changedDomains));
    observed.length = 0;
    const broad = vi.spyOn(game, 'getState');
    const start = game.getRevision();

    expect(game.handleMeetupChat(actor.id, 'maybe sometime', 1)).toBeNull();
    expect(game.getRevision()).toBe(start);
    const proposed = game.handleMeetupChat(actor.id, 'Let us meet at the cafe tomorrow', 1);
    expect(proposed).not.toBeNull();
    expect(game.getRevision()).toBe(start + 1);
    expect(observed[0]).toEqual(expect.arrayContaining(['world', 'unknown']));
    expect(game.world.getAppointments().some(appointment => appointment.characterId === actor.id)).toBe(true);
    expect(game.handleMeetupChat(actor.id, 'Let us meet at the cafe tomorrow', 1)).toBeNull();
    expect(game.getRevision()).toBe(start + 1);

    // The owner method returns null for cancellation by design; the write
    // still needs a bounded UI notification.
    expect(game.handleMeetupChat(actor.id, 'I have to cancel', 1)).toBeNull();
    expect(game.getRevision()).toBe(start + 2);
    expect(observed).toHaveLength(2);
    expect(game.world.getAppointments().some(appointment =>
      appointment.characterId === actor.id && appointment.status === 'cancelled')).toBe(true);
    expect(broad).not.toHaveBeenCalled();
    stop();
  });

});

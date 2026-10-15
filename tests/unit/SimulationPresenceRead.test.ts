import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture, populateBenchmarkMessages } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 presence-only UI projection', () => {
  it('agrees with canonical current presence without exposing chats or relationships', () => {
    const engine = new SimulationEngine();
    const all = engine.social.getState().presence;
    const actor = engine.social.getBuddies()[0]!;
    engine.social.sendMessage(actor.id, actor.id, 'player', 'PRIVATE CHAT BODY', 450);

    const broad = vi.spyOn(engine, 'getState');
    const exportSpy = vi.spyOn(engine, 'exportSnapshot');
    const read = engine.getPresenceRead();
    expect(read.presence).toEqual(all);
    expect(read.revision).toBe(engine.getRevision());
    expect(JSON.stringify(read)).not.toContain('PRIVATE CHAT BODY');
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(broad).not.toHaveBeenCalled();
    expect(exportSpy).not.toHaveBeenCalled();

    const firstId = Object.keys(read.presence)[0]!;
    const canonical = engine.social.getPresence(firstId);
    read.presence[firstId]!.awayMessage = 'untrusted UI mutation';
    expect(engine.social.getPresence(firstId)).toEqual(canonical);

    const revisions: number[] = [];
    const unsubscribe = engine.subscribeChanges(change => revisions.push(change.revision));
    const before = engine.getRevision();
    engine.social.updatePresence(780);
    engine.publishExternalChange();
    expect(engine.getPresenceRead().revision).toBe(before + 1);
    expect(engine.getPresenceRead().presence).toEqual(engine.social.getPresenceSummary());
    expect(revisions.at(-1)).toBe(before + 1);
    expect(broad).not.toHaveBeenCalled();
    unsubscribe();
    broad.mockRestore();
    exportSpy.mockRestore();
  });

  it('bounded read at populations of 20, 100, 250 and 500 never clones SocialEngineState', () => {
    for (const count of [20, 100, 250, 500]) {
      const fixture = createSimulationBenchmarkFixture(count);
      const engine = fixture.engine;
      const spy = vi.spyOn(engine, 'getState');
      const read = engine.getPresenceRead();
      const beforeBytes = JSON.stringify(read).length;
      expect(Object.keys(read.presence).length).toBeGreaterThan(0);
      populateBenchmarkMessages(fixture, 160);
      // Adding chat history must not increase the presence payload by one byte.
      const after = engine.getPresenceRead();
      expect(JSON.stringify(after).length).toBe(beforeBytes);
      expect(beforeBytes).toBeLessThan(120000);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

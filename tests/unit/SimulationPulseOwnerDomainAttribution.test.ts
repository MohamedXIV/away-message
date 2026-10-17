import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PulseEngine } from '../../src/engine/PulseEngine';
import { EventBus } from '../../src/engine/EventBus';

describe('#172 Pulse version change domain attribution', () => {
  it('reconciles a software installation inside the Pulse owner and publishes both domains once', () => {
    const game = new SimulationEngine();
    const initial = game.pulse.getCurrentPulseId();
    const events: Array<{ previousPulseId: string | null; currentPulseId: string | null }> = [];
    const off = game.events.on('pulse:changed', change => events.push(change));
    const received: Array<{ revision: number; changedDomains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => received.push(change));
    received.length = 0;
    const broad = vi.spyOn(game, 'getState');
    const before = game.getRevision();

    game.events.emit('software:installed', { software: {
      appId: 'app.pulse', version: '6.0',
    } as any });
    expect(game.pulse.getCurrentPulseId()).toBe('pulse_6.0');
    expect(events).toEqual([{ previousPulseId: initial, currentPulseId: 'pulse_6.0' }]);
    game.publishExternalChange();
    expect(game.getRevision()).toBe(before + 1);
    expect(received).toHaveLength(1);
    expect(received[0]!.changedDomains).toEqual(
      expect.arrayContaining(['pulse', 'software', 'unknown']),
    );
    expect(received[0]!.changedDomains).toEqual([
      ...received[0]!.changedDomains.filter(domain => domain !== 'unknown').sort(),
      'unknown',
    ]);
    expect(game.getChromeRead().pulseVersion).toBe('pulse_6.0');
    expect(JSON.parse(JSON.stringify(received))).toEqual(received);
    expect(broad).not.toHaveBeenCalled();

    // The same release is a genuine no-op for the Pulse owner.
    game.events.emit('software:installed', { software: { appId: 'app.pulse', version: '6.0' } as any });
    expect(events).toHaveLength(1);
    off();
    stop();
    broad.mockRestore();
  });

  it('attributes uninstall once, clears patch ledger, and rejects unknown versions without changing the owner', () => {
    const game = new SimulationEngine();
    const changes: Array<{ previousPulseId: string | null; currentPulseId: string | null }> = [];
    const off = game.events.on('pulse:changed', change => changes.push(change));
    game.pulse.syncInstalledVersion('6.0');
    expect(game.pulse.getCurrentPulseId()).toBe('pulse_6.0');
    expect(() => game.pulse.syncInstalledVersion('invalid_release_version')).toThrow(/Unknown installed/);
    expect(changes).toHaveLength(1);
    game.events.emit('software:uninstalled', { software: { appId: 'app.pulse', version: '6.0' } as any });
    expect(game.pulse.getCurrentPulseId()).toBeNull();
    expect(changes).toEqual([
      { previousPulseId: null, currentPulseId: 'pulse_6.0' },
      { previousPulseId: 'pulse_6.0', currentPulseId: null },
    ]);
    const delivered: Array<readonly string[]> = [];
    const stop = game.subscribeChanges(change => delivered.push(change.changedDomains));
    delivered.length = 0;
    game.publishExternalChange();
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toEqual(expect.arrayContaining(['pulse', 'software', 'unknown']));
    expect(delivered[0]).toEqual([
      ...delivered[0]!.filter(domain => domain !== 'unknown').sort(),
      'unknown',
    ]);
    game.pulse.syncInstalledVersion(null);
    expect(changes).toHaveLength(2);
    expect(JSON.parse(JSON.stringify(changes))).toEqual(changes);
    off();
    stop();
  });

  it('keeps source-only change events separate from snapshots, and loadState silent', () => {
    const bus = new EventBus();
    const owner = new PulseEngine(bus);
    const events: string[] = [];
    const off = bus.on('pulse:changed', change => events.push(`${change.previousPulseId} -> ${change.currentPulseId}`));
    owner.loadState({ currentPulseId: 'pulse_5.2' });
    expect(events).toEqual([]);
    owner.syncInstalledVersion('5.2');
    expect(events).toEqual([]);
    owner.syncInstalledVersion('6.0');
    expect(events).toEqual(['pulse_5.2 -> pulse_6.0']);
    owner.syncInstalledVersion('6.0');
    expect(events).toHaveLength(1);
    off();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('SimulationEngine (Authoritative Master Coordinator)', () => {
  let sim: SimulationEngine;

  beforeEach(() => {
    sim = new SimulationEngine();
  });

  it('initializes all sub-engines with coherent state', () => {
    const state = sim.getState();
    expect(state.time.day).toBe(1);
    expect(state.time.hour).toBe(8);
    expect(state.player.cash).toBe(38.0);
    expect(state.hardware.osVersion).toBe('Orion_4.8');
    expect(state.installedSoftware.length).toBeGreaterThan(0); // Voyager Browser
    expect(state.activeView).toBe('room');
    expect(state.hardware.hasComputer).toBe(false);
  });

  it('advances all subsystems simultaneously via advanceGameMinutes', () => {
    // Start a download
    sim.dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: 'tool',
      url: 'http://downloadhub.local/tool.exe',
      fileName: 'tool.exe',
      totalBytes: 192_000,
      sourceMaxKbps: 512,
    });

    // Advance 5 minutes
    sim.advanceGameMinutes(5, 'Player waiting');

    const state = sim.getState();
    expect(state.time.minute).toBe(5);
    // Download should be complete and created in VFS
    expect(state.downloads[0]?.status).toBe('complete');
    expect(sim.vfs.readFile('C:/Downloads/tool.exe')).toBeDefined();
  });

  it('dispatches work shift action updating money and advancing time', () => {
    // P7: shifts are worked at the food cart — travel there first
    expect(sim.dispatchAction({ type: 'TRAVEL_TO', to: 'cart', mode: 'walk' }).success).toBe(true);
    const res = sim.dispatchAction({
      type: 'PLAYER_WORK_SHIFT',
      durationMinutes: 240,
      wage: 62.0,
    });

    expect(res.success).toBe(true);
    const state = sim.getState();
    expect(state.player.cash).toBe(100.0);
    expect(state.time.hour).toBe(12); // 8 + 4 (+15m walk, still hour 12)
    expect(state.time.minute).toBe(15); // 15-minute walk to the cart
  });

  it('dispatches hardware upgrade actions with cash deduction', () => {
    // Try to upgrade RAM without cash -> fails
    const failRes = sim.dispatchAction({
      type: 'HARDWARE_UPGRADE_RAM',
      ramMB: 1024,
      cost: 45.0,
    });
    expect(failRes.success).toBe(false);

    // Earn money and retry
    sim.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 100.0,
      reason: 'Bonus',
    });

    const successRes = sim.dispatchAction({
      type: 'HARDWARE_UPGRADE_RAM',
      ramMB: 1024,
      cost: 45.0,
    });
    expect(successRes.success).toBe(true);

    const state = sim.getState();
    expect(state.hardware.ramMB).toBe(1024);
    expect(state.player.cash).toBe(93.0); // 38 + 100 - 45
  });

  it('supports reactive subscriber notifications', () => {
    let notifiedCount = 0;
    const unsub = sim.subscribe(() => {
      notifiedCount++;
    });

    // Immediate initial notification on subscribe: count = 1
    expect(notifiedCount).toBe(1);

    sim.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 10,
      reason: 'Gift',
    });
    expect(notifiedCount).toBe(2);

    unsub();
    sim.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 10,
      reason: 'Gift',
    });
    expect(notifiedCount).toBe(2);
  });

  it('losslessly exports and loads simulation state snapshot', () => {
    sim.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 50.0,
      reason: 'Found',
    });
    sim.dispatchAction({
      type: 'TIME_ADVANCE_MINUTES',
      minutes: 120,
    });

    const snapshot = sim.exportSnapshot();

    const newSim = new SimulationEngine();
    newSim.loadSnapshot(snapshot);

    const restoredState = newSim.getState();
    expect(restoredState.player.cash).toBe(88.0);
    expect(restoredState.time.hour).toBe(10);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createPowerWorkstationBundle, createScrapYardBundle } from '../../src/engine/hardware/catalog';

describe('SimulationEngine (Authoritative Master Coordinator)', () => {
  let sim: SimulationEngine;

  beforeEach(() => {
    sim = new SimulationEngine();
  });

  it('starts with honest empty computer, display, inventory, and OS roots', () => {
    const state = sim.getState();
    expect(state.time.day).toBe(1);
    expect(state.time.hour).toBe(8);
    expect(state.player.cash).toBe(38.0);
    expect(state.computer.assembled).toBe(false);
    expect(state.display.monitor).toBeNull();
    expect(state.inventory.items).toEqual([]);
    expect(state.os.currentOsId).toBeNull();
    expect(state.hardware.hasComputer).toBe(false);
    expect(state.hardware.ramMB).toBe(0);
    expect('osVersion' in state.hardware).toBe(false);
    expect(state.installedSoftware).toEqual([]);
    expect(state.activeView).toBe('room');
  });

  it('advances subsystems once physical network hardware exists', () => {
    sim.hardware.installModularHardware(createScrapYardBundle());
    sim.dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: 'tool',
      url: 'http://downloadhub.local/tool.exe',
      fileName: 'tool.exe',
      totalBytes: 192_000,
      sourceMaxKbps: 512,
    });

    sim.advanceGameMinutes(5, 'Player waiting');

    const state = sim.getState();
    expect(state.time.minute).toBe(5);
    expect(state.downloads[0]?.status).toBe('complete');
    expect(sim.vfs.readFile('C:/Downloads/tool.exe')).toBeDefined();
  });

  it('dispatches work shift action updating money and advancing time', () => {
    expect(sim.dispatchAction({ type: 'TRAVEL_TO', to: 'cart', mode: 'walk' }).success).toBe(true);
    const res = sim.dispatchAction({
      type: 'PLAYER_WORK_SHIFT',
      durationMinutes: 240,
      wage: 62.0,
    });

    expect(res.success).toBe(true);
    const state = sim.getState();
    expect(state.player.cash).toBe(100.0);
    expect(state.time.hour).toBe(12);
    expect(state.time.minute).toBe(15);
  });

  it('routes legacy RAM upgrade action through canonical physical state', () => {
    sim.hardware.installModularHardware(createPowerWorkstationBundle());
    sim.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 100.0, reason: 'Bonus' });

    const successRes = sim.dispatchAction({
      type: 'HARDWARE_UPGRADE_RAM',
      ramMB: 1024,
      cost: 45.0,
    });
    expect(successRes.success).toBe(true);

    const state = sim.getState();
    expect(state.hardware.ramMB).toBe(1024);
    expect(state.computer.ramSticks.reduce((sum, stick) => sum + stick.sizeMb, 0)).toBe(1024);
    expect(state.player.cash).toBe(93.0);
  });

  it('does not let the legacy OS-upgrade action magic-install the first OS', () => {
    sim.hardware.installModularHardware(createPowerWorkstationBundle());
    sim.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 100.0, reason: 'Bonus' });
    const cashBefore = sim.getState().player.cash;
    const diskBefore = sim.hardware.getComputerState().storage[0]!.freeBytes;

    const result = sim.dispatchAction({
      type: 'HARDWARE_UPGRADE_OS',
      targetOs: 'Orion_4.8',
      cost: 29,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No operating system is installed. Boot from setup media to install one.');
    expect(sim.getState().player.cash).toBe(cashBefore);
    expect(sim.hardware.getComputerState().storage[0]!.freeBytes).toBe(diskBefore);
    expect(sim.getState().os.currentOsId).toBeNull();
  });

  it('supports reactive subscriber notifications', () => {
    let notifiedCount = 0;
    const unsub = sim.subscribe(() => {
      notifiedCount++;
    });

    expect(notifiedCount).toBe(1);

    sim.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 10, reason: 'Gift' });
    expect(notifiedCount).toBe(2);

    unsub();
    sim.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 10, reason: 'Gift' });
    expect(notifiedCount).toBe(2);
  });

  it('losslessly exports and loads canonical simulation state snapshot', () => {
    sim.hardware.installModularHardware(createScrapYardBundle());
    sim.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 50.0, reason: 'Found' });
    sim.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 120 });

    const snapshot = sim.exportSnapshot();
    const newSim = new SimulationEngine();
    newSim.loadSnapshot(snapshot);

    const restoredState = newSim.getState();
    expect(restoredState.player.cash).toBe(88.0);
    expect(restoredState.time.hour).toBe(10);
    expect(restoredState.computer).toEqual(snapshot.computer);
    expect(restoredState.display).toEqual(snapshot.display);
    expect(restoredState.inventory).toEqual(snapshot.inventory);
    expect(restoredState.os).toEqual(snapshot.os);
  });
});

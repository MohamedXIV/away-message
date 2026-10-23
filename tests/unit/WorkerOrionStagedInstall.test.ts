import { describe, expect, it } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import type { OsInstallPlan } from '../../src/engine/kernel/ComputerOwnershipRuntime';

function fixture() {
  const simulation = new SimulationKernel();
  expect(simulation.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
  expect(simulation.setupComputerAtHome().success).toBe(true);
  expect(simulation.setComputerPower(true).success).toBe(true);
  const disc = simulation.exportSnapshot().inventory.items.find(item => item.catalogItemId === 'media_orion_48_setup')!;
  expect(simulation.insertOwnedMediaAtHome(disc.instanceId).success).toBe(true);
  const preflight = simulation.prepareOsInstallFromInsertedMedia();
  expect(preflight.success).toBe(true);
  return { simulation, plan: preflight.data!, discId: disc.instanceId };
}

describe('#219 persistent owner-backed Orion installation', () => {
  it('spends game minutes in separately saved stages, rejects shortcut completion, and never double charges time', () => {
    const { simulation, plan, discId } = fixture();
    const beginning = simulation.exportSnapshot();
    expect(simulation.startOsInstall(plan).success).toBe(true);
    expect(simulation.commitOsInstall(plan).success).toBe(false);
    expect(simulation.startOsInstall(plan).success).toBe(false);
    expect(simulation.advanceOsInstall().success).toBe(true);

    const intermediate = simulation.exportSnapshot();
    const spent = intermediate.os.installation!.elapsedMinutes;
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThan(plan.durationMinutes);
    expect(intermediate.os.currentOsId).toBeNull();
    expect(intermediate.time.totalMinutes - beginning.time.totalMinutes).toBe(spent);
    expect(intermediate.computer.storage[0]?.freeBytes).toBe(beginning.computer.storage[0]?.freeBytes);
    expect(simulation.getDesktopRead().osInstallation?.elapsedMinutes).toBe(spent);

    const reloaded = new SimulationKernel(intermediate);
    expect(reloaded.getDesktopRead().osInstallation?.mediaInstanceId).toBe(discId);
    expect(reloaded.ejectOwnedMediaAtHome().success).toBe(true);
    const beforeBlocked = reloaded.exportSnapshot();
    expect(reloaded.advanceOsInstall().success).toBe(false);
    expect(reloaded.exportSnapshot().time.totalMinutes).toBe(beforeBlocked.time.totalMinutes);
    expect(reloaded.insertOwnedMediaAtHome(discId).success).toBe(true);
    expect(reloaded.setComputerPower(false).success).toBe(true);
    expect(reloaded.advanceOsInstall().success).toBe(false);
    expect(reloaded.setComputerPower(true).success).toBe(true);

    for (let step = 0; step < 4 && !reloaded.os.getCurrentOsId(); step++) {
      expect(reloaded.advanceOsInstall().success).toBe(true);
    }
    const completed = reloaded.exportSnapshot();
    expect(completed.os.currentOsId).toBe('Orion_4.8');
    expect(completed.os.installation).toBeNull();
    expect(reloaded.getDesktopRead().pcBootState).toBe('desktop');
    expect(completed.time.totalMinutes - beginning.time.totalMinutes).toBe(plan.durationMinutes);
    expect((beginning.computer.storage[0]?.freeBytes ?? 0) -
      (completed.computer.storage[0]?.freeBytes ?? 0)).toBe(plan.installSizeBytes);
    expect(reloaded.advanceOsInstall().success).toBe(false);
  });

  it('allows cancel without refunding spent time or granting installation rights', () => {
    const { simulation, plan } = fixture();
    expect(simulation.startOsInstall(plan).success).toBe(true);
    expect(simulation.advanceOsInstall().success).toBe(true);
    const spentTime = simulation.clock.getTotalMinutes();
    expect(simulation.cancelOsInstall().success).toBe(true);
    expect(simulation.os.getInstallProgress()).toBeNull();
    expect(simulation.os.getCurrentOsId()).toBeNull();
    expect(simulation.clock.getTotalMinutes()).toBe(spentTime);
    expect(simulation.startOsInstall(plan).success).toBe(true);
    expect(simulation.os.getInstallProgress()?.elapsedMinutes).toBe(0);
  });
});

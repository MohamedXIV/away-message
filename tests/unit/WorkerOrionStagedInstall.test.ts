import { describe, expect, it } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';

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
    expect(completed.os.installation).toBeUndefined();
    expect(reloaded.getDesktopRead().pcBootState).toBe('desktop');
    expect(completed.time.totalMinutes - beginning.time.totalMinutes).toBe(plan.durationMinutes);
    expect((beginning.computer.storage[0]?.freeBytes ?? 0) -
      (completed.computer.storage[0]?.freeBytes ?? 0)).toBe(plan.installSizeBytes);
    expect(reloaded.advanceOsInstall().success).toBe(false);
  });

  it('installs genuine Orion 5.0 from a DIFFERENT owned CD and saved 5.0 setup instead of the starter 4.8 disc', () => {
    // Day 6 world fixture exercises the authentic release gate, without
    // performing an unrelated multi-day endurance simulation in a unit test.
    const initial = new SimulationKernel().exportSnapshot();
    const simulation = new SimulationKernel({
      ...initial,
      // Independently model an earned upgrade budget; the default new-run
      // $38 cannot afford the authentic $85 family computer.
      player: { ...initial.player, cash: 200 },
      time: {
        ...initial.time,
        day: 6,
        totalMinutes: initial.time.totalMinutes + 5 * 1440,
      },
    });
    expect(simulation.purchaseStoreItem('silicon_spares', 'bundle_family').success).toBe(true);
    expect(simulation.setupComputerAtHome().success).toBe(true);
    expect(simulation.setComputerPower(true).success).toBe(true);
    const owned = simulation.exportSnapshot().inventory.items;
    const cd = owned.find(item => item.catalogItemId === 'media_orion_50_setup');
    expect(cd).toBeDefined();
    expect(owned.some(item => item.catalogItemId === 'media_orion_48_setup')).toBe(false);
    expect(simulation.insertOwnedMediaAtHome(cd!.instanceId).success).toBe(true);
    const prepared = simulation.prepareOsInstallFromInsertedMedia();
    expect(prepared.success).toBe(true);
    expect(prepared.data?.targetOs).toBe('Orion_5.0');
    expect(prepared.data?.mode).toBe('fresh');
    // PC assembly already incurred its own 15 in-world minutes. Count only
    // setup copying/configuration against the installer duration.
    const beforeSetupMinutes = simulation.clock.getTotalMinutes();
    expect(simulation.startOsInstall(prepared.data!).success).toBe(true);
    expect(simulation.advanceOsInstall().success).toBe(true);

    const saved = simulation.exportSnapshot();
    expect(saved.os.currentOsId).toBeNull();
    expect(saved.os.installation?.targetOs).toBe('Orion_5.0');
    const restored = new SimulationKernel(saved);
    expect(restored.getDesktopRead().osInstallation?.targetOs).toBe('Orion_5.0');
    expect(restored.commitOsInstall(prepared.data!).success).toBe(false);
    for (let step = 0; step < 4 && !restored.os.getCurrentOsId(); step++) {
      expect(restored.advanceOsInstall().success).toBe(true);
    }
    const finished = restored.exportSnapshot();
    expect(finished.os.currentOsId).toBe('Orion_5.0');
    expect(finished.os.installation).toBeUndefined();
    expect(restored.getDesktopRead().pcBootState).toBe('desktop');
    expect(finished.time.totalMinutes - beforeSetupMinutes)
      .toBe(prepared.data!.durationMinutes);
  });

  it('upgrades installed Orion 4.8 using separately purchased owned 5.0 CD and power-off RAM', () => {
    const initial = new SimulationKernel().exportSnapshot();
    const sim = new SimulationKernel({
      ...initial,
      player: { ...initial.player, cash: 170 },
      time: { ...initial.time, day: 6,
        totalMinutes: initial.time.totalMinutes + 5 * 1440 },
    });
    expect(sim.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(sim.setupComputerAtHome().success).toBe(true);
    expect(sim.setComputerPower(true).success).toBe(true);
    const firstCd = sim.exportSnapshot().inventory.items
      .find(item => item.catalogItemId === 'media_orion_48_setup')!;
    expect(sim.insertOwnedMediaAtHome(firstCd.instanceId).success).toBe(true);
    const firstPlan = sim.prepareOsInstallFromInsertedMedia().data!;
    expect(sim.startOsInstall(firstPlan).success).toBe(true);
    for (let stage=0;stage<4;stage++) expect(sim.advanceOsInstall().success).toBe(true);
    expect(sim.os.getCurrentOsId()).toBe('Orion_4.8');
    const firstSpace = sim.hardware.getComputerState().storage[0]!.freeBytes;

    expect(sim.purchaseStoreItem('silicon_spares', 'part_ram_128mb').success).toBe(true);
    expect(sim.purchaseStoreItem('silicon_spares', 'disc_orion_50').success).toBe(true);
    const owned = sim.exportSnapshot().inventory.items;
    const ram = owned.find(item => item.catalogItemId === 'ram_sdram_128' &&
      item.location === 'room_package')!;
    const secondCd = owned.find(item => item.catalogItemId === 'media_orion_50_setup')!;
    expect(ram).toBeDefined();
    expect(secondCd).toBeDefined();

    expect(sim.installOwnedHardwareAtHome(ram.instanceId, 'ram:1').success).toBe(false);
    expect(sim.setComputerPower(false).success).toBe(true);
    expect(sim.installOwnedHardwareAtHome(ram.instanceId, 'ram:1').success).toBe(true);
    expect(sim.hardware.getState().ramMB).toBe(192);
    expect(sim.setComputerPower(true).success).toBe(true);
    expect(sim.ejectOwnedMediaAtHome().success).toBe(true);
    expect(sim.insertOwnedMediaAtHome(secondCd.instanceId).success).toBe(true);
    const upgrade = sim.prepareOsInstallFromInsertedMedia();
    expect(upgrade.success).toBe(true);
    expect(upgrade.data?.targetOs).toBe('Orion_5.0');
    expect(upgrade.data?.mode).toBe('upgrade');
    expect(upgrade.data?.installSizeBytes).toBe(200_000_000);
    const beforeCopy = sim.clock.getTotalMinutes();
    expect(sim.startOsInstall(upgrade.data!).success).toBe(true);
    expect(sim.advanceOsInstall().success).toBe(true);
    const halfway = sim.exportSnapshot();
    expect(halfway.os.currentOsId).toBe('Orion_4.8');
    expect(halfway.os.installation?.targetOs).toBe('Orion_5.0');
    expect(halfway.computer.storage[0]!.freeBytes).toBe(firstSpace);
    const restored = new SimulationKernel(halfway);
    for (let stage=0;stage<3;stage++) expect(restored.advanceOsInstall().success).toBe(true);
    expect(restored.os.getCurrentOsId()).toBe('Orion_5.0');
    expect(restored.os.getInstallProgress()).toBeNull();
    expect(restored.hardware.getComputerState().storage[0]!.freeBytes)
      .toBe(firstSpace - upgrade.data!.installSizeBytes);
    expect(restored.clock.getTotalMinutes() - beforeCopy).toBe(upgrade.data!.durationMinutes);
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

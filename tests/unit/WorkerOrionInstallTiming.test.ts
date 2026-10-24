import { describe, expect, it } from 'vitest';
import { estimateOsInstallationMinutes } from '../../src/engine/kernel/ComputerOwnershipRuntime';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';

describe('#219 canonical physical installer throughput', () => {
  const starter = {
    installSizeGB: 1.2,
    ramMB: 64,
    cpuThroughputUnits: 1,
    storageThroughputUnits: 0.8,
    opticalSpeedMultiplier: 24,
  };

  it('gets faster from each actual upgrade: RAM, CPU, storage and optical drive', () => {
    const base = estimateOsInstallationMinutes(starter);
    expect(estimateOsInstallationMinutes({ ...starter, ramMB: 1024 })).toBeLessThan(base);
    expect(estimateOsInstallationMinutes({ ...starter, cpuThroughputUnits: 1.5 })).toBeLessThan(base);
    expect(estimateOsInstallationMinutes({ ...starter, storageThroughputUnits: 1.5 })).toBeLessThan(base);
    expect(estimateOsInstallationMinutes({ ...starter, opticalSpeedMultiplier: 48 })).toBeLessThan(base);
    expect(estimateOsInstallationMinutes(starter)).toBe(base);
    expect(base).toBeGreaterThan(0);
  });

  it('physical owned starter CD preflight uses the exact hardware-dependent formula', () => {
    const simulation = new SimulationKernel();
    expect(simulation.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(simulation.setupComputerAtHome().success).toBe(true);
    const owned = simulation.exportSnapshot().inventory.items.find(
      item => item.catalogItemId === 'media_orion_48_setup');
    expect(owned).toBeDefined();
    expect(simulation.insertOwnedMediaAtHome(owned!.instanceId).success).toBe(true);
    const plan = simulation.prepareOsInstallFromInsertedMedia();
    expect(plan.success).toBe(true);
    const hardware = simulation.hardware.getComputerState();
    expect(plan.data?.durationMinutes).toBe(estimateOsInstallationMinutes({
      installSizeGB: 1.2,
      ramMB: simulation.hardware.getState().ramMB,
      cpuThroughputUnits: hardware.cpu!.throughputUnits,
      storageThroughputUnits: hardware.storage[0]!.throughputUnits,
      opticalSpeedMultiplier: hardware.opticalDrives[0]!.speedMultiplier,
    }));
  });
});

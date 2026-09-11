import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { getAtHomeHardwareWorkbench } from '../../src/engine/AtHomeHardwareWorkbench';

describe('Room 104 hardware workbench', () => {
  it('shows exact installed parts and engine-validated spare actions without mutating live state', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_family').success).toBe(true);

    const before = engine.exportSnapshot();
    const view = getAtHomeHardwareWorkbench(engine);

    expect(view.success).toBe(true);
    expect(view.data?.installed.find((part) => part.slot === 'cpu')).toMatchObject({
      catalogItemId: 'cpu_celeron_366',
      componentKind: 'cpu',
    });
    expect(view.data?.installed.find((part) => part.slot === 'monitor:0')).toMatchObject({
      catalogItemId: 'mon_beige_curved_14',
      componentKind: 'monitor',
    });

    const cpuSpare = view.data?.spares.find((part) => part.catalogItemId === 'cpu_pentium2_500');
    expect(cpuSpare).toMatchObject({
      componentKind: 'cpu',
      targetSlot: 'cpu',
      compatible: true,
    });

    const storageSpare = view.data?.spares.find((part) => part.catalogItemId === 'hdd_maxtor_6gb');
    expect(storageSpare).toMatchObject({
      componentKind: 'storage',
      targetSlot: 'storage:0',
      compatible: false,
    });
    expect(storageSpare?.reason).toContain('Primary storage replacement is blocked');

    expect(engine.exportSnapshot()).toEqual(before);
  });
});

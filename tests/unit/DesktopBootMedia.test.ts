import { describe, expect, it } from 'vitest';
import { getBootableOwnedOsMedia } from '../../src/desktop/DesktopShell';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Desktop no-boot OS media discovery', () => {
  it('finds exact owned installer media in Room 104 and keeps inserted media discoverable', () => {
    const engine = new SimulationEngine();
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);

    const available = getBootableOwnedOsMedia(engine.getState().inventory.items);
    expect(available).toHaveLength(1);
    expect(available[0]).toMatchObject({
      catalogItemId: 'media_orion_48_setup',
      title: 'Orion OS 4.8 Setup CD',
      targetOs: 'Orion_4.8',
      location: 'room_package',
    });

    expect(engine.insertOwnedMediaAtHome(available[0]!.instanceId).success).toBe(true);
    expect(getBootableOwnedOsMedia(engine.getState().inventory.items)[0]).toMatchObject({
      instanceId: available[0]!.instanceId,
      targetOs: 'Orion_4.8',
      location: 'inserted',
    });
  });
});

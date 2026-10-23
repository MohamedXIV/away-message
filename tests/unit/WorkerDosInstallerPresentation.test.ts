import { describe, expect, it } from 'vitest';
import { getOrionInstallerPresentation } from '../../src/desktop/host/OrionInstallerPresentation';
import { STATIC_OS_CATALOG } from '../../src/engine/OsCatalog';
import { resolvePcBootStateFromOwnerStatus } from '../../src/engine/kernel/ComputerOwnershipRuntime';

describe('#219 actual DOS + Orion disc setup', () => {
  it('refuses a fake OS when the machine is absent or off; identifies no-OS boot', () => {
    expect(resolvePcBootStateFromOwnerStatus({ assembled: false, poweredOn: false }, null, () => false)).toBe('no_computer');
    expect(resolvePcBootStateFromOwnerStatus({ assembled: true, poweredOn: false }, null, () => false)).toBe('powered_off');
    expect(resolvePcBootStateFromOwnerStatus({ assembled: true, poweredOn: true }, null, () => false)).toBe('no_boot_device');
    expect(resolvePcBootStateFromOwnerStatus({ assembled: true, poweredOn: true }, 'Orion_4.8', () => false)).toBe('desktop');
  });

  it('derives four different installer identities from actual Orion release metadata', () => {
    const versions = ['Orion_4.8','Orion_5.0','Orion_6.0','Orion_7.0'] as const;
    const presentations = versions.map(id => getOrionInstallerPresentation(id));
    expect(new Set(presentations.map(item => item.edition)).size).toBe(4);
    expect(new Set(presentations.map(item => item.frameClass)).size).toBe(4);
    expect(presentations.every(item => item.stages.length === 4)).toBe(true);
    expect(STATIC_OS_CATALOG.some(item => item.id === 'Orion_4.8')).toBe(true);
    expect(presentations[0]!.edition).toBe('orion48');
    expect(presentations[3]!.edition).toBe('orion70');
  });
});

import { describe, expect, it } from 'vitest';
import { resolvePcBootState } from '../../src/desktop/boot/resolvePcBootState';
import { createEmptyComputerSetup, createEmptyInventoryState } from '../../src/engine/hardware/state';
import { createScrapYardBundle } from '../../src/engine/hardware/catalog';
import { legacyModularToCanonical } from '../../src/engine/hardware/state';
import type { PlayerInventoryState } from '../../src/engine/types';

function assembled(poweredOn: boolean) {
  const canonical = legacyModularToCanonical(createScrapYardBundle());
  return { ...canonical.computer, poweredOn };
}

function insertedInstaller(): PlayerInventoryState {
  return {
    items: [
      {
        instanceId: 'owned:orion48',
        catalogItemId: 'media_orion_48_setup',
        kind: 'media',
        location: 'inserted',
      },
    ],
    purchaseCounts: {},
  };
}

describe('Issue #8 PC boot-state resolver', () => {
  it('distinguishes no computer and powered-off hardware', () => {
    expect(resolvePcBootState({
      computer: createEmptyComputerSetup(),
      osId: 'Orion_6.0',
      inventory: createEmptyInventoryState(),
    })).toBe('no_computer');

    expect(resolvePcBootState({
      computer: assembled(false),
      osId: null,
      inventory: createEmptyInventoryState(),
    })).toBe('powered_off');
  });

  it('never invents a desktop when a powered computer has no installed OS', () => {
    expect(resolvePcBootState({
      computer: assembled(true),
      osId: null,
      inventory: createEmptyInventoryState(),
    })).toBe('no_boot_device');
  });

  it('resolves an installed OS to desktop independently of installer media', () => {
    expect(resolvePcBootState({
      computer: assembled(true),
      osId: 'Orion_4.8',
      inventory: createEmptyInventoryState(),
    })).toBe('desktop');
  });

  it('accepts only an owned inserted OS installer as installer-ready', () => {
    const computer = { ...assembled(true), insertedMediaId: 'owned:orion48' };
    expect(resolvePcBootState({ computer, osId: null, inventory: insertedInstaller() })).toBe('installer_ready');

    const roomMedia = insertedInstaller();
    roomMedia.items[0] = { ...roomMedia.items[0]!, location: 'room_package' };
    expect(resolvePcBootState({ computer, osId: null, inventory: roomMedia })).toBe('no_boot_device');

    expect(resolvePcBootState({
      computer: { ...computer, insertedMediaId: 'unowned' },
      osId: null,
      inventory: insertedInstaller(),
    })).toBe('no_boot_device');
  });
});

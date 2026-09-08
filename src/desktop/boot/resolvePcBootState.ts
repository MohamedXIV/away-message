import type { ComputerSetupState, OsVersion, PlayerInventoryState } from '../../engine/types';
import { PHYSICAL_ITEM_CATALOG } from '../../engine/hardware/catalog';

export type PcBootState =
  | 'no_computer'
  | 'powered_off'
  | 'no_boot_device'
  | 'installer_ready'
  | 'desktop';

export function resolvePcBootState(args: {
  computer: ComputerSetupState;
  osId: OsVersion | null;
  inventory: PlayerInventoryState;
}): PcBootState {
  const { computer, osId, inventory } = args;

  if (!computer.assembled) return 'no_computer';
  if (!computer.poweredOn) return 'powered_off';
  if (osId !== null) return 'desktop';

  const insertedId = computer.insertedMediaId;
  if (!insertedId) return 'no_boot_device';

  const owned = inventory.items.find(
    (item) => item.instanceId === insertedId && item.location === 'inserted' && item.kind === 'media',
  );
  if (!owned) return 'no_boot_device';

  const definition = PHYSICAL_ITEM_CATALOG[owned.catalogItemId];
  if (
    definition?.kind === 'media' &&
    definition.componentKind === 'os_media' &&
    definition.media?.type === 'os_installer'
  ) {
    return 'installer_ready';
  }

  return 'no_boot_device';
}

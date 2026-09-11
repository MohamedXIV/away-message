import { getPhysicalCatalogItem } from '../engine/hardware/catalog';
import type { OwnedItem, OwnedItemLocation, OsVersion } from '../engine/types';

export interface BootableOwnedOsMedia {
  instanceId: string;
  catalogItemId: string;
  title: string;
  targetOs: OsVersion;
  location: OwnedItemLocation;
}

const BOOT_MEDIA_LOCATIONS = new Set<OwnedItemLocation>(['room_package', 'inventory', 'inserted']);

export function getBootableOwnedOsMedia(items: readonly OwnedItem[]): BootableOwnedOsMedia[] {
  return items.flatMap((item) => {
    if (!BOOT_MEDIA_LOCATIONS.has(item.location)) return [];
    const catalog = getPhysicalCatalogItem(item.catalogItemId);
    if (!catalog?.media || catalog.media.type !== 'os_installer') return [];
    return [{
      instanceId: item.instanceId,
      catalogItemId: item.catalogItemId,
      title: catalog.media.title,
      targetOs: catalog.media.osTarget,
      location: item.location,
    }];
  });
}

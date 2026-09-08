import { describe, expect, it } from 'vitest';
import * as storeCatalog from '../../src/engine/hardware/catalog';
import { getReleaseById } from '../../src/engine/OsCatalog';
import { getPulseReleaseById } from '../../src/engine/PulseCatalog';

type CatalogComponent = {
  sizeMb?: number;
  freeBytes?: number;
};

type PhysicalDefinition = {
  id: string;
  kind: 'hardware' | 'display' | 'media';
  componentKind: string;
  component?: CatalogComponent;
  media?: { type: string; title: string; osTarget?: string };
};

type StoreSku = {
  id: string;
  name: string;
  price: number;
  description: string;
  specsSummary: string;
  repeatable?: boolean;
  contents?: Array<{ catalogItemId: string; quantity: number }>;
};

function physicalCatalog(): Record<string, PhysicalDefinition> {
  return ((storeCatalog as unknown as { PHYSICAL_ITEM_CATALOG?: Record<string, PhysicalDefinition> })
    .PHYSICAL_ITEM_CATALOG ?? {});
}

function sku(id: string): StoreSku {
  const found = (storeCatalog.HARDWARE_STORE_INVENTORY as unknown as StoreSku[]).find((entry) => entry.id === id);
  expect(found, `missing SKU ${id}`).toBeDefined();
  return found!;
}

function expandedDefinitions(target: StoreSku): PhysicalDefinition[] {
  const defs = physicalCatalog();
  return (target.contents ?? []).flatMap((entry) =>
    Array.from({ length: entry.quantity }, () => defs[entry.catalogItemId]),
  ).filter((entry): entry is PhysicalDefinition => Boolean(entry));
}

describe('Silicon & Spares authored ownership catalog', () => {
  it('expands the $35 starter into ten ordinary definitions including separate Orion 4.8 media', () => {
    const starter = sku('bundle_scrapyard');
    expect(starter.price).toBe(35);
    expect(starter.repeatable).toBe(false);
    expect(starter.contents).toHaveLength(10);

    const defs = expandedDefinitions(starter);
    expect(defs).toHaveLength(10);
    expect(defs.filter((entry) => entry.kind === 'hardware')).toHaveLength(8);
    expect(defs.filter((entry) => entry.kind === 'display')).toHaveLength(1);
    expect(defs.filter((entry) => entry.kind === 'media')).toHaveLength(1);
    expect(defs.find((entry) => entry.kind === 'media')?.media).toMatchObject({
      type: 'os_installer',
      osTarget: 'Orion_4.8',
    });
  });

  it('keeps every SKU content reference resolvable and gives repeatability an explicit policy', () => {
    const defs = physicalCatalog();
    const inventory = storeCatalog.HARDWARE_STORE_INVENTORY as unknown as StoreSku[];

    expect(Object.keys(defs).length).toBeGreaterThan(0);
    for (const entry of inventory) {
      expect(typeof entry.repeatable, `${entry.id} repeatable policy`).toBe('boolean');
      expect(entry.contents?.length, `${entry.id} contents`).toBeGreaterThan(0);
      for (const content of entry.contents ?? []) {
        expect(content.quantity, `${entry.id}/${content.catalogItemId} quantity`).toBeGreaterThan(0);
        expect(defs[content.catalogItemId], `${entry.id}/${content.catalogItemId} definition`).toBeDefined();
      }
    }
  });

  it('does not describe complete PC bundles as preloaded with an operating system', () => {
    const bundles = (storeCatalog.HARDWARE_STORE_INVENTORY as unknown as StoreSku[])
      .filter((entry) => entry.id.startsWith('bundle_'));

    for (const bundle of bundles) {
      expect(bundle.description.toLowerCase()).not.toContain('pre-loaded');
      expect(bundle.specsSummary).not.toMatch(/Orion\s+[4567]/i);
    }
  });

  it('keeps the exact starter capable of baseline Orion 4.8 followed by Pulse 5.2', () => {
    const starter = sku('bundle_scrapyard');
    const defs = expandedDefinitions(starter);
    const ramMb = defs
      .filter((entry) => entry.componentKind === 'ram')
      .reduce((sum, entry) => sum + (entry.component?.sizeMb ?? 0), 0);
    const storage = defs.find((entry) => entry.componentKind === 'storage')?.component;
    const freeGb = (storage?.freeBytes ?? 0) / 1_000_000_000;
    const os = getReleaseById('Orion_4.8')!;
    const pulse = getPulseReleaseById('pulse_5.2')!;

    expect(ramMb).toBe(64);
    expect(ramMb).toBeGreaterThanOrEqual(os.requirements.minRamMB);
    expect(freeGb).toBeGreaterThanOrEqual(os.requirements.minDiskGB);
    expect(ramMb).toBeGreaterThanOrEqual(pulse.requirements.minRamMB);
    expect((freeGb - os.installSizeGB) * 1000).toBeGreaterThanOrEqual(pulse.requirements.minDiskMB);
  });
});

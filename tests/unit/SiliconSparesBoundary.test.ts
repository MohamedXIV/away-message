import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODAL_PATH = resolve(process.cwd(), 'src/world/modals/SiliconSparesModal.tsx');
const STORE_PATH = resolve(process.cwd(), 'src/store/useSimulationStore.ts');

describe('Silicon & Spares transaction boundary', () => {
  it('keeps the modal as a purchase transaction client with no hardware/economy mutation', () => {
    const source = readFileSync(MODAL_PATH, 'utf8');

    for (const forbidden of [
      'spendCash(',
      'installModularHardware(',
      'insertDisc(',
      'addRamStick(',
      'replaceMonitor(',
    ]) {
      expect(source, `modal must not contain ${forbidden}`).not.toContain(forbidden);
    }

    expect(source).toContain('purchaseStoreItem');
    expect(source).not.toContain('Already Paid ✓');
    expect(source).not.toContain('Delivered and set up');
    expect(source).not.toContain('Disc inserted');
  });

  it('exposes one typed Zustand purchase wrapper that dispatches STORE_PURCHASE_ITEM', () => {
    const source = readFileSync(STORE_PATH, 'utf8');

    expect(source).toContain('purchaseStoreItem:');
    expect(source).toContain("type: 'STORE_PURCHASE_ITEM'");
    expect(source).toContain("storeId: 'silicon_spares'");
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('legacy OS upgrade path retirement', () => {
  it('removes the cash-plus-install HARDWARE_UPGRADE_OS action from the simulation core contract', () => {
    expect(read('src/engine/types/index.ts')).not.toContain('HARDWARE_UPGRADE_OS');
    expect(read('src/engine/SimulationEngineCore.ts')).not.toContain("case 'HARDWARE_UPGRADE_OS'");
    expect(read('src/engine/SimulationEngine.ts')).not.toContain("action.type === 'HARDWARE_UPGRADE_OS'");
  });

  it('does not expose a store action that can buy and install an OS in one call', () => {
    const storeSource = read('src/store/useSimulationStore.ts');
    expect(storeSource).not.toMatch(/\bupgradeOs\s*:/);
    expect(storeSource).not.toContain("type: 'HARDWARE_UPGRADE_OS'");
  });
});

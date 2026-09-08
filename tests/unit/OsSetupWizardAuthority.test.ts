import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const wizardSource = source('../../src/apps/installer/OsSetupWizard.tsx');
const storeSource = source('../../src/store/useSimulationStore.ts');
const coreSource = source('../../src/engine/SimulationEngineCore.ts');
const typesSource = source('../../src/engine/types/index.ts');

describe('OS setup wizard transaction authority', () => {
  it('uses the physical-media prepare/commit transaction instead of legacy optimistic OS mutation', () => {
    expect(wizardSource).toContain('prepareOsInstallFromInsertedMedia');
    expect(wizardSource).toContain('commitOsInstall');
    expect(wizardSource).not.toMatch(/\bupgradeOs\b/);
    expect(wizardSource).not.toMatch(/\badvanceTime\b/);
  });

  it('does not advertise a destructive clean-format mode that has no implemented semantics', () => {
    expect(wizardSource).not.toContain('Clean Installation (Format Hard Drive)');
  });

  it('removes the legacy action that could charge money and install an OS in one dispatch', () => {
    expect(typesSource).not.toContain('HARDWARE_UPGRADE_OS');
    expect(coreSource).not.toContain("case 'HARDWARE_UPGRADE_OS'");
    expect(storeSource).not.toMatch(/\bupgradeOs\s*:/);
  });
});

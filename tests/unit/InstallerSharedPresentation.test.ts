import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const view = readFileSync('src/apps/installer/InstallerWizardView.tsx','utf8');
const legacy = readFileSync('src/apps/installer/InstallerWizard.tsx','utf8');
describe('Original Orion installer six-step view shared across simulation owners', () => {
  it('keeps original OS/RAM/disk checks and opt-out choices, without legacy store imports', () => {
    expect(legacy).toContain('<InstallerWizardView');
    expect(legacy).toContain('engine.software.previewInstaller');
    expect(view).toContain('System Requirements Check');
    expect(view).toContain('Select Additional Tasks');
    expect(view).toContain('Completing Setup');
    expect(view).toContain('acceptedOffers');
    expect(view).not.toContain('useSimulationStore');
    expect(view).not.toContain('engine.dispatchAction');
  });
});

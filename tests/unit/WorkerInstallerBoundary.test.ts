import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const panel = readFileSync('src/simulation/host/WorkerInstallerPanel.tsx','utf8');
const explorer = readFileSync('src/simulation/host/WorkerDesktopVfsApps.tsx','utf8');
const kernel = readFileSync('src/engine/kernel/SimulationKernel.ts','utf8');
const wizard = readFileSync('src/apps/installer/InstallerWizardView.tsx','utf8');
describe('Worker Installer owner isolation', () => {
  it('uses only bounded Worker preflight and owner commit', () => {
    expect(panel).toContain("session.read({ kind: 'installer', filePath })");
    expect(panel).toContain("type: 'SOFTWARE_INSTALL_FROM_DOWNLOAD'");
    expect(panel).toContain('<InstallerWizardView');
    expect(panel).not.toContain('useSimulationStore');
    expect(panel).not.toContain('defaultEngine');
  });
  it('opens downloaded files and rechecks canonical provenance at commit', () => {
    expect(explorer).toContain("file.kind === 'installer' ? openInstaller(file.path)");
    expect(kernel).toContain("transfer.status !== 'complete'");
    expect(kernel).toContain('file.metadata?.author !== transfer.sourceId');
    expect(kernel).toContain('DOWNLOAD_CATALOG.find');
    expect(kernel).toContain('file.metadata?.downloadTaskId');
    expect(kernel).toContain('read.preview.compatibilityResult.isCompatible');
    expect(wizard).not.toContain('useSimulationStore');
  });
});

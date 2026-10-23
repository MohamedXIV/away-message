import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(path, 'utf8');
const view = read('src/apps/safesweep/SafeSweepView.tsx');
const adapter = read('src/apps/safesweep/SafeSweepApp.tsx');
const worker = read('src/simulation/host/WorkerSafeSweepPanel.tsx');
describe('real SafeSweep cleanup across legacy and Worker hosts', () => {
  it('retains original UI without inventing cookies, scanning files, or claiming success on command send', () => {
    expect(adapter).toContain('<SafeSweepView');
    expect(view).toContain('SafeSweep Anti-Spyware 2006');
    expect(view).toContain('Installed Software & Adware Scanner');
    expect(view).toContain('onUninstall(threat.id)');
    expect(view).toContain('result.success');
    expect(view).toContain('failures.length');
    expect(view).not.toContain('cookie_doubleclick');
    expect(view).not.toContain('useSimulationStore');
    expect(view).not.toContain('System is now secure');
  });
  it('only scans canonical installed software and dispatches actual uninstall to one Worker', () => {
    expect(worker).toContain("session.read({ kind: 'apps' })");
    expect(worker).toContain("app.appId === 'app.safesweep'");
    expect(worker).toContain("type: 'SOFTWARE_UNINSTALL'");
    expect(worker).toContain('<SafeSweepView');
    expect(worker).not.toContain('defaultEngine');
    expect(worker).not.toContain('useSimulationStore');
  });
});

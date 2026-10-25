import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const view = readFileSync(fileURLToPath(new URL('../../src/apps/browser/VoyagerBrowserChrome.tsx', import.meta.url)), 'utf8');
const adapter = readFileSync(fileURLToPath(new URL('../../src/apps/browser/VoyagerBrowserApp.tsx', import.meta.url)), 'utf8');
describe('Shared original Voyager visual chrome', () => {
  it('keeps the original address bar, nav/bookmark controls and OS chrome independently of engine', () => {
    expect(adapter).toContain('<VoyagerBrowserChrome');
    expect(view).toContain('Voyager 6.0');
    expect(view).toContain('DownloadHub');
    expect(view).toContain('Save Page');
    expect(view).toContain('onNavigate(');
    expect(view).not.toContain('useSimulationStore');
    expect(view).not.toContain('useBoundedSimulationRead');
    expect(view).not.toContain('InternetRouter');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const source = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
const view = source('../../src/internet/sites/DownloadHubView.tsx');
const adapter = source('../../src/internet/sites/DownloadHubSite.tsx');
const catalog = source('../../src/internet/sites/DownloadHubCatalog.ts');
describe('2006 DownloadHub shared authored presentation', () => {
  it('retains original catalog, download buttons and world-event banner in a pure view', () => {
    expect(view).toContain('DOWNLOAD_CATALOG');
    expect(catalog).toContain('pulse52_setup.exe');
    expect(catalog).toContain('photobox_setup.exe');
    expect(catalog).not.toContain('useSimulationStore');
    expect(view).toContain('DownloadHub.local — Software Archive');
    expect(view).toContain('handleDownloadFile(item)');
    expect(view).toContain('dynamicCount');
    expect(view).not.toContain('useSimulationStore');
    expect(view).not.toContain('useBoundedSimulationRead');
    expect(view).not.toContain('useOsHost');
  });
  it('retains original DownloadHub host-driven download action and live world projections', () => {
    expect(adapter).toContain('<DownloadHubView');
    expect(adapter).toContain('useOsHost()');
    expect(adapter).toContain('network.startDownload({');
    expect(adapter).toContain('getDownloadHubDynamicItems');
  });
});

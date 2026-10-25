import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const code = readFileSync('src/simulation/host/WorkerVoyagerPanel.tsx', 'utf8');
describe('Worker-only original Voyager adapters', () => {
  it('uses bounded owner web/download/VFS APIs but never legacy InternetRouter', () => {
    expect(code).toContain('<VoyagerBrowserChrome');
    expect(code).toContain('<DownloadHubView');
    expect(code).toContain("session.read({ kind: 'apps' })");
    expect(code).toContain("session.read({ kind: 'website' })");
    expect(code).toContain("type: 'VFS_CREATE_FILE'");
    expect(code).toContain('network.startDownload({');
    expect(code).not.toContain("from '../../internet/InternetRouter'");
    expect(code).not.toContain('useSimulationStore');
  });
});

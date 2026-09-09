import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const siteSource = readFileSync('src/internet/sites/DownloadHubSite.tsx', 'utf8');
const hostSource = readFileSync('src/desktop/host/OsHostContext.tsx', 'utf8');

describe('DownloadHub OS host boundary', () => {
  it('routes browser-initiated transfers through OsHost instead of dispatching download actions directly', () => {
    expect(siteSource).toContain("from '../../desktop/host/OsHostContext'");
    expect(siteSource).toContain('useOsHost()');
    expect(siteSource).toContain('network.transfers');
    expect(siteSource).toContain('network.startDownload({');
    expect(siteSource).not.toContain("type: 'DOWNLOAD_START'");
  });

  it('preserves installer file metadata through the neutral host transfer API', () => {
    expect(siteSource).toContain("fileKind: 'installer'");
    expect(hostSource).toContain("fileKind?: 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'text'");
    expect(hostSource).toContain('fileKind: params.fileKind');
  });
});

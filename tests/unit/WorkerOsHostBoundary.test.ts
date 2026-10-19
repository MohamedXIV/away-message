import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = (file: string) => readFileSync(
  fileURLToPath(new URL(file, import.meta.url)), 'utf8',
);
const contract = path('../../src/desktop/host/OsHostApiContext.tsx');
const legacy = path('../../src/desktop/host/OsHostContext.tsx');
const worker = path('../../src/simulation/host/WorkerOsHostProvider.tsx');
const flashfetch = path('../../src/apps/flashfetch/FlashFetchApp.tsx');

describe('single-owner OS Host API adapters', () => {
  it('keeps pure shared context free from the eager engine and legacy store', () => {
    expect(contract).toContain('createContext<OsHostApi | null>');
    expect(contract).toContain('resolveHostNetworkState');
    expect(contract).not.toContain('useSimulationStore');
    expect(contract).not.toContain('useBoundedSimulationRead');
    expect(contract).not.toContain('SimulationEngine');
    expect(legacy).toContain('useSimulationStore');
    expect(legacy).toContain('<OsHostApiProvider');
  });
  it('routes worker file and download writes only through typed commands with finite validation', () => {
    expect(worker).toContain("session.read({ kind: 'file', path })");
    expect(worker).toContain("type: 'VFS_CREATE_FILE'");
    expect(worker).toContain("type: 'VFS_DELETE_FILE'");
    expect(worker).toContain("type: 'DOWNLOAD_START'");
    expect(worker).toContain("type: 'DOWNLOAD_CANCEL'");
    expect(worker).toContain("target.hostname.endsWith('.local')");
    expect(worker).toContain("session.read({ kind: 'apps' })");
    expect(worker).not.toContain('useSimulationStore');
    expect(worker).not.toContain('defaultEngine');
    expect(worker).not.toContain("from '../../desktop/host/OsHostContext'");
  });
  it('reuses the actual authored FlashFetch view through pure shared host boundary', () => {
    expect(flashfetch).toContain("from '../../desktop/host/OsHostApiContext'");
    expect(flashfetch).not.toContain('useSimulationStore');
    expect(worker).toContain('<FlashFetchApp />');
  });
});

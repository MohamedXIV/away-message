import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/apps/flashfetch/FlashFetchApp.tsx', 'utf8');

describe('FlashFetch OS host boundary', () => {
  it('consumes transfer and network services through OsHost instead of the simulation store', () => {
    expect(source).toContain("from '../../desktop/host/OsHostContext'");
    expect(source).toContain('useOsHost()');
    expect(source).not.toContain('useSimulationStore');
    expect(source).not.toContain("type: 'DOWNLOAD_START'");
    expect(source).not.toContain("type: 'DOWNLOAD_CANCEL'");
    expect(source).not.toContain('state.hardware.connectionType');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hostSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/host/OsHostContext.tsx', import.meta.url)),
  'utf8',
);

describe('OsHost presentation contract', () => {
  it('exposes the active presentation and capabilities instead of forcing apps to branch on OS versions', () => {
    expect(hostSource).toContain('presentation: OsPresentationProfile | null');
    expect(hostSource).toContain("capabilities: OsPresentationProfile['capabilities'] | null");
    expect(hostSource).toContain('resolveActiveOsPresentation(osVersion)');
    expect(hostSource).toContain('presentation,');
    expect(hostSource).toContain('capabilities: presentation?.capabilities ?? null');
  });
});

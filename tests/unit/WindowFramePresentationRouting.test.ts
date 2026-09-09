import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const windowFrameSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/WindowFrame.tsx', import.meta.url)),
  'utf8',
);

const desktopShellSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/DesktopShell.tsx', import.meta.url)),
  'utf8',
);

describe('central desktop OS presentation routing', () => {
  it('does not route Orion generations with per-component version string checks', () => {
    for (const source of [windowFrameSource, desktopShellSource]) {
      expect(source).not.toContain("version.includes('5.')");
      expect(source).not.toContain("version.includes('6.')");
      expect(source).not.toContain("version.includes('7.')");
      expect(source).not.toContain("v.includes('5.')");
      expect(source).not.toContain("v.includes('6.')");
      expect(source).not.toContain("v.includes('7.')");
      expect(source).not.toContain("osVersion === 'Orion_6.0'");
    }
  });

  it('routes WindowFrame sounds from the resolved nullable OS presentation scheme', () => {
    expect(windowFrameSource).toContain('osPresentation?.soundSchemeId');
    expect(windowFrameSource).not.toMatch(/playWindowSound\([^\n]*osVersion/);
  });
});

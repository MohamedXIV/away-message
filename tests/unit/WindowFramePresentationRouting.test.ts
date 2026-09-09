import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const windowFrameSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/WindowFrame.tsx', import.meta.url)),
  'utf8',
);

describe('WindowFrame OS presentation routing', () => {
  it('does not route Orion generations with per-component version string checks', () => {
    expect(windowFrameSource).not.toContain("version.includes('5.')");
    expect(windowFrameSource).not.toContain("version.includes('6.')");
    expect(windowFrameSource).not.toContain("version.includes('7.')");
    expect(windowFrameSource).not.toContain("osVersion === 'Orion_6.0'");
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

describe('Issue #8 desktop boot boundary', () => {
  it('routes desktop availability through the canonical boot resolver', () => {
    const source = read('src/desktop/DesktopShell.tsx');
    expect(source).toContain('resolvePcBootState');
    expect(source).toContain('bootState');
    expect(source).not.toMatch(/if \(!osVersion\)/);
  });

  it('uses the simulation power action instead of mutating HardwareEngine directly', () => {
    const desktop = read('src/desktop/DesktopShell.tsx');
    const store = read('src/store/useSimulationStore.ts');
    expect(desktop).toContain('setComputerPower');
    expect(desktop).not.toContain('engine.hardware.setPower');
    expect(store).toContain('setComputerPower');
    expect(store).toContain("type: 'COMPUTER_SET_POWER'");
  });
});

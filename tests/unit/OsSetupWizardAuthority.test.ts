import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wizardSource = readFileSync(
  new URL('../../src/apps/installer/OsSetupWizard.tsx', import.meta.url),
  'utf8',
);

describe('OS setup wizard transaction authority', () => {
  it('uses the physical-media prepare/commit transaction instead of legacy optimistic OS mutation', () => {
    expect(wizardSource).toContain('prepareOsInstallFromInsertedMedia');
    expect(wizardSource).toContain('commitOsInstall');
    expect(wizardSource).not.toMatch(/\bupgradeOs\b/);
    expect(wizardSource).not.toMatch(/\badvanceTime\b/);
  });

  it('does not advertise a destructive clean-format mode that has no implemented semantics', () => {
    expect(wizardSource).not.toContain('Clean Installation (Format Hard Drive)');
  });
});

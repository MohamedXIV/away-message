import { expect, test } from '@playwright/test';

test('a real module Worker runs canonical #175 simulation, bounded changes and explicit snapshot recovery', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const proof = await page.evaluate(async () => {
    // Vite serves this module inside Chromium only.
    // @ts-expect-error Browser-only Vite URL.
    const { createBrowserSimulationHost } = await import(/* @vite-ignore */ '/src/simulation/host/WorkerSimulationHost.ts');
    const host = await createBrowserSimulationHost();
    const changes: Array<{ revision: number; changedDomains: string[] }> = [];
    const off = host.subscribe((change: { revision: number; changedDomains: string[] }) => {
      changes.push({ revision: change.revision, changedDomains: [...change.changedDomains] });
    });
    try {
      const start = await host.query({ kind: 'hud' });
      const command = await host.dispatch({ type: 'WORLD_SET_FLAG', key: 'worker_browser_proof', value: true });
      await host.advanceGameMinutes(15, 'real browser worker test');
      const hud = await host.query({ kind: 'hud' });
      const privateActor = await host.query({ kind: 'actor', actorId: 'not_known' });
      const snapshot = await host.exportSnapshot();
      await host.advanceGameMinutes(10, 'later');
      await host.loadSnapshot(snapshot);
      const resumed = await host.query({ kind: 'hud' });
      return {
        start: start.time.totalMinutes,
        after: hud.time.totalMinutes,
        resumed: resumed.time.totalMinutes,
        snapshotTime: snapshot.time.totalMinutes,
        workerFlag: snapshot.world.flags.worker_browser_proof,
        privateActor,
        command,
        changes,
      };
    } finally {
      off();
      host.dispose();
    }
  });
  expect(proof.command).toMatchObject({ success: true });
  expect(proof.workerFlag).toBe(true);
  expect(proof.after).toBe(proof.start + 15);
  expect(proof.resumed).toBe(proof.snapshotTime);
  expect(proof.privateActor).toBeNull();
  expect(proof.changes.length).toBeGreaterThan(1);
  expect(proof.changes.at(-1)?.changedDomains).toContain('unknown');
  expect(JSON.stringify(proof.changes)).not.toContain('conversations');
});

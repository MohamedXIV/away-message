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

test('module Worker owns a real v6 IndexedDB slot across disposal, cold boot and Pulse UI metadata', async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite-only runtime modules are resolved inside the browser.
    const { createBrowserSimulationHost } = await import(/* @vite-ignore */ '/src/simulation/host/WorkerSimulationHost.ts');
    // @ts-expect-error Browser-only Vite worker session.
    const { saveBrowserSimulationSlot, openBrowserSimulationSlot } = await import(/* @vite-ignore */ '/src/simulation/host/WorkerSlotSession.ts');
    // @ts-expect-error Browser-only Vite Pulse helper.
    const { setCurrentPulseSlotId, getPulseSlotStorageKey } = await import(/* @vite-ignore */ '/src/apps/pulse/persistence.ts');
    const slotId = 'worker_browser_slot';
    setCurrentPulseSlotId(slotId);
    window.localStorage.setItem(getPulseSlotStorageKey(slotId), JSON.stringify({ marker: 'PULSE_FROM_UI' }));

    const original = await createBrowserSimulationHost();
    let summary: { id: string; name: string } | null = null;
    let timeAtSave = 0;
    try {
      const action = await original.dispatch({
        type: 'WORLD_SET_FLAG', key: 'worker_slot_truth', value: true,
      });
      if (!action.success) throw new Error('Worker action rejected');
      await original.advanceGameMinutes(6, 'worker browser slot');
      timeAtSave = (await original.query({ kind: 'hud' })).time.totalMinutes;
      summary = await saveBrowserSimulationSlot(original, slotId, 'Worker browser save');
    } finally { original.dispose(); }

    // The source Worker is DEAD. Slot boot creates a fresh Worker; no
    // synchronous SimulationKernel or main-thread state transfer is involved.
    window.localStorage.removeItem(getPulseSlotStorageKey(slotId));
    const reopened = await openBrowserSimulationSlot(slotId);
    try {
      const hud = await reopened.query({ kind: 'hud' });
      const snapshot = await reopened.exportSnapshot();
      const savedPulse = window.localStorage.getItem(getPulseSlotStorageKey(slotId));
      const privateRead = await reopened.query({
        kind: 'conversation', actorId: 'guessed_private', limit: 50,
      });
      return {
        summary, timeAtSave, loadedTime: hud.time.totalMinutes,
        flag: snapshot.world.flags.worker_slot_truth,
        pulseRestored: savedPulse?.includes('PULSE_FROM_UI'),
        privateMessages: privateRead.messages.length,
      };
    } finally { reopened.dispose(); }
  });
  expect(result.summary).toMatchObject({ id: 'worker_browser_slot', name: 'Worker browser save' });
  expect(result.loadedTime).toBe(result.timeAtSave);
  expect(result.flag).toBe(true);
  expect(result.pulseRestored).toBe(true);
  expect(result.privateMessages).toBe(0);
});

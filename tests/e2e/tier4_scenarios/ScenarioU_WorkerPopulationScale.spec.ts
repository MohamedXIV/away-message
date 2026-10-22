import { expect, test } from '@playwright/test';

/**
 * Real module Worker evidence on the ordinary / production-style entry.
 *
 * Only the explicit DEV Classic page prepares benchmark save slots. Its
 * main-thread engine is destroyed via full-page navigation before any
 * measured Worker operation. The test observes the SAME Worker that the
 * actual game UI owns; it does not create a competing test simulation.
 */
test('20/100/250/500 canonical population slots load, tick, publish and cold-save through one real Worker', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    const seen: Worker[] = [];
    (window as any).__scaleWorkerSpies = seen;
    window.Worker = class extends OriginalWorker {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        seen.push(this);
      }
    };
  });

  // Pre-population is fixture SETUP, not a performance measurement. No
  // benchmark factory or main-thread simulation is imported on the / route.
  await page.goto('/?runtime=legacy');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__slots))).toBe(true);
  await page.evaluate(async () => {
    // @ts-expect-error Vite-only browser test module.
    const { createSimulationBenchmarkFixture } = await import(/* @vite-ignore */ '/src/engine/benchmark/SimulationBenchmarkFixture.ts');
    const slotIds = ['slot_1', 'slot_2', 'slot_3', 'autosave'];
    const populations = [20, 100, 250, 500];
    for (let index = 0; index < populations.length; index++) {
      const fixture = createSimulationBenchmarkFixture(populations[index]);
      await (window as any).__slots.saveSlot(
        fixture.engine, slotIds[index], 'Population ' + populations[index],
      );
    }
  });

  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);

  const tiers = [
    { population: 20, slot: 'slot_1' },
    { population: 100, slot: 'slot_2' },
    { population: 250, slot: 'slot_3' },
    { population: 500, slot: 'autosave' },
  ];
  for (let index = 0; index < tiers.length; index++) {
    const tier = tiers[index]!;
    await page.getByRole('combobox', { name: 'Save slot' }).selectOption(tier.slot);
    await page.getByRole('button', { name: 'Load game' }).click();
    await expect(page.getByTestId('worker-phase')).toHaveText('game');
    await expect(page.getByTestId('worker-hud')).toBeVisible();
    await page.getByRole('button', { name: 'Pause clock' }).click();

    const measured = await page.evaluate(async ({ population, expectedWorkerCount }) => {
      const workers = (window as any).__scaleWorkerSpies as Worker[];
      if (workers.length !== expectedWorkerCount) {
        throw new Error(`Expected ${expectedWorkerCount} distinct Worker boots, got ${workers.length}`);
      }
      const worker = workers.at(-1)!;
      let nextProbeId = 1_000_000 + population * 100;
      const rpc = (command: Record<string, unknown>): Promise<any> => {
        const id = ++nextProbeId;
        return new Promise((resolve, reject) => {
          const onMessage = (event: MessageEvent<any>) => {
            const result = event.data;
            if (result?.type !== 'result' || result.id !== id) return;
            worker.removeEventListener('message', onMessage);
            if (result.ok) resolve(result.value);
            else reject(new Error(result.error?.message ?? 'Worker probe failed'));
          };
          worker.addEventListener('message', onMessage);
          worker.postMessage({ ...command, id });
        });
      };

      const before = await rpc({ op: 'query', query: { kind: 'hud' } });
      const querySamples: number[] = [];
      for (let sample = 0; sample < 3; sample++) {
        const t = performance.now();
        const view = await rpc({ op: 'query', query: { kind: 'gameView' } });
        querySamples.push(performance.now() - t);
        if (view.revision !== view.hud.revision ||
            view.revision !== view.world.revision ||
            view.revision !== view.player.revision) {
          throw new Error('Non-atomic Worker gameView projection');
        }
        if (JSON.stringify(view).length > 40_000) throw new Error('Unbounded Worker gameView');
      }
      const start = performance.now();
      await rpc({ op: 'advance', minutes: 1, reason: 'population-browser-gate' });
      const tickMs = performance.now() - start;
      const after = await rpc({ op: 'query', query: { kind: 'hud' } });
      const snapshot = await rpc({ op: 'export' });
      const buddies = snapshot.social?.buddies;
      const count = buddies ? Object.keys(buddies).length : 0;
      if (count !== population) throw new Error(`Worker has ${count} actors, expected ${population}`);
      if (after.time.totalMinutes !== before.time.totalMinutes + 1) {
        throw new Error('Worker clock did not advance exactly one world minute');
      }
      return {
        population, actors: count, minute: after.time.totalMinutes,
        workerBoots: workers.length, boundedQueries: querySamples.length,
        querySamplesMs: querySamples.map(ms => Math.round(ms * 1000) / 1000),
        oneMinuteRoundTripMs: Math.round(tickMs * 1000) / 1000,
        snapshotBytes: JSON.stringify(snapshot).length,
      };
    }, { population: tier.population, expectedWorkerCount: index + 1 });

    console.info('[worker-population-browser]', JSON.stringify(measured));
    await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
      .toBeGreaterThanOrEqual(measured.minute);

    // Each population now persists a genuinely Worker-owned mutation.
    await page.getByRole('button', { name: 'Save game' }).click();
    await expect(page.getByText('Saved to ' + tier.slot)).toBeVisible();
    if (index < tiers.length - 1) {
      await page.getByRole('button', { name: 'Return to menu' }).click();
      await expect(page.getByTestId('worker-phase')).toHaveText('menu');
    }
  }

  // Full document navigation must discard the 500-actor Worker owner and
  // bring back a SINGLE new owner from the 500-actor canonical saved slot.
  await page.reload();
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('autosave');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect(page.getByTestId('worker-hud')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
});

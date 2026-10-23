import { expect, test, type Page } from '@playwright/test';

interface RichWorldSample {
  roster: number;
  appointments: number;
  cappedActors: number;
  contactCount: number;
  conversationMessages: number;
  minute: number;
  tripCount: number;
  remoteWithoutSpatial: boolean;
  tripState: string;
  appointmentState: string;
  agendaState: string;
  oneMinuteRoundTripMs: number | null;
}

/** Probe the already-running UI's sole canonical module Worker. Never
 * construct a parallel test owner or expose a Worker lab query to players.
 */
async function sampleRealWorker(
  page: Page,
  options: { expectedRemoteId: string; knownActorId: string; advance: boolean },
): Promise<RichWorldSample> {
  return page.evaluate(async ({ expectedRemoteId, knownActorId, advance }) => {
    const owners = (window as any).__richWorkerSpies as Worker[];
    if (owners.length !== 1) throw new Error(`Expected one UI Worker, found ${owners.length}`);
    if ('__simStore' in window || '__simEngine' in window) {
      throw new Error('Classic simulation leaked into production-root play');
    }
    const worker = owners[0]!;
    let probeId = 3_000_000;
    const rpc = (command: Record<string, unknown>): Promise<any> => {
      const id = ++probeId;
      return new Promise((resolve, reject) => {
        const listener = (event: MessageEvent<any>) => {
          if (event.data?.type !== 'result' || event.data.id !== id) return;
          worker.removeEventListener('message', listener);
          if (event.data.ok) resolve(event.data.value);
          else reject(new Error(event.data.error?.message ?? 'Worker response failed'));
        };
        worker.addEventListener('message', listener);
        worker.postMessage({ ...command, id });
      });
    };
    const initial = await rpc({ op: 'query', query: { kind: 'hud' } });
    const lab = await rpc({ op: 'query', query: { kind: 'labPage', actorPage: 0, meetingPage: 0 } });
    const contacts = await rpc({ op: 'query', query: { kind: 'messenger', maxContacts: 32 } });
    const conversation = await rpc({
      op: 'query', query: { kind: 'conversation', actorId: knownActorId, limit: 30, offset: 0 },
    });
    const view = await rpc({ op: 'query', query: { kind: 'gameView' } });
    if (JSON.stringify(view).length > 40_000 ||
        view.revision !== view.hud.revision ||
        view.revision !== view.player.revision ||
        view.revision !== view.world.revision) {
      throw new Error('Worker rich population view was unbounded or non-atomic');
    }
    let tickMs: number | null = null;
    if (advance) {
      const start = performance.now();
      await rpc({ op: 'advance', minutes: 1, reason: 'rich-browser-worker' });
      tickMs = Math.round((performance.now() - start) * 1000) / 1000;
    }
    const after = await rpc({ op: 'query', query: { kind: 'hud' } });
    if (after.time.totalMinutes !== initial.time.totalMinutes + (advance ? 1 : 0)) {
      throw new Error('Worker minute advancement was inconsistent');
    }
    const snapshot = await rpc({ op: 'export' });
    const mobility = snapshot.npcMobility ?? {};
    const trips = mobility.trips ?? {};
    return {
      roster: lab.roster.total,
      appointments: lab.appointments.total,
      cappedActors: lab.actors.length,
      contactCount: contacts.contacts.length,
      conversationMessages: conversation.total,
      minute: after.time.totalMinutes,
      tripCount: Object.keys(trips).length,
      remoteWithoutSpatial: !Object.prototype.hasOwnProperty.call(
        snapshot.actorSpatialPositions ?? {}, expectedRemoteId,
      ) && !Object.prototype.hasOwnProperty.call(trips, expectedRemoteId),
      tripState: JSON.stringify(trips),
      appointmentState: JSON.stringify(snapshot.world?.appointments ?? []),
      agendaState: JSON.stringify(snapshot.social?.agenda ?? {}),
      oneMinuteRoundTripMs: tickMs,
    };
  }, options);
}

test('real 500-NPC #177 agenda/appointment/route fixture persists through production-root Worker', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const BaseWorker = window.Worker;
    const seen: Worker[] = [];
    (window as any).__richWorkerSpies = seen;
    window.Worker = class extends BaseWorker {
      constructor(url: URL | string, options?: WorkerOptions) {
        super(url, options);
        seen.push(this);
      }
    };
  });

  // DEV-only setup prepares the ACTUAL shared #177 fixture, not a separate
  // lightweight synthetic population. It is destroyed by full navigation
  // before any gameplay operation or measured browser Worker work.
  await page.goto('/?runtime=legacy');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__slots))).toBe(true);
  const seeded = await page.evaluate(async () => {
    // @ts-expect-error dev-server TS module import, not a production dependency.
    const { createPopulationScaleFixture } = await import(/* @vite-ignore */ '/src/engine/benchmark/PopulationScaleFixture.ts');
    const fixture = createPopulationScaleFixture(500);
    const result = {
      local: fixture.localActorIds.length,
      remote: fixture.remoteActorIds.length,
      agendas: fixture.agendaActorIds.length,
      appointments: fixture.appointmentActorIds.length,
      knownActorId: fixture.knownActorIds[0]!,
      remoteActorId: fixture.remoteActorIds[0]!,
      messages: fixture.seededMessageCount,
      routes: fixture.routes.length,
    };
    await (window as any).__slots.saveSlot(fixture.engine, 'slot_1', 'Rich 500 actor worker fixture');
    return result;
  });
  expect(seeded.local + seeded.remote).toBe(500);
  expect(seeded.agendas).toBe(seeded.local);
  expect(seeded.appointments).toBeGreaterThan(0);
  expect(seeded.routes).toBeGreaterThan(0);
  expect(seeded.messages).toBeGreaterThan(0);

  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_1');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  const first = await sampleRealWorker(page, {
    expectedRemoteId: seeded.remoteActorId,
    knownActorId: seeded.knownActorId,
    advance: true,
  });
  expect(first.roster).toBe(500);
  expect(first.appointments).toBe(seeded.appointments);
  expect(first.cappedActors).toBeLessThanOrEqual(16);
  expect(first.contactCount).toBeLessThanOrEqual(32);
  expect(first.conversationMessages).toBeGreaterThanOrEqual(6);
  expect(first.remoteWithoutSpatial).toBe(true);
  expect(first.tripCount).toBeGreaterThan(0);
  console.info('[worker-rich-browser]', JSON.stringify({
    population: 500, local: seeded.local, remote: seeded.remote,
    agendas: seeded.agendas, appointments: seeded.appointments,
    routes: seeded.routes, trips: first.tripCount,
    contacts: first.contactCount, messagesInKnownConversation: first.conversationMessages,
    oneMinuteRoundTripMs: first.oneMinuteRoundTripMs,
    note: 'single sample; not a percentile/optimization acceptance',
  }));

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_1');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  const cold = await sampleRealWorker(page, {
    expectedRemoteId: seeded.remoteActorId,
    knownActorId: seeded.knownActorId,
    advance: false,
  });
  expect(cold.roster).toBe(500);
  expect(cold.appointments).toBe(first.appointments);
  expect(cold.minute).toBe(first.minute);
  expect(cold.tripState).toEqual(first.tripState);
  expect(cold.appointmentState).toEqual(first.appointmentState);
  expect(cold.agendaState).toEqual(first.agendaState);
  expect(cold.remoteWithoutSpatial).toBe(true);
  expect(cold.conversationMessages).toBeGreaterThanOrEqual(6);
});

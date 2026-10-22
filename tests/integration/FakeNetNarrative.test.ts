import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  buildGeneratedSiteNarrative,
  buildNightBoardNarrative,
  createFakeNetRuntime,
} from '../../src/narrative/fakeNet';

function snapshot(engine: SimulationEngine): Record<string, string | string[]> {
  return {
    roster: engine.social.getBuddies().map((buddy) => buddy.id),
    website: JSON.stringify(engine.getWebsiteRead()),
    transit: JSON.stringify(engine.getTransitRead()),
    scenarios: JSON.stringify(engine.getScenarioState()),
    board: JSON.stringify(engine.getNightBoardRead()),
    hud: JSON.stringify(engine.getHudProjection()),
  };
}

describe('#184 fake-internet narratives and provenance', () => {
  it('builds the NightBoard flow offline with canonical/claim/opinion/lie/unknown labels', async () => {
    const engine = new SimulationEngine();
    const before = snapshot(engine);
    const runtime = createFakeNetRuntime(engine);

    const narrative = await buildNightBoardNarrative(runtime);
    expect(narrative.title).toContain('Canal pumps');
    expect(narrative.statements.map((statement) => statement.provenance)).toEqual([
      'rumor',
      'canonical_fact',
      'opinion',
      'lie',
      'unknown',
      'claim',
    ]);
    expect(narrative.statements.every((statement) => statement.author.kind === 'surface_only')).toBe(true);
    expect(narrative.statements.every((statement) => !statement.author.actorId)).toBe(true);

    const clock = narrative.statements[1]!;
    expect(clock.canonicalFact).toMatchObject({ key: 'current_day', source: 'clock.day' });
    expect(clock.text).toContain(String(clock.canonicalFact!.value));
    expect(narrative.statements[0]!.text).toContain('pumps cutting out');
    expect(narrative.statements[3]!.provenance).toBe('lie');
    expect(runtime.coordinator.isActive).toBe(false);

    // No world, transit, scenario, roster or existing-board mutation.
    expect(snapshot(engine)).toEqual(before);
    expect(engine.social.getBuddy('northbank_owl')).toBeUndefined();
    expect(JSON.stringify(engine.getWebsiteRead())).not.toContain('draining the whole canal');
  });

  it('preserves existing deterministic NPC-authored NightBoard threads', async () => {
    const engine = new SimulationEngine();
    const before = engine.getNightBoardRead();
    expect(before.threads.length).toBeGreaterThan(0);

    await buildNightBoardNarrative(createFakeNetRuntime(engine));
    const after = engine.getNightBoardRead();
    expect(after.threads).toEqual(before.threads);
  });

  it('builds the generated-site flow with sections, clue and guestbook provenance', async () => {
    const engine = new SimulationEngine();
    const before = snapshot(engine);
    const narrative = await buildGeneratedSiteNarrative(createFakeNetRuntime(engine));

    expect(narrative.title).toContain('CANAL WATCH');
    expect(narrative.statements.map((statement) => statement.role)).toEqual([
      'header', 'section', 'section', 'section', 'guestbook',
    ]);
    expect(narrative.statements.filter((statement) => statement.role === 'section').map((statement) => statement.heading))
      .toEqual(['updates', 'notes', 'clue']);
    expect(narrative.clueIds).toEqual(['intake_map']);
    expect(narrative.statements.find((statement) => statement.role === 'guestbook')?.provenance).toBe('rumor');
    expect(snapshot(engine)).toEqual(before);
    expect(JSON.stringify(engine.getWebsiteRead())).not.toContain('draining the canal');
  });

  it('keeps AI wording optional and never lets it change provenance or claim authority', async () => {
    const engine = new SimulationEngine();
    const offline = await buildNightBoardNarrative(createFakeNetRuntime(engine));
    const offlineTexts = offline.statements.map((statement) => statement.text);

    const authoritative = await buildNightBoardNarrative(createFakeNetRuntime(engine), {
      ai: async (plan) => `CONFIRMED BY THE CITY: ${plan.offlineText}`,
    });
    expect(authoritative.statements.map((statement) => statement.text)).toEqual(offlineTexts);
    expect(authoritative.statements.map((statement) => statement.provenance))
      .toEqual(offline.statements.map((statement) => statement.provenance));
    expect(JSON.stringify(authoritative.statements.map((statement) => statement.text)))
      .not.toContain('CONFIRMED BY');

    const failed = await buildNightBoardNarrative(createFakeNetRuntime(engine), {
      ai: async () => { throw new Error('offline'); },
    });
    expect(failed.statements.map((statement) => statement.text)).toEqual(offlineTexts);

    const timedOut = await buildNightBoardNarrative(createFakeNetRuntime(engine), {
      ai: () => new Promise<string>(() => {}),
      timeoutMs: 20,
    });
    expect(timedOut.statements.map((statement) => statement.text)).toEqual(offlineTexts);

    const styled = await buildNightBoardNarrative(createFakeNetRuntime(engine), {
      ai: async (plan) => plan.offlineText.toUpperCase(),
    });
    expect(styled.statements[0]!.text).toBe(offlineTexts[0]!.toUpperCase());
    // Canonical fact lines remain exact L0 and are never AI-realized.
    expect(styled.statements[1]!.text).toBe(offlineTexts[1]);
    expect(styled.statements.map((statement) => statement.provenance))
      .toEqual(offline.statements.map((statement) => statement.provenance));
  });

  it('generated misinformation never becomes canonical world or scenario state', async () => {
    const engine = new SimulationEngine();
    const before = snapshot(engine);
    const site = await buildGeneratedSiteNarrative(createFakeNetRuntime(engine), {
      ai: async (plan) => `${plan.offlineText} (officially confirmed)`,
    });
    expect(site.statements.map((statement) => statement.text).join(' ')).not.toContain('officially confirmed');
    expect(snapshot(engine)).toEqual(before);
    expect(engine.social.getBuddies().map((buddy) => buddy.id).length).toBe((before.roster as string[]).length);
  });
});

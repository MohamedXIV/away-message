import React, { useEffect, useMemo, useState } from 'react';
import { AI_PROVIDERS, hasConfiguredKey } from '../../ai/providers';
import { aiService } from '../../ai/service';
import { loadAISettings, saveAISettings } from '../../ai/settings';
import type { AIProviderId, AISettings, BenchmarkResult } from '../../ai/types';
import { generateCharacterImage } from '../../ai/imageService';
import { useSimulationStore } from '../../store/useSimulationStore';
import { ProceduralDirector } from '../../engine/ProceduralDirector';
import { pickTemplateEvents } from '../../ai/proceduralTemplates';
import type { ProceduralWorldEvent } from '../../ai/proceduralSchemas';
import { EventBus } from '../../engine/EventBus';
import { WorldEventsEngine } from '../../engine/WorldEventsEngine';
import { getAllReleases } from '../../engine/OsCatalog';
import { pickOsTemplate, templateToRelease } from '../../ai/osReleaseTemplates';
import { generateNewcomer, NEWCOMER_METVIA_ROTATION } from '../../engine/CharacterDirector';
import { getWeatherForDay } from '../../engine/WeatherEngine';
import type { BuddyMetVia, CharacterArchetype } from '../../engine/types';
import { CORE_BUDDIES, CORE_IDS } from '../../engine/coreBuddies';

const TEST_HOST = 'midnight-board.local';

export const AILabApp: React.FC = () => {
  const [settings, setSettings] = useState<AISettings>(() => loadAISettings());
  const [keyInput, setKeyInput] = useState('');
  const [siteName, setSiteName] = useState(TEST_HOST);
  const [chatPrompt, setChatPrompt] = useState('you still awake? the motel is too quiet tonight');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [notice, setNotice] = useState('Ready. Benchmark mode bypasses the ten-day cache.');
  const [imagePrompt, setImagePrompt] = useState('Maya at her desk with warm lamp light, small photo');
  const [imageBuddy, setImageBuddy] = useState(CORE_BUDDIES[0]?.id ?? CORE_IDS.MAYA);
  const [imageRunning, setImageRunning] = useState(false);
  const [imageResult, setImageResult] = useState<{ url: string; provider: string; fallback: boolean; error?: string } | null>(null);

  // Procedural Director tuning
  const engine = useSimulationStore((s) => s.engine);
  const worldDay = useSimulationStore((s) => s.state.time.day);
  const [procSeed, setProcSeed] = useState('oakhaven-lab');
  const [procTone, setProcTone] = useState<'grounded' | 'whimsical' | 'melancholy' | 'hopeful'>('grounded');
  const [procMaxEvents, setProcMaxEvents] = useState(2);
  const [procUseAI, setProcUseAI] = useState(true);
  const [procWeights, setProcWeights] = useState<Record<string, number>>({
    os_release: 3,
    site_launch: 3,
    city_news: 3,
    economy: 2,
    culture: 2,
    system: 1,
  });
  const [procPrefer, setProcPrefer] = useState<Record<string, boolean>>({ os_release: false, site_launch: false, city_news: false, economy: false, culture: false, system: false });
  const [procBusy, setProcBusy] = useState(false);
  const [procPreview, setProcPreview] = useState<ProceduralWorldEvent[] | null>(null);
  const [procMeta, setProcMeta] = useState<{ source: string; latencyMs?: number; error?: string } | null>(null);
  const [procInjectedIds, setProcInjectedIds] = useState<string[]>([]);

  // OS heavy generation tuning
  const [osFamily, setOsFamily] = useState<'5.x' | '6.x' | '7.x'>('7.x');
  const [osKind, setOsKind] = useState<'major' | 'minor' | 'patch' | 'beta' | 'hotfix'>('minor');
  const [osUseAI, setOsUseAI] = useState(true);
  const [osBusy, setOsBusy] = useState(false);
  const [osPreview, setOsPreview] = useState<unknown | null>(null);
  const [osMeta, setOsMeta] = useState<{ source: string; error?: string } | null>(null);

  // Character Lab — governed newcomers
  const [charArchetype, setCharArchetype] = useState<CharacterArchetype | 'random'>('random');
  const [charMetVia, setCharMetVia] = useState<BuddyMetVia>('nightboard');
  const [charUseAI, setCharUseAI] = useState(true);
  const [charBusy, setCharBusy] = useState(false);
  const [charPreview, setCharPreview] = useState<unknown | null>(null);
  const [charMeta, setCharMeta] = useState<{ source: string; error?: string } | null>(null);

  const activeProvider = useMemo(
    () => AI_PROVIDERS.find((provider) => provider.id === settings.activeProvider) || AI_PROVIDERS[0]!,
    [settings.activeProvider]
  );

  useEffect(() => {
    setKeyInput(settings.byokKeys[settings.activeProvider] || '');
  }, [settings.activeProvider, settings.byokKeys]);

  const updateSettings = (next: AISettings) => {
    setSettings(next);
    saveAISettings(next);
  };

  const handleProviderChange = (providerId: AIProviderId) => {
    updateSettings({ ...settings, activeProvider: providerId });
    setNotice(`Active provider changed to ${providerId}.`);
  };

  const handleSaveKey = () => {
    const byokKeys = { ...settings.byokKeys };
    if (keyInput.trim()) byokKeys[settings.activeProvider] = keyInput.trim();
    else delete byokKeys[settings.activeProvider];
    updateSettings({ ...settings, byokKeys });
    setNotice(`${activeProvider.label} BYOK key saved for this browser session only.`);
  };

  const runImageTest = async () => {
    if (imageRunning) return;
    setImageRunning(true);
    setImageResult(null);
    setNotice('Generating character image via Fal (small, era-appropriate)...');
    try {
      const buddyNames: Record<string, string> = { maya: 'Maya', ryan: 'Ryan', nora: 'Nora', henderson: 'Mr. Henderson' };
      const res = await generateCharacterImage(
        { buddyId: imageBuddy, buddyName: buddyNames[imageBuddy] || imageBuddy, prompt: imagePrompt, size: { width: 320, height: 240 } },
        settings
      );
      setImageResult({ url: res.url, provider: res.provider, fallback: res.fallback, error: res.error });
      setNotice(res.fallback ? `Fallback image used${res.error ? `: ${res.error}` : ''} — check Fal key.` : `Image generated via ${res.provider} — small and stored for Pulse.`);
    } catch (err) {
      setNotice(`Image error: ${(err as Error).message}`);
    } finally {
      setImageRunning(false);
    }
  };

  const buildWeightedAllowed = (): string[] => {
    const out: string[] = [];
    Object.entries(procWeights).forEach(([cat, w]) => {
      for (let i = 0; i < Math.max(0, Math.min(5, w)); i++) out.push(cat);
    });
    return out.length > 0 ? out : ['city_news'];
  };
  const buildPreferList = (): string[] => Object.entries(procPrefer).filter(([, v]) => v).map(([k]) => k);

  const runProcPreview = async () => {
    if (procBusy) return;
    setProcBusy(true);
    setProcPreview(null);
    setProcMeta(null);
    setNotice('Procedural preview — dry run (no world inject) using same governance as live.');
    try {
      const allowed = buildWeightedAllowed();
      const prefer = buildPreferList();
      // Dry run with temp engine so we don't pollute real world
      const tmpBus = new EventBus();
      const tmpWorld = new WorldEventsEngine(tmpBus, { ...engine.world.getState(), triggeredEvents: engine.world.getTriggeredEvents() } as any);
      // Copy pending too via inject
      const templDry = pickTemplateEvents(procSeed || 'oakhaven-lab', worldDay, allowed, procMaxEvents);
      if (!procUseAI) {
        const preview = templDry.map((e) => ({ ...e, triggerDay: Math.max(worldDay + 1, e.triggerDay) }));
        setProcPreview(preview as unknown as ProceduralWorldEvent[]);
        setProcMeta({ source: 'template (dry)', latencyMs: 0 });
      } else {
        const director = new ProceduralDirector(tmpWorld);
        const res = await director.generateNextBatch(worldDay, engine.clock.getTotalMinutes(), {
          worldSeed: procSeed || 'oakhaven-lab',
          maxEvents: procMaxEvents,
          allowedCategories: allowed as any,
          preferCategories: prefer as any,
          tone: procTone,
          useAI: true,
        });
        setProcPreview(res.events.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          category: e.category,
          triggerDay: e.triggerDay,
          triggerHour: e.triggerHour,
          knowledgePrompt: e.knowledgePrompt,
          siteUrl: e.siteUrl ?? null,
          cityWireHeadline: e.title,
          cityWireBody: e.description,
          cityWireByline: `CityWire Staff // Day ${e.triggerDay}`,
        })) as unknown as ProceduralWorldEvent[]);
        setProcMeta({ source: res.meta.source, latencyMs: res.meta.latencyMs, error: res.meta.error });
      }
      setNotice('Preview ready — review titles/knowledgePrompts before injecting.');
    } catch (err) {
      setNotice(`Preview error: ${(err as Error).message}`);
    } finally {
      setProcBusy(false);
    }
  };

  const runProcInject = async () => {
    if (procBusy) return;
    setProcBusy(true);
    setProcMeta(null);
    setNotice('Injecting procedural batch into live world (governed, validated, queued for future days)...');
    try {
      const allowed = buildWeightedAllowed();
      const prefer = buildPreferList();
      const director = new ProceduralDirector(engine.world);
      const res = await director.generateNextBatch(worldDay, engine.clock.getTotalMinutes(), {
        worldSeed: procSeed || 'oakhaven-lab',
        maxEvents: procMaxEvents,
        allowedCategories: allowed as any,
        preferCategories: prefer as any,
        tone: procTone,
        useAI: procUseAI,
      });
      setProcPreview(res.events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        triggerDay: e.triggerDay,
        triggerHour: e.triggerHour,
        knowledgePrompt: e.knowledgePrompt,
        siteUrl: e.siteUrl ?? null,
        cityWireHeadline: e.title,
        cityWireBody: e.description,
        cityWireByline: `CityWire Staff // Day ${e.triggerDay}`,
      })) as unknown as ProceduralWorldEvent[]);
      setProcMeta({ source: res.meta.source, latencyMs: res.meta.latencyMs, error: res.meta.error });
      setProcInjectedIds(res.events.map((e) => e.id));
      setNotice(`Injected ${res.events.length} events via ${res.meta.source} — check CityWire & pending queue.`);
    } catch (err) {
      setNotice(`Inject error: ${(err as Error).message}`);
    } finally {
      setProcBusy(false);
    }
  };

  const runOsPreview = async () => {
    if (osBusy) return;
    setOsBusy(true);
    setOsPreview(null);
    setOsMeta(null);
    try {
      if (!osUseAI) {
        const tmpl = pickOsTemplate(procSeed || 'oakhaven-lab', osFamily, worldDay);
        const rel = templateToRelease(tmpl, worldDay + 2);
        setOsPreview({ ...rel, source: 'template' });
        setOsMeta({ source: 'template' });
      } else {
        const { buildLorePrompt } = await import('../../ai/worldLore');
        const lore = buildLorePrompt();
        const system = `You generate ONE governed OS release for Orion OS in Oakhaven 1998-2006. Return JSON matching OsReleaseAiSchema exactly. Era-locked, .local only, mundane, no real brands. Family must be ${osFamily}, kind ${osKind}.`;
        const user = `World seed: ${procSeed || 'oakhaven-lab'} | Day ${worldDay} | Family ${osFamily} | Current OS ${(engine as any).os.getCurrentOsId()} | Lore: ${lore.slice(0, 600)} | Generate one release for Day ${worldDay + 2}.`;
        const { completeJson } = await import('../../ai/providers');
        const { getProviderModel, resolveApiKey } = await import('../../ai/providers');
        const { parseOsReleaseBatch } = await import('../../ai/osReleaseSchemas');
        const providerId = settings.activeProvider;
        const model = getProviderModel(providerId);
        const { key } = resolveApiKey(providerId, settings);
        if (!key) throw new Error('No API key for OS generation');
        const osSchema: Record<string, unknown> = {
          type: 'object',
          additionalProperties: false,
          properties: {
            releases: {
              type: 'array',
              minItems: 1,
              maxItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  version: { type: 'string' },
                  codename: { type: 'string' },
                  displayName: { type: 'string' },
                  family: { type: 'string', enum: ['4.x', '5.x', '6.x', '7.x'] },
                  kind: { type: 'string', enum: ['major', 'minor', 'patch', 'beta', 'hotfix'] },
                  channel: { type: 'string', enum: ['stable', 'beta', 'hotfix'] },
                  changelog: { type: 'array', items: { type: 'string' } },
                  blurb: { type: 'string' },
                  installSizeGB: { type: 'number' },
                  ramOverheadMB: { type: 'integer' },
                  bootTimeSeconds: { type: 'integer' },
                  minRamMB: { type: 'integer' },
                  minDiskGB: { type: 'number' },
                  price: { type: 'number' },
                  theme: { type: 'string', enum: ['orion48', 'orion50', 'orion60', 'orion70'] },
                },
                required: ['id', 'version', 'displayName', 'family', 'kind', 'channel', 'changelog', 'installSizeGB', 'ramOverheadMB', 'bootTimeSeconds', 'minRamMB', 'minDiskGB', 'theme'],
              },
            },
          },
          required: ['releases'],
        };
        const controller = new AbortController();
        const raw = await completeJson({
          providerId,
          model,
          apiKey: key,
          systemPrompt: system,
          userPrompt: user,
          jsonSchema: osSchema,
          signal: controller.signal,
        });
        const parsed = parseOsReleaseBatch(raw as unknown);
        setOsPreview({ ...(parsed.releases[0] as unknown as Record<string, unknown>), source: 'ai' } as unknown);
        setOsMeta({ source: 'ai' });
      }
    } catch (err) {
      const tmpl = pickOsTemplate(procSeed || 'oakhaven-lab', osFamily, worldDay);
      const rel = templateToRelease(tmpl, worldDay + 2);
      setOsPreview({ ...rel, source: 'template-fallback', error: (err as Error).message } as unknown);
      setOsMeta({ source: 'template-fallback', error: (err as Error).message });
    } finally {
      setOsBusy(false);
    }
  };

  const runOsInject = async () => {
    if (osBusy || !osPreview) return;
    setOsBusy(true);
    try {
      const preview = osPreview as unknown as { id:string; version:string; displayName:string; family: '4.x'|'5.x'|'6.x'|'7.x'; kind:'major'|'minor'|'patch'|'beta'|'hotfix'; channel:'stable'|'beta'|'hotfix'; changelog:string[]; blurb?:string; installSizeGB:number; ramOverheadMB:number; bootTimeSeconds:number; minRamMB:number; minDiskGB:number; price?:number; theme:'orion48'|'orion50'|'orion60'|'orion70' };
      const rel = {
        id: preview.id as any,
        version: preview.version,
        build: `${preview.version}.${1000 + Math.floor(Math.random()*9000)}`,
        codename: (preview as any).codename ?? 'Procedural',
        displayName: preview.displayName,
        family: preview.family,
        kind: preview.kind,
        channel: preview.channel,
        releaseDay: worldDay + 2,
        changelog: preview.changelog,
        requirements: { minRamMB: preview.minRamMB, minCpuTier: 1, minDiskGB: preview.minDiskGB },
        installSizeGB: preview.installSizeGB,
        ramOverheadMB: preview.ramOverheadMB,
        bootTimeSeconds: preview.bootTimeSeconds,
        theme: preview.theme,
        price: preview.price ?? 0,
        blurb: preview.blurb ?? '',
        isProcedural: true,
      } as unknown as import('../../engine/OsCatalog').OsRelease;
      (engine as any).os.registerProceduralRelease(rel);
      // Also create a world event so CityWire/NPCs know
      engine.world.injectProceduralEvents([{
        id: `os_${rel.id}`.replace(/[^a-z0-9_]/g,'_'),
        title: rel.displayName,
        description: rel.changelog.join(' • '),
        category: 'os_release',
        triggerDay: rel.releaseDay,
        knowledgePrompt: `${rel.displayName} is out — ${rel.blurb} Needs ${rel.requirements.minRamMB}MB RAM.`,
        siteUrl: 'http://orionsoft.local/',
      } as any]);
      setOsMeta({ source: 'injected' });
      setNotice(`OS injected: ${rel.displayName} for Day ${rel.releaseDay} — check TechMart/Control Panel.`);
    } catch (err) {
      setNotice(`OS inject error: ${(err as Error).message}`);
    } finally {
      setOsBusy(false);
    }
  };

  const runCharPreview = async () => {
    if (charBusy) return;
    setCharBusy(true);
    setCharPreview(null);
    setCharMeta(null);
    try {
      const existingIds = engine.social.getBuddies().map((b) => b.id);
      const res = await generateNewcomer(
        {
          metVia: charMetVia,
          day: worldDay,
          seed: `${procSeed || 'oakhaven-lab'}-char-${worldDay}`,
          archetype: charArchetype === 'random' ? undefined : charArchetype,
          useAI: charUseAI,
        },
        { existingIds }
      );
      setCharPreview({ ...res, definition: { ...res.definition } });
      setCharMeta({ source: res.source, error: res.error });
    } catch (err) {
      setCharMeta({ source: 'error', error: (err as Error).message });
    } finally {
      setCharBusy(false);
    }
  };

  const runCharInject = async () => {
    if (charBusy || (charPreview as unknown) == null) return;
    setCharBusy(true);
    try {
      const preview = charPreview as unknown as {
        definition: { id: string; displayName: string };
        introText: string;
      };
      const res = engine.dispatchAction({
        type: 'SOCIAL_ADD_BUDDY',
        buddy: (charPreview as any).definition,
        introText: preview.introText,
      });
      if (res.success) {
        setCharMeta({ source: 'injected' });
        setNotice(`${preview.definition.displayName} added! Say hi on Pulse — check the Others group.`);
        setCharPreview(null);
      } else {
        setCharMeta({ source: 'failed', error: res.error });
        setNotice(`Add failed: ${res.error} — preview again for a fresh id.`);
      }
    } catch (err) {
      setNotice(`Add error: ${(err as Error).message}`);
    } finally {
      setCharBusy(false);
    }
  };

  const runBenchmarks = async () => {
    if (running) return;
    setRunning(true);
    setResults([]);
    setNotice('Running providers sequentially to keep the comparison fair and avoid burst rate limits...');

    const nextResults: BenchmarkResult[] = [];
    for (const provider of AI_PROVIDERS) {
      const benchmarkSettings = { ...settings, activeProvider: provider.id };
      const siteResult = await aiService.benchmarkSite({
        host: siteName.trim().replace(/^https?:\/\//, '').split('/')[0] || TEST_HOST,
        pathname: '/',
        worldSeed: 'benchmark-seed',
        locale: 'en',
        providerId: provider.id,
        useCache: false,
      }, benchmarkSettings);
      nextResults.push(siteResult);
      setResults([...nextResults]);

      const first = CORE_BUDDIES[0];
      const chatResult = await aiService.benchmarkChat({
        buddyId: first?.id ?? CORE_IDS.MAYA,
        displayName: first?.displayName ?? 'Maya',
        handle: first?.handle ?? 'starlight_maya',
        persona: first?.persona ?? 'Quiet, observant, creative.',
        relationshipSummary: 'familiarity 25, trust 35, comfort 40, respect 45, annoyance 2',
        recentMessages: [{ sender: 'buddy', text: 'the rain is loud tonight' }],
        playerMessage: chatPrompt,
        providerId: provider.id,
        useCache: false,
      }, benchmarkSettings);
      nextResults.push(chatResult);
      setResults([...nextResults]);
    }

    setRunning(false);
    setNotice('Benchmark complete. Structural score checks schema validity; preview the text and judge style manually.');
  };

  return (
    <div className="h-full overflow-auto bg-[#ece9d8] p-3 font-sans text-xs text-black select-text">
      <div className="mb-3 border-2 border-[#808080] bg-[#f7f7f7] p-2 shadow-[inset_1px_1px_0_white]">
        <div className="font-bold text-[#000080]">Away Message AI Lab</div>
        <div className="mt-1 text-[11px] text-gray-700">Switch providers, test BYOK, and compare generated sites with NPC chat replies.</div>
      </div>

      <section className="mb-3 border border-gray-500 bg-white p-2">
        <h2 className="mb-2 font-bold">Provider settings</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="font-semibold" htmlFor="ai-provider">Service:</label>
          <select id="ai-provider" value={settings.activeProvider} onChange={(event) => handleProviderChange(event.target.value as AIProviderId)} className="border border-gray-500 bg-white px-2 py-1">
            {AI_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
          </select>
          <span className={`px-2 py-1 ${hasConfiguredKey(settings.activeProvider, settings) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {hasConfiguredKey(settings.activeProvider, settings) ? 'key available' : 'no key'}
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            type="password"
            placeholder={`Optional BYOK for ${activeProvider.label}`}
            className="min-w-0 flex-1 border border-gray-500 px-2 py-1"
            autoComplete="off"
          />
          <button onClick={handleSaveKey} className="border border-gray-600 bg-[#d7e8f7] px-3 py-1 font-semibold hover:bg-[#c5ddf0]">Save key</button>
        </div>
        <div className="mt-2 text-[10px] text-gray-600">`.env` keys use `VITE_*` names. BYOK is stored in sessionStorage for this test session and is intentionally not a secure production vault.</div>
      </section>

      <section className="mb-3 border border-gray-500 bg-white p-2">
        <h2 className="mb-2 font-bold">Benchmark inputs</h2>
        <label className="mb-1 block font-semibold" htmlFor="site-host">Fictional site host</label>
        <input id="site-host" value={siteName} onChange={(event) => setSiteName(event.target.value)} className="mb-2 w-full border border-gray-500 px-2 py-1" />
        <label className="mb-1 block font-semibold" htmlFor="chat-prompt">Maya chat prompt</label>
        <input id="chat-prompt" value={chatPrompt} onChange={(event) => setChatPrompt(event.target.value)} className="w-full border border-gray-500 px-2 py-1" />
        <button disabled={running} onClick={runBenchmarks} className="mt-3 border border-gray-700 bg-[#000080] px-4 py-1 font-bold text-white disabled:cursor-wait disabled:opacity-60">
          {running ? 'Running benchmark...' : 'Run all provider benchmarks'}
        </button>
        <div className="mt-2 border-t border-gray-300 pt-2 text-[10px] text-gray-700">{notice}</div>
      </section>

      <section className="mb-3 border border-gray-500 bg-white p-2">
        <h2 className="mb-2 font-bold">Character image (Fal.ai — small, era-appropriate)</h2>
        <div className="text-[11px] text-gray-600">When a Pulse buddy agrees to send a photo, a small 320×240 image is generated. Fal key is required; otherwise a local placeholder is used and stored.</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="font-semibold" htmlFor="image-buddy">Buddy:</label>
          <select id="image-buddy" value={imageBuddy} onChange={(e) => setImageBuddy(e.target.value)} className="border border-gray-500 bg-white px-2 py-1">
            {CORE_BUDDIES.map((b) => (
              <option key={b.id} value={b.id}>{b.displayName} — {b.handle}</option>
            ))}
          </select>
          <span className={`px-2 py-1 text-[10px] ${hasConfiguredKey('fal', settings) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{hasConfiguredKey('fal', settings) ? 'Fal key available' : 'Fal no key — fallback'}</span>
        </div>
        <label className="mt-2 block font-semibold" htmlFor="image-prompt">Image prompt (what the character should send)</label>
        <input id="image-prompt" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="e.g. view from my window at night, desk with lamp" className="w-full border border-gray-500 px-2 py-1" />
        <button disabled={imageRunning} onClick={runImageTest} className="mt-2 border border-gray-700 bg-[#6a1b9a] px-4 py-1 font-bold text-white disabled:opacity-60">
          {imageRunning ? 'Generating image...' : 'Generate character image (Fal / fallback)'}
        </button>
        {imageResult && (
          <div className="mt-3 border border-gray-400 bg-[#fafafa] p-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-bold">{imageResult.provider} {imageResult.fallback ? '(fallback)' : ''}</span>
              {imageResult.error && <span className="text-red-700">{imageResult.error}</span>}
            </div>
            <img src={imageResult.url} alt={imagePrompt} className="mt-2 max-h-60 w-auto border border-gray-400 bg-white object-contain" />
            <div className="mt-1 break-all font-mono text-[10px] text-gray-600">{imageResult.url.slice(0, 120)}{imageResult.url.length > 120 ? '…' : ''}</div>
          </div>
        )}
      </section>

      <section className="mb-3 border-2 border-[#6a1b9a] bg-white p-2">
        <h2 className="mb-1 font-bold text-[#6a1b9a]">Procedural Wire Director — governed</h2>
        <div className="text-[11px] text-gray-600">Seed + tone + category weights → AI proposes within Zod schema, .local only, era-locked, deduped. Templates guarantee offline. CityWire reads live world.</div>

        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1">World seed<input value={procSeed} onChange={(e) => setProcSeed(e.target.value)} className="border border-gray-500 px-2 py-1" placeholder="oakhaven-lab" /></label>
          <label className="flex flex-col gap-1">Tone<select value={procTone} onChange={(e) => setProcTone(e.target.value as any)} className="border border-gray-500 bg-white px-2 py-1"><option value="grounded">grounded</option><option value="whimsical">whimsical</option><option value="melancholy">melancholy</option><option value="hopeful">hopeful</option></select></label>
          <label className="flex flex-col gap-1">Max events<select value={procMaxEvents} onChange={(e) => setProcMaxEvents(parseInt(e.target.value, 10))} className="border border-gray-500 bg-white px-2 py-1"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
          <label className="flex items-center gap-2 mt-4"><input type="checkbox" checked={procUseAI} onChange={(e) => setProcUseAI(e.target.checked)} /> Use AI (off = templates only)</label>
        </div>

        <div className="mt-3 border border-gray-300 bg-[#fafafa] p-2">
          <div className="font-bold text-[11px]">Category weights (0–5, biased draw) + prefer boost</div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {Object.keys(procWeights).map((cat) => (
              <div key={cat} className="flex items-center gap-2 border border-gray-200 bg-white px-2 py-1">
                <span className="w-24 font-mono text-[11px]">{cat}</span>
                <input type="range" min={0} max={5} value={procWeights[cat]} onChange={(e) => setProcWeights({ ...procWeights, [cat]: parseInt(e.target.value, 10) })} className="flex-1" />
                <span className="w-4 text-center font-bold">{procWeights[cat]}</span>
                <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={!!procPrefer[cat]} onChange={(e) => setProcPrefer({ ...procPrefer, [cat]: e.target.checked })} /> prefer</label>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gray-600">Current day: <b>{worldDay}</b> • world pending: <b>{engine.world.getPendingEvents().length}</b> • triggered: <b>{engine.world.getTriggeredEvents().length}</b> • injected last: {procInjectedIds.join(', ') || '—'}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={procBusy} onClick={runProcPreview} className="border border-gray-700 bg-white px-4 py-1 font-bold hover:bg-gray-50 disabled:opacity-60"> {procBusy ? 'Working…' : 'Preview (dry, no inject)'}</button>
          <button disabled={procBusy} onClick={runProcInject} className="border border-gray-700 bg-[#6a1b9a] px-4 py-1 font-bold text-white hover:bg-[#7b22b3] disabled:opacity-60"> {procBusy ? 'Working…' : 'Generate & Inject into World'}</button>
          {procMeta && <span className="px-2 py-1 text-[10px] bg-gray-100 border border-gray-300">source: <b>{procMeta.source}</b>{procMeta.latencyMs ? ` • ${procMeta.latencyMs}ms` : ''}{procMeta.error ? ` • ${procMeta.error.slice(0, 80)}` : ''}</span>}
        </div>

        {procPreview && (
          <div className="mt-3 space-y-2">
            {procPreview.map((e) => (
              <article key={e.id} className="border border-gray-400 bg-[#fafafa] p-2">
                <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-[11px]">
                  <span>{e.title}</span>
                  <span className="bg-black text-white px-2 py-0.5 text-[9px] uppercase">{e.category} • Day {e.triggerDay} {e.triggerHour ? `@${e.triggerHour}:00` : ''}</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-700">{e.description}</div>
                <div className="mt-1 text-[11px] italic text-gray-600">NPC will say: “{e.knowledgePrompt}”</div>
                {e.siteUrl && <div className="mt-1 font-mono text-[10px] text-blue-700">{e.siteUrl}</div>}
                <div className="font-mono text-[9px] text-gray-400">id: {e.id}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-3 border-2 border-[#0f4a3c] bg-white p-2">
        <h2 className="mb-1 font-bold text-[#0f4a3c]">Orion OS Lab — governed releases</h2>
        <div className="text-[11px] text-gray-600">Family + kind → AI or template → validated via OsCatalog → installable in TechMart/Control Panel. Simulation: size, RAM, boot time, disk, theme.</div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="flex flex-col gap-1">Family<select value={osFamily} onChange={(e) => setOsFamily(e.target.value as any)} className="border border-gray-500 bg-white px-2 py-1"><option value="5.x">5.x — Aperture</option><option value="6.x">6.x — Canal</option><option value="7.x">7.x — Gloss</option></select></label>
          <label className="flex flex-col gap-1">Kind<select value={osKind} onChange={(e) => setOsKind(e.target.value as any)} className="border border-gray-500 bg-white px-2 py-1"><option value="major">major</option><option value="minor">minor</option><option value="patch">patch</option><option value="beta">beta</option><option value="hotfix">hotfix</option></select></label>
          <label className="flex items-center gap-2 mt-4"><input type="checkbox" checked={osUseAI} onChange={(e) => setOsUseAI(e.target.checked)} /> Use AI</label>
        </div>
        <div className="mt-2 text-[10px] text-gray-600">Current OS: <b>{(engine as any).os.getCurrentOsId()}</b> • catalog: <b>{getAllReleases().length}</b> releases • pending OS events: <b>{engine.world.getPendingEvents().filter((e:any)=>e.category==='os_release').length}</b></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={osBusy} onClick={runOsPreview} className="border border-gray-700 bg-white px-4 py-1 font-bold hover:bg-gray-50 disabled:opacity-60">{osBusy ? 'Working…' : 'Preview OS (dry)'}</button>
          <button disabled={osBusy || (osPreview as unknown) == null} onClick={runOsInject} className="border border-gray-700 bg-[#0f4a3c] px-4 py-1 font-bold text-white hover:bg-[#15604e] disabled:opacity-60">{osBusy ? 'Working…' : 'Inject OS into Catalog & World'}</button>
          {osMeta && <span className="px-2 py-1 text-[10px] bg-gray-100 border border-gray-300">source: <b>{osMeta.source}</b>{(osMeta as any).error ? ` • ${(osMeta as any).error.slice(0,60)}` : ''}</span>}
        </div>
        {(osPreview as unknown) != null && (
          <div className="mt-3 border border-gray-400 bg-[#fafafa] p-2">
            <div className="font-bold text-xs">{(osPreview as any).displayName} <span className="font-mono text-[10px] text-gray-500">Build {(osPreview as any).build ?? (osPreview as any).version} • {(osPreview as any).theme} • {(osPreview as any).installSizeGB}GB • {(osPreview as any).ramOverheadMB}MB</span></div>
            <div className="text-[11px] text-gray-700">{(osPreview as any).blurb ?? ''}</div>
            <ul className="mt-1 list-disc pl-4 text-[11px] text-gray-600">{(((osPreview as any).changelog ?? []) as string[]).map((c:string,i:number)=><li key={i}>{c}</li>)}</ul>
            <div className="font-mono text-[9px] text-gray-400">id: {(osPreview as any).id} • will appear as OS product Day {worldDay + 2} • TechMart/Control Panel</div>
          </div>
        )}
      </section>

      <section className="mb-3 border-2 border-[#1d4e89] bg-white p-2">
        <h2 className="mb-1 font-bold text-[#1d4e89]">Character Lab — governed newcomers</h2>
        <div className="text-[11px] text-gray-600">Archetype + meeting place → AI or template → validated via CharacterEngine → added to Pulse + MyPlace. Offline-safe: templates always work.</div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="flex flex-col gap-1">Archetype<select value={charArchetype} onChange={(e) => setCharArchetype(e.target.value as any)} className="border border-gray-500 bg-white px-2 py-1"><option value="random">random</option><option value="coworker">coworker</option><option value="nightowl">nightowl</option><option value="student">student</option><option value="trader">trader</option><option value="artist">artist</option><option value="regular">regular</option></select></label>
          <label className="flex flex-col gap-1">Met via<select value={charMetVia} onChange={(e) => setCharMetVia(e.target.value as BuddyMetVia)} className="border border-gray-500 bg-white px-2 py-1">{NEWCOMER_METVIA_ROTATION.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          <label className="flex items-center gap-2 mt-4"><input type="checkbox" checked={charUseAI} onChange={(e) => setCharUseAI(e.target.checked)} /> Use AI</label>
        </div>
        <div className="mt-2 text-[10px] text-gray-600">Buddies now: <b>{engine.social.getBuddies().length}</b> • procedural: <b>{engine.social.getBuddies().filter((b) => b.isProcedural).length}</b> • Day <b>{worldDay}</b></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={charBusy} onClick={runCharPreview} className="border border-gray-700 bg-white px-4 py-1 font-bold hover:bg-gray-50 disabled:opacity-60">{charBusy ? 'Working…' : 'Preview newcomer (dry)'}</button>
          <button disabled={charBusy || (charPreview as unknown) == null} onClick={runCharInject} className="border border-gray-700 bg-[#1d4e89] px-4 py-1 font-bold text-white hover:bg-[#27619f] disabled:opacity-60">{charBusy ? 'Working…' : 'Add to World + Pulse'}</button>
          {charMeta && <span className="px-2 py-1 text-[10px] bg-gray-100 border border-gray-300">source: <b>{charMeta.source}</b>{charMeta.error ? ` • ${charMeta.error.slice(0,60)}` : ''}</span>}
        </div>
        {(charPreview as unknown) != null && (
          <div className="mt-3 border border-gray-400 bg-[#fafafa] p-2">
            <div className="font-bold text-xs">{(charPreview as any).definition.displayName} <span className="font-mono text-[10px] text-gray-500">@{(charPreview as any).definition.handle} • {(charPreview as any).definition.archetype} • met via {(charPreview as any).definition.metVia}</span></div>
            <div className="text-[11px] text-gray-700 italic mt-1">“{(charPreview as any).introText}”</div>
            <div className="text-[11px] text-gray-600 mt-1">{(charPreview as any).profilePatch.headline} — {(charPreview as any).profilePatch.bio}</div>
            <div className="font-mono text-[9px] text-gray-400">id: {(charPreview as any).definition.id} • MyPlace: http://myplace.local/{(charPreview as any).definition.id}</div>
          </div>
        )}
      </section>

      <section className="mb-3 border-2 border-[#2f6b2f] bg-white p-2">
        <h2 className="mb-1 font-bold text-[#2f6b2f]">Life Board — body, weather, rent (read-only)</h2>
        <div className="text-[11px] text-gray-600">The real side at a glance: hunger/health/sleep, the sky, and the countdown to rent. Lenient by design — floors, never traps.</div>
        {(() => {
          const body = engine.economy.getState();
          const maxEnergy = engine.economy.effectiveMaxEnergy();
          const rentOverdue = engine.world.getFlag('rent_overdue');
          const todayAppts = engine.world.getAppointments().filter((a) => a.targetDay === worldDay);
          return (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 text-[11px]">
              <div className="border border-gray-300 bg-[#fafafa] p-2">
                <div className="font-bold">Body</div>
                <div className="font-mono text-[10px] text-gray-600">
                  energy {body.energy}/{maxEnergy} • hunger {Math.round(body.hunger)} • health {Math.round(body.health)} • sleep debt {body.sleepDebt}
                </div>
                <div className="mt-1 text-gray-600">
                  {body.hunger >= 80 ? '⚠️ starving — energy capped, eat something.' : body.hunger >= 55 ? 'getting hungry.' : 'fed.'}
                  {' '}{body.sleepDebt >= 4 ? '😴 heavy debt — sleep early.' : body.sleepDebt > 0 ? 'a little tired.' : 'rested.'}
                </div>
              </div>
              <div className="border border-gray-300 bg-[#fafafa] p-2">
                <div className="font-bold">Sky &amp; rent</div>
                <div className="font-mono text-[10px] text-gray-600">
                  today: {(() => { try { const w = getWeatherForDay(worldDay); return `${w.label} ${w.icon}`; } catch { return '?'; } })()}
                </div>
                <div className="mt-1 text-gray-600">
                  rent ${body.rentAmount.toFixed(2)} due day {body.rentDueDay} — {body.rentPaid ? '✅ paid' : rentOverdue ? '❌ OVERDUE (downloads napping)' : `⏳ ${Math.max(0, body.rentDueDay - worldDay)} days left`}
                </div>
              </div>
              <div className="border border-gray-300 bg-[#fafafa] p-2">
                <div className="font-bold">Today (day {worldDay})</div>
                <div className="font-mono text-[10px] text-gray-600">
                  meetings: {todayAppts.length} • cash ${body.cash.toFixed(2)}
                </div>
                <div className="mt-1 text-gray-600">
                  {todayAppts.length === 0 ? 'nothing scheduled — propose something on Pulse.' : todayAppts.map((a) => `${a.characterId}@${a.locationId} (${a.status ?? 'scheduled'})`).join(' • ')}
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      <section className="mb-3 border-2 border-[#6a4a00] bg-white p-2">
        <h2 className="mb-1 font-bold text-[#6a4a00]">Meeting Board — live appointments (read-only)</h2>        <div className="text-[11px] text-gray-600">Plans emerge from chat (“lets meet at the cafe tomorrow”). NPCs RSVP the day before, then show or flake by rules. Visit the place (or DM for the lobby) on the day to show up yourself.</div>
        <div className="mt-2 space-y-1">
          {engine.world.getAppointments().length === 0 && <div className="text-[11px] italic text-gray-500">No appointments yet — propose one in Pulse chat.</div>}
          {engine.world.getAppointments().map((a) => (
            <div key={a.id} className="border border-gray-300 bg-[#fafafa] p-2 font-mono text-[10px] text-gray-700">
              <b>{a.characterId}</b> @ {a.locationId} • day {a.targetDay} • status: <b>{a.status ?? 'scheduled'}</b> • rsvp: {a.rsvp ?? '—'} • npc: {a.npcShowed === undefined ? '—' : a.npcShowed ? 'showed' : 'no-show'} • you: {a.playerShowed === undefined ? '—' : a.playerShowed ? 'showed' : 'absent'}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-3 border-2 border-[#8a4b00] bg-white p-2">
        <h2 className="mb-1 font-bold text-[#8a4b00]">Relationship Lab — memory, stages &amp; sharp events (read-only)</h2>        <div className="text-[11px] text-gray-600">Hidden dimensions, derived stage, daily mood, immortal memories, open promises and lifecycle status per buddy. Rules decide, AI only paraphrases.</div>
        <div className="mt-2 space-y-1">
          {engine.social.getBuddies().map((b) => {
            const rel = engine.social.getRelationships(b.id);
            const stage = engine.social.getRelationshipStage(b.id);
            const mood = engine.social.getDailyMood(b.id, worldDay);
            const mems = engine.social.getCoreMemories(b.id);
            const open = engine.social.getOpenPromises(b.id);
            const sharp = (engine.world.getFlag(`sharp_${b.id}`) as string) || '—';
            const ties = engine.social.buildAffinityContext(b.id);
            return (
              <div key={b.id} className="border border-gray-300 bg-[#fafafa] p-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{b.displayName}</b>
                  <span className="font-mono text-[10px] text-gray-500">@{b.handle} • {b.archetype ?? '?'} • status: {b.status ?? '—'}</span>
                  <span className="border border-[#8a4b00] px-1 font-bold text-[#8a4b00]">stage: {stage}</span>
                  <span className="border border-gray-400 px-1">mood: {mood}</span>
                  {sharp !== '—' && sharp !== '' && <span className="border border-red-600 px-1 font-bold text-red-700">sharp: {sharp}</span>}
                </div>
                {rel && <div className="mt-1 font-mono text-[10px] text-gray-600">fam {rel.familiarity} • trust {rel.trust} • comfort {rel.comfort} • respect {rel.respect} • annoy {rel.annoyance}</div>}
                {mems.length > 0 && <ul className="mt-1 list-disc pl-4 text-gray-700">{mems.map((m) => <li key={m.id}>[{m.kind} d{m.day}] {m.text}</li>)}</ul>}
                {open.length > 0 && <div className="mt-1 text-gray-700">promises: {open.map((p) => `“${p.text}”${p.dueDay !== undefined ? ` (due d${p.dueDay})` : ''}`).join(' • ')}</div>}
                {ties && <div className="mt-1 text-gray-700">{ties}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="border border-gray-500 bg-white p-2">
        <h2 className="mb-2 font-bold">Results</h2>
        {results.length === 0 ? (
          <div className="text-gray-500 italic">No benchmark results yet.</div>
        ) : (
          <div className="space-y-2">
            {results.map((result, index) => (
              <article key={`${result.kind}-${result.providerId}-${index}`} className="border border-gray-400 bg-[#fafafa] p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold">{result.kind.toUpperCase()} · {result.providerId} · {result.model}</div>
                  <div className={result.ok ? 'text-green-700' : 'text-red-700'}>{result.ok ? 'OK' : 'FALLBACK / ERROR'}</div>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-gray-700">
                  <span>latency: <b>{result.latencyMs} ms</b></span>
                  <span>structural score: <b>{result.structuralScore}%</b></span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words border border-gray-300 bg-white p-2 font-mono text-[10px]">{result.preview}</pre>
                {result.error && <div className="mt-1 text-[10px] text-red-700">{result.error}</div>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { AI_PROVIDERS, hasConfiguredKey } from '../../ai/providers';
import { aiService } from '../../ai/service';
import { loadAISettings, saveAISettings } from '../../ai/settings';
import type { AIProviderId, AISettings, BenchmarkResult } from '../../ai/types';
import { generateCharacterImage } from '../../ai/imageService';

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
  const [imageBuddy, setImageBuddy] = useState('maya');
  const [imageRunning, setImageRunning] = useState(false);
  const [imageResult, setImageResult] = useState<{ url: string; provider: string; fallback: boolean; error?: string } | null>(null);

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

      const chatResult = await aiService.benchmarkChat({
        buddyId: 'maya',
        displayName: 'Maya',
        handle: 'starlight_maya',
        persona: 'Quiet, observant, creative, and guarded. Uses lowercase, pauses, music references, and gentle honesty.',
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
            <option value="maya">Maya — starlight_maya</option>
            <option value="ryan">Ryan — ryan_foodcart</option>
            <option value="nora">Nora — NightOwl87</option>
            <option value="henderson">Mr. Henderson — motel_office</option>
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

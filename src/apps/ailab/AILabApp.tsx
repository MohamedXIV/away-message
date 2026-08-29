import React, { useEffect, useMemo, useState } from 'react';
import { AI_PROVIDERS, hasConfiguredKey } from '../../ai/providers';
import { aiService } from '../../ai/service';
import { loadAISettings, saveAISettings } from '../../ai/settings';
import type { AIProviderId, AISettings, BenchmarkResult } from '../../ai/types';

const TEST_HOST = 'midnight-board.local';

export const AILabApp: React.FC = () => {
  const [settings, setSettings] = useState<AISettings>(() => loadAISettings());
  const [keyInput, setKeyInput] = useState('');
  const [siteName, setSiteName] = useState(TEST_HOST);
  const [chatPrompt, setChatPrompt] = useState('you still awake? the motel is too quiet tonight');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [notice, setNotice] = useState('Ready. Benchmark mode bypasses the ten-day cache.');

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

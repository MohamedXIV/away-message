import React, { useEffect, useState } from 'react';
import { SAVE_SLOTS, AUTOSAVE_ID, listSlots, deleteSlot, mostRecentSlot, requestBoot, slotCompatibility, type SlotSummary, type SaveCompatibility } from '../persistence/slots';
import { loadAISettings, saveAISettings } from '../ai/settings';
import type { AIProviderId } from '../ai/types';
import { soundManager } from '../audio/SoundManager';

const KEY_BACKUP = 'away-message-ai-key-backup';
const PROVIDERS: AIProviderId[] = ['gemini', 'groq', 'openrouter', 'fal'];

function formatDate(updatedAt: number): string {
  try {
    return new Date(updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Restore a persisted BYOK key into this tab's session settings (menu entry point for demo players). */
export function restoreBackupKey(): void {
  try {
    if (typeof window === 'undefined') return;
    const current = loadAISettings();
    if (current.byokKeys[current.activeProvider]) return;
    const raw = window.localStorage.getItem(KEY_BACKUP);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { provider?: AIProviderId; key?: string };
    if (parsed && typeof parsed.key === 'string' && parsed.key && PROVIDERS.includes(parsed.provider as AIProviderId)) {
      saveAISettings({
        activeProvider: parsed.provider as AIProviderId,
        byokKeys: { ...current.byokKeys, [parsed.provider as AIProviderId]: parsed.key },
      });
    }
  } catch { /* best-effort */ }
}

interface MainMenuProps {
  onBoot: () => void;
}

/**
 * P9 boot screen (Orion-styled): Continue / New Game / slot Load-Delete /
 * How to Play / BYOK key entry. All boot paths go through requestBoot +
 * reload so engine, Pulse, windows and desktop come back coherent.
 */
export const MainMenu: React.FC<MainMenuProps> = ({ onBoot }) => {
  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [compat, setCompat] = useState<Record<string, SaveCompatibility>>({});
  const [loaded, setLoaded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<AIProviderId>(() => loadAISettings().activeProvider);
  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(() => Boolean(loadAISettings().byokKeys[loadAISettings().activeProvider]));
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    restoreBackupKey();
    void listSlots().then(async (rows) => {
      setSlots(rows);
      const verdicts: Record<string, SaveCompatibility> = {};
      for (const row of rows) {
        try {
          verdicts[row.id] = await slotCompatibility(row.id);
        } catch {
          verdicts[row.id] = { status: 'refused', reason: 'Could not read slot.' };
        }
      }
      setCompat(verdicts);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const refresh = () => {
    void listSlots().then(setSlots).catch(() => {});
  };

  const byId = new Map(slots.map((s) => [s.id, s]));

  const handleContinue = async () => {
    soundManager.play('click');
    const recent = await mostRecentSlot();
    if (recent) {
      const verdict = await slotCompatibility(recent.id).catch(() => ({ status: 'refused', reason: '' }) as SaveCompatibility);
      if (verdict.status === 'ok') {
        requestBoot({ kind: 'slot', slotId: recent.id });
        return;
      }
    }
    requestBoot({ kind: 'new', slotId: 'slot_1' });
  };

  const handleNew = () => {
    soundManager.play('click');
    // Fresh timeline — old saves stay on disk, autosave restarts with the run.
    requestBoot({ kind: 'new', slotId: 'slot_1' });
  };

  const handleLoad = (slotId: string) => {
    soundManager.play('click');
    requestBoot({ kind: 'slot', slotId });
  };

  const handleDelete = async (slotId: string) => {
    await deleteSlot(slotId);
    refresh();
  };

  const handleSaveKey = () => {
    const settings = loadAISettings();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      const nextKeys = { ...settings.byokKeys };
      delete nextKeys[provider];
      saveAISettings({ activeProvider: provider, byokKeys: nextKeys });
      try { window.localStorage.removeItem(KEY_BACKUP); } catch { /* ignore */ }
      setKeySaved(false);
      setKeyInput('');
      return;
    }
    saveAISettings({ activeProvider: provider, byokKeys: { ...settings.byokKeys, [provider]: trimmed } });
    try { window.localStorage.setItem(KEY_BACKUP, JSON.stringify({ provider, key: trimmed })); } catch { /* ignore */ }
    setKeySaved(true);
    setKeyInput('');
  };

  const rows: Array<{ id: string; label: string; auto?: boolean }> = [
    ...SAVE_SLOTS.map((id, i) => ({ id, label: `Slot ${i + 1}` })),
    { id: AUTOSAVE_ID, label: 'Autosave', auto: true },
  ];

  return (
    <div className="w-full h-full overflow-y-auto bg-black text-slate-200 font-sans select-none flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Masthead */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">💬</div>
          <h1 className="text-3xl font-black tracking-widest text-amber-300">AWAY MESSAGE</h1>
          <p className="mt-1 text-xs text-slate-400">Room 104 • Oakhaven • dial-up not included</p>
        </div>

        <div className="bg-slate-900/90 border-2 border-slate-700 rounded-lg p-4 space-y-2 shadow-2xl">
          {loaded && slots.some((s) => s.hasSnapshot) && (
            <button
              onClick={() => void handleContinue()}
              className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded shadow text-sm cursor-pointer"
            >
              ▶ Continue
            </button>
          )}
          {!confirmNew ? (
            <button
              onClick={() => (loaded && slots.some((s) => s.hasSnapshot) ? setConfirmNew(true) : handleNew())}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold rounded text-sm cursor-pointer"
            >
              ＋ New Game
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleNew} className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded text-sm cursor-pointer">
                Start fresh (old saves stay)
              </button>
              <button onClick={() => setConfirmNew(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm cursor-pointer">
                Cancel
              </button>
            </div>
          )}

          {/* Slots */}
          <div className="pt-1 space-y-1.5">
            {rows.map((row) => {
              const summary = byId.get(row.id);
              const verdict = compat[row.id];
              const loadable = summary?.hasSnapshot && (!verdict || verdict.status === 'ok');
              return (
              <div key={row.id} className="flex items-center justify-between bg-slate-800/80 border border-slate-700 rounded px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200">{row.label}</div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {summary?.hasSnapshot ? `${summary.name} • ${formatDate(summary.updatedAt)}` : 'empty'}
                  </div>
                  {verdict && verdict.status !== 'ok' && summary?.hasSnapshot && (
                    <div className="text-[10px] font-bold text-red-400" title={verdict.reason}>
                      ⚠ {verdict.status === 'legacy' ? 'too old to load' : 'incompatible version'}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    disabled={!loadable}
                    onClick={() => handleLoad(row.id)}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-white disabled:opacity-40 text-slate-950 text-[11px] font-bold rounded cursor-pointer"
                  >
                    Load
                  </button>
                    <button
                      disabled={!summary}
                      onClick={() => void handleDelete(row.id)}
                      className="px-2.5 py-1 bg-transparent hover:bg-red-900/40 disabled:opacity-40 text-red-400 text-[11px] rounded cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowHelp((v) => !v)} className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs cursor-pointer">
              {showHelp ? 'Hide guide' : '? How to play'}
            </button>
            <button onClick={() => setShowKey((v) => !v)} className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs cursor-pointer">
              {keySaved ? '🔑 AI key ✓' : '🔑 AI key'} {showKey ? '▲' : ''}
            </button>
          </div>

          {showHelp && (
            <div className="text-[11px] leading-relaxed text-slate-300 bg-slate-800/60 border border-slate-700 rounded p-3 space-y-1.5">
              <p><b className="text-amber-300">You</b> just moved into Room 104 with $38, a humming PC and dial-up.</p>
              <p><b className="text-amber-300">Live:</b> work shifts, eat, sleep, pay rent on day 7. Hunger and fatigue are real.</p>
              <p><b className="text-amber-300">Befriend:</b> open <b>Pulse Messenger</b> (install it from DownloadHub first!) and talk. Promises matter. So does showing up.</p>
              <p><b className="text-amber-300">Explore:</b> rooms, NightBoard, MyPlace, the city map. Everything reacts to everything.</p>
              <p><b className="text-amber-300">Save:</b> Start menu → Save / Load. Autosave fires every new day.</p>
            </div>
          )}

          {showKey && (
            <div className="text-[11px] text-slate-300 bg-slate-800/60 border border-slate-700 rounded p-3 space-y-2">
              <p>NPCs can run on real AI (Gemini/Groq/OpenRouter) with your own key — stored only in this browser. Without one, they fall back to offline lines.</p>
              <div className="flex gap-1.5">
                <select value={provider} onChange={(e) => { setProvider(e.target.value as AIProviderId); setKeySaved(Boolean(loadAISettings().byokKeys[e.target.value as AIProviderId])); }} className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs">
                  {(['gemini', 'groq', 'openrouter', 'fal'] as AIProviderId[]).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={keySaved ? 'key saved ✓ (paste to replace)' : 'paste API key'}
                  className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs outline-none font-mono"
                />
                <button onClick={handleSaveKey} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs cursor-pointer">
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-600 font-mono">
          v1.0 demo • saves live in this browser (IndexedDB) • <button className="underline hover:text-slate-400" onClick={onBoot}>skip to desktop</button>
        </p>
      </div>
    </div>
  );
};

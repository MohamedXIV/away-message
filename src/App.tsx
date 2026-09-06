// src/App.tsx

import React, { useEffect, useState } from 'react';
import { DesktopShell } from './desktop/DesktopShell';import { RoomScene } from './world/RoomScene';
import { CafeScene } from './world/CafeScene';
import { Day14ResolutionModal } from './world/Day14ResolutionModal';
import {
  useSimulationTicker,
  useSimulationStore,
  useActiveView,
  useGameTime,
} from './store/useSimulationStore';
import { useAudioStore } from './store/useAudioStore';
import { SimulationEngine } from './engine/SimulationEngine';
import { MainMenu } from './menu/MainMenu';
import { consumeBootRequest, loadSlotSnapshot, restoreSlotPulse, saveSlot, AUTOSAVE_ID } from './persistence/slots';

// Dev-only content studio (TinyBase Inspector): lazy + query-gated so the
// editor never enters the production bundle. Open with ?studio in dev.
const ContentInspectorPane = React.lazy(() =>
  import('./tools/ContentInspector').then((m) => ({ default: m.ContentInspector }))
);
function useContentStudio(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try {
      const env = (import.meta as unknown as { env: Record<string, string | boolean | undefined> }).env;
      if (env.DEV && new URLSearchParams(window.location.search).has('studio')) {
        setEnabled(true);
      }
    } catch { /* studio flag is best-effort */ }
  }, []);
  return enabled;
}

export const App: React.FC = () => {
  // Start the continuous simulation clock animation loop
  useSimulationTicker({ enabled: true });

  const unlockAudio = useAudioStore((s) => s.unlockAudio);
  const osState = useSimulationStore((s) => s.state.os);
  const osVersion = osState.currentOsId as string;
  const activeView = useActiveView();
  const switchView = useSimulationStore((s) => s.switchView);
  const setWorldFlag = useSimulationStore((s) => s.setWorldFlag);
  const time = useGameTime();
  const world = useSimulationStore((s) => s.state.world);

  const [showDay14Modal, setShowDay14Modal] = useState<boolean>(false);

  // P9 boot phases: menu → loading → game. Boot requests (menu Continue/Load)
  // arrive via reload so every subsystem starts from the slot coherently.
  const [phase, setPhase] = useState<'menu' | 'loading' | 'game'>('menu');
  const [bootError, setBootError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const contentStudio = useContentStudio();

  useEffect(() => {
    const request = consumeBootRequest();
    if (!request) return;
    setPhase('loading');
    (async () => {
      try {
        if (request.kind === 'slot') {
          const snapshot = await loadSlotSnapshot(request.slotId);
          if (!snapshot) throw new Error(`Save slot '${request.slotId}' is empty or unreadable.`);
          await restoreSlotPulse(request.slotId);
          useSimulationStore.getState().setEngine(new SimulationEngine(snapshot as any));
        }
        setPhase('game');
      } catch (error) {
        setBootError(error instanceof Error ? error.message : 'Failed to load save.');
        setPhase('menu');
      }
    })();
  }, []);

  // Autosave on every new day + transient "Saved ✓" badge.
  useEffect(() => {
    if (phase !== 'game') return;
    const engine = useSimulationStore.getState().engine;
    const off = engine.events.on('time:day_changed', () => {
      void saveSlot(engine, AUTOSAVE_ID)
        .then(() => {
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        })
        .catch(() => {});
    });
    return off;
  }, [phase]);

  // Auto unlock audio on first pointer or keyboard interaction
  useEffect(() => {
    const handleFirstUserInteraction = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handleFirstUserInteraction);
      window.removeEventListener('keydown', handleFirstUserInteraction);
    };

    window.addEventListener('pointerdown', handleFirstUserInteraction);
    window.addEventListener('keydown', handleFirstUserInteraction);

    return () => {
      window.removeEventListener('pointerdown', handleFirstUserInteraction);
      window.removeEventListener('keydown', handleFirstUserInteraction);
    };
  }, [unlockAudio]);

  // Global Hotkey: F2 or Alt+R to toggle between PC and Room
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.altKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        if (activeView === 'pc') {
          switchView('room');
        } else if (activeView === 'room') {
          switchView('pc');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, switchView]);

  // Sandbox: no Day 14 gate — show milestone modal once at Day 15 for flavor, then never again
  useEffect(() => {
    if (time.day >= 15 && !world.flags?.free_play_unlocked && !showDay14Modal) {
      setShowDay14Modal(true);
    }
  }, [time.day, world.flags?.free_play_unlocked, showDay14Modal]);

  const handleContinueFreePlay = () => {
    setWorldFlag('free_play_unlocked', true);
    setWorldFlag('sandbox_milestone_seen', true);
    setShowDay14Modal(false);
  };

  const handleRestartGame = () => {
    try {
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('AwayMessageDB');
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  // Orion OS themes: 4.8→orion48, 5.x→orion50, 6.x→orion60, 7.x→orion70 (AI releases use same mapping)
  const themeAttr = (() => {
    if (osVersion.includes('7.0')) return 'orion70';
    if (osVersion.includes('6.')) return 'orion60';
    if (osVersion.includes('5.')) return 'orion50';
    return 'orion48';
  })();

  return (
    <div data-theme={themeAttr} className="w-full h-full overflow-hidden select-none bg-black">
      {phase === 'menu' && <MainMenu onBoot={() => setPhase('game')} />}
      {phase === 'loading' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black text-slate-300 font-sans">
          <div className="text-4xl animate-pulse">💾</div>
          <div className="text-sm font-bold tracking-widest">LOADING ROOM 104…</div>
          {bootError && <div className="text-xs text-red-400">{bootError}</div>}
        </div>
      )}
      {phase === 'game' && (
        <>
          {/* Top-Level View Router */}
          {activeView === 'pc' && <DesktopShell />}
          {activeView === 'room' && <RoomScene />}
          {activeView === 'cafe' && <CafeScene />}
          {activeView === 'work' && <RoomScene />}

          {/* Day 14 Evaluation Resolution Modal Overlay */}
          {showDay14Modal && (
            <Day14ResolutionModal
              onContinueFreePlay={handleContinueFreePlay}
              onRestartGame={handleRestartGame}
            />
          )}

          {/* Autosave badge */}
          {savedFlash && (
            <div className="absolute bottom-10 right-3 z-50 border border-[#38516e] bg-[#e8f5e9] px-3 py-1.5 text-[11px] font-bold text-green-900 shadow">
              ✓ Saved
            </div>
          )}

          {/* Dev content studio overlay (never in production builds) */}
          {contentStudio && (
            <React.Suspense fallback={null}>
              <ContentInspectorPane />
            </React.Suspense>
          )}
        </>
      )}
    </div>
  );
};

export default App;

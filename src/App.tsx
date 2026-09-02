// src/App.tsx

import React, { useEffect, useState } from 'react';
import { DesktopShell } from './desktop/DesktopShell';
import { RoomScene } from './world/RoomScene';
import { CafeScene } from './world/CafeScene';
import { Day14ResolutionModal } from './world/Day14ResolutionModal';
import {
  useSimulationTicker,
  useSimulationStore,
  useActiveView,
  useGameTime,
} from './store/useSimulationStore';
import { useAudioStore } from './store/useAudioStore';

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
    </div>
  );
};

export default App;

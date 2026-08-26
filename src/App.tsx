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
  useNarrativeState,
} from './store/useSimulationStore';
import { useAudioStore } from './store/useAudioStore';

export const App: React.FC = () => {
  // Start the continuous simulation clock animation loop
  useSimulationTicker({ enabled: true });

  const unlockAudio = useAudioStore((s) => s.unlockAudio);
  const osVersion = useSimulationStore((s) => s.state.hardware.osVersion);
  const activeView = useActiveView();
  const switchView = useSimulationStore((s) => s.switchView);
  const setNarrativeFlag = useSimulationStore((s) => s.setNarrativeFlag);
  const time = useGameTime();
  const narrative = useNarrativeState();

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

  // Check for Day 14 evaluation completion
  useEffect(() => {
    if (time.day >= 15 && !narrative.flags?.free_play_unlocked && !showDay14Modal) {
      setShowDay14Modal(true);
    }
  }, [time.day, narrative.flags?.free_play_unlocked, showDay14Modal]);

  const handleContinueFreePlay = () => {
    setNarrativeFlag('free_play_unlocked', true);
    setNarrativeFlag('day14_evaluation_completed', true);
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

  const themeAttr = osVersion === 'Orion_6.0' ? 'orion60' : 'orion48';

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

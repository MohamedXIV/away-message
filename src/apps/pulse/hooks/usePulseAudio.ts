import { useEffect, useRef } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { soundManager } from '../../../audio/SoundManager';
import { BuddyPresenceStatus } from '../../../engine/types';

export function usePulseAudio() {
  const presence = useSimulationStore((s) => s.state.social.presence);
  const isPaused = useSimulationStore((s) => s.isPaused);
  const prevPresenceRef = useRef<Record<string, BuddyPresenceStatus>>({});
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      for (const [id, p] of Object.entries(presence)) {
        prevPresenceRef.current[id] = p.status;
      }
      isInitialMount.current = false;
      return;
    }

    if (isPaused) return;

    for (const [id, p] of Object.entries(presence)) {
      const prev = prevPresenceRef.current[id];
      const curr = p.status;

      if (prev && prev !== curr) {
        if (prev === 'offline' && (curr === 'online' || curr === 'away')) {
          soundManager.play('door_open');
        } else if (prev !== 'offline' && curr === 'offline') {
          soundManager.play('door_slam');
        }
      }

      prevPresenceRef.current[id] = curr;
    }
  }, [presence, isPaused]);
}

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useSimulationStore } from './useSimulationStore';
import type { SimulationEngine } from '../engine/SimulationEngine';
import type {
  SimulationActorRead,
  SimulationChromeRead,
  SimulationDesktopRead,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationMessengerRead,
  SimulationWorldRead,
} from '../engine/kernel/SimulationPublication';

/**
 * React only subscribes to small revision notifications. The projection
 * reads its canonical owners when the revision changes. getSnapshot MUST
 * retain the same object reference within one revision (React 19 contract).
 */
export function useBoundedSimulationRead<T>(read: (engine: SimulationEngine) => T): T {
  const engine = useSimulationStore((state) => state.engine);
  const subscribe = useCallback(
    (notify: () => void) => engine.subscribeChanges(() => notify()),
    [engine],
  );
  const getSnapshot = useMemo(() => {
    let revision = -1;
    let cached: T;
    return () => {
      const nextRevision = engine.getRevision();
      if (nextRevision !== revision) {
        cached = read(engine);
        revision = nextRevision;
      }
      return cached;
    };
  }, [engine, read]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const readHud = (engine: SimulationEngine) => engine.getHudProjection();
const readWorld = (engine: SimulationEngine) => engine.getWorldRead();
const readChrome = (engine: SimulationEngine) => engine.getChromeRead();
const readDesktop = (engine: SimulationEngine) => engine.getDesktopRead();

export function useSimulationHud(): SimulationHudProjection {
  return useBoundedSimulationRead(readHud);
}

export function useSimulationWorldRead(): SimulationWorldRead {
  return useBoundedSimulationRead(readWorld);
}

export function useSimulationChrome(): SimulationChromeRead {
  return useBoundedSimulationRead(readChrome);
}

export function useSimulationDesktop(): SimulationDesktopRead {
  return useBoundedSimulationRead(readDesktop);
}

export function useSelectedActorRead(actorId: string): SimulationActorRead | null {
  const read = useCallback((engine: SimulationEngine) => engine.getPlayerActorRead(actorId), [actorId]);
  return useBoundedSimulationRead(read);
}

export function useMessengerRead(maxContacts = 32): SimulationMessengerRead {
  const read = useCallback((engine: SimulationEngine) => engine.getMessengerRead(maxContacts), [maxContacts]);
  return useBoundedSimulationRead(read);
}

export function useConversationRead(actorId: string, offset = 0, limit = 30): SimulationConversationRead {
  const read = useCallback(
    (engine: SimulationEngine) => engine.getConversationRead(actorId, offset, limit),
    [actorId, offset, limit],
  );
  return useBoundedSimulationRead(read);
}

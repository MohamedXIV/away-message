import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useSimulationStore } from './useSimulationStore';
import type { SimulationEngine } from '../engine/SimulationEngine';
import type {
  SimulationActorRead,
  SimulationAppRead,
  SimulationShopRead,
  SimulationChromeRead,
  SimulationDesktopRead,
  SimulationDirectoryRead,
  SimulationFileRead,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationMessengerRead,
  SimulationPresenceRead,
  SimulationWorldRead,
  SimulationSituationRead,
  SimulationWebsiteRead,
  SimulationPulseProfileRead,
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
const readSituation = (engine: SimulationEngine) => engine.getSituationRead();
const readChrome = (engine: SimulationEngine) => engine.getChromeRead();
const readApps = (engine: SimulationEngine) => engine.getAppRead();
const readShop = (engine: SimulationEngine) => engine.getShopRead();
const readWebsite = (engine: SimulationEngine) => engine.getWebsiteRead();
const readDesktop = (engine: SimulationEngine) => engine.getDesktopRead();
const readPresence = (engine: SimulationEngine) => engine.getPresenceRead();

export function useSimulationHud(): SimulationHudProjection {
  return useBoundedSimulationRead(readHud);
}

export function useSimulationWorldRead(): SimulationWorldRead {
  return useBoundedSimulationRead(readWorld);
}

export function useSimulationSituation(): SimulationSituationRead {
  return useBoundedSimulationRead(readSituation);
}

export function useSimulationDirectory(path: string): SimulationDirectoryRead {
  const read = useCallback((engine: SimulationEngine) => engine.getDirectoryRead(path), [path]);
  return useBoundedSimulationRead(read);
}

export function useSimulationFile(path: string): SimulationFileRead {
  const read = useCallback((engine: SimulationEngine) => engine.getFileRead(path), [path]);
  return useBoundedSimulationRead(read);
}

export function usePulseProfileRead(actorId: string): SimulationPulseProfileRead {
  const read = useCallback((engine: SimulationEngine) => engine.getPulseProfileRead(actorId), [actorId]);
  return useBoundedSimulationRead(read);
}

export function useSimulationWebsite(): SimulationWebsiteRead {
  return useBoundedSimulationRead(readWebsite);
}

export function useSimulationShop(): SimulationShopRead {
  return useBoundedSimulationRead(readShop);
}

export function useSimulationApps(): SimulationAppRead {
  return useBoundedSimulationRead(readApps);
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

export function useSimulationPresence(): SimulationPresenceRead {
  return useBoundedSimulationRead(readPresence);
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

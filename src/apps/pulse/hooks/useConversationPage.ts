import { useEffect, useState } from 'react';
import { useBoundedSimulationRead } from '../../../store/useBoundedSimulationRead';
import { useSimulationStore } from '../../../store/useSimulationStore';
import type { SimulationEngine } from '../../../engine/SimulationEngine';
import type { SimulationConversationRead } from '../../../engine/kernel/SimulationPublication';

// Query by the actual kernel revision, never a whole-world Zustand selector.
const readRevision = (engine: SimulationEngine) => engine.getRevision();

type PageState = {
  engine: SimulationEngine;
  actorId: string;
  offset: number;
  limit: number;
  revision: number;
  page: SimulationConversationRead | null;
  error: string | null;
};

export function useConversationPage(actorId: string, offset: number, limit = 50) {
  const engine = useSimulationStore(s => s.engine);
  const revision = useBoundedSimulationRead(readRevision);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<PageState | null>(null);

  useEffect(() => {
    let active = true;
    if (!actorId) return () => { active = false; };
    // All old pages go through the canonical known-handle guarded kernel.
    // A cancelled, stale-revision or swapped-engine answer is never rendered.
    void engine.getConversationReadAsync(actorId, offset, limit)
      .then(page => {
        if (active && engine.getRevision() === revision) {
          setState({ engine, actorId, offset, limit, revision, page, error: null });
        }
      })
      .catch(() => {
        if (active && engine.getRevision() === revision) {
          setState({ engine, actorId, offset, limit, revision, page: null,
            error: 'Could not load this conversation page.' });
        }
      });
    return () => { active = false; };
  }, [engine, actorId, offset, limit, revision, retry]);

  const matches = state?.engine === engine && state.actorId === actorId
    && state.offset === offset && state.limit === limit && state.revision === revision;
  return {
    page: matches ? state.page : null,
    error: matches ? state.error : null,
    loading: Boolean(actorId) && !matches,
    retry: () => setRetry(current => current + 1),
  };
}

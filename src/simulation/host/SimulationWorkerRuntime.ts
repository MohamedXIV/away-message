import { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import type { SimulationQuery, SimulationWorkerReply, SimulationWorkerRequest } from './SimulationHostProtocol';

/**
 * One canonical kernel, one ordered message queue. No second world store,
 * React/Phaser imports, DOM access or arbitrary method-name execution.
 */
export function createSimulationWorkerRuntime(send: (message: SimulationWorkerReply) => void) {
  let kernel: SimulationKernel | null = null;
  let unsubscribe: (() => void) | null = null;
  let queue: Promise<void> = Promise.resolve();
  let closed = false;

  const requireKernel = (): SimulationKernel => {
    if (!kernel) throw new Error('SimulationHost not initialized');
    return kernel;
  };

  const query = async (engine: SimulationKernel, request: SimulationQuery): Promise<unknown> => {
    switch (request.kind) {
      case 'hud': return engine.getHudProjection();
      case 'world': return engine.getWorldRead();
      case 'playerStatus': return engine.getPlayerStatusRead();
      case 'chrome': return engine.getChromeRead();
      case 'presence': return engine.getPresenceRead();
      case 'situation': return engine.getSituationRead();
      case 'residence': return engine.getResidenceRead();
      case 'transit': return engine.getTransitRead();
      case 'messenger': return engine.getMessengerRead(request.maxContacts);
      case 'actor': return engine.getPlayerActorRead(request.actorId);
      case 'conversation': return engine.getConversationReadAsync(
        request.actorId, request.offset, request.limit,
      );
      case 'directory': return engine.getDirectoryRead(request.path, request.offset, request.limit);
      case 'file': return engine.getFileRead(request.path);
      default: throw new Error('Unsupported bounded simulation query');
    }
  };

  const run = async (raw: SimulationWorkerRequest): Promise<void> => {
    if (closed || !raw || !Number.isSafeInteger(raw.id) || raw.id < 1) return;
    const id = raw.id;
    try {
      let value: unknown = null;
      switch (raw.op) {
        case 'init':
          if (kernel) throw new Error('SimulationHost already initialized');
          kernel = new SimulationKernel(raw.initialState);
          unsubscribe = kernel.subscribeChanges(change => send({ type: 'change', change }));
          break;
        case 'dispatch':
          value = requireKernel().dispatchAction(raw.action);
          break;
        case 'advance':
          if (!Number.isSafeInteger(raw.minutes) || raw.minutes < 0) {
            throw new Error('Invalid world-minute advance');
          }
          requireKernel().advanceGameMinutes(raw.minutes, raw.reason);
          break;
        case 'realtime':
          if (!Number.isFinite(raw.seconds) || raw.seconds < 0 || raw.seconds > 2) {
            throw new Error('Invalid bounded realtime delta');
          }
          requireKernel().advanceRealTime(raw.seconds);
          break;
        case 'query':
          value = await query(requireKernel(), raw.query);
          break;
        case 'export':
          value = await requireKernel().exportSnapshotAsync();
          break;
        case 'load':
          requireKernel().loadSnapshot(raw.snapshot);
          break;
        default: throw new Error('Unsupported SimulationHost operation');
      }
      send({ type: 'result', id, ok: true, value });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown simulation worker error';
      send({ type: 'result', id, ok: false, error: { code: 'SIMULATION_HOST_ERROR', message } });
    }
  };

  return {
    /** A cold-page read or save must complete before a later mutation runs. */
    receive(message: SimulationWorkerRequest): Promise<void> {
      if (closed) return Promise.resolve();
      queue = queue.then(() => run(message));
      return queue;
    },
    close(): void {
      closed = true;
      unsubscribe?.();
      unsubscribe = null;
      kernel = null;
    },
  };
}

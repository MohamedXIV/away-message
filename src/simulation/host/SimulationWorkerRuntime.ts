import { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import { loadSlotEngine, saveSlot } from '../../persistence/slots';
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
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let lastClockSample = 0;
  let clockSecondsPending = 0;
  let clockTickQueued = false;

  const stopClock = (): void => {
    if (clockTimer !== null) clearInterval(clockTimer);
    clockTimer = null;
    clockSecondsPending = 0;
    lastClockSample = 0;
  };

  /** One bounded clock job at a time, queued behind save/cold reads.
   * This cannot grow an unbounded timer queue when a slow world tick or
   * IDB export temporarily blocks the Worker event loop.
   */
  const tickClock = (): void => {
    if (closed || clockTimer === null) return;
    const now = performance.now();
    const seconds = Math.min(2, Math.max(0, (now - lastClockSample) / 1000));
    lastClockSample = now;
    clockSecondsPending = Math.min(2, clockSecondsPending + seconds);
    if (clockTickQueued || clockSecondsPending <= 0) return;
    clockTickQueued = true;
    queue = queue.then(() => {
      clockTickQueued = false;
      const elapsed = clockSecondsPending;
      clockSecondsPending = 0;
      if (!closed && clockTimer !== null && kernel && elapsed > 0) {
        kernel.advanceRealTime(elapsed);
      }
    }).catch(cause => {
      // A timer tick has no request ID; notify the client explicitly rather
      // than keeping a silently corrupted game clock alive.
      stopClock();
      closed = true;
      unsubscribe?.();
      unsubscribe = null;
      kernel = null;
      send({ type: 'fatal', error: {
        code: 'SIMULATION_CLOCK_FAILED',
        message: cause instanceof Error ? cause.message : 'Worker clock failed',
      } });
    });
  };

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
      case 'desktop': return engine.getDesktopRead();
      case 'installedPrograms': return engine.getInstalledProgramsRead();
      case 'apps': return engine.getAppRead();
      case 'website': return engine.getWebsiteRead();
      case 'weatherBuddy': return engine.getWeatherBuddyRead();
      case 'jobBoard': return engine.getJobBoardRead();
      case 'mailbox': return engine.getMailboxRead();
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
      case 'installer': return engine.getInstallerRead(request.filePath);
      case 'archive': return engine.getArchiveRead(request.archivePath);
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
        case 'initSlot': {
          if (kernel) throw new Error('SimulationHost already initialized');
          const loaded = await loadSlotEngine(raw.slotId);
          if (!loaded) throw new Error(`Save slot '${raw.slotId}' is missing or unreadable`);
          kernel = loaded;
          unsubscribe = kernel.subscribeChanges(change => send({ type: 'change', change }));
          break;
        }
        case 'dispatch':
          value = requireKernel().dispatchAction(raw.action);
          break;
        case 'hardware': {
          const owner = requireKernel();
          switch (raw.command?.kind) {
            case 'setup': value = owner.setupComputerAtHome(); break;
            case 'power':
              if (typeof raw.command.poweredOn !== 'boolean') {
                throw new Error('Invalid computer power value');
              }
              value = owner.setComputerPower(raw.command.poweredOn);
              break;
            case 'insertMedia':
              if (typeof raw.command.instanceId !== 'string' || !raw.command.instanceId) {
                throw new Error('Invalid owned media identity');
              }
              value = owner.insertOwnedMediaAtHome(raw.command.instanceId);
              break;
            case 'ejectMedia': value = owner.ejectOwnedMediaAtHome(); break;
            case 'prepareOs': value = owner.prepareOsInstallFromInsertedMedia(); break;
            case 'commitOs':
              if (!raw.command.plan || typeof raw.command.plan !== 'object') {
                throw new Error('OS installation needs an authoritative preflight plan');
              }
              value = owner.commitOsInstall(raw.command.plan);
              break;
            default: throw new Error('Unsupported hardware operation');
          }
          break;
        }
        case 'advance':
          if (!Number.isSafeInteger(raw.minutes) || raw.minutes < 0) {
            throw new Error('Invalid world-minute advance');
          }
          requireKernel().advanceGameMinutes(raw.minutes, raw.reason);
          break;
        case 'realtime':
          if (clockTimer !== null) {
            throw new Error('Manual realtime advance unavailable while Worker clock runs');
          }
          if (!Number.isFinite(raw.seconds) || raw.seconds < 0 || raw.seconds > 2) {
            throw new Error('Invalid bounded realtime delta');
          }
          requireKernel().advanceRealTime(raw.seconds);
          break;
        case 'clock':
          requireKernel();
          if (typeof raw.running !== 'boolean') throw new Error('Invalid clock control');
          if (raw.running && clockTimer === null) {
            lastClockSample = performance.now();
            clockSecondsPending = 0;
            clockTimer = setInterval(tickClock, 250);
          } else if (!raw.running) {
            stopClock();
          }
          break;
        case 'query':
          value = await query(requireKernel(), raw.query);
          break;
        case 'export':
          value = await requireKernel().exportSnapshotAsync();
          break;
        case 'saveSlot':
          value = await saveSlot(requireKernel(), raw.slotId, raw.saveName, raw.pulse);
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
      stopClock();
      closed = true;
      unsubscribe?.();
      unsubscribe = null;
      kernel = null;
    },
  };
}

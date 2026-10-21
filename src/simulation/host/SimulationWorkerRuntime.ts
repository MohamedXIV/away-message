import { SimulationKernel } from '../../engine/kernel/SimulationKernel';
import { loadSlotEngine, saveSlot } from '../../persistence/slots';
import type { LabProceduralCategory, SimulationQuery, SimulationWorkerReply, SimulationWorkerRequest } from './SimulationHostProtocol';

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
      case 'gameView': {
        // One FIFO message: a live clock tick cannot land between these reads.
        // Only three allowlisted bounded projections, never the domain graph.
        const hud = engine.getHudProjection();
        const world = engine.getWorldRead();
        const player = engine.getPlayerStatusRead();
        if (hud.revision !== world.revision || hud.revision !== player.revision) {
          throw new Error('Worker game view has inconsistent revisions');
        }
        return { revision: hud.revision, hud, world, player };
      }
      case 'hud': return engine.getHudProjection();
      case 'world': return engine.getWorldRead();
      case 'playerStatus': return engine.getPlayerStatusRead();
      case 'chrome': return engine.getChromeRead();
      case 'desktop': return engine.getDesktopRead();
      case 'installedPrograms': return engine.getInstalledProgramsRead();
      case 'labPage': {
        const actorPage = request.actorPage ?? 0;
        const meetingPage = request.meetingPage ?? 0;
        if (![actorPage, meetingPage].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 4096)) {
          throw new Error('Lab indices must be bounded nonnegative integers');
        }
        // This is an explicitly opened developer diagnostic, not a player read.
        // The canonical owner computes one page; strip every large history and
        // the 500-name image picker before crossing the Worker boundary.
        const read = engine.getLabInspectorRead(actorPage, meetingPage);
        return {
          revision: read.revision,
          day: read.day,
          currentOsId: read.currentOsId,
          eventCounts: read.eventCounts,
          roster: { total: read.roster.total, procedural: read.roster.procedural },
          actors: read.actors.slice(0, 16).map(actor => ({
            id: actor.id,
            displayName: actor.displayName.slice(0, 80),
            handle: actor.handle.slice(0, 80),
            relationship: actor.relationship,
            stage: actor.stage,
            dailyMood: actor.dailyMood,
            status: actor.status,
            memoryCount: actor.memories.length,
            promiseCount: actor.promises.length,
            recentMemories: actor.memories.slice(-3).map(m => ({
              id: m.id, kind: m.kind, day: m.day, text: m.text.slice(0, 160),
            })),
          })),
          appointments: {
            total: read.appointments.total,
            todayCount: read.appointments.todayCount,
            page: read.appointments.page.slice(0, 16).map(appt => ({
              id: appt.id, characterId: appt.characterId,
              locationId: appt.locationId, targetDay: appt.targetDay,
              status: appt.status, rsvp: appt.rsvp,
            })),
          },
          body: read.body,
        };
      }
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
        case 'labProcedural': {
          const command = raw.command;
          const categories: readonly LabProceduralCategory[] = [
            'mixed', 'city_news', 'site_launch', 'economy', 'culture', 'system', 'os_release',
          ];
          if (!command || (command.mode !== 'preview' && command.mode !== 'inject')
            || typeof command.seed !== 'string' || !/^[a-zA-Z0-9 _:-]{1,64}$/.test(command.seed.trim())
            || !Number.isSafeInteger(command.count) || command.count < 1 || command.count > 3
            || !categories.includes(command.category)) {
            throw new Error('Invalid bounded offline Lab generation controls');
          }
          const owner = requireKernel();
          const revision = owner.getRevision();
          if (command.mode === 'inject' &&
            (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== revision)) {
            throw new Error('Lab preview is stale; preview again before injecting');
          }
          const allowedCategories: Array<Exclude<LabProceduralCategory, 'mixed'>> =
            command.category === 'mixed'
              ? ['city_news', 'site_launch', 'economy', 'culture', 'system', 'os_release']
              : [command.category];
          const options = {
            worldSeed: command.seed.trim(), maxEvents: command.count,
            allowedCategories, useAI: false, inject: false,
          };
          // The same canonical-world generator handles both modes. The Worker
          // FIFO and revision precondition prevent stale preview writeback.
          const generated = command.mode === 'preview'
            ? await owner.previewLabProceduralEvents(options)
            : await owner.generateProceduralEvents(options);
          value = {
            mode: command.mode,
            revision: owner.getRevision(),
            events: generated.events.slice(0, 3).map(event => ({
              id: event.id, title: event.title, description: event.description,
              category: event.category, triggerDay: event.triggerDay,
              triggerHour: event.triggerHour, knowledgePrompt: event.knowledgePrompt,
            })),
            injectedIds: generated.injectedIds.slice(0, 3),
          };
          break;
        }
        case 'labOs': {
          const command = raw.command;
          if (!command || (command.mode !== 'preview' && command.mode !== 'inject')
            || typeof command.seed !== 'string' || !/^[a-zA-Z0-9 _:-]{1,64}$/.test(command.seed.trim())
            || !(['5.x', '6.x', '7.x'] as string[]).includes(command.family)) {
            throw new Error('Invalid bounded offline OS Lab controls');
          }
          const owner = requireKernel();
          if (command.mode === 'inject' &&
            (!Number.isSafeInteger(command.expectedRevision)
              || command.expectedRevision !== owner.getRevision())) {
            throw new Error('OS Lab preview is stale; preview again before injecting');
          }
          const release = owner.previewOfflineLabOsRelease(command.seed.trim(), command.family);
          if (command.mode === 'inject') owner.registerLabOsRelease(release);
          const bounded = {
            id: release.id, version: release.version, build: release.build,
            displayName: release.displayName, family: release.family,
            kind: release.kind, channel: release.channel, releaseDay: release.releaseDay,
            changelog: release.changelog.slice(0, 6).map(line => line.slice(0, 160)),
            requirements: {
              minRamMB: release.requirements.minRamMB,
              minCpuTier: release.requirements.minCpuTier,
              minDiskGB: release.requirements.minDiskGB,
            },
            installSizeGB: release.installSizeGB,
            ramOverheadMB: release.ramOverheadMB,
            bootTimeSeconds: release.bootTimeSeconds,
            theme: release.theme, price: release.price, blurb: release.blurb,
          };
          value = {
            revision: owner.getRevision(), mode: command.mode,
            release: bounded, registered: command.mode === 'inject',
          };
          break;
        }
        case 'labCharacter': {
          const command = raw.command;
          const sources = ['nightboard', 'myplace', 'pulse-room', 'work'];
          const archetypes = ['random', 'coworker', 'nightowl', 'student', 'trader', 'artist', 'regular'];
          if (!command || (command.mode !== 'preview' && command.mode !== 'inject')
            || typeof command.seed !== 'string'
            || !/^[a-zA-Z0-9 _:-]{1,64}$/.test(command.seed.trim())
            || !sources.includes(command.metVia)
            || !archetypes.includes(command.archetype)) {
            throw new Error('Invalid bounded offline Character Lab controls');
          }
          const owner = requireKernel();
          const revision = owner.getRevision();
          if (command.mode === 'inject'
            && (!Number.isSafeInteger(command.expectedRevision) ||
              command.expectedRevision !== revision)) {
            throw new Error('Character Lab preview is stale; preview again before injecting');
          }
          // Generate from current canonical Social roster every time. No actor
          // definition is accepted from browser input or returned over IPC.
          const generated = await owner.previewOfflineLabNewcomer(
            command.seed.trim(),
            command.metVia,
            command.archetype === 'random' ? undefined : command.archetype,
          );
          if (command.mode === 'inject') {
            const admitted = owner.dispatchAction({
              type: 'SOCIAL_ADD_BUDDY', buddy: generated.definition,
              introText: generated.introText,
            });
            if (!admitted.success) throw new Error(admitted.error || 'Character registration failed');
          }
          value = {
            revision: owner.getRevision(), mode: command.mode,
            registered: command.mode === 'inject',
            actor: {
              id: generated.definition.id,
              displayName: generated.definition.displayName,
              handle: generated.definition.handle,
              archetype: generated.definition.archetype,
              metVia: command.metVia,
              reach: generated.definition.reach,
              introText: generated.introText.slice(0, 320),
            },
          };
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

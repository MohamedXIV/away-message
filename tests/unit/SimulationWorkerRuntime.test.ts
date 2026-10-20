import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type {
  SimulationWorkerReply, SimulationWorkerRequest, SimulationWorkerCommand,
} from '../../src/simulation/host/SimulationHostProtocol';

function harness() {
  const sent: SimulationWorkerReply[] = [];
  const runtime = createSimulationWorkerRuntime(message => sent.push(message));
  let nextId = 0;
  const ask = async (command: SimulationWorkerCommand) => {
    const id = ++nextId;
    await runtime.receive({ ...command, id } as SimulationWorkerRequest);
    const result = [...sent].reverse().find(message => message.type === 'result' && message.id === id);
    if (!result || result.type !== 'result') throw Error('Missing worker reply');
    if (!result.ok) throw Error(result.error.message);
    return result.value;
  };
  return { runtime, sent, ask };
}

describe('#175 single-writer Worker runtime protocol', () => {
  it('uses one Kernel, dispatches commands, and publishes bounded revisions', async () => {
    const { ask, sent, runtime } = harness();
    const readState = vi.spyOn(SimulationKernel.prototype, 'getState');
    try {
      await ask({ op: 'init' });
      const before = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(before.revision).toBe(0);
      await expect(ask({ op: 'init' })).rejects.toThrow('already initialized');
      const changed = await ask({
        op: 'dispatch', action: { type: 'WORLD_SET_FLAG', key: 'worker_law', value: true },
      });
      expect(changed).toMatchObject({ success: true });
      const after = await ask({ op: 'query', query: { kind: 'world' } }) as ReturnType<SimulationKernel['getWorldRead']>;
      expect(after.revision).toBeGreaterThan(0);
      const events = sent.filter(m => m.type === 'change');
      expect(events.length).toBeGreaterThan(1);
      expect(events.at(-1)).toMatchObject({
        change: { changedDomains: expect.arrayContaining(['world', 'unknown']) },
      });
      expect(readState).not.toHaveBeenCalled();
      expect(JSON.stringify(events)).not.toContain('conversations');
    } finally {
      readState.mockRestore();
      runtime.close();
    }
  });

  it('serializes queued writes and restores saved truth without replaying operations', async () => {
    const { ask, runtime } = harness();
    try {
      await ask({ op: 'init' });
      const initial = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      const ops = [
        ask({ op: 'advance', minutes: 3, reason: 'first' }),
        ask({ op: 'advance', minutes: 7, reason: 'second' }),
        ask({ op: 'query', query: { kind: 'hud' } }),
      ];
      const [, , latest] = await Promise.all(ops);
      expect((latest as ReturnType<SimulationKernel['getHudProjection']>).time.totalMinutes)
        .toBe(initial.time.totalMinutes + 10);
      const saved = await ask({ op: 'export' }) as ReturnType<SimulationKernel['exportSnapshot']>;
      await ask({ op: 'advance', minutes: 5 });
      await ask({ op: 'load', snapshot: saved });
      const restored = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(restored.time.totalMinutes).toBe(saved.time.totalMinutes);
      expect(restored.cash).toBe(saved.player.cash);
    } finally {
      runtime.close();
    }
  });

  it('refuses private reads, bad deltas and invalid RPCs without moving world time', async () => {
    const { ask, runtime } = harness();
    await ask({ op: 'init' });
    const before = await ask({ op: 'query', query: { kind: 'hud' } });
    await expect(ask({ op: 'query', query: { kind: 'getState' } as never }))
      .rejects.toThrow('Unsupported bounded');
    await expect(ask({ op: 'advance', minutes: -2 }))
      .rejects.toThrow('Invalid world-minute');
    await expect(ask({ op: 'realtime', seconds: Number.POSITIVE_INFINITY }))
      .rejects.toThrow('Invalid bounded');
    expect(await ask({ op: 'query', query: { kind: 'hud' } })).toEqual(before);
    runtime.close();
  });

  it('returns player-safe empty views for guessed private actor IDs', async () => {
    const { ask, runtime } = harness();
    await ask({ op: 'init' });
    expect(await ask({ op: 'query', query: { kind: 'actor', actorId: 'unknown_999' } }))
      .toBeNull();
    expect(await ask({ op: 'query', query: { kind: 'conversation', actorId: 'unknown_999' } }))
      .toMatchObject({ messages: [], total: 0 });
    runtime.close();
  });

  it('owns a bounded clock inside the Worker without any render-loop calls', async () => {
    const { ask, runtime } = harness();
    await ask({ op: 'init' });
    const before = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
    vi.useFakeTimers();
    try {
      await ask({ op: 'clock', running: true });
      await expect(ask({ op: 'realtime', seconds: 0.25 }))
        .rejects.toThrow('while Worker clock runs');
      await vi.advanceTimersByTimeAsync(1500);
      const progressed = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(progressed.time.totalMinutes).toBeGreaterThanOrEqual(before.time.totalMinutes + 1);
      await ask({ op: 'clock', running: false });
      const stopped = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      await vi.advanceTimersByTimeAsync(2000);
      expect(await ask({ op: 'query', query: { kind: 'hud' } }))
        .toMatchObject({ time: { totalMinutes: stopped.time.totalMinutes } });
      await ask({ op: 'realtime', seconds: 1 });
      const manuallyAdvanced = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(manuallyAdvanced.time.totalMinutes).toBeGreaterThan(stopped.time.totalMinutes);
    } finally {
      runtime.close();
      vi.useRealTimers();
    }
  });

  it('treats clock engine errors as fatal instead of silently continuing a corrupt world', async () => {
    const { ask, sent, runtime } = harness();
    await ask({ op: 'init' });
    const spy = vi.spyOn(SimulationKernel.prototype, 'advanceRealTime')
      .mockImplementation(() => { throw new Error('clock-owner-failure'); });
    vi.useFakeTimers();
    try {
      await ask({ op: 'clock', running: true });
      await vi.advanceTimersByTimeAsync(500);
      expect(sent.some(event => event.type === 'fatal'
        && event.error.message === 'clock-owner-failure')).toBe(true);
    } finally {
      spy.mockRestore();
      runtime.close();
      vi.useRealTimers();
    }
  });

  it('installs Orion through the original owned-media preflight/commit on the one Worker', async () => {
    const { ask, runtime } = harness();
    try {
      await ask({ op: 'init' });
      const failed = await ask({ op: 'hardware', command: { kind: 'prepareOs' } }) as { success: boolean };
      expect(failed.success).toBe(false);
      const before = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      const purchased = await ask({ op: 'dispatch', action: {
        type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard',
      } }) as { success: boolean };
      expect(purchased.success).toBe(true);
      const setup = await ask({ op: 'hardware', command: { kind: 'setup' } }) as { success: boolean };
      expect(setup.success).toBe(true);
      const desktop = await ask({ op: 'query', query: { kind: 'desktop' } }) as ReturnType<SimulationKernel['getDesktopRead']>;
      const owned = desktop.bootMediaItems.find(item => item.catalogItemId === 'media_orion_48_setup');
      expect(owned?.location).toBe('room_package');
      const inserted = await ask({ op: 'hardware', command: {
        kind: 'insertMedia', instanceId: owned!.instanceId,
      } }) as { success: boolean };
      expect(inserted.success).toBe(true);
      const preflightStart = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(preflightStart.time.totalMinutes).toBeGreaterThan(before.time.totalMinutes);
      const prepared = await ask({ op: 'hardware', command: { kind: 'prepareOs' } }) as ReturnType<SimulationKernel['prepareOsInstallFromInsertedMedia']>;
      expect(prepared).toMatchObject({
        success: true, data: { targetOs: 'Orion_4.8', mode: 'fresh' },
      });
      const preflightTime = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(preflightTime.time.totalMinutes).toBe(preflightStart.time.totalMinutes);
      const ejected = await ask({ op: 'hardware', command: { kind: 'ejectMedia' } }) as { success: boolean };
      expect(ejected.success).toBe(true);
      const stale = await ask({ op: 'hardware', command: {
        kind: 'commitOs', plan: prepared.data!,
      } }) as { success: boolean };
      expect(stale.success).toBe(false);
      expect((await ask({ op: 'query', query: { kind: 'desktop' } }) as ReturnType<SimulationKernel['getDesktopRead']>).osVersion).toBeNull();
      await ask({ op: 'hardware', command: {
        kind: 'insertMedia', instanceId: owned!.instanceId,
      } });
      const current = await ask({ op: 'hardware', command: { kind: 'prepareOs' } }) as ReturnType<SimulationKernel['prepareOsInstallFromInsertedMedia']>;
      const commitStart = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      const committed = await ask({ op: 'hardware', command: {
        kind: 'commitOs', plan: current.data!,
      } }) as { success: boolean };
      expect(committed.success).toBe(true);
      const installed = await ask({ op: 'query', query: { kind: 'desktop' } }) as ReturnType<SimulationKernel['getDesktopRead']>;
      expect(installed.osVersion).toBe('Orion_4.8');
      const after = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(after.time.totalMinutes - commitStart.time.totalMinutes)
        .toBe(current.data!.durationMinutes);
    } finally { runtime.close(); }
  });

  it('serves only bounded public news and job-board projections to Worker-facing apps', async () => {
    const { ask, runtime } = harness();
    const getState = vi.spyOn(SimulationKernel.prototype, 'getState');
    try {
      await ask({ op: 'init' });
      const site = await ask({ op: 'query', query: { kind: 'website' } }) as
        ReturnType<SimulationKernel['getWebsiteRead']>;
      const jobs = await ask({ op: 'query', query: { kind: 'jobBoard' } }) as
        ReturnType<SimulationKernel['getJobBoardRead']>;
      expect(site.world.triggeredEvents.length).toBeLessThanOrEqual(256);
      expect(jobs.jobs.length).toBeLessThanOrEqual(32);
      expect(site.revision).toBe(jobs.revision);
      expect('social' in site).toBe(false);
      expect('actors' in jobs).toBe(false);
      expect(getState).not.toHaveBeenCalled();
    } finally {
      getState.mockRestore();
      runtime.close();
    }
  });

  it('rejects missing, forged and path-traversal installers without touching installed software', async () => {
    const { ask, runtime } = harness();
    const getState = vi.spyOn(SimulationKernel.prototype, 'getState');
    try {
      await ask({ op: 'init' });
      const path = 'C:/Downloads/pulse52_setup.exe';
      const missing = await ask({ op: 'query', query: { kind: 'installer', filePath: path } }) as
        ReturnType<SimulationKernel['getInstallerRead']>;
      expect(missing).toMatchObject({
        ready: false, softwareId: 'sw_pulse_52', preview: null,
      });
      expect(missing.reason).toMatch(/not present/i);
      const denied = await ask({ op: 'dispatch', action: {
        type: 'SOFTWARE_INSTALL_FROM_DOWNLOAD', filePath: path,
      } }) as { success: boolean };
      expect(denied.success).toBe(false);
      const traversal = await ask({ op: 'query', query: {
        kind: 'installer', filePath: 'C:/Downloads/../Windows/evil.exe',
      } }) as ReturnType<SimulationKernel['getInstallerRead']>;
      expect(traversal.ready).toBe(false);
      expect(traversal.softwareId).toBeNull();
      const forged = await ask({ op: 'dispatch', action: { type: 'VFS_CREATE_FILE',
        file: {
          name: 'pulse52_setup.exe', path, parentPath: 'C:/Downloads',
          kind: 'installer', sizeBytes: 100,
          metadata: { author: 'pulse_52' },
        },
      } }) as { success: boolean };
      expect(forged.success).toBe(true);
      const forgedReceipt = await ask({ op: 'dispatch', action: {
        type: 'VFS_CREATE_FILE',
        file: { name: 'forged.exe', path: 'C:/Downloads/forged.exe',
          parentPath: 'C:/Downloads', kind: 'installer', sizeBytes: 5,
          metadata: { downloadTaskId: 'dl_1' } },
      } }) as { success: boolean; error?: string };
      expect(forgedReceipt.success).toBe(false);
      expect(forgedReceipt.error).toMatch(/owner-only/i);
      const withoutTransfer = await ask({ op: 'query', query: {
        kind: 'installer', filePath: path,
      } }) as ReturnType<SimulationKernel['getInstallerRead']>;
      expect(withoutTransfer.ready).toBe(false);
      expect(withoutTransfer.reason).toMatch(/matching completed DownloadHub transfer/);
      const apps = await ask({ op: 'query', query: { kind: 'apps' } }) as
        ReturnType<SimulationKernel['getAppRead']>;
      expect(apps.installedSoftware).toHaveLength(0);
      expect(getState).not.toHaveBeenCalled();
    } finally {
      getState.mockRestore();
      runtime.close();
    }
  });

  it('installs an actually completed DownloadHub file after authored OS and network setup', async () => {
    const { ask, runtime } = harness();
    try {
      await ask({ op: 'init' });
      const purchase = await ask({ op: 'dispatch', action: {
        type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard',
      } }) as { success: boolean };
      expect(purchase.success).toBe(true);
      const setup = await ask({ op: 'hardware', command: { kind: 'setup' } }) as { success: boolean };
      expect(setup.success).toBe(true);
      const desk = await ask({ op: 'query', query: { kind: 'desktop' } }) as ReturnType<SimulationKernel['getDesktopRead']>;
      const media = desk.bootMediaItems.find(item => item.catalogItemId === 'media_orion_48_setup');
      expect(media).toBeDefined();
      await ask({ op: 'hardware', command: { kind: 'insertMedia', instanceId: media!.instanceId } });
      const preflight = await ask({ op: 'hardware', command: { kind: 'prepareOs' } }) as
        ReturnType<SimulationKernel['prepareOsInstallFromInsertedMedia']>;
      expect(preflight.success).toBe(true);
      const os = await ask({ op: 'hardware', command: { kind: 'commitOs', plan: preflight.data! } }) as { success: boolean };
      expect(os.success).toBe(true);
      await ask({ op: 'hardware', command: { kind: 'power', poweredOn: true } });
      const modem = await ask({ op: 'dispatch', action: {
        type: 'HARDWARE_UPGRADE_CONNECTION', connectionType: 'dsl_256k', cost: 0,
      } }) as { success: boolean };
      expect(modem.success).toBe(true);
      const filePath = 'C:/Downloads/pulse52_setup.exe';
      // Cheap forged-size transfer cannot unlock the authored 6 MiB package.
      const cheap = await ask({ op: 'dispatch', action: {
        type: 'DOWNLOAD_START', sourceId: 'pulse_52',
        url: 'http://downloadhub.local/files/pulse52_setup.exe',
        fileName: 'pulse52_setup.exe', totalBytes: 1024,
        sourceMaxKbps: 256, fileKind: 'installer',
      } }) as { success: boolean };
      expect(cheap.success).toBe(true);
      await ask({ op: 'advance', minutes: 1 });
      const wrongSize = await ask({ op: 'query', query: { kind: 'installer', filePath } }) as
        ReturnType<SimulationKernel['getInstallerRead']>;
      expect(wrongSize.ready).toBe(false);
      expect(wrongSize.reason).toMatch(/published authored software package/i);
      const removed = await ask({ op: 'dispatch', action: { type: 'VFS_DELETE_FILE', path: filePath } }) as { success: boolean };
      expect(removed.success).toBe(true);
      const download = await ask({ op: 'dispatch', action: {
        type: 'DOWNLOAD_START',
        sourceId: 'pulse_52', url: 'http://downloadhub.local/files/pulse52_setup.exe',
        fileName: 'pulse52_setup.exe', totalBytes: 6 * 1024 * 1024, sourceMaxKbps: 256,
        fileKind: 'installer',
      } }) as { success: boolean };
      expect(download.success).toBe(true);
      const pending = await ask({ op: 'query', query: { kind: 'installer', filePath } }) as
        ReturnType<SimulationKernel['getInstallerRead']>;
      expect(pending.ready).toBe(false);
      await ask({ op: 'advance', minutes: 4 });
      const ready = await ask({ op: 'query', query: { kind: 'installer', filePath } }) as
        ReturnType<SimulationKernel['getInstallerRead']>;
      expect(ready.ready).toBe(true);
      expect(ready.preview?.compatibilityResult.isCompatible).toBe(true);
      expect(ready.preview?.softwareDef.id).toBe('sw_pulse_52');
      const display = await ask({ op: 'query', query: { kind: 'file', path: filePath } }) as
        ReturnType<SimulationKernel['getFileRead']>;
      expect(display.file?.metadata).toBeUndefined();
      const installed = await ask({ op: 'dispatch', action: {
        type: 'SOFTWARE_INSTALL_FROM_DOWNLOAD', filePath,
        selectedOptions: { createDesktopShortcut: false },
      } }) as { success: boolean };
      expect(installed.success).toBe(true);
      const apps = await ask({ op: 'query', query: { kind: 'apps' } }) as
        ReturnType<SimulationKernel['getAppRead']>;
      expect(apps.installedSoftware.some(item => item.appId === 'app.pulse')).toBe(true);
      const desktop = await ask({ op: 'query', query: { kind: 'desktop' } }) as
        ReturnType<SimulationKernel['getDesktopRead']>;
      expect(desktop.desktopFiles.some(item => item.name.includes('Pulse Messenger'))).toBe(false);
    } finally { runtime.close(); }
  });

  it('publishes five canonical weather outlook days without cloning WorldState', async () => {
    const { ask, runtime } = harness();
    const source = vi.spyOn(SimulationKernel.prototype, 'getWeatherBuddyRead');
    const full = vi.spyOn(SimulationKernel.prototype, 'getState');
    try {
      await ask({ op: 'init' });
      const weather = await ask({ op: 'query', query: { kind: 'weatherBuddy' } }) as
        ReturnType<SimulationKernel['getWeatherBuddyRead']>;
      const apps = await ask({ op: 'query', query: { kind: 'apps' } }) as
        ReturnType<SimulationKernel['getAppRead']>;
      expect(source).toHaveBeenCalledOnce();
      expect(weather.forecast).toHaveLength(5);
      expect(weather.current.weather.highF).toEqual(expect.any(Number));
      expect(weather.revision).toBe(apps.revision);
      expect(weather).not.toHaveProperty('world');
      expect(weather).not.toHaveProperty('roster');
      expect(full).not.toHaveBeenCalled();
    } finally {
      source.mockRestore();
      full.mockRestore();
      runtime.close();
    }
  });

  it('makes a real STORED ZIP, verifies CRC, extracts actual VFS documents and refuses collisions', async () => {
    const {ask,runtime}=harness();
    const full=vi.spyOn(SimulationKernel.prototype,'getState');
    try{
      await ask({op:'init'});
      const created=await ask({op:'dispatch',action:{type:'VFS_ARCHIVE_CREATE',
        archiveName:'notes.zip',filePaths:['C:/Documents/Readme.txt']}}) as {success:boolean};
      expect(created.success).toBe(true);
      const preview=await ask({op:'query',query:{kind:'archive',
        archivePath:'C:/Documents/notes.zip'}}) as ReturnType<SimulationKernel['getArchiveRead']>;
      expect(preview.ready).toBe(true);
      expect(preview.entries).toEqual([{name:'Readme.txt',sizeBytes:expect.any(Number),
        crc32:expect.stringMatching(/^[0-9A-F]{8}$/)}]);
      expect(preview).not.toHaveProperty('content');
      const result=await ask({op:'dispatch',action:{type:'VFS_ARCHIVE_EXTRACT',
        archivePath:'C:/Documents/notes.zip'}}) as {success:boolean};
      expect(result.success).toBe(true);
      const original=await ask({op:'query',query:{kind:'file',
        path:'C:/Documents/Readme.txt'}}) as ReturnType<SimulationKernel['getFileRead']>;
      const extracted=await ask({op:'query',query:{kind:'file',
        path:'C:/Documents/notes_Readme.txt'}}) as ReturnType<SimulationKernel['getFileRead']>;
      expect(extracted.file?.content).toBe(original.file?.content);
      const again=await ask({op:'dispatch',action:{type:'VFS_ARCHIVE_EXTRACT',
        archivePath:'C:/Documents/notes.zip'}}) as {success:boolean};
      expect(again.success).toBe(false);
      const traversal=await ask({op:'query',query:{kind:'archive',
        archivePath:'C:/Documents/../Windows/evil.zip'}}) as ReturnType<SimulationKernel['getArchiveRead']>;
      expect(traversal.ready).toBe(false);
      expect(full).not.toHaveBeenCalled();
    } finally{full.mockRestore();runtime.close();}
  });

  it('reads player-safe mail and courier tray from the canonical Worker owner', async () => {
    const { ask, runtime } = harness();
    const read = vi.spyOn(SimulationKernel.prototype, 'getMailboxRead');
    const getState = vi.spyOn(SimulationKernel.prototype, 'getState');
    try {
      await ask({ op: 'init' });
      const mailbox = await ask({ op: 'query', query: { kind: 'mailbox' } }) as
        ReturnType<SimulationKernel['getMailboxRead']>;
      expect(read).toHaveBeenCalledOnce();
      expect(mailbox.npcMails.length).toBeLessThanOrEqual(12);
      expect(mailbox.npcMails.every(mail => typeof mail.key === 'string')).toBe(true);
      expect(Array.isArray(mailbox.orders)).toBe(true);
      expect('social' in mailbox).toBe(false);
      expect('conversations' in mailbox).toBe(false);
      expect(getState).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      getState.mockRestore();
      runtime.close();
    }
  });
});

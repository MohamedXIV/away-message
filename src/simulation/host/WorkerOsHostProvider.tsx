import React, { useEffect, useMemo, useState } from 'react';
import type { SimulationAppRead } from '../../engine/kernel/SimulationPublication';
import { OsHostApiProvider, resolveHostNetworkState, type OsHostApi } from '../../desktop/host/OsHostApiContext';
import { resolveActiveOsPresentation } from '../../desktop/host/OsPresentation';
import { useWindowStore } from '../../store/useWindowStore';
import { soundManager } from '../../audio/SoundManager';
import { synthAudio } from '../../audio/SynthAudio';
import { FlashFetchApp } from '../../apps/flashfetch/FlashFetchApp';
import type { WorkerGameSession } from './WorkerGameSession';

/** Exact same OS app contract on either owner. Never import OsHostContext,
 * useSimulationStore, or a browser-side WorldState/engine here.
 */
export function WorkerOsHostProvider({ session, windowId, appRead, onError, children }: {
  session: WorkerGameSession;
  windowId: string;
  appRead: SimulationAppRead;
  onError: (message: string) => void;
  children: React.ReactNode;
}) {
  const closeWindow = useWindowStore(s => s.closeWindow);
  const minimizeWindow = useWindowStore(s => s.minimizeWindow);
  const maximizeWindow = useWindowStore(s => s.maximizeWindow);
  const setWindowTitle = useWindowStore(s => s.setWindowTitle);

  const api: OsHostApi = useMemo(() => {
    const activeOs = appRead.os.currentOsId;
    const presentation = resolveActiveOsPresentation(activeOs);
    const soundScheme = presentation?.soundSchemeId;
    const network = resolveHostNetworkState({
      computerAssembled: appRead.computer.assembled,
      computerPoweredOn: appRead.computer.poweredOn,
      activeOs,
      connectionType: appRead.hardware.connectionType,
      connectionSpeedKbps: appRead.hardware.connectionSpeedKbps,
    });
    const send = (action: Parameters<WorkerGameSession['dispatch']>[0]) => {
      void session.dispatch(action)
        .then(result => {
          if (!result.success) onError(result.error || 'Simulation command rejected');
        })
        .catch(cause => onError(cause instanceof Error ? cause.message : String(cause)));
    };
    return {
      window: {
        id: windowId,
        setTitle: title => setWindowTitle(windowId, title),
        close: () => { synthAudio.playWindowSound('close', soundScheme); closeWindow(windowId); },
        minimize: () => { synthAudio.playWindowSound('minimize', soundScheme); minimizeWindow(windowId); },
        maximize: () => { synthAudio.playWindowSound('restore', soundScheme); maximizeWindow(windowId); },
      },
      vfs: {
        readFile: async path => {
          const data = await session.read({ kind: 'file', path });
          return data.file?.content ?? null;
        },
        writeFile: async (path, content) => {
          const match = /^(C:\/[^\\\\]+\/)([^/\\\\]{1,64}\.txt)$/i.exec(path);
          if (!match) { onError('A valid C:/ folder and .txt document name are required'); return false; }
          const name = match[2]!;
          const parentPath = match[1]!.slice(0, -1);
          const result = await session.dispatch({
            type: 'VFS_CREATE_FILE',
            file: {
              path, parentPath, name, kind: 'text',
              content, sizeBytes: new TextEncoder().encode(content).length,
              metadata: { textContent: content },
            },
          });
          if (!result.success) { onError(result.error || 'File save rejected'); return false; }
          synthAudio.playDriveSeek(350);
          return true;
        },
        deleteFile: async path => {
          const result = await session.dispatch({ type: 'VFS_DELETE_FILE', path });
          if (!result.success) { onError(result.error || 'File deletion rejected'); return false; }
          synthAudio.playHddChirp();
          return true;
        },
      },
      network: {
        status: network.status,
        effectiveKbps: network.effectiveKbps,
        transfers: appRead.downloads,
        startDownload: params => {
          let target: URL;
          try { target = new URL(params.url); }
          catch { onError('A valid in-game .local HTTP download address is required'); return; }
          if (target.protocol !== 'http:' || !target.hostname.endsWith('.local') ||
            target.username || target.password ||
            !/^[a-z0-9._-]{1,80}$/i.test(params.fileName) ||
            !Number.isSafeInteger(params.totalBytes) || params.totalBytes <= 0) {
            onError('Only authorized in-game .local downloads with a valid file name are supported');
            return;
          }
          send({
            type: 'DOWNLOAD_START',
            sourceId: params.sourceId, url: target.href,
            fileName: params.fileName, totalBytes: params.totalBytes,
            sourceMaxKbps: params.sourceMaxKbps ?? network.effectiveKbps,
            fileKind: params.fileKind,
            manager: params.clientProfile?.clientId === 'flashfetch' ? 'flashfetch' : 'browser',
          });
        },
        cancelDownload: taskId => send({ type: 'DOWNLOAD_CANCEL', taskId }),
      },
      audio: {
        playUiSound: sound => { soundManager.play(sound === 'error' ? 'error' : 'click'); },
        playHddChirp: () => synthAudio.playHddChirp(),
      },
      system: {
        activeOs,
        presentation,
        capabilities: presentation?.capabilities ?? null,
        hardware: {
          ramMb: appRead.hardware.ramMB,
          freeDiskGb: appRead.hardware.hddFreeGB,
          cpuTier: appRead.hardware.cpuTier,
        },
        showNotification: (_message) => soundManager.play('im_recv'),
      },
    };
  }, [session, windowId, appRead, onError, closeWindow, minimizeWindow, maximizeWindow, setWindowTitle]);

  return <OsHostApiProvider api={api}>{children}</OsHostApiProvider>;
}

/** Reuse the authored download accelerator, powered by Worker-owned download tasks. */
export function WorkerFlashFetchPanel({ session, revision, windowId }: {
  session: WorkerGameSession;
  revision: number;
  windowId: string;
}) {
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void session.read({ kind: 'apps' }).then(result => {
      if (active && result.revision === revision) setApps(result);
    }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [session, revision]);

  return (
    <section className="flex h-full flex-col" data-testid="worker-flashfetch">
      {error && <p role="alert" data-testid="worker-os-host-error"
        className="bg-red-50 p-2 text-xs text-red-900">{error}</p>}
      {apps ? (
        <div className="min-h-0 flex-1">
          <WorkerOsHostProvider session={session} windowId={windowId}
            appRead={apps} onError={setError}>
            <FlashFetchApp />
          </WorkerOsHostProvider>
        </div>
      ) : <p role="status" className="p-2 text-xs">Loading canonical downloads…</p>}
    </section>
  );
}

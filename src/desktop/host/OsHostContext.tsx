// src/desktop/host/OsHostContext.tsx
// Standard Host API exposed to all applications running on the Orion OS desktop.

import React, { useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useSimulationApps } from '../../store/useBoundedSimulationRead';
import { useWindowStore } from '../../store/useWindowStore';
import { soundManager } from '../../audio/SoundManager';
import { synthAudio } from '../../audio/SynthAudio';
import { resolveActiveOsPresentation } from './OsPresentation';
import { OsHostApiProvider, resolveHostNetworkState, type OsHostApi } from './OsHostApiContext';
export { useOsHost, resolveHostNetworkState } from './OsHostApiContext';
export type { OsHostApi, HostNetworkSnapshot, HostNetworkState } from './OsHostApiContext';

export interface OsHostProviderProps {
  windowId: string;
  children: React.ReactNode;
}

export const OsHostProvider: React.FC<OsHostProviderProps> = ({ windowId, children }) => {
  const engine = useSimulationStore((s) => s.engine);
  const syncStateFromEngine = useSimulationStore((s) => s.syncStateFromEngine);
  const appRead = useSimulationApps();
  const osVersion = appRead.os.currentOsId;
  const computerAssembled = appRead.computer.assembled;
  const computerPoweredOn = appRead.computer.poweredOn;
  const ramMb = appRead.hardware.ramMB;
  const hddFreeGB = appRead.hardware.hddFreeGB;
  const cpuTier = appRead.hardware.cpuTier;
  const connectionType = appRead.hardware.connectionType;
  const connectionSpeedKbps = appRead.hardware.connectionSpeedKbps;
  const downloads = appRead.downloads;

  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const setWindowTitle = useWindowStore((s) => s.setWindowTitle);

  const createFile = useSimulationStore((s) => s.createFile);
  const deleteFile = useSimulationStore((s) => s.deleteFile);
  const cancelDownloadStore = useSimulationStore((s) => s.cancelDownload);

  const api: OsHostApi = useMemo(() => {
    const presentation = resolveActiveOsPresentation(osVersion);
    const soundSchemeId = presentation?.soundSchemeId;
    const networkState = resolveHostNetworkState({
      computerAssembled,
      computerPoweredOn,
      activeOs: osVersion,
      connectionType,
      connectionSpeedKbps,
    });

    return {
      window: {
        id: windowId,
        setTitle: (title: string) => setWindowTitle(windowId, title),
        close: () => {
          synthAudio.playWindowSound('close', soundSchemeId);
          closeWindow(windowId);
        },
        minimize: () => {
          synthAudio.playWindowSound('minimize', soundSchemeId);
          minimizeWindow(windowId);
        },
        maximize: () => {
          synthAudio.playWindowSound('restore', soundSchemeId);
          maximizeWindow(windowId);
        },
      },
      vfs: {
        readFile: async (path: string) => {
          return engine.vfs.findFileByPathOrName(path)?.content ?? null;
        },
        writeFile: async (path: string, content: string) => {
          const name = path.slice(path.lastIndexOf('/') + 1);
          const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : 'C:/';
          createFile({
            name,
            path,
            parentPath,
            kind: 'text',
            content,
            sizeBytes: content.length,
          });
          synthAudio.playDriveSeek(350);
          return true;
        },
        deleteFile: async (path: string) => {
          deleteFile(path);
          synthAudio.playHddChirp();
          return true;
        },
      },
      network: {
        status: networkState.status,
        effectiveKbps: networkState.effectiveKbps,
        transfers: Array.isArray(downloads) ? downloads : Object.values(downloads || {}),
        startDownload: (params) => {
          if (engine.world.getFlag('rent_overdue')) return;
          try {
            engine.downloads.startDownload({
              sourceId: params.sourceId,
              sourceUrl: params.url,
              fileName: params.fileName,
              totalBytes: params.totalBytes,
              sourceMaxKbps: params.sourceMaxKbps ?? networkState.effectiveKbps,
              fileKind: params.fileKind,
              clientProfile: params.clientProfile,
              currentMinute: engine.clock.getTotalMinutes(),
            });
            syncStateFromEngine();
          } catch {
            // Host API mirrors the existing void store action contract; engine validation remains authoritative.
          }
        },
        cancelDownload: (taskId) => cancelDownloadStore(taskId),
      },
      audio: {
        playUiSound: (sound) => {
          soundManager.play(sound === 'error' ? 'error' : 'click');
        },
        playHddChirp: () => {
          synthAudio.playHddChirp();
        },
      },
      system: {
        activeOs: osVersion,
        presentation,
        capabilities: presentation?.capabilities ?? null,
        hardware: {
          ramMb,
          freeDiskGb: hddFreeGB,
          cpuTier,
        },
        showNotification: (_text: string) => {
          soundManager.play('im_recv');
        },
      },
    };
  }, [
    windowId,
    engine,
    syncStateFromEngine,
    osVersion,
    computerAssembled,
    computerPoweredOn,
    ramMb,
    hddFreeGB,
    cpuTier,
    connectionType,
    connectionSpeedKbps,
    downloads,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    setWindowTitle,
    createFile,
    deleteFile,
    cancelDownloadStore,
  ]);

  return <OsHostApiProvider api={api}>{children}</OsHostApiProvider>;
};


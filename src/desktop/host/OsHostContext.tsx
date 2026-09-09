// src/desktop/host/OsHostContext.tsx
// Standard Host API exposed to all applications running on the Orion OS desktop.

import React, { createContext, useContext, useMemo } from 'react';
import type {
  ConnectionType,
  DownloadManagerType,
  DownloadTask,
  OsVersion,
} from '../../engine/types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';
import { soundManager } from '../../audio/SoundManager';
import { synthAudio } from '../../audio/SynthAudio';
import {
  resolveActiveOsPresentation,
  type OsPresentationProfile,
} from './OsPresentation';

export interface HostNetworkSnapshot {
  computerAssembled: boolean;
  computerPoweredOn: boolean;
  activeOs: OsVersion | null;
  connectionType: ConnectionType | null;
  connectionSpeedKbps: number;
}

export interface HostNetworkState {
  status: 'offline' | 'dialing' | 'connected';
  effectiveKbps: number;
}

/**
 * Resolve the app-visible network truth from the current physical computer and
 * OS environment. The simulation does not yet model a dial-session lifecycle,
 * so current authoritative states are offline or connected; `dialing` remains
 * part of the host contract for a future explicit connection-state mechanic.
 */
export function resolveHostNetworkState(snapshot: HostNetworkSnapshot): HostNetworkState {
  const usableEnvironment =
    snapshot.computerAssembled &&
    snapshot.computerPoweredOn &&
    snapshot.activeOs !== null &&
    snapshot.connectionType !== null &&
    Number.isFinite(snapshot.connectionSpeedKbps) &&
    snapshot.connectionSpeedKbps > 0;

  if (!usableEnvironment) {
    return { status: 'offline', effectiveKbps: 0 };
  }

  return {
    status: 'connected',
    effectiveKbps: snapshot.connectionSpeedKbps,
  };
}

export interface OsHostApi {
  window: {
    id: string;
    setTitle: (title: string) => void;
    close: () => void;
    minimize: () => void;
    maximize: () => void;
  };
  vfs: {
    readFile: (path: string) => Promise<string | null>;
    writeFile: (path: string, content: string) => Promise<boolean>;
    deleteFile: (path: string) => Promise<boolean>;
  };
  network: {
    status: 'offline' | 'dialing' | 'connected';
    effectiveKbps: number;
    transfers: DownloadTask[];
    startDownload: (params: {
      sourceId: string;
      url: string;
      fileName: string;
      totalBytes: number;
      sourceMaxKbps?: number;
      fileKind?: 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'text';
      manager?: DownloadManagerType;
    }) => void;
    cancelDownload: (taskId: string) => void;
  };
  audio: {
    playUiSound: (sound: 'click' | 'alert' | 'error' | 'bell') => void;
    playHddChirp: () => void;
  };
  system: {
    activeOs: OsVersion | null;
    presentation: OsPresentationProfile | null;
    capabilities: OsPresentationProfile['capabilities'] | null;
    hardware: {
      ramMb: number;
      freeDiskGb: number;
      cpuTier: number;
    };
    showNotification: (text: string) => void;
  };
}

const OsHostContext = createContext<OsHostApi | null>(null);

export interface OsHostProviderProps {
  windowId: string;
  children: React.ReactNode;
}

export const OsHostProvider: React.FC<OsHostProviderProps> = ({ windowId, children }) => {
  const osVersion = useSimulationStore((s) => s.state.os.currentOsId);
  const computerAssembled = useSimulationStore((s) => s.state.computer.assembled);
  const computerPoweredOn = useSimulationStore((s) => s.state.computer.poweredOn);
  const ramMb = useSimulationStore((s) => s.state.hardware.ramMB);
  const hddFreeGB = useSimulationStore((s) => s.state.hardware.hddFreeGB);
  const cpuTier = useSimulationStore((s) => s.state.hardware.cpuTier);
  const connectionType = useSimulationStore((s) => s.state.hardware.connectionType);
  const connectionSpeedKbps = useSimulationStore((s) => s.state.hardware.connectionSpeedKbps);
  const downloads = useSimulationStore((s) => s.state.downloads || []);

  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const setWindowTitle = useWindowStore((s) => s.setWindowTitle);

  const createFile = useSimulationStore((s) => s.createFile);
  const deleteFile = useSimulationStore((s) => s.deleteFile);
  const startDownloadStore = useSimulationStore((s) => s.startDownload);
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
          const files = useSimulationStore.getState().state.vfs.files;
          const found = Object.values(files || {}).find((f) => f.path === path || f.name === path);
          return found?.content ?? null;
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
          startDownloadStore({
            sourceId: params.sourceId,
            url: params.url,
            fileName: params.fileName,
            totalBytes: params.totalBytes,
            sourceMaxKbps: params.sourceMaxKbps ?? networkState.effectiveKbps,
            fileKind: params.fileKind,
            manager: params.manager,
          });
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
    startDownloadStore,
    cancelDownloadStore,
  ]);

  return <OsHostContext.Provider value={api}>{children}</OsHostContext.Provider>;
};

export function useOsHost(): OsHostApi {
  const ctx = useContext(OsHostContext);
  if (!ctx) {
    throw new Error('useOsHost must be used within an OsHostProvider');
  }
  return ctx;
}

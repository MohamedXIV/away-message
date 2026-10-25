import React, { createContext, useContext } from 'react';
import type { ConnectionType, DownloadTask, OsVersion } from '../../engine/types';
import type { DownloadClientProfile } from '../../engine/DownloadManager';
import type { OsPresentationProfile } from './OsPresentation';

/** Shared app-visible contract: browser UI dependencies, not an engine import. */
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
      clientProfile?: DownloadClientProfile;
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


const Context = createContext<OsHostApi | null>(null);

export function OsHostApiProvider({ api, children }: {
  api: OsHostApi;
  children: React.ReactNode;
}) {
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

export function useOsHost(): OsHostApi {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useOsHost must be used within an OsHostProvider');
  return ctx;
}

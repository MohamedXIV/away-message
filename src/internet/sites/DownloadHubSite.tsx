import React, { useState } from 'react';
import { DownloadHubView, DOWNLOAD_CATALOG, type DownloadItem } from './DownloadHubView';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useSimulationWebsite, useSimulationApps } from '../../store/useBoundedSimulationRead';
import { useWindowStore } from '../../store/useWindowStore';
import { useOsHost } from '../../desktop/host/OsHostContext';
import { soundManager } from '../../audio/SoundManager';
import { getDownloadHubDynamicItems } from '../worldSiteHelpers';

export const DownloadHubSite: React.FC<SiteRouteProps> = () => {
  const { network } = useOsHost();
  const downloads = network.transfers;
  const { world, time } = useSimulationWebsite();
  const apps = useSimulationApps();
  const openWindow = useWindowStore((s) => s.openWindow);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  const dynamicItems = getDownloadHubDynamicItems(world, time.day);
  // Pulse releases as heavy versioned downloads (like OS)
  const pulseDynamic: DownloadItem[] = (() => {
    try {
      const enginePulse = (useSimulationStore.getState().engine as any).pulse as { getAvailableReleases: (day:number, hw:any, os:any)=>Array<{id:string; displayName:string; version:string; installSizeMB:number; blurb?:string; changelog:string[]}> };
      const hw = apps.hardware;
      const osVer = apps.os.currentOsId;
      const avail = enginePulse ? enginePulse.getAvailableReleases(time.day, hw as any, osVer as any) : [];
      return avail.map((r: any) => ({
        id: r.id,
        name: r.displayName,
        category: 'Internet' as const,
        version: r.version,
        fileSizeBytes: r.installSizeMB * 1024 * 1024,
        downloadUrl: `http://downloadhub.local/files/${r.id}.exe`,
        description: `${r.blurb ?? ''} — ${r.changelog.slice(0, 2).join(' • ')}`,
      }));
    } catch { return []; }
  })();
  const mergedCatalog: DownloadItem[] = [
    ...pulseDynamic,
    ...dynamicItems.map((d) => ({
      id: d.id,
      name: `${d.isNew ? '★ ' : ''}${d.name}`,
      category: d.category as DownloadItem['category'],
      version: d.version,
      fileSizeBytes: d.fileSizeBytes,
      downloadUrl: d.downloadUrl,
      description: d.description,
    })),
    ...DOWNLOAD_CATALOG,
  ];

  const filtered = selectedCat === 'ALL'
    ? mergedCatalog
    : mergedCatalog.filter((d) => d.category === selectedCat);

  const getDownloadStatus = (item: DownloadItem) => {
    const task = downloads.find((t) => t.sourceId === item.id || t.fileName === (item.downloadUrl.split('/').pop() || ''));
    return task?.status || null;
  };

  const handleDownloadFile = (item: DownloadItem) => {
    const fileName = item.downloadUrl.split('/').pop() || 'setup.exe';
    const existing = downloads.find((t) => t.sourceId === item.id);
    if (existing && (existing.status === 'downloading' || existing.status === 'queued')) {
      setNotice(`${item.name} is already in your download queue — check FlashFetch.`);
      setTimeout(() => setNotice(null), 2500);
      openWindow('flashfetch');
      return;
    }
    network.startDownload({
      sourceId: item.id,
      url: item.downloadUrl,
      fileName,
      totalBytes: item.fileSizeBytes,
      sourceMaxKbps: 256,
      fileKind: 'installer',
    });
    soundManager.play('im_send');
    setNotice(`Queued ${item.name} (${(item.fileSizeBytes / (1024*1024)).toFixed(1)} MB) → C:/Downloads/${fileName} — opened in FlashFetch.`);
    setTimeout(() => setNotice(null), 3000);
    // Auto-open the download manager so the user sees progress inside the desktop, not a real browser popup
    setTimeout(() => openWindow('flashfetch'), 250);
  };


  return <DownloadHubView
    selectedCat={selectedCat} setSelectedCat={setSelectedCat}
    filtered={filtered} dynamicCount={dynamicItems.length} day={time.day}
    notice={notice} setNotice={setNotice} downloads={downloads}
    getDownloadStatus={getDownloadStatus} handleDownloadFile={handleDownloadFile}
  />;
};

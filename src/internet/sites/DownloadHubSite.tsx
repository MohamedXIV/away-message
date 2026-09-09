import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';
import { useOsHost } from '../../desktop/host/OsHostContext';
import { soundManager } from '../../audio/SoundManager';
import { getDownloadHubDynamicItems } from '../worldSiteHelpers';

interface DownloadItem {
  id: string;
  name: string;
  category: 'Utilities' | 'Multimedia' | 'Internet' | 'Security';
  version: string;
  fileSizeBytes: number;
  downloadUrl: string;
  description: string;
  isAdwareBundle?: boolean;
}

const DOWNLOAD_CATALOG: DownloadItem[] = [
  {
    id: 'pulse_52',
    name: 'Pulse Messenger 5.2 Classic',
    category: 'Internet',
    version: '5.2.1',
    fileSizeBytes: 1024 * 1024 * 6,
    downloadUrl: 'http://downloadhub.local/files/pulse52_setup.exe',
    description: 'The definitive instant messaging client with custom away messages and buddy lists.',
  },
  {
    id: 'retroamp_setup',
    name: 'RetroAmp Audio Player 2.95',
    category: 'Multimedia',
    version: '2.95',
    fileSizeBytes: 1024 * 1024 * 4,
    downloadUrl: 'http://downloadhub.local/files/retroamp_setup.exe',
    description: 'High-fidelity MP3/WAV player with 10-band equalizer and spectrum visualizer.',
  },
  {
    id: 'flashfetch_setup',
    name: 'FlashFetch Download Accelerator',
    category: 'Utilities',
    version: '3.1',
    fileSizeBytes: 1024 * 1024 * 2,
    downloadUrl: 'http://downloadhub.local/files/flashfetch_setup.exe',
    description: 'Accelerate web downloads with 8 segmented parallel connections.',
  },
  {
    id: 'zipmate_setup',
    name: 'ZipMate Archive Extractor 4.0',
    category: 'Utilities',
    version: '4.0.2',
    fileSizeBytes: 1024 * 1024 * 3,
    downloadUrl: 'http://downloadhub.local/files/zipmate_setup.exe',
    description: 'Compress and extract ZIP, TAR, and GZ archives with maximum ratio.',
  },
  {
    id: 'weatherbuddy_bundle',
    name: 'WeatherBuddy Desktop Companion',
    category: 'Internet',
    version: '3.1',
    fileSizeBytes: 1024 * 1024 * 5,
    downloadUrl: 'http://downloadhub.local/files/weatherbuddy_bundle.exe',
    description: 'Desktop frog mascot providing animated weather forecasts. Includes optional SearchMate Smart Search companion.',
    isAdwareBundle: true,
  },
  {
    id: 'safesweep_setup',
    name: 'SafeSweep Anti-Spyware 2006',
    category: 'Security',
    version: '4.2',
    fileSizeBytes: 1024 * 1024 * 7,
    downloadUrl: 'http://downloadhub.local/files/safesweep_setup.exe',
    description: 'Remove adware toolbars, tracking cookies, and spyware threats.',
  },
  {
    id: 'photobox_setup',
    name: 'PhotoBox Pro 2.0',
    category: 'Multimedia',
    version: '2.0.4',
    fileSizeBytes: 1024 * 1024 * 14,
    downloadUrl: 'http://downloadhub.local/files/photobox_setup.exe',
    description: 'Professional raster image and photo editor. (Requires Orion 6.0 + 768MB RAM)',
  },
];

export const DownloadHubSite: React.FC<SiteRouteProps> = () => {
  const { network } = useOsHost();
  const downloads = network.transfers;
  const world = useSimulationStore((s) => s.state.world);
  const time = useSimulationStore((s) => s.state.time);
  const openWindow = useWindowStore((s) => s.openWindow);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  const dynamicItems = getDownloadHubDynamicItems(world, time.day);
  // Pulse releases as heavy versioned downloads (like OS)
  const pulseDynamic: DownloadItem[] = (() => {
    try {
      const enginePulse = (useSimulationStore.getState().engine as any).pulse as { getAvailableReleases: (day:number, hw:any, os:any)=>Array<{id:string; displayName:string; version:string; installSizeMB:number; blurb?:string; changelog:string[]}> };
      const hw = useSimulationStore.getState().state.hardware;
      const osVer = useSimulationStore.getState().state.os.currentOsId;
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

  return (
    <div className="w-full min-h-full bg-[#f4f7f6] text-black font-sans text-xs p-4 flex flex-col items-center">
      {/* Top Banner */}
      <div className="max-w-4xl w-full bg-gradient-to-r from-teal-800 to-emerald-700 text-white p-3 rounded-t shadow flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl">💾</span>
          <div>
            <h1 className="text-base font-bold font-mono tracking-tight leading-none">
              DownloadHub.local — Software Archive
            </h1>
            <span className="text-[10px] text-teal-200">
              Verified freeware, shareware, and essential utilities for Orion OS
            </span>
          </div>
        </div>

        <span className="bg-teal-950 px-2 py-0.5 rounded text-[10px] border border-teal-500 font-mono">
          SERVER: ONLINE
        </span>
      </div>

      {/* Category Nav */}
      <div className="max-w-4xl w-full bg-[#e2e8f0] border-x border-b border-gray-300 p-1.5 flex gap-2 text-xs">
        {['ALL', 'Utilities', 'Multimedia', 'Internet', 'Security'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-2.5 py-0.5 rounded font-bold cursor-pointer ${
              selectedCat === cat
                ? 'bg-teal-800 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Live world banner */}
      {dynamicItems.length > 0 && (
        <div className="max-w-4xl w-full mt-2 bg-amber-50 border border-amber-300 px-3 py-1.5 text-[11px] font-bold text-amber-900 flex items-center gap-2">
          <span>⬢ Live Wire:</span>
          <span className="font-normal">{dynamicItems.length} new mirrors/editions from CityWire queue — Day {time.day}</span>
          <span className="ml-auto text-[10px] font-mono opacity-60">via procedural</span>
        </div>
      )}

      {/* In-game download notice (replaces real browser alert) */}
      {notice && (
        <div className="max-w-4xl w-full mt-2 flex items-center justify-between border border-teal-600 bg-[#e0f2f1] px-3 py-2 text-xs font-bold text-teal-900 shadow">
          <span className="flex items-center gap-2">⬇ {notice}</span>
          <button onClick={() => setNotice(null)} className="ml-2 rounded border border-teal-700 bg-white px-2 py-0.5 text-[11px] hover:bg-teal-50">Open FlashFetch</button>
        </div>
      )}

      {/* Main Downloads Table */}
      <div className="max-w-4xl w-full bg-white border border-gray-300 rounded shadow mt-3 overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#e4e4e4] border-b border-gray-300 font-bold text-gray-700">
            <tr>
              <th className="p-2 border-r border-gray-300">Software Name</th>
              <th className="p-2 border-r border-gray-300">Version</th>
              <th className="p-2 border-r border-gray-300">Size</th>
              <th className="p-2 border-r border-gray-300">Description</th>
              <th className="p-2 text-center">Download</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2 font-bold text-teal-900 flex items-center gap-1">
                  <span>💿</span>
                  <span>{item.name}</span>
                </td>
                <td className="p-2 font-mono text-gray-600">{item.version}</td>
                <td className="p-2 font-mono">{(item.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB</td>
                <td className="p-2 text-gray-600">
                  {item.description}
                  {item.isAdwareBundle && (
                    <span className="text-[10px] text-amber-700 font-bold block mt-0.5">
                      ⚠️ Includes sponsored SearchMate toolbar
                    </span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {(() => {
                    const status = getDownloadStatus(item);
                    if (status === 'downloading' || status === 'queued') {
                      const task = downloads.find((t) => t.sourceId === item.id);
                      const pct = task ? Math.round((task.downloadedBytes / task.totalBytes) * 100) : 0;
                      return <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800 border border-amber-300">⏳ {status === 'queued' ? 'Queued' : `${pct}%`} — FlashFetch</span>;
                    }
                    if (status === 'complete') {
                      return <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-[11px] font-bold text-green-800 border border-green-300">✓ Downloaded</span>;
                    }
                    return (
                      <button
                        onClick={() => handleDownloadFile(item)}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded text-xs shadow-xs cursor-pointer"
                      >
                        ⬇ Download
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

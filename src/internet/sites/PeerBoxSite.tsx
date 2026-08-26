import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';

interface PeerFile {
  id: string;
  filename: string;
  sizeBytes: number;
  seeds: number;
  category: 'Audio' | 'Document' | 'Archive';
  downloadUrl: string;
}

const PEER_FILES: PeerFile[] = [
  {
    id: 'pf_1',
    filename: 'sub_canal_drone_field_rec.wav',
    sizeBytes: 8400000,
    seeds: 42,
    category: 'Audio',
    downloadUrl: 'http://peerbox.local/files/sub_canal_drone.wav',
  },
  {
    id: 'pf_2',
    filename: 'hotel_guest_records_1998_leaked.txt',
    sizeBytes: 45000,
    seeds: 18,
    category: 'Document',
    downloadUrl: 'http://peerbox.local/files/hotel_guest_records.txt',
  },
  {
    id: 'pf_3',
    filename: 'lofi_drum_sample_pack_v1.zip',
    sizeBytes: 12500000,
    seeds: 95,
    category: 'Archive',
    downloadUrl: 'http://peerbox.local/files/lofi_drums.zip',
  },
];

export const PeerBoxSite: React.FC<SiteRouteProps> = () => {
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDownload = (file: PeerFile) => {
    dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: 'peerbox',
      url: file.downloadUrl,
      fileName: file.filename,
      totalBytes: file.sizeBytes,
      sourceMaxKbps: 128,
      fileKind: file.category === 'Audio' ? 'audio' : file.category === 'Archive' ? 'archive' : 'text',
    });
    soundManager.play('im_send');
    alert(`Swarm connection established! Downloading ${file.filename} from ${file.seeds} seeders.`);
  };

  return (
    <div className="w-full min-h-full bg-[#18181b] text-gray-200 font-sans text-xs p-4 flex flex-col items-center">
      {/* Top Banner */}
      <div className="max-w-4xl w-full bg-[#27272a] border border-gray-700 p-3 rounded-t flex justify-between items-center shadow">
        <div className="flex items-center gap-2">
          <span className="text-2xl text-lime-400">⚡</span>
          <div>
            <h1 className="text-base font-bold font-mono text-lime-300">
              PeerBox P2P Decentralized Swarm
            </h1>
            <span className="text-[10px] text-gray-400">Node: 127.0.0.1:6881 // Connected to 1,420 Swarm Nodes</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="max-w-4xl w-full bg-[#121214] border border-gray-800 p-3 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search decentralized swarms..."
            className="flex-1 p-1.5 bg-black border border-gray-700 rounded text-xs text-white outline-none"
          />
        </div>

        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead className="bg-[#27272a] text-lime-400 font-bold border-b border-gray-700">
            <tr>
              <th className="p-2">File Name</th>
              <th className="p-2">Size</th>
              <th className="p-2">Seeds</th>
              <th className="p-2">Category</th>
              <th className="p-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {PEER_FILES.map((file) => (
              <tr key={file.id} className="border-b border-gray-800 hover:bg-gray-900">
                <td className="p-2 text-white font-bold">{file.filename}</td>
                <td className="p-2 text-gray-400">{(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB</td>
                <td className="p-2 text-lime-400 font-bold">{file.seeds}</td>
                <td className="p-2 text-gray-400">{file.category}</td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => handleDownload(file)}
                    className="px-2.5 py-0.5 bg-lime-600 hover:bg-lime-500 text-black font-bold rounded text-xs"
                  >
                    Fetch
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

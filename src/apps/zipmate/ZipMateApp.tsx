import React, { useState } from 'react';
import { soundManager } from '../../audio/SoundManager';

interface ArchivedItem {
  name: string;
  originalSize: number;
  packedSize: number;
  type: string;
  modifiedDate: string;
  crc32: string;
}

const DEFAULT_ARCHIVES: Record<string, ArchivedItem[]> = {
  'photobox_setup.zip': [
    { name: 'PhotoBoxSetup.exe', originalSize: 14680064, packedSize: 8912896, type: 'Application', modifiedDate: '08/15/2006 14:20', crc32: 'A4F19B82' },
    { name: 'Readme_Requirements.txt', originalSize: 4096, packedSize: 1240, type: 'Text Document', modifiedDate: '08/15/2006 14:18', crc32: '89C041DE' },
    { name: 'SampleFilters.dat', originalSize: 2097152, packedSize: 1450000, type: 'Data File', modifiedDate: '08/14/2006 09:12', crc32: 'D3A1559C' },
  ],
  'lofi_drums.zip': [
    { name: 'kick_dusty.wav', originalSize: 524288, packedSize: 320000, type: 'Audio Clip', modifiedDate: '08/20/2006 02:14', crc32: 'FE40192A' },
    { name: 'snare_tape.wav', originalSize: 412000, packedSize: 280000, type: 'Audio Clip', modifiedDate: '08/20/2006 02:15', crc32: 'C391AA01' },
    { name: 'hihat_vinyl_loop.wav', originalSize: 1048576, packedSize: 720000, type: 'Audio Clip', modifiedDate: '08/20/2006 02:16', crc32: '77B49F12' },
  ],
};

export const ZipMateApp: React.FC = () => {
  const [selectedArchive, setSelectedArchive] = useState<string>('photobox_setup.zip');
  const [items, setItems] = useState<ArchivedItem[]>(DEFAULT_ARCHIVES['photobox_setup.zip'] || []);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Archive loaded. 3 files ready for extraction.');

  const handleArchiveChange = (archiveName: string) => {
    setSelectedArchive(archiveName);
    const newItems = DEFAULT_ARCHIVES[archiveName] || [];
    setItems(newItems);
    setSelectedItemName(null);
    setStatusMessage(`Loaded archive: ${archiveName} (${newItems.length} items)`);
  };

  const handleExtractAll = () => {
    setIsExtracting(true);
    setExtractProgress(0);
    setStatusMessage('Extracting archive contents to C:/Extracted...');

    let p = 0;
    const interval = setInterval(() => {
      p += 25;
      setExtractProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setIsExtracting(false);
        setStatusMessage(`Extraction complete! All ${items.length} files extracted to C:/Extracted.`);
        soundManager.play('im_recv');
      }
    }, 250);
  };

  const totalOriginal = items.reduce((sum, item) => sum + item.originalSize, 0);
  const totalPacked = items.reduce((sum, item) => sum + item.packedSize, 0);
  const compressionRatio = totalOriginal > 0 ? Math.round((1 - totalPacked / totalOriginal) * 100) : 0;

  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col border border-gray-400 overflow-hidden">
      {/* Menu Bar */}
      <div className="bg-[#dfdfdf] border-b border-gray-400 px-2 py-0.5 flex gap-3 text-xs text-gray-800">
        <span className="hover:underline cursor-pointer">File</span>
        <span className="hover:underline cursor-pointer">Actions</span>
        <span className="hover:underline cursor-pointer">Options</span>
        <span className="hover:underline cursor-pointer">Help</span>
      </div>

      {/* Toolbar */}
      <div className="bg-[#f0f0f0] border-b border-gray-400 p-1 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <select
            value={selectedArchive}
            onChange={(e) => handleArchiveChange(e.target.value)}
            className="bg-white border border-gray-400 rounded px-2 py-1 text-xs outline-none cursor-pointer font-semibold"
          >
            <option value="photobox_setup.zip">photobox_setup.zip</option>
            <option value="lofi_drums.zip">lofi_drums.zip</option>
          </select>

          <button
            onClick={handleExtractAll}
            disabled={isExtracting}
            className="px-3 py-1 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-400 rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
          >
            📦 Extract All
          </button>
        </div>

        <span className="text-xs text-gray-600 font-mono">
          Ratio: <strong className="text-green-700">{compressionRatio}%</strong> saved
        </span>
      </div>

      {/* Extraction Progress Bar */}
      {isExtracting && (
        <div className="bg-blue-50 border-b border-blue-300 p-1.5 flex flex-col gap-1">
          <div className="flex justify-between text-[11px] text-blue-900 font-semibold">
            <span>Extracting files...</span>
            <span>{extractProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded overflow-hidden border border-blue-400">
            <div
              className="bg-blue-600 h-full transition-all duration-200"
              style={{ width: `${extractProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Files Table */}
      <div className="flex-1 bg-white border-b border-gray-400 overflow-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead className="bg-[#e4e4e4] border-b border-gray-300 text-gray-700 font-bold sticky top-0">
            <tr>
              <th className="p-1.5 border-r border-gray-300">Name</th>
              <th className="p-1.5 border-r border-gray-300">Type</th>
              <th className="p-1.5 border-r border-gray-300">Original Size</th>
              <th className="p-1.5 border-r border-gray-300">Packed Size</th>
              <th className="p-1.5 border-r border-gray-300">Modified Date</th>
              <th className="p-1.5">CRC32</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = item.name === selectedItemName;
              return (
                <tr
                  key={item.name}
                  onClick={() => setSelectedItemName(item.name)}
                  className={`border-b border-gray-100 cursor-pointer ${
                    isSelected ? 'bg-blue-100 font-semibold text-blue-950' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <td className="p-1.5 flex items-center gap-1 font-mono">
                    <span>📄</span>
                    <span>{item.name}</span>
                  </td>
                  <td className="p-1.5 text-gray-600">{item.type}</td>
                  <td className="p-1.5 font-mono">{(item.originalSize / 1024).toFixed(1)} KB</td>
                  <td className="p-1.5 font-mono">{(item.packedSize / 1024).toFixed(1)} KB</td>
                  <td className="p-1.5 text-[11px] text-gray-500">{item.modifiedDate}</td>
                  <td className="p-1.5 font-mono text-[11px] text-gray-400">{item.crc32}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#dfdfdf] px-2 py-0.5 flex justify-between items-center text-[10px] text-gray-600">
        <span className="truncate">{statusMessage}</span>
        <span className="font-mono">
          Total: {(totalOriginal / (1024 * 1024)).toFixed(2)} MB / {(totalPacked / (1024 * 1024)).toFixed(2)} MB
        </span>
      </div>
    </div>
  );
};

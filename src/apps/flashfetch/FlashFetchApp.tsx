import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { DownloadTask } from '../../engine/types';

export const FlashFetchApp: React.FC = () => {
  const downloads = useSimulationStore((s) => s.state.downloads || []);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const connectionType = useSimulationStore((s) => s.state.hardware.connectionType);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [speedLimit, setSpeedLimit] = useState<'unlimited' | '512' | '256' | '56'>('unlimited');
  const [speedHistory, setSpeedHistory] = useState<number[]>([12, 28, 45, 52, 48, 60, 58, 64, 70, 68]);

  const activeDownloadList: DownloadTask[] = Array.isArray(downloads) ? downloads : Object.values(downloads || {});
  const selectedTask = activeDownloadList.find((d) => d.id === selectedTaskId) || activeDownloadList[0];

  // Periodic speed graph update
  useEffect(() => {
    const interval = setInterval(() => {
      const activeSpeeds = activeDownloadList
        .filter((d) => d.status === 'downloading')
        .reduce((sum, d) => sum + (d.allocatedKbps || 0), 0);

      setSpeedHistory((prev) => [...prev.slice(-15), activeSpeeds]);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeDownloadList]);

  const handleStartManualDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const fileName = urlInput.split('/').pop() || 'download.bin';
    dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: 'flashfetch',
      url: urlInput.trim(),
      fileName,
      totalBytes: 1024 * 1024 * 5,
      sourceMaxKbps: 256,
      manager: 'flashfetch',
    });
    setUrlInput('');
  };

  const handleCancelDownload = (taskId: string) => {
    dispatchAction({
      type: 'DOWNLOAD_CANCEL',
      taskId,
    });
  };

  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col border border-gray-400 overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-[#dfdfdf] border-b border-gray-400 p-1.5 flex flex-wrap items-center justify-between gap-2">
        <form onSubmit={handleStartManualDownload} className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://downloadhub.local/files/tool.zip"
            className="flex-1 px-2 py-0.5 bg-white border border-gray-400 rounded text-xs outline-none shadow-inner"
          />
          <button
            type="submit"
            className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs shadow-xs cursor-pointer"
          >
            📥 Download
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedTask && handleCancelDownload(selectedTask.id)}
            disabled={!selectedTask || selectedTask.status !== 'downloading'}
            className="px-2.5 py-0.5 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
          >
            ⏹ Stop
          </button>

          {/* Speed Limit Selector */}
          <div className="flex items-center gap-1 text-xs text-gray-700">
            <span className="font-semibold">Cap:</span>
            <select
              value={speedLimit}
              onChange={(e) => setSpeedLimit(e.target.value as any)}
              className="bg-white border border-gray-400 rounded px-1 py-0.5 text-xs outline-none cursor-pointer"
            >
              <option value="unlimited">Unlimited ({connectionType})</option>
              <option value="512">512 kB/s</option>
              <option value="256">256 kB/s</option>
              <option value="56">56 kB/s</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden bg-[#f0f0f0]">
        {/* Active Downloads Table */}
        <div className="flex-1 bg-white border border-gray-400 rounded overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-[#e4e4e4] border-b border-gray-300 text-gray-700 font-bold sticky top-0">
              <tr>
                <th className="p-1.5 border-r border-gray-300">File Name</th>
                <th className="p-1.5 border-r border-gray-300">Size</th>
                <th className="p-1.5 border-r border-gray-300">Progress</th>
                <th className="p-1.5 border-r border-gray-300">Speed</th>
                <th className="p-1.5 border-r border-gray-300">Status</th>
                <th className="p-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeDownloadList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400 italic">
                    No active downloads in queue. FlashFetch is ready.
                  </td>
                </tr>
              ) : (
                activeDownloadList.map((task) => {
                  const progressPct = Math.round(
                    (task.downloadedBytes / Math.max(1, task.totalBytes)) * 100
                  );
                  const isSelected = task.id === selectedTaskId;
                  const speedKB = Math.round(task.allocatedKbps || 0);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`border-b border-gray-200 cursor-pointer ${
                        isSelected ? 'bg-blue-100 font-semibold' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="p-1.5 truncate max-w-[150px] font-mono">
                        {task.fileName}
                      </td>
                      <td className="p-1.5 font-mono">
                        {(task.totalBytes / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="p-1.5 w-36">
                        <div className="w-full bg-gray-200 h-3 rounded-xs overflow-hidden border border-gray-400">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">{progressPct}%</span>
                      </td>
                      <td className="p-1.5 font-mono">{speedKB} kB/s</td>
                      <td className="p-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            task.status === 'complete'
                              ? 'bg-green-100 text-green-800'
                              : task.status === 'downloading'
                              ? 'bg-blue-100 text-blue-800 animate-pulse'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="p-1.5">
                        {task.status === 'downloading' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelDownload(task.id);
                            }}
                            className="text-red-600 hover:underline font-bold text-[10px]"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 8-Segment Chunk Accelerator Module */}
        <div className="bg-[#24272c] text-white p-2 rounded border border-gray-600 shadow-inner">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-bold text-xs text-blue-300">
              ⚡ Multi-Threaded Chunk Visualizer (8 Connections)
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Target: {selectedTask ? selectedTask.fileName : 'No selection'}
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1 bg-black p-1.5 rounded border border-gray-700 mb-2">
            {Array.from({ length: 8 }).map((_, chunkIdx) => {
              const taskProgress = selectedTask
                ? selectedTask.downloadedBytes / Math.max(1, selectedTask.totalBytes)
                : 0;
              const chunkProgress = Math.min(1, Math.max(0, taskProgress * 8 - chunkIdx));
              const isChunkDone = chunkProgress >= 1;

              return (
                <div key={chunkIdx} className="flex flex-col items-center gap-1">
                  <div className="w-full bg-gray-800 h-8 rounded-xs overflow-hidden relative border border-gray-700">
                    <div
                      className={`h-full ${
                        isChunkDone
                          ? 'bg-green-500'
                          : chunkProgress > 0
                          ? 'bg-blue-500 animate-pulse'
                          : 'bg-transparent'
                      }`}
                      style={{ width: `${chunkProgress * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white shadow-xs">
                      #{chunkIdx + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Transfer Speed Graph */}
          <div className="flex items-end justify-between gap-1 h-8 bg-black p-1 rounded border border-gray-800">
            {speedHistory.map((val, idx) => (
              <div
                key={idx}
                className="flex-1 bg-cyan-400 rounded-xs transition-all duration-300"
                style={{ height: `${Math.min(100, (val / 100) * 100)}%` }}
                title={`${val} kB/s`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

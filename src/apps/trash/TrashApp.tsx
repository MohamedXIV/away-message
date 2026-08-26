import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { FileRecord } from '../../engine/types';

export const TrashApp: React.FC = () => {
  const vfs = useSimulationStore((s) => s.state.vfs);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  const trashFiles = Object.values(vfs.files).filter(
    (f) => f.parentPath === 'C:/Trash' && f.path !== 'C:/Trash'
  );
  const totalTrashBytes = trashFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

  const handleEmptyTrash = () => {
    if (window.confirm('Are you sure you want to permanently delete all items in the Recycle Bin?')) {
      dispatchAction({ type: 'VFS_EMPTY_TRASH' });
      setSelectedFile(null);
    }
  };

  const handleRestoreSelected = () => {
    if (!selectedFile) return;
    dispatchAction({ type: 'VFS_RESTORE_TRASH', trashPath: selectedFile.path });
    setSelectedFile(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black font-sans text-xs select-none">
      {/* Header Actions */}
      <div className="flex items-center gap-2 p-1.5 bg-[#dfdfdf] border-b border-gray-500">
        <button
          onClick={handleEmptyTrash}
          disabled={trashFiles.length === 0}
          className="orion-button disabled:opacity-40 font-semibold"
        >
          🗑️ Empty Recycle Bin
        </button>
        <button
          onClick={handleRestoreSelected}
          disabled={!selectedFile}
          className="orion-button disabled:opacity-40"
        >
          ↩️ Restore this item
        </button>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white p-2 overflow-y-auto">
        {trashFiles.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            The Recycle Bin is empty.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-gray-500 font-semibold">
                <th className="py-1 px-2">Name</th>
                <th className="py-1 px-2">Original Location</th>
                <th className="py-1 px-2 w-24">Size</th>
              </tr>
            </thead>
            <tbody>
              {trashFiles.map((file) => (
                <tr
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`cursor-pointer ${
                    selectedFile?.path === file.path ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-800'
                  }`}
                >
                  <td className="py-1 px-2 flex items-center gap-1">
                    <span>📄</span>
                    <span>{file.name}</span>
                  </td>
                  <td className="py-1 px-2 font-mono text-[11px]">
                    {String(file.metadata?.originalTrashPath || 'C:/')}
                  </td>
                  <td className="py-1 px-2 font-mono">{(file.sizeBytes / 1024).toFixed(1)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#dfdfdf] border-t border-gray-500 text-[11px] text-gray-700">
        <span>{trashFiles.length} item(s)</span>
        <span>Total Size: {(totalTrashBytes / 1024).toFixed(1)} KB</span>
      </div>
    </div>
  );
};

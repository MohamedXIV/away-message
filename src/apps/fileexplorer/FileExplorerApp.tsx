import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';
import { FileRecord, FileKind } from '../../engine/types';

const CANONICAL_SHORTCUTS = [
  { name: 'Local Disk (C:)', path: 'C:', icon: '💽' },
  { name: 'Desktop', path: 'C:/Desktop', icon: '🖥️' },
  { name: 'My Documents', path: 'C:/Documents', icon: '📁' },
  { name: 'Downloads', path: 'C:/Downloads', icon: '📥' },
  { name: 'Program Files', path: 'C:/Program Files', icon: '🗂️' },
  { name: 'Music', path: 'C:/Music', icon: '🎵' },
  { name: 'Pictures', path: 'C:/Pictures', icon: '🖼️' },
  { name: 'Recycle Bin', path: 'C:/Trash', icon: '🗑️' },
];

export const FileExplorerApp: React.FC<{ initialPath?: string }> = ({ initialPath = 'C:' }) => {
  const vfs = useSimulationStore((s) => s.state.vfs);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [history, setHistory] = useState<string[]>([initialPath]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'details' | 'icons'>('details');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  const navigateTo = (newPath: string) => {
    const normalized = newPath.replace(/\/+/g, '/');
    setCurrentPath(normalized);
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), normalized]);
    setHistoryIdx((prev) => prev + 1);
    setSelectedFile(null);
  };

  const handleBack = () => {
    if (historyIdx > 0 && history[historyIdx - 1]) {
      const prevPath = history[historyIdx - 1]!;
      setHistoryIdx(historyIdx - 1);
      setCurrentPath(prevPath);
      setSelectedFile(null);
    }
  };

  const handleForward = () => {
    if (historyIdx < history.length - 1 && history[historyIdx + 1]) {
      const nextPath = history[historyIdx + 1]!;
      setHistoryIdx(historyIdx + 1);
      setCurrentPath(nextPath);
      setSelectedFile(null);
    }
  };

  const handleUp = () => {
    if (currentPath !== 'C:' && currentPath !== 'C:/') {
      const lastSlash = currentPath.lastIndexOf('/');
      const parent = lastSlash > 2 ? currentPath.substring(0, lastSlash) : 'C:';
      navigateTo(parent);
    }
  };

  const currentFiles = Object.values(vfs.files).filter(
    (f) => f.parentPath === currentPath && f.path !== currentPath
  );

  const FILE_TO_SOFTWARE: Record<string, string> = {
    'pulse52_setup.exe': 'sw_pulse_52',
    'retroamp_setup.exe': 'sw_retroamp_23',
    'flashfetch_setup.exe': 'sw_flashfetch_31',
    'zipmate_setup.exe': 'sw_zipmate_40',
    'weatherbuddy_bundle.exe': 'sw_weatherbuddy_14',
    'safesweep_setup.exe': 'sw_safesweep_20',
    'photobox_setup.exe': 'sw_photobox_30',
  };

  const [installNotice, setInstallNotice] = useState<string | null>(null);

  const handleFileDoubleClick = (file: FileRecord) => {
    if (file.kind === 'directory') {
      navigateTo(file.path);
    } else if (file.kind === 'text') {
      openWindow('notepad', `Notepad - ${file.name}`, { filePath: file.path });
    } else if (file.kind === 'installer') {
      const softwareId = FILE_TO_SOFTWARE[file.name] || file.name.replace('.exe', '');
      const result = dispatchAction({ type: 'SOFTWARE_INSTALL', softwareId, selectedOptions: {} } as any);
      if (result.success) {
        setInstallNotice(`Installed ${file.name} — check Desktop for shortcut.`);
        setTimeout(() => setInstallNotice(null), 3000);
      } else {
        setInstallNotice(result.error || `Cannot install ${file.name}: requirements not met.`);
        setTimeout(() => setInstallNotice(null), 3500);
      }
    } else if (file.kind === 'archive') {
      // Open ZipMate for archives, or auto-extract via unzip command
      openWindow('zipmate', `ZipMate - ${file.name}`, { archivePath: file.path });
    } else if (file.kind === 'shortcut' && file.appAssociation) {
      openWindow(file.appAssociation, file.name.replace('.lnk', ''));
    } else if (file.kind === 'executable' && file.appAssociation) {
      openWindow(file.appAssociation, file.name.replace('.exe', ''));
    } else if (file.kind === 'audio' || file.kind === 'image') {
      // For media files, try to open associated app
      if (file.appAssociation) openWindow(file.appAssociation, file.name);
      else openWindow('notepad', `Viewer - ${file.name}`, { filePath: file.path });
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedFile) return;
    if (currentPath === 'C:/Trash') {
      dispatchAction({ type: 'VFS_DELETE_FILE', path: selectedFile.path });
    } else {
      dispatchAction({ type: 'VFS_MOVE_TRASH', path: selectedFile.path });
    }
    setSelectedFile(null);
  };

  const getFileIcon = (kind: FileKind) => {
    switch (kind) {
      case 'directory':
        return '📁';
      case 'executable':
        return '⚙️';
      case 'installer':
        return '📦';
      case 'text':
        return '📄';
      case 'image':
        return '🖼️';
      case 'audio':
        return '🎵';
      case 'archive':
        return '🗜️';
      case 'shortcut':
        return '↗️';
      default:
        return '📄';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black select-none text-xs font-sans">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 bg-[#dfdfdf] border-b border-gray-500">
        <button
          onClick={handleBack}
          disabled={historyIdx === 0}
          className="orion-button disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={handleForward}
          disabled={historyIdx >= history.length - 1}
          className="orion-button disabled:opacity-40"
        >
          → Forward
        </button>
        <button
          onClick={handleUp}
          disabled={currentPath === 'C:'}
          className="orion-button disabled:opacity-40"
        >
          ↑ Up
        </button>
        <div className="h-4 w-px bg-gray-400 mx-1" />
        <button
          onClick={() => setViewMode(viewMode === 'details' ? 'icons' : 'details')}
          className="orion-button"
        >
          {viewMode === 'details' ? '▦ Large Icons' : '☰ Details'}
        </button>
        {selectedFile && (
          <button
            onClick={handleDeleteSelected}
            className="orion-button text-red-700 bg-red-50 hover:bg-red-100 ml-auto font-semibold"
          >
            🗑️ Delete
          </button>
        )}
      </div>

      {/* Address Bar */}
      <div className="flex items-center px-2 py-1 bg-white border-b border-gray-300 text-xs">
        <span className="text-gray-500 font-semibold mr-2">Address:</span>
        <span className="font-mono text-gray-800 flex-1">{currentPath}</span>
      </div>

      {/* Body Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-44 bg-[#f0f0f0] border-r border-gray-400 p-2 overflow-y-auto space-y-1">
          <div className="font-bold text-gray-600 mb-1 px-1 text-[11px] uppercase tracking-wider">Quick Places</div>
          {CANONICAL_SHORTCUTS.map((sc) => (
            <div
              key={sc.path}
              onClick={() => navigateTo(sc.path)}
              className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded text-xs ${
                currentPath === sc.path ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-gray-200 text-gray-800'
              }`}
            >
              <span>{sc.icon}</span>
              <span className="truncate">{sc.name}</span>
            </div>
          ))}
        </div>

        {/* File Content Area */}
        <div className="flex-1 bg-white p-2 overflow-y-auto">
          {viewMode === 'icons' ? (
            <div className="grid grid-cols-4 gap-3">
              {currentFiles.map((file) => (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                  className={`flex flex-col items-center p-2 rounded cursor-pointer border text-center ${
                    selectedFile?.path === file.path
                      ? 'bg-blue-100 border-blue-500 text-blue-900'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="text-3xl mb-1">{getFileIcon(file.kind)}</span>
                  <span className="text-xs truncate w-full">{file.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-gray-500 font-semibold">
                  <th className="py-1 px-2">Name</th>
                  <th className="py-1 px-2 w-24">Size</th>
                  <th className="py-1 px-2 w-28">Type</th>
                  <th className="py-1 px-2 w-32">Date Modified</th>
                </tr>
              </thead>
              <tbody>
                {currentFiles.map((file) => (
                  <tr
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                    className={`cursor-pointer ${
                      selectedFile?.path === file.path
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-blue-50 text-gray-800'
                    }`}
                  >
                    <td className="py-1 px-2 flex items-center gap-1.5 truncate">
                      <span>{getFileIcon(file.kind)}</span>
                      <span>{file.name}</span>
                    </td>
                    <td className="py-1 px-2 font-mono">
                      {file.kind === 'directory' ? '--' : `${(file.sizeBytes / 1024).toFixed(1)} KB`}
                    </td>
                    <td className="py-1 px-2 capitalize">{file.kind}</td>
                    <td className="py-1 px-2 text-gray-500">Day 1, 08:00 AM</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Install Notice */}
      {installNotice && (
        <div className="mx-2 mb-1 rounded border border-blue-600 bg-[#e0f2f1] px-2 py-1 text-[11px] font-bold text-blue-900">
          {installNotice}
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-[#dfdfdf] border-t border-gray-400 text-[11px] text-gray-700">
        <span>{currentFiles.length} object(s)</span>
        <span>
          Free Disk: {Math.max(0, (vfs.totalDiskBytes - vfs.baseSystemBytes) / (1024 * 1024 * 1024)).toFixed(2)} GB
        </span>
      </div>
    </div>
  );
};

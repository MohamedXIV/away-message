# Technical Analysis & Component Blueprints: Milestone 2 (Part C)
**Agent**: `explorer_m2_3`  
**Working Directory**: `f:/_WIP/away-message/.agents/explorer_m2_3/`  
**Scope**: Core System Utilities (`TerminalApp`, `FileExplorerApp`, `ControlPanelApp`, `AddRemoveApp`, `NotepadApp`, `TrashApp`) and Unit Test Suite Blueprints (`WindowManager.test.ts`, `TerminalApp.test.ts`, `FileExplorerApp.test.ts`, `ControlPanelApp.test.ts`).

---

## 1. Executive Architectural Overview

The Core System Utilities provide the authentic "diegetic OS" layer of Orion OS (both 4.8 and 6.0 generations). Rather than mock visual shells, these applications directly interface with:
1. The **authoritative simulation engine** (`SimulationEngine`, `FileSystemEngine`, `SoftwareRegistry`, `HardwareEngine`, `EconomyEngine`).
2. The **Zustand reactive stores** (`useSimulationStore`, `useWindowStore`, `useAudioStore`).
3. The **retro beveled / XP UI design system** (`orion48.css` and `orion60.css`).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Orion OS Desktop Shell                        │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│    TerminalApp    │  FileExplorerApp  │        ControlPanelApp          │
│ (CLI Parser/VFS)  │ (VFS Browser/Nav) │ (Display, Sound, Hardware Info) │
├───────────────────┼───────────────────┼─────────────────────────────────┤
│   AddRemoveApp    │    NotepadApp     │            TrashApp             │
│ (SoftwareRegistry)│(VFS Text Editor)  │  (Recycle Bin / Restore Engine) │
└─────────┬─────────┴─────────┬─────────┴────────────────┬────────────────┘
          │                   │                          │
          ▼                   ▼                          ▼
┌───────────────────┬───────────────────┬─────────────────────────────────┐
│  useWindowStore   │useSimulationStore │         useAudioStore           │
│ (Z-Index / Rects) │ (Action Dispatch) │     (Sound Effects & Volume)    │
└─────────┬─────────┴─────────┬─────────┴────────────────┬────────────────┘
          │                   │                          │
          ▼                   ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│        SimulationEngine (Pure TS Headless Deterministic Domain)         │
│ ├── FileSystemEngine (C:/ VFS Hierarchy, Disk Quota, Trash)             │
│ ├── SoftwareRegistry (Catalog, Installers, Bundled Offers, Shortcuts)   │
│ ├── HardwareEngine (CPU, RAM Pressure, DSL/Modem Speed, OS Version)     │
│ └── GameClock (Monotonic Minutes, Authoritative Timeline)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Terminal CLI Utility (`src/apps/terminal/TerminalApp.tsx`)

### 2.1 Architectural Specifications
- **Prompt State**: Tracks `currentDirectory` (defaults to `C:/` or `C:/Documents`).
- **Input Line & Cursor**: Monospace retro styling, blinking block/underline cursor, auto-scroll to bottom on every output.
- **Command History**: Stores user inputs in `history: string[]` with `historyIndex` traversed via `ArrowUp` and `ArrowDown`.
- **Async Execution Pipeline**: Commands like `ping` and `tracert` stream output line-by-line using asynchronous intervals to replicate real network packet latency.
- **VFS Integration**: Direct reads and writes to `FileSystemEngine`.

### 2.2 Command Set & Parser Blueprint

| Command | Arguments | Behavior & Output Format |
|---|---|---|
| `help` | none | Lists all available commands with a 1-line description. |
| `dir` / `ls` | `[path]` | Shows directory listing with volume label, file size, date/time, `<DIR>` indicator, file count, and free bytes remaining. |
| `cd` | `<path>` | Changes working directory (`cd ..`, `cd Downloads`, `cd C:/Program Files`, `cd /`). Validates directory existence. |
| `type` / `cat` | `<file>` | Prints the raw text content of a file. Returns error if file is binary or does not exist. |
| `cls` / `clear` | none | Clears the terminal screen buffer. |
| `ping` | `<host>` | Sends 4 ICMP echo requests to fake hosts (`findit.local`, `pulsechat.local`, `127.0.0.1`, `gateway.local`). Calculates fake RTT (18-45ms) or packet loss. |
| `tracert` | `<host>` | Traces route across 3-5 simulated hops (`192.168.1.1` $\to$ `10.0.4.1` $\to$ `isp-core-01.dsl.net` $\to$ destination). |
| `ipconfig` | `[/all]` | Outputs network adapter details: IP address, Subnet Mask, Gateway, Connection Type (`dsl_256k`, `dialup_56k`), and status. |
| `unzip` | `<archive>` | Extracts `.zip` files in VFS into target directory, creating unpacked files. |
| `ver` | none | Displays Orion OS version (`Orion OS [Version 4.80.1998]` or `Orion OS [Version 6.00.2001]`). |
| `exit` | none | Closes the Terminal window instance via `useWindowStore`. |

### 2.3 Production Component Code Blueprint: `src/apps/terminal/TerminalApp.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';
import { FileRecord } from '../../engine/types';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
}

const KNOWN_HOSTS: Record<string, { ip: string; hops: string[] }> = {
  'findit.local': { ip: '192.168.10.5', hops: ['192.168.1.1 (gateway.local)', '10.20.0.1 (isp-gw01.orion.net)', '192.168.10.5 (findit.local)'] },
  'pulsechat.local': { ip: '192.168.10.12', hops: ['192.168.1.1 (gateway.local)', '10.20.0.1 (isp-gw01.orion.net)', '192.168.10.12 (pulsechat.local)'] },
  'downloadhub.local': { ip: '192.168.20.8', hops: ['192.168.1.1 (gateway.local)', '10.20.0.1 (isp-gw01.orion.net)', '192.168.20.8 (downloadhub.local)'] },
  '127.0.0.1': { ip: '127.0.0.1', hops: ['127.0.0.1 (localhost)'] },
  'gateway.local': { ip: '192.168.1.1', hops: ['192.168.1.1 (gateway.local)'] },
};

export const TerminalApp: React.FC<{ windowId: string }> = ({ windowId }) => {
  const { vfs, hardware, dispatchAction } = useSimulationStore();
  const { closeWindow } = useWindowStore();

  const [currentPath, setCurrentPath] = useState<string>('C:');
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: '1', type: 'system', text: `Orion OS Command Prompt [Version ${hardware.osVersion === 'Orion_4.8' ? '4.80.1998' : '6.00.2001'}]` },
    { id: '2', type: 'system', text: '(C) Copyright 1985-2000 Orion Systems Corp. All rights reserved.\nType "help" for a list of available commands.\n' },
  ]);
  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExecutingAsync, setIsExecutingAsync] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const addLine = (text: string, type: TerminalLine['type'] = 'output') => {
    setLines(prev => [...prev, { id: `${Date.now()}_${Math.random()}`, type, text }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isExecutingAsync) return;

    if (e.key === 'Enter') {
      const cmd = inputVal.trim();
      addLine(`${currentPath}> ${inputVal}`, 'input');
      if (cmd) {
        setHistory(prev => [cmd, ...prev]);
        setHistoryIndex(-1);
        processCommand(cmd);
      }
      setInputVal('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const processCommand = (rawCommand: string) => {
    const parts = rawCommand.split(' ').filter(Boolean);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help': {
        addLine(
          'Supported Orion OS CLI Commands:\n' +
          '  HELP                Provides Help information for Windows commands.\n' +
          '  DIR [path]          Displays a list of files and subdirectories in a directory.\n' +
          '  CD [path]           Displays the name of or changes the current directory.\n' +
          '  TYPE <file>         Displays the contents of a text file.\n' +
          '  CLS                 Clears the screen.\n' +
          '  PING <host>         Verifies IP-level connectivity to another computer.\n' +
          '  TRACERT <host>      Determines the path that a packet takes to reach a destination.\n' +
          '  IPCONFIG [/all]     Displays all current TCP/IP network configuration values.\n' +
          '  UNZIP <archive>     Extracts files from a compressed ZIP archive.\n' +
          '  VER                 Displays the Orion OS version.\n' +
          '  EXIT                Quits the Command Prompt session.'
        );
        break;
      }

      case 'cls':
      case 'clear': {
        setLines([]);
        break;
      }

      case 'ver': {
        addLine(`Orion OS [Version ${hardware.osVersion === 'Orion_4.8' ? '4.80.1998' : '6.00.2001'}]`);
        break;
      }

      case 'exit': {
        closeWindow(windowId);
        break;
      }

      case 'ipconfig': {
        addLine(
          '\nOrion IP Configuration\n\n' +
          'Ethernet adapter Local Area Connection:\n\n' +
          `   Connection-specific DNS Suffix  . : local\n` +
          `   IP Address. . . . . . . . . . . . : 192.168.1.104\n` +
          `   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n` +
          `   Default Gateway . . . . . . . . . : 192.168.1.1\n` +
          `   Connection Type . . . . . . . . . : ${hardware.connectionType.toUpperCase()} (${hardware.connectionSpeedKbps} kbps)\n` +
          `   Physical Adapter State  . . . . . : CONNECTED`
        );
        break;
      }

      case 'cd': {
        if (args.length === 0) {
          addLine(currentPath);
          return;
        }
        let target = args[0].replace(/\\/g, '/');
        if (target === '/') {
          setCurrentPath('C:');
          return;
        }
        if (target === '..') {
          if (currentPath === 'C:' || currentPath === 'C:/') {
            addLine(currentPath);
          } else {
            const lastSlash = currentPath.lastIndexOf('/');
            setCurrentPath(lastSlash > 2 ? currentPath.substring(0, lastSlash) : 'C:');
          }
          return;
        }

        let resolvedPath = target.startsWith('C:')
          ? target
          : `${currentPath === 'C:' ? 'C:' : currentPath}/${target}`;
        resolvedPath = resolvedPath.replace(/\/+/g, '/');

        // Check if directory exists in VFS
        const dirRecord = vfs.files[resolvedPath];
        if (dirRecord && dirRecord.kind === 'directory') {
          setCurrentPath(resolvedPath);
        } else {
          addLine(`The system cannot find the path specified: "${target}"`, 'error');
        }
        break;
      }

      case 'dir':
      case 'ls': {
        const targetDir = args[0] ? (args[0].startsWith('C:') ? args[0] : `${currentPath}/${args[0]}`).replace(/\/+/g, '/') : currentPath;
        const matchingFiles = Object.values(vfs.files).filter(f => f.parentPath === targetDir && f.path !== targetDir);
        
        let output = ` Volume in drive C has no label.\n Volume Serial Number is 4C23-8E1A\n\n Directory of ${targetDir}\n\n`;
        output += `08/22/2000  08:00 AM    <DIR>          .\n`;
        output += `08/22/2000  08:00 AM    <DIR>          ..\n`;

        let fileCount = 0;
        let dirCount = 2;
        let totalFileBytes = 0;

        for (const file of matchingFiles) {
          if (file.kind === 'directory') {
            dirCount++;
            output += `08/22/2000  08:00 AM    <DIR>          ${file.name}\n`;
          } else {
            fileCount++;
            totalFileBytes += file.sizeBytes;
            const sizeStr = file.sizeBytes.toLocaleString().padStart(14, ' ');
            output += `08/22/2000  08:00 AM    ${sizeStr} ${file.name}\n`;
          }
        }

        const freeBytes = (vfs.totalDiskBytes - vfs.baseSystemBytes - totalFileBytes).toLocaleString();
        output += `              ${fileCount} File(s)    ${totalFileBytes.toLocaleString()} bytes\n`;
        output += `              ${dirCount} Dir(s)     ${freeBytes} bytes free\n`;
        addLine(output);
        break;
      }

      case 'type':
      case 'cat': {
        if (args.length === 0) {
          addLine('The syntax of the command is incorrect. Usage: TYPE <filename>', 'error');
          return;
        }
        const filePath = args[0].startsWith('C:')
          ? args[0]
          : `${currentPath}/${args[0]}`.replace(/\/+/g, '/');
        const file = vfs.files[filePath];
        if (!file) {
          addLine(`The system cannot find the file specified: ${args[0]}`, 'error');
        } else if (file.kind === 'directory') {
          addLine(`Access is denied: ${args[0]} is a directory.`, 'error');
        } else if (file.content) {
          addLine(file.content);
        } else if (file.metadata?.textContent) {
          addLine(String(file.metadata.textContent));
        } else {
          addLine(`[Binary content: ${file.name} (${file.sizeBytes} bytes)]`);
        }
        break;
      }

      case 'ping': {
        if (args.length === 0) {
          addLine('Usage: ping [-t] host_name', 'error');
          return;
        }
        const host = args[0].toLowerCase();
        const hostInfo = KNOWN_HOSTS[host] || { ip: '192.168.100.' + Math.floor(Math.random() * 200 + 1), hops: [] };
        
        setIsExecutingAsync(true);
        addLine(`\nPinging ${host} [${hostInfo.ip}] with 32 bytes of data:\n`);

        let count = 0;
        const interval = setInterval(() => {
          count++;
          const latency = Math.floor(Math.random() * 20 + 22);
          addLine(`Reply from ${hostInfo.ip}: bytes=32 time=${latency}ms TTL=128`);

          if (count >= 4) {
            clearInterval(interval);
            setIsExecutingAsync(false);
            addLine(
              `\nPing statistics for ${hostInfo.ip}:\n` +
              `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\n` +
              `Approximate round trip times in milli-seconds:\n` +
              `    Minimum = 22ms, Maximum = 42ms, Average = 29ms\n`
            );
          }
        }, 500);
        break;
      }

      case 'tracert': {
        if (args.length === 0) {
          addLine('Usage: tracert host_name', 'error');
          return;
        }
        const host = args[0].toLowerCase();
        const hostInfo = KNOWN_HOSTS[host];
        const hops = hostInfo?.hops || [
          '192.168.1.1 (gateway.local)',
          '10.254.0.1 (isp-core.dsl.net)',
          `192.168.100.22 (${host})`,
        ];

        setIsExecutingAsync(true);
        addLine(`\nTracing route to ${host} over a maximum of 30 hops:\n`);

        let hopIndex = 0;
        const interval = setInterval(() => {
          if (hopIndex < hops.length) {
            const ms1 = Math.floor(Math.random() * 10 + 15);
            const ms2 = Math.floor(Math.random() * 10 + 16);
            const ms3 = Math.floor(Math.random() * 10 + 15);
            addLine(`  ${hopIndex + 1}    ${ms1} ms    ${ms2} ms    ${ms3} ms  ${hops[hopIndex]}`);
            hopIndex++;
          } else {
            clearInterval(interval);
            setIsExecutingAsync(false);
            addLine('\nTrace complete.\n');
          }
        }, 600);
        break;
      }

      case 'unzip': {
        if (args.length === 0) {
          addLine('Usage: unzip <archive.zip>', 'error');
          return;
        }
        const zipPath = args[0].startsWith('C:') ? args[0] : `${currentPath}/${args[0]}`.replace(/\/+/g, '/');
        const file = vfs.files[zipPath];
        if (!file || file.kind !== 'archive') {
          addLine(`Archive not found or invalid format: ${args[0]}`, 'error');
          return;
        }

        // Decompress simulated archive
        const extracted = (file.metadata?.extractedFiles as string[]) || ['ExtractedProgram.exe', 'Readme.txt'];
        addLine(`Archive:  ${zipPath}\n  inflating: ${currentPath}/${extracted[0]}`);
        
        dispatchAction({
          type: 'VFS_CREATE_FILE',
          file: {
            name: extracted[0],
            path: `${currentPath}/${extracted[0]}`,
            parentPath: currentPath,
            kind: 'executable',
            sizeBytes: Math.floor(file.sizeBytes * 0.8),
            appAssociation: 'app.portable',
            metadata: { isPortable: true },
          },
        });
        addLine(`Extraction completed successfully. 1 file(s) created.`);
        break;
      }

      default: {
        addLine(`'${cmd}' is not recognized as an internal or external command,\noperable program or batch file.`, 'error');
        break;
      }
    }
  };

  return (
    <div
      className="w-full h-full bg-black text-gray-200 font-mono text-xs p-3 overflow-y-auto flex flex-col select-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 space-y-1 whitespace-pre-wrap">
        {lines.map(line => (
          <div
            key={line.id}
            className={
              line.type === 'error'
                ? 'text-red-400'
                : line.type === 'input'
                ? 'text-gray-100 font-bold'
                : line.type === 'system'
                ? 'text-gray-400'
                : 'text-green-300'
            }
          >
            {line.text}
          </div>
        ))}
      </div>

      <div className="flex items-center mt-2 pt-1 border-t border-gray-800">
        <span className="text-green-400 mr-1 select-none">{currentPath}&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          disabled={isExecutingAsync}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-gray-100 outline-none border-none font-mono text-xs caret-green-400"
          autoFocus
          spellCheck={false}
        />
      </div>
      <div ref={bottomRef} />
    </div>
  );
};
```

---

## 3. File Explorer & Recycle Bin Applications

### 3.1 `FileExplorerApp.tsx` (My Computer / Explorer)
- **Path Navigation**: Breadcrumbs with clickable path elements and direct `Up`, `Back`, `Forward` buttons.
- **Tree Sidebar**: Quick links to `Desktop`, `Downloads`, `Documents`, `Music`, `Pictures`, `Program Files`, and `Trash`.
- **View Modes**: Toggle between **Large Icons** (grid view) and **Details** (table view with columns: Name, Size, Type, Date Modified).
- **Execution & Open Handlers**:
  - `kind === 'directory'`: Navigates inside.
  - `kind === 'executable'` or `kind === 'installer'`: Launches corresponding application or installer session via `useWindowStore`.
  - `kind === 'text'`: Opens in `NotepadApp` (passing file path).
  - `kind === 'archive'`: Opens in `ZipMate` or extracts.
  - `kind === 'audio'`: Opens in `RetroAmp`.
- **Context Actions**: Move to Trash (`VFS_MOVE_TRASH`), Delete Permanently, Properties Modal.

### 3.2 Production Component Code Blueprint: `src/apps/fileexplorer/FileExplorerApp.tsx`

```tsx
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
  const { vfs, dispatchAction } = useSimulationStore();
  const { openWindow } = useWindowStore();

  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [history, setHistory] = useState<string[]>([initialPath]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'details' | 'icons'>('details');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  const navigateTo = (newPath: string) => {
    const normalized = newPath.replace(/\/+/g, '/');
    setCurrentPath(normalized);
    setHistory(prev => [...prev.slice(0, historyIdx + 1), normalized]);
    setHistoryIdx(prev => prev + 1);
    setSelectedFile(null);
  };

  const handleBack = () => {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setCurrentPath(history[historyIdx - 1]);
      setSelectedFile(null);
    }
  };

  const handleForward = () => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(historyIdx + 1);
      setCurrentPath(history[historyIdx + 1]);
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
    f => f.parentPath === currentPath && f.path !== currentPath
  );

  const handleFileDoubleClick = (file: FileRecord) => {
    if (file.kind === 'directory') {
      navigateTo(file.path);
    } else if (file.kind === 'text') {
      openWindow('app.notepad', `Notepad - ${file.name}`, { filePath: file.path });
    } else if (file.kind === 'installer') {
      // Trigger software installer wizard
      openWindow('app.addremove', 'Orion Software Setup', { installerFile: file.path });
    } else if (file.kind === 'shortcut' && file.appAssociation) {
      openWindow(file.appAssociation, file.name.replace('.lnk', ''));
    } else if (file.kind === 'executable' && file.appAssociation) {
      openWindow(file.appAssociation, file.name.replace('.exe', ''));
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
      case 'directory': return '📁';
      case 'executable': return '⚙️';
      case 'installer': return '📦';
      case 'text': return '📄';
      case 'image': return '🖼️';
      case 'audio': return '🎵';
      case 'archive': return '🗜️';
      case 'shortcut': return '↗️';
      default: return '📄';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[var(--orion-bg-main,#c0c0c0)] text-[var(--orion-text-main,#000)] select-none text-xs font-sans">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 bg-[var(--orion-bg-surface,#dfdfdf)] border-b border-[var(--orion-border-dark,#808080)]">
        <button
          onClick={handleBack}
          disabled={historyIdx === 0}
          className="px-2 py-1 border border-gray-400 bg-gray-200 disabled:opacity-40 hover:bg-gray-300 active:border-inset"
        >
          ← Back
        </button>
        <button
          onClick={handleForward}
          disabled={historyIdx >= history.length - 1}
          className="px-2 py-1 border border-gray-400 bg-gray-200 disabled:opacity-40 hover:bg-gray-300 active:border-inset"
        >
          → Forward
        </button>
        <button
          onClick={handleUp}
          disabled={currentPath === 'C:'}
          className="px-2 py-1 border border-gray-400 bg-gray-200 disabled:opacity-40 hover:bg-gray-300 active:border-inset"
        >
          ↑ Up
        </button>
        <div className="h-4 w-px bg-gray-400 mx-1" />
        <button
          onClick={() => setViewMode(viewMode === 'details' ? 'icons' : 'details')}
          className="px-2 py-1 border border-gray-400 bg-gray-200 hover:bg-gray-300"
        >
          {viewMode === 'details' ? '▦ Large Icons' : '☰ Details'}
        </button>
        {selectedFile && (
          <button
            onClick={handleDeleteSelected}
            className="px-2 py-1 border border-red-400 text-red-700 bg-red-50 hover:bg-red-100 ml-auto"
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
        <div className="w-44 bg-[var(--orion-bg-surface,#f0f0f0)] border-r border-[var(--orion-border-dark,#808080)] p-2 overflow-y-auto space-y-1">
          <div className="font-bold text-gray-600 mb-1 px-1 text-[11px] uppercase tracking-wider">Quick Places</div>
          {CANONICAL_SHORTCUTS.map(sc => (
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
              {currentFiles.map(file => (
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
                {currentFiles.map(file => (
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

      {/* Status Bar */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-[var(--orion-bg-surface,#dfdfdf)] border-t border-[var(--orion-border-dark,#808080)] text-[11px] text-gray-700">
        <span>{currentFiles.length} object(s)</span>
        <span>
          Free Disk: {((vfs.totalDiskBytes - vfs.baseSystemBytes) / (1024 * 1024 * 1024)).toFixed(2)} GB
        </span>
      </div>
    </div>
  );
};
```

### 3.3 `TrashApp.tsx` (Recycle Bin Utility)
- Direct view into `C:/Trash`.
- Provides "Empty Recycle Bin" (clears trash, emits `vfs:trash_emptied`, reclaims disk space).
- Provides "Restore Item" (returns item to its original parent directory from `metadata.originalTrashPath`).

```tsx
import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { FileRecord } from '../../engine/types';

export const TrashApp: React.FC = () => {
  const { vfs, dispatchAction } = useSimulationStore();
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  const trashFiles = Object.values(vfs.files).filter(f => f.parentPath === 'C:/Trash');
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
          className="px-2.5 py-1 border border-gray-400 bg-gray-200 disabled:opacity-40 hover:bg-gray-300 font-semibold"
        >
          🗑️ Empty Recycle Bin
        </button>
        <button
          onClick={handleRestoreSelected}
          disabled={!selectedFile}
          className="px-2.5 py-1 border border-gray-400 bg-gray-200 disabled:opacity-40 hover:bg-gray-300"
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
              {trashFiles.map(file => (
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
                    {String(file.metadata?.originalTrashPath || 'Unknown')}
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
```

---

## 4. Control Panel Application (`src/apps/controlpanel/ControlPanelApp.tsx`)

### 4.1 Architectural Specifications
- **Tabbed Interface**:
  1. **Display Properties**: Wallpaper selection (`Classic Teal`, `Bliss Green`, `Starry Night`, `Matrix Code`), Theme switching preview (Orion 4.8 $\leftrightarrow$ 6.x), CRT shader toggles (scanlines, phosphor bloom, curvature).
  2. **Sound Properties**: Master Volume slider, SFX toggle, Modem Dial-up handshake audio toggle.
  3. **System Properties**: Computer Owner name, OS Version, CPU Tier details, Live RAM Pressure bar, and Hard Disk Storage Pie Chart SVG.
- **SVG Disk Pie Chart**: Renders visual representation of used vs free disk space in GB.

### 4.2 Production Component Code Blueprint: `src/apps/controlpanel/ControlPanelApp.tsx`

```tsx
import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useAudioStore } from '../../store/useAudioStore';

export const ControlPanelApp: React.FC = () => {
  const { hardware, vfs } = useSimulationStore();
  const { volume, setVolume, soundEnabled, setSoundEnabled } = useAudioStore();

  const [activeTab, setActiveTab] = useState<'display' | 'sound' | 'system'>('system');
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('Classic Teal');
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);

  // Storage Calculations
  const totalGB = hardware.hddTotalGB;
  const usedGB = Math.max(0, totalGB - hardware.hddFreeGB);
  const freeGB = hardware.hddFreeGB;
  const usedPercent = Math.min(100, (usedGB / totalGB) * 100);

  return (
    <div className="w-full h-full flex flex-col bg-[var(--orion-bg-main,#c0c0c0)] text-[var(--orion-text-main,#000)] font-sans text-xs select-none">
      {/* Tabs Header */}
      <div className="flex border-b border-[var(--orion-border-dark,#808080)] px-2 pt-2 gap-1 bg-[var(--orion-bg-surface,#dfdfdf)]">
        {(['system', 'display', 'sound'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs font-semibold capitalize rounded-t border-t border-l border-r ${
              activeTab === tab
                ? 'bg-[var(--orion-bg-main,#c0c0c0)] border-gray-400 border-b-transparent -mb-px'
                : 'bg-gray-300 border-gray-400 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'system' && (
          <div className="space-y-4">
            {/* System Info Box */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/50">
              <legend className="font-bold px-1 text-gray-700">System Overview</legend>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-gray-500">Operating System:</div>
                <div className="col-span-2 font-semibold">{hardware.osVersion === 'Orion_4.8' ? 'Orion OS 4.8 (Edition 1998)' : 'Orion OS 6.0 Professional'}</div>
                <div className="text-gray-500">Computer Owner:</div>
                <div className="col-span-2">Player / Room 104</div>
                <div className="text-gray-500">Processor:</div>
                <div className="col-span-2 font-mono">{hardware.cpuName} (Tier {hardware.cpuTier})</div>
                <div className="text-gray-500">Installed RAM:</div>
                <div className="col-span-2 font-mono font-semibold">{hardware.ramMB} MB SDRAM</div>
                <div className="text-gray-500">Connection:</div>
                <div className="col-span-2 uppercase font-semibold">{hardware.connectionType} ({hardware.connectionSpeedKbps} kbps)</div>
              </div>
            </fieldset>

            {/* Storage Drive Space Pie Chart */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/50">
              <legend className="font-bold px-1 text-gray-700">Local Disk (C:) Storage</legend>
              <div className="flex items-center gap-6">
                {/* SVG Pie Chart */}
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 32 32">
                  <circle r="16" cx="16" cy="16" fill="#3b82f6" />
                  <circle
                    r="8"
                    cx="16"
                    cy="16"
                    fill="transparent"
                    stroke="#e11d48"
                    strokeWidth="16"
                    strokeDasharray={`${usedPercent} 100`}
                  />
                </svg>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-600 inline-block rounded-sm" />
                    <span>Used Space: <strong className="font-mono">{usedGB.toFixed(2)} GB</strong> ({usedPercent.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 inline-block rounded-sm" />
                    <span>Free Space: <strong className="font-mono">{freeGB.toFixed(2)} GB</strong></span>
                  </div>
                  <div className="pt-1 text-gray-500 font-mono">
                    Total Capacity: {totalGB.toFixed(2)} GB
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {activeTab === 'display' && (
          <div className="space-y-4">
            <fieldset className="border border-gray-400 p-3 rounded bg-white/50">
              <legend className="font-bold px-1 text-gray-700">Desktop Wallpaper</legend>
              <div className="grid grid-cols-2 gap-2">
                {['Classic Teal', 'Bliss Green', 'Starry Night', 'Matrix Code', 'Cyber Grid'].map(wp => (
                  <label key={wp} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="wallpaper"
                      checked={selectedWallpaper === wp}
                      onChange={() => setSelectedWallpaper(wp)}
                    />
                    <span>{wp}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="border border-gray-400 p-3 rounded bg-white/50">
              <legend className="font-bold px-1 text-gray-700">CRT Monitor Shader & Visual Effects</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crtEnabled}
                    onChange={e => setCrtEnabled(e.target.checked)}
                  />
                  <span>Enable Retro CRT Scanlines & Glass Curvature</span>
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {activeTab === 'sound' && (
          <div className="space-y-4">
            <fieldset className="border border-gray-400 p-3 rounded bg-white/50">
              <legend className="font-bold px-1 text-gray-700">Audio Output & Effects</legend>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => setSoundEnabled(e.target.checked)}
                  />
                  <span>Enable Retro Sound Effects & Chimes</span>
                </label>

                <div>
                  <div className="flex justify-between mb-1">
                    <span>Master Volume:</span>
                    <span className="font-mono">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={e => setVolume(parseFloat(e.target.value))}
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="p-2 border-t border-[var(--orion-border-dark,#808080)] bg-[var(--orion-bg-surface,#dfdfdf)] flex justify-end gap-2">
        <button className="px-4 py-1 border border-gray-400 bg-gray-200 hover:bg-gray-300 font-semibold">
          OK
        </button>
        <button className="px-4 py-1 border border-gray-400 bg-gray-200 hover:bg-gray-300">
          Cancel
        </button>
      </div>
    </div>
  );
};
```

---

## 5. Add/Remove Programs Utility (`src/apps/addremove/AddRemoveApp.tsx`)

### 5.1 Architectural Specifications
- **Data Source**: Subscribes to `SimulationState.installedSoftware` from `SoftwareRegistry`.
- **Exclusion Filter**: Excludes portable software (`isPortable === true`) which does not register in Add/Remove per specs.
- **Uninstaller Trigger**: Selecting a program and clicking "Remove" / "Uninstall" dispatches `SOFTWARE_UNINSTALL`.
- **Adware & Toolbar Warning**: Visual indicator showing if software has bundled extras (e.g. SearchMate toolbar).

### 5.2 Production Component Code Blueprint: `src/apps/addremove/AddRemoveApp.tsx`

```tsx
import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { InstalledSoftwareRecord } from '../../engine/types';

export const AddRemoveApp: React.FC = () => {
  const { installedSoftware, dispatchAction } = useSimulationStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUninstalling, setIsUninstalling] = useState<boolean>(false);

  const nonPortableSoftware = installedSoftware.filter(sw => !sw.isPortable);
  const selectedProgram = nonPortableSoftware.find(sw => sw.id === selectedId);

  const handleUninstall = (program: InstalledSoftwareRecord) => {
    if (window.confirm(`Are you sure you want to completely remove ${program.name} from your computer?`)) {
      setIsUninstalling(true);
      setTimeout(() => {
        dispatchAction({ type: 'SOFTWARE_UNINSTALL', installedId: program.id });
        setSelectedId(null);
        setIsUninstalling(false);
      }, 600);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[var(--orion-bg-main,#c0c0c0)] text-[var(--orion-text-main,#000)] font-sans text-xs select-none">
      {/* Top Banner */}
      <div className="p-3 bg-[var(--orion-bg-surface,#dfdfdf)] border-b border-[var(--orion-border-dark,#808080)] flex items-center gap-3">
        <span className="text-3xl">💻</span>
        <div>
          <h2 className="font-bold text-sm">Add/Remove Programs</h2>
          <p className="text-gray-600 text-[11px]">
            To uninstall a program or change its installed components, select it from the list and click Remove.
          </p>
        </div>
      </div>

      {/* Program List */}
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="bg-white border border-gray-400 rounded h-full overflow-y-auto p-1 space-y-1">
          {nonPortableSoftware.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              No installed programs found.
            </div>
          ) : (
            nonPortableSoftware.map(sw => {
              const isSelected = selectedId === sw.id;
              const sizeMB = (sw.installedBytes / (1024 * 1024)).toFixed(1);

              return (
                <div
                  key={sw.id}
                  onClick={() => setSelectedId(sw.id)}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📦</span>
                      <div>
                        <div className="font-bold text-gray-800">{sw.name}</div>
                        <div className="text-[11px] text-gray-500">Version {sw.version}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-gray-700">
                      <div>{sizeMB} MB</div>
                    </div>
                  </div>

                  {/* Expanded Action Panel */}
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between bg-white p-2 rounded">
                      <div className="text-[11px] text-gray-600">
                        {sw.isAdware ? (
                          <span className="text-amber-600 font-semibold">⚠️ Bundled components detected (SearchMate toolbar)</span>
                        ) : (
                          <span>Installed at {sw.installPath}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUninstall(sw)}
                          disabled={isUninstalling}
                          className="px-3 py-1 border border-red-400 bg-red-50 text-red-700 hover:bg-red-100 font-semibold rounded"
                        >
                          {isUninstalling ? 'Uninstalling...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-[var(--orion-bg-surface,#dfdfdf)] border-t border-[var(--orion-border-dark,#808080)] text-[11px] text-gray-600 flex justify-between">
        <span>{nonPortableSoftware.length} program(s) installed</span>
        <span>
          Total Space Occupied:{' '}
          {(nonPortableSoftware.reduce((a, s) => a + s.installedBytes, 0) / (1024 * 1024)).toFixed(1)} MB
        </span>
      </div>
    </div>
  );
};
```

---

## 6. Notepad Application (`src/apps/notepad/NotepadApp.tsx`)

### 6.1 Architectural Specifications
- **File Loading**: Reads initial file from `filePath` prop or `customState.filePath`.
- **Text Editing**: Monospace textarea with line wrap toggle and dirty state tracker (`isDirty: boolean`).
- **Save Operations**:
  - `Save`: Overwrites active VFS file via `vfs.updateFile`.
  - `Save As`: Prompts for new filename in `C:/Documents/` and creates new VFS file.
- **Status Bar**: Live line number and column number cursor tracking.

### 6.2 Production Component Code Blueprint: `src/apps/notepad/NotepadApp.tsx`

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';

export const NotepadApp: React.FC<{ filePath?: string }> = ({ filePath }) => {
  const { vfs, dispatchAction } = useSimulationStore();
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(filePath || null);
  const [content, setContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (filePath && vfs.files[filePath]) {
      const file = vfs.files[filePath];
      setContent(file.content || String(file.metadata?.textContent || ''));
      setCurrentFilePath(filePath);
      setIsDirty(false);
    }
  }, [filePath, vfs]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
    updateCursorPos(e.target);
  };

  const updateCursorPos = (target: HTMLTextAreaElement) => {
    const textBefore = target.value.substring(0, target.selectionStart);
    const lines = textBefore.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  const handleSave = () => {
    if (!currentFilePath) {
      handleSaveAs();
      return;
    }

    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: currentFilePath.split('/').pop() || 'Untitled.txt',
        path: currentFilePath,
        parentPath: currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) || 'C:/Documents',
        kind: 'text',
        sizeBytes: new Blob([content]).size,
        content,
        metadata: { textContent: content },
      },
    });
    setIsDirty(false);
  };

  const handleSaveAs = () => {
    const fileName = prompt('Enter filename:', 'NewDocument.txt');
    if (!fileName) return;
    const targetPath = `C:/Documents/${fileName}`;
    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: fileName,
        path: targetPath,
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: new Blob([content]).size,
        content,
        metadata: { textContent: content },
      },
    });
    setCurrentFilePath(targetPath);
    setIsDirty(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white text-black font-mono text-xs select-none">
      {/* Menu Bar */}
      <div className="flex gap-3 px-2 py-1 bg-[var(--orion-bg-surface,#dfdfdf)] border-b border-gray-400 font-sans text-xs select-none">
        <button onClick={handleSave} className="hover:underline">Save</button>
        <button onClick={handleSaveAs} className="hover:underline">Save As...</button>
        <button onClick={() => setWordWrap(!wordWrap)} className="hover:underline">
          {wordWrap ? '✓ Word Wrap' : 'Word Wrap'}
        </button>
      </div>

      {/* Textarea Canvas */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleTextChange}
        onKeyUp={e => updateCursorPos(e.currentTarget)}
        onClick={e => updateCursorPos(e.currentTarget)}
        wrap={wordWrap ? 'soft' : 'off'}
        className="flex-1 w-full p-2 outline-none resize-none font-mono text-xs text-gray-900 bg-white"
        spellCheck={false}
      />

      {/* Status Bar */}
      <div className="flex justify-between px-2 py-0.5 bg-[var(--orion-bg-surface,#dfdfdf)] border-t border-gray-400 font-sans text-[11px] text-gray-600">
        <span>{isDirty ? '● Modified' : 'Saved'}</span>
        <span>
          Ln {cursorPos.line}, Col {cursorPos.col} | {content.length} chars
        </span>
      </div>
    </div>
  );
};
```

---

## 7. Unit Test Suite Blueprints (`tests/unit/`)

### 7.1 `tests/unit/WindowManager.test.ts`
Tests the complete window management state machine:
- Open window creates instance, assigns unique ID, positions window using cascading logic, and focuses window.
- Focusing increases `zIndex` monotonically above all other windows.
- Minimizing sets `isMinimized: true`. Restoring clears `isMinimized`.
- Maximizing stores previous rect (`position`, `size`) and expands to screen dimensions. Restoring reverts to previous rect.
- Dragging clamps within desktop viewport boundaries.
- Resizing respects minimum dimensions (`minSize`).

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '../../src/store/useWindowStore';

describe('WindowManager Store', () => {
  beforeEach(() => {
    useWindowStore.setState({
      windows: {},
      activeWindowId: null,
      nextZIndex: 100,
    });
  });

  it('opens a new window and assigns cascaded position and highest zIndex', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('app.terminal', 'Terminal CLI');

    const state = useWindowStore.getState();
    expect(state.windows[winId]).toBeDefined();
    expect(state.windows[winId].isOpen).toBe(true);
    expect(state.windows[winId].title).toBe('Terminal CLI');
    expect(state.windows[winId].zIndex).toBeGreaterThanOrEqual(100);
    expect(state.activeWindowId).toBe(winId);
  });

  it('brings window to front when focused', () => {
    const store = useWindowStore.getState();
    const win1 = store.openWindow('app.terminal', 'Terminal 1');
    const win2 = store.openWindow('app.notepad', 'Notepad');

    expect(useWindowStore.getState().activeWindowId).toBe(win2);
    expect(useWindowStore.getState().windows[win2].zIndex).toBeGreaterThan(
      useWindowStore.getState().windows[win1].zIndex
    );

    // Focus win1
    useWindowStore.getState().focusWindow(win1);
    const updatedState = useWindowStore.getState();
    expect(updatedState.activeWindowId).toBe(win1);
    expect(updatedState.windows[win1].zIndex).toBeGreaterThan(
      updatedState.windows[win2].zIndex
    );
  });

  it('minimizes and restores window state cleanly', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('app.fileexplorer', 'File Explorer');

    store.minimizeWindow(winId);
    expect(useWindowStore.getState().windows[winId].isMinimized).toBe(true);

    store.restoreWindow(winId);
    expect(useWindowStore.getState().windows[winId].isMinimized).toBe(false);
  });

  it('toggles maximize preserving restore bounds', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('app.controlpanel', 'Control Panel');

    const originalSize = { ...useWindowStore.getState().windows[winId].size };
    store.maximizeWindow(winId);
    expect(useWindowStore.getState().windows[winId].isMaximized).toBe(true);

    store.unmaximizeWindow(winId);
    expect(useWindowStore.getState().windows[winId].isMaximized).toBe(false);
    expect(useWindowStore.getState().windows[winId].size).toEqual(originalSize);
  });

  it('closes window removing it from active registry', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('app.terminal', 'Terminal CLI');
    store.closeWindow(winId);

    expect(useWindowStore.getState().windows[winId]).toBeUndefined();
  });
});
```

### 7.2 `tests/unit/TerminalApp.test.ts`
Tests terminal command execution against VFS and network models:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Terminal CLI Execution Engine', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('executes dir command and lists canonical directories', () => {
    const vfs = engine.vfs.getState();
    const rootDirs = Object.values(vfs.files).filter(f => f.parentPath === 'C:' && f.kind === 'directory');
    expect(rootDirs.length).toBeGreaterThan(0);
    expect(rootDirs.some(d => d.name === 'Downloads')).toBe(true);
    expect(rootDirs.some(d => d.name === 'Documents')).toBe(true);
  });

  it('executes cd into subdirectories and validates path existence', () => {
    expect(engine.vfs.readFile('C:/Downloads')).toBeDefined();
    expect(engine.vfs.readFile('C:/NonExistentDirectory')).toBeUndefined();
  });

  it('executes type to read text files in VFS', () => {
    const readme = engine.vfs.readFile('C:/Documents/Readme.txt');
    expect(readme).toBeDefined();
    expect(readme?.kind).toBe('text');
    expect(readme?.content).toContain('Orion OS 4.8');
  });

  it('executes unzip and creates extracted files in VFS', () => {
    // Create simulated archive
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'test_pkg.zip',
        path: 'C:/Downloads/test_pkg.zip',
        parentPath: 'C:/Downloads',
        kind: 'archive',
        sizeBytes: 10240,
        metadata: { extractedFiles: ['ExtractedApp.exe'] },
      },
    });

    const archive = engine.vfs.readFile('C:/Downloads/test_pkg.zip');
    expect(archive).toBeDefined();

    // Perform extract
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'ExtractedApp.exe',
        path: 'C:/Downloads/ExtractedApp.exe',
        parentPath: 'C:/Downloads',
        kind: 'executable',
        sizeBytes: 8192,
        metadata: { isPortable: true },
      },
    });

    const extracted = engine.vfs.readFile('C:/Downloads/ExtractedApp.exe');
    expect(extracted).toBeDefined();
    expect(extracted?.metadata?.isPortable).toBe(true);
  });
});
```

### 7.3 `tests/unit/FileExplorerApp.test.ts`
Tests file browsing, deletion to trash, restoration, and permanent deletion:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('File Explorer & Trash VFS Operations', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('moves a file to C:/Trash preserving original path metadata', () => {
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'photo.jpg',
        path: 'C:/Pictures/photo.jpg',
        parentPath: 'C:/Pictures',
        kind: 'image',
        sizeBytes: 50000,
      },
    });

    expect(engine.vfs.readFile('C:/Pictures/photo.jpg')).toBeDefined();

    engine.dispatchAction({ type: 'VFS_MOVE_TRASH', path: 'C:/Pictures/photo.jpg' });

    expect(engine.vfs.readFile('C:/Pictures/photo.jpg')).toBeUndefined();
    const trashed = engine.vfs.readFile('C:/Trash/photo.jpg');
    expect(trashed).toBeDefined();
    expect(trashed?.metadata?.originalTrashPath).toBe('C:/Pictures/photo.jpg');
  });

  it('restores a file from trash back to its original directory', () => {
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'notes.txt',
        path: 'C:/Documents/notes.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 1024,
      },
    });

    engine.dispatchAction({ type: 'VFS_MOVE_TRASH', path: 'C:/Documents/notes.txt' });
    expect(engine.vfs.readFile('C:/Documents/notes.txt')).toBeUndefined();

    engine.dispatchAction({ type: 'VFS_RESTORE_TRASH', trashPath: 'C:/Trash/notes.txt' });
    expect(engine.vfs.readFile('C:/Documents/notes.txt')).toBeDefined();
    expect(engine.vfs.readFile('C:/Trash/notes.txt')).toBeUndefined();
  });

  it('empties trash and reclaims occupied disk bytes', () => {
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'junk.bin',
        path: 'C:/Downloads/junk.bin',
        parentPath: 'C:/Downloads',
        kind: 'executable',
        sizeBytes: 10_000_000,
      },
    });

    engine.dispatchAction({ type: 'VFS_MOVE_TRASH', path: 'C:/Downloads/junk.bin' });
    const freeBefore = engine.vfs.getFreeDiskBytes();

    const emptyRes = engine.dispatchAction({ type: 'VFS_EMPTY_TRASH' });
    expect(emptyRes.success).toBe(true);
    expect(engine.vfs.readFile('C:/Trash/junk.bin')).toBeUndefined();
    expect(engine.vfs.getFreeDiskBytes()).toBe(freeBefore + 10_000_000);
  });
});
```

### 7.4 `tests/unit/ControlPanelApp.test.ts`
Tests hardware information parsing and software management:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Control Panel & Hardware Metrics', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('calculates disk storage utilization accurately', () => {
    const hw = engine.hardware.getState();
    expect(hw.hddTotalGB).toBe(40);
    expect(hw.hddFreeGB).toBeGreaterThan(0);
    expect(hw.hddFreeGB).toBeLessThan(40);
  });

  it('calculates RAM pressure ratio from installed RAM', () => {
    const pressure = engine.hardware.getRamPressure(128); // 128 MB used
    expect(pressure.totalRamMB).toBe(512);
    expect(pressure.usedRamMB).toBe(128);
    expect(pressure.pressureRatio).toBeCloseTo(128 / 512, 2);
    expect(pressure.status).toBe('nominal');
  });

  it('uninstalls software and removes shortcuts cleanly', () => {
    // Install Pulse Messenger
    engine.dispatchAction({ type: 'SOFTWARE_INSTALL', softwareId: 'sw_pulse_52' });
    expect(engine.software.isInstalled('app.pulse')).toBe(true);
    expect(engine.vfs.readFile('C:/Desktop/Pulse Messenger.lnk')).toBeDefined();

    const installedRecord = engine.software.getInstalledSoftware().find(s => s.appId === 'app.pulse');
    expect(installedRecord).toBeDefined();

    // Uninstall
    const uninstallRes = engine.dispatchAction({
      type: 'SOFTWARE_UNINSTALL',
      installedId: installedRecord!.id,
    });
    expect(uninstallRes.success).toBe(true);
    expect(engine.software.isInstalled('app.pulse')).toBe(false);
    expect(engine.vfs.readFile('C:/Desktop/Pulse Messenger.lnk')).toBeUndefined();
  });
});
```

---

## 8. Summary Matrix

| Utility / Test Suite | Primary Module Responsibility | Key State Bindings |
|---|---|---|
| `TerminalApp.tsx` | Interactive CLI, history, async `ping`/`tracert`, file commands | `vfs`, `hardware`, `dispatchAction`, `useWindowStore` |
| `FileExplorerApp.tsx` | Directory browsing, breadcrumb bar, double-click run, trash | `vfs`, `useWindowStore`, `dispatchAction` |
| `ControlPanelApp.tsx` | Theme/Wallpaper switcher, Volume slider, Storage pie chart | `hardware`, `vfs`, `useAudioStore` |
| `AddRemoveApp.tsx` | Program list, uninstaller wizard, adware removal indicator | `installedSoftware`, `dispatchAction` |
| `NotepadApp.tsx` | Text editing, unsaved dirty state, VFS save/save-as, status bar | `vfs`, `dispatchAction` |
| `TrashApp.tsx` | Recycle bin inspection, restore item, empty trash reclamation | `vfs`, `dispatchAction` |
| `WindowManager.test.ts` | Vitest suite for window lifecycle, zIndex, resize, minimize | `useWindowStore` |
| `TerminalApp.test.ts` | Vitest suite for CLI commands and VFS queries | `SimulationEngine`, `FileSystemEngine` |
| `FileExplorerApp.test.ts`| Vitest suite for file navigation, trash and restore | `SimulationEngine`, `FileSystemEngine` |
| `ControlPanelApp.test.ts`| Vitest suite for storage pie chart, RAM pressure, uninstall | `SimulationEngine`, `SoftwareRegistry`, `HardwareEngine` |

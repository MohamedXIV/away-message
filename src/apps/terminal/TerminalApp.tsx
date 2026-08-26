import React, { useState, useRef, useEffect } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';

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
  'localhost': { ip: '127.0.0.1', hops: ['127.0.0.1 (localhost)'] },
  'gateway.local': { ip: '192.168.1.1', hops: ['192.168.1.1 (gateway.local)'] },
};

export const TerminalApp: React.FC<{ windowId: string }> = ({ windowId }) => {
  const vfs = useSimulationStore((s) => s.state.vfs);
  const hardware = useSimulationStore((s) => s.state.hardware);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const closeWindow = useWindowStore((s) => s.closeWindow);

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
    setLines((prev) => [...prev, { id: `${Date.now()}_${Math.random()}`, type, text }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isExecutingAsync) return;

    if (e.key === 'Enter') {
      const cmd = inputVal.trim();
      addLine(`${currentPath}> ${inputVal}`, 'input');
      if (cmd) {
        setHistory((prev) => [cmd, ...prev]);
        setHistoryIndex(-1);
        processCommand(cmd);
      }
      setInputVal('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        if (history[nextIdx] !== undefined) {
          setInputVal(history[nextIdx]!);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        if (history[nextIdx] !== undefined) {
          setInputVal(history[nextIdx]!);
        }
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const processCommand = (rawCommand: string) => {
    const parts = rawCommand.split(' ').filter(Boolean);
    const cmd = (parts[0] ?? '').toLowerCase();
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
        if (args.length === 0 || !args[0]) {
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
        const targetDir = args[0]
          ? (args[0].startsWith('C:') ? args[0] : `${currentPath}/${args[0]}`).replace(/\/+/g, '/')
          : currentPath;
        const matchingFiles = Object.values(vfs.files).filter(
          (f) => f.parentPath === targetDir && f.path !== targetDir
        );

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

        const freeBytes = Math.max(0, vfs.totalDiskBytes - vfs.baseSystemBytes - totalFileBytes).toLocaleString();
        output += `              ${fileCount} File(s)    ${totalFileBytes.toLocaleString()} bytes\n`;
        output += `              ${dirCount} Dir(s)     ${freeBytes} bytes free\n`;
        addLine(output);
        break;
      }

      case 'type':
      case 'cat': {
        if (args.length === 0 || !args[0]) {
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
        if (args.length === 0 || !args[0]) {
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
        }, 300);
        break;
      }

      case 'tracert': {
        if (args.length === 0 || !args[0]) {
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
        }, 350);
        break;
      }

      case 'unzip': {
        if (args.length === 0 || !args[0]) {
          addLine('Usage: unzip <archive.zip>', 'error');
          return;
        }
        const zipPath = args[0].startsWith('C:')
          ? args[0]
          : `${currentPath}/${args[0]}`.replace(/\/+/g, '/');
        const file = vfs.files[zipPath];
        if (!file || file.kind !== 'archive') {
          addLine(`Archive not found or invalid format: ${args[0]}`, 'error');
          return;
        }

        const extracted = (file.metadata?.extractedFiles as string[]) || ['ExtractedProgram.exe'];
        const extractedFileName = extracted[0] ?? 'ExtractedProgram.exe';
        addLine(`Archive:  ${zipPath}\n  inflating: ${currentPath}/${extractedFileName}`);

        dispatchAction({
          type: 'VFS_CREATE_FILE',
          file: {
            name: extractedFileName,
            path: `${currentPath}/${extractedFileName}`,
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
        {lines.map((line) => (
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
          onChange={(e) => setInputVal(e.target.value)}
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

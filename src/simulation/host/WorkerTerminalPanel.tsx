import { useEffect, useRef, useState } from 'react';
import { useWindowStore } from '../../store/useWindowStore';
import type { WorkerGameSession } from './WorkerGameSession';
import { executeWorkerTerminalCommand } from './WorkerTerminalCommands';

type Line = { id: number; kind: 'input' | 'output' | 'system' | 'error'; text: string };

/** DOS-inspired authored view, never a main-thread SimulationKernel. */
export function WorkerTerminalPanel({ session, windowId, osVersion }: {
  session: WorkerGameSession; windowId: string; osVersion: string | null;
}) {
  const closeWindow = useWindowStore(s => s.closeWindow);
  const [cwd, setCwd] = useState('C:');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { id: 0, kind: 'system', text: 'Orion OS Command Prompt\nType HELP for supported commands.' },
  ]);
  const ordinal = useRef(1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);
  const append = (kind: Line['kind'], text: string) => {
    setLines(previous => [...previous, { id: ordinal.current++, kind, text }].slice(-120));
  };
  const submit = async () => {
    const command = input.trim();
    if (!command || busy) return;
    setBusy(true); setInput(''); setHistoryIndex(-1);
    setHistory(old => [command, ...old].slice(0, 40));
    append('input', cwd + '> ' + command);
    try {
      const result = await executeWorkerTerminalCommand(session, cwd, command, osVersion);
      if (result.clear) setLines([]);
      if (result.nextPath) setCwd(result.nextPath);
      if (result.text !== undefined) append('output', result.text);
      if (result.error) append('error', result.error);
      if (result.exit) closeWindow(windowId);
    } catch (cause) { append('error', cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); inputRef.current?.focus(); }
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      const i = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(i); setInput(history[i] ?? '');
    } else if (event.key === 'ArrowDown' && historyIndex >= 0) {
      event.preventDefault();
      const i = historyIndex - 1; setHistoryIndex(i); setInput(i >= 0 ? history[i] ?? '' : '');
    }
  };
  return <section data-testid="worker-terminal" className="flex h-full min-h-0 flex-col bg-black font-mono text-[12px] text-[#d2d2d2]">
    <div ref={outputRef} data-testid="worker-terminal-output" aria-live="polite"
      className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-3 pt-3">
      {lines.map(line => <div key={line.id}
        className={'mb-1 ' + (line.kind === 'error' ? 'text-red-400' : line.kind === 'input' ? 'text-green-300' : 'text-[#d2d2d2]')}>{line.text}</div>)}
    </div>
    <form className="flex shrink-0 gap-1 border-t border-gray-600 px-3 py-2"
      onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor="worker-terminal-input" className="shrink-0 text-green-300">{cwd}&gt;</label>
      <input id="worker-terminal-input" ref={inputRef} aria-label="Command line"
        value={input} autoComplete="off" spellCheck={false} disabled={busy}
        onKeyDown={onKeyDown} onChange={event => setInput(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-white outline-none disabled:opacity-50"/>
      <button type="submit" disabled={busy || !input.trim()}
        className="border border-gray-500 px-2 disabled:opacity-40">Enter</button>
    </form>
  </section>;
}

// src/tools/studio/tabs/DialoguePoolsTab.tsx
import React, { useState, useMemo } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';

interface Props {
  studio: StudioStoreContext;
}

export const DialoguePoolsTab: React.FC<Props> = ({ studio }) => {
  const pools = (studio.tables['dialoguePools'] ?? {}) as Record<string, Record<string, unknown>>;
  const poolKeys = Object.keys(pools).sort();

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>(() => poolKeys[0] || '');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [addError, setAddError] = useState('');

  // Bulk edit toggle
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // New single line input
  const [newLineText, setNewLineText] = useState('');

  const filteredKeys = useMemo(() => {
    if (!searchFilter.trim()) return poolKeys;
    const q = searchFilter.toLowerCase();
    return poolKeys.filter((k) => k.toLowerCase().includes(q));
  }, [poolKeys, searchFilter]);

  const activePool = pools[selectedKey];

  const parseLines = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') {
      try {
        const p = JSON.parse(val);
        return Array.isArray(p) ? p.map(String) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const lines = parseLines(activePool?.['lines']);

  const handleCreatePool = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newKey.trim()) {
      setAddError('Please enter a pool key (e.g. offline.regular or greeting.rain).');
      return;
    }
    const ok = studio.addDialoguePool(newKey.trim());
    if (!ok) {
      setAddError(`Pool '${newKey}' already exists.`);
      return;
    }
    setSelectedKey(newKey.trim());
    setShowAddModal(false);
    setNewKey('');
  };

  const handleDeletePool = (key: string) => {
    if (confirm(`Delete dialogue pool '${key}' and all its lines?`)) {
      studio.deleteDialoguePool(key);
      const remaining = poolKeys.filter((k) => k !== key);
      setSelectedKey(remaining[0] || '');
    }
  };

  const updateLines = (nextLines: string[]) => {
    studio.setCell('dialoguePools', selectedKey, 'lines', JSON.stringify(nextLines));
  };

  const handleAddLine = () => {
    const clean = newLineText.trim();
    if (!clean) return;
    updateLines([...lines, clean]);
    setNewLineText('');
  };

  const handleEditLine = (index: number, val: string) => {
    const next = [...lines];
    next[index] = val;
    updateLines(next);
  };

  const handleDeleteLine = (index: number) => {
    const next = lines.filter((_, i) => i !== index);
    updateLines(next);
  };

  const handleMoveLine = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;
    const next = [...lines];
    const temp = next[index]!;
    next[index] = next[targetIdx]!;
    next[targetIdx] = temp;
    updateLines(next);
  };

  const openBulkMode = () => {
    setBulkText(lines.join('\n'));
    setBulkMode(true);
  };

  const saveBulkMode = () => {
    const splitLines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    updateLines(splitLines);
    setBulkMode(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Pool Key Sidebar */}
      <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-purple-900/60 bg-[#140b26] flex flex-col shrink-0">
        <div className="p-3 border-b border-purple-900/40 flex justify-between items-center bg-[#100820]">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
            Dialogue Pools ({poolKeys.length})
          </span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded bg-purple-700 hover:bg-purple-600 px-2 py-0.5 text-xs font-bold text-white shadow"
          >
            + Add
          </button>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-purple-900/30">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search pools..."
            className="w-full rounded bg-[#100820] border border-purple-800/40 px-2.5 py-1 text-xs text-purple-100 placeholder-purple-400/50 focus:border-purple-400 focus:outline-none"
          />
        </div>

        {/* Pool Key List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredKeys.map((k) => {
            const p = pools[k];
            const count = parseLines(p?.['lines']).length;
            const isSelected = k === selectedKey;

            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSelectedKey(k);
                  setBulkMode(false);
                }}
                className={`w-full text-left p-2 rounded transition-colors flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-purple-900/50 border border-purple-500/60 text-white shadow'
                    : 'text-gray-300 hover:bg-purple-950/40 hover:text-white border border-transparent'
                }`}
              >
                <span className="text-xs font-mono truncate">{k}</span>
                <span
                  className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800/40 shrink-0"
                  title={`${count} lines in this pool`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Detail Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0718]">
        {activePool ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-purple-900/40 bg-[#110822] p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">{selectedKey}</h2>
                <span className="text-xs text-purple-400">
                  {lines.length} lines &bull; schema version: {Number(activePool['version'] || 1)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (bulkMode ? saveBulkMode() : openBulkMode())}
                  className="px-3 py-1 text-xs font-semibold rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 shadow"
                >
                  {bulkMode ? 'Save Text Lines' : 'Bulk Edit (Plaintext)'}
                </button>
                {bulkMode && (
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeletePool(selectedKey)}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold px-2.5 py-1 rounded border border-red-950 hover:bg-red-950/40 transition-colors"
                >
                  Delete Pool
                </button>
              </div>
            </div>

            {/* Content Body */}
            {bulkMode ? (
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                <label className="text-xs text-gray-400 mb-2">
                  Paste or edit one dialogue line per row:
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="flex-1 w-full rounded bg-[#130d24] border border-purple-800/60 p-3 text-xs text-purple-100 font-mono focus:border-purple-400 focus:outline-none resize-none leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded bg-[#140b26] border border-purple-900/40 hover:border-purple-700/50 group"
                  >
                    <span className="text-[11px] font-mono text-purple-400 w-6 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => handleEditLine(idx, e.target.value)}
                      className="flex-1 rounded bg-[#100820] border border-purple-900/60 px-2.5 py-1 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                    />
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveLine(idx, 'up')}
                        className="px-1.5 py-0.5 rounded text-xs text-purple-300 hover:bg-purple-900/80 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Up"
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        disabled={idx === lines.length - 1}
                        onClick={() => handleMoveLine(idx, 'down')}
                        className="px-1.5 py-0.5 rounded text-xs text-purple-300 hover:bg-purple-900/80 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Down"
                      >
                        &darr;
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLine(idx)}
                        className="px-1.5 py-0.5 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-950/60"
                        title="Delete Line"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}

                {lines.length === 0 && (
                  <p className="text-xs text-gray-500 py-6 text-center italic">
                    No dialogue lines in this pool yet. Add one below or use bulk edit.
                  </p>
                )}

                {/* Add Line Input */}
                <div className="pt-2 flex gap-2">
                  <input
                    type="text"
                    value={newLineText}
                    onChange={(e) => setNewLineText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLine();
                      }
                    }}
                    placeholder="Type a new dialogue line..."
                    className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-4 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-xs font-bold text-white shadow shrink-0"
                  >
                    + Add Line
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Select a dialogue pool from the list or create a new one.
          </div>
        )}
      </div>

      {/* Add Pool Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreatePool}
            className="w-full max-w-md rounded-lg border border-purple-500 bg-[#160b24] p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Add Dialogue Pool
            </h3>

            {addError && (
              <div className="text-xs text-red-300 bg-red-950/40 p-2 rounded border border-red-900">
                {addError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Pool Key <span className="text-[10px] text-gray-400 font-normal">(e.g. offline.artist or weather.rain)</span>
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="category.role_or_tag"
                autoFocus
                className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 font-mono focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-purple-900/40">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white shadow"
              >
                Create Pool
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

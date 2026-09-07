// src/tools/studio/tabs/ArchetypesTab.tsx
import React, { useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';

interface Props {
  studio: StudioStoreContext;
}

export const ArchetypesTab: React.FC<Props> = ({ studio }) => {
  const archetypes = (studio.tables['archetypes'] ?? {}) as Record<string, Record<string, unknown>>;
  const archetypeIds = Object.keys(archetypes);

  const characters = (studio.tables['characters'] ?? {}) as Record<string, Record<string, unknown>>;

  const [selectedId, setSelectedId] = useState<string>(() => archetypeIds[0] || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState('');

  const [newVocabItem, setNewVocabItem] = useState('');
  const [newInterestItem, setNewInterestItem] = useState('');

  const active = archetypes[selectedId];

  // Which characters reference this archetype
  const referencingCharacters = Object.entries(characters)
    .filter(([, char]) => char['archetypeId'] === selectedId)
    .map(([id, char]) => ({ id, name: String(char['displayName'] || id) }));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newId.trim()) {
      setAddError('Please enter an archetype ID.');
      return;
    }
    const ok = studio.addArchetype(newId, newLabel);
    if (!ok) {
      setAddError(`Archetype '${newId}' already exists or ID is invalid.`);
      return;
    }
    const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    setSelectedId(cleanId);
    setShowAddModal(false);
    setNewId('');
    setNewLabel('');
  };

  const handleDelete = (id: string) => {
    if (referencingCharacters.length > 0) {
      alert(`Cannot delete archetype '${id}' because it is in use by: ${referencingCharacters.map((c) => c.name).join(', ')}`);
      return;
    }
    if (confirm(`Delete archetype '${id}'?`)) {
      studio.deleteArchetype(id);
      const remaining = archetypeIds.filter((x) => x !== id);
      setSelectedId(remaining[0] || '');
    }
  };

  const parseJsonArray = (val: unknown): string[] => {
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

  const vocabulary = parseJsonArray(active?.['vocabulary']);
  const defaultInterests = parseJsonArray(active?.['defaultInterests']);

  const addVocab = (tag: string) => {
    const clean = tag.trim();
    if (!clean || vocabulary.includes(clean)) return;
    const next = [...vocabulary, clean];
    studio.setCell('archetypes', selectedId, 'vocabulary', JSON.stringify(next));
    setNewVocabItem('');
  };

  const removeVocab = (idx: number) => {
    const next = vocabulary.filter((_, i) => i !== idx);
    studio.setCell('archetypes', selectedId, 'vocabulary', JSON.stringify(next));
  };

  const addInterest = (item: string) => {
    const clean = item.trim();
    if (!clean || defaultInterests.includes(clean)) return;
    const next = [...defaultInterests, clean];
    studio.setCell('archetypes', selectedId, 'defaultInterests', JSON.stringify(next));
    setNewInterestItem('');
  };

  const removeInterest = (idx: number) => {
    const next = defaultInterests.filter((_, i) => i !== idx);
    studio.setCell('archetypes', selectedId, 'defaultInterests', JSON.stringify(next));
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Archetype List Sidebar */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-purple-900/60 bg-[#140b26] flex flex-col shrink-0">
        <div className="p-3 border-b border-purple-900/40 flex justify-between items-center bg-[#100820]">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
            Archetypes ({archetypeIds.length})
          </span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded bg-purple-700 hover:bg-purple-600 px-2 py-0.5 text-xs font-bold text-white shadow"
          >
            + Add
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {archetypeIds.map((id) => {
            const arch = archetypes[id];
            const isSelected = id === selectedId;
            const label = String(arch?.['label'] || id);
            const userCount = Object.values(characters).filter((c) => c['archetypeId'] === id).length;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className={`w-full text-left p-2.5 rounded transition-colors flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-purple-900/50 border border-purple-500/60 text-white shadow'
                    : 'text-gray-300 hover:bg-purple-950/40 hover:text-white border border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{label}</div>
                  <div className="text-[10px] text-purple-400 font-mono truncate">@{id}</div>
                </div>
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/50 shrink-0"
                  title={`${userCount} character(s) using this archetype`}
                >
                  {userCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0718]">
        {active ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {String(active['label'] || selectedId)}
                </h2>
                <span className="text-xs text-purple-400 font-mono">Archetype ID: @{selectedId}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(selectedId)}
                className="text-xs text-red-400 hover:text-red-300 font-semibold px-2.5 py-1 rounded border border-red-950 hover:bg-red-950/40 transition-colors"
              >
                Delete Archetype
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-300 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={String(active['label'] ?? '')}
                  onChange={(e) => studio.setCell('archetypes', selectedId, 'label', e.target.value)}
                  className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-300 mb-1">
                  Default Song
                </label>
                <input
                  type="text"
                  value={String(active['defaultSong'] ?? '')}
                  onChange={(e) => studio.setCell('archetypes', selectedId, 'defaultSong', e.target.value)}
                  placeholder="e.g. Postal Service - Such Great Heights"
                  className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={String(active['description'] ?? '')}
                  onChange={(e) => studio.setCell('archetypes', selectedId, 'description', e.target.value)}
                  placeholder="Short description of this archetype behavior and presence..."
                  className="w-full rounded bg-[#130d24] border border-purple-800/60 p-2.5 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-300 mb-1">
                  Persona Voice Hint
                </label>
                <textarea
                  rows={2}
                  value={String(active['personaHint'] ?? '')}
                  onChange={(e) => studio.setCell('archetypes', selectedId, 'personaHint', e.target.value)}
                  placeholder="Guidance for dialogue phrasing, vocabulary quirks, and tone..."
                  className="w-full rounded bg-[#130d24] border border-purple-800/60 p-2.5 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-300 mb-1">
                  Typing Speed: {Number(active['typingSpeedWpm'] ?? 70)} WPM
                </label>
                <input
                  type="range"
                  min={30}
                  max={150}
                  value={Number(active['typingSpeedWpm'] ?? 70)}
                  onChange={(e) =>
                    studio.setCell('archetypes', selectedId, 'typingSpeedWpm', Number(e.target.value))
                  }
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>30 WPM (slow)</span>
                  <span>70 WPM (average)</span>
                  <span>150 WPM (lightning)</span>
                </div>
              </div>
            </div>

            {/* Vocabulary Editor */}
            <div className="rounded-lg border border-purple-900/50 bg-[#140b26] p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Archetype Vocabulary ({vocabulary.length})
              </h3>
              <p className="text-xs text-gray-400">
                Signature catchphrases, slang, or idioms characters of this archetype frequently use.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vocabulary.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-900/40 text-purple-200 border border-purple-700/50"
                  >
                    <span>&ldquo;{tag}&rdquo;</span>
                    <button
                      type="button"
                      onClick={() => removeVocab(idx)}
                      className="text-purple-400 hover:text-red-300 text-xs font-bold"
                      title="Remove vocabulary word"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm pt-1">
                <input
                  type="text"
                  value={newVocabItem}
                  onChange={(e) => setNewVocabItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addVocab(newVocabItem);
                    }
                  }}
                  placeholder="e.g. totally, whatever, yo"
                  className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-3 py-1 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addVocab(newVocabItem)}
                  className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-600 text-xs font-bold text-white shadow"
                >
                  Add Word
                </button>
              </div>
            </div>

            {/* Default Interests Editor */}
            <div className="rounded-lg border border-purple-900/50 bg-[#140b26] p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Default Interests ({defaultInterests.length})
              </h3>
              <p className="text-xs text-gray-400">
                Baseline topics and hobbies associated with this archetype.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {defaultInterests.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-950/60 text-indigo-200 border border-indigo-700/50"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeInterest(idx)}
                      className="text-indigo-400 hover:text-red-300 text-xs font-bold"
                      title="Remove interest"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm pt-1">
                <input
                  type="text"
                  value={newInterestItem}
                  onChange={(e) => setNewInterestItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addInterest(newInterestItem);
                    }
                  }}
                  placeholder="e.g. Retro gaming, Synth music"
                  className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-3 py-1 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addInterest(newInterestItem)}
                  className="px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-xs font-bold text-white shadow"
                >
                  Add Interest
                </button>
              </div>
            </div>

            {/* Referencing Characters */}
            <div className="rounded-lg border border-purple-900/40 bg-[#110822] p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Assigned Characters ({referencingCharacters.length})
              </h3>
              {referencingCharacters.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {referencingCharacters.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-900/30 border border-purple-700/40 text-xs text-purple-200 font-mono"
                    >
                      <span>@{c.id}</span>
                      <span className="text-gray-400">({c.name})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">No characters currently use this archetype.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Select an archetype from the sidebar or create a new one.
          </div>
        )}
      </div>

      {/* Add Archetype Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-lg border border-purple-500 bg-[#160b24] p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Add New Archetype
            </h3>

            {addError && (
              <div className="text-xs text-red-300 bg-red-950/40 p-2 rounded border border-red-900">
                {addError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Archetype ID <span className="text-[10px] text-gray-400 font-normal">(e.g. nightowl, gamer)</span>
              </label>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="archetype_id"
                autoFocus
                className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 font-mono focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Label</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Night Owl"
                className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
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
                Create Archetype
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// src/tools/studio/tabs/CharactersTab.tsx
import React, { useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { CharacterIdentityForm } from '../components/CharacterIdentityForm';
import { TemperamentEditor } from '../components/TemperamentEditor';
import { AffinitiesEditor } from '../components/AffinitiesEditor';
import { RoutineTimeline } from '../components/RoutineTimeline';
import { ArtProfileEditor } from '../components/ArtProfileEditor';
import { BackstoryEditor } from '../components/BackstoryEditor';

interface Props {
  studio: StudioStoreContext;
}

type SubTab = 'identity' | 'temperament' | 'affinities' | 'routine' | 'art' | 'backstory';

export const CharactersTab: React.FC<Props> = ({ studio }) => {
  const characters = studio.tables['characters'] ?? {};
  const characterIds = Object.keys(characters);
  const archetypeIds = Object.keys(studio.tables['archetypes'] ?? {});

  const [selectedId, setSelectedId] = useState<string>(() => characterIds[0] || '');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('identity');

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newArchetype, setNewArchetype] = useState(archetypeIds[0] || 'regular');
  const [addError, setAddError] = useState('');

  // Delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Selected character data slices
  const activeChar = characters[selectedId] as Record<string, unknown> | undefined;
  const activeTemperament = (studio.tables['temperaments']?.[selectedId] ?? {}) as Record<string, unknown>;
  const activeAffinities = (studio.tables['initialAffinities']?.[selectedId] ?? {}) as Record<string, unknown>;
  const activeRoutine = (studio.tables['routines']?.[selectedId] ?? {}) as Record<string, unknown>;
  const activeArt = (studio.tables['artProfiles']?.[selectedId] ?? {}) as Record<string, unknown>;
  const activeBackstory = (studio.tables['backstories']?.[selectedId] ?? {}) as Record<string, unknown>;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newId.trim()) {
      setAddError('Please specify a character id.');
      return;
    }
    const ok = studio.addCharacter(newId, newName, newArchetype);
    if (!ok) {
      setAddError(`Character '${newId}' already exists or id format is invalid.`);
      return;
    }
    const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    setSelectedId(cleanId);
    setShowAddModal(false);
    setNewId('');
    setNewName('');
  };

  const handleDelete = (id: string) => {
    studio.deleteCharacter(id);
    setConfirmDeleteId(null);
    const remaining = characterIds.filter((x) => x !== id);
    setSelectedId(remaining[0] || '');
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Roster Sidebar */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-purple-900/60 bg-[#140b26] flex flex-col shrink-0">
        <div className="p-3 border-b border-purple-900/40 flex justify-between items-center bg-[#100820]">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
            Characters ({characterIds.length})
          </span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded bg-purple-700 hover:bg-purple-600 px-2 py-0.5 text-xs font-bold text-white shadow"
          >
            + Add
          </button>
        </div>

        {/* Character list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {characterIds.map((id) => {
            const row = characters[id] as Record<string, unknown>;
            const active = id === selectedId;
            const chatColor = String(row?.['chatColor'] ?? '#6a3fa0');
            const displayName = String(row?.['displayName'] ?? id);
            const arch = String(row?.['archetypeId'] ?? '');
            const reach = String(row?.['reach'] ?? 'local');

            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className={`w-full text-left p-2 rounded transition-colors flex items-center gap-2.5 ${
                  active
                    ? 'bg-purple-900/50 border border-purple-500/60 text-white shadow'
                    : 'text-gray-300 hover:bg-purple-950/40 hover:text-white border border-transparent'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0 shadow border border-white/20"
                  style={{ backgroundColor: chatColor }}
                  title={`Signature Color: ${chatColor}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold truncate">{displayName}</span>
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono bg-purple-950/80 text-purple-300">
                      {reach}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate flex items-center gap-1.5">
                    <span className="font-mono">@{id}</span>
                    <span>&bull;</span>
                    <span className="capitalize">{arch}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Detail Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0718]">
        {activeChar ? (
          <>
            {/* Header / Subtab Bar */}
            <div className="border-b border-purple-900/40 bg-[#110822] px-4 py-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: String(activeChar['chatColor'] ?? '#6a3fa0') }}
                />
                <h2 className="text-base font-extrabold text-white">
                  {String(activeChar['displayName'] ?? selectedId)}
                </h2>
                <span className="text-xs text-purple-400 font-mono">(@{selectedId})</span>
              </div>

              {/* Sub-tab Pills */}
              <div className="flex flex-wrap gap-1 bg-[#180e30] p-1 rounded-lg border border-purple-900/60">
                {[
                  { id: 'identity', label: 'Identity' },
                  { id: 'temperament', label: 'Temperament' },
                  { id: 'affinities', label: 'Affinities' },
                  { id: 'routine', label: 'Routine' },
                  { id: 'art', label: 'Art / Live2D' },
                  { id: 'backstory', label: 'Backstory' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveSubTab(t.id as SubTab)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                      activeSubTab === t.id
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Delete character button */}
              <button
                type="button"
                onClick={() => setConfirmDeleteId(selectedId)}
                className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded border border-red-950 hover:bg-red-950/40 transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Sub-tab Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeSubTab === 'identity' && (
                <CharacterIdentityForm
                  characterId={selectedId}
                  data={activeChar}
                  archetypes={archetypeIds}
                  onChange={(k, val) => studio.setCell('characters', selectedId, k, val)}
                />
              )}

              {activeSubTab === 'temperament' && (
                <TemperamentEditor
                  data={activeTemperament}
                  onChange={(k, val) => studio.setCell('temperaments', selectedId, k, val)}
                />
              )}

              {activeSubTab === 'affinities' && (
                <AffinitiesEditor
                  data={activeAffinities}
                  onChange={(k, val) => studio.setCell('initialAffinities', selectedId, k, val)}
                />
              )}

              {activeSubTab === 'routine' && (
                <RoutineTimeline
                  data={activeRoutine}
                  onChange={(k, val) => studio.setCell('routines', selectedId, k, val)}
                />
              )}

              {activeSubTab === 'art' && (
                <ArtProfileEditor
                  data={activeArt}
                  onChange={(k, val) => studio.setCell('artProfiles', selectedId, k, val)}
                />
              )}

              {activeSubTab === 'backstory' && (
                <BackstoryEditor
                  data={activeBackstory}
                  onChange={(k, val) => studio.setCell('backstories', selectedId, k, val)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Select a character from the roster or add a new one.
          </div>
        )}
      </div>

      {/* Add Character Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-lg border border-purple-500 bg-[#160b24] p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Add New Character
            </h3>

            {addError && (
              <div className="text-xs text-red-300 bg-red-950/40 p-2 rounded border border-red-900">
                {addError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Character ID <span className="text-[10px] text-gray-400 font-normal">(snake_case, e.g. sam_guitar)</span>
              </label>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="character_id"
                autoFocus
                className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 font-mono focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Display Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sam"
                className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Archetype</label>
              <select
                value={newArchetype}
                onChange={(e) => setNewArchetype(e.target.value)}
                className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none capitalize"
              >
                {archetypeIds.map((arch) => (
                  <option key={arch} value={arch}>
                    {arch}
                  </option>
                ))}
              </select>
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
                Create Character
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-500/80 bg-[#160b24] p-4 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-red-300">Delete Character?</h3>
            <p className="text-xs text-gray-300">
              Are you sure you want to delete <strong className="text-white font-mono">@{confirmDeleteId}</strong>?
              This will remove all associated temperament, routine, art profile, and backstory rows.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 font-bold text-xs text-white"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

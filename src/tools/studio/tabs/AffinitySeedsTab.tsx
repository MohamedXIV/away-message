// src/tools/studio/tabs/AffinitySeedsTab.tsx
import React, { useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';

interface Props {
  studio: StudioStoreContext;
}

export const AffinitySeedsTab: React.FC<Props> = ({ studio }) => {
  const affinitySeeds = (studio.tables['affinitySeeds'] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const seedKeys = Object.keys(affinitySeeds).sort();

  const characters = (studio.tables['characters'] ?? {}) as Record<string, Record<string, unknown>>;
  const characterIds = Object.keys(characters).sort();

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [roleA, setRoleA] = useState(characterIds[0] || '');
  const [roleB, setRoleB] = useState(characterIds[1] || characterIds[0] || '');
  const [initialValue, setInitialValue] = useState(0);
  const [addError, setAddError] = useState('');

  // Filter
  const [filterRole, setFilterRole] = useState('all');

  const filteredKeys = seedKeys.filter((k) => {
    if (filterRole === 'all') return true;
    const seed = affinitySeeds[k];
    return seed?.['roleA'] === filterRole || seed?.['roleB'] === filterRole;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!roleA.trim() || !roleB.trim()) {
      setAddError('Both Role A and Role B are required.');
      return;
    }
    if (roleA.trim() === roleB.trim()) {
      setAddError('Role A and Role B cannot be the same entity.');
      return;
    }
    const ok = studio.addAffinitySeed(roleA, roleB, initialValue);
    if (!ok) {
      setAddError(`An affinity seed between '${roleA}' and '${roleB}' already exists.`);
      return;
    }
    setShowAddModal(false);
  };

  const getSeedDescription = (val: number): { label: string; color: string } => {
    if (val >= 60) return { label: 'Strong Synergy', color: 'text-emerald-400' };
    if (val >= 20) return { label: 'Mild Synergy', color: 'text-green-400' };
    if (val > 0) return { label: 'Slight Affinity', color: 'text-teal-400' };
    if (val === 0) return { label: 'Neutral', color: 'text-gray-400' };
    if (val > -30) return { label: 'Mild Friction', color: 'text-amber-400' };
    if (val > -60) return { label: 'Noticeable Tension', color: 'text-orange-400' };
    return { label: 'Strong Rivalry / Friction', color: 'text-red-400' };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0718]">
      {/* Top Controls */}
      <div className="p-4 border-b border-purple-900/40 bg-[#110822] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            NPC &harr; NPC Affinity Seeds ({seedKeys.length})
          </h2>
          <p className="text-xs text-purple-400">
            Baseline relationship synergies (+1 to +100) or friction (-1 to -100) between characters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 font-semibold">Filter:</span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="rounded bg-[#180e30] border border-purple-800/60 px-2.5 py-1 text-xs text-purple-200 focus:outline-none"
            >
              <option value="all">All Pairs ({seedKeys.length})</option>
              {characterIds.map((c) => (
                <option key={c} value={c}>
                  @{c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded bg-purple-700 hover:bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow"
          >
            + Add Seed
          </button>
        </div>
      </div>

      {/* Seed Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredKeys.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredKeys.map((k) => {
              const seed = affinitySeeds[k];
              const a = String(seed?.['roleA'] ?? '');
              const b = String(seed?.['roleB'] ?? '');
              const val = Number(seed?.['value'] ?? 0);
              const { label, color } = getSeedDescription(val);

              const nameA = String(characters[a]?.['displayName'] || a);
              const nameB = String(characters[b]?.['displayName'] || b);

              return (
                <div
                  key={k}
                  className="rounded-lg border border-purple-900/50 bg-[#140b26] p-4 flex flex-col justify-between space-y-4 hover:border-purple-700/60 transition-colors shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{nameA}</span>
                        <span className="text-purple-400 text-xs font-bold">&harr;</span>
                        <span className="text-sm font-bold text-white">{nameB}</span>
                      </div>
                      <div className="text-[10px] text-purple-400 font-mono mt-0.5">
                        @{a} &bull; @{b}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => studio.deleteAffinitySeed(k)}
                      className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/40"
                      title="Delete affinity seed"
                    >
                      &times;
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-semibold ${color}`}>{label}</span>
                      <span className="font-mono font-bold text-white">
                        {val > 0 ? `+${val}` : val}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={val}
                      onChange={(e) =>
                        studio.setCell('affinitySeeds', k, 'value', Number(e.target.value))
                      }
                      className="w-full accent-purple-500 cursor-pointer"
                    />

                    <div className="flex justify-between text-[9px] text-gray-500 font-mono mt-0.5">
                      <span>-100 (Friction)</span>
                      <span>0 (Neutral)</span>
                      <span>+100 (Synergy)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
            <p className="text-sm">No affinity seeds found matching the current filter.</p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="text-xs text-purple-400 hover:underline"
            >
              Add a new seed pair
            </button>
          </div>
        )}
      </div>

      {/* Add Seed Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-lg border border-purple-500 bg-[#160b24] p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Add Affinity Seed
            </h3>

            {addError && (
              <div className="text-xs text-red-300 bg-red-950/40 p-2 rounded border border-red-900">
                {addError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Role A</label>
                <select
                  value={roleA}
                  onChange={(e) => setRoleA(e.target.value)}
                  className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                >
                  {characterIds.map((id) => (
                    <option key={id} value={id}>
                      {String(characters[id]?.['displayName'] || id)} (@{id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Role B</label>
                <select
                  value={roleB}
                  onChange={(e) => setRoleB(e.target.value)}
                  className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-xs text-purple-100 focus:border-purple-400 focus:outline-none"
                >
                  {characterIds.map((id) => (
                    <option key={id} value={id}>
                      {String(characters[id]?.['displayName'] || id)} (@{id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <label className="font-semibold text-gray-300">Initial Affinity Value</label>
                <span className="font-mono font-bold text-purple-300">
                  {initialValue > 0 ? `+${initialValue}` : initialValue}
                </span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={initialValue}
                onChange={(e) => setInitialValue(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>-100 (Friction)</span>
                <span>0</span>
                <span>+100 (Synergy)</span>
              </div>
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
                Create Seed
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

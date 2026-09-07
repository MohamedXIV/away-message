// src/tools/studio/components/BackstoryEditor.tsx
import React, { useState } from 'react';
import { BACKSTORY_RELATIONSHIP_OPTIONS, CANDIDATE_STATUS_OPTIONS } from '../types';
import type { BuddyBackstory } from '../../../engine/types';

interface Props {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export const BackstoryEditor: React.FC<Props> = ({ data, onChange }) => {
  const relationship = String(data['relationship'] ?? 'acquaintance');
  const label = String(data['label'] ?? '');
  const lapseDays = Number(data['lapseDays'] ?? 0);
  const knowsAccounts = Boolean(data['knowsAccounts'] ?? true);
  const bioSeed = String(data['bioSeed'] ?? '');

  const candidates: Array<{ handle: string; status: BuddyBackstory['candidates'][number]['status']; note?: string }> = (() => {
    try {
      const parsed = JSON.parse(String(data['candidates'] ?? '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const [newHandle, setNewHandle] = useState('');
  const [newStatus, setNewStatus] = useState<BuddyBackstory['candidates'][number]['status']>('active');

  const handleAddCandidate = () => {
    const h = newHandle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!h || candidates.some((c) => c.handle === h)) return;
    const next = [...candidates, { handle: h, status: newStatus }];
    onChange('candidates', JSON.stringify(next));
    setNewHandle('');
  };

  const handleRemoveCandidate = (index: number) => {
    const next = candidates.filter((_, i) => i !== index);
    onChange('candidates', JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Relationship Depth */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Pre-Day-1 Relationship Depth
          </label>
          <select
            value={relationship}
            onChange={(e) => onChange('relationship', e.target.value)}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none capitalize"
          >
            {BACKSTORY_RELATIONSHIP_OPTIONS.map((rel) => (
              <option key={rel} value={rel}>
                {rel}
              </option>
            ))}
          </select>
        </div>

        {/* Days Since Last Contact */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Lapse Days <span className="text-[10px] text-gray-400 font-normal">(days since last contact)</span>
          </label>
          <input
            type="number"
            min="0"
            max="3650"
            value={lapseDays}
            onChange={(e) => onChange('lapseDays', Math.max(0, Number(e.target.value)))}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
          />
        </div>
      </div>

      {/* History Summary Label */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 mb-1">
          Backstory Label <span className="text-[10px] text-gray-400 font-normal">(displayed in memory & inspect)</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => onChange('label', e.target.value)}
          className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
          placeholder="e.g. Met around Oakhaven; quiet but familiar."
        />
      </div>

      {/* Bio Seed */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 mb-1">
          Bio Seed <span className="text-[10px] text-gray-400 font-normal">(sensory keywords for MyPlace generation)</span>
        </label>
        <input
          type="text"
          value={bioSeed}
          onChange={(e) => onChange('bioSeed', e.target.value)}
          className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
          placeholder="e.g. Rain on film, canal static, diner coffee."
        />
      </div>

      {/* Knows Accounts Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="knowsAccounts"
          checked={knowsAccounts}
          onChange={(e) => onChange('knowsAccounts', e.target.checked)}
          className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
        />
        <label htmlFor="knowsAccounts" className="text-xs text-gray-300 font-medium cursor-pointer">
          Player already knows this character's accounts from before Day 1
        </label>
      </div>

      {/* Pre-day 1 Candidate Handles */}
      <div className="rounded border border-purple-900/60 bg-[#160d2e]/40 p-3">
        <label className="block text-xs font-semibold text-gray-300 mb-2">
          Prior Known Online Handles <span className="text-[10px] text-gray-400 font-normal">(e.g. old forum/chat handles)</span>
        </label>

        <div className="space-y-2 mb-3">
          {candidates.map((c, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#130d24] p-2 rounded border border-purple-900/40">
              <span className="text-xs text-purple-200 font-mono flex-1">@{c.handle}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded capitalize font-bold ${
                c.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
              }`}>
                {c.status}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveCandidate(i)}
                className="text-red-400 hover:text-red-300 text-xs px-2 font-bold"
              >
                ×
              </button>
            </div>
          ))}
          {candidates.length === 0 && (
            <div className="text-xs text-gray-500 italic p-1">No past handles stored.</div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            placeholder="handle_name"
            className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-2.5 py-1 text-xs text-purple-100 focus:outline-none font-mono"
          />
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as any)}
            className="rounded bg-[#1a1135] border border-purple-800/60 px-2 py-1 text-xs text-purple-100 capitalize"
          >
            {CANDIDATE_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddCandidate}
            className="rounded bg-purple-800 hover:bg-purple-700 px-3 py-1 text-xs text-white font-semibold"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

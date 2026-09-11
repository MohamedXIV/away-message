// src/tools/studio/components/CharacterIdentityForm.tsx
import React, { useState } from 'react';
import {
  HAIR_COLOR_OPTIONS,
  EYE_COLOR_OPTIONS,
  REACH_OPTIONS,
  LANGUAGE_OPTIONS,
} from '../types';

interface Props {
  characterId: string;
  data: Record<string, unknown>;
  archetypes: string[];
  onChange: (key: string, value: unknown) => void;
}

export const CharacterIdentityForm: React.FC<Props> = ({
  characterId,
  data,
  archetypes,
  onChange,
}) => {
  const [newRoleInput, setNewRoleInput] = useState('');

  // Parse JSON roles array safely
  const roles: string[] = (() => {
    try {
      const parsed = JSON.parse(String(data['roles'] ?? '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Parse JSON languages safely
  const languages: Array<{ lang: string; level: number }> = (() => {
    try {
      const parsed = JSON.parse(String(data['languages'] ?? '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const handleAddRole = () => {
    const clean = newRoleInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!clean || roles.includes(clean)) return;
    const next = [...roles, clean];
    onChange('roles', JSON.stringify(next));
    setNewRoleInput('');
  };

  const handleRemoveRole = (tag: string) => {
    const next = roles.filter((r) => r !== tag);
    onChange('roles', JSON.stringify(next));
  };

  const handleAddLanguage = () => {
    if (languages.length >= 3) return;
    const available = LANGUAGE_OPTIONS.find((l) => !languages.some((x) => x.lang === l)) || 'es';
    const next = [...languages, { lang: available, level: 3 }];
    onChange('languages', JSON.stringify(next));
  };

  const handleUpdateLanguage = (index: number, key: 'lang' | 'level', value: unknown) => {
    const next = languages.map((entry, i) => {
      if (i !== index) return entry;
      return { ...entry, [key]: value };
    });
    onChange('languages', JSON.stringify(next));
  };

  const handleRemoveLanguage = (index: number) => {
    const next = languages.filter((_, i) => i !== index);
    onChange('languages', JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Display Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={String(data['displayName'] ?? '')}
            onChange={(e) => onChange('displayName', e.target.value)}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
            placeholder="e.g. Maya"
          />
        </div>

        {/* Stable Role Anchor */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Role Anchor <span className="text-[10px] text-gray-400 font-normal">(code identity)</span>
          </label>
          <input
            type="text"
            value={String(data['role'] ?? '')}
            onChange={(e) => onChange('role', e.target.value)}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none font-mono"
            placeholder={characterId}
          />
        </div>

        {/* Archetype Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Archetype
          </label>
          <select
            value={String(data['archetypeId'] ?? '')}
            onChange={(e) => onChange('archetypeId', e.target.value)}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none capitalize"
          >
            {archetypes.map((arch) => (
              <option key={arch} value={arch}>
                {arch}
              </option>
            ))}
          </select>
        </div>

        {/* Reach (local vs remote) */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Reach <span className="text-[10px] text-gray-400 font-normal">(town vs online-only)</span>
          </label>
          <div className="flex rounded border border-purple-800/60 overflow-hidden bg-[#130d24]">
            {REACH_OPTIONS.map((r) => {
              const active = (data['reach'] ?? 'local') === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange('reach', r)}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors capitalize ${
                    active ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hair Color */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Hair Color
          </label>
          <select
            value={String(data['hair'] ?? 'brown')}
            onChange={(e) => onChange('hair', e.target.value)}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none capitalize"
          >
            {HAIR_COLOR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* Eye Color */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Eye Color
          </label>
          <select
            value={String(data['eyes'] ?? 'brown')}
            onChange={(e) => onChange('eyes', e.target.value)}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none capitalize"
          >
            {EYE_COLOR_OPTIONS.map((ey) => (
              <option key={ey} value={ey}>
                {ey}
              </option>
            ))}
          </select>
        </div>

        {/* Chat Signature Color */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Chat Signature Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(data['chatColor'] ?? '#6a3fa0')}
              onChange={(e) => onChange('chatColor', e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-purple-700 bg-transparent"
            />
            <input
              type="text"
              value={String(data['chatColor'] ?? '#6a3fa0')}
              onChange={(e) => onChange('chatColor', e.target.value)}
              className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 font-mono focus:border-purple-400 focus:outline-none uppercase"
            />
          </div>
        </div>

        {/* Typing Speed */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-gray-300">
              Typing Speed
            </label>
            <span className="text-xs font-bold text-purple-300">
              {Number(data['typingSpeedWpm'] ?? 60)} WPM
            </span>
          </div>
          <input
            type="range"
            min="30"
            max="140"
            step="5"
            value={Number(data['typingSpeedWpm'] ?? 60)}
            onChange={(e) => onChange('typingSpeedWpm', Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Bio / Voice Summary */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 mb-1">
          Bio / Voice Prompt <span className="text-[10px] text-gray-400 font-normal">(governed AI persona instruction)</span>
        </label>
        <textarea
          rows={3}
          value={String(data['bio'] ?? '')}
          onChange={(e) => onChange('bio', e.target.value)}
          className="w-full rounded bg-[#130d24] border border-purple-800/60 p-3 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
          placeholder="Describe voice, texting habits, punctuation, emotional distance..."
        />
      </div>

      {/* Capability Roles */}
      <div className="rounded border border-purple-900/60 bg-[#160d2e]/40 p-3">
        <label className="block text-xs font-semibold text-gray-300 mb-1">
          Capability Roles <span className="text-[10px] text-gray-400 font-normal">(engine tags queried by simulation)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {roles.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded bg-purple-900/60 border border-purple-700/60 px-2 py-0.5 text-xs text-purple-200"
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleRemoveRole(tag)}
                className="hover:text-red-400 font-bold ml-1"
              >
                ×
              </button>
            </span>
          ))}
          {roles.length === 0 && (
            <span className="text-xs text-gray-500 italic">No capability tags assigned</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRoleInput}
            onChange={(e) => setNewRoleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddRole();
              }
            }}
            placeholder="Add tag (e.g. diner-staff, rain-lover)..."
            className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-2.5 py-1 text-xs text-purple-100 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddRole}
            className="rounded bg-purple-800 hover:bg-purple-700 px-3 py-1 text-xs text-white font-semibold"
          >
            Add
          </button>
        </div>
      </div>

      {/* Languages */}
      <div className="rounded border border-purple-900/60 bg-[#160d2e]/40 p-3">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-gray-300">
            Languages Spoken <span className="text-[10px] text-gray-400 font-normal">(1..3 languages)</span>
          </label>
          {languages.length < 3 && (
            <button
              type="button"
              onClick={handleAddLanguage}
              className="text-xs text-purple-300 hover:text-purple-100 font-semibold"
            >
              + Add Language
            </button>
          )}
        </div>
        <div className="space-y-2">
          {languages.map((l, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-[#130d24] p-2 rounded border border-purple-900/40">
              <select
                value={l.lang}
                onChange={(e) => handleUpdateLanguage(idx, 'lang', e.target.value)}
                className="rounded bg-[#1a1135] border border-purple-800/60 px-2 py-1 text-xs text-purple-100 uppercase"
              >
                {LANGUAGE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Level:</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={l.level}
                  onChange={(e) => handleUpdateLanguage(idx, 'level', Number(e.target.value))}
                  className="flex-1 accent-purple-500"
                />
                <span className="text-xs font-bold text-purple-300 w-4">{l.level}</span>
              </div>

              {languages.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveLanguage(idx)}
                  className="text-red-400 hover:text-red-300 text-xs px-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

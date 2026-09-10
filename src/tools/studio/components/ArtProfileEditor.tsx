// src/tools/studio/components/ArtProfileEditor.tsx
import React, { useState } from 'react';
import { ART_ENGINE_OPTIONS } from '../types';

interface Props {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export const ArtProfileEditor: React.FC<Props> = ({ data, onChange }) => {
  const engine = String(data['engine'] ?? 'none');
  const modelPath = String(data['modelPath'] ?? '');
  const defaultOutfit = String(data['defaultOutfit'] ?? 'default');

  const expressions: Record<string, string> = (() => {
    try {
      const parsed = JSON.parse(String(data['expressions'] ?? '{}'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  })();

  const [newExpKey, setNewExpKey] = useState('');
  const [newExpAnim, setNewExpAnim] = useState('');

  const handleAddExpression = () => {
    const k = newExpKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const a = newExpAnim.trim();
    if (!k || !a) return;
    const next = { ...expressions, [k]: a };
    onChange('expressions', JSON.stringify(next));
    setNewExpKey('');
    setNewExpAnim('');
  };

  const handleRemoveExpression = (k: string) => {
    const next = { ...expressions };
    delete next[k];
    onChange('expressions', JSON.stringify(next));
  };

  const handleUpdateExpression = (k: string, val: string) => {
    const next = { ...expressions, [k]: val };
    onChange('expressions', JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-purple-900/60 bg-[#160d2e]/30 p-3 text-xs text-purple-200">
        <span className="font-semibold text-purple-300">Live2D & Character Art Architecture:</span> Local
        in-town characters use rigged 2D models (breathing, hair animation, clothing physics) driven by
        live mood expressions. Remote online-only contacts set engine to <code>none</code> and use dynamic
        mood chat avatars chosen by AI.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Engine selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Animation Engine
          </label>
          <div className="flex rounded border border-purple-800/60 overflow-hidden bg-[#130d24]">
            {ART_ENGINE_OPTIONS.map((opt) => {
              const active = engine === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange('engine', opt)}
                  className={`flex-1 py-1.5 text-xs font-semibold uppercase transition-colors ${
                    active ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Default Outfit */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Default Outfit Identifier
          </label>
          <input
            type="text"
            value={defaultOutfit}
            onChange={(e) => onChange('defaultOutfit', e.target.value)}
            className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
            placeholder="e.g. cart_apron, cafe_casual"
          />
        </div>
      </div>

      {/* Model File Path */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 mb-1">
          Model Path <span className="text-[10px] text-gray-400 font-normal">(.model3.json or mesh asset path)</span>
        </label>
        <input
          type="text"
          value={modelPath}
          onChange={(e) => onChange('modelPath', e.target.value)}
          disabled={engine === 'none'}
          className="w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 font-mono focus:border-purple-400 focus:outline-none disabled:opacity-40"
          placeholder="assets/models/character/character.model3.json"
        />
      </div>

      {/* Expressions Map */}
      <div className="rounded border border-purple-900/60 bg-[#160d2e]/40 p-3">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-gray-300">
            Expression Motion Mappings <span className="text-[10px] text-gray-400 font-normal">(mood &rarr; animation name)</span>
          </label>
        </div>

        <div className="space-y-2 mb-3">
          {Object.entries(expressions).map(([k, anim]) => (
            <div key={k} className="flex items-center gap-2 bg-[#130d24] p-2 rounded border border-purple-900/40">
              <span className="w-24 text-xs font-bold text-purple-300 font-mono capitalize">{k}</span>
              <span className="text-gray-500 text-xs">&rarr;</span>
              <input
                type="text"
                value={anim}
                onChange={(e) => handleUpdateExpression(k, e.target.value)}
                className="flex-1 rounded bg-[#1a1135] border border-purple-800/60 px-2 py-1 text-xs text-purple-100 font-mono"
              />
              <button
                type="button"
                onClick={() => handleRemoveExpression(k)}
                className="text-red-400 hover:text-red-300 text-xs px-2 font-bold"
              >
                ×
              </button>
            </div>
          ))}
          {Object.keys(expressions).length === 0 && (
            <div className="text-xs text-gray-500 italic p-2 text-center">
              No expressions registered for this model.
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newExpKey}
            onChange={(e) => setNewExpKey(e.target.value)}
            placeholder="Mood key (e.g. smile, shy, tired)"
            className="w-1/3 rounded bg-[#130d24] border border-purple-800/60 px-2.5 py-1 text-xs text-purple-100 focus:outline-none"
          />
          <input
            type="text"
            value={newExpAnim}
            onChange={(e) => setNewExpAnim(e.target.value)}
            placeholder="Animation/Expression file (e.g. exp_smile)"
            className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-2.5 py-1 text-xs text-purple-100 focus:outline-none font-mono"
          />
          <button
            type="button"
            onClick={handleAddExpression}
            className="rounded bg-purple-800 hover:bg-purple-700 px-3 py-1 text-xs text-white font-semibold"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

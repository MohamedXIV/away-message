import React, { useState } from 'react';
import { parseSemanticList } from '../physicalDefinitionAuthoring';

interface TagListEditorProps {
  label: string;
  tagsJson: unknown;
  onChange: (jsonString: string) => void;
  placeholder?: string;
  fieldErrorDisplay?: React.ReactNode;
}

export const TagListEditor: React.FC<TagListEditorProps> = ({
  label,
  tagsJson,
  onChange,
  placeholder = 'Add tag...',
  fieldErrorDisplay,
}) => {
  const [draft, setDraft] = useState('');
  const tags = parseSemanticList(String(tagsJson ?? '[]'));

  const handleAdd = (text: string) => {
    const rawTokens = text.split(',').map((t) => t.trim()).filter(Boolean);
    if (rawTokens.length === 0) return;
    const next = [...tags];
    for (const token of rawTokens) {
      if (!next.includes(token)) {
        next.push(token);
      }
    }
    onChange(JSON.stringify(next));
    setDraft('');
  };

  const handleRemove = (index: number) => {
    const next = tags.filter((_, i) => i !== index);
    onChange(JSON.stringify(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd(draft);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-purple-300">{label}</label>

      <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] p-1.5 rounded bg-[#130d24] border border-purple-800/60 focus-within:border-purple-600">
        {tags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1.5 rounded bg-purple-900/60 border border-purple-700/50 px-2 py-0.5 text-xs text-purple-200 font-mono"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-purple-400 hover:text-red-300 font-bold ml-0.5 leading-none"
              aria-label={`Remove tag ${tag}`}
            >
              &times;
            </button>
          </span>
        ))}

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) handleAdd(draft);
          }}
          placeholder={tags.length === 0 ? placeholder : '+ add tag'}
          className="flex-1 min-w-[100px] bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none px-1 py-0.5 font-mono"
          aria-label={label}
        />
      </div>

      {fieldErrorDisplay}
    </div>
  );
};

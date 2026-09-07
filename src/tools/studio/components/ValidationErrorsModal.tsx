// src/tools/studio/components/ValidationErrorsModal.tsx
import React from 'react';

interface Props {
  errors: string[];
  isOpen: boolean;
  onClose: () => void;
}

export const ValidationErrorsModal: React.FC<Props> = ({ errors, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-lg border border-red-500/80 bg-[#160b24] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-500/40 bg-red-950/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-400 font-bold text-xs">
              !
            </span>
            <h2 className="text-sm font-bold text-red-200">
              Content Validation Issues ({errors.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          <p className="text-xs text-gray-300">
            The following constraints were violated. Fix these before exporting to ensure the game engine and codegen pipeline remain fully valid:
          </p>
          <div className="space-y-1.5 mt-2">
            {errors.map((err, idx) => (
              <div
                key={idx}
                className="rounded border border-red-900/60 bg-red-950/20 px-3 py-2 text-xs font-mono text-red-300"
              >
                {err}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-purple-900/40 bg-[#12071f] px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-purple-700 hover:bg-purple-600 px-4 py-1.5 text-xs font-bold text-white shadow"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

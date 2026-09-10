import React from 'react';
import { EMOTICON_LIST } from '../utils/emoticonParser';
import { useSimulationStore } from '../../../store/useSimulationStore';

interface EmoticonPaletteProps {
  isOpen: boolean;
  onSelectEmoticon: (code: string) => void;
  onClose: () => void;
}

export const EmoticonPalette: React.FC<EmoticonPaletteProps> = ({
  isOpen,
  onSelectEmoticon,
  onClose,
}) => {
  const isOrion60 = useSimulationStore((s) => s.state.os.currentOsId === 'Orion_6.0');

  if (!isOpen) return null;

  const available = EMOTICON_LIST.filter((e) => !e.isOrion60Only || isOrion60);

  return (
    <div className="absolute bottom-12 right-4 bg-white border-2 border-gray-400 p-2 rounded shadow-2xl z-40 w-56 grid grid-cols-6 gap-1">
      {available.map((emoticon) => (
        <button
          key={emoticon.code}
          onClick={() => {
            onSelectEmoticon(emoticon.code);
            onClose();
          }}
          className="p-1 hover:bg-blue-100 rounded text-base cursor-pointer flex items-center justify-center"
          title={`${emoticon.label} (${emoticon.code})`}
        >
          {emoticon.glyph}
        </button>
      ))}
    </div>
  );
};

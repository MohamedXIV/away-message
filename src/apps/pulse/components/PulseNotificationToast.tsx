import React from 'react';
import { PulseNotification } from '../types';
import { useWindowStore } from '../../../store/useWindowStore';
import { useSimulationStore } from '../../../store/useSimulationStore';

interface PulseNotificationToastProps {
  toast: PulseNotification;
  onDismiss: (id: string) => void;
  onOpenChat: (buddyId: string) => void;
}

export const PulseNotificationToast: React.FC<PulseNotificationToastProps> = ({
  toast,
  onDismiss,
  onOpenChat,
}) => {
  const isOrion60 = useSimulationStore((s) => s.state.os.currentOsId === 'Orion_6.0');
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);

  const handleClick = () => {
    restoreWindow('pulse');
    focusWindow('pulse');
    onOpenChat(toast.buddyId);
    onDismiss(toast.id);
  };

  return (
    <div
      onClick={handleClick}
      className={`fixed bottom-10 right-4 z-50 p-3 rounded shadow-2xl border cursor-pointer max-w-xs w-full transition-transform transform hover:-translate-y-1 ${
        isOrion60
          ? 'bg-[#e8f1fc] border-blue-400 text-blue-950'
          : 'bg-[#fffbe6] border-yellow-500 text-gray-900'
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5 font-bold text-xs">
          <span>💬</span>
          <span>IM from {toast.buddyName}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className="text-gray-400 hover:text-black font-bold text-xs"
        >
          ✕
        </button>
      </div>
      <p className="text-xs truncate italic text-gray-700">"{toast.textSnippet}"</p>
      <span className="text-[10px] text-gray-500 block text-right mt-1">{toast.timestamp}</span>
    </div>
  );
};

import { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { useWindowStore } from '../../../store/useWindowStore';
import { PulseNotification } from '../types';

export function usePulseNotifications(activeTabBuddyId: string | null) {
  const conversations = useSimulationStore((s) => s.state.social.conversations);
  const engine = useSimulationStore((s) => s.engine);
  const windows = useWindowStore((s) => s.windows);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);

  const [activeToasts, setActiveToasts] = useState<PulseNotification[]>([]);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      Object.values(conversations).forEach((msgs) => {
        msgs.forEach((m) => seenMessageIds.current.add(m.id));
      });
      isInitialMount.current = false;
      return;
    }

    const pulseWin = windows['pulse'];
    const isPulseInactive = !pulseWin || !pulseWin.isOpen || pulseWin.isMinimized || activeWindowId !== 'pulse';

    Object.entries(conversations).forEach(([buddyId, msgs]) => {
      msgs.forEach((msg) => {
        if (!seenMessageIds.current.has(msg.id)) {
          seenMessageIds.current.add(msg.id);

          if (msg.senderId !== 'player' && (isPulseInactive || activeTabBuddyId !== buddyId)) {
            const buddy = engine.social.getBuddy(buddyId);
            const newToast: PulseNotification = {
              id: 'toast_' + msg.id,
              buddyId,
              buddyName: buddy?.displayName || buddyId,
              buddyHandle: buddy?.handle || buddyId,
              avatarUrl: undefined,
              textSnippet: msg.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: Date.now(),
            };

            setActiveToasts((prev) => [...prev.slice(-2), newToast]);
          }
        }
      });
    });
  }, [conversations, windows, activeWindowId, activeTabBuddyId, engine]);

  const dismissToast = (toastId: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  return { activeToasts, dismissToast };
}

import { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { useWindowStore } from '../../../store/useWindowStore';
import { soundManager } from '../../../audio/SoundManager';
import { PulseNotification } from '../types';

export function usePulseNotifications(activeTabBuddyId: string | null) {
  const engine = useSimulationStore((s) => s.engine);
  const windows = useWindowStore((s) => s.windows);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);

  const [activeToasts, setActiveToasts] = useState<PulseNotification[]>([]);
  const seenMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // #172: listen to source events rather than scanning every saved message
    // across every conversation after each simulation revision.
    const off = engine.events.on('social:message_received', ({ message: msg }) => {
      if (seenMessageIds.current.has(msg.id)) return;
      seenMessageIds.current.add(msg.id);
      if (seenMessageIds.current.size > 1024) {
        const oldestId = seenMessageIds.current.values().next().value;
        if (oldestId) seenMessageIds.current.delete(oldestId);
      }
      if (msg.senderId === 'player') return;
      const buddyId = msg.conversationId;
      // The source event is private simulation truth. Only a learned contact
      // may generate a player-visible toast, text snippet or audible buzz.
      if (!engine.social.isKnown(buddyId)) return;

      if ((msg.tags ?? []).includes('buzz')) {
        try { soundManager.play('buzz'); } catch { /* best effort */ }
        try { window.dispatchEvent(new CustomEvent('pulse:buzz')); } catch { /* best effort */ }
      }
      const pulseWin = windows['pulse'];
      const isPulseInactive = !pulseWin || !pulseWin.isOpen || pulseWin.isMinimized || activeWindowId !== 'pulse';
      if (!isPulseInactive && activeTabBuddyId === buddyId) return;
      const buddy = engine.social.getBuddy(buddyId);
      setActiveToasts(prev => [...prev.slice(-2), {
        id: 'toast_' + msg.id,
        buddyId,
        buddyName: buddy?.displayName || buddyId,
        buddyHandle: buddy?.handle || buddyId,
        avatarUrl: undefined,
        textSnippet: msg.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: Date.now(),
      }]);
    });
    return off;
  }, [engine, windows, activeWindowId, activeTabBuddyId]);

  const dismissToast = (toastId: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  return { activeToasts, dismissToast };
}

import React, { useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useSimulationChrome } from '../store/useBoundedSimulationRead';
import { useWindowStore } from '../store/useWindowStore';
import { soundManager } from '../audio/SoundManager';
import { SystemTrayChrome } from './SystemTrayChrome';

interface SystemTrayProps { onOpenDialUp: () => void; }

/** Legacy synchronous event adapter. Worker imports only SystemTrayChrome. */
export const SystemTray: React.FC<SystemTrayProps> = props => {
  const chrome = useSimulationChrome();
  const engine = useSimulationStore(s => s.engine);
  const windows = useWindowStore(s => s.windows);
  const activeWindowId = useWindowStore(s => s.activeWindowId);
  // Preserve the legacy event-driven sound contract: unread UI changes or
  // cold reloads must not replay a received message notification.
  useEffect(() => engine.events.on('social:message_received', ({ message }) => {
    if (message.senderId === 'player') return;
    const pulseWin = Object.values(windows).find(w => !!w && String(w.appId).includes('pulse'));
    const hidden = !pulseWin || !pulseWin.isOpen || pulseWin.isMinimized || pulseWin.id !== activeWindowId;
    if (hidden) soundManager.play('im_recv');
  }), [engine, windows, activeWindowId]);
  return <SystemTrayChrome {...props} chrome={chrome} />;
};

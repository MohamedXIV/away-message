import React, { useEffect, useMemo } from 'react';
import { useWindowStore, type WindowState } from '../store/useWindowStore';

/** Pure UI window lifecycle and geometry, shared by legacy and Worker desktops.
 * Do not import any game app or synchronous simulation owner into this file.
 */
export interface AppRegistryProps { window: WindowState }
export interface WindowManagerChromeProps {
  renderApp: (window: WindowState) => React.ReactNode;
  renderFrame: (window: WindowState, isActive: boolean, children: React.ReactNode) => React.ReactNode;
}

export const WindowManagerChrome: React.FC<WindowManagerChromeProps> = ({ renderApp, renderFrame }) => {
  const windows = useWindowStore((s) => s.windows);
  const windowOrder = useWindowStore((s) => s.windowOrder);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const closeOrTrayWindow = useWindowStore((s) => s.closeOrTrayWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);

  // Filter open, non-minimized windows sorted by Z-Index
  const visibleWindows = useMemo(() => {
    return windowOrder
      .map((id) => windows[id])
      .filter((w): w is WindowState => !!w && w.isOpen && !w.isMinimized)
      .sort((a, b) => a.zIndex - b.zIndex);
  }, [windows, windowOrder]);

  // Global Keyboard Shortcuts (Alt+F4 to close, Alt+Tab cycling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F4' && activeWindowId) {
        e.preventDefault();
        closeOrTrayWindow(activeWindowId);
      } else if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        if (visibleWindows.length > 1) {
          const currentIndex = visibleWindows.findIndex((w) => w.id === activeWindowId);
          const nextIndex = (currentIndex + 1) % visibleWindows.length;
          const nextWin = visibleWindows[nextIndex];
          if (nextWin) focusWindow(nextWin.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWindowId, visibleWindows, closeOrTrayWindow, focusWindow]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" id="window-manager-root">
      {visibleWindows.map((win) => {
        const app = renderApp(win);
        const isActive = activeWindowId === win.id;

        // Frameless windows (Pulse) — draggable via header, with custom chrome
        if (win.isFrameless) {
          return (
            <div
              key={win.id}
              className="pointer-events-auto absolute"
              style={{
                left: win.position.x,
                top: win.position.y,
                width: win.size.width,
                height: win.size.height,
                zIndex: win.zIndex,
              }}
              onMouseDown={() => focusWindow(win.id)}
            >
              <div className={`w-full h-full overflow-hidden shadow-2xl border flex flex-col ${isActive ? 'border-[#38516e]' : 'border-gray-500'} `}>
                {/* Custom frameless title bar — drag handle + window controls */}
                <div
                  className={`h-6 flex items-center justify-between px-2 text-white text-xs font-bold select-none ${isActive ? 'bg-[#27456d]' : 'bg-gray-600'}`}
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startPos = { ...win.position };
                    const onMove = (ev: MouseEvent) => {
                      const dx = ev.clientX - startX;
                      const dy = ev.clientY - startY;
                      const { setWindowPosition } = useWindowStore.getState();
                      setWindowPosition(win.id, { x: startPos.x + dx, y: startPos.y + dy });
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                >
                  <span className="flex items-center gap-1.5 truncate"><span>💬</span> {win.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); const { minimizeWindow } = useWindowStore.getState(); minimizeWindow(win.id); }}
                      className="w-5 h-4 bg-[#d7d7d7] hover:bg-[#e8e8e8] text-black text-[10px] leading-none border border-gray-400"
                      title="Minimize"
                    >
                      _
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                      className="w-5 h-4 bg-[#c0392b] hover:bg-[#e74c3c] text-white text-[10px] leading-none border border-gray-400"
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden bg-white">
                  {app}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={win.id} className="pointer-events-auto">
            {/* Modal Backdrop if window is modal */}
            {win.isModal && isActive && (
              <div
                style={{ zIndex: win.zIndex - 1 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-auto"
              />
            )}

            {renderFrame(win, isActive, app)}
          </div>
        );
      })}
    </div>
  );
};

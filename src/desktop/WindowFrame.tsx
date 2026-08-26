import React, { useRef, useCallback, memo } from 'react';
import { WindowState, useWindowStore } from '../store/useWindowStore';
import { useHardwareState } from '../store/useSimulationStore';

export interface WindowFrameProps {
  window: WindowState;
  isActive: boolean;
  children: React.ReactNode;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const WindowFrame: React.FC<WindowFrameProps> = memo(({ window: winState, isActive, children }) => {
  const hardware = useHardwareState();
  const isOrion6 = hardware.osVersion === 'Orion_6.0';
  const frameRef = useRef<HTMLDivElement>(null);

  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const setWindowPosition = useWindowStore((s) => s.setWindowPosition);
  const setWindowSize = useWindowStore((s) => s.setWindowSize);

  // Dragging Titlebar Handler
  const handleTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // Left click only
      if (winState.isMaximized) return;

      focusWindow(winState.id);

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = winState.position.x;
      const startPosY = winState.position.y;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        // Desktop bounds clamping
        const maxW = typeof globalThis.innerWidth !== 'undefined' ? globalThis.innerWidth : 1920;
        const newX = Math.max(-winState.size.width + 100, Math.min(maxW - 100, startPosX + deltaX));
        const newY = Math.max(0, startPosY + deltaY);

        setWindowPosition(winState.id, { x: newX, y: newY });
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        try {
          target.releasePointerCapture(upEvent.pointerId);
        } catch {}
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [winState.id, winState.position, winState.size, winState.isMaximized, focusWindow, setWindowPosition]
  );

  // Resizing Handler
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, direction: ResizeDirection) => {
      if (e.button !== 0) return;
      if (winState.isMaximized || !winState.isResizable) return;

      e.stopPropagation();
      focusWindow(winState.id);

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = winState.position.x;
      const startPosY = winState.position.y;
      const startWidth = winState.size.width;
      const startHeight = winState.size.height;
      const minW = winState.minSize.width;
      const minH = winState.minSize.height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newX = startPosX;
        let newY = startPosY;
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction.includes('e')) {
          newWidth = Math.max(minW, startWidth + deltaX);
        }
        if (direction.includes('s')) {
          newHeight = Math.max(minH, startHeight + deltaY);
        }
        if (direction.includes('w')) {
          const maxDeltaW = startWidth - minW;
          const clampedDeltaX = Math.min(maxDeltaW, deltaX);
          newWidth = startWidth - clampedDeltaX;
          newX = startPosX + clampedDeltaX;
        }
        if (direction.includes('n')) {
          const maxDeltaH = startHeight - minH;
          const clampedDeltaY = Math.min(maxDeltaH, deltaY);
          newHeight = startHeight - clampedDeltaY;
          newY = Math.max(0, startPosY + clampedDeltaY);
        }

        setWindowPosition(winState.id, { x: newX, y: newY });
        setWindowSize(winState.id, { width: newWidth, height: newHeight });
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        try {
          target.releasePointerCapture(upEvent.pointerId);
        } catch {}
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [winState.id, winState.position, winState.size, winState.minSize, winState.isMaximized, winState.isResizable, focusWindow, setWindowPosition, setWindowSize]
  );

  // Maximized vs Normal Style calculation
  const frameStyle: React.CSSProperties = winState.isMaximized
    ? {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: isOrion6 ? 'calc(100% - 32px)' : 'calc(100% - 28px)',
        zIndex: winState.zIndex,
      }
    : {
        position: 'absolute',
        left: `${winState.position.x}px`,
        top: `${winState.position.y}px`,
        width: `${winState.size.width}px`,
        height: `${winState.size.height}px`,
        zIndex: winState.zIndex,
      };

  return (
    <div
      ref={frameRef}
      style={frameStyle}
      onPointerDown={() => focusWindow(winState.id)}
      className={`window-frame flex flex-col select-none ${
        isOrion6
          ? 'rounded-t-lg bg-[#ece9d8] border border-[#0055ea]/60 shadow-2xl'
          : 'bg-[#c0c0c0] p-[3px] shadow-orion-window'
      }`}
    >
      {/* Titlebar */}
      <div
        onPointerDown={handleTitlePointerDown}
        onDoubleClick={() => toggleMaximize(winState.id)}
        className={`flex items-center justify-between px-2 py-1 cursor-default ${
          isOrion6
            ? `rounded-t-md text-white font-sans ${
                isActive
                  ? 'bg-gradient-to-r from-[#0055ea] via-[#0b60ff] to-[#0040cc] font-semibold'
                  : 'bg-gradient-to-r from-[#7c97b9] to-[#607797] text-gray-200'
              }`
            : `text-xs font-pixel ${
                isActive
                  ? 'bg-[#000080] text-white font-bold'
                  : 'bg-[#808080] text-[#c0c0c0]'
              }`
        }`}
      >
        {/* App Icon & Title */}
        <div className="flex items-center gap-1.5 overflow-hidden pr-2">
          <span className="text-sm shrink-0">{winState.icon}</span>
          <span className="truncate text-xs tracking-wide">{winState.title}</span>
        </div>

        {/* Title Bar Buttons */}
        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {/* Minimize Button */}
          <button
            onClick={() => minimizeWindow(winState.id)}
            title="Minimize"
            className={
              isOrion6
                ? 'w-5 h-5 rounded bg-[#0055ea] hover:bg-[#2070ff] text-white flex items-center justify-center text-xs font-bold border border-white/40'
                : 'w-4 h-4 bg-[#c0c0c0] active:shadow-orion-inset shadow-orion-outset text-black flex items-center justify-center text-[10px] font-bold leading-none'
            }
          >
            _
          </button>

          {/* Maximize / Restore Button */}
          {winState.isResizable && (
            <button
              onClick={() => toggleMaximize(winState.id)}
              title={winState.isMaximized ? 'Restore' : 'Maximize'}
              className={
                isOrion6
                  ? 'w-5 h-5 rounded bg-[#0055ea] hover:bg-[#2070ff] text-white flex items-center justify-center text-xs font-bold border border-white/40'
                  : 'w-4 h-4 bg-[#c0c0c0] active:shadow-orion-inset shadow-orion-outset text-black flex items-center justify-center text-[10px] font-bold leading-none'
              }
            >
              {winState.isMaximized ? '❐' : '□'}
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={() => closeWindow(winState.id)}
            title="Close"
            className={
              isOrion6
                ? 'w-5 h-5 rounded bg-[#d32f2f] hover:bg-[#f44336] text-white flex items-center justify-center text-xs font-bold border border-white/40'
                : 'w-4 h-4 bg-[#c0c0c0] active:shadow-orion-inset shadow-orion-outset text-black flex items-center justify-center text-[10px] font-bold leading-none ml-0.5'
            }
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Body Container */}
      <div
        className={`flex-1 overflow-auto relative ${
          isOrion6
            ? 'bg-white rounded-b-md m-1'
            : 'bg-white shadow-orion-inset m-1'
        }`}
      >
        {children}
      </div>

      {/* Resize Handles (8 directions, active only when not maximized and resizable) */}
      {!winState.isMaximized && winState.isResizable && (
        <>
          {/* North */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'n')}
            className="absolute top-0 left-2 right-2 h-1 cursor-n-resize"
          />
          {/* South */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
            className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize"
          />
          {/* West */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'w')}
            className="absolute top-2 bottom-2 left-0 w-1 cursor-w-resize"
          />
          {/* East */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
            className="absolute top-2 bottom-2 right-0 w-1 cursor-e-resize"
          />
          {/* North-West */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
            className="absolute top-0 left-0 w-2 h-2 cursor-nwse-resize z-10"
          />
          {/* North-East */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
            className="absolute top-0 right-0 w-2 h-2 cursor-nesw-resize z-10"
          />
          {/* South-West */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
            className="absolute bottom-0 left-0 w-2 h-2 cursor-nesw-resize z-10"
          />
          {/* South-East */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
            className="absolute bottom-0 right-0 w-2 h-2 cursor-nwse-resize z-10"
          />
        </>
      )}
    </div>
  );
});

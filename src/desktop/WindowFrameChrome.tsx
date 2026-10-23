import React, { useRef, useCallback, useState, memo } from 'react';
import { useWindowStore, type WindowState } from '../store/useWindowStore';
import type { OsVersion } from '../engine/types';
import { getOsPresentationProfile, resolveWindowTransition } from './host/OsPresentation';
import { synthAudio } from '../audio/SynthAudio';

export interface WindowFrameChromeProps {
  window: WindowState;
  isActive: boolean;
  osVersion: OsVersion | null;
  children: React.ReactNode;
  /** Identifies windows in the staged Worker integration without extra DOM wrappers. */
  testId?: string;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type PendingExitAction = 'close' | 'minimize';

/** Shared authored desktop window chrome. Its props are presentation-only;
 * legacy and Worker runtimes inject OS identity independently. This file
 * must never import the synchronous simulation store or OsHostProvider.
 */
export const WindowFrameChrome: React.FC<WindowFrameChromeProps> = memo(({ window: winState, isActive, osVersion, testId, children }) => {
  const osPresentation = osVersion ? getOsPresentationProfile(osVersion) : null;
  const reducedMotion =
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [pendingExitAction, setPendingExitAction] = useState<PendingExitAction | null>(null);
  const defaultWindowOpenTransition = osPresentation
    ? resolveWindowTransition(osPresentation, 'open', reducedMotion)
    : undefined;
  const windowOpenTransition = pendingExitAction && osPresentation
    ? resolveWindowTransition(osPresentation, pendingExitAction, reducedMotion)
    : defaultWindowOpenTransition;
  const frameRef = useRef<HTMLDivElement>(null);

  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeOrTrayWindow = useWindowStore((s) => s.closeOrTrayWindow);
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
    [winState.id, winState.position, winState.size, winState.isMaximized, focusWindow, setWindowPosition],
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

        if (direction.includes('e')) newWidth = Math.max(minW, startWidth + deltaX);
        if (direction.includes('s')) newHeight = Math.max(minH, startHeight + deltaY);
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
    [winState.id, winState.position, winState.size, winState.minSize, winState.isMaximized, winState.isResizable, focusWindow, setWindowPosition, setWindowSize],
  );

  const taskbarHeightPx = osPresentation?.shell.taskbarHeightPx ?? 28;
  // Desktop is sometimes a contained, 570px-high Worker surface rather than
  // the whole browser. A cascaded window must not leave its footer UNDER the
  // taskbar: keeping a scrollable viewport is preferable to clipping controls.
  // All geometry is presentation-only; persisted window positions remain intact.
  const safeTop = `clamp(0px, ${winState.position.y}px, calc(100% - ${taskbarHeightPx + 160}px))`;
  const frameStyle: React.CSSProperties = winState.isMaximized
    ? {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: `calc(100% - ${taskbarHeightPx}px)`,
        zIndex: winState.zIndex,
        fontFamily: osPresentation?.uiFontStack,
        fontSize: osPresentation ? `${osPresentation.baseFontSizePx}px` : undefined,
      }
    : {
        position: 'absolute',
        left: `${winState.position.x}px`,
        top: safeTop,
        width: `${winState.size.width}px`,
        height: `${winState.size.height}px`,
        maxHeight: `calc(100% - ${taskbarHeightPx}px - ${safeTop})`,
        zIndex: winState.zIndex,
        fontFamily: osPresentation?.uiFontStack,
        fontSize: osPresentation ? `${osPresentation.baseFontSizePx}px` : undefined,
      };

  const commitExitAction = (action: PendingExitAction) => {
    if (action === 'minimize') {
      minimizeWindow(winState.id);
    } else {
      closeOrTrayWindow(winState.id);
    }
  };

  const beginExitAction = (action: PendingExitAction) => {
    if (pendingExitAction) return;

    synthAudio.playWindowSound(action, osPresentation?.soundSchemeId);
    const transition = osPresentation
      ? resolveWindowTransition(osPresentation, action, reducedMotion)
      : 'snap';

    if (transition === 'snap') {
      commitExitAction(action);
      return;
    }

    setPendingExitAction(action);
  };

  const handleLifecycleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !pendingExitAction) return;
    const action = pendingExitAction;
    setPendingExitAction(null);
    commitExitAction(action);
  };

  const handleMinimize = () => {
    beginExitAction('minimize');
  };

  const handleToggleMaximize = () => {
    toggleMaximize(winState.id);
    synthAudio.playWindowSound(winState.isMaximized ? 'restore' : 'open', osPresentation?.soundSchemeId);
  };

  const handleClose = () => {
    beginExitAction('close');
  };

  return (
    <div
      ref={frameRef}
      data-testid={testId}
      style={frameStyle}
      data-os-theme={osPresentation?.themeId}
      data-os-window-chrome={osPresentation?.window.chromeId}
      data-os-window-animation={windowOpenTransition}
      data-os-window-transition-phase={pendingExitAction ? 'exit' : 'enter'}
      onAnimationEnd={handleLifecycleAnimationEnd}
      onPointerDown={() => focusWindow(winState.id)}
      className="window-frame os-themed-window flex flex-col select-none p-[2px]"
    >
      <div
        onPointerDown={handleTitlePointerDown}
        onDoubleClick={handleToggleMaximize}
        data-inactive={!isActive}
        style={{
          fontFamily: osPresentation?.titlebar.fontStack,
          fontWeight: osPresentation?.titlebar.fontWeight,
        }}
        className="os-themed-titlebar flex items-center justify-between px-2 py-0.5 cursor-default select-none"
      >
        <div className="flex items-center gap-1.5 overflow-hidden pr-2">
          <span className="text-sm shrink-0">{winState.icon}</span>
          <span className="truncate text-xs tracking-wide">{winState.title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={handleMinimize}
            title="Minimize"
            aria-label={`Minimize ${winState.title}`}
            className="os-themed-btn w-5 h-5 flex items-center justify-center text-[10px] font-bold leading-none"
          >
            _
          </button>

          {winState.isResizable && (
            <button
              onClick={handleToggleMaximize}
              title={winState.isMaximized ? 'Restore' : 'Maximize'}
              aria-label={`${winState.isMaximized ? 'Restore' : 'Maximize'} ${winState.title}`}
              className="os-themed-btn w-5 h-5 flex items-center justify-center text-[10px] font-bold leading-none"
            >
              {winState.isMaximized ? '❐' : '□'}
            </button>
          )}

          <button
            onClick={handleClose}
            title={String(winState.appId).includes('pulse') && (winState.customState as any)?.pulseSignedIn ? 'Minimize to tray' : 'Close'}
            aria-label={`Close ${winState.title}`}
            className="os-themed-btn w-5 h-5 flex items-center justify-center text-[10px] font-bold leading-none ml-0.5"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto relative bg-white m-0.5 shadow-inner">
        {children}
      </div>

      {!winState.isMaximized && winState.isResizable && (
        <>
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'n')}
            className="absolute top-0 left-2 right-2 h-1 cursor-n-resize"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
            className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'w')}
            className="absolute top-2 bottom-2 left-0 w-1 cursor-w-resize"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
            className="absolute top-2 bottom-2 right-0 w-1 cursor-e-resize"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
            className="absolute top-0 left-0 w-2 h-2 cursor-nwse-resize z-10"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
            className="absolute top-0 right-0 w-2 h-2 cursor-nesw-resize z-10"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
            className="absolute bottom-0 left-0 w-2 h-2 cursor-nesw-resize z-10"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
            className="absolute bottom-0 right-0 w-2 h-2 cursor-nwse-resize z-10"
          />
        </>
      )}
    </div>
  );
});

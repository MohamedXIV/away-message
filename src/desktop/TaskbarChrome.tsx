import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { OsVersion } from '../engine/types';
import { useWindowStore, WindowState } from '../store/useWindowStore';
import { soundManager } from '../audio/SoundManager';
import { getOsPresentationProfile } from './host/OsPresentation';
import { OsIcon } from './OsIcon';
import { X, Minus, Square } from 'lucide-react';

export interface TaskbarChromeProps {
  osVersion: OsVersion | null;
  pulseInstalled: boolean;
  onStepAway: () => void;
  /** Worker route: OS quick-launch uses the same hardware-gated cold start as Start and desktop icons. */
  launchApp?: (appId: string) => void;
  browserAppId?: string;
  renderStartMenu: (close: () => void, isOpen: boolean) => React.ReactNode;
  tray: React.ReactNode;
  contained?: boolean;
  testId?: string;
}

export const TaskbarChrome: React.FC<TaskbarChromeProps> = ({ osVersion, pulseInstalled,
  onStepAway, launchApp, browserAppId = 'browser', renderStartMenu, tray, contained = false, testId,
}) => {
  const osPresentation = osVersion ? getOsPresentationProfile(osVersion) : null;
  const taskbarPresentation = osPresentation?.shell.taskbarId ?? 'classic';
  const taskbarHeight = osPresentation?.shell.taskbarHeightPx ?? 28;
  const windows = useWindowStore((s) => s.windows);
  const windowOrder = useWindowStore((s) => s.windowOrder);
  const openWindows: WindowState[] = useMemo(
    () => windowOrder.map((id) => windows[id]).filter((w): w is WindowState => !!w && w.isOpen),
    [windows, windowOrder]
  );
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const openWindow = useWindowStore((s) => s.openWindow);
  const minimizeAll = useWindowStore((s) => s.minimizeAll);
  const isPulseInstalled = pulseInstalled;

  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{ windowId: string; x: number; y: number } | null>(null);

  const startButtonRef = useRef<HTMLButtonElement>(null);

  const handleStartToggle = () => {
    soundManager.play('click');
    setTabContextMenu(null);
    setIsStartMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (startButtonRef.current && !startButtonRef.current.contains(e.target as Node)) {
        const startMenuEl = document.getElementById('orion-start-menu');
        if (startMenuEl && !startMenuEl.contains(e.target as Node)) {
          setIsStartMenuOpen(false);
        }
      }
      setTabContextMenu(null);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const openTabContextMenu = (event: React.MouseEvent<HTMLButtonElement>, windowId: string) => {
    event.preventDefault();
    const taskbar = event.currentTarget.closest<HTMLElement>('[data-os-taskbar]');
    const rect = taskbar?.getBoundingClientRect();
    setTabContextMenu({
      windowId,
      x: event.clientX - (rect?.left ?? 0),
      y: -92,
    });
  };

  return (
    <>
      {renderStartMenu(() => setIsStartMenuOpen(false), isStartMenuOpen)}

      <div
        data-os-taskbar={taskbarPresentation}
        data-testid={testId}
        aria-label="Taskbar"
        style={{ height: `${taskbarHeight}px` }}
        className={`os-taskbar ${contained ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 z-40 flex w-full select-none items-center`}
      >
        <button
          ref={startButtonRef}
          type="button"
          onClick={handleStartToggle}
          aria-expanded={isStartMenuOpen}
          aria-haspopup="menu"
          className="os-start-button"
        >
          <span className="os-start-flag" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span>Start</span>
        </button>

        <span className="os-taskbar-divider" aria-hidden="true" />

        <div className="os-quick-launch" role="group" aria-label="Quick Launch">
          <button
            type="button"
            onClick={() => minimizeAll()}
            title="Show Desktop"
            aria-label="Show Desktop"
            className="os-quick-button"
          >
            <OsIcon kind="desktop" size={16} />
          </button>
          <button
            type="button"
            onClick={() => { if (launchApp) launchApp(browserAppId); else openWindow(browserAppId); }}
            title="Voyager Browser"
            aria-label="Voyager Browser"
            className="os-quick-button"
          >
            <OsIcon kind="browser" size={16} />
          </button>
          {isPulseInstalled && (
            <button
              type="button"
              onClick={() => { if (launchApp) launchApp('pulse'); else openWindow('pulse'); }}
              title="Pulse Messenger"
              aria-label="Pulse Messenger"
              className="os-quick-button"
            >
              <OsIcon kind="pulse" size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              onStepAway();
            }}
            title="Step Away to Room"
            aria-label="Step Away to Room"
            className="os-quick-button"
          >
            <OsIcon kind="home" size={16} />
          </button>
        </div>

        <span className="os-taskbar-divider" aria-hidden="true" />

        <div className="os-task-buttons" role="group" aria-label="Open windows">
          {openWindows.map((win) => {
            const isActive = activeWindowId === win.id && !win.isMinimized;
            return (
              <button
                key={win.id}
                type="button"
                aria-label={'Taskbar ' + win.title}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => {
                  soundManager.play('click');
                  if (win.isMinimized) {
                    restoreWindow(win.id);
                    focusWindow(win.id);
                  } else if (isActive) {
                    minimizeWindow(win.id);
                  } else {
                    focusWindow(win.id);
                  }
                }}
                onContextMenu={(event) => openTabContextMenu(event, win.id)}
                className="os-task-button"
              >
                <OsIcon appId={win.appId} size={14} />
                <span className="os-task-button-label">{win.title}</span>
              </button>
            );
          })}
        </div>

        {tabContextMenu && (
          <div
            className="os-context-menu absolute z-50"
            style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="os-context-item"
              onClick={() => {
                minimizeWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <Minus className="h-3 w-3" />
              <span>Minimize</span>
            </button>
            <button
              type="button"
              className="os-context-item"
              onClick={() => {
                restoreWindow(tabContextMenu.windowId);
                focusWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <Square className="h-3 w-3" />
              <span>Restore</span>
            </button>
            <div className="os-start-separator" />
            <button
              type="button"
              className="os-context-item font-bold"
              onClick={() => {
                closeWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <X className="h-3 w-3" />
              <span>Close</span>
            </button>
          </div>
        )}

        {tray}
      </div>
    </>
  );
};

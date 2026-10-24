import React, { useEffect, useRef, useState } from 'react';
import type { OsVersion } from '../engine/types';
import { getReleaseById } from '../engine/OsCatalog';
import { soundManager } from '../audio/SoundManager';
import { getOsPresentationProfile } from './host/OsPresentation';
import { OsIcon } from './OsIcon';
import { User } from 'lucide-react';

export interface StartMenuChromeProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDialUp: () => void;
  osVersion: OsVersion | null;
  pulseInstalled: boolean;
  launchApp: (appId: string, customState?: Record<string, unknown>) => void;
  /** Computer power is not player sleep/rest. */
  onPowerAction: (choice: 'shutdown' | 'restart') => void;
  availableApps?: readonly string[];
  resolveAppId?: (appId: string) => string | null;
  /** Optional bounded installed-app roster for Worker-owned desktop. */
  installedPrograms?: ReadonlyArray<{ id: string; label: string; available: boolean }>;
}

export const StartMenuChrome: React.FC<StartMenuChromeProps> = ({
  isOpen, onClose, onOpenDialUp, osVersion, pulseInstalled,
  launchApp, onPowerAction, availableApps, resolveAppId, installedPrograms,
}) => {
  const osPresentation = osVersion ? getOsPresentationProfile(osVersion) : null;
  const startMenuPresentation = osPresentation?.shell.startMenuId ?? 'classic';
  const taskbarHeightPx = osPresentation?.shell.taskbarHeightPx ?? 28;
  const release = osVersion ? getReleaseById(osVersion) : null;
  const isCanalStartMenu = startMenuPresentation === 'canal';
  const canLaunch = (id: string) => !availableApps || availableApps.includes(id);
  // Pulse never ships with the OS — its menu entry appears only after install.
  const isPulseInstalled = pulseInstalled;

  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'programs' | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isShutDownDialogOpen, setIsShutDownDialogOpen] = useState(false);
  const [powerChoice, setPowerChoice] = useState<'shutdown' | 'restart'>('shutdown');
  const [runCommandText, setRunCommandText] = useState('');
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) menuRef.current?.focus();
    else setActiveSubmenu(null);
  }, [isOpen]);

  const handleLaunch = (appId: string, customState?: Record<string, unknown>) => {
    const mapped = canLaunch(appId) ? (resolveAppId ? (resolveAppId(appId) ?? appId) : appId) : null;
    if (!mapped) {
      soundManager.play('error');
      setRunError(`Program not available: ${appId}`);
      return;
    }
    soundManager.play('click');
    launchApp(mapped, customState);
    onClose();
  };

  const handleRunSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = runCommandText.trim().toLowerCase();
    const commandApps: Record<string, string> = {
      notepad: 'notepad', cmd: 'terminal', terminal: 'terminal', browser: 'browser',
      voyager: 'browser', control: 'controlpanel', settings: 'controlpanel',
      explorer: 'fileexplorer', mycomputer: 'fileexplorer', trash: 'trash', addremove: 'addremove',
    };
    if (commandApps[cmd] && !canLaunch(commandApps[cmd])) {
      setRunError(`Program not available: ${cmd}`);
      soundManager.play('error');
      return;
    }
    soundManager.play('click');
    if (cmd === 'notepad') handleLaunch('notepad');
    else if (cmd === 'cmd' || cmd === 'terminal') handleLaunch('terminal');
    else if (cmd === 'browser' || cmd === 'voyager') handleLaunch('browser');
    else if (cmd === 'control' || cmd === 'settings') handleLaunch('controlpanel');
    else if (cmd === 'explorer' || cmd === 'mycomputer') handleLaunch('fileexplorer');
    else if (cmd === 'trash') handleLaunch('trash');
    else if (cmd === 'addremove') handleLaunch('addremove');
    else if (cmd === 'dialup') {
      onOpenDialUp();
      onClose();
    } else if ((cmd.startsWith('http://') || cmd.endsWith('.local')) && canLaunch('browser')) {
      handleLaunch('browser', { initialUrl: cmd });
      setIsRunDialogOpen(false);
      setRunError(null);
      return;
    } else {
      soundManager.play('error');
      setRunError(`Cannot find file or command '${runCommandText}'. Verify name and try again.`);
      return;
    }
    setIsRunDialogOpen(false);
    setRunError(null);
  };

  const menuLabel = release ? `Orion ${release.version}` : 'Orion OS';

  return (
    <>
      {isOpen && (
        <div
          id="orion-start-menu"
          ref={menuRef}
          tabIndex={-1}
          data-os-start-menu={startMenuPresentation}
          className="os-start-menu"
          style={{ bottom: `${taskbarHeightPx + 2}px` }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        >
          {isCanalStartMenu && (
            <div className="os-start-menu-header">
              <div className="os-start-menu-header-avatar">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="os-start-menu-header-name">Player</span>
                <span className="block text-[10px] text-white/70">{menuLabel}</span>
              </div>
            </div>
          )}

          <div className="os-start-menu-main">
            {!isCanalStartMenu && (
              <div className="os-start-banner" aria-hidden="true">
                <span className="os-start-banner-text">{menuLabel}</span>
              </div>
            )}

            <div className="os-start-menu-body">
              <div className="relative" onMouseLeave={() => setActiveSubmenu(null)}>
                <button
                  type="button"
                  className="os-start-item os-start-program"
                  aria-haspopup="menu"
                  aria-expanded={activeSubmenu === 'programs'}
                  onClick={() => setActiveSubmenu('programs')}
                  onMouseEnter={() => setActiveSubmenu('programs')}
                >
                  <OsIcon kind="folder" size={18} />
                  <span className="os-start-item-label">Programs</span>
                  <span className="os-start-item-arrow" aria-hidden="true">▸</span>
                </button>

                {activeSubmenu === 'programs' && (
                  <div className="os-start-submenu">
                    {canLaunch('browser') && (
                      <button type="button" className="os-start-item" onClick={() => handleLaunch('browser')}>
                        <OsIcon kind="browser" size={18} />
                        <span className="os-start-item-label">Voyager Browser</span>
                      </button>
                    )}
                    {isPulseInstalled && !installedPrograms?.some(program => program.id === 'pulse') && canLaunch('pulse') && (
                      <button type="button" className="os-start-item" onClick={() => handleLaunch('pulse')}>
                        <OsIcon kind="pulse" size={18} />
                        <span className="os-start-item-label">Pulse Messenger</span>
                      </button>
                    )}
                    {canLaunch('notepad') && (
                      <button type="button" className="os-start-item" onClick={() => handleLaunch('notepad')}>
                        <OsIcon kind="notepad" size={18} />
                        <span className="os-start-item-label">Notepad</span>
                      </button>
                    )}
                    {canLaunch('terminal') && (
                      <button type="button" className="os-start-item" onClick={() => handleLaunch('terminal')}>
                        <OsIcon kind="terminal" size={18} />
                        <span className="os-start-item-label">Terminal CLI</span>
                      </button>
                    )}
                    {installedPrograms?.map(program => (
                      <button key={program.id} type="button"
                        className="os-start-item"
                        disabled={!program.available}
                        title={program.available ? 'Open installed program' : 'Installed program — Worker UI not yet available'}
                        onClick={() => handleLaunch(program.id)}>
                        <OsIcon appId={program.id} size={18} />
                        <span className="os-start-item-label">{program.label}</span>
                      </button>
                    ))}
                    <div className="os-start-separator" />
                    {canLaunch('addremove') && (
                      <button type="button" className="os-start-item" onClick={() => handleLaunch('addremove')}>
                        <OsIcon kind="installer" size={18} />
                        <span className="os-start-item-label">Add/Remove Programs</span>
                      </button>
                    )}
                    {canLaunch('savegame') && (
                      <button type="button" className="os-start-item" onClick={() => handleLaunch('savegame')}>
                        <OsIcon kind="save" size={18} />
                        <span className="os-start-item-label">Save / Load Game</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {canLaunch('fileexplorer') && (
                <button type="button" className="os-start-item"
                  onClick={() => handleLaunch('fileexplorer', { initialPath: 'C:/Documents' })}>
                  <OsIcon kind="folder" size={18} />
                  <span className="os-start-item-label">Documents</span>
                </button>
              )}

              {canLaunch('controlpanel') && (
                <button type="button" className="os-start-item" onClick={() => handleLaunch('controlpanel')}>
                  <OsIcon kind="control" size={18} />
                  <span className="os-start-item-label">Settings / Control Panel</span>
                </button>
              )}

              <button type="button" className="os-start-item" onClick={() => {
                onOpenDialUp();
                onClose();
              }}>
                <OsIcon kind="dialup" size={18} />
                <span className="os-start-item-label">Dial-up Connection...</span>
              </button>

              <div className="os-start-separator" />

              <button type="button" className="os-start-item" onClick={() => {
                setRunError(null);
                setIsRunDialogOpen(true);
                onClose();
              }}>
                <OsIcon kind="run" size={18} />
                <span className="os-start-item-label">Run...</span>
              </button>

              <button type="button" className="os-start-item" onClick={() => {
                setIsShutDownDialogOpen(true);
                onClose();
              }}>
                <OsIcon kind="power" size={18} />
                <span className="os-start-item-label">Shut Down...</span>
              </button>
            </div>
          </div>

          {isCanalStartMenu && (
            <div className="os-start-menu-footer">
              <button
                type="button"
                className="os-button"
                onClick={() => {
                  setIsShutDownDialogOpen(true);
                  onClose();
                }}
              >
                <OsIcon kind="power" size={14} />
                <span>Turn Off Computer</span>
              </button>
            </div>
          )}
        </div>
      )}

      {isRunDialogOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-3"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsRunDialogOpen(false);
              setRunError(null);
            }
          }}>
          <div className="os-dialog w-[360px] max-w-full" role="dialog" aria-modal="true" aria-labelledby="orion-run-title">
            <div className="os-dialog-titlebar">
              <span id="orion-run-title">Run</span>
              <button
                type="button"
                className="os-themed-btn h-4 w-4 text-[10px] font-bold leading-none"
                aria-label="Close Run dialog"
                onClick={() => { setIsRunDialogOpen(false); setRunError(null); }}
              >
                ✕
              </button>
            </div>
            <div className="p-3 text-xs">
              <p className="mb-3">
                Type the name of a program, folder, document, or Internet resource, and Orion will open it for you.
              </p>
              <form onSubmit={handleRunSubmit} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <label className="w-12 text-xs font-bold" htmlFor="orion-run-input">Open:</label>
                  <input
                    id="orion-run-input"
                    type="text"
                    autoFocus
                    value={runCommandText}
                    onChange={(e) => { setRunCommandText(e.target.value); if (runError) setRunError(null); }}
                    placeholder="e.g. notepad, terminal, http://findit.local"
                    className="os-input flex-1"
                  />
                </div>
                {runError && (
                  <div className="flex items-center gap-2 border border-red-700 bg-[#ffe0e0] px-2 py-1 text-[11px] text-red-800">
                    <span aria-hidden="true">!</span>
                    <span>{runError}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <button type="submit" className="os-button min-w-[70px] font-bold">OK</button>
                  <button
                    type="button"
                    className="os-button min-w-[70px]"
                    onClick={() => { setIsRunDialogOpen(false); setRunError(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isShutDownDialogOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsShutDownDialogOpen(false);
          }}>
          <div className="os-dialog w-[352px] max-w-full" role="dialog" aria-modal="true" aria-labelledby="orion-shutdown-title">
            <div className="os-dialog-titlebar">
              <span id="orion-shutdown-title">Shut Down Orion OS</span>
              <button
                type="button"
                className="os-themed-btn h-4 w-4 text-[10px] font-bold leading-none"
                aria-label="Close Shut Down dialog"
                onClick={() => setIsShutDownDialogOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-3 text-xs">
              <p className="mb-3 font-semibold">What would you like the computer to do?</p>
              <div className="mb-4 flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="shutdown_opt" checked={powerChoice === 'shutdown'}
                    onChange={() => setPowerChoice('shutdown')} />
                  <span>Shut down computer</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="shutdown_opt" checked={powerChoice === 'restart'}
                    onChange={() => setPowerChoice('restart')} />
                  <span>Restart Orion OS</span>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="os-button min-w-[70px] font-bold"
                  onClick={() => {
                    soundManager.play('click');
                    onPowerAction(powerChoice);
                    setIsShutDownDialogOpen(false);
                  }}
                >
                  OK
                </button>
                <button type="button" className="os-button min-w-[70px]" onClick={() => setIsShutDownDialogOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

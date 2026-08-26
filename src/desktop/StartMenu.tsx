import React, { useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useWindowStore } from '../store/useWindowStore';
import { soundManager } from '../audio/SoundManager';
import {
  Folder,
  FileText,
  Terminal as TerminalIcon,
  Globe,
  MessageSquare,
  Sliders,
  PlaySquare,
  Power,
  User,
} from 'lucide-react';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDialUp: () => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onOpenDialUp }) => {
  const osVersion = useSimulationStore((s) => s.state.hardware.osVersion);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [activeSubmenu, setActiveSubmenu] = useState<'programs' | 'accessories' | 'internet' | 'settings' | 'documents' | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isShutDownDialogOpen, setIsShutDownDialogOpen] = useState(false);
  const [runCommandText, setRunCommandText] = useState('');

  const isOrion6 = osVersion === 'Orion_6.0';

  if (!isOpen) return null;

  const handleLaunch = (appId: string, customState?: Record<string, any>) => {
    soundManager.play('click');
    openWindow(appId, customState);
    onClose();
  };

  const handleRunSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = runCommandText.trim().toLowerCase();
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
    } else if (cmd.startsWith('http://') || cmd.endsWith('.local')) {
      handleLaunch('browser', { initialUrl: cmd });
    } else {
      soundManager.play('error');
      alert(`Cannot find file or command '${runCommandText}'. Verify name and try again.`);
    }
    setIsRunDialogOpen(false);
  };

  return (
    <>
      {/* 1. Main Start Menu Container */}
      <div
        id="orion-start-menu"
        className={`absolute bottom-8 left-1 z-50 flex shadow-2xl ${
          isOrion6
            ? 'w-96 rounded-t-lg bg-[#245edb] border-2 border-[#003c74] flex-col overflow-hidden text-black'
            : 'orion-outset bg-[#c0c0c0] min-w-[210px] text-black p-0.5'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Orion 6.0 Top User Header */}
        {isOrion6 && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#1f48ab] to-[#386cd4] text-white border-b border-[#0c1f4e]">
            <div className="w-10 h-10 rounded-sm border-2 border-white/80 bg-blue-700 flex items-center justify-center shadow">
              <User className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-sm tracking-wide drop-shadow">Player</span>
          </div>
        )}

        <div className="flex flex-1">
          {/* Orion 4.8 Vertical Banner */}
          {!isOrion6 && (
            <div className="w-7 bg-gradient-to-b from-[#000080] via-[#1084d0] to-[#000040] text-white flex items-end justify-center pb-2 font-bold select-none">
              <span className="[writing-mode:vertical-lr] rotate-180 tracking-widest text-[13px] text-gray-200">
                Orion <b>4.8</b>
              </span>
            </div>
          )}

          {/* Menu Items Column */}
          <div className="flex-1 flex flex-col py-1 text-[11px]">
            {/* Programs Submenu Trigger */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('programs')}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <button
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-orion-highlight hover:text-white cursor-pointer"
                onClick={() => setActiveSubmenu(activeSubmenu === 'programs' ? null : 'programs')}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-yellow-500" />
                  <span className="font-bold">Programs</span>
                </div>
                <span>▸</span>
              </button>

              {/* Cascading Programs Menu */}
              {activeSubmenu === 'programs' && (
                <div className="absolute left-full top-0 -ml-1 orion-outset bg-[#c0c0c0] min-w-[180px] p-0.5 shadow-xl flex flex-col z-50 text-black">
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
                    onClick={() => handleLaunch('browser')}
                  >
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span>Voyager Browser</span>
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
                    onClick={() => handleLaunch('pulse')}
                  >
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    <span>Pulse Messenger</span>
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
                    onClick={() => handleLaunch('notepad')}
                  >
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Notepad</span>
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
                    onClick={() => handleLaunch('terminal')}
                  >
                    <TerminalIcon className="w-4 h-4 text-emerald-600" />
                    <span>Terminal CLI</span>
                  </button>
                  <div className="h-[1px] bg-[#808080] my-0.5 border-b border-white" />
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
                    onClick={() => handleLaunch('addremove')}
                  >
                    <PlaySquare className="w-4 h-4 text-indigo-600" />
                    <span>Add/Remove Programs</span>
                  </button>
                </div>
              )}
            </div>

            {/* Documents */}
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
              onClick={() => handleLaunch('fileexplorer', { initialPath: 'C:/Documents' })}
            >
              <Folder className="w-4 h-4 text-yellow-500" />
              <span>Documents</span>
            </button>

            {/* Settings */}
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
              onClick={() => handleLaunch('controlpanel')}
            >
              <Sliders className="w-4 h-4 text-amber-600" />
              <span>Settings / Control Panel</span>
            </button>

            {/* Dial-Up Networking */}
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
              onClick={() => {
                onOpenDialUp();
                onClose();
              }}
            >
              <Globe className="w-4 h-4 text-cyan-600" />
              <span>Dial-up Connection...</span>
            </button>

            <div className="h-[1px] bg-[#808080] my-1 border-b border-white" />

            {/* Run... */}
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
              onClick={() => {
                setIsRunDialogOpen(true);
                onClose();
              }}
            >
              <PlaySquare className="w-4 h-4 text-emerald-600" />
              <span>Run...</span>
            </button>

            {/* Shut Down... */}
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-orion-highlight hover:text-white text-left"
              onClick={() => {
                setIsShutDownDialogOpen(true);
                onClose();
              }}
            >
              <Power className="w-4 h-4 text-red-600" />
              <span>Shut Down...</span>
            </button>
          </div>
        </div>

        {/* Orion 6.0 Bottom Footer */}
        {isOrion6 && (
          <div className="flex items-center justify-end gap-2 p-2 bg-gradient-to-r from-[#1f48ab] to-[#245edb] border-t border-[#3c7bf0] text-white text-[11px]">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#d32f2f] hover:brightness-110 font-bold shadow"
              onClick={() => {
                setIsShutDownDialogOpen(true);
                onClose();
              }}
            >
              <Power className="w-3.5 h-3.5" />
              <span>Turn Off Computer</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Run Dialog Modal */}
      {isRunDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="orion-outset bg-[#c0c0c0] w-96 p-2 shadow-2xl text-black">
            <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-2 py-1 font-bold flex justify-between items-center mb-3">
              <span>Run</span>
              <button
                className="orion-button h-4 w-4 text-[10px] font-bold p-0 leading-none"
                onClick={() => setIsRunDialogOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-xs mb-3">
              Type the name of a program, folder, document, or Internet resource, and Orion will open it for you.
            </p>
            <form onSubmit={handleRunSubmit} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold w-12">Open:</label>
                <input
                  type="text"
                  autoFocus
                  value={runCommandText}
                  onChange={(e) => setRunCommandText(e.target.value)}
                  placeholder="e.g. notepad, terminal, http://findit.local"
                  className="orion-input flex-1"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="submit" className="orion-button min-w-[70px] font-bold">
                  OK
                </button>
                <button
                  type="button"
                  className="orion-button min-w-[70px]"
                  onClick={() => setIsRunDialogOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Shut Down Dialog Modal */}
      {isShutDownDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="orion-outset bg-[#c0c0c0] w-88 p-3 shadow-2xl text-black">
            <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-2 py-1 font-bold flex justify-between items-center mb-3">
              <span>Shut Down Orion OS</span>
              <button
                className="orion-button h-4 w-4 text-[10px] font-bold p-0 leading-none"
                onClick={() => setIsShutDownDialogOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-xs mb-3 font-semibold">What would you like the computer to do?</p>
            <div className="flex flex-col gap-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="shutdown_opt" defaultChecked />
                <span>Sleep / Rest (Advance to next morning)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="shutdown_opt" />
                <span>Restart Orion OS</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="orion-button min-w-[70px] font-bold"
                onClick={() => {
                  soundManager.play('click');
                  dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
                  setIsShutDownDialogOpen(false);
                }}
              >
                OK
              </button>
              <button
                className="orion-button min-w-[70px]"
                onClick={() => setIsShutDownDialogOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

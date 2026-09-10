import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { resolvePcBootState } from '../engine/SimulationEngine';
import { useWindowStore } from '../store/useWindowStore';
import { useDesktopStore } from '../store/useDesktopStore';
import { soundManager } from '../audio/SoundManager';
import { synthAudio } from '../audio/SynthAudio';
import { OsSetupWizard } from '../apps/installer/OsSetupWizard';
import { Taskbar } from './Taskbar';
import { WindowManager } from './WindowManager';
import { DialUpModal } from './DialUpModal';
import { CRTOverlay } from './CRTOverlay';
import { getOsPresentationProfile } from './host/OsPresentation';
import { getBootableOwnedOsMedia } from './BootMedia';
export { getBootableOwnedOsMedia } from './BootMedia';
import {
  Monitor,
  Globe,
  MessageSquare,
  Terminal as TerminalIcon,
  Sliders,
  Trash2,
  FileText,
  Package,
  Folder,
  Sparkles,
} from 'lucide-react';

export type WallpaperPreset = 'classic_teal' | 'bliss_green' | 'starry_night' | 'matrix_rain' | 'solid_navy';

export interface DesktopIconItem {
  id: string;
  label: string;
  appId: string;
  iconType: 'computer' | 'browser' | 'pulse' | 'terminal' | 'control' | 'trash' | 'text' | 'installer' | 'folder' | 'ai';
  filePath?: string;
  gridX: number;
  gridY: number;
}

function getWallpaperClass(preset: WallpaperPreset): string {
  switch (preset) {
    case 'classic_teal': return 'bg-[#008080]';
    case 'bliss_green': return 'bg-gradient-to-b from-[#1f6fd8] via-[#64a7f5] to-[#429321]';
    case 'starry_night': return 'bg-[#060818]';
    case 'matrix_rain': return 'bg-black';
    case 'solid_navy': return 'bg-[#000080]';
  }
}

function renderIconGraphic(type: DesktopIconItem['iconType'], _theme?: string) {
  switch (type) {
    case 'computer': return <Monitor className="w-7 h-7 text-white drop-shadow" />;
    case 'browser': return <Globe className="w-7 h-7 text-cyan-300 drop-shadow" />;
    case 'pulse': return <MessageSquare className="w-7 h-7 text-yellow-300 drop-shadow" />;
    case 'terminal': return <TerminalIcon className="w-7 h-7 text-emerald-400 drop-shadow" />;
    case 'control': return <Sliders className="w-7 h-7 text-amber-300 drop-shadow" />;
    case 'trash': return <Trash2 className="w-7 h-7 text-gray-200 drop-shadow" />;
    case 'text': return <FileText className="w-7 h-7 text-white drop-shadow" />;
    case 'installer': return <Package className="w-7 h-7 text-indigo-300 drop-shadow" />;
    case 'folder': return <Folder className="w-7 h-7 text-yellow-400 drop-shadow" />;
    case 'ai': return <Sparkles className="w-7 h-7 text-fuchsia-300 drop-shadow" />;
  }
}

export const DesktopShell: React.FC = () => {
  const os = useSimulationStore((s) => s.state.os);
  const osVersion = os.currentOsId;
  const computer = useSimulationStore((s) => s.state.computer);
  const inventory = useSimulationStore((s) => s.state.inventory);
  const monitor = useSimulationStore((s) => s.state.display?.monitor ?? null);
  const vfsFiles = useSimulationStore((s) => s.state.vfs.files);
  const openWindow = useWindowStore((s) => s.openWindow);
  const wallpaper = useDesktopStore((s) => s.wallpaper);
  const setWallpaper = useDesktopStore((s) => s.setWallpaper);
  const [selectedIconIds, setSelectedIconIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number; active: boolean } | null>(null);
  const [isDialUpModalOpen, setIsDialUpModalOpen] = useState(false);
  const [bootSetupTarget, setBootSetupTarget] = useState<ReturnType<typeof getBootableOwnedOsMedia>[number]['targetOs'] | null>(null);
  const [bootSetupError, setBootSetupError] = useState<string | null>(null);
  const [iconPositions] = useState<Record<string, { x: number; y: number }>>({});
  const switchView = useSimulationStore((s) => s.switchView);
  const setComputerPower = useSimulationStore((s) => s.setComputerPower);
  const insertOwnedMediaAtHome = useSimulationStore((s) => s.insertOwnedMediaAtHome);
  const bootState = resolvePcBootState({ computer, inventory, os });
  const presentation = osVersion ? getOsPresentationProfile(osVersion) : null;

  useEffect(() => {
    if (!presentation) return;
    const stored = useDesktopStore.getState().wallpaper;
    if (!stored) setWallpaper(presentation.shell.defaultWallpaperId);
  }, [presentation, setWallpaper]);

  const themeAttr = presentation?.themeId;

  if (bootState === 'no_computer' || bootState === 'awaiting_setup') {
    const packageWaiting = bootState === 'awaiting_setup';
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-300 font-mono select-none p-4">
        <div className="max-w-md w-full p-6 bg-zinc-900 border border-zinc-800 rounded shadow-2xl text-center space-y-4">
          <div className="text-4xl">{packageWaiting ? '📦' : '🪵'}</div>
          <h2 className="text-base font-bold text-amber-400">{packageWaiting ? 'Computer Package Waiting in Room 104' : 'Empty Desk — No Computer Installed'}</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">{packageWaiting ? 'The refurbished computer is still boxed and unassembled. Set it up at the desk before trying to power it on.' : "Your motel desk in Room 104 is completely bare. Head out through the hallway door to downtown Tech Mart and visit Milo's Silicon & Spares to pick up a refurbished PC rig."}</p>
          <button onClick={() => switchView('room')} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs rounded transition-colors cursor-pointer">← Back to Room 104</button>
        </div>
      </div>
    );
  }

  if (bootState === 'powered_off') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-zinc-400 font-mono select-none p-4">
        <div className="text-center space-y-4">
          <div className="w-3 h-3 bg-amber-500 rounded-full mx-auto animate-pulse" title="Monitor Standby" />
          <div className="text-xs text-zinc-500">Monitor in Standby (No Signal)</div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { synthAudio.playBiosBeep(); const result = setComputerPower(true); if (result.success && presentation) synthAudio.playStartupChime(presentation.soundSchemeId); }} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs border border-zinc-700 rounded transition-colors cursor-pointer">Power On PC</button>
            <button onClick={() => switchView('room')} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs border border-zinc-800 rounded transition-colors cursor-pointer">Stand Up (Back to Room)</button>
          </div>
        </div>
      </div>
    );
  }

  if (bootState === 'no_boot_device') {
    const bootableMedia = getBootableOwnedOsMedia(inventory.items);
    const startSetup = (media: (typeof bootableMedia)[number]) => {
      setBootSetupError(null);
      if (media.location !== 'inserted') {
        const inserted = insertOwnedMediaAtHome(media.instanceId);
        if (!inserted.success) {
          setBootSetupError(inserted.error ?? 'Could not insert setup media.');
          return;
        }
      }
      setBootSetupTarget(media.targetOs);
    };

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-zinc-300 font-mono select-none p-6">
        <div className="max-w-lg w-full space-y-3 border border-zinc-700 p-5">
          <div className="text-sm text-emerald-400">POST complete.</div>
          <div className="text-base font-bold text-white">No bootable operating system found.</div>
          <p className="text-xs text-zinc-500">Insert owned setup media to install an operating system. Setup runs from the exact physical disc you own.</p>
          {bootableMedia.length > 0 ? (
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Owned setup media</div>
              {bootableMedia.map((media) => (
                <button
                  key={media.instanceId}
                  type="button"
                  onClick={() => startSetup(media)}
                  className="w-full border border-emerald-900 bg-emerald-950/20 px-3 py-2 text-left text-xs hover:bg-emerald-950/40"
                >
                  <span className="block font-bold text-emerald-300">{media.location === 'inserted' ? 'Run setup' : 'Insert & run setup'} — {media.title}</span>
                  <span className="mt-1 block font-mono text-[10px] text-zinc-600">{media.instanceId}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-500">No owned Orion setup disc is available in Room 104.</p>
          )}
          {bootSetupError && <div className="border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-300">{bootSetupError}</div>}
          <button type="button" onClick={() => switchView('room')} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs border border-zinc-600 cursor-pointer">Back to Room 104</button>
        </div>
        {bootSetupTarget && <OsSetupWizard targetOs={bootSetupTarget} onClose={() => setBootSetupTarget(null)} />}
      </div>
    );
  }

  const baseIcons: DesktopIconItem[] = [
    { id: 'sys_computer', label: 'My Computer', appId: 'fileexplorer', iconType: 'computer', gridX: 0, gridY: 0 },
    { id: 'sys_browser', label: 'Voyager Browser', appId: 'browser', iconType: 'browser', gridX: 0, gridY: 1 },
    { id: 'sys_terminal', label: 'Terminal CLI', appId: 'terminal', iconType: 'terminal', gridX: 0, gridY: 2 },
    { id: 'sys_control', label: 'Control Panel', appId: 'controlpanel', iconType: 'control', gridX: 0, gridY: 3 },
    { id: 'sys_trash', label: 'Recycle Bin', appId: 'trash', iconType: 'trash', gridX: 0, gridY: 4 },
    { id: 'sys_ailab', label: 'AI Lab', appId: 'ailab', iconType: 'ai', gridX: 0, gridY: 5 },
  ];

  const desktopVfsIcons: DesktopIconItem[] = Object.values(vfsFiles)
    .filter((f) => f.parentPath === 'C:/Desktop' && f.path !== 'C:/Desktop')
    .map((f, idx) => {
      const isShortcut = f.kind === 'shortcut';
      const isLaunchable = f.kind === 'executable' || f.kind === 'installer' || isShortcut;
      let appId = 'notepad';
      let iconType: DesktopIconItem['iconType'] = 'text';
      if (isShortcut && f.appAssociation) {
        appId = f.appAssociation;
        if (f.appAssociation.includes('pulse')) iconType = 'pulse';
        else if (f.appAssociation.includes('retroamp')) iconType = 'ai';
        else if (f.appAssociation.includes('flashfetch')) iconType = 'installer';
        else if (f.appAssociation.includes('zipmate')) iconType = 'folder';
        else if (f.appAssociation.includes('photobox')) iconType = 'text';
        else if (f.appAssociation.includes('weatherbuddy')) iconType = 'ai';
        else if (f.appAssociation.includes('safesweep')) iconType = 'control';
        else iconType = 'installer';
      } else if (isLaunchable && f.appAssociation) {
        appId = f.appAssociation;
        iconType = f.kind === 'installer' ? 'installer' : 'text';
      } else if (f.kind === 'directory') {
        appId = 'fileexplorer';
        iconType = 'folder';
      }
      const displayLabel = f.kind === 'shortcut' && f.name.toLowerCase().endsWith('.lnk') ? f.name.slice(0, -4) : f.name;
      return { id: `vfs_${f.id || f.name}`, label: displayLabel, appId, filePath: f.path, iconType, gridX: 1, gridY: idx };
    });

  const allIcons = [...baseIcons, ...desktopVfsIcons];
  const handleIconDoubleClick = (icon: DesktopIconItem) => {
    soundManager.play('click');
    if (icon.appId === 'notepad' && icon.filePath) openWindow('notepad', `Notepad - ${icon.label}`, { filePath: icon.filePath });
    else openWindow(icon.appId);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.desktop-icon') || (e.target as HTMLElement).closest('.window-frame')) return;
    setContextMenu(null); setSelectedIconIds([]);
    setMarquee({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY, active: true });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!marquee || !marquee.active) return;
    setMarquee((prev) => (prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null));
    const minX = Math.min(marquee.startX, e.clientX), maxX = Math.max(marquee.startX, e.clientX), minY = Math.min(marquee.startY, e.clientY), maxY = Math.max(marquee.startY, e.clientY);
    const selected: string[] = [];
    allIcons.forEach((icon) => { const pos = iconPositions[icon.id] || { x: 12 + icon.gridX * 80, y: 12 + icon.gridY * 88 }; if (pos.x < maxX && pos.x + 72 > minX && pos.y < maxY && pos.y + 80 > minY) selected.push(icon.id); });
    setSelectedIconIds(selected);
  };
  const handleMouseUp = () => { if (marquee?.active) setMarquee(null); };
  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); if ((e.target as HTMLElement).closest('.window-frame')) return; setContextMenu({ x: e.clientX, y: e.clientY, visible: true }); };

  return (
    <div data-theme={themeAttr} className={`relative w-screen h-screen select-none overflow-hidden font-pixel text-xs ${getWallpaperClass(wallpaper)}`} style={presentation ? { fontFamily: presentation.uiFontStack, fontSize: presentation.baseFontSizePx } : undefined} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onContextMenu={handleContextMenu}>
      <div className="absolute inset-0 bottom-8 z-0 pointer-events-auto">
        {allIcons.map((icon) => {
          const pos = iconPositions[icon.id] || { x: 12 + icon.gridX * 80, y: 12 + icon.gridY * 88 };
          const isSelected = selectedIconIds.includes(icon.id);
          return (
            <div key={icon.id} className={`desktop-icon absolute flex flex-col items-center justify-center p-1 cursor-pointer transition-none ${isSelected ? 'bg-blue-600/40 border border-dotted border-white' : 'hover:bg-white/10'}`} style={{ left: pos.x, top: pos.y, width: 72 }} onClick={(e) => { e.stopPropagation(); setSelectedIconIds([icon.id]); setContextMenu(null); }} onDoubleClick={() => handleIconDoubleClick(icon)}>
              <div className="w-8 h-8 flex items-center justify-center mb-1 drop-shadow-md">{renderIconGraphic(icon.iconType, themeAttr)}</div>
              <span className={`text-center text-[11px] leading-tight px-1 py-0.5 break-words max-w-full rounded-xs ${isSelected ? 'bg-[#000080] text-white font-semibold' : 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'}`}>{icon.label}</span>
            </div>
          );
        })}
      </div>
      {marquee && marquee.active && <div className="absolute border border-dashed border-[#316ac5] bg-[#316ac5]/20 pointer-events-none z-10" style={{ left: Math.min(marquee.startX, marquee.currentX), top: Math.min(marquee.startY, marquee.currentY), width: Math.abs(marquee.currentX - marquee.startX), height: Math.abs(marquee.currentY - marquee.startY) }} />}
      <WindowManager />
      {contextMenu && contextMenu.visible && (
        <div className="absolute z-50 orion-outset p-1 min-w-[140px] flex flex-col gap-0.5 text-black shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button className="text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center justify-between" onClick={() => setContextMenu(null)}><span>Arrange Icons</span><span>▸</span></button>
          <button className="text-left px-3 py-1 hover:bg-[#000080] hover:text-white" onClick={() => { soundManager.play('click'); setContextMenu(null); }}>Refresh</button>
          <div className="h-[1px] bg-[#808080] my-0.5 border-b border-white" />
          <button className="text-left px-3 py-1 hover:bg-[#000080] hover:text-white" onClick={() => { openWindow('controlpanel', 'Control Panel - Display Properties', { tab: 'display' }); setContextMenu(null); }}>Properties</button>
        </div>
      )}
      {isDialUpModalOpen && <DialUpModal onClose={() => setIsDialUpModalOpen(false)} />}
      <Taskbar onOpenDialUp={() => setIsDialUpModalOpen(true)} />
      <CRTOverlay monitor={monitor ?? undefined} />
    </div>
  );
};
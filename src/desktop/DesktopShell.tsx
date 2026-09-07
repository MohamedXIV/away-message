import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useWindowStore } from '../store/useWindowStore';
import { useDesktopStore } from '../store/useDesktopStore';
import { soundManager } from '../audio/SoundManager';
import { Taskbar } from './Taskbar';
import { WindowManager } from './WindowManager';
import { DialUpModal } from './DialUpModal';
import { CRTOverlay } from './CRTOverlay';
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
  gridX: number; // Column index (0, 1, 2...)
  gridY: number; // Row index (0, 1, 2...)
}

function getWallpaperClass(preset: WallpaperPreset): string {
  switch (preset) {
    case 'classic_teal':
      return 'bg-[#008080]';
    case 'bliss_green':
      return 'bg-gradient-to-b from-[#1f6fd8] via-[#64a7f5] to-[#429321]';
    case 'starry_night':
      return 'bg-[#060818]';
    case 'matrix_rain':
      return 'bg-black';
    case 'solid_navy':
      return 'bg-[#000080]';
  }
}

function renderIconGraphic(type: DesktopIconItem['iconType'], _theme?: string) {
  switch (type) {
    case 'computer':
      return <Monitor className="w-7 h-7 text-white drop-shadow" />;
    case 'browser':
      return <Globe className="w-7 h-7 text-cyan-300 drop-shadow" />;
    case 'pulse':
      return <MessageSquare className="w-7 h-7 text-yellow-300 drop-shadow" />;
    case 'terminal':
      return <TerminalIcon className="w-7 h-7 text-emerald-400 drop-shadow" />;
    case 'control':
      return <Sliders className="w-7 h-7 text-amber-300 drop-shadow" />;
    case 'trash':
      return <Trash2 className="w-7 h-7 text-gray-200 drop-shadow" />;
    case 'text':
      return <FileText className="w-7 h-7 text-white drop-shadow" />;
    case 'installer':
      return <Package className="w-7 h-7 text-indigo-300 drop-shadow" />;
    case 'folder':
      return <Folder className="w-7 h-7 text-yellow-400 drop-shadow" />;
    case 'ai':
      return <Sparkles className="w-7 h-7 text-fuchsia-300 drop-shadow" />;
  }
}

export const DesktopShell: React.FC = () => {
  const osVersion = useSimulationStore((s) => s.state.hardware.osVersion);
  const vfsFiles = useSimulationStore((s) => s.state.vfs.files);
  const openWindow = useWindowStore((s) => s.openWindow);

  const wallpaper = useDesktopStore((s) => s.wallpaper);
  const setWallpaper = useDesktopStore((s) => s.setWallpaper);
  const [selectedIconIds, setSelectedIconIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number; active: boolean } | null>(null);
  const [isDialUpModalOpen, setIsDialUpModalOpen] = useState(false);
  const [iconPositions] = useState<Record<string, { x: number; y: number }>>({});

  const hardware = useSimulationStore((s) => s.state.hardware);

  // Sync wallpaper when osVersion changes only if not already customized (first load)
  useEffect(() => {
    const stored = useDesktopStore.getState().wallpaper;
    if (!stored) {
      setWallpaper(osVersion === 'Orion_6.0' ? 'bliss_green' : 'classic_teal');
    }
  }, [osVersion, setWallpaper]);

  // Derive theme attribute across all 4 OS generations
  const getOsTheme = (v: string) => {
    if (v?.includes('7.')) return 'orion70';
    if (v?.includes('6.')) return 'orion60';
    if (v?.includes('5.')) return 'orion50';
    return 'orion48';
  };
  const themeAttr = getOsTheme(osVersion);

  // System base icons
  const baseIcons: DesktopIconItem[] = [
    { id: 'sys_computer', label: 'My Computer', appId: 'fileexplorer', iconType: 'computer', gridX: 0, gridY: 0 },
    { id: 'sys_browser', label: 'Voyager Browser', appId: 'browser', iconType: 'browser', gridX: 0, gridY: 1 },
    // NOTE: no Pulse icon here on purpose — Pulse never ships with the OS.
    // Its desktop shortcut appears only after installing from the official site.
    { id: 'sys_terminal', label: 'Terminal CLI', appId: 'terminal', iconType: 'terminal', gridX: 0, gridY: 2 },
    { id: 'sys_control', label: 'Control Panel', appId: 'controlpanel', iconType: 'control', gridX: 0, gridY: 3 },
    { id: 'sys_trash', label: 'Recycle Bin', appId: 'trash', iconType: 'trash', gridX: 0, gridY: 4 },
    { id: 'sys_ailab', label: 'AI Lab', appId: 'ailab', iconType: 'ai', gridX: 0, gridY: 5 },
  ];

  // Dynamic VFS icons in C:/Desktop — shortcuts (.lnk) must open their target app
  const desktopVfsIcons: DesktopIconItem[] = Object.values(vfsFiles)
    .filter((f) => f.parentPath === 'C:/Desktop' && f.path !== 'C:/Desktop')
    .map((f, idx) => {
      // For shortcuts, the appAssociation is the real target (e.g., app.flashfetch)
      const isShortcut = f.kind === 'shortcut';
      const isLaunchable = f.kind === 'executable' || f.kind === 'installer' || isShortcut;
      let appId = 'notepad';
      let iconType: DesktopIconItem['iconType'] = 'text';
      if (isShortcut && f.appAssociation) {
        appId = f.appAssociation;
        // Map known apps to proper icons
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
      // Hide .lnk extension for shortcuts (Windows behavior) — keep file as .lnk internally
      const displayLabel = f.kind === 'shortcut' && f.name.toLowerCase().endsWith('.lnk')
        ? f.name.slice(0, -4)
        : f.name;
      return {
        id: `vfs_${f.id || f.name}`,
        label: displayLabel,
        appId,
        filePath: f.path,
        iconType,
        gridX: 1,
        gridY: idx,
      };
    });

  const allIcons = [...baseIcons, ...desktopVfsIcons];

  // Handle icon double click
  const handleIconDoubleClick = (icon: DesktopIconItem) => {
    soundManager.play('click');
    if (icon.appId === 'notepad' && icon.filePath) {
      openWindow('notepad', `Notepad - ${icon.label}`, { filePath: icon.filePath });
    } else {
      openWindow(icon.appId);
    }
  };

  // Marquee mouse drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if ((e.target as HTMLElement).closest('.desktop-icon') || (e.target as HTMLElement).closest('.window-frame')) {
      return;
    }
    setContextMenu(null);
    setSelectedIconIds([]);
    setMarquee({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      active: true,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!marquee || !marquee.active) return;
    setMarquee((prev) => (prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null));

    // Calculate marquee bounds
    const minX = Math.min(marquee.startX, e.clientX);
    const maxX = Math.max(marquee.startX, e.clientX);
    const minY = Math.min(marquee.startY, e.clientY);
    const maxY = Math.max(marquee.startY, e.clientY);

    // Collision check with icon elements
    const selected: string[] = [];
    allIcons.forEach((icon) => {
      const pos = iconPositions[icon.id] || { x: 12 + icon.gridX * 80, y: 12 + icon.gridY * 88 };
      const iconRight = pos.x + 72;
      const iconBottom = pos.y + 80;
      if (pos.x < maxX && iconRight > minX && pos.y < maxY && iconBottom > minY) {
        selected.push(icon.id);
      }
    });
    setSelectedIconIds(selected);
  };

  const handleMouseUp = () => {
    if (marquee?.active) {
      setMarquee(null);
    }
  };

  // Context menu on right click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.window-frame')) return;
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
  };

  return (
    <div
      data-theme={themeAttr}
      className={`relative w-screen h-screen select-none overflow-hidden font-pixel text-xs ${getWallpaperClass(
        wallpaper
      )}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {/* 1. Desktop Icon Grid */}
      <div className="absolute inset-0 bottom-8 z-0 pointer-events-auto">
        {allIcons.map((icon) => {
          const pos = iconPositions[icon.id] || { x: 12 + icon.gridX * 80, y: 12 + icon.gridY * 88 };
          const isSelected = selectedIconIds.includes(icon.id);

          return (
            <div
              key={icon.id}
              className={`desktop-icon absolute flex flex-col items-center justify-center p-1 cursor-pointer transition-none ${
                isSelected ? 'bg-blue-600/40 border border-dotted border-white' : 'hover:bg-white/10'
              }`}
              style={{ left: pos.x, top: pos.y, width: 72 }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIconIds([icon.id]);
                setContextMenu(null);
              }}
              onDoubleClick={() => handleIconDoubleClick(icon)}
            >
              <div className="w-8 h-8 flex items-center justify-center mb-1 drop-shadow-md">
                {renderIconGraphic(icon.iconType, themeAttr)}
              </div>
              <span
                className={`text-center text-[11px] leading-tight px-1 py-0.5 break-words max-w-full rounded-xs ${
                  isSelected ? 'bg-[#000080] text-white font-semibold' : 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
                }`}
              >
                {icon.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 2. Marquee Selection Box */}
      {marquee && marquee.active && (
        <div
          className="absolute border border-dashed border-[#316ac5] bg-[#316ac5]/20 pointer-events-none z-10"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
          }}
        />
      )}

      {/* 3. Window Manager Layer */}
      <WindowManager />

      {/* 4. Desktop Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          className="absolute z-50 orion-outset p-1 min-w-[140px] flex flex-col gap-0.5 text-black shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center justify-between"
            onClick={() => {
              setContextMenu(null);
            }}
          >
            <span>Arrange Icons</span>
            <span>▸</span>
          </button>
          <button
            className="text-left px-3 py-1 hover:bg-[#000080] hover:text-white"
            onClick={() => {
              soundManager.play('click');
              setContextMenu(null);
            }}
          >
            Refresh
          </button>
          <div className="h-[1px] bg-[#808080] my-0.5 border-b border-white" />
          <button
            className="text-left px-3 py-1 hover:bg-[#000080] hover:text-white"
            onClick={() => {
              openWindow('controlpanel', 'Control Panel - Display Properties', { tab: 'display' });
              setContextMenu(null);
            }}
          >
            Properties
          </button>
        </div>
      )}

      {/* 5. Dial-Up Connection Dialog */}
      {isDialUpModalOpen && <DialUpModal onClose={() => setIsDialUpModalOpen(false)} />}

      {/* 6. Taskbar */}
      <Taskbar onOpenDialUp={() => setIsDialUpModalOpen(true)} />

      {/* 7. CRT Overlay Shader */}
      <CRTOverlay monitor={hardware.modular?.monitor} />
    </div>
  );
};

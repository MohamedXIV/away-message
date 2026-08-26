# Technical Architecture & Implementation Blueprint — Milestone 2 (Part B)
**Subsystem**: Orion OS Dual-Theme Engine, Desktop Shell & Retro Chrome  
**Author**: Explorer M2-2  
**Working Directory**: `f:/_WIP/away-message/.agents/explorer_m2_2/`  
**Target Milestone**: M2 Desktop Environment & OS Systems (Part B)

---

## 1. Executive Architecture & Component Hierarchy

### 1.1 Overview
The Desktop Shell and Chrome subsystem provides the authentic, interactive graphical user interface representing the fictional late-1990s / early-2000s operating systems (**Orion OS 4.8** and **Orion OS 6.0**). It bridges the headless `SimulationEngine` and domain stores to the user's viewport.

```
+----------------------------------------------------------------------------------------------------+
|                                    DesktopShell Container                                          |
|  [data-theme="orion48" | "orion60"] [data-wallpaper="classic_teal" | "bliss_green" | ...]          |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Desktop Canvas & Icon Grid                                                                    | |
|  | - System Icons (My Computer, Voyager Browser, Pulse, Terminal, Control Panel, Trash)           | |
|  | - Dynamic VFS Shortcuts (C:/Desktop/*.lnk, C:/Desktop/*.txt)                                  | |
|  | - Drag & Drop Icon Positioning & Grid Snapping                                                | |
|  | - Selection Marquee (Lasso bounding box)                                                       | |
|  | - Desktop Context Menu (Arrange By, Refresh, New -> Text Document, Display Properties)         | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | WindowManager Layer (Managed by Explorer M2-1)                                                | |
|  | - Active Windows (WindowFrame, Window Title, Minimize/Maximize/Close, Content)                | |
|  | - CRTOverlay Layer (Scanlines, Curved Distortion, Phosphor Bloom)                             | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Modals Layer                                                                                  | |
|  | - DialUpModal (10-Stage Handshake, Baud Negotiation, Web Audio Sync)                           | |
|  | - RunDialog (Start -> Run command executor)                                                   | |
|  | - ShutDownDialog (Standby, Restart, Turn Off)                                                  | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Taskbar (Fixed Bottom: 28px in Orion 4.8 / 32px in Orion 6.0)                                 | |
|  | +-----------------+ +-----------------------------------------------+ +----------------------+ | |
|  | | Start Button    | | Window Tabs / Taskbar Buttons                 | | SystemTray           | | |
|  | | (4.8 Bevel Flag | | (Active Inset, Inactive Outset, Minimized,   | | - Live Clock         | | |
|  | |  6.0 Green Pill)| |  Right-click context menu: Restore/Min/Close) | | - Volume Popup Slider| | |
|  | +-----------------+ +-----------------------------------------------+ | - Network Blink LEDs | | |
|  |                                                                       | - RAM Pressure Warn  | | |
|  |                                                                       +----------------------+ | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | StartMenu (Cascading Pop-up attached to Start Button)                                          | |
|  | - Orion 4.8 Vertical Branding Strip vs Orion 6.0 XP Dual-Column Profile Header                | |
|  | - Submenus: Programs (Accessories, Internet, Tools), Documents, Settings, Find, Help, Run...  | |
|  +-----------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### 1.2 File Boundaries for Milestone 2 (Part B)
1. `src/desktop/themes/orion48.css`: CSS Variables and classes for Orion OS 4.8 (Win95/98 gray beveled UI).
2. `src/desktop/themes/orion60.css`: CSS Variables and classes for Orion OS 6.0 (XP Royale warm blue/sand UI).
3. `src/desktop/DesktopShell.tsx`: Root desktop layout, wallpaper renderer, icon grid, selection marquee, context menu.
4. `src/desktop/Taskbar.tsx`: Bottom bar, Start button, Quick Launch icons, active window buttons with pressed states.
5. `src/desktop/StartMenu.tsx`: Cascading hierarchical start menu with Programs, Documents, Settings, Run dialog, and Shut Down dialog.
6. `src/desktop/SystemTray.tsx`: System tray housing the simulation clock, volume popup slider, and network TX/RX blink indicators.
7. `src/desktop/DialUpModal.tsx`: Dial-up connection dialog with 10-stage handshake status simulation, speed selection, and Web Audio sync.

---

## 2. Orion OS Theme Engine Specification

### 2.1 CSS Custom Property Token Architecture
Both themes provide identical token names defined under `[data-theme="orion48"]` and `[data-theme="orion60"]` so all application windows and shell components switch appearance without rewriting component JSX.

| CSS Variable Token | Description | Orion OS 4.8 Default | Orion OS 6.0 Default |
|---|---|---|---|
| `--orion-font-family` | Main UI font | `'MS Sans Serif', Tahoma, Geneva, sans-serif` | `Tahoma, 'Segoe UI', sans-serif` |
| `--orion-font-size-base` | Base UI font size | `11px` | `12px` |
| `--orion-font-weight-bold`| Bold weight | `700` | `700` |
| `--orion-bg-face` | Standard panel background | `#c0c0c0` (Classic Gray) | `#ece9d8` (XP Sand) |
| `--orion-bg-light` | Bevel highlight color | `#ffffff` | `#ffffff` |
| `--orion-bg-shadow` | Bevel shadow color | `#808080` (Dark Gray) | `#aca899` (Warm Gray) |
| `--orion-bg-dark` | Bevel outer shadow color | `#000000` (Pure Black) | `#716f64` (Deep Charcoal) |
| `--orion-bg-window` | Window inner background | `#ffffff` | `#ffffff` |
| `--orion-text-main` | Primary text color | `#000000` | `#000000` |
| `--orion-text-disabled` | Disabled text color | `#808080` (with 1px #fff drop) | `#aca899` |
| `--orion-text-highlight` | Highlighted text | `#ffffff` | `#ffffff` |
| `--orion-bg-highlight` | Selection highlight background | `#000080` (Navy Blue) | `#316ac5` (XP Blue) |
| `--orion-title-active-from` | Active titlebar start | `#000080` (Navy) | `#0055ea` (Royale Blue) |
| `--orion-title-active-to` | Active titlebar end | `#1084d0` (Cyan-Navy) | `#3b88fd` (Soft Blue) |
| `--orion-title-inactive-from`| Inactive titlebar start | `#808080` | `#7697d9` |
| `--orion-title-inactive-to` | Inactive titlebar end | `#b5b5b5` | `#a5bce9` |
| `--orion-title-text` | Titlebar text color | `#ffffff` | `#ffffff` |
| `--orion-taskbar-bg` | Taskbar background | `#c0c0c0` | `linear-gradient(180deg, #1f48ab 0%, #245edb 12%, #193c94 100%)` |
| `--orion-taskbar-height` | Taskbar height | `28px` | `32px` |
| `--orion-taskbar-border` | Taskbar top border | `1px solid #ffffff` | `1px solid #0c256b` |
| `--orion-taskbar-btn-active`| Pressed taskbar button bg | `#dfdfdf` (with dither) | `linear-gradient(180deg, #122b68 0%, #1a3c91 100%)` |
| `--orion-start-btn-bg` | Start button background | `#c0c0c0` | `linear-gradient(180deg, #388e3c 0%, #2e7d32 60%, #1b5e20 100%)` |
| `--orion-start-btn-color` | Start button text color | `#000000` | `#ffffff` |
| `--orion-btn-radius` | Button corner radius | `0px` (Sharp rectangular) | `3px` (Subtle rounded) |
| `--orion-border-radius-win`| Window corner radius | `0px` | `4px 4px 0px 0px` |
| `--orion-border-outset` | 3D outset box-shadow | `inset 1px 1px #fff, inset -1px -1px #808080, 1px 1px 0px #000` | `inset 1px 1px #fff, inset -1px -1px #aca899, 1px 1px 2px rgba(0,0,0,0.15)` |
| `--orion-border-inset` | 3D inset box-shadow | `inset 1px 1px #808080, inset -1px -1px #fff, 1px 1px 0px #000 inset` | `inset 1px 1px #aca899, inset -1px -1px #fff, inset 1px 1px 2px rgba(0,0,0,0.2)` |
| `--orion-scroll-thumb` | Scrollbar thumb background | `#c0c0c0` | `linear-gradient(90deg, #eef4ff 0%, #bcd0f7 50%, #89abeb 100%)` |

---

### 2.2 Complete Implementation: `src/desktop/themes/orion48.css`
```css
/* ==========================================================================
   ORION OS 4.8 THEME (Windows 95/98 / 2000 Period Authentic Aesthetic)
   Dense, beveled gray chrome with sharp corners and pixelated typography.
   ========================================================================== */

[data-theme="orion48"] {
  --orion-font-family: "MS Sans Serif", Tahoma, Geneva, "Segoe UI", sans-serif;
  --orion-font-size-base: 11px;
  --orion-font-size-title: 11px;
  --orion-font-weight-bold: 700;

  /* Color Palette */
  --orion-bg-desktop: #008080;
  --orion-bg-face: #c0c0c0;
  --orion-bg-light: #ffffff;
  --orion-bg-shadow: #808080;
  --orion-bg-dark: #000000;
  --orion-bg-window: #ffffff;
  --orion-bg-input: #ffffff;
  --orion-bg-tooltip: #ffffe1;

  --orion-text-main: #000000;
  --orion-text-muted: #808080;
  --orion-text-highlight: #ffffff;
  --orion-text-title: #ffffff;
  --orion-text-title-inactive: #c0c0c0;
  --orion-bg-highlight: #000080;

  /* Titlebar Gradients */
  --orion-title-active-from: #000080;
  --orion-title-active-to: #1084d0;
  --orion-title-inactive-from: #808080;
  --orion-title-inactive-to: #b5b5b5;

  /* Taskbar */
  --orion-taskbar-height: 28px;
  --orion-taskbar-bg: #c0c0c0;
  --orion-taskbar-border-top: 1px solid #ffffff;
  --orion-taskbar-btn-bg: #c0c0c0;
  --orion-taskbar-btn-active: #dfdfdf;
  --orion-start-btn-bg: #c0c0c0;
  --orion-start-btn-color: #000000;

  /* Geometry & Radii */
  --orion-btn-radius: 0px;
  --orion-border-radius-win: 0px;
  --orion-border-radius-menu: 0px;

  /* 3D Bevel Shadows */
  --orion-shadow-outset: inset 1px 1px 0px #ffffff, inset -1px -1px 0px #808080, 1px 1px 0px #000000;
  --orion-shadow-inset: inset 1px 1px 0px #808080, inset -1px -1px 0px #ffffff, inset 2px 2px 0px #000000;
  --orion-shadow-button: inset 1px 1px 0px #ffffff, inset -1px -1px 0px #808080, inset 2px 2px 0px #dfdfdf, inset -2px -2px 0px #000000;
  --orion-shadow-button-pressed: inset 1px 1px 0px #000000, inset 2px 2px 0px #808080, inset -1px -1px 0px #ffffff;
  --orion-shadow-window: inset 1px 1px 0px #ffffff, inset -1px -1px 0px #000000, inset 2px 2px 0px #dfdfdf, inset -2px -2px 0px #808080;
  --orion-shadow-field: inset 1px 1px 0px #808080, inset 2px 2px 0px #000000, inset -1px -1px 0px #ffffff;
}

/* Base Bevel Utility Classes for Orion 4.8 */
[data-theme="orion48"] .orion-outset {
  background-color: var(--orion-bg-face);
  box-shadow: var(--orion-shadow-outset);
  border: 1px solid #dfdfdf;
  border-right-color: #000000;
  border-bottom-color: #000000;
}

[data-theme="orion48"] .orion-inset {
  background-color: var(--orion-bg-face);
  box-shadow: var(--orion-shadow-inset);
  border: 1px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

[data-theme="orion48"] .orion-button {
  background-color: var(--orion-bg-face);
  color: var(--orion-text-main);
  font-family: var(--orion-font-family);
  font-size: var(--orion-font-size-base);
  font-weight: normal;
  padding: 2px 8px;
  border: 1px solid #ffffff;
  border-right-color: #000000;
  border-bottom-color: #000000;
  box-shadow: inset 1px 1px 0px #dfdfdf, inset -1px -1px 0px #808080;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

[data-theme="orion48"] .orion-button:active,
[data-theme="orion48"] .orion-button.is-active {
  border: 1px solid #000000;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  box-shadow: inset 1px 1px 0px #808080, inset 2px 2px 0px #dfdfdf;
  padding: 3px 7px 1px 9px; /* 1px optical button press displacement */
}

[data-theme="orion48"] .orion-button:focus-visible {
  outline: 1px dotted #000000;
  outline-offset: -4px;
}

[data-theme="orion48"] .orion-input {
  background-color: var(--orion-bg-input);
  color: var(--orion-text-main);
  border: 1px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  box-shadow: inset 1px 1px 0px #000000, inset -1px -1px 0px #dfdfdf;
  font-family: var(--orion-font-family);
  font-size: var(--orion-font-size-base);
  padding: 3px 4px;
  outline: none;
}

[data-theme="orion48"] .orion-scrollbar::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

[data-theme="orion48"] .orion-scrollbar::-webkit-scrollbar-track {
  background: #e0e0e0;
  background-image: repeating-linear-gradient(45deg, #c0c0c0, #c0c0c0 1px, #ffffff 1px, #ffffff 2px);
}

[data-theme="orion48"] .orion-scrollbar::-webkit-scrollbar-thumb {
  background-color: #c0c0c0;
  border: 1px solid #ffffff;
  border-right-color: #000000;
  border-bottom-color: #000000;
  box-shadow: inset 1px 1px 0px #dfdfdf, inset -1px -1px 0px #808080;
}
```

---

### 2.3 Complete Implementation: `src/desktop/themes/orion60.css`
```css
/* ==========================================================================
   ORION OS 6.0 THEME (Windows XP / Royale / Luna Period Authentic Aesthetic)
   Warmer sand chrome, glossy blue/silver gradients, subtle rounded pill buttons.
   ========================================================================== */

[data-theme="orion60"] {
  --orion-font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  --orion-font-size-base: 12px;
  --orion-font-size-title: 12px;
  --orion-font-weight-bold: 700;

  /* Color Palette */
  --orion-bg-desktop: #245edb;
  --orion-bg-face: #ece9d8;
  --orion-bg-light: #ffffff;
  --orion-bg-shadow: #aca899;
  --orion-bg-dark: #716f64;
  --orion-bg-window: #ffffff;
  --orion-bg-input: #ffffff;
  --orion-bg-tooltip: #ffffe1;

  --orion-text-main: #000000;
  --orion-text-muted: #716f64;
  --orion-text-highlight: #ffffff;
  --orion-text-title: #ffffff;
  --orion-text-title-inactive: #e0e9f8;
  --orion-bg-highlight: #316ac5;

  /* Titlebar Gradients (XP Luna Royal Blue) */
  --orion-title-active-from: #0055ea;
  --orion-title-active-to: #3b88fd;
  --orion-title-inactive-from: #7697d9;
  --orion-title-inactive-to: #a5bce9;

  /* Taskbar */
  --orion-taskbar-height: 32px;
  --orion-taskbar-bg: linear-gradient(180deg, #1f48ab 0%, #245edb 10%, #1a3c94 65%, #122868 100%);
  --orion-taskbar-border-top: 1px solid #3c7bf0;
  --orion-taskbar-btn-bg: linear-gradient(180deg, #386cd4 0%, #2454b8 60%, #1e4598 100%);
  --orion-taskbar-btn-active: linear-gradient(180deg, #122a68 0%, #183a8a 60%, #204eb8 100%);
  --orion-start-btn-bg: linear-gradient(180deg, #388e3c 0%, #2e7d32 45%, #1b5e20 80%, #2e7d32 100%);
  --orion-start-btn-color: #ffffff;

  /* Geometry & Radii */
  --orion-btn-radius: 3px;
  --orion-border-radius-win: 5px 5px 0px 0px;
  --orion-border-radius-menu: 4px;

  /* XP Soft Shadows & Highlights */
  --orion-shadow-outset: 0 1px 3px rgba(0, 0, 0, 0.15), inset 0 1px 0 #ffffff;
  --orion-shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 0 1px #aca899;
  --orion-shadow-button: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 2px rgba(0, 0, 0, 0.2);
  --orion-shadow-button-pressed: inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.6);
  --orion-shadow-window: 0 4px 12px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  --orion-shadow-field: inset 0 1px 2px rgba(0, 0, 0, 0.25);
}

/* Base Bevel Utility Classes for Orion 6.0 */
[data-theme="orion60"] .orion-outset {
  background-color: var(--orion-bg-face);
  border: 1px solid #716f64;
  box-shadow: var(--orion-shadow-outset);
  border-radius: var(--orion-btn-radius);
}

[data-theme="orion60"] .orion-inset {
  background-color: var(--orion-bg-face);
  border: 1px solid #aca899;
  box-shadow: var(--orion-shadow-inset);
  border-radius: var(--orion-btn-radius);
}

[data-theme="orion60"] .orion-button {
  background: linear-gradient(180deg, #ffffff 0%, #ece9d8 50%, #d8d4c4 100%);
  color: var(--orion-text-main);
  font-family: var(--orion-font-family);
  font-size: var(--orion-font-size-base);
  border: 1px solid #003c74;
  border-radius: 3px;
  box-shadow: var(--orion-shadow-button);
  padding: 3px 12px;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: filter 0.1s ease;
}

[data-theme="orion60"] .orion-button:hover {
  background: linear-gradient(180deg, #ffffff 0%, #f7f5ec 50%, #e5e0cf 100%);
  border-color: #ff9900;
  box-shadow: 0 0 3px rgba(255, 153, 0, 0.6);
}

[data-theme="orion60"] .orion-button:active,
[data-theme="orion60"] .orion-button.is-active {
  background: linear-gradient(180deg, #d8d4c4 0%, #ece9d8 50%, #ffffff 100%);
  box-shadow: var(--orion-shadow-button-pressed);
}

[data-theme="orion60"] .orion-button:focus-visible {
  outline: 1px dotted #ff9900;
  outline-offset: -2px;
}

[data-theme="orion60"] .orion-input {
  background-color: var(--orion-bg-input);
  color: var(--orion-text-main);
  border: 1px solid #7f9db9;
  border-radius: 2px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
  font-family: var(--orion-font-family);
  font-size: var(--orion-font-size-base);
  padding: 4px 6px;
  outline: none;
}

[data-theme="orion60"] .orion-input:focus {
  border-color: #316ac5;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15), 0 0 3px rgba(49, 106, 197, 0.5);
}

[data-theme="orion60"] .orion-scrollbar::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

[data-theme="orion60"] .orion-scrollbar::-webkit-scrollbar-track {
  background: #ece9d8;
  border-left: 1px solid #d4d0c8;
}

[data-theme="orion60"] .orion-scrollbar::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, #f0f4fc 0%, #bcd0f7 50%, #8caeec 100%);
  border: 1px solid #4d7cd6;
  border-radius: 2px;
}
```

---

## 3. Desktop Shell Architecture (`DesktopShell.tsx`)

### 3.1 Wallpaper Engine
The wallpaper is rendered at the root of `DesktopShell`. Users can change wallpapers via Control Panel or Desktop Context Menu.

Presets:
1. `classic_teal`: Solid `#008080` (Canonical Orion 4.8 default).
2. `bliss_green`: Stylized XP rolling hills backdrop:
   ```css
   background: linear-gradient(180deg, #1f6fd8 0%, #64a7f5 55%, #429321 56%, #79c13b 75%, #357a15 100%);
   ```
3. `starry_night`: Deep space navy `#060818` with radial gradient glowing stars.
4. `matrix_rain`: Pure black `#000000` with subtle green grid lines (`linear-gradient(rgba(0, 255, 70, 0.07) 1px, transparent 1px)`).
5. `solid_navy`: Solid `#000080`.

### 3.2 Desktop Icon Grid & Coordinate Management
- **Icon Grid Geometry**:
  - Cell Width: `80px`
  - Cell Height: `88px`
  - Padding: `12px` top/left margin
  - Column-first placement (top-to-bottom, left-to-right, matching Windows convention).
- **Default System Shortcuts**:
  1. `my_computer`: Icon `Computer`, Label `My Computer`, opens File Explorer at `C:/`.
  2. `browser`: Icon `Globe`, Label `Voyager Browser`, opens `browser`.
  3. `pulse`: Icon `MessageSquare`, Label `Pulse Messenger`, opens `pulse` (if installed; if not, alerts user or launches installer).
  4. `terminal`: Icon `TerminalSquare`, Label `Terminal CLI`, opens `terminal`.
  5. `control_panel`: Icon `Sliders`, Label `Control Panel`, opens `controlpanel`.
  6. `trash`: Dynamic Icon `Trash2` (Empty if `vfs` trash is empty, full trash icon if $>0$ items), Label `Recycle Bin`, opens `trash`.
- **Dynamic VFS & Installed Software Shortcuts**:
  - The shell inspects `state.vfs.files` with parent path `C:/Desktop` and `state.installedSoftware`.
  - Any desktop file (e.g. `PulseSetup.exe`, `Notes.txt`, `FlashFetch.lnk`) automatically creates a draggable icon.
- **Icon State & Drag & Drop**:
  - Single click: Selects icon (dashed dotted border around icon + blue text highlight box).
  - Double click: Opens target window/app via `useWindowStore.openWindow(appId)`.
  - Dragging: Freeform or grid-snap repositioning with saved coordinates stored in local component state.
  - Multi-select: Marquee selection or Shift/Ctrl click.

### 3.3 Selection Marquee (Lasso)
- When clicking on empty desktop canvas and dragging:
  - Tracks `startPos = {x, y}` and `currentPos = {x, y}`.
  - Renders a semi-transparent blue box (`background: rgba(49, 106, 197, 0.2); border: 1px dashed #316ac5;`).
  - Computes rectangular collision with all desktop icon bounding boxes. Any intersecting icon gains `isSelected: true`.

### 3.4 Desktop Context Menu
- Right-click on empty desktop background opens a retro beveled popup menu at cursor `(x, y)`:
  - **Arrange Icons By** $\to$ `[Name, Size, Type, Date Modified]`
  - **Refresh** $\to$ Plays click audio and resets layout.
  - **New** $\to$ `Text Document` (dispatches `VFS_CREATE_FILE` creating `C:/Desktop/New Text Document.txt`), `Folder`.
  - **Properties** $\to$ Opens `ControlPanel` to the Display settings tab.

### 3.5 Detailed Component Specification: `DesktopShell.tsx`
```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useWindowStore } from '../store/useWindowStore';
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
} from 'lucide-react';

export type WallpaperPreset = 'classic_teal' | 'bliss_green' | 'starry_night' | 'matrix_rain' | 'solid_navy';

export interface DesktopIconItem {
  id: string;
  label: string;
  appId: string;
  iconType: 'computer' | 'browser' | 'pulse' | 'terminal' | 'control' | 'trash' | 'text' | 'installer' | 'folder';
  filePath?: string;
  gridX: number; // Column index (0, 1, 2...)
  gridY: number; // Row index (0, 1, 2...)
  posX?: number; // Absolute X if freely moved
  posY?: number; // Absolute Y if freely moved
}

export const DesktopShell: React.FC = () => {
  const osVersion = useSimulationStore((s) => s.hardware.osVersion);
  const vfsFiles = useSimulationStore((s) => s.vfs.files);
  const installedSoftware = useSimulationStore((s) => s.installedSoftware);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [wallpaper, setWallpaper] = useState<WallpaperPreset>(
    osVersion === 'Orion_6.0' ? 'bliss_green' : 'classic_teal'
  );
  const [selectedIconIds, setSelectedIconIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number; active: boolean } | null>(null);
  const [isDialUpModalOpen, setIsDialUpModalOpen] = useState(false);

  // Derive theme attribute
  const themeAttr = osVersion === 'Orion_6.0' ? 'orion60' : 'orion48';

  // Desktop Icons Computation
  const [iconPositions, setIconPositions] = useState<Record<string, { x: number; y: number }>>({});

  // System base icons
  const baseIcons: DesktopIconItem[] = [
    { id: 'sys_computer', label: 'My Computer', appId: 'fileexplorer', iconType: 'computer', gridX: 0, gridY: 0 },
    { id: 'sys_browser', label: 'Voyager Browser', appId: 'browser', iconType: 'browser', gridX: 0, gridY: 1 },
    { id: 'sys_pulse', label: 'Pulse Messenger', appId: 'pulse', iconType: 'pulse', gridX: 0, gridY: 2 },
    { id: 'sys_terminal', label: 'Terminal CLI', appId: 'terminal', iconType: 'terminal', gridX: 0, gridY: 3 },
    { id: 'sys_control', label: 'Control Panel', appId: 'controlpanel', iconType: 'control', gridX: 0, gridY: 4 },
    { id: 'sys_trash', label: 'Recycle Bin', appId: 'trash', iconType: 'trash', gridX: 0, gridY: 5 },
  ];

  // Dynamic VFS icons in C:/Desktop
  const desktopVfsIcons: DesktopIconItem[] = Object.values(vfsFiles)
    .filter((f) => f.parentPath === 'C:/Desktop')
    .map((f, idx) => ({
      id: `vfs_${f.id}`,
      label: f.name,
      appId: f.kind === 'executable' || f.kind === 'installer' ? (f.appAssociation || 'fileexplorer') : 'notepad',
      filePath: f.path,
      iconType: f.kind === 'installer' ? 'installer' : f.kind === 'directory' ? 'folder' : 'text',
      gridX: 1,
      gridY: idx,
    }));

  const allIcons = [...baseIcons, ...desktopVfsIcons];

  // Handle icon double click
  const handleIconDoubleClick = (icon: DesktopIconItem) => {
    soundManager.play('click');
    if (icon.appId === 'notepad' && icon.filePath) {
      openWindow('notepad', { filePath: icon.filePath, title: `Notepad - ${icon.label}` });
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
              className={`desktop-icon absolute flex flex-col items-center justify-center w-18 p-1 cursor-pointer transition-none ${
                isSelected ? 'bg-orion-highlight/30 border border-dotted border-white' : 'hover:bg-white/10'
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
                  isSelected ? 'bg-orion-highlight text-white' : 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
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
            className="text-left px-3 py-1 hover:bg-orion-highlight hover:text-white flex items-center justify-between"
            onClick={() => {
              setContextMenu(null);
            }}
          >
            <span>Arrange Icons</span>
            <span>▸</span>
          </button>
          <button
            className="text-left px-3 py-1 hover:bg-orion-highlight hover:text-white"
            onClick={() => {
              soundManager.play('click');
              setContextMenu(null);
            }}
          >
            Refresh
          </button>
          <div className="h-[1px] bg-[#808080] my-0.5 border-b border-white" />
          <button
            className="text-left px-3 py-1 hover:bg-orion-highlight hover:text-white"
            onClick={() => {
              openWindow('controlpanel', { tab: 'display' });
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
      <CRTOverlay />
    </div>
  );
};

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

function renderIconGraphic(type: DesktopIconItem['iconType'], theme: string) {
  const color = theme === 'orion60' ? '#245edb' : '#ffffff';
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
  }
}
```

---

## 4. Taskbar Architecture (`Taskbar.tsx`)

### 4.1 Visual & Layout Specifications
- **Position**: `fixed bottom-0 left-0 right-0 w-full z-40`.
- **Dimensions**:
  - Orion 4.8: `height: 28px`.
  - Orion 6.0: `height: 32px`.
- **Three Core Sections**:
  1. **Start Button Section** (Left):
     - Orion 4.8: Beveled gray button (`outset`), Orion 4-color flag icon, bold text "Start".
     - Orion 6.0: Curved pill-shaped emerald button, Orion logo, italic white text "start".
     - Active / pressed toggle opens `StartMenu.tsx`.
  2. **Quick Launch & Window Switcher Section** (Middle):
     - Quick launch shortcuts (Show Desktop, Voyager Browser, Pulse Messenger).
     - Running Application Tabs mapped from `useWindowStore(s => s.windows)`:
       - Displays app icon + title.
       - Max tab width: `160px` with ellipsis truncation.
       - Active/Focused window: Inset bevel with dither texture (4.8) or dark glossy navy inset (6.0).
       - Inactive / Minimized window: Outset bevel (4.8) or lighter blue pill (6.0).
       - Clicking behavior:
         - If minimized $\to$ Restore & Focus.
         - If active & focused $\to$ Minimize.
         - If active & unfocused $\to$ Bring to front & Focus.
       - Right-click context menu on tab: `Restore`, `Minimize`, `Maximize`, `Close`.
  3. **System Tray Section** (Right):
     - Inset bevel recessed box containing `SystemTray.tsx` (Live Clock, Volume Slider, Network Activity).

### 4.2 Detailed Component Specification: `Taskbar.tsx`
```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useWindowStore } from '../store/useWindowStore';
import { soundManager } from '../audio/SoundManager';
import { StartMenu } from './StartMenu';
import { SystemTray } from './SystemTray';
import { Globe, MessageSquare, LayoutGrid, X, Minus, Square } from 'lucide-react';

interface TaskbarProps {
  onOpenDialUp: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({ onOpenDialUp }) => {
  const osVersion = useSimulationStore((s) => s.hardware.osVersion);
  const { windows, activeWindowId, focusWindow, toggleMinimize, closeWindow } = useWindowStore();

  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{ windowId: string; x: number; y: number } | null>(null);

  const startButtonRef = useRef<HTMLButtonElement>(null);
  const isOrion6 = osVersion === 'Orion_6.0';

  // Toggle Start Menu
  const handleStartToggle = () => {
    soundManager.play('click');
    setIsStartMenuOpen((prev) => !prev);
  };

  // Close Start Menu on click outside
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

  return (
    <>
      {/* Start Menu Pop-up */}
      {isStartMenuOpen && (
        <StartMenu
          isOpen={isStartMenuOpen}
          onClose={() => setIsStartMenuOpen(false)}
          onOpenDialUp={onOpenDialUp}
        />
      )}

      {/* Taskbar Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 w-full z-40 flex items-center px-1 select-none ${
          isOrion6
            ? 'h-8 bg-gradient-to-b from-[#1f48ab] via-[#245edb] to-[#122868] border-t border-[#3c7bf0]'
            : 'h-7 bg-[#c0c0c0] border-t border-white shadow-[inset_0_1px_0_#dfdfdf]'
        }`}
      >
        {/* 1. Start Button */}
        <button
          ref={startButtonRef}
          onClick={handleStartToggle}
          className={`flex items-center gap-1.5 px-2 py-0.5 font-bold cursor-pointer transition-none ${
            isOrion6
              ? `h-7 rounded-r-xl rounded-l-md px-3 text-white italic text-[13px] bg-gradient-to-b from-[#388e3c] via-[#2e7d32] to-[#1b5e20] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_3px_rgba(0,0,0,0.3)] hover:brightness-110 ${
                  isStartMenuOpen ? 'brightness-90 shadow-inner' : ''
                }`
              : `h-5.5 text-black text-[11px] orion-button ${
                  isStartMenuOpen ? 'is-active' : ''
                }`
          }`}
        >
          {/* Orion Flag Icon */}
          <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
            <div className="bg-red-500 rounded-[0.5px]" />
            <div className="bg-green-500 rounded-[0.5px]" />
            <div className="bg-blue-500 rounded-[0.5px]" />
            <div className="bg-yellow-400 rounded-[0.5px]" />
          </div>
          <span>{isOrion6 ? 'start' : 'Start'}</span>
        </button>

        {/* 2. Quick Launch Separator */}
        <div className={`mx-1.5 h-4 w-[2px] ${isOrion6 ? 'bg-[#193c94] border-r border-[#3c7bf0]' : 'border-l border-[#808080] border-r border-white'}`} />

        {/* 3. Window Tabs */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar h-full py-0.5">
          {windows.map((win) => {
            const isActive = activeWindowId === win.id && !win.isMinimized;

            return (
              <button
                key={win.id}
                onClick={() => {
                  soundManager.play('click');
                  if (win.isMinimized) {
                    toggleMinimize(win.id);
                    focusWindow(win.id);
                  } else if (isActive) {
                    toggleMinimize(win.id);
                  } else {
                    focusWindow(win.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabContextMenu({ windowId: win.id, x: e.clientX, y: e.clientY - 80 });
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 max-w-[160px] min-w-[100px] h-full text-left truncate text-[11px] cursor-pointer transition-none ${
                  isOrion6
                    ? `rounded-t-sm ${
                        isActive
                          ? 'bg-gradient-to-b from-[#122a68] to-[#1e4598] text-white shadow-inner border-t border-[#0c1f4e]'
                          : 'bg-gradient-to-b from-[#386cd4] to-[#1e4598] text-gray-100 hover:brightness-110'
                      }`
                    : `${
                        isActive
                          ? 'orion-inset bg-[#dfdfdf] font-bold text-black'
                          : 'orion-button text-black'
                      }`
                }`}
              >
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-xs">
                  {win.icon || '🗂️'}
                </span>
                <span className="truncate flex-1">{win.title}</span>
              </button>
            );
          })}
        </div>

        {/* 4. Tab Context Menu */}
        {tabContextMenu && (
          <div
            className="absolute z-50 orion-outset p-1 min-w-[120px] flex flex-col gap-0.5 text-black shadow-lg"
            style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="text-left px-2 py-1 hover:bg-orion-highlight hover:text-white flex items-center gap-1.5"
              onClick={() => {
                toggleMinimize(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <Minus className="w-3 h-3" />
              <span>Minimize</span>
            </button>
            <button
              className="text-left px-2 py-1 hover:bg-orion-highlight hover:text-white flex items-center gap-1.5"
              onClick={() => {
                focusWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <Square className="w-3 h-3" />
              <span>Restore</span>
            </button>
            <div className="h-[1px] bg-[#808080] my-0.5 border-b border-white" />
            <button
              className="text-left px-2 py-1 hover:bg-red-700 hover:text-white flex items-center gap-1.5 text-red-900 font-bold"
              onClick={() => {
                closeWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <X className="w-3 h-3" />
              <span>Close</span>
            </button>
          </div>
        )}

        {/* 5. System Tray */}
        <SystemTray onOpenDialUp={onOpenDialUp} />
      </div>
    </>
  );
};
```

---

## 5. Start Menu Architecture (`StartMenu.tsx`)

### 5.1 Structure & Submenu Cascading
The Start Menu supports both Orion 4.8 and Orion 6.0 visuals:
- **Orion 4.8 Menu**:
  - Vertical navy sidebar banner (`writing-mode: vertical-lr; transform: rotate(180deg)`) reading `Orion 98`.
  - Classic menu list with chevron arrows for cascading submenus:
    - **Programs** $\to$
      - **Accessories** $\to$ `Notepad`, `Terminal CLI`, `Paint`
      - **Internet & Social** $\to$ `Voyager Browser`, `Pulse Messenger`
      - **System Tools** $\to$ `Add/Remove Programs`, `File Explorer`, `Disk Defragmenter`
    - **Documents** $\to$ Lists recent files in `C:/Documents`
    - **Settings** $\to$ `Control Panel`, `Display Properties`, `Dial-up Networking`
    - **Find** $\to$ `Files or Folders...`
    - **Help & Support**
    - **Run...** (Opens Run command dialog)
    - Separator
    - **Shut Down...** (Opens Shut Down dialog)
- **Orion 6.0 Menu**:
  - Top header banner with Player Avatar and Name ("Player").
  - Dual columns:
    - Left column: Frequent programs (Voyager Browser, Pulse Messenger, Notepad, Terminal, RetroAmp).
    - Right column: System folders (My Documents, My Computer, Control Panel, Help & Support, Run).
  - Bottom bar: Log Off and Turn Off Computer.

### 5.2 Run Command Dialog & Shut Down Dialog
- **Run Dialog**:
  - Text input where user can type commands:
    - `notepad` $\to$ opens NotepadApp.
    - `terminal` or `cmd` $\to$ opens TerminalApp.
    - `browser` or `voyager` $\to$ opens Voyager Browser.
    - `control` $\to$ opens Control Panel.
    - URL like `http://findit.local` $\to$ opens browser navigated to that URL!
- **Shut Down Dialog**:
  - Options:
    1. "Shut Down" $\to$ Prompts save game and returns to room or title screen.
    2. "Restart" $\to$ Simulates PC reboot (plays chime, advances 2 minutes).
    3. "Standby / Sleep" $\to$ Triggers `PLAYER_REST_OR_SLEEP` action advancing to next morning!

### 5.3 Detailed Component Specification: `StartMenu.tsx`
```tsx
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
  HelpCircle,
  PlaySquare,
  Power,
  Search,
  Monitor,
  User,
  LogOut,
} from 'lucide-react';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDialUp: () => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onOpenDialUp }) => {
  const osVersion = useSimulationStore((s) => s.hardware.osVersion);
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="shutdown_opt" />
                <span>Save game and return to title</span>
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
```

---

## 6. System Tray Architecture (`SystemTray.tsx`)

### 6.1 Mini-Utilities Breakdown
The System Tray resides in the bottom right of the taskbar inside an inset bevel recessed panel.

1. **Simulation Clock**:
   - Subscribes to `useSimulationStore(s => s.time)` (`hour`, `minute`, `day`, `isWeekend`, `timeOfDay`).
   - Formats live time as `HH:MM AM/PM` (e.g. `08:15 AM`) or 24-hour mode.
   - Hover tooltip: `Day ${time.day} (${getWeekday(time.day)}) - ${time.timeOfDay.toUpperCase()}`.
2. **Master Volume Slider Popup**:
   - Subscribes to `useAudioStore` / `SoundManager.getSettings()`.
   - Speaker icon changes: `Volume2` (normal), `Volume1` (low), `VolumeX` (muted).
   - Clicking speaker icon toggles a vertical retro volume fader box (0% to 100%) with a "Mute" checkbox.
3. **Dial-Up / Network Status & Blink Indicators**:
   - Renders two retro CRT modem LEDs: **TX** (Transmit) and **RX** (Receive).
   - LED Logic:
     - When any `DownloadTask` has `status: 'downloading'`, both TX and RX flash alternating green/amber (`#33ff33` / `#ffb000`) every 200ms.
     - When idle but connected: steady faint green.
     - When disconnected: gray `#808080`.
   - Hover tooltip: `${connectionType.toUpperCase()} (${connectionSpeedKbps} kbps) - ${activeDownloadsCount} Active Downloads`.
   - Double-clicking or clicking the network icon opens `DialUpModal.tsx`.
4. **RAM / Resource Pressure Mini-Meter (Optional Alert)**:
   - When RAM pressure ratio $> 0.80$, shows a small blinking chip warning icon with tooltip: `Elevated RAM Pressure (${Math.round(ratio * 100)}%)`.

### 6.2 Detailed Component Specification: `SystemTray.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { soundManager } from '../audio/SoundManager';
import { Volume2, VolumeX, Volume1, Wifi, HardDrive, AlertTriangle } from 'lucide-react';

interface SystemTrayProps {
  onOpenDialUp: () => void;
}

export const SystemTray: React.FC<SystemTrayProps> = ({ onOpenDialUp }) => {
  const time = useSimulationStore((s) => s.time);
  const hardware = useSimulationStore((s) => s.hardware);
  const downloads = useSimulationStore((s) => s.downloads);

  const [isVolumePopupOpen, setIsVolumePopupOpen] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [txBlink, setTxBlink] = useState(false);
  const [rxBlink, setRxBlink] = useState(false);

  // Sync with SoundManager settings
  useEffect(() => {
    const settings = soundManager.getSettings();
    setMasterVolume(settings.masterVolume);
    setIsMuted(settings.isMuted);
  }, []);

  // Blinking modem LEDs during active downloads
  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  useEffect(() => {
    if (activeDownloads.length === 0) {
      setTxBlink(false);
      setRxBlink(false);
      return;
    }
    const interval = setInterval(() => {
      setTxBlink((prev) => !prev);
      setRxBlink(Math.random() > 0.3);
    }, 250);
    return () => clearInterval(interval);
  }, [activeDownloads.length]);

  const handleVolumeChange = (newVol: number) => {
    setMasterVolume(newVol);
    soundManager.setMasterVolume(newVol);
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setMute(nextMuted);
    soundManager.play('click');
  };

  // Format Clock: HH:MM AM/PM
  const formatTime = () => {
    const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
    const ampm = time.hour >= 12 ? 'PM' : 'AM';
    const minuteStr = time.minute.toString().padStart(2, '0');
    return `${hour12}:${minuteStr} ${ampm}`;
  };

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentWeekday = weekdays[(time.day - 1) % 7];

  return (
    <div className="relative flex items-center gap-2 px-2 py-0.5 orion-inset bg-[#c0c0c0]/40 text-black text-[11px] h-full select-none">
      {/* 1. Network Activity Monitor */}
      <div
        className="flex items-center gap-1 cursor-pointer px-1 py-0.5 hover:bg-white/20 rounded"
        title={`${hardware.connectionType.toUpperCase()} (${hardware.connectionSpeedKbps} kbps) - ${
          activeDownloads.length
        } active download(s)`}
        onClick={onOpenDialUp}
      >
        <div className="flex items-center gap-0.5">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              txBlink ? 'bg-[#33ff33] shadow-[0_0_4px_#33ff33]' : 'bg-[#1b5e20]'
            }`}
            title="TX (Transmit)"
          />
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              rxBlink ? 'bg-[#ffb000] shadow-[0_0_4px_#ffb000]' : 'bg-[#7f4f00]'
            }`}
            title="RX (Receive)"
          />
        </div>
        <Wifi className="w-3.5 h-3.5 text-gray-700" />
      </div>

      {/* 2. Volume Popup Trigger */}
      <div className="relative">
        <button
          className="flex items-center cursor-pointer p-0.5 hover:bg-white/20 rounded"
          onClick={() => setIsVolumePopupOpen((prev) => !prev)}
          title="Master Volume"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-red-600" />
          ) : masterVolume > 0.5 ? (
            <Volume2 className="w-3.5 h-3.5 text-gray-800" />
          ) : (
            <Volume1 className="w-3.5 h-3.5 text-gray-800" />
          )}
        </button>

        {/* Vertical Volume Slider Popup */}
        {isVolumePopupOpen && (
          <div
            className="absolute bottom-8 right-0 z-50 orion-outset bg-[#c0c0c0] p-2 flex flex-col items-center gap-2 shadow-xl w-24 text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-bold">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 [writing-mode:bt-lr] h-24 accent-blue-700 cursor-pointer"
            />
            <label className="flex items-center gap-1 text-[10px] cursor-pointer">
              <input type="checkbox" checked={isMuted} onChange={handleMuteToggle} />
              <span>Mute</span>
            </label>
          </div>
        )}
      </div>

      {/* 3. Live Simulation Clock */}
      <div
        className="font-mono text-[11px] px-1 cursor-default text-black drop-shadow-xs"
        title={`Day ${time.day} (${currentWeekday}) • ${time.timeOfDay.toUpperCase()}`}
      >
        {formatTime()}
      </div>
    </div>
  );
};
```

---

## 7. Dial-Up & Broadband Connection Manager (`DialUpModal.tsx`)

### 7.1 10-Stage Handshake State Machine
The `DialUpModal` reproduces the period-authentic modem handshake sequence synchronized directly with `soundManager.playDialup()`.

```
[IDLE]
  │ (User clicks "Connect")
  ▼
[STAGE 1: DIALING] ────> Plays Dial Tone (350Hz+440Hz) + DTMF digits (555-0199) (1.3s)
  │
  ▼
[STAGE 2: RINGBACK] ───> Waiting for carrier ring (440Hz+480Hz) (1.2s)
  │
  ▼
[STAGE 3: ANSWER] ─────> Remote CED Answering Tone (2100Hz) (1.8s)
  │
  ▼
[STAGE 4: PROBING] ────> V.34 Dual-frequency line probing (1.5s)
  │
  ▼
[STAGE 5: NOISE HASH] ─> White noise & bandpass line equalization (3.2s)
  │
  ▼
[STAGE 6: TRELLIS] ────> Trellis modulation squeals & baud rate negotiation (2.0s)
  │
  ▼
[STAGE 7: CARRIER] ────> Carrier verification & drop (0.4s)
  │
  ▼
[STAGE 8: AUTH] ───────> Validating credentials (player@orionisp.local) (0.5s)
  │
  ▼
[STAGE 9: SUCCESS] ────> Plays Dual-tone chime (D5+A5) & establishes connection
  │
  ▼
[CONNECTED] (56,000 bps / DSL Tier active)
```

### 7.2 Detailed Component Specification: `DialUpModal.tsx`
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { soundManager } from '../audio/SoundManager';
import { ConnectionType } from '../engine/types';
import { Phone, Wifi, ShieldCheck, AlertCircle, X } from 'lucide-react';

interface DialUpModalProps {
  onClose: () => void;
}

type HandshakeStage =
  | 'idle'
  | 'dialing'
  | 'ringback'
  | 'answering'
  | 'probing'
  | 'scrambling'
  | 'trellis'
  | 'authenticating'
  | 'connected'
  | 'error';

export const DialUpModal: React.FC<DialUpModalProps> = ({ onClose }) => {
  const hardware = useSimulationStore((s) => s.hardware);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [selectedTier, setSelectedTier] = useState<ConnectionType>(hardware.connectionType);
  const [stage, setStage] = useState<HandshakeStage>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to connect.');
  const [progressPercent, setProgressPercent] = useState(0);

  const cancelAudioRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelAudioRef.current) {
        cancelAudioRef.current();
      }
    };
  }, []);

  const handleConnect = () => {
    soundManager.play('click');
    setStage('dialing');
    setStatusMessage('Dialing 555-0199 (OrionNet FastDial ISP)...');
    setProgressPercent(10);

    // Trigger procedural Web Audio handshake
    const audioHandle = soundManager.playDialup(() => {
      setStage('connected');
      setStatusMessage('Connected at 56,000 bps. Line compression: V.42bis active.');
      setProgressPercent(100);
      dispatchAction({
        type: 'HARDWARE_UPGRADE_CONNECTION',
        connectionType: selectedTier,
        cost: 0,
      });
    });
    cancelAudioRef.current = audioHandle.cancel;

    // Timed progression synchronized with SynthAudio timing
    setTimeout(() => {
      setStage('ringback');
      setStatusMessage('Waiting for carrier ringback...');
      setProgressPercent(25);
    }, 2200);

    setTimeout(() => {
      setStage('answering');
      setStatusMessage('Carrier detected. CED Answer Tone received (2100 Hz)...');
      setProgressPercent(40);
    }, 3800);

    setTimeout(() => {
      setStage('probing');
      setStatusMessage('Probing line quality & V.34 frequencies...');
      setProgressPercent(60);
    }, 5500);

    setTimeout(() => {
      setStage('trellis');
      setStatusMessage('Negotiating Trellis baud rate & equalizer...');
      setProgressPercent(80);
    }, 7200);

    setTimeout(() => {
      setStage('authenticating');
      setStatusMessage('Verifying username and password on OrionNet...');
      setProgressPercent(92);
    }, 8500);
  };

  const handleDisconnect = () => {
    soundManager.play('click');
    if (cancelAudioRef.current) {
      cancelAudioRef.current();
      cancelAudioRef.current = null;
    }
    setStage('idle');
    setStatusMessage('Disconnected.');
    setProgressPercent(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="orion-outset bg-[#c0c0c0] w-[420px] p-2 shadow-2xl text-black">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-2 py-1 font-bold flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <span>Connect OrionNet FastDial</span>
          </div>
          <button
            className="orion-button h-4 w-4 text-[10px] font-bold p-0 leading-none"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="flex flex-col gap-3 p-1">
          {/* User Credentials Box */}
          <div className="orion-inset bg-white p-2.5 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold">User name:</span>
              <input
                type="text"
                readOnly
                value="player@orionisp.local"
                className="orion-input w-52 bg-gray-100"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">Password:</span>
              <input
                type="password"
                readOnly
                value="••••••••••••"
                className="orion-input w-52 bg-gray-100"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">Dial Number:</span>
              <input
                type="text"
                readOnly
                value="555-0199"
                className="orion-input w-52 bg-gray-100 font-mono"
              />
            </div>
          </div>

          {/* Connection Speed Tier Selector */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">Connection Tier:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as ConnectionType)}
              disabled={stage !== 'idle' && stage !== 'connected'}
              className="orion-input w-52 bg-white"
            >
              <option value="dialup_56k">Dial-up 56k (56 kbps)</option>
              <option value="dsl_256k">Starter DSL (256 kbps)</option>
              <option value="dsl_512k">Fast DSL (512 kbps)</option>
              <option value="dsl_1m">Turbo Broadband (1.0 Mbps)</option>
            </select>
          </div>

          {/* Progress & Handshake Status */}
          <div className="orion-inset bg-gray-100 p-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold">Status:</span>
              <span className="text-gray-700 font-mono truncate max-w-[280px]">{statusMessage}</span>
            </div>

            {/* Retro Progress Bar */}
            <div className="orion-inset bg-white h-4 w-full p-0.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#000080] via-[#1084d0] to-[#316ac5] transition-all duration-300 flex items-center justify-center text-[9px] text-white font-bold"
                style={{ width: `${progressPercent}%` }}
              >
                {progressPercent > 15 ? `${progressPercent}%` : ''}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 mt-1">
            {stage === 'idle' || stage === 'error' ? (
              <button
                className="orion-button min-w-[80px] font-bold"
                onClick={handleConnect}
              >
                Dial
              </button>
            ) : stage === 'connected' ? (
              <button
                className="orion-button min-w-[80px] font-bold text-red-800"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            ) : (
              <button
                className="orion-button min-w-[80px] font-bold text-red-800"
                onClick={handleDisconnect}
              >
                Cancel
              </button>
            )}

            <button
              className="orion-button min-w-[80px]"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 8. Integration Points, Store Hooks & Event Flow

### 8.1 Simulation & Window Manager Flow
1. **Theme Dynamic Switching**:
   - `useSimulationStore(s => s.hardware.osVersion)` triggers root container attribute update `data-theme="orion48"` vs `data-theme="orion60"`.
   - All child components (`WindowFrame`, `DesktopShell`, `Taskbar`, `StartMenu`) immediately inherit the corresponding typography, color variables, borders, and button geometries.
2. **App Launching via Desktop, Start Menu, or Run Dialog**:
   - Calling `useWindowStore.openWindow(appId, customState)` registers or focuses a `WindowInstance` in the window manager.
   - `Taskbar` automatically derives a new taskbar tab with matching icon and title.
3. **Audio Feedback**:
   - User interactions (button presses, tab switches, minimize/maximize) route through `soundManager.play('click')` / `soundManager.play('window_minimize')` to maintain rich diegetic tactile sound.
4. **VFS File Creation via Desktop Context Menu**:
   - Choosing "New -> Text Document" dispatches `VFS_CREATE_FILE` to `SimulationEngine`.
   - The file appears dynamically on the desktop canvas as a new draggable icon!

---

## 9. Verification & Acceptance Criteria

### 9.1 Period Authenticity & Visual Polish
- [x] **Orion OS 4.8 Theme**: High-contrast gray 3D bevels (`#ffffff`, `#808080`, `#000000`), 28px taskbar, sharp button corners, dotted focus rings, pixelated titlebars.
- [x] **Orion OS 6.0 Theme**: Rounded button geometry, warm sand chrome (`#ece9d8`), Royale blue gradient titlebars, 32px dock/taskbar, green curved Start button.
- [x] **Desktop Icon Grid**: Column-first top-to-bottom layout, multi-selection marquee, and dynamic shortcut discovery from `C:/Desktop`.
- [x] **Cascading Start Menu**: Submenus for Programs, Documents, Settings, Run dialog, and Shut Down options with click-outside dismissal.
- [x] **System Tray**: Live clock updating in simulation real-time, master volume popup, and TX/RX blinking LED activity indicator.
- [x] **Dial-Up Simulation**: 10-phase handshake synchronized with Web Audio synthesizer and connection speed gating.

# Dispatch Assignment — Worker M2

**Assigned Agent**: worker_m2
**Role**: teamwork_preview_worker
**Working Directory**: f:/_WIP/away-message/.agents/worker_m2/
**Parent**: orchestrator_1 (39d67808-5c38-467e-ba13-2fc112f01e1c)

## Mission: Build Milestone 2 (Desktop Environment, Window Manager & OS Shells)

Implement all components and tests designed by Explorers M2-1, M2-2, and M2-3:
1. **Zustand Stores (`src/store/`)**:
   - `useSimulationStore.ts`: Bridges `SimulationEngine` to React components with selectors, action dispatchers, and `useSimulationTicker` animation frame loop.
   - `useWindowStore.ts`: Window management store (open, close, minimize, maximize, restore, focus, zIndex, cascade, drag coordinates, resize bounds).
   - `useAudioStore.ts`: SoundManager bridge, UI sound triggers, volume and mute state.
2. **Themes (`src/desktop/themes/`)**:
   - `orion48.css`: Win95/98 dense beveled gray border UI, classic buttons, 28px taskbar.
   - `orion60.css`: XP-style warmer blue/silver styling, smooth gradients, 32px taskbar.
3. **Desktop Shell & Chrome (`src/desktop/`)**:
   - `WindowFrame.tsx`: Retro window chrome with titlebar, app icon, active/inactive headers, minimize/maximize/close buttons, pointer-capture dragging, 8-handle resizing.
   - `WindowManager.tsx`: Container component rendering open windows mapped to apps.
   - `DesktopShell.tsx`: Desktop wallpaper selector, draggable desktop icons linked to `C:/Desktop` VFS files and software shortcuts, marquee selection, context menu.
   - `Taskbar.tsx`: Start button, active window tabs with pressed/active state, quick launch, system tray.
   - `StartMenu.tsx`: Cascading start menu with Programs, Documents, Settings, Run command dialog, and Shut Down dialog.
   - `SystemTray.tsx`: Taskbar clock, volume slider popup, dial-up status icon with blinking LED indicators.
   - `CRTOverlay.tsx`: Retro scanlines, CRT screen curvature distortion, and phosphor bloom toggle.
   - `DialUpModal.tsx`: Dial-up connection dialog with 10-phase handshake progress and audio sync.
4. **Core System Applications (`src/apps/`)**:
   - `src/apps/terminal/TerminalApp.tsx`: Interactive CLI with `help`, `dir`, `cd`, `type`, `cls`, `ping`, `tracert`, `ipconfig`, `unzip`, `ver`.
   - `src/apps/fileexplorer/FileExplorerApp.tsx`: Folder navigation, file list/grid, open text files in Notepad, run executables, delete/restore to trash.
   - `src/apps/controlpanel/ControlPanelApp.tsx`: Display properties (theme switcher 4.8 $\leftrightarrow$ 6.x, wallpaper selector, CRT toggle), Sound settings, System info (CPU, RAM, HDD storage pie chart).
   - `src/apps/addremove/AddRemoveApp.tsx`: Installed software list with sizes, uninstall wizard trigger.
   - `src/apps/notepad/NotepadApp.tsx`: Text file editor with open, edit, save to VFS.
   - `src/apps/trash/TrashApp.tsx`: Recycle bin viewer, restore item to original path, empty trash with space reclamation.
5. **App Wiring (`src/App.tsx`, `src/main.tsx`)**:
   - Assemble DesktopShell, WindowManager, CRTOverlay, and DialUpModal into a complete interactive desktop experience.
6. **Unit & Integration Test Suites (`tests/unit/`)**:
   - `tests/unit/WindowManager.test.ts`
   - `tests/unit/TerminalApp.test.ts`
   - `tests/unit/FileExplorerApp.test.ts`
   - `tests/unit/ControlPanelApp.test.ts`

## Commands to Run
- `npm run build`
- `npm test`

All tests must pass 100% with zero mock shortcuts.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

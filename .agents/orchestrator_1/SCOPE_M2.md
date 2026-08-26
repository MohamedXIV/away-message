# Scope: Milestone 2 — Desktop Environment & OS Systems (Orion 4.8 & Orion 6.x)

## 1. Objective
Implement the complete, interactive Desktop OS environment in React + TypeScript + Tailwind CSS with retro styling, window management, dual OS themes (Orion 4.8 vs Orion 6.x), CRT shaders, dial-up simulation, and core system utilities (Add/Remove Programs, Terminal, File Explorer, Control Panel, Notepad, Trash).

## 2. Deliverables & File Boundaries
1. **Reactive Stores (`src/store/`)**:
   - `useSimulationStore.ts`: Bridges `SimulationEngine` state subscriptions to React view models.
   - `useWindowStore.ts`: Window manager state (open, minimize, maximize, focus, zIndex, position, size, cascade).
   - `useAudioStore.ts`: Sound effects and volume controls.
2. **Desktop OS Shell & Themes (`src/desktop/`)**:
   - `themes/orion48.css` & `themes/orion60.css`: Retro CSS variables and styling for Win95/98 beveled controls vs XP-style warm gradients.
   - `WindowFrame.tsx`: Window frame with title bar, minimize/maximize/close buttons, resizing handles, active/inactive styling.
   - `WindowManager.tsx`: Root window container rendering all active windows with z-index stacking and boundary clamping.
   - `DesktopShell.tsx`: Desktop wallpaper, grid/free icon layout, selection marquee, context menu.
   - `Taskbar.tsx`: Start button, active window tabs, quick launch icons, system tray.
   - `StartMenu.tsx`: Cascading start menu with Programs, Settings, Find, Run, Shut Down.
   - `SystemTray.tsx`: Taskbar clock, volume popup, connection status icon.
   - `CRTOverlay.tsx`: Retro scanlines, CRT screen curvature distortion, and phosphor bloom toggles.
   - `DialUpModal.tsx`: Dial-up connection dialog with 10-phase handshake sound trigger and status.
3. **Core System Applications (`src/apps/`)**:
   - `terminal/TerminalApp.tsx`: Interactive CLI with `help`, `dir`, `cd`, `type`, `cls`, `ping`, `tracert`, `ipconfig`, `unzip`.
   - `fileexplorer/FileExplorerApp.tsx`: Folder navigation, file list, run executables, delete/restore to trash.
   - `controlpanel/ControlPanelApp.tsx`: Display properties (theme switcher 4.8 $\leftrightarrow$ 6.x, wallpaper, CRT toggle), Sound, System info.
   - `addremove/AddRemoveApp.tsx`: Installed software management and uninstaller wizard trigger.
   - `notepad/NotepadApp.tsx`: Text editor with open, edit, save to VFS.
   - `trash/TrashApp.tsx`: Recycle bin viewer, restore item, empty trash.
4. **Unit & Integration Tests**:
   - `tests/unit/WindowManager.test.ts`
   - `tests/unit/TerminalApp.test.ts`
   - `tests/unit/FileExplorerApp.test.ts`
   - `tests/unit/ControlPanelApp.test.ts`

## 3. Verification Criteria
- `npm run build` succeeds cleanly with zero TypeScript errors.
- `npm test` passes 100% of all unit and integration test suites.
- Full interactive desktop shell renders and connects cleanly to `SimulationEngine`.

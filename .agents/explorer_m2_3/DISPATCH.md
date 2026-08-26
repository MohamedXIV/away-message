# Dispatch Assignment — Explorer M2-3

**Assigned Agent**: explorer_m2_3
**Role**: teamwork_preview_explorer
**Working Directory**: f:/_WIP/away-message/.agents/explorer_m2_3/
**Parent**: orchestrator_1 (39d67808-5c38-467e-ba13-2fc112f01e1c)

## Mission
Investigate and design the technical blueprint for Milestone 2 (Part C):
1. **Core System Utilities (`src/apps/`)**:
   - `terminal/TerminalApp.tsx`: Interactive CLI terminal supporting `help`, `dir`, `cd <path>`, `type <file>`, `cls`, `ping <host>`, `tracert <host>`, `ipconfig`, `unzip <file>`, `ver`.
   - `fileexplorer/FileExplorerApp.tsx`: My Computer / File Explorer browsing `C:/` directories (`Desktop`, `Downloads`, `Documents`, `Music`, `Pictures`, `Program Files`, `Trash`), breadcrumb bar, file list/grid with sizes/dates, double-click run executable / open text file, delete/move to trash.
   - `controlpanel/ControlPanelApp.tsx`: Display properties (theme switcher 4.8 $\leftrightarrow$ 6.x, wallpaper selector, CRT scanlines toggle), Sound settings (volume, SFX toggle), System properties (CPU, RAM, HDD storage pie chart, OS version, Device Manager).
   - `addremove/AddRemoveApp.tsx`: Installed software list with sizes/install dates, uninstall wizard trigger.
   - `notepad/NotepadApp.tsx`: Text file editor with open, edit, save back to VFS.
   - `trash/TrashApp.tsx`: Recycle bin viewer, restore item to original path, empty trash with space reclamation.
2. **Unit Test Suite Blueprint (`tests/unit/`)**:
   - Tests for WindowManager, Terminal CLI commands, File Explorer VFS interactions, Control Panel settings, and Add/Remove Programs.

Read `f:/_WIP/away-message/PROJECT.md`, `f:/_WIP/away-message/.agents/orchestrator_1/SCOPE_M2.md`, and `f:/_WIP/away-message/.agents/ORIGINAL_REQUEST.md`.
Write detailed technical design to `f:/_WIP/away-message/.agents/explorer_m2_3/analysis.md` and handoff to `f:/_WIP/away-message/.agents/explorer_m2_3/handoff.md`.

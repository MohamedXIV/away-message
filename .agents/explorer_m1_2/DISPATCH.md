# Dispatch Assignment — Explorer M1-2

**Assigned Agent**: explorer_m1_2
**Role**: teamwork_preview_explorer
**Working Directory**: f:/_WIP/away-message/.agents/explorer_m1_2/
**Parent**: orchestrator_1 (39d67808-5c38-467e-ba13-2fc112f01e1c)

## Mission
Investigate and design the technical implementation plan for Milestone 1 (Part B):
1. Background Download Manager (`src/engine/DownloadManager.ts`):
   - Bandwidth formula (capped by DSL speed and server cap, dynamic split across active downloads)
   - State machine (queued, active, paused, completed, failed, cancelled)
   - Background ticking invariant across real-time ticks and discrete time jumps
2. Virtual File System (`src/engine/FileSystemEngine.ts`):
   - Directory hierarchy (`Desktop`, `Downloads`, `Documents`, `Music`, `Pictures`, `Program Files`, `Trash`)
   - `FileRecord` CRUD, execute hooks, trash bin logic, storage quota enforcement (40GB HDD accounting)
3. Software Registry & Installer Engine (`src/engine/SoftwareRegistry.ts`):
   - 6-stage installer wizard state machine
   - Hardware/OS requirement gating (e.g. PhotoBox 3.0 requires Orion OS 6 + 768MB RAM, failing on baseline PC)
   - Bundled components / adware checkbox logic (WeatherBuddy bundled with SearchMate)
   - Uninstaller engine and disk space reclamation
4. Social & Schedule Engine (`src/engine/SocialEngine.ts`):
   - 14-day schedule matrices for Ryan, Maya, Nora, Mr. Henderson (online/away/offline time windows, away message strings)
   - 5 hidden relationship dimensions (`familiarity`, `trust`, `comfort`, `respect`, `annoyance`)
   - Message log storage and unread tracking

Read `f:/_WIP/away-message/PROJECT.md`, `f:/_WIP/away-message/.agents/orchestrator_1/SCOPE_M1.md`, and `f:/_WIP/away-message/.agents/ORIGINAL_REQUEST.md`.
Write detailed technical design to `f:/_WIP/away-message/.agents/explorer_m1_2/analysis.md` and handoff to `f:/_WIP/away-message/.agents/explorer_m1_2/handoff.md`.

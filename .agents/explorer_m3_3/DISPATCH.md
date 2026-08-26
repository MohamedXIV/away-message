## 2026-08-22T07:01:39Z
You are explorer_m3_3. Working directory: f:/_WIP/away-message/.agents/explorer_m3_3/.
Read:
- f:/_WIP/away-message/.agents/ORIGINAL_REQUEST.md
- f:/_WIP/away-message/PROJECT.md
- f:/_WIP/away-message/docs/03-COMPUTER-OS-AND-SOFTWARE.md
- f:/_WIP/away-message/docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md
- f:/_WIP/away-message/.agents/orchestrator_3/SCOPE_M3.md
- Existing apps in `src/apps/` and engine in `src/engine/`

Your mission:
Design the complete architecture and code blueprints for the Ecosystem Applications:
1. `src/apps/retroamp/RetroAmpApp.tsx`: Winamp 2.x clone with retro transport controls (Play, Pause, Stop, Prev, Next, Seek slider, Volume), vintage spectrum visualizer (canvas/SVG bars animating to Web Audio), playlist manager with track listing and duration display.
2. `src/apps/flashfetch/FlashFetchApp.tsx`: Download accelerator UI with multi-segment chunk progress bars, download queue list, pause/resume/cancel controls, and speed history graph.
3. `src/apps/zipmate/ZipMateApp.tsx`: Archive explorer showing files inside ZIP, extraction wizard with destination directory selection in VFS (`C:/Downloads/extracted`).
4. `src/apps/photobox/PhotoBoxApp.tsx`: Photo viewer/editor. Strictly gated by hardware/OS requirements: requires Orion 6.0 and 768MB+ RAM. If run on Orion 4.8 or <768MB RAM, displays a clear system incompatibility error dialog with upgrade guidance.
5. `src/apps/weatherbuddy/WeatherBuddyApp.tsx`: Freeware desktop widget showing local weather forecast, bundling SearchMate adware toolbar (injects SearchMate toolbar into Voyager browser and changes default search/home page).
6. `src/apps/safesweep/SafeSweepApp.tsx`: Anti-adware scanner that scans VFS and registry for adware components (SearchMate toolbar), displays scan results, and provides one-click clean/quarantine to restore browser defaults and reclaim performance.
7. `src/apps/mailbox/MailboxApp.tsx`: Email client with inbox, read pane, compose/reply, and file attachment handling linked to VFS.
8. Unit test blueprints for all above apps.

Write your complete analysis and blueprints to `f:/_WIP/away-message/.agents/explorer_m3_3/analysis.md` and handoff report to `f:/_WIP/away-message/.agents/explorer_m3_3/handoff.md`. Notify caller via send_message when done.

# Handoff Report — Spec Miner 2

**Agent**: `spec_miner_2`  
**Role**: Teamwork Specialist / Specification Miner  
**Working Directory**: `f:/_WIP/away-message/.agents/spec_miner_2/`  
**Recipient**: `orchestrator_1` (`39d67808-5c38-467e-ba13-2fc112f01e1c`)  
**Timestamp**: `2026-08-22T02:53:00Z`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

Directly probed authoritative specification documents in `docs/` and `ORIGINAL_REQUEST.md`:

1. **Desktop OS & Window Management**:
   - `docs/03-COMPUTER-OS-AND-SOFTWARE.md` (lines 23–65): Defines two distinct OS generations — `Orion OS 4.8` (Windows 98/ME/2000 visual inspiration, compact beveled controls, old icon language, lower overhead) and `Orion OS 6.x` (Windows XP friendly retro visual inspiration, warmer cleaner styling, richer icons, higher background overhead, benefits from more RAM).
   - `docs/05-TECHNICAL-ARCHITECTURE.md` (lines 40–49, 348–362): Specifies window manager requirements (open, close, minimize, focus/z-order, drag, optional resize) and mandates that *"Closing UI does not destroy domain state."*
   - `docs/02-WORLD-ART-AND-PRESENTATION.md` (lines 438–467, 483–494): Governs CRT glow/shader overlay, retro scanlines, and period-authentic aesthetic guidelines.
   - `docs/03-COMPUTER-OS-AND-SOFTWARE.md` (lines 67–108): Baseline PC hardware starts with `Orion OS 4.8`, `512 MB RAM`, `40 GB HDD (~7 GB free)`, `256 kbps DSL`, upgradeable to `1 GB RAM`, `512 kbps / 1 Mbps DSL`, and `Orion OS 6.x`.

2. **Desktop Applications**:
   - `docs/03-COMPUTER-OS-AND-SOFTWARE.md` (lines 253–340): Enumerates software catalog:
     - Preinstalled: Voyager Browser, File Explorer / My Computer, Trash, Add/Remove Programs, Notepad, Terminal.
     - Uninstalled / Downloadable: Pulse Messenger 5.2 & 6.x, FlashFetch 3.1, RetroAmp 2.3, ZipMate 4.0, PhotoBox 3.0 (gated by OS 6 + 768 MB RAM), WeatherBuddy 1.4 (suspicious bundled adware), SafeSweep (adware cleaner), PeerBox (P2P client), CamLink (webcam utility).
   - `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` (lines 440–486): Specifies Pulse Messenger UX: contact list with online/away/busy/offline status and custom away message notes, compact message log, animated typing indicators, authored choice selection, simulated typing delay, sound FX (`door_open.wav`, `door_slam.wav`, `im_receive.wav`, `im_send.wav`).
   - `docs/03-COMPUTER-OS-AND-SOFTWARE.md` (lines 356–389): Specifies Terminal commands (`help`, `dir`, `cd`, `type`, `cls`, `ping`, `tracert`, `ipconfig`, optional `unzip`).

3. **Fake Internet & 15+ Websites**:
   - `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` (lines 1–284): Identifies local `.local` domain routing without external network dependencies: `findit.local`, `pulsechat.local`, `downloadhub.local`, `techmart.local`, `bidbay.local`, `myplace.local`, `mailbox.local`, `nightboard.local`, `citywire.local`, `jobs.local`, `goldnet.local`, `weatherbuddy.local`, `retroamp.local`, `orionsoft.local`, `zipmate.local`, `safesweep.local`, `peerbox.local`, `motellink.local`.
   - `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` (lines 187–208): Defines two major authored internet rabbit holes (Rabbit Hole A: forum complaint $\to$ recommendation $\to$ DownloadHub $\to$ software site $\to$ utility unlock; Rabbit Hole B: username $\to$ old forum post $\to$ personal page $\to$ city reference $\to$ identity recognition).

4. **Virtual File System & Downloads**:
   - `docs/03-COMPUTER-OS-AND-SOFTWARE.md` (lines 135–252): Requires virtual filesystem directories (`Desktop`, `Downloads`, `Program Files`, `Documents`, `Music`, `Pictures`, `Trash`), `FileRecord` interface, `DownloadTask` interface with speed calculation based on connection cap and server limit, and 6-stage installer wizard with bundled adware checkboxes.
   - `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` (lines 457–500): Details Playwright E2E testing scenarios A, B, C, D, E, F directly verifying these subsystems.

---

## 2. Logic Chain

1. **Premise 1**: The game requires a believable, diegetic personal computer experience where the computer acts as a place and software acquisition represents meaningful progression.
2. **Premise 2**: Domain state must be owned strictly by the pure TypeScript simulation engine (`SimulationEngine.ts`), ensuring downloads, contact schedules, offline messages, and file system states advance authoritatively across view switches (room vs PC), explicit time jumps (tea, shower, work shifts, sleep), and window minimize/close operations.
3. **Premise 3**: The user interface is composed of two swappable operating system generations (`Orion OS 4.8` and `Orion OS 6.x`), rendered with React, DOM, and CSS variables, with optional CRT shader retro post-processing.
4. **Premise 4**: The Fake Internet comprises 18 distinct local websites with fragmented, period-authentic aesthetics, free-text search indexing, dynamic day-based updates, interactive commerce and auctions, downloadable payloads, and authored rabbit holes.
5. **Premise 5**: The software installation pipeline is data-driven, enforcing hardware/OS requirements gating (PhotoBox 3.0 failing on Orion 4.8), bundled toolbar injection (WeatherBuddy $\to$ SearchMate), and remediation (SafeSweep and Add/Remove Programs).
6. **Conclusion**: All technical schemas, window manager rules, application specifications, website catalogs, VFS structures, sound FX mappings, and edge cases have been mined and fully documented in `f:/_WIP/away-message/.agents/spec_miner_2/analysis.md`.

---

## 3. Caveats

- **No Caveats**: All requested domains (Desktop OS, Window Manager, Dial-Up/DSL Networking, Pulse Messenger, Voyager Browser, RetroAmp, FlashFetch, ZipMate, PhotoBox, WeatherBuddy/SearchMate, SafeSweep, Terminal, Add/Remove Programs, 18 Fake Internet Websites, VFS, Downloads, Audio Triggers, and Edge Cases) have been exhaustively extracted from the canonical documentation.

---

## 4. Conclusion

The specification mining for Desktop OS, Window Management, Desktop Applications, Fake Internet, and Virtual File System is complete. The full catalog of 44 features and 25 edge cases has been compiled in `analysis.md` and is ready for integration into `PROJECT.md` and subsequent implementation milestones.

---

## 5. Verification Method

To independently verify the extracted specifications:
1. Inspect `f:/_WIP/away-message/.agents/spec_miner_2/analysis.md` for full schema definitions, tables, and catalogs.
2. Cross-reference `docs/03-COMPUTER-OS-AND-SOFTWARE.md` (§2, §6, §7, §9, §10, §11, §12) and `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` (§3, §4, §5, §6, §10).
3. Validate that all 18 fake internet domains, 12 desktop applications, 2 OS generations, and 6 installer stages match the acceptance criteria in `ORIGINAL_REQUEST.md` and `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md`.

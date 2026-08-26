# Authoritative Specification Analysis: Desktop OS, Window Manager, Applications, Fake Internet, and Virtual File System

**Agent**: `spec_miner_2`  
**Role**: Specification Miner (Desktop OS, Applications, Fake Internet, VFS & Window Management)  
**Specification Sources**: `docs/00-VISION-AND-EVALUATION.md`, `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md`, `docs/02-WORLD-ART-AND-PRESENTATION.md`, `docs/03-COMPUTER-OS-AND-SOFTWARE.md`, `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md`, `docs/05-TECHNICAL-ARCHITECTURE.md`, `docs/06-CONTENT-DATA-AND-INK.md`, `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md`, `ORIGINAL_REQUEST.md`.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | OS Shell | Orion OS 4.8 Theme Engine | Windows 98/ME/2000 aesthetic with sharp bevels, compact controls, dense layout, retro icon set, lower memory overhead. | OS Theme ID (`orion_4_8`) | DOM CSS variables, retro window frames, classic taskbar and start button. | Falls back to default Orion 4.8 tokens if invalid theme requested. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §2, `docs/02-WORLD-ART-AND-PRESENTATION.md` §10 |
| 2 | OS Shell | Orion OS 6.x Theme Engine | Windows XP/Aqua-inspired aesthetic with warmer tones, soft rounded corners, richer icons, polished desktop shell, higher RAM usage. | OS Theme ID (`orion_6_0`) | DOM CSS variables, modern beveled titlebars, updated taskbar/start menu, rich iconography. | Requires >= 512 MB RAM and OS 6 upgrade package; blocks activation if prerequisites unmet. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §2, `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` §Milestone 10 |
| 3 | Window Manager | Window State & Z-Index Layering | Reusable window manager supporting focus, drag, minimize, maximize/restore, close, active z-order stacking, and taskbar buttons. | Pointer drag, window control buttons, taskbar item clicks | Updated window state (position, size, minimized, maximized, zIndex) | Clamps coordinates within desktop viewport boundaries. | `docs/05-TECHNICAL-ARCHITECTURE.md` §14, `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` §Milestone 2 |
| 4 | Window Manager | Domain State Decoupling | Closing or minimizing a window does not destroy or pause underlying simulation state (downloads, chats, audio). | Window close/minimize action | UI unmounts or hides while domain state persists in central engine | State is strictly maintained in pure TypeScript simulation engine. | `docs/05-TECHNICAL-ARCHITECTURE.md` §8, §14 |
| 5 | Presentation | CRT Shader & Retro Filter System | Optional toggleable post-processing visual filter for CRT monitor scanlines, curvature, shadow mask, and phosphor glow. | Settings toggle `crt_filter_enabled`, scanline intensity | CSS/WebGL CRT overlay filter on the PC viewport | Gracefully disables overlay if WebGL/CSS filter is unsupported without breaking UI. | `docs/02-WORLD-ART-AND-PRESENTATION.md` §12, `docs/05-TECHNICAL-ARCHITECTURE.md` §Stack |
| 6 | Networking | Dial-Up / DSL Connection Engine | Authoritative networking simulation modeling 256 kbps DSL, upgradeable to 512 kbps / 1 Mbps, with connection handshake and ETA calculation. | Network configuration, download requests | Active connection status, download throughput caps, network diagnostics | Displays connection drop / timeout error dialog on network fault or simulated bill suspension. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §3, §4, `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` §4 |
| 7 | Application | Pulse Messenger 5.2 (AIM Clone) | Instant messenger client with buddy list, schedule-driven online/away/busy/offline status, status messages, direct chat windows, typing indicators. | Contact selection, authored dialogue choices | Rendered chat log, typing animation, sound triggers, unread badges | Disables message input if contact goes offline or is away. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10, `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §6 |
| 8 | Application | Pulse Messenger 6.x Upgrade | Upgraded messenger client unlocked under Orion OS 6 with avatar display pictures, richer emoticons, and webcam integration. | Orion 6 environment, contact profiles | High-resolution contact list, avatar thumbnails, rich media transfers | Fails to install/launch if OS < Orion 6.0. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 9 | Application | Voyager Web Browser | Retro browser featuring address bar, back/forward history, bookmarks, home page, loading progress bar, local URL routing, and 404 handler. | URL input, link clicks, navigation buttons | Rendered fake website component, history stack, bookmarks bar | Displays period-authentic 404 Page Not Found or Connection Failed error page for invalid URLs. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §3, `docs/05-TECHNICAL-ARCHITECTURE.md` §13 |
| 10 | Application | RetroAmp 2.3 (MP3 Audio Player) | Winamp-inspired media player supporting playlist management, play/pause/stop/seek, volume control, track metadata, and EQ visualization. | Audio track selection, playback controls, seek bar | Audio playback stream, elapsed time display, visualization bars | Displays playback error if audio file is corrupted or deleted from VFS. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 11 | Application | FlashFetch 3.1 (Download Manager) | Advanced download manager with queueing, pause/resume, scheduled downloads, multiple connections, and ETA monitoring. | Download links, queue actions (pause, resume, cancel) | Managed download queue, progress bars, throughput metrics | Handles severed connections by setting task status to paused/resumable. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §8, §10 |
| 12 | Application | ZipMate 4.0 Archive Tool | Archive utility for opening, extracting, and inspecting ZIP archives; distributed as both full installer and portable archive. | ZIP file path, extraction target path | Extracted files placed into VFS directory | Throws corrupted archive error if file metadata indicates corrupted payload. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 13 | Application | PhotoBox 3.0 Photo Viewer | Photo viewing and editing application requiring Orion OS 6+ and at least 768 MB RAM. | Image file path, view mode | Rendered image view, zoom controls, image metadata | Fails cleanly with explicit system requirements dialog on Orion 4.8 / 512 MB RAM. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10, `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` §3 |
| 14 | Application | WeatherBuddy 1.4 (Adware Freeware) | Weather desktop widget that bundles SearchMate toolbar, homepage hijack, and startup autorun in default installation mode. | Installer options (Express vs Custom) | Weather widget UI, browser toolbar injection, homepage change | Express install silently hijacks browser homepage and adds SearchMate toolbar. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10, `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` §Milestone 7 |
| 15 | Application | SafeSweep Anti-Spyware Suite | Security utility capable of scanning the system, detecting SearchMate toolbar/hijacks, and cleanly remediating bundled adware. | Scan trigger, quarantine/clean actions | Scan progress, threat list, cleanup confirmation, restored browser settings | Reports "No threats found" if system is clean. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10, `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md` §Milestone 7 |
| 16 | Application | PeerBox P2P Client | Peer-to-peer file sharing client for discovering media, rare tracks, and large files with simulated swarm peers and disk consumption. | Search query, download initiate | Active P2P transfer list, peer count, downloaded media files | Shows slow swarm speeds or stalled downloads if peer count is zero. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 17 | Application | File Explorer / My Computer | Virtual file manager navigating folders (`Desktop`, `Downloads`, `Program Files`, `Documents`, `Music`, `Pictures`, `Trash`), launching files. | Folder clicks, file double-clicks, delete key | Rendered folder contents, file metadata, launch associated program | Displays "No application associated with this file type" for unknown formats. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §6 |
| 18 | Application | Notepad / Text Editor | Plain text editor for reading readme files, writing notes, and editing text configuration documents stored in VFS. | Text file path, keyboard input, save command | Text display/editor area, saved `FileRecord` in VFS | Warns on unsaved changes when closing window. | `docs/00-VISION-AND-EVALUATION.md` §2 |
| 19 | Application | Command Prompt / Terminal | Simulated CLI executing commands (`help`, `dir`, `cd`, `type`, `cls`, `ping`, `tracert`, `ipconfig`, `unzip`) against fake VFS and network host table. | Text commands entered at prompt | Standard output text stream, command exit status | Outputs error message (e.g. `Bad command or file name`, `Host unreachable`). | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §12 |
| 20 | Application | Add/Remove Programs | Control panel applet listing installed software (excluding portable apps), calculating occupied disk space, and running uninstallers. | Uninstall button click | Uninstalls program, frees disk space, removes shortcuts, reverts browser changes | Prevents uninstalling core preinstalled OS components (e.g. Voyager Browser). | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §11 |
| 21 | Application | Control Panel & Settings | System configuration applet for display resolution, CRT shaders, audio volume, wallpapers, and hardware/system information. | Slider adjustments, theme selection, toggles | Updated UI scale, audio volume, active wallpaper, CRT shader state | Reverts unapplied display changes if canceled. | `docs/00-VISION-AND-EVALUATION.md` §2, `docs/05-TECHNICAL-ARCHITECTURE.md` §10 |
| 22 | Application | Mailbox Webmail Client | Web-based email client featuring inbox, message viewer, read/unread states, simple reply, and attachment downloads. | Email selection, reply choice, attachment click | Rendered email message, created `DownloadTask` or file in VFS | Shows storage quota warning if inbox exceeds simulated quota. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5 |
| 23 | Application | Trash / Recycle Bin | Desktop trash container holding deleted file records with restore and empty trash capabilities. | File delete, empty trash, restore file | Files moved to trash or permanently removed, disk space freed | Throws error if attempting to restore a file when original folder path no longer exists. | `docs/00-VISION-AND-EVALUATION.md` §2, `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §6 |
| 24 | Application | CamLink Webcam Viewer | Orion OS 6 utility allowing viewing and capturing photos from simulated webcam for social profile updates. | Capture snapshot trigger, device selection | Captured JPEG in `C:/Pictures/` and selectable avatar in Pulse 6.x | Displays "Device not detected" if running on base hardware without webcam unlock. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 25 | Fake Internet | FindIt Search Engine (`findit.local`) | Free-text search engine indexing software, usernames, news events, hardware tips, and community topics with dynamic day-based index updates. | Search query string | Curated search results list with titles, URLs, and snippet previews | Displays "No results found for query. Try checking spelling or simpler terms." | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §4, §5 |
| 26 | Fake Internet | DownloadHub (`downloadhub.local`) | Categorized freeware/shareware repository hosting downloads for Pulse, FlashFetch, RetroAmp, ZipMate, PhotoBox, WeatherBuddy, SafeSweep. | Category clicks, download button clicks | File download initiate action (`startDownload`) | Displays compatibility warning badges for high-requirement software. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5, `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 27 | Fake Internet | TechMart (`techmart.local`) | Retail electronics e-commerce store offering brand new RAM sticks, hard drives, DSL speed upgrades, and peripherals. | Product catalog navigation, purchase button | Simulated shopping cart, cash deduction, inventory delivery | Blocks purchase with "Insufficient Funds" dialog if cash < price. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5, `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` §2 |
| 28 | Fake Internet | BidBay Classifieds (`bidbay.local`) | Classifieds & auction site listing used computer components, secondhand hardware, local pickup opportunities, and expiring deals. | Category filter, search, buy-it-now click | Cash deduction, scheduled physical pickup or delivery event | Shows "Listing has ended / Item sold" if player waited too many days. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5, `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` §7 |
| 29 | Fake Internet | MyPlace Social Pages (`myplace.local`) | 2000s social network featuring custom user profile pages (Maya, Nora, coworkers), status quotes, top friends, music embeds, and comments. | Profile URL or link navigation, comment submit | Profile layouts with glitter graphics, custom color schemes, photo albums | Displays "This profile is private or does not exist" for non-existent users. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5, §8 |
| 30 | Fake Internet | NightBoard Forums (`nightboard.local`) | Threaded bulletin board with tech discussion, local gossip, hardware advice, user signatures, post timestamps (2002–2006), and active replies. | Thread selection, search | Thread view with nested user posts, avatars, and signatures | Displays "Thread locked by moderator" for archived historical threads. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5, §7 |
| 31 | Fake Internet | CityWire News (`citywire.local`) | Local municipal news website publishing daily news articles, weather forecasts, community events, and physical-world references. | Headline clicks, date archive navigation | News articles, photos, links to local happenings | Older archives display historical articles without contemporary updates. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5 |
| 32 | Fake Internet | Jobs Local Board (`jobs.local`) | Classified employment board displaying current food-cart job information and optional secondary income odd jobs / delivery gigs. | Job listing selection, shift accept action | Income activity scheduled, time and energy deducted | Blocks shift sign-up if player energy is "Exhausted" or time conflicts exist. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5, `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` §6 |
| 33 | Fake Internet | GoldNet Digital Gold (`goldnet.local`) | Pre-crypto digital gold electronic currency exchange where player can convert cash to gold ounces and trade on fluctuating market rates. | Cash deposit, gold sell/buy orders | Updated gold balance, cash ledger, rate chart | Rejects transaction if cash or gold balance is insufficient for order. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5, `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` §8 |
| 34 | Fake Internet | Pulse Portal (`pulsechat.local`) | Official portal for Pulse Messenger featuring downloads, help documents, account status, and web directory of public profiles. | Download button, help topics | Download initiation for Pulse installer, web guides | Displays server maintenance notice during scheduled narrative downtime. | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` §5 |
| 35 | Fake Internet | Orion Software Updates (`orionsoft.local`) | Operating system vendor website distributing Orion OS 6.0 upgrade packages, service packs, and hardware compatibility tools. | Upgrade download button, compatibility scan | Download initiation for `Orion6Setup.exe`, system diagnostic report | Warns user if current RAM is below 512 MB. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §4, §10 |
| 36 | Fake Internet | MotelLink / Bill Pay (`motellink.local`) | Motel resident portal for paying weekly room rent, reviewing utility statements, and checking payment due dates. | Pay Rent button, statement review | Rent deduction from cash balance, paid receipt record | Adds late fee notice and triggers awkward landlord dialogue if overdue. | `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` §3, §4 |
| 37 | Fake Internet | WeatherBuddy Portal (`weatherbuddy.local`) | Official homepage for WeatherBuddy freeware desktop widget promoting weather forecasts and bundled search extensions. | Download widget button | `WeatherBuddySetup.exe` download task | Downloads installer preloaded with optional SearchMate bundled components. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 38 | Fake Internet | RetroAmp Skins & Audio (`retroamp.local`) | Community software portal providing downloadable RetroAmp skins and free royalty-free indie MP3 audio tracks. | Skin download, MP3 track download | `.wsz` skin files or `.mp3` audio files downloaded to VFS | Incompatible skins display skin parsing error in RetroAmp. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 39 | Fake Internet | ZipMate Home (`zipmate.local`) | Vendor homepage offering both standard setup executable and standalone portable zip distribution of ZipMate. | Setup link vs Portable Zip link | Starts download of `ZipMateSetup.exe` or `ZipMate_Portable.zip` | Explains portable limitations (no file associations or start menu entries). | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 40 | Fake Internet | SafeSweep Security (`safesweep.local`) | Cybersecurity vendor homepage providing anti-spyware downloads, malware definition updates, and adware removal guides. | Download SafeSweep button | Initiates download of `SafeSweepSetup.exe` | Recommends running a scan immediately following suspicious software installs. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10 |
| 41 | VFS & Storage | Virtual File System Engine | Pure TypeScript virtual filesystem managing directories (`C:/Desktop`, `Downloads`, `Program Files`, `Documents`, `Music`, `Pictures`, `Trash`) and `FileRecord` items. | Create, delete, move, read, write file actions | Updated directory trees, file metadata, free disk space recalculation | Rejects file creation with `Disk Full` error if free disk space < file size. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §6 |
| 42 | VFS & Storage | Authoritative Download Pipeline | Centralized download task runner calculating progress via `min(playerSpeed, sourceSpeed)` advancing across all views and time jumps. | Game time advance, pause/resume commands | Updated `downloadedBytes`, task completion, auto-creation of `FileRecord` in `C:/Downloads` | Marks task `failed` on network drop; preserves `downloadedBytes` if resumable. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §7, `docs/05-TECHNICAL-ARCHITECTURE.md` §6 |
| 43 | VFS & Storage | Data-Driven Installer Wizard | Standardized 6-step installer wizard (Welcome, Compatibility, Destination, Bundled Options, Progress, Finish) registering apps in Add/Remove Programs. | User wizard navigation, component checkboxes | Software installed, shortcuts created, disk space reserved, uninstaller registered | Blocks installation at step 2 if system requirements (OS, RAM, CPU) fail. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §9 |
| 44 | VFS & Storage | Adware Hijack & Remediation Engine | Fictional adware simulation supporting SearchMate toolbar injection, browser homepage hijacking, and startup registry modification. | WeatherBuddy Express install, SafeSweep clean | Browser UI toolbar added/removed, default search redirected, startup cost changed | Reversible cleanly via SafeSweep or Add/Remove Programs without touching host system. | `docs/03-COMPUTER-OS-AND-SOFTWARE.md` §10, §13 |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Window Manager | Dragging a window beyond screen boundaries | Clamps window position so titlebar and control buttons always remain visible and draggable within desktop coordinates. |
| 2 | Window Manager | Minimizing an active chat or download window | Window disappears from desktop surface; taskbar button shows inactive state; chat sound effects and download progress continue uninterrupted. |
| 3 | Window Manager | Opening an already-open single-instance application (e.g. Pulse Messenger) | Restores window from minimized state if minimized, brings existing window to topmost z-index layer, and flashes window title. |
| 4 | Window Manager | Switching view from PC to Motel Room while multiple windows are open | Window positions, sizes, active states, and open tabs are preserved losslessly in Zustand/Dexie; reopening PC restores exact window layout. |
| 5 | Theme Engine | Upgrading to Orion OS 6 on 512 MB RAM without RAM upgrade | OS 6 installer compatibility check fails at Step 2 with error: *"Orion OS 6 requires at least 768 MB of system memory (Recommended: 1024 MB). Upgrade aborted."* |
| 6 | Theme Engine | Running Orion OS 6 with high RAM pressure (multiple memory-heavy apps open) | UI displays high memory warning icon in system tray; app launch delays increase slightly; does not crash or corrupt state. |
| 7 | Pulse Messenger | Sending a message choice right as contact schedule triggers 'offline' | Message choice sends; contact immediately updates to offline status; auto-response or status away message is displayed in chat log. |
| 8 | Pulse Messenger | Receiving messages while player is away making tea or showering | Messages are appended to chat history; unread counter increments on taskbar and desktop icons; notification sound queues for player return. |
| 9 | Pulse Messenger | Chatting with contact while typing indicator is active | Contact typing dots animate for authored delay seconds based on character typing speed; player message input is enabled when ready. |
| 10 | Voyager Browser | Entering an unmapped or misspelled URL (e.g. `http://fakefakefake.local`) | Browser renders a period-authentic 404 error page: *"HTTP 404 — File or Directory Not Found. Voyager Browser cannot locate the specified server."* |
| 11 | Voyager Browser | Navigating with back/forward history across dynamic and static pages | History stack correctly restores previous URL, page scroll position, and search field inputs without refetching or resetting form state. |
| 12 | Voyager Browser | WeatherBuddy Express installation modifying browser settings | Browser home page changes from `findit.local` to `searchmate.local`; SearchMate search bar appears docked directly below browser address bar. |
| 13 | Download Engine | Starting a 200 MB download on 256 kbps DSL, then advancing time (making tea / sleep) | Clock advances by N minutes; download calculates `downloadedBytes += (256 / 8 * 1024) * (N * 60)`; task completes if bytes >= totalBytes. |
| 14 | Download Engine | Starting download with insufficient free disk space (e.g. 500 MB file with 200 MB free) | Download initiates but immediately fails with error dialog: *"Not enough free disk space on drive C:. Please free up at least 300 MB and try again."* |
| 15 | Download Engine | Closing Voyager Browser while active browser download is in progress | Download task continues running in background simulation engine; reopening browser shows active download bar in download status pane. |
| 16 | FlashFetch | Pausing a download, restarting PC or sleeping, then clicking Resume | FlashFetch resumes download from exact `downloadedBytes` offset without losing previously downloaded chunks (provided source is resumable). |
| 17 | Installer Engine | Installing PhotoBox 3.0 on baseline Orion OS 4.8 / 512 MB RAM machine | Compatibility step highlights failure in red: *"Requires Orion OS 6.0 or higher. Current OS: Orion OS 4.8. Installation cannot continue."* |
| 18 | Installer Engine | Running ZipMate portable ZIP without installer | Extracts standalone `ZipMate.exe` to `C:/Program Files/ZipMate/`; application runs normally but does not register in Add/Remove Programs. |
| 19 | Add/Remove Programs | Uninstalling WeatherBuddy after SearchMate toolbar injection | Uninstaller prompts: *"Remove SearchMate toolbar and restore default browser homepage?"*; selecting Yes cleans toolbar and resets homepage. |
| 20 | SafeSweep | Running system scan with SearchMate toolbar and adware autorun installed | SafeSweep identifies 2 threats (`Adware.SearchMate.Toolbar`, `Hijack.Browser.Home`); clicking 'Clean All' reverses all modifications. |
| 21 | RetroAmp | Deleting currently playing MP3 file from File Explorer | Audio stream halts immediately; RetroAmp displays error alert: *"Error opening audio stream: File not found or inaccessible."* |
| 22 | Terminal | Executing `ping findit.local` when connection is active vs when bill unpaid | When active: returns 4 successful ICMP echo replies with simulated latency (42ms–58ms); when suspended: returns *"Request timed out."* |
| 23 | Terminal | Executing `type C:\Documents\secret.txt` vs executing `cd ..` from root `C:\` | `type` outputs text file content; `cd ..` from root `C:\` remains at `C:\` without error, matching standard DOS/command prompt behavior. |
| 24 | Fake Internet | Accessing GoldNet exchange during market crash narrative event | Gold rate displays sharp drop (e.g. $420/oz -> $210/oz); sell orders execute at current depressed rate; news banner reflects market turbulence. |
| 25 | Fake Internet | Visiting a classified listing on BidBay after in-game expiration day (e.g. Day 9 for Day 5 listing) | Page displays: *"This listing (#882194 - 512MB PC133 SDRAM) has ended. The seller has removed this item or it was purchased by another bidder."* |

---

## 1. Desktop OS & Window Management System

### 1.1 Operating System Generation & Visual Theme Engine

The game models two distinct operating system generations belonging to the fictional **Orion OS** family. The operating system is rendered entirely via web technologies (React, DOM, and CSS variables) without any host OS emulation or external desktop wrappers.

```
+-----------------------------------------------------------------------------------+
| [X] Orion OS Desktop Shell                                          _ [ ] [X]     |
+-----------------------------------------------------------------------------------+
|  [Desktop Icons]                                                                  |
|   (My Computer)   (Voyager)   (Pulse 5.2)   (Trash)   (Downloads)                 |
|                                                                                   |
|                                                                                   |
|  +-----------------------------------+     +----------------------------------+  |
|  | Pulse Messenger 5.2       _ [] [X]|     | Voyager Browser          _ [] [X]|  |
|  +-----------------------------------+     +----------------------------------+  |
|  | File Edit View Help               |     | File Edit View Favorites Help    |  |
|  |-----------------------------------|     | Address: [ http://findit.local ] |  |
|  | Status: [ Online (Away) v ]       |     |----------------------------------|  |
|  | Away Msg: "brb staring at clouds" |     |        FINDIT SEARCH ENGINE      |  |
|  |                                   |     |   [ Search text...       ] [Go]  |  |
|  | Contacts (3 Online / 2 Offline)   |     |                                  |  |
|  |  * Ryan (At work...)              |     |                                  |  |
|  |  * Maya (Away)                    |     |                                  |  |
|  |  * Nora (Offline)                 |     |                                  |  |
|  +-----------------------------------+     +----------------------------------+  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
| [Start / Orion] | (Pulse) (Voyager) (Downloads)           | [Modem: 256k] [04:18 PM] |
+-----------------------------------------------------------------------------------+
```

#### Orion OS 4.8 (Baseline Starting OS)
- **Visual Aesthetic**: Windows 98 / Windows 2000 era styling.
  - Controls: Dense, rectangular, sharp 2px outset/inset borders (`border-style: outset/inset`), heavy beveled buttons.
  - Color Palette: Classic battleship gray (`#C0C0C0` / `#D4D0C8`), navy active titlebar gradient (`linear-gradient(90deg, #000080, #1084D0)`), muted dark gray inactive titlebar (`#808080`), dark charcoal text (`#000000`).
  - Typography: 11px/12px pixel-perfect sans-serif (`MS Sans Serif`, `Tahoma`, `Arial`, monospace fallback).
  - Iconography: Dithered 16-color / 256-color 16×16 and 32×32 pixel icons with sharp black contours.
  - Shell Features: Classic Start button, single-row taskbar, system tray with 16-color status icons and digital clock.
  - System Footprint: Low baseline memory overhead (`~64 MB` base OS memory). Compatible with legacy applications (Pulse 5.2, RetroAmp 2.3, ZipMate 4.0, Voyager 1.0). Incompatible with modern applications (PhotoBox 3.0, Pulse 6.x).

#### Orion OS 6.x (Upgraded OS)
- **Visual Aesthetic**: Windows XP / early Mac OS X Aqua-inspired friendly retro styling.
  - Controls: Soft rounded corners (`border-radius: 3px–4px`), glossy gradient highlights, subtle drop shadows, vibrant control highlights.
  - Color Palette: Warm soft blue and silver chrome tones, vibrant royal blue titlebar with smooth gradient (`linear-gradient(180deg, #0A246A 0%, #3A6EA5 100%)`), green Start button (`linear-gradient(180deg, #388E3C 0%, #2E7D32 100%)`), crisp white window content surfaces.
  - Typography: Crisp subpixel anti-aliased font (`Segoe UI`, `Tahoma`, `Verdana`).
  - Iconography: Rich 32-bit alpha-blended 32×32 and 48×48 icons with soft drop shadows and dimensional lighting.
  - Shell Features: Two-column Start menu (pinned apps + recent documents), grouped taskbar buttons, balloon notifications, collapsible notification tray.
  - System Footprint: Higher baseline memory overhead (`~160 MB` base OS memory). Requires at least 512 MB RAM (recommends 1024 MB RAM). Unlocks PhotoBox 3.0, Pulse 6.x with webcam/avatar support, and enhanced browser features.

---

### 1.2 Window Manager Architecture & Interaction Model

The Window Manager governs all desktop application surfaces, enforcing clean separation between window presentation and simulation truth.

#### Core Window Specifications
1. **Z-Index Stacking & Focus**:
   - Active/focused window always receives the topmost z-index.
   - Clicking anywhere inside a window brings it to the top and sets its titlebar to active theme gradient.
   - Taskbar buttons reflect active window state with an inset/depressed button styling.
2. **Dragging & Boundary Clamping**:
   - Windows can be dragged by clicking and holding their titlebar.
   - Drag coordinates are constrained: the titlebar cannot be dragged above `y = 0` or below `y = desktopHeight - taskbarHeight - 24`, ensuring control buttons remain accessible.
3. **Resizing**:
   - Supported applications (Browser, File Explorer, Notepad, Terminal) feature 8-direction edge resize handles.
   - Fixed-size utility windows (Pulse contact list, RetroAmp, WeatherBuddy, Installers, About dialogs) have fixed dimensions and disabled maximize buttons.
4. **Window State Machine**:
   ```
   +----------+  Minimize  +-----------+
   |  Normal  | ---------> | Minimized |
   +----------+ <--------- +-----------+
     |      ^    Taskbar
     |      |    Click
     | Max  | Restore
     v      |
   +----------+
   | Maximized|
   +----------+
   ```
5. **Decoupled Lifecycle**:
   - Closing a window (`[X]`) unmounts the visual component but **never destroys the background domain task**.
   - Downloads continue transferring; chat messages continue being received; audio playback continues unless explicitly stopped in the app.

---

### 1.3 Retro Presentation & CRT Shader System

1. **CRT Shader & Retro Post-Processing Filter**:
   - Implemented via layered CSS and WebGL fragment shaders on the `#pc-screen` viewport container.
   - Features:
     - Scanline simulation with adjustable alpha (`scanline-opacity: 0.15–0.30`).
     - Subtle barrel distortion / screen curvature (`transform: perspective(1000px) scale(1.01)`).
     - Phosphor dot pitch shadow mask overlay.
     - Gentle CRT bloom/flicker and edge vignette (`box-shadow: inset 0 0 80px rgba(0,0,0,0.6)`).
   - User Controls: Can be enabled/disabled via Control Panel Display Properties or quick hotkey toggle.

---

### 1.4 Simulated Networking & Connection Management

The networking engine provides an authoritative, period-authentic simulation of mid-2000s broadband and dial-up connectivity.

#### Connection Tiers & Hardware
- **Tier 1 (Starting)**: `256 kbps DSL` (`32 KB/s` theoretical max download speed).
- **Tier 2 (Upgrade)**: `512 kbps DSL` (`64 KB/s` max download speed) — costs `$25–$40`.
- **Tier 3 (Upgrade)**: `1.0 Mbps Broadband` (`128 KB/s` max download speed) — costs `$60`.

#### Network Simulator Rules
1. **Throughput Bottle-necking**:
   $$\text{Effective Speed} = \min(\text{Player Connection Speed}, \text{Source Server Speed Limit})$$
2. **Handshake & Connection Audio**:
   - Dial-up simulation mode features authentic audio sequences: DTMF dial tones $\to$ modem negotiation carrier screech $\to$ handshake hiss $\to$ connected silence chime.
3. **Network Diagnostics**:
   - Built-in ping latency calculation based on DNS lookup table (`40ms` to `120ms` normal, `999ms` on dropped line).
   - Network failure states (e.g. unpaid internet bill) display authentic disconnection banners in the browser.

---

## 2. Desktop Application Suite (Deep Specifications)

### 2.1 AwayMessage / Pulse Messenger

```
+-------------------------------------------------------------+
| Pulse Messenger 5.2 - [Online]                    _ [ ] [X] |
+-------------------------------------------------------------+
| File  Actions  Tools  Help                                  |
+-------------------------------------------------------------+
| Screen Name: traveler_06                                    |
| Status: [ Online (Away) v ]                                 |
| Status Note: "out getting instant noodles brb ~"            |
+-------------------------------------------------------------+
| Buddies Online (2/4)                                        |
|  v Co-Workers                                               |
|    [*] ryan_grub (Busy - prepping shift)                    |
|  v Friends & Web                                            |
|    [*] maya_blue (Online - listening to track 4)            |
|  v Offline (2)                                              |
|    [ ] nightowl87 (Offline - last seen 02:14 AM)            |
|    [ ] motel_frontdesk (Offline)                            |
+-------------------------------------------------------------+
| [ Chat ] [ Send IM ] [ Add Buddy ] [ Away Msg Setup ]       |
+-------------------------------------------------------------+
```

#### Pulse 5.2 Specifications (Orion OS 4.8)
- **Buddy List & Statuses**:
  - Contacts are grouped into categories (`Co-Workers`, `Friends`, `Offline`).
  - Status flags: `Online` (green star/dot), `Away` (yellow clock/door icon), `Busy` (red dash), `Offline` (gray circle).
  - Status messages display custom subtext or lyrics underneath the handle.
- **Chat Window & Direct Messaging**:
  - Split-pane layout: upper conversation history log, lower text composition area.
  - Simulated typing indicator: animated `ryan_grub is typing...` notification with character-specific pauses.
  - Player message selection: player selects from 2–4 authored Ink narrative choices; selected text animates in input box before automatically sending.
  - Formatting & Styling: supports classic BBCode/HTML font color, bold, italics, font family (`Comic Sans MS`, `Arial`, `Times New Roman`).
  - Sound FX:
    - `im_receive.wav` (classic incoming message chime)
    - `im_send.wav` (outgoing message swoosh)
    - `door_open.wav` (buddy signed online)
    - `door_slam.wav` (buddy signed offline)
- **Offline Messaging & Away Arrival**:
  - Contacts follow independent schedules. If a contact sends a message while the player is away (making tea, showering, working), the message is stored with timestamp and waiting alert indicator.

#### Pulse 6.x Specifications (Orion OS 6.x Upgrade)
- Requires Orion OS 6.0.
- Features: 48×48 avatar display pictures, custom emoticon packs, direct image file transfer preview, webcam indicator status.

---

### 2.2 Voyager Web Browser

```
+-----------------------------------------------------------------------------------+
| Voyager Browser - [ FindIt Search ]                                     _ [ ] [X] |
+-----------------------------------------------------------------------------------+
| File  Edit  View  Favorites  Tools  Help                                          |
+-----------------------------------------------------------------------------------+
| [< Back] [Forward >] [Stop] [Refresh] [Home] | Address: [ http://findit.local   ] |
+-----------------------------------------------------------------------------------+
| Links: [ FindIt ] [ DownloadHub ] [ TechMart ] [ BidBay ] [ NightBoard ] [ News ] |
+-----------------------------------------------------------------------------------+
| [ SearchMate Search: _______________________ [Search] [Weather: 68°F Clear] ] (X) |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                           F I N D I T   S E A R C H                               |
|                  The Fast, Local Index for the Fictional Web                      |
|                                                                                   |
|                   [                                      ] [ Search ]             |
|                                                                                   |
|         Popular: pulse messenger, used ram, nightboard, weather buddy             |
|                                                                                   |
+-----------------------------------------------------------------------------------+
| Done                                                      | [Progress: =====] [OK]|
+-----------------------------------------------------------------------------------+
```

#### Technical Specifications
- **Navigation Engine**:
  - Address bar accepts local `.local` domain routes (e.g. `http://findit.local`, `downloadhub.local/pulse`).
  - History stack tracks all traversed routes with working Back / Forward buttons.
  - Home button navigates to configured home page (defaults to `http://findit.local`).
  - Refresh button triggers simulated page re-render with authentic loading progress bar.
- **Bookmarks Toolbar**:
  - Pre-populated with default quick links (`FindIt`, `DownloadHub`, `TechMart`, `BidBay`, `NightBoard`, `CityWire`).
- **Loading & Progress Simulation**:
  - Page loads display authentic bottom status bar (`Opening page http://...`, animated transfer progress bar, final `Done` indicator).
- **404 & Error Handler**:
  - Unknown host or unmapped paths render retro HTTP 404 / 500 error pages.
- **SearchMate Toolbar Adware Injection**:
  - When infected via WeatherBuddy, an extra toolbar row docks beneath the navigation bar with SearchMate branding, search input, and weather widget, hijacking default search queries to `searchmate.local`.

---

### 2.3 RetroAmp 2.3 (MP3 & Media Audio Player)

```
+------------------------------------------+
| RETROAMP v2.3 - [02:41] 192kbps 44kHz    |
+------------------------------------------+
| [> Play] [|| Pause] [[] Stop] [<<] [>>]  |
| Volume: [||||||||||..] Track: Track 04   |
| Seek:   [========----------------------] |
| EQ:  _.-^^"-._                           |
+------------------------------------------+
| Playlist                                 |
| 1. Neon City Lights - Late Night (03:14) |
| 2. Motel Radio - Static Dreams   (02:48) |
| 3. Midnight Driver - 2006        (04:02) |
+------------------------------------------+
```

#### Technical Specifications
- Winamp 2.x aesthetic with digital LED timer display, audio spectrum visualizer, and compact brushed metal skin.
- Player Controls: Play, Pause, Stop, Previous Track, Next Track, Seek scrubber, Volume slider.
- Supported Audio Formats: Local simulated `.mp3`, `.wav` files stored in `C:/Music/`.
- Playlist Management: Drag and drop from File Explorer, add track, remove track, clear playlist, loop, shuffle.
- Visualizer: Real-time frequency bar animation during playback.

---

### 2.4 FlashFetch 3.1 (Download Manager)

```
+-------------------------------------------------------------------+
| FlashFetch 3.1 - Download Accelerator                   _ [ ] [X] |
+-------------------------------------------------------------------+
| Tasks  View  Options  Help                                        |
+-------------------------------------------------------------------+
| [+ New] [> Resume] [|| Pause] [X Cancel] [Schedule] [Settings]    |
+-------------------------------------------------------------------+
| File Name         Size     Done     Speed     ETA      Status     |
|-------------------------------------------------------------------|
| PulseSetup.exe    14.2 MB  14.2 MB  0 KB/s    00:00    Complete   |
| DemoGame.zip      68.4 MB  34.1 MB  32.0 KB/s 17:52    Downloading|
| SoundPack.mp3     24.0 MB   0.0 MB  0 KB/s    --:--    Queued     |
+-------------------------------------------------------------------+
| Active: 1 | Queued: 1 | Completed: 1 | Total Speed: 32.0 KB/s     |
+-------------------------------------------------------------------+
```

#### Technical Specifications
- Multi-threaded download manager simulation.
- Capabilities:
  - Supports queuing multiple downloads.
  - Pause and Resume functionality for resumable file servers.
  - Bandwidth throttling and priority re-ordering.
  - Scheduled downloads (e.g. trigger download overnight).
  - Eliminates download loss on accidental browser closure.

---

### 2.5 ZipMate 4.0 (Archive Utility)

- Windows ZIP utility clone (WinZip / 7-Zip aesthetic).
- Capabilities:
  - Opens `.zip` archives, inspects contents, directory trees, compressed vs uncompressed file sizes.
  - Extracts selected files or entire archive to chosen VFS destination folder.
  - Distribution Modes:
    1. **Installer version (`ZipMateSetup.exe`)**: Registers file association for `.zip`, creates desktop shortcut, registers in Add/Remove Programs.
    2. **Portable version (`ZipMate_Portable.zip`)**: Runs directly from extracted folder; does not register in Add/Remove Programs.

---

### 2.6 PhotoBox 3.0 (Photo Viewer & Editor)

- Next-generation digital photo management software.
- System Requirements:
  - Minimum OS: `Orion OS 6.0`
  - Minimum RAM: `768 MB` (recommends `1024 MB`)
- Behavior:
  - On baseline machine (Orion 4.8 / 512 MB RAM): installation/launch fails with clean error dialog explaining hardware requirements.
  - On upgraded machine (Orion 6.0 + 1 GB RAM): launches full image gallery, supports zoom, crop, rotate, and JPEG export for social profiles.

---

### 2.7 WeatherBuddy 1.4 & SearchMate Adware

- Fictional suspicious freeware application.
- Installer Behavior:
  - **Recommended / Express Install**: Silently installs SearchMate Toolbar, changes browser default home page to `http://searchmate.local`, and registers background autorun process.
  - **Custom Install**: Exposes unchecked bundle options (`[ ] Install SearchMate Toolbar`, `[ ] Set SearchMate as default homepage`), allowing clean installation.
- Runtime Behavior:
  - Displays desktop desk-pet / animated weather forecast widget.
  - Increases baseline RAM pressure by 48 MB.
  - Periodically triggers harmless period-authentic desktop popups.

---

### 2.8 SafeSweep Anti-Spyware Suite

- Fictional period-authentic security utility (Spybot Search & Destroy / Ad-Aware clone).
- Features:
  - "Scan System" scans VFS registry and browser configurations.
  - Detects SearchMate Toolbar, homepage hijacking, and suspicious startup autoruns.
  - "Fix Selected Threats" cleanly uninstalls the toolbar, resets browser homepage to `http://findit.local`, and removes startup entries.

---

### 2.9 PeerBox P2P File Sharing Client

- Fictional Kazaa / LimeWire / BearShare clone.
- Features:
  - Search tab allowing keyword queries across simulated P2P network peers.
  - Peer swarm simulation (displays seeders/leechers, bitrate, file size, format).
  - Download queue with risk flavor (chance of downloading mislabeled fake files or bundled junk).
  - Puts heavy pressure on HDD storage, forcing player disk cleanup decisions.

---

### 2.10 File Explorer / My Computer

- Canonical directory layout:
  - `C:/Desktop/`
  - `C:/Downloads/`
  - `C:/Program Files/`
  - `C:/Documents/`
  - `C:/Music/`
  - `C:/Pictures/`
  - `C:/Trash/`
- Features: List/Icon views, file size, modified dates, file deletion, double-click launch association, drive storage capacity gauge.

---

### 2.11 Notepad / Text Editor

- Plaintext editor for viewing and editing `.txt`, `.log`, `.nfo`, `.ini` files.
- Basic menu: File (New, Open, Save, Save As, Exit), Edit (Cut, Copy, Paste, Select All), Word Wrap toggle.

---

### 2.12 Command Prompt / Terminal Utility

- Command-line shell executing against the virtual file system and simulated network stack.
- Supported Commands:
  - `help`: lists available commands.
  - `dir [path]`: lists files, directories, sizes, and timestamps.
  - `cd [path]`: changes current working directory.
  - `type [file]`: outputs contents of text file to console.
  - `cls`: clears screen.
  - `ping [host]`: sends 4 ICMP echo requests to fake local hosts.
  - `tracert [host]`: traces route hops across simulated ISP gateways.
  - `ipconfig`: displays IP address, subnet mask, default gateway (`192.168.1.104`).
  - `unzip [archive] [target]`: command-line extraction of ZIP archives.

---

### 2.13 Control Panel, Add/Remove Programs & System Settings

- **Add/Remove Programs**:
  - Displays table of all installed software with publisher name, installation date, and size on disk.
  - Clean uninstall execution: frees occupied disk bytes, removes desktop and Start menu `.lnk` shortcuts, reverses owned browser/startup changes.
  - Ignores portable executables not installed via the installer framework.
- **System Properties / Settings**:
  - Displays hardware info: CPU tier, installed RAM, HDD total/free capacity, OS version.
  - Display properties: resolution scaling, wallpaper selector, CRT shader toggle.
  - Audio settings: master volume, system sound FX volume, music volume.

---

### 2.14 Mailbox (Webmail Client)

- Web-based email interface accessed via browser or desktop mail client shortcut.
- Features: Inbox, Sent, Drafts, Trash folders; unread message indicator; email detail viewer; file attachment download button (e.g. photos, receipts, documents).

---

### 2.15 Trash / Recycle Bin

- Holds deleted `FileRecord` items.
- Options: "Restore File" (returns file to original path) and "Empty Recycle Bin" (permanently destroys records and reclaims HDD capacity).

---

### 2.16 CamLink (Webcam Utility)

- Orion OS 6.0 camera capture utility.
- Features: Live preview feed, snapshot capture, save to `C:/Pictures/webcam_snap.jpg`, set as Pulse 6.x avatar.

---

## 3. Fake Internet — Complete 15+ Website Catalog

The game includes 18 fully specified, period-authentic websites running on simulated `.local` domains with zero external network dependencies.

```
+---------------------------------------------------------------------------------------+
| FAKE INTERNET DOMAIN MAP                                                              |
|                                                                                       |
|  [findit.local]            Search Engine (Hub for all discoveries & queries)          |
|        |                                                                              |
|        +---> [downloadhub.local]   Software Repository (Pulse, RetroAmp, etc.)        |
|        +---> [techmart.local]      New Hardware & Upgrades (RAM, HDD, DSL plans)      |
|        +---> [bidbay.local]        Used Classifieds & Auctions (Deals & pickups)      |
|        +---> [nightboard.local]    Tech & Community Forums (Lore & Rabbit Holes)      |
|        +---> [myplace.local]       Social Profiles (Maya, Nora, Music flavor)         |
|        +---> [citywire.local]      Local Municipal News & Weather                     |
|        +---> [jobs.local]          Classified Gigs & Shift Board                      |
|        +---> [goldnet.local]       Digital Gold Currency Exchange                     |
|        +---> [pulsechat.local]     Pulse Messenger Portal & Profiles                  |
|        +---> [orionsoft.local]     Orion OS Upgrade Center (OS 6.0 installer)         |
|        +---> [motellink.local]     Motel Room Rent & Bill Payment                     |
|        +---> [mailbox.local]       Webmail System (Bills, Notes, Attachments)         |
|        +---> [weatherbuddy.local]  Adware Freeware Portal                             |
|        +---> [retroamp.local]      MP3 Player Skins & Indie Tracks                    |
|        +---> [zipmate.local]       Archive Tool Vendor (Installer vs Portable)        |
|        +---> [safesweep.local]     Anti-Spyware & Cleaner Suite                       |
|        +---> [peerbox.local]       P2P File Sharing Network Portal                    |
|        +---> [searchmate.local]    Hijacked Adware Search Portal                      |
+---------------------------------------------------------------------------------------+
```

---

### 3.1 Catalog of All 18 Fake Internet Websites

#### 1. FindIt Search Engine
- **Host URL**: `http://findit.local`
- **Title**: FindIt Search — The Local Web Directory
- **Visual Style**: Minimalist 2000s search engine (white background, bold primary color logo, clean centered search input, quick link pills).
- **Page Structure**:
  - `/`: Search homepage with search input, "Search" and "I'm Feeling Lucky" buttons, popular query tag cloud.
  - `/search?q={query}`: Search results listing with page title links, green URL breadcrumbs, snippet text with bolded query matches, and result counts.
- **Interactive Elements**: Free-text query submission, pagination (`Page 1, 2, 3... [Next]`), search filters (`All`, `Software`, `Community`, `News`).
- **Downloads**: None directly.
- **Hidden Lore & Clues**: Searching character handles (`nightowl87`, `maya_blue`, `ryan_grub`), real names learned during the story, software errors (`error 0x80040154`, `SearchMate toolbar fix`), or local city landmarks yields hidden forum threads and unindexed pages.
- **Timeline Evolution**: Search index dynamically expands on Days 2, 4, 8, and 12 as new forum threads and news articles are published.

---

#### 2. DownloadHub Software Repository
- **Host URL**: `http://downloadhub.local`
- **Title**: DownloadHub — Safe Freeware & Shareware Directory
- **Visual Style**: CNET / Download.com early 2000s layout: top blue navigation bar, left category sidebar, star rating badges, large green "Download Now" buttons.
- **Page Structure**:
  - `/`: Featured software of the week, top 10 downloads table, new releases.
  - `/cat/internet`: Category page for Messenger tools, download accelerators, browsers.
  - `/cat/multimedia`: Audio players, image viewers, media codecs.
  - `/cat/utilities`: Archivers, security scanners, disk tools.
  - `/app/{id}`: Detailed software listing with screenshot, version history, file size, license type, system requirements, and direct download button.
- **Interactive Elements**: Category navigation, user review rating stars, download CTA button triggering `startDownload(fileId, sourceId)`.
- **Downloadable Files**:
  - `PulseSetup.exe` (14.2 MB, Pulse Messenger 5.2, max speed 48 KB/s)
  - `FlashFetchSetup.exe` (4.8 MB, FlashFetch 3.1, max speed 64 KB/s)
  - `RetroAmpSetup.exe` (6.2 MB, RetroAmp 2.3, max speed 56 KB/s)
  - `ZipMateSetup.exe` (3.1 MB, ZipMate 4.0, max speed 64 KB/s)
  - `PhotoBoxSetup.exe` (28.4 MB, PhotoBox 3.0, max speed 32 KB/s, requires OS 6 / 768MB)
  - `WeatherBuddySetup.exe` (2.4 MB, WeatherBuddy 1.4, max speed 64 KB/s)
  - `SafeSweepSetup.exe` (8.6 MB, SafeSweep 2.0, max speed 48 KB/s)
  - `PeerBoxSetup.exe` (5.1 MB, PeerBox 1.2, max speed 40 KB/s)
- **Hidden Lore & Clues**: User reviews under WeatherBuddy contain angry warnings from users complaining about toolbar hijacking and browser slowness.

---

#### 3. TechMart Electronics & Hardware
- **Host URL**: `http://techmart.local`
- **Title**: TechMart — Computer Hardware, Upgrades & Peripherals
- **Visual Style**: Classic retail e-commerce portal: navy/yellow banner, product grid with thumbnail images, regular price strikethroughs, "In Stock" badges.
- **Page Structure**:
  - `/`: Weekly sales, featured memory upgrades, broadband plan promos.
  - `/ram`: RAM upgrade catalog (512 MB PC133 SDRAM module for `$48.00`, 1 GB DDR module for `$82.00`).
  - `/storage`: 80 GB 7200 RPM IDE Hard Drive (`$65.00`), External USB storage.
  - `/broadband`: DSL plan upgrades (`512 kbps DSL Upgrade` for `$30.00/mo`, `1.0 Mbps Broadband` for `$50.00/mo`).
  - `/checkout`: Cart confirmation and simulated payment execution.
- **Interactive Elements**: "Add to Cart", "Buy Now" button with immediate balance check and simulation dispatch, specification comparison tables.
- **Downloads**: None.
- **Hidden Lore & Clues**: Customer reviews mention that buying brand-new RAM from TechMart is 100% reliable compared to shady classifieds on BidBay.

---

#### 4. BidBay Classifieds & Auctions
- **Host URL**: `http://bidbay.local`
- **Title**: BidBay — Local Classifieds, Secondhand Hardware & Auctions
- **Visual Style**: Early eBay / Craigslist hybrid: dense item lists, green/red bidding counters, seller rating percentages, grainy low-res product photos.
- **Page Structure**:
  - `/`: Category directory (Electronics, Auto, Furniture, Services).
  - `/listing/ram-512`: Used 512 MB SDRAM module (`$26.00` Buy-It-Now, seller `circuit_surfer99`).
  - `/listing/hdd-60gb`: Used 60 GB IDE HDD (`$34.00`, seller `motel_dweller`).
  - `/listing/speakers`: Vintage desktop stereo speakers (`$12.00`).
  - `/listing/crt-monitor`: 17-inch flat CRT display (`$20.00` local pickup).
- **Interactive Elements**: "Place Bid", "Buy It Now", "Contact Seller via Message" action triggering Ink dialogue beat or physical pickup event.
- **Downloads**: None.
- **Hidden Lore & Clues**: Several listings are posted by characters living near the motel. Listings expire or get marked "SOLD" if player delays across days.

---

#### 5. MyPlace Social Networking
- **Host URL**: `http://myplace.local`
- **Title**: MyPlace — Connect with Friends & Share Your Life
- **Visual Style**: Authentic MySpace 2004–2006 aesthetic: custom CSS backgrounds (glitter GIFs, tiled dark wallpaper), top 8 friends grid, embedded audio player snippet, marquee text, guestbook comments.
- **Page Structure**:
  - `/u/maya_blue`: Maya's personal page: photography hobby, film reviews, current mood ("pensive"), embedded music player track, comment wall.
  - `/u/nightowl87`: Nora's personal page: late-night poetry, tech hardware rants, cryptic quotes, links to NightBoard threads.
  - `/u/ryan_grub`: Ryan's profile: workplace inside jokes, sports team banter, car photos.
  - `/u/traveler_06`: Player's customizable profile (editable mood, status, top buddies).
- **Interactive Elements**: "Leave a Comment", "Add to Friends", view photo album modal.
- **Downloads**: Embedded image downloads (saves profile photo to `C:/Pictures/`).
- **Hidden Lore & Clues**: Cross-referencing Nora's profile photos and captions reveals references to locations near the protagonist's bus stop.

---

#### 6. NightBoard Tech & Community Forums
- **Host URL**: `http://nightboard.local`
- **Title**: NightBoard — Late Night Hardware, Software & Local Discussion
- **Visual Style**: vBulletin / phpBB classic forum styling: dark theme (`#1E222A`), table-based thread lists, user avatars, post counts, user signatures with ASCII art.
- **Page Structure**:
  - `/`: Forum sub-boards (`General Discussion`, `PC Hardware & Overclocking`, `Software & Freeware`, `Local City Underground`).
  - `/thread/3091`: "SafeSweep vs SearchMate: Don't install WeatherBuddy!" (Rabbit Hole A).
  - `/thread/4820`: "Who remembers the old radio tower downtown?" (Posted by `nightowl87` in 2004).
  - `/thread/5112`: "Orion OS 6.0 upgrade tips and RAM requirements" (Hardware guide).
- **Interactive Elements**: "Search Forum", "Reply to Thread" (selected authored choices), page navigation.
- **Downloads**: Code snippets, attached zip utility patches.
- **Hidden Lore & Clues**: Thread timestamps date back to 2002–2005, giving authentic historical depth to the game world.

---

#### 7. CityWire Local News
- **Host URL**: `http://citywire.local`
- **Title**: CityWire — Independent Local News & Metro Chronicle
- **Visual Style**: 2000s newspaper website: two-column serif layout, black and white weather widget, grainy photo illustrations, banner advertisements.
- **Page Structure**:
  - `/`: Top headlines, breaking news, metro traffic report, weekly forecast.
  - `/article/motel-zoning`: "City Council debates commercial zoning near West End motels".
  - `/article/food-cart-festival`: News piece mentioning the food carts where Ryan and the player work.
  - `/article/gold-surge`: Financial column analyzing online digital-gold services.
- **Interactive Elements**: "Read Full Article", "Share via Pulse IM", "Archive Search".
- **Downloads**: None.
- **Hidden Lore & Clues**: Directly corroborates physical world events, street observations, and workplace developments.

---

#### 8. Jobs Local Gig & Shift Board
- **Host URL**: `http://jobs.local`
- **Title**: Metro Jobs — Local Classifieds & Hourly Shifts
- **Visual Style**: Plain text classified board layout with category headers and salary tags.
- **Page Structure**:
  - `/`: Available listings sorted by date and neighborhood.
  - `/job/foodcart-shift`: Extra evening shift at the food cart (`+$32.00`, 3 hours, `-25 Energy`).
  - `/job/flyer-dist`: Flyer distribution gig downtown (`+$28.00`, 2 hours, `-30 Energy`).
- **Interactive Elements**: "Accept Shift" button triggering time jump, cash addition, and energy deduction.
- **Downloads**: None.

---

#### 9. GoldNet Digital Gold Currency Exchange
- **Host URL**: `http://goldnet.local` (also aliased as `bullionnet.local`)
- **Title**: GoldNet — Electronic Gold Currency & Settlement System
- **Visual Style**: Pre-crypto digital currency exchange (E-Gold / 1MDC style): serif gold-foil logos, real-time gold ounce exchange rate ticker, SSL security badges.
- **Page Structure**:
  - `/`: Current spot price per ounce (e.g. `$420.50/oz`), market chart, deposit instructions.
  - `/account`: Player account ledger displaying USD balance and GoldNet gram/ounce balance.
  - `/trade`: Buy/Sell order form with instant simulated execution.
- **Interactive Elements**: Deposit funds, place buy order, place sell order, withdraw to cash.
- **Downloads**: Account statement receipt (`.txt`).
- **Hidden Lore & Clues**: Gold price undergoes authored fluctuations (small steady climb, sudden mid-week dip, sharp recovery on Day 13), rewarding observant players.

---

#### 10. Pulse Messenger Official Portal
- **Host URL**: `http://pulsechat.local`
- **Title**: Pulse Messenger — Instant Messaging for Everyone
- **Visual Style**: Official product marketing portal: friendly mascots, feature bullet points, system requirements chart, download CTA.
- **Page Structure**:
  - `/`: Product highlights, "Download Pulse 5.2 Now".
  - `/help`: Connection troubleshooting, away message setup guide.
  - `/profiles`: Web directory of registered handles.
- **Downloads**: `PulseSetup.exe` (direct mirror).

---

#### 11. Orion Software Updates & System Center
- **Host URL**: `http://orionsoft.local`
- **Title**: Orion Software — Operating System Updates & Service Packs
- **Visual Style**: Corporate enterprise software site: gray navigation header, product documentation tabs.
- **Page Structure**:
  - `/`: Orion OS 6.0 announcement, upgrade requirements checklist.
  - `/check`: Web-based diagnostic scanning current browser user-agent and reporting RAM/OS compatibility.
  - `/download`: Download link for `Orion6Upgrade.iso` / `Orion6Setup.exe` (140 MB, requires 512MB RAM minimum, 1GB recommended).
- **Downloads**: `Orion6Setup.exe` (140 MB upgrade package).

---

#### 12. MotelLink Resident Portal & Bill Pay
- **Host URL**: `http://motellink.local` (aliased as `quickpay.local`)
- **Title**: MotelLink — Extended Stay Resident Account & Utility Billing
- **Visual Style**: Utilitarian green/gray web portal with login banner and payment receipt ledger.
- **Page Structure**:
  - `/`: Resident dashboard: Room #14, Weekly Rent Due Date (Day 7 / Day 14), Amount Due (`$140.00`), DSL Internet Charge (`$25.00`).
  - `/pay`: Payment authorization button deducting from player cash.
- **Interactive Elements**: "Pay Rent", "Pay Internet Bill", view historical payment receipts.

---

#### 13. Mailbox Webmail Client
- **Host URL**: `http://mailbox.local`
- **Title**: Mailbox — Personal Webmail
- **Visual Style**: SquirrelMail / Horde vintage webmail interface: left folder list (Inbox, Sent, Trash), main message table with bold unread rows, message reading frame.
- **Page Structure**:
  - `/inbox`: List of incoming emails with sender, subject, date, attachment icon.
  - `/read/{id}`: Full email text view with "Download Attachment" and "Reply" button.
- **Interactive Elements**: Read email, mark read/unread, download attachments (e.g. photos, receipts, setup files), select authored reply choices.

---

#### 14. WeatherBuddy Freeware Portal
- **Host URL**: `http://weatherbuddy.local`
- **Title**: WeatherBuddy — Free Real-Time Desktop Weather Forecasts
- **Visual Style**: Cheerful, slightly obnoxious cartoon mascot (smiling cloud/sun), blinking "FREE DOWNLOAD" animated GIF banner.
- **Page Structure**:
  - `/`: Download page with testimonials and feature lists ("Accurate radar!", "Desktop alerts!").
- **Downloads**: `WeatherBuddySetup.exe` (bundled installer).

---

#### 15. RetroAmp Audio & Skins Repository
- **Host URL**: `http://retroamp.local`
- **Title**: RetroAmp — The Ultimate Media Player & Skins Archive
- **Visual Style**: High-contrast tech archive with neon accents and skin preview thumbnails.
- **Page Structure**:
  - `/`: Download player, browse top skins (`Classic Obsidian`, `Retro Brushed Chrome`, `Neon Cyber`).
  - `/tracks`: Free downloadable indie MP3 tracks by fictional in-game artists.
- **Downloads**: `RetroAmpSetup.exe`, `skin_obsidian.wsz`, `track01.mp3`, `track02.mp3`.

---

#### 16. ZipMate Official Utility Site
- **Host URL**: `http://zipmate.local`
- **Title**: ZipMate — Fast File Compression & Archive Manager
- **Visual Style**: Classic utilitarian shareware site with comparison table ("Installer vs Portable Edition").
- **Page Structure**:
  - `/`: Download options for both `ZipMateSetup.exe` (full installer) and `ZipMate_Portable.zip` (standalone).
- **Downloads**: `ZipMateSetup.exe` and `ZipMate_Portable.zip`.

---

#### 17. SafeSweep Security Center
- **Host URL**: `http://safesweep.local`
- **Title**: SafeSweep — Adware, Spyware & Toolbar Removal Tools
- **Visual Style**: Clean medical/security aesthetic with green shield logo and malware database statistics.
- **Page Structure**:
  - `/`: "Download SafeSweep Free Edition", latest threat definitions database, adware removal instructions.
- **Downloads**: `SafeSweepSetup.exe`.

---

#### 18. SearchMate Portal (Adware Landing Page)
- **Host URL**: `http://searchmate.local`
- **Title**: SearchMate — The Fast Smart Search Toolbar
- **Visual Style**: Cluttered commercial ad portal with yellow search bar, sponsored ads, and generic horoscope/weather widgets.
- **Page Structure**:
  - `/`: Injected default search portal when hijacked by WeatherBuddy.
- **Interactive Elements**: Search bar redirecting to sponsored ad listings.

---

### 3.2 Authored Cross-Site Rabbit Holes

```
+-----------------------------------------------------------------------------------+
| RABBIT HOLE A: Software Literacy & Toolbar Remediation                            |
|  [FindIt / DownloadHub]                                                           |
|       |                                                                           |
|       v                                                                           |
|  Downloads WeatherBuddy 1.4 (Express Install)                                     |
|       |                                                                           |
|       v                                                                           |
|  Browser infected: Homepage hijacked to searchmate.local + Toolbar injected       |
|       |                                                                           |
|       v                                                                           |
|  NightBoard Forum Thread #3091: Users complain and recommend SafeSweep            |
|       |                                                                           |
|       v                                                                           |
|  Download SafeSweep from safesweep.local -> Scan & Clean -> Browser restored      |
+-----------------------------------------------------------------------------------+

+-----------------------------------------------------------------------------------+
| RABBIT HOLE B: Identity & Nora / NightOwl87                                       |
|  NightBoard Forum Post by "nightowl87" discussing old radio tower (2004)          |
|       |                                                                           |
|       v                                                                           |
|  Search FindIt: "nightowl87"                                                      |
|       |                                                                           |
|       v                                                                           |
|  Discovers MyPlace profile: http://myplace.local/u/nightowl87                     |
|       |                                                                           |
|       v                                                                           |
|  Reads photo captions referencing street corner near player's motel               |
|       |                                                                           |
|       v                                                                           |
|  Correlates online identity with physical street regular seen from window         |
|       |                                                                           |
|       v                                                                           |
|  Unlocks unique dialogue choice when adding contact on Pulse Messenger            |
+-----------------------------------------------------------------------------------+
```

---

## 4. Virtual File System & Downloads Pipeline

### 4.1 VFS Architecture & Directory Hierarchy

The Virtual File System operates strictly inside the pure TypeScript domain layer, persisting to IndexedDB via Dexie.

```
C:/
├── Desktop/
│   ├── My Computer.lnk
│   ├── Voyager Browser.lnk
│   ├── Pulse Messenger.lnk
│   └── Trash.lnk
├── Downloads/
│   ├── PulseSetup.exe
│   ├── FlashFetchSetup.exe
│   └── ZipMate_Portable.zip
├── Program Files/
│   ├── Voyager/
│   ├── Pulse/
│   ├── RetroAmp/
│   └── ZipMate/
├── Documents/
│   ├── Readme.txt
│   └── Notes.txt
├── Music/
│   ├── Track01.mp3
│   └── Track02.mp3
├── Pictures/
│   ├── Wallpaper_Classic.bmp
│   └── maya_photo.jpg
└── Trash/
```

#### File Record Schema
```ts
interface FileRecord {
  id: string;
  name: string;
  path: string; // e.g. "C:/Downloads/PulseSetup.exe"
  kind: 'executable' | 'archive' | 'audio' | 'image' | 'text' | 'shortcut' | 'system';
  sizeBytes: number;
  createdAt: number;
  appAssociation?: string; // e.g. "app.retroamp"
  metadata?: {
    isPortable?: boolean;
    isAdware?: boolean;
    author?: string;
    version?: string;
    readOnly?: boolean;
    extractedFiles?: string[];
  };
}
```

---

### 4.2 Storage Capacity & Hardware Progression

- **Starting Hard Disk Drive**:
  - Total Capacity: `40.0 GB` (`40,960 MB`)
  - Occupied Base System: `~33.8 GB` (`34,611 MB`)
  - Free Capacity: `~7.15 GB` (`7,349 MB`)
- **Accounting Engine**:
  - Every download task allocates `totalBytes` upon completion.
  - Software installation reserves `installedBytes` in `C:/Program Files/`.
  - Deleting files or uninstalling programs immediately increments free storage.
  - Attempting a download or extraction when free storage < required bytes fails with a native `Disk Full` error dialog.

---

### 4.3 Authoritative Background Download Engine

#### Download Task Schema
```ts
interface DownloadTask {
  id: string;
  sourceId: string;
  fileName: string;
  totalBytes: number;
  downloadedBytes: number;
  sourceMaxKbps: number;
  status: 'queued' | 'downloading' | 'paused' | 'complete' | 'failed';
  resumable: boolean;
  startedAt: number;
  completedAt?: number;
  targetPath: string; // Defaults to "C:/Downloads/"
  manager: 'browser' | 'flashfetch';
}
```

#### Progress Advance Formula
$$\Delta \text{Bytes} = \min(\text{PlayerConnectionKbps}, \text{SourceMaxKbps}) \times \frac{1024}{8} \times \Delta \text{Seconds}$$

- **Continuity Invariance**: Progress calculation uses the exact same function during 1-second real-time loop ticks, 6-minute tea jumps, 4-hour work shifts, and overnight sleep jumps.

---

### 4.4 Data-Driven Installer Wizard Framework

```
+-------------------------------------------------------------------+
| Setup - Pulse Messenger 5.2                             _ [ ] [X] |
+-------------------------------------------------------------------+
|  [Logo]   Welcome to the Pulse Messenger Setup Wizard             |
|                                                                   |
|           This wizard will install Pulse Messenger 5.2 on your    |
|           computer.                                               |
|                                                                   |
|           System Requirements Check:                              |
|           [OK] Operating System: Orion OS 4.8 or higher           |
|           [OK] System Memory: 512 MB RAM detected                 |
|           [OK] Hard Disk Space: 32 MB available                   |
|                                                                   |
|           Click Next to continue, or Cancel to exit Setup.        |
+-------------------------------------------------------------------+
| [< Back]                                      [ Next > ] [ Cancel]|
+-------------------------------------------------------------------+
```

#### Standard 6-Stage Wizard Workflow
1. **Welcome Screen**: Displays application name, version, publisher, and introductory text.
2. **Compatibility & System Check**:
   - Validates `minOs`, `minRamMb`, `minCpuTier`.
   - If requirements fail (e.g. PhotoBox on Orion 4.8), wizard highlights failing requirement in red and disables the "Next" button with an explicit remediation hint.
3. **Destination Directory**: Defaults to `C:/Program Files/{AppName}/` with browse capability and disk space check.
4. **Optional Components & Bundled Offers**:
   - Renders checkboxes for desktop shortcut, start menu entry, and optional third-party software (e.g. SearchMate toolbar).
5. **Installation Progress**:
   - Animates a progress bar while advancing 1–2 minutes of in-game time.
   - Writes application binaries to `C:/Program Files/`, creates shortcuts in `C:/Desktop/`, and registers record in Add/Remove Programs.
6. **Completion & Launch**: Confirms successful setup with `[x] Launch application now` checkbox.

---

## 5. Audio Triggers & Sound FX Specifications

The desktop environment features authentic sound effects triggered by discrete simulation events.

| Event ID | Audio Asset / Trigger | Description |
|----------|-----------------------|-------------|
| `sys_boot_48` | `assets/audio/sys_boot_48.wav` | Classic retro 16-bit synth chord played when Orion OS 4.8 finishes booting. |
| `sys_boot_60` | `assets/audio/sys_boot_60.wav` | Warm orchestral chime played when Orion OS 6.x boots. |
| `sys_shutdown` | `assets/audio/sys_shutdown.wav` | Descending chime played on system shutdown. |
| `modem_dial` | `assets/audio/modem_dial.wav` | Authentic 56k/DSL negotiation: DTMF tones, carrier screech, handshake hiss. |
| `im_msg_recv` | `assets/audio/im_receive.wav` | Two-tone marimba chime played when a new chat message arrives in Pulse. |
| `im_msg_send` | `assets/audio/im_send.wav` | Crisp swoosh sound played when sending a chat message. |
| `im_buddy_on` | `assets/audio/door_open.wav` | Creaking door opening sound when a contact comes online. |
| `im_buddy_off`| `assets/audio/door_slam.wav` | Door slamming sound when a contact signs off. |
| `im_typing` | `assets/audio/typing_tick.wav` | Subtle soft click when simulated typing indicators are active. |
| `dlg_error` | `assets/audio/error_chord.wav` | Classic metallic error thud played on invalid operation or compatibility failure. |
| `dlg_warning` | `assets/audio/warning_ding.wav` | High-pitched warning ding played on low disk space or adware alert. |
| `trash_empty` | `assets/audio/crumple_paper.wav`| Paper crumpling sound effect played when emptying the Recycle Bin. |
| `nav_click` | `assets/audio/browser_click.wav` | Subtle mechanical click sound played on hyperlink navigation in Voyager. |
| `app_install` | `assets/audio/install_done.wav` | Fanfare chime played upon installer wizard completion. |

---

## 6. Acceptance & Verification Test Matrix

All features documented above map directly to the automated test suite specified in `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md`.

```
+---------------------------------------------------------------------------------------+
| VERIFICATION TEST COVERAGE MATRIX                                                     |
|                                                                                       |
|  Test Suite           Targets Verified                                                |
|  ------------------   --------------------------------------------------------------  |
|  Vitest Unit          * Clock advance & time-jump calculations                        |
|                       * Download throughput math & source bottle-necking              |
|                       * VFS FileRecord allocation & disk capacity recalculation       |
|                       * Installer requirements validation & Add/Remove registry       |
|                       * Zod content schema validation for all 18 fake websites        |
|                                                                                       |
|  Vitest Integration   * Background download continuation across view switches         |
|                       * WeatherBuddy install -> SearchMate hijack -> SafeSweep clean  |
|                       * Orion OS 6 upgrade -> PhotoBox compatibility unlock           |
|                       * Pulse message queueing while away from PC                     |
|                                                                                       |
|  Playwright E2E       * Scenario A: Core download, install, and chat loop             |
|                       * Scenario B: Software literacy & adware toolbar remediation    |
|                       * Scenario C: RAM purchase & Orion OS 6 upgrade verification    |
|                       * Scenario E: Save/reload persistence fidelity across sessions  |
+---------------------------------------------------------------------------------------+
```

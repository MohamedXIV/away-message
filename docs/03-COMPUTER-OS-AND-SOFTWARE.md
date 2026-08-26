# Computer, Operating System, and Software

## 1. Computer fantasy

The PC should feel like a small simulated ecosystem.

It must be believable enough that the player naturally thinks in terms of:

- files,
- storage,
- installed programs,
- downloads,
- startup,
- memory,
- compatibility,
- software versions,
- internet speed.

It must not attempt to emulate a real operating system completely.

---

## 2. Two operating-system generations

The game uses a fictional OS family.

### Orion OS 4.x

Visual inspiration:
- Windows 98 / ME / 2000 generation
- compact controls
- stronger bevels
- older icon language
- sparse effects
- dense layout

Behavior:
- lower overhead
- compatible with older programs
- limited support for newer programs
- old browser generation

Starting version:
`Orion OS 4.8`

### Orion OS 6.x

Visual inspiration:
- Windows XP generation
- warmer, cleaner, friendlier
- modest rounding
- richer icons
- slightly more polished desktop shell
- not modern flat design
- not an exact Windows XP copy

Behavior:
- supports newer apps
- enables newer browser/Messenger versions
- more background overhead
- benefits from more RAM

The upgrade should be both aesthetic and functional.

---

## 3. Starting PC

Canonical starting values:

```text
OS: Orion 4.8
CPU Tier: 1
RAM: 512 MB
HDD: 40 GB
Free disk: ~7 GB
Internet: 256 kbps DSL
```

These are gameplay abstractions, not hardware-accurate simulation.

---

## 4. Upgrade options

Evaluation build should support at least:

### RAM
- 512 MB → 1 GB
- meaningful compatibility/performance impact

### Storage
- free space by deleting files
- optional larger HDD / second drive abstraction

### Internet
- 256 kbps → 512 kbps or 1 Mbps
- actual download ETA improvement

### OS
- Orion 4.8 → Orion 6.x
- requires sufficient RAM
- restart/install flow

Optional:
- CPU Tier 1 → Tier 2 through a used PC or motherboard/CPU bundle.

---

## 5. Performance model

Keep it understandable.

Each running app can define:
- memory use,
- startup cost,
- optional CPU weight.

The PC can compute:

```text
RAM pressure = running app memory / installed RAM
```

Possible effects at high pressure:
- slower app launch,
- longer UI operation delay,
- warning,
- prevented launch only for extreme cases.

Do not simulate scheduling, paging, or real CPU cycles.

---

## 6. File-system illusion

Required folders:

- Desktop
- Downloads
- Program Files
- Documents
- Music
- Pictures

A file record can include:

```ts
interface FileRecord {
  id: string;
  name: string;
  path: string;
  kind: string;
  sizeBytes: number;
  createdAt: number;
  appAssociation?: string;
  metadata?: Record<string, unknown>;
}
```

Required behaviors:
- downloads create files,
- installers can be run,
- ZIP files can be extracted,
- photos can be opened when compatible software exists,
- files occupy disk space,
- deleting files frees disk space,
- installed software can create shortcuts/files.

Do not expose the real host filesystem.

---

## 7. Download simulation

A download is authoritative simulation data.

Suggested shape:

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
}
```

Effective speed is constrained by:
- player connection,
- source server,
- optional download-manager behavior.

A download continues:
- browser closed,
- app minimized,
- player in room,
- player at window,
- player at work if the computer was left running and the content permits it,
- during explicit in-game time jumps.

---

## 8. Browser downloads vs FlashFetch

Browser:
- simple,
- can be fragile,
- small downloads are fine,
- one active task is enough for early game.

FlashFetch:
- resume,
- queue,
- more reliable large downloads,
- optional scheduled start,
- visible reason to install it.

One larger demo/media file should make the benefit obvious.

---

## 9. Installer framework

Use a reusable data-driven installer.

Typical steps:
1. Welcome
2. Compatibility
3. Destination
4. Optional components / bundled offers
5. Install progress
6. Finish / launch

Installer choices must have backing state.

Examples:
- desktop shortcut,
- startup item,
- optional toolbar,
- homepage change.

Install progress can advance a small amount of game time.

---

## 10. Software catalog

The exact balance numbers are defaults and can be tuned without changing the system purpose.

### Voyager Browser
Preinstalled.
- local fake URL navigation
- history
- bookmarks
- home page
- downloads

### Pulse Messenger 5.2
Early social unlock.
- contact list
- statuses
- chat history
- notifications
- authored reply choices

### Pulse Messenger 6.x
Requires Orion 6.
Possible additions:
- display pictures
- richer emoticons
- improved file transfer
- webcam indicator/support

### FlashFetch 3.1
Download manager.
- resume
- queue
- schedule

### RetroAmp 2.3
Music player.
- playlists
- local fictional tracks
- visual personality
- optional skins later

### ZipMate 4.0
Archive tool.
Downloads:
- installer
- portable ZIP
Portable route does not appear in Add/Remove Programs.

### PhotoBox 3.0
Newer photo viewer/editor.
Requires:
- Orion 6+
- at least 768 MB RAM
Starting PC must fail cleanly.

### WeatherBuddy 1.4
Suspicious freeware.
Recommended install preselects:
- SearchMate Toolbar
- homepage change
- launch at startup

Custom install can avoid extras.

### SafeSweep
Later anti-spyware / cleanup utility.
Can:
- identify SearchMate extras,
- remove optional unwanted components,
- provide a period-authentic utility fantasy.

### PeerBox
Optional P2P client.
Purpose:
- large downloads,
- file discovery,
- minor risk/flavor,
- disk-space pressure.

No real piracy content is required.

### CamLink
Optional Orion 6 utility.
Purpose:
- makes webcam/photo sharing feel like a hardware/software unlock.

---

## 11. Add/Remove Programs

Must show installed software that used installers.

Portable programs do not appear.

Uninstall must:
- free owned installed size,
- remove shortcuts,
- reverse owned browser/startup modifications when appropriate,
- not delete unrelated user files.

---

## 12. Terminal

The terminal is optional for basic progression but should be genuinely usable.

Minimum commands:

```text
help
dir
cd
type
cls
ping
tracert
ipconfig
```

Optional:
```text
ftp
unzip
netstat
```

The terminal should use the game's fake filesystem/network model.

It can provide alternate routes to:
- inspect a file,
- discover a host name,
- verify a connection,
- extract an archive.

Computer literacy may reward the player but must not block normal progression.

---

## 13. No real malware

Bundled software, toolbar hijacking, startup changes, and warnings are fictional state changes inside the game.

Do not access:
- host registry,
- host browser settings,
- host filesystem,
- real network configuration.

The joke is period authenticity, not actual harmful behavior.

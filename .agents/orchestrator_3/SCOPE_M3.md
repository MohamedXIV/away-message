# Scope: Milestone 3 (Fake Internet, Browser & Desktop Applications Ecosystem)

## 1. Objectives
Deliver the complete Fake Internet and desktop applications ecosystem:
1. **Voyager Web Browser (`src/apps/browser/`)**:
   - Address bar, Back/Forward history navigation, Refresh, Home button, Bookmarks toolbar, Download progress bar in status area.
   - SearchMate adware toolbar injection slot (when WeatherBuddy bundled adware is installed).
2. **Fake Internet Engine & 18 Websites (`src/internet/`)**:
   - `InternetRouter.ts`: Local URL resolution, route dispatching, 404 handler, network latency simulation based on connection type (56k vs DSL).
   - `searchIndex.ts`: Full-text keyword search indexing for `findit.local`, query normalization, date/knowledge/narrative gating.
   - 18 period-authentic websites:
     1. `findit.local` (Search engine with category filters & dynamic results)
     2. `downloadhub.local` (Software directory with download links for FlashFetch, RetroAmp, ZipMate, WeatherBuddy, SafeSweep, PhotoBox)
     3. `pulsechat.local` (Pulse Messenger downloads, skins, buddy profile search)
     4. `techmart.local` (Hardware/software shop for RAM, HDD, OS 6 upgrade)
     5. `bidbay.local` (Digital auctions/classifieds with used hardware listings)
     6. `myplace.local` (Social profile pages with personal blogs, photo albums, guestbook)
     7. `mailbox.local` (Webmail client with inbox, message viewer, attachments)
     8. `nightboard.local` (Period forum with threads, tech debates, Rabbit Holes A & B)
     9. `citywire.local` (Local news articles, weather forecasts, city events)
     10. `jobs.local` (Classified job listings, food cart notices)
     11. `goldnet.local` (Digital gold currency vault & price charts)
     12. `weatherbuddy.local` (Freeware landing page for WeatherBuddy)
     13. `retroamp.local` (RetroAmp skins and audio player downloads)
     14. `orionsoft.local` (Orion OS vendor portal, Orion 6.0 upgrade specs)
     15. `zipmate.local` (ZipMate archive utility page, installer vs portable ZIP)
     16. `safesweep.local` (SafeSweep security utility page)
     17. `peerbox.local` (P2P file sharing portal)
     18. `motellink.local` (Motel resident portal & local community bulletin)
3. **Pulse Messenger 5.2 / 6.0 (`src/apps/pulse/`)**:
   - Buddy list grouped by status (Online, Away, Busy, Offline).
   - Custom away message creator and editor.
   - Simulated typing indicators and realistic cadence.
   - Multi-tab IM chat windows with message histories.
   - Web Audio chimes (`door_open`, `door_slam`, `im_recv`, `im_send`).
   - Background incoming message notifications when minimized/unfocused.
4. **Desktop Applications Ecosystem (`src/apps/`)**:
   - `RetroAmp`: Winamp 2.x style player with playlist, play/pause/stop/seek, volume, VU meter/equalizer visualization, synthesized audio tracks.
   - `FlashFetch`: Download accelerator with multi-part segment bars, queue management, speed graph.
   - `ZipMate`: Archive inspection, file extraction to VFS directories (`C:/Downloads/extracted`).
   - `PhotoBox 3.0`: Photo viewer/editor gated by Orion OS 6.x and 768MB+ RAM requirement; displays clear diagnostic error dialog on Orion 4.8 / 512MB RAM.
   - `WeatherBuddy`: Desktop widget showing live simulated weather, bundling SearchMate toolbar adware (hijacks browser start page and search provider).
   - `SafeSweep`: Anti-adware scanner, detects SearchMate toolbar and registry modifications, removes adware and restores browser settings.
5. **Unit & Integration Tests (`tests/unit/`, `tests/integration/`)**:
   - Browser navigation, history stack, bookmarks.
   - Search indexing and keyword normalization.
   - Pulse messenger state, status changes, away messages.
   - PhotoBox hardware/OS requirement gating.
   - WeatherBuddy adware injection and SafeSweep remediation.

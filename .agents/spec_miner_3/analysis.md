# Authoritative Specification Mining Analysis: Narrative Architecture & Comprehensive Testing Strategy

**Project**: Away Message (Mid-2000s Internet Life Sim)  
**Agent**: `spec_miner_3` (Specification Miner)  
**Date**: 2026-08-22  
**Target Build**: 14-Day Complete Playable Evaluation Build  
**Primary Specification References**: `docs/00-VISION-AND-EVALUATION.md` through `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md`, `docs/09-MANUS-RUN-CONSTRAINTS.md`, `docs/README.md`, `ORIGINAL_REQUEST.md`

---

## 1. Executive Summary & Specification Scope

The "Away Message" evaluation build is an authoritative, diegetic narrative life simulation set in a fictionalized 2006. It models the lived experience of living in a cheap motel room, working a food-service job, browsing a fragmented mid-2000s fake internet, managing PC hardware and software ecosystems across two operating system generations (`Orion OS 4.8` and `Orion OS 6.x`), chatting via an authentic instant messenger (`Pulse Messenger`), and navigating authored social relationships that bridge digital and physical worlds.

This document establishes the exhaustive specification for:
1. **The 14-Day Narrative Architecture**: Day-by-day story arcs, complete buddy character profiles, 14-day schedule matrices, away message lore, Ink story integration with `inkjs`, semantic effect and social action tags, 2D physical and bedroom scenes in Phaser, environmental progression, and evaluation win/loss/checkpoint conditions.
2. **The Comprehensive Testing Strategy**: Vitest unit/integration matrices across all simulation domains, a 4-Tier Playwright End-to-End (E2E) testing architecture (covering >=5 tests per feature for Tiers 1 and 2, cross-feature combos for Tier 3, and full playthroughs for Tier 4), deterministic fast-forward time harnesses, and zero-mock verification criteria.

---

## 2. 14-Day Evaluation Build Narrative Architecture

### 2.1 Narrative Philosophy & Tone
- **Authored Deterministic Narrative**: Narrative progression is driven by authored Ink dialogue and deterministic state flags, never runtime generative LLMs.
- **Tone**: Intimate, slightly lonely, observant, warm as social connections deepen, grounded in mundane economic realities ($38 starting cash, rent, dial-up/DSL speeds, slow downloads), with occasional online uneasiness and rabbit holes.
- **Core Progression Axis**: Isolated $\rightarrow$ Connected; Broke $\rightarrow$ Stable; Temporary Room $\rightarrow$ Personal Space; Bare PC (Orion 4.8) $\rightarrow$ Upgraded Machine (Orion 6.x); Outsider $\rightarrow$ Person who recognizes people, patterns, and street life.
- **Physical-Digital Feedback Loop**: Physical life feeds digital life (work gossip, meeting someone offline, finding notes), and digital life leads back into physical life (classified pickups, café appointments, street observations matching forum posts).

---

### 2.2 Day-by-Day Story Arc Matrix (Day 1 through Day 14)

| Day | Phase | Theme & Primary Goal | Key Story Events & Pacing | Mystery / Rabbit Hole Development | Character Interactions | Physical Scene & Ambient State | Economy & PC Progression |
|---|---|---|---|---|---|---|---|
| **Day 1** | Opening | Wake, Routine, First Connection | Wake in motel room; first food-cart work shift; Ryan asks if player uses Pulse Messenger; player finds Pulse site, starts download, makes tea / looks out window while download runs in background; installs Pulse; first chat with Ryan. | Mentions of weird old forum posts and slow local DSL lines. | **Ryan**: In-person work banter $\rightarrow$ Pulse setup chat (`ryan_foodcart`). | Motel room (bare, tungsten lamp, single plastic cup); street view with quiet traffic. | Start with **$38.00**; shift awards **+$62.00**; PC: Orion 4.8, 512MB RAM, 40GB HDD, 256kbps DSL. |
| **Day 2** | Opening | The Digital Morning & Incompatibility | Wake to offline message; discover FlashFetch download manager and RetroAmp music player on DownloadHub; encounter Maya on Pulse; download PhotoBox 3.0 installer which fails compatibility check due to OS 4.8 and 512MB RAM. | PhotoBox requires Orion 6 and 768MB+ RAM; first clear motivation to upgrade hardware and OS. | **Ryan**: Work banter; **Maya**: First online introduction (`starlight_maya`), shares taste in music. | Morning sunlight through blinds; steam from hot tea; motel parking lot view. | Cash: ~$90.00; explore DownloadHub freeware; play fictional local tracks on RetroAmp. |
| **Day 3** | Opening | Software Literacy & The Toolbar Trap | Discover ZipMate (installer vs portable ZIP); encounter WeatherBuddy 1.4 on DownloadHub; recommended install bundles SearchMate Toolbar and hijacks browser home page; learn Add/Remove Programs and SafeSweep cleanup. | WeatherBuddy installer behavior illustrates mid-2000s adware/toolbars; subtle forum posts about SearchMate tracking. | **Ryan**: Teases player about toolbar if installed; **Maya**: Chat about rainy weather and favorite places. | Rainy weather overlay; rain droplets on window; dim interior room lighting. | Work shift (+$62); decide whether to run SafeSweep or manual Add/Remove uninstallation. |
| **Day 4** | Expansion | The Internet Becomes a World | FindIt search engine unlocked; CityWire local news site available; BidBay classifieds / auctions browsed; forum threads on NightBoard. | **Rabbit Hole A (Software)**: Forum complaint $\rightarrow$ recommendation $\rightarrow$ DownloadHub $\rightarrow$ tool unlock.<br>**Rabbit Hole B (Identity)**: Forum handle `NightOwl87` found in old 2004 archive. | **Nora (`NightOwl87`)**: First DM contact after player searches forum handle; **Maya**: Deeper evening chat about jobs. | Bus stop / street corner viewpoint unlocked; afternoon golden hour lighting. | Used RAM listing spotted on BidBay ($45); disk space pressure begins (downloads folder filling). |
| **Day 5** | Expansion | Multi-tasking & Social Deepening | Large media/game demo download started; player leaves PC to make noodles and observe street; Maya comes online during download; conversation proceeds while download bar progresses. | Search queries on FindIt reveal old news about motel neighborhood redevelopment; Nora hints at old local events. | **Maya**: Sharing personal photos/profile on MyPlace; **Ryan**: Mentions weekend plans and work schedule. | Evening ambient sounds (distant sirens, TV flicker in room); motel courtyard active. | Balance ~$150.00; food and small living deductions apply; terminal exploration (`dir`, `ping`). |
| **Day 6** | Expansion | Tangible Clues & Classifieds | BidBay auction ends; decision to buy used RAM ($45) or save cash for upcoming weekly motel rent; find old 2003 personal webpage on MyPlace. | Player links a username found on NightBoard to a physical street reference seen from the motel window. | **Maya**: Shares late-night thoughts on feeling stuck in the city; **Nora**: Shares obscure download link. | Late night view: streetlamp buzz, neon vacancy sign blinking, cool blue palette. | Manage cash carefully; evaluate RAM purchase vs rent buffer ($140 due Day 7). |
| **Day 7** | Pressure | The Rent Checkpoint (Week 1) | **Weekly Motel Rent Due ($140.00–$160.00)**. Player must pay landlord Mr. Henderson. Late payment path available with warning/fee if short on cash. | Landlord conversation reveals history of the motel; economic tension tests player budget. | **Motel Landlord**: Rent transaction dialogue; **Ryan**: Sympathizes with rent crunch. | Morning fog outside; room feels cramped; reminder note on desk. | If paid: cash drops to ~$20–$40; if delayed: $10 late fee warning, but game does not hard-fail. |
| **Day 8** | Transition | Hardware Acquisition & RAM Upgrade | Player earns shift pay; purchases RAM upgrade (512MB $\rightarrow$ 1GB) via BidBay or TechMart; physically installs RAM module; PC properties reflect 1024MB RAM. | TechMart vs BidBay trade-offs; classified seller interaction notes. | **Ryan**: Comments on hardware tinkering; **Maya**: Shares an exciting personal milestone. | Afternoon clear sky; desk shows opened PC case / screwdriver prop. | RAM upgraded to 1024MB; PC handles multi-window load without sluggishness; ready for OS 6. |
| **Day 9** | Transition | The OS 6 Revolution | Obtain `Orion OS 6.x` install disc/image; run OS 6 upgrade wizard; compatibility check passes; reboot sequence with new boot screen and Windows XP-inspired visual theme; PhotoBox 3.0 installs successfully! | New OS reveals newer software directory, CamLink webcam tool, and newer Pulse 6.x features (display pictures). | **Maya**: Exchanges display picture photos; reacts to player's new OS capabilities; **Nora**: Notes OS changes. | Night scene; vibrant desktop CRT glow illuminates the bedroom; softer, friendlier OS UI. | OS 6 installed; PhotoBox unlocked; image files render natively in photo viewer. |
| **Day 10** | Climax Prep | Social Life Crosses the Screen | Maya invites player to meet in person at the local **Café** on Saturday afternoon; player chooses response (Accept, Tentative, Reschedule); simulation schedules appointment. | The boundary between digital chat and physical reality dissolves; player anticipates meeting. | **Maya**: Vulnerable conversation leading to the café invite; **Ryan**: Advises player on what to wear/say. | Sunset orange/purple sky outside; player room feels warm and lived-in. | Work shift completed; internet monthly fee ($25.00) approaches; manage travel time. |
| **Day 11** | Climax | The Physical Meeting at the Café | **Physical Social Meeting**: Player travels to the Café at the scheduled time; 45–90 min time advancement; 2D layered café scene; intimate multi-branch dialogue reading hidden relationship state. | Meeting reveals Maya's real demeanor, quirks, and small vulnerabilities not fully visible online. | **Maya (In-Person)**: Multi-branch conversation covering past, aspirations, city life, and shared interests. | Café interior: ambient espresso machine hiss, clinking cups, warm amber lighting, street outside café window. | Time advances 75 minutes; café coffee purchase ($4.50); semantic social action tags written to engine. |
| **Day 12** | Consequence | Online Aftermath & Changed Dynamics | Player returns to PC; Maya logs onto Pulse later that evening; conversation tone is visibly altered (warmer, referencing café moments, changed status text); Ryan asks how it went. | Online tone changes dynamically based on café choices; Maya updates her MyPlace profile with subtle references. | **Maya**: Post-meeting chat reflecting on yesterday; **Ryan**: Curious coworker grilling. | Room desk now features a café napkin note / personal trinket; peaceful rain outside. | Financial stability returning (cash ~$80); PC running smoothly with customized wallpaper/icons. |
| **Day 13** | Mystery | Contained Strange Escalation | Unpredictable internet event: an old 2003 forum thread surfaces contradicting a known backstory, or a website goes 404, or GoldNet experiences an extreme market swing. | Ambiguity preserved: proves the internet is vast and not everything is a linear quest for the player. | **Nora (`NightOwl87`)**: Cryptic late-night exchange about digital archives disappearing; **Maya**: Casual evening comfort. | Late night (2:00 AM); flickering CRT monitor; quiet street with solitary pedestrian walking by. | Optional GoldNet transaction; final storage cleanup / file organization before week 2 close. |
| **Day 14** | Resolution | Evaluation Checkpoint & Free Play | Return from work shift; boot upgraded PC; Pulse chimes with multiple online friends; download completes; warm closing message; quiet observation of living street; **"Evaluation Build Complete"** screen. | Checkpoint evaluates player's journey across all 7 progression axes; export telemetry JSON. | **Maya**: Warm, meaningful closing message; **Ryan**: Evening check-in; **Nora**: Status update. | Bedroom feels distinctly personal (speakers, notes, customized setup); golden sunset out the window. | Week 2 rent ($140) handled; PC fully customized; transition seamlessly to post-Day 14 sandbox **Free Play**. |

---

### 2.3 Buddy Characters: Profiles, Schedules & Away Message Lore

```
+----------------------------------------------------------------------------------------------------+
|                                    BUDDY CHARACTER PROFILES                                        |
+---------------------+-------------------+-------------------+-------------------+------------------+
| Character           | Ryan              | Maya              | Nora (NightOwl87) | Mr. Henderson    |
+---------------------+-------------------+-------------------+-------------------+------------------+
| Screen Name(s)      | ryan_foodcart     | starlight_maya    | NightOwl87        | motel_office     |
|                     | Ryan_K            | maya_blue         | owl_archive       | henderson_props  |
| Role / Archetype    | Coworker & Bridge | Primary Emotional | Forum Archivist & | Motel Manager &  |
|                     |                   | Arc               | Digital Guide     | Physical Reality |
| Typing Style        | All lowercase,    | Proper casing,    | Cryptic, concise, | Terse, formal,   |
|                     | slang, "brb",     | emoticons ":)",   | late-night bursts,| uppercase notes, |
|                     | "yeah lol",       | thoughtful,       | links, old forum  | transactional    |
|                     | quick bursts      | multi-sentence    | syntax            |                  |
| Initial Relations   | Fam: 40, Tr: 50,  | Fam: 10, Tr: 20,  | Fam: 5, Tr: 15,   | Fam: 30, Tr: 30, |
|                     | Com: 50, Res: 40, | Com: 30, Res: 40, | Com: 20, Res: 50, | Com: 20, Res: 40,|
|                     | Annoy: 0          | Annoy: 0          | Annoy: 0          | Annoy: 10        |
+---------------------+-------------------+-------------------+-------------------+------------------+
```

#### Detailed Profile Matrix

1. **Ryan (`ryan_foodcart` / `Ryan_K`)**
   - **Role**: Coworker at the street food cart; practical friend; introduces player to Pulse Messenger and practical utilities (FlashFetch, ZipMate).
   - **Communication Style**: Casual, lowercase, abbreviations (`u`, `r`, `brb`, `tbh`), uses `yeah lol`, sends 2–3 rapid short messages rather than paragraphs, typing speed fast (80 wpm equivalent).
   - **14-Day Schedule**:
     - *Morning (07:00–08:30)*: Offline (commuting).
     - *Work Shift (09:00–16:00)*: Physical presence at food cart with player.
     - *Late Afternoon (16:30–18:00)*: Away (`status: "grabbing food brb"`).
     - *Evening (18:00–22:00)*: Online on Pulse (`status: "gaming / chilling"`).
     - *Night (22:00–07:00)*: Offline (sleep).
   - **Away Message Lore Progression**:
     - Days 1–3: `"afk grabbin tacos"` / `"dont msg unless ur dying"`
     - Days 4–7: `"listening to bad mp3s | brb"` / `"*~* away *~*"`
     - Days 8–11: `"trying to fix this piece of junk pc"` / `"work sucks"`
     - Days 12–14: `"ask me about my new speakers lol"` / `"sleep is for the weak"`

2. **Maya (`starlight_maya` / `maya_blue`)**
   - **Role**: Primary emotional connection; discovered online through mutual forum / MyPlace link; develops from stranger to close confidante and physical café meeting partner.
   - **Communication Style**: Warm, expressive, proper capitalization and punctuation, uses classic emoticons (`:)`, `:D`, `<3`, `-_-`), thoughtful multi-sentence paragraphs, pauses before deep answers (simulated typing delay 2–4s).
   - **14-Day Schedule**:
     - *Morning (08:00–09:00)*: Offline.
     - *Day / Work (09:00–17:00)*: Busy / Away (`status: "at the desk... dont look at me"`).
     - *Evening (17:30–21:00)*: Online on Pulse (`status: "home! making coffee :)"`).
     - *Night (21:00–00:30)*: Online / Late Chat (`status: "listening to the rain ~ myplace/mayablue"`).
     - *Late Night (00:30–08:00)*: Offline.
     - *Day 11 (Saturday 14:00–16:00)*: **Physical Meeting at Café** (offline on Pulse during meeting).
   - **Away Message Lore Progression**:
     - Days 1–3: `"just another rainy afternoon in the city ☕"`
     - Days 4–6: `"♫ 'The Postal Service - Such Great Heights' ♫ | reading"`
     - Days 7–9: `"tired of spreadsheets... take me somewhere else"`
     - Days 10–11: `"thinking about coffee on saturday :)"`
     - Days 12–14: `"yesterday was really nice. ♫ 'Death Cab - Transatlanticism' ♫"`

3. **Nora (`NightOwl87`)**
   - **Role**: Internet archivist, night owl, guide to fake internet rabbit holes and hidden forum threads on NightBoard.
   - **Communication Style**: Analytical, dry wit, lower-case sentences punctuated by precise links and timestamps, never uses emojis, responds quickly during late-night hours.
   - **14-Day Schedule**:
     - *Daytime (06:00–19:00)*: Offline.
     - *Evening (19:00–22:00)*: Away (`status: "indexing old logs"`).
     - *Night & Late Night (22:00–05:00)*: **Online** on NightBoard and Pulse (`status: "the night is quiet"`).
   - **Away Message Lore Progression**:
     - Days 1–4: `"archive_log_2004.txt | do not disturb"`
     - Days 5–9: `"if a link is dead, did the page ever exist?"`
     - Days 10–14: `"nightboard / thread 4092 is gone. interesting."`

4. **Mr. Henderson / Motel Desk (`motel_office`)**
   - **Role**: Motel property manager; represents physical economic obligations (weekly rent $140, maintenance).
   - **Communication Style**: Terse, formal, direct, transactional. Communicates via door knocks, physical notes under door, and brief webmail invoices.
   - **Schedule**: Physical presence at motel front office (08:00–20:00 daily); active rent check on Day 7 and Day 14.

---

### 2.4 Ink Story Integration & Architecture

```
+-----------------------------------------------------------------------------------+
|                           INK & SIMULATION ARCHITECTURE                           |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   +--------------------------+                +-------------------------------+   |
|   |    Narrative Engine      |                |      Simulation Engine        |   |
|   |    (inkjs runtime)       |                |     (Pure TypeScript)         |   |
|   |                          |                |                               |   |
|   |  - Authored .ink prose   |  Context Read  |  - Authoritative Clock        |   |
|   |  - Branching dialogues   |<---------------+  - Economy ($38, rent, bills) |   |
|   |  - Response choices      | (Read-Only)    |  - Hardware (RAM, CPU, HDD)   |   |
|   |  - Narrative knots       |                |  - Software & Install State   |   |
|   |  - Story variables       |                |  - Downloads & Files          |   |
|   |                          |  Semantic Tags |  - Character Schedules        |   |
|   |  # effect:...            +--------------->|  - Hidden Relationships       |   |
|   |  # social:...            | (Validated)    |    (Fam, Tr, Com, Res, Annoy) |   |
|   |  # beat:...              |                |  - Scheduled Appointments     |   |
|   +--------------------------+                +-------------------------------+   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Ink File Hierarchy
```text
narrative/
├── main.ink                  # Root story manifest, variable declarations, external binders
├── characters/
│   ├── ryan.ink              # Ryan dialogue trees (opening, work banter, software recs, café wrap-up)
│   ├── maya.ink              # Maya dialogue trees (intro, personal sharing, late-night chat, post-café)
│   └── nora.ink              # Nora dialogue trees (forum inquiries, rabbit holes, mystery clues)
├── arcs/
│   ├── opening.ink           # Days 1–3 opening beats and initial Pulse installation chat
│   ├── software.ink          # Software discovery beats (FlashFetch, PhotoBox failure, WeatherBuddy)
│   ├── meeting.ink           # Day 10 café invitation and Day 11 café physical scene
│   ├── strange_thread.ink    # Day 13 contained mystery rabbit hole and disappearing post
│   └── ending.ink            # Day 14 evaluation conclusion checkpoint and reflections
└── ambient/
    ├── work.ink              # Food cart workday vignettes and Ryan banter
    └── window.ink            # Contextual thought prose for window observations
```

#### State Synchronization & Read-Only Injected Variables
Authoritative simulation state is injected into Ink before story evaluation:
```ink
// Injected read-only context variables (updated by NarrativeAdapter)
VAR sim_current_day = 1
VAR sim_time_of_day = "evening"        // "morning" | "day" | "evening" | "night" | "late_night"
VAR sim_player_cash = 38
VAR sim_rent_paid = true
VAR sim_os_version = 4.8              // 4.8 | 6.0
VAR sim_installed_ram_mb = 512        // 512 | 1024
VAR sim_photobox_installed = false
VAR sim_pulse_installed = true
VAR sim_toolbar_infected = false
VAR sim_maya_familiarity = 10
VAR sim_maya_trust = 20
VAR sim_maya_comfort = 30
VAR sim_met_at_cafe = false
```

#### Semantic Narrative Tags Specification
Ink outputs lines and semantic tags. The `NarrativeAdapter` parses and validates them against Zod schemas:
1. `# beat:<beat_id>` — Marks narrative milestone completion (e.g. `# beat:maya_first_chat`, `# beat:cafe_meeting_complete`).
2. `# effect:appointment_offer:<target>:<location>:<day>:<start_minute>:<end_minute>` — Creates a pending appointment record in the simulation engine.
3. `# effect:set_flag:<flag_name>:<boolean_or_string>` — Sets a world/narrative flag in simulation.
4. `# effect:unlock_site:<site_id>` — Unlocks a hidden or discovered website in Voyager Browser.
5. `# effect:add_contact:<contact_id>` — Adds a new handle to Pulse Messenger.
6. `# effect:create_file:<filename>:<size_bytes>:<folder>` — Injects a file into the simulated filesystem (e.g. an emailed photo).
7. `# social:<target>:<action>` — Triggers hidden relationship dimension updates in simulation.

#### Social Action Translation Table
| Social Action Tag | Familiarity | Trust | Comfort | Respect | Annoyance |
|---|---|---|---|---|---|
| `# social:maya:empathy` | +3 | +4 | +5 | +2 | -2 |
| `# social:maya:remembered_detail`| +5 | +6 | +6 | +4 | -1 |
| `# social:maya:tease_playful` | +4 | +2 | +3 | +2 | 0 |
| `# social:maya:dismissive` | -1 | -5 | -6 | -3 | +8 |
| `# social:maya:vulnerable_share` | +6 | +7 | +8 | +3 | -2 |
| `# social:ryan:work_camaraderie` | +4 | +3 | +4 | +3 | 0 |
| `# social:ryan:sarcastic_joke` | +3 | +2 | +2 | +2 | +1 |
| `# social:nora:intellectual_curiosity`| +4 | +5 | +2 | +6 | 0 |

---

### 2.5 Physical & Bedroom Scenes (Phaser 2D Architecture)

```
+-----------------------------------------------------------------------------------+
|                        PHASER 2D LAYERED SCENE ARCHITECTURE                       |
+-----------------------------------------------------------------------------------+
|  Layer 8: Lighting & Color Overlay (Tungsten Morning, Blue Night, Rain Desat)     |
|  Layer 7: Foreground & Screen Frame (CRT Glass Reflection, Window Frame)          |
|  Layer 6: Interactive Props (PC CRT Monitor, Kettle, Bed, Sticky Notes, Radio)    |
|  Layer 5: Character Staging / Sprites (Player silhouette, Café seating)           |
|  Layer 4: Animated Ambient FX (Steam particles, Window rain streaks, Neon blink) |
|  Layer 3: Midground (Desk surface, Furniture, Motel Courtyard walkway)            |
|  Layer 2: Background (Room wallpaper, Outside street buildings, Sky)             |
|  Layer 1: Base Sky / Weather Gradient (Time-of-day dynamic backdrop)              |
+-----------------------------------------------------------------------------------+
```

#### Physical Locations in Evaluation Build
1. **Motel Bedroom (Anchor Location)**:
   - *PC Desk*: Interactable CRT monitor (switches to OS Desktop view), beige PC tower, mouse, keyboard, speakers (unlockable visual prop), modem lights.
   - *Bed*: Sleep interactable (jumps time to target wake time, triggers autosave, restores energy).
   - *Kettle / Kitchenette*: Drink/food actions (Make Tea: 6 min; Make Coffee: 5 min; Cook Noodles: 15 min; restores light energy).
   - *Window*: Observational view hotspot (4 min time advancement, displays contextual narrative thoughts).
   - *Door*: Travel hotspot (Work shift, Bus stop, Café, Convenience store).
   - *Desk Progression Across 14 Days*:
     - *Days 1–3*: Bare desk, single motel plastic cup, dim 40W bulb.
     - *Days 4–7*: Sticky notes on monitor bezel, empty noodle cup, printed classifieds snippet.
     - *Days 8–10*: Screwdriver and RAM packaging, new stereo desktop speakers prop.
     - *Days 11–14*: Café napkin with handwritten doodle, customized desktop CRT glow.

2. **Window View & Street Simulation**:
   - *Interaction*: Opens wide 2D panning window view; advances clock by 4 minutes; selects prioritized thought from `observations.json` based on current day, time band, weather, and observation count.
   - *Persistent Street Entities*:
     - *Man in Tan Jacket*: Seen standing near payphone on Days 1, 3, 5, 8, 12; missing on Day 9.
     - *Motel Cleaner (Mrs. Gable)*: Active on walkway between 10:00–11:30.
     - *Green Sedan*: Parked in spot #4 Days 1–6; replaced by blue pickup Day 7.
   - *Ambient Entities*: Procedural passing cars, stray cat, distant pedestrians, delivery van.

3. **The Café (Social Climax Location)**:
   - *Visuals*: Warm 2D café interior with counter, espresso machine, wooden table for two, soft amber lighting, window overlooking rain-slicked boulevard.
   - *Time Advancement*: 75 minutes continuous simulation jump.
   - *Audio*: Gentle background coffee shop murmur, soft jazz cassette track, rain on window.

4. **Lighting & Audio Progression Matrix**:
   - *Time-of-Day Bands*:
     - `morning` (06:00–09:00): Warm pale yellow sunlight angle, bird chirps, gentle traffic.
     - `day` (09:00–17:00): Neutral bright daylight, active street audio.
     - `evening` (17:00–21:00): Deep orange/purple sunset, interior tungsten lamp glow, heavy traffic.
     - `night` (21:00–01:00): Cool deep blue palette, neon vacancy sign reflection, distant sirens.
     - `late_night` (01:00–06:00): Dark indigo, CRT monitor phosphor glow cast onto desk and walls, ambient room hum.
   - *Audio Cues*: Authentic dial-up 28.8k/56k modem handshake, HDD seek chug, Pulse incoming message chime (`"uh-oh!"` / pleasant ding), Pulse typing clicker, tea kettle steam whistle, heavy rain on tin motel roof.

---

### 2.6 Endings & Evaluation Win/Loss Conditions

- **Evaluation Build Completion Criteria (Day 14)**:
  1. Complete the Day 14 evening work shift.
  2. Boot the upgraded PC into Orion OS 6 (or clean OS 4.8).
  3. Receive and complete the Day 14 culminating Pulse exchange with Maya/Ryan.
  4. Trigger the quiet closing reflection sequence in the bedroom.
  5. Display the **"Evaluation Build Complete"** modal with session telemetry summary.
  6. Transition cleanly into unbounded post-Day 14 **Free Play** mode.
- **No Hard Game Over / Permadeath**:
  - If rent is unpaid on Day 7, the player incurs a $10 late fee and receives an awkward warning from Mr. Henderson, but the save remains fully playable.
  - If the player misses the café meeting with Maya, the relationship shifts to a distant branch with distinct follow-up dialogue rather than aborting the game.
- **Evaluation Ending Branches**:
  - *Branch A (Deep Connection)*: High Maya Trust & Comfort ($\ge 60$), café meeting attended $\rightarrow$ Warm, intimate Day 14 late-night dialogue, shared photos, future plans.
  - *Branch B (Independent Tech Explorer)*: OS 6 upgraded early, 10+ programs installed, Nora rabbit holes solved $\rightarrow$ Rich digital ecosystem, deep forum standing, self-reliant reflection.
  - *Branch C (Mundane Survival)*: Minimal upgrades, scraping by on food cart shifts, missed café $\rightarrow$ Melancholic, grounded reflection on perseverance and motel life.

---

## 3. Comprehensive Testing Strategy & Verification Architecture

### 3.1 Testing Philosophy & Zero-Mock Verification Standards
- **Simulation-First Determinism**: The pure TypeScript `SimulationEngine` owns all state and business rules. Unit tests verify simulation logic in complete isolation from UI frameworks.
- **Zero-Mock Requirement**:
  - E2E Playwright tests run against real Vite/React/Phaser/Ink builds interacting with real Dexie IndexedDB instances in headless browser contexts.
  - No faking of downloads, clock ticks, filesystem records, installer wizards, or relationship values in end-to-end tests.
- **Deterministic Time Acceleration**: Automated testing leverages deterministic clock stepping (`advanceGameMinutes()`) to execute multi-day scenarios in seconds without relying on wall-clock delays.

---

### 3.2 Vitest Unit & Integration Test Matrices

```
+---------------------------------------------------------------------------------------------------+
|                                  VITEST TEST SUITE ARCHITECTURE                                   |
+----------------------+--------------------+-------------------------------------------------------+
| Module               | Test Type          | Target Verification Areas                             |
+----------------------+--------------------+-------------------------------------------------------+
| `GameClock`          | Unit               | Real-to-game time conversion, time jumps, midnight    |
| `DownloadManager`    | Unit & Integration | Bandwidth throttling, pause/resume, file creation     |
| `SoftwareSystem`     | Unit & Integration | OS/RAM requirements gating, disk space, installers    |
| `EconomySystem`      | Unit               | Shift earnings, motel rent, late fees, purchases      |
| `RelationshipSystem` | Unit               | 5 hidden dimensions, semantic social actions, bounds  |
| `ScheduleSystem`     | Unit               | Online/away/offline transitions, time-jump sync       |
| `Persistence/Dexie`  | Integration        | Lossless serialize/deserialize, version migrations    |
| `ContentValidator`   | Integration        | Zod schema parsing, Ink compilation, ID integrity     |
+----------------------+--------------------+-------------------------------------------------------+
```

#### Detailed Vitest Test Specifications

| Suite ID | Target Module | Test Case Name | Input Conditions | Expected Authoritative Output |
|---|---|---|---|---|
| **V-CLK-01** | `GameClock` | Real-time tick conversion | 1 real second elapsed at 1:1 scale | Clock advances exactly 1 game minute; ISO timestamp advances 60s. |
| **V-CLK-02** | `GameClock` | Explicit time jump | `advanceGameMinutes(75)` (Café) | Clock advances from 14:00 to 15:15; all registered subsystems tick 75 min. |
| **V-CLK-03** | `GameClock` | Midnight rollover | Clock at Day 1, 23:55; `advanceGameMinutes(10)` | Clock transitions to Day 2, 00:05; day counter increments to 2. |
| **V-DL-01** | `DownloadManager` | Bandwidth throttling | 256 kbps connection, 5 MB file | Download rate capped at 32 KB/s; takes ~160 game minutes to complete. |
| **V-DL-02** | `DownloadManager` | Background continuity | Start download, simulate 30 min away from PC | `downloadedBytes` advances by $30 \times 60 \times \text{speed}$; progress updates correctly. |
| **V-DL-03** | `DownloadManager` | Completion creates file | Download completes 100% | File record created in `C:\Downloads\` with exact `sizeBytes` and MIME type. |
| **V-DL-04** | `DownloadManager` | Pause and resume | Pause at 40%, advance 20 min, resume | 0 bytes added while paused; resumes from 40% upon restart. |
| **V-SW-01** | `SoftwareSystem` | Requirements gating (fail) | Attempt PhotoBox on OS 4.8, 512MB RAM | Installer rejects launch: `Incompatible OS (requires 6.0+) and RAM (<768MB)`. |
| **V-SW-02** | `SoftwareSystem` | Requirements gating (pass) | Attempt PhotoBox on OS 6.0, 1024MB RAM | Installer passes compatibility check; proceeds to installation wizard. |
| **V-SW-03** | `SoftwareSystem` | Disk space allocation | Install 150MB application on 7GB free disk | Free disk decreases by 150MB; app registers in `Add/Remove Programs`. |
| **V-SW-04** | `SoftwareSystem` | Adware / Toolbar infection | Install WeatherBuddy with defaults | Browser homepage set to SearchMate; startup registry entry created. |
| **V-SW-05** | `SoftwareSystem` | SafeSweep remediation | Run SafeSweep scan & clean | SearchMate toolbar removed; browser homepage restored to FindIt. |
| **V-SW-06** | `SoftwareSystem` | Portable app extraction | Extract ZipMate portable ZIP | Executable runs from folder; NOT registered in `Add/Remove Programs`. |
| **V-ECO-01** | `EconomySystem` | Work shift payout | Complete primary food cart shift | Cash balance increases by +$62.00; energy decreases by -35. |
| **V-ECO-02** | `EconomySystem` | Rent deduction (on-time) | Balance $160; Day 7 rent due ($140) | Cash decreases to $20.00; `rent_paid_week_1` set to `true`. |
| **V-ECO-03** | `EconomySystem` | Rent late penalty | Balance $50; Day 7 rent due | Insufficient funds; status set to `overdue`; $10 penalty applied. |
| **V-REL-01** | `RelationshipSystem` | Semantic social action | `# social:maya:empathy` | Familiarity +3, Trust +4, Comfort +5, Respect +2, Annoyance -2. |
| **V-REL-02** | `RelationshipSystem` | Clamping boundaries | Apply +50 Trust when Trust is 80 | Trust clamps cleanly at 100 without overflow; no NaN errors. |
| **V-SCH-01** | `ScheduleSystem` | Schedule state transitions | Ryan at 17:59 (away) $\rightarrow$ 18:00 (online) | Status changes to `online`; triggers typing indicator if conversation pending. |
| **V-PERS-01**| `Persistence` | Full save round-trip | Save state with active download & OS 6 | Deserialized state matches original JSON identically; Dexie tables restored. |
| **V-CNT-01** | `ContentValidation` | Zod schema integrity | Parse all software, sites, characters JSON | 100% schemas valid; zero missing foreign keys or duplicate IDs. |
| **V-INK-01** | `NarrativeEngine` | Ink compilation & tags | Compile all `narrative/*.ink` stories | Compilation successful; all referenced knots exist; tags parse validly. |

---

### 3.3 Playwright E2E 4-Tier Test Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                 PLAYWRIGHT 4-TIER E2E ARCHITECTURE                                |
+---------------------------------------------------------------------------------------------------+
|  TIER 1: Feature Coverage (>= 5 tests per feature domain: PC, Files, Browser, Chat, Room, Eco)   |
+---------------------------------------------------------------------------------------------------+
|  TIER 2: Boundary & Corner Cases (>= 5 tests per domain: Disk limits, Time jumps, Chat spam)      |
+---------------------------------------------------------------------------------------------------+
|  TIER 3: Cross-Feature Combinations (Download + Room + Chat, WeatherBuddy + SafeSweep, OS 6)     |
+---------------------------------------------------------------------------------------------------+
|  TIER 4: Real-World Scenarios (Canonical 14-Day Playthrough, Frugal Path, Tech Speedrun)          |
+---------------------------------------------------------------------------------------------------+
```

#### Tier 1: Feature Coverage Specifications ($\ge 5$ Tests per Domain)

##### Domain 1: PC Desktop & Window Management
- `E2E-T1-PC-01`: Open, move, minimize, and restore windows from taskbar.
- `E2E-T1-PC-02`: Z-index stacking: clicking a background window brings it to the top.
- `E2E-T1-PC-03`: System tray clock renders and updates in real-time matching game clock.
- `E2E-T1-PC-04`: Start Menu opens, lists system utilities, and launches Notepad / Terminal.
- `E2E-T1-PC-05`: Desktop shortcut double-click launches corresponding application window.

##### Domain 2: File System & Add/Remove Programs
- `E2E-T1-FS-01`: File Manager navigates folder hierarchy (`C:\Downloads`, `C:\Program Files`).
- `E2E-T1-FS-02`: Deleting downloaded installer frees up corresponding disk space.
- `E2E-T1-FS-03`: Add/Remove Programs lists all installed apps with accurate sizes.
- `E2E-T1-FS-04`: Uninstall button in Add/Remove cleanly removes app and desktop icon.
- `E2E-T1-FS-05`: Portable ZIP extraction creates runnable app without Add/Remove entry.

##### Domain 3: Fake Browser & Navigation
- `E2E-T1-BR-01`: URL bar navigation to `findit.local`, `downloadhub.local`, `bidbay.local`.
- `E2E-T1-BR-02`: Browser Back and Forward history buttons navigate cached route stack.
- `E2E-T1-BR-03`: Bookmarks bar loads bookmarked pages on single click.
- `E2E-T1-BR-04`: FindIt search bar returns curated results for queries (e.g. `"messenger"`, `"ram"`).
- `E2E-T1-BR-05`: Clicking download link on DownloadHub initiates authoritative download task.

##### Domain 4: Pulse Messenger & Social Simulation
- `E2E-T1-MS-01`: Contact list accurately renders online, away, and offline statuses.
- `E2E-T1-MS-02`: Incoming message triggers audio chime, taskbar flash, and unread badge.
- `E2E-T1-MS-03`: Selecting dialogue choice displays player typing animation then sends message.
- `E2E-T1-MS-04`: Contact typing indicator (`"Maya is typing..."`) displays before response arrives.
- `E2E-T1-MS-05`: Hovering/clicking contact displays authentic away message text.

##### Domain 5: Physical Room & Time Jumps
- `E2E-T1-RM-01`: View switching between PC Desktop and Motel Room retains identical simulation time.
- `E2E-T1-RM-02`: Making tea advances simulation clock by exactly 6 minutes.
- `E2E-T1-RM-03`: Window view hotspot opens street panorama and displays contextual thought text.
- `E2E-T1-RM-04`: Bed sleep interaction advances time to next morning and restores player energy.
- `E2E-T1-RM-05`: Time-of-day lighting overlay updates dynamically (Morning $\rightarrow$ Evening $\rightarrow$ Night).

##### Domain 6: Economy & Jobs
- `E2E-T1-EC-01`: Food cart work shift consumes 7 hours, awards +$62 cash, depletes energy.
- `E2E-T1-EC-02`: Paying weekly motel rent on Day 7 deducts $140 and updates landlord state.
- `E2E-T1-EC-03`: Purchasing 512MB RAM from TechMart deducts $50 and adds hardware item.
- `E2E-T1-EC-04`: Buying used RAM from BidBay classifieds completes transaction.
- `E2E-T1-EC-05`: Depositing $10 into GoldNet converts cash to digital gold balance.

---

#### Tier 2: Boundary & Corner Case Specifications ($\ge 5$ Tests per Domain)

##### Domain 1: PC & OS Boundaries
- `E2E-T2-PC-01`: Installing app when disk space is within 5MB of full triggers low-disk warning.
- `E2E-T2-PC-02`: Launching 8 windows simultaneously tests RAM pressure degradation.
- `E2E-T2-PC-03`: Rapid window open/close spam does not orphan DOM nodes or crash store.
- `E2E-T2-PC-04`: Terminal executes invalid command string and outputs authentic error message.
- `E2E-T2-PC-05`: OS 6 installer validates RAM requirement strictly ($\ge 768\text{MB}$).

##### Domain 2: Download & Network Boundaries
- `E2E-T2-DL-01`: Starting download and immediately sleeping overnight completes download by morning.
- `E2E-T2-DL-02`: Concurrent downloads split available bandwidth proportionally.
- `E2E-T2-DL-03`: Network download with 0 bytes remaining completes without infinite loop.
- `E2E-T2-DL-04`: Downloading while switching rapidly between Room and PC views preserves byte progress.
- `E2E-T2-DL-05`: Pausing download, closing browser, advancing 2 days, and resuming works seamlessly.

##### Domain 3: Browser & Fake Internet Boundaries
- `E2E-T2-BR-01`: Typing invalid/non-existent URL (e.g. `fakewebsite.local`) renders custom 404 page.
- `E2E-T2-BR-02`: Search query with special characters (`#$%^&*`) handles input safely without regex crash.
- `E2E-T2-BR-03`: Empty search submission shows helpful default index page.
- `E2E-T2-BR-04`: Clicking dead link on old forum archive displays period-authentic connection error.
- `E2E-T2-BR-05`: Deep browser history navigation (20+ pages back/forward) preserves state.

##### Domain 4: Messenger & Social Boundaries
- `E2E-T2-MS-01`: Contact goes offline mid-dialogue due to scheduled bedtime; handles gracefully.
- `E2E-T2-MS-02`: Rapidly clicking dialogue choices registers only one choice per branch.
- `E2E-T2-MS-03`: Receiving message while Messenger is closed queues unread message indicator.
- `E2E-T2-MS-04`: Relationship score clamped at upper (100) and lower (0) bounds under extreme choices.
- `E2E-T2-MS-05`: Reloading browser tab during active Ink dialogue restores dialogue state accurately.

##### Domain 5: Physical & Clock Boundaries
- `E2E-T2-RM-01`: Time jump crossing midnight (23:55 to 00:30) advances day counter and schedules.
- `E2E-T2-RM-02`: Window observation count exhaustion switches to default ambient observations.
- `E2E-T2-RM-03`: Player energy at 0 prevents optional overtime shift and shows exhaustion text.
- `E2E-T2-RM-04`: Rapid time jump sequence (tea $\rightarrow$ shower $\rightarrow$ tea) ticks all systems sequentially.
- `E2E-T2-RM-05`: Sleeping for 12 hours cleanly executes multi-step scheduled events in order.

##### Domain 6: Economy & Transaction Boundaries
- `E2E-T2-EC-01`: Attempting purchase with insufficient cash shows clear transaction declined feedback.
- `E2E-T2-EC-02`: Paying rent with exact cash balance ($140.00 left) reduces cash to exactly $0.00.
- `E2E-T2-EC-03`: Overdue rent fee compounding after 3 days late warning.
- `E2E-T2-EC-04`: GoldNet market rate extreme fluctuation event updates balance value accurately.
- `E2E-T2-EC-05`: Multiple rapid purchases do not cause race conditions in financial ledger.

---

#### Tier 3: Cross-Feature Combination Scenarios
- `E2E-T3-SCENARIO-A (The Core Fantasy Loop)`: Start game $\rightarrow$ Food cart work shift $\rightarrow$ Discover Pulse on DownloadHub $\rightarrow$ Start download $\rightarrow$ Switch to room view $\rightarrow$ Make tea $\rightarrow$ Observe street from window $\rightarrow$ Return to PC $\rightarrow$ Verify download completed in background $\rightarrow$ Install Pulse $\rightarrow$ Chat with Ryan.
- `E2E-T3-SCENARIO-B (Adware & Cleanup)`: Download WeatherBuddy $\rightarrow$ Select default install with bundled SearchMate Toolbar $\rightarrow$ Verify browser homepage hijacked $\rightarrow$ Download SafeSweep anti-spyware $\rightarrow$ Run SafeSweep cleanup scan $\rightarrow$ Verify toolbar uninstalled and homepage restored.
- `E2E-T3-SCENARIO-C (Hardware & OS Evolution)`: Attempt PhotoBox install on OS 4.8 (fails compatibility) $\rightarrow$ Purchase RAM upgrade from BidBay $\rightarrow$ Download and install Orion OS 6 $\rightarrow$ Complete reboot sequence $\rightarrow$ Verify new XP-style OS shell $\rightarrow$ Install PhotoBox 3.0 successfully $\rightarrow$ Open image files.
- `E2E-T3-SCENARIO-D (Social Bridge & Physical Meeting)`: Deepen online friendship with Maya on Pulse $\rightarrow$ Receive café appointment offer $\rightarrow$ Accept appointment $\rightarrow$ Advance time to Saturday 14:00 $\rightarrow$ Travel to Café scene $\rightarrow$ Complete in-person Ink dialogue $\rightarrow$ Return home $\rightarrow$ Receive follow-up Pulse message reflecting café discussion.
- `E2E-T3-SCENARIO-E (Full Persistence Fidelity)`: In mid-download with unread Pulse messages, upgraded RAM, Day 8 clock, and active window layout $\rightarrow$ Trigger browser page reload $\rightarrow$ Verify all simulation state, filesystem, and UI positions restore losslessly from IndexedDB.

---

#### Tier 4: Real-World Long-Session & Full 14-Day Playthroughs
- `E2E-T4-FULL-01 (Canonical Golden Path)`: Automated test runner executes complete Day 1 through Day 14 sequence, completing all work shifts, paying rent on Day 7 and Day 14, upgrading to OS 6, attending café meeting, and reaching the Day 14 Evaluation Complete screen.
- `E2E-T4-FULL-02 (Frugal / Late Rent Path)`: Executes 14-day run with delayed hardware upgrades, absorbs Day 7 late rent penalty, attends alternative low-cost hangout, and completes evaluation checkpoint.
- `E2E-T4-FULL-03 (Power User / Tech Speedrun)`: Prioritizes secondary income, buys RAM and OS 6 by Day 8, solves all Nora forum rabbit holes, and completes evaluation build.

---

### 3.4 Deterministic Time Simulation Test Runner & Fast-Forward Harness

The automated testing framework includes a pure TypeScript deterministic time harness:
```ts
export class SimulationTestHarness {
  private engine: SimulationEngine;

  constructor(initialState?: Partial<GameState>) {
    this.engine = new SimulationEngine(initialState);
  }

  public advanceMinutes(minutes: number): void {
    this.engine.advanceGameMinutes(minutes);
  }

  public advanceToTime(day: number, hour: number, minute: number): void {
    const current = this.engine.getState().clock;
    const targetMinutes = (day - 1) * 1440 + hour * 60 + minute;
    const currentMinutes = (current.day - 1) * 1440 + current.hour * 60 + current.minute;
    if (targetMinutes > currentMinutes) {
      this.engine.advanceGameMinutes(targetMinutes - currentMinutes);
    }
  }

  public getState(): GameState {
    return this.engine.getState();
  }
}
```

---

### 3.5 Content Validation Suite & Automated Zod Schema Verification
The project provides a dedicated validation script (`npm run validate:content`) that executes before build and test suites:
- Validates all JSON files in `src/content/` against strict Zod schemas.
- Compiles all `narrative/*.ink` files using `inkjs-compiler` and validates knot reachability.
- Ensures all cross-references (software IDs, site IDs, contact handles, file references) resolve without orphans.

---

### 3.6 Local Evaluation Telemetry Exporter
A local-only evaluation telemetry collector records gameplay statistics in IndexedDB:
- `totalRealPlayTimeSeconds`, `gameDaysCompleted`, `pcVsRoomTimeRatio`.
- `programsInstalledCount`, `downloadsCompletedCount`, `windowObservationsCount`.
- `totalEarnedCash`, `totalSpentCash`, `rentPaidStatus`, `osUpgradeDay`.
- `mayaTrustFinal`, `cafeMeetingAttended`, `evaluationEndingReached`.
- UI provides a **"Export Telemetry JSON"** button on the Day 14 Completion modal for evaluation review.

---

## 4. Features Discovered & Interface Specifications Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Simulation | Authoritative Clock | Drives game time across all views and subsystems | Real time delta or `advanceGameMinutes(n)` | Updated `GameClockState` (day, hour, min, band) | Clamps negative steps; logs warning on out-of-order jumps | `05-TECHNICAL-ARCHITECTURE.md` |
| 2 | Simulation | Time Jump System | Advances simulation during activities (tea, sleep, work, café) | Action duration (min) | Simultaneous tick across downloads, schedules, economy | Prohibits time jump during modal dialogues | `01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` |
| 3 | Simulation | Download Manager | Authoritative simulated download task engine | `startDownload(fileId, sourceId)` | `DownloadTask` with byte progress, speed throttling | Fails cleanly on disk full or connection loss | `03-COMPUTER-OS-AND-SOFTWARE.md` |
| 4 | Simulation | Software Lifecycle | Hardware requirements gating, disk allocation, install/uninstall | Software ID, installer choices | Installed app record, file entries, Add/Remove entry | Rejects installation if OS < minOs or RAM < minRam | `03-COMPUTER-OS-AND-SOFTWARE.md` |
| 5 | Simulation | Hidden Relationships | 5-dimension relationship tracking (Fam, Tr, Com, Res, Annoy) | Semantic social action tags | Updated clamped dimension values (0..100) | No numeric display in UI; logs invalid action tags | `04-INTERNET-SOCIAL-AND-NARRATIVE.md` |
| 6 | Simulation | Schedule Engine | Weekly deterministic character availability blocks | Time tick, schedule definitions | Contact status (`online`, `away`, `offline`, `busy`) | Fallback to `offline` on unmapped time blocks | `06-CONTENT-DATA-AND-INK.md` |
| 7 | Simulation | Economy Engine | Manages cash, food cart wages, motel rent, bills, purchases | Work shifts, payments, purchases | Updated cash balance, ledger transaction records | Blocks purchases with insufficient funds | `01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md` |
| 8 | Computer | Window Manager | Desktop window system with focus, z-index, drag, minimize | Window open/close/focus events | Rendered React window layer | Prevents dragging outside viewport bounds | `03-COMPUTER-OS-AND-SOFTWARE.md` |
| 9 | Computer | Dual OS Generations | `Orion OS 4.8` (Win 98/2000 style) and `Orion OS 6.x` (XP style) | OS upgrade installer, RAM $\ge 768\text{MB}$ | Updated desktop theme, CSS tokens, unlocked apps | Blocks OS 6 install if RAM < 768MB | `03-COMPUTER-OS-AND-SOFTWARE.md` |
| 10 | Computer | Fake Browser | Local URL routing to 15+ internal websites | URL string, search query, link click | Rendered website page component | Displays custom 404 page on unmapped routes | `04-INTERNET-SOCIAL-AND-NARRATIVE.md` |
| 11 | Computer | Pulse Messenger | Instant messenger with contacts, chats, typing indicators, away msgs | Contact select, dialogue choice | Chat log entries, simulated typing delays, chimes | Queues unread messages if chat window closed | `04-INTERNET-SOCIAL-AND-NARRATIVE.md` |
| 12 | Narrative | Ink Engine Bridge | `inkjs` runtime evaluating compiled Ink JSON with semantic tags | Player choice index, context variables | Rendered prose, choices, semantic simulation effects | Throws error if tag fails Zod validation | `06-CONTENT-DATA-AND-INK.md` |
| 13 | Narrative | Semantic Social Tags | Translates dialogue choices to relationship shifts | `# social:<target>:<action>` | Dispatches action to simulation `RelationshipSystem` | Ignores malformed tags; logs warning | `06-CONTENT-DATA-AND-INK.md` |
| 14 | Physical | Layered Room View | 2D Phaser motel bedroom scene with time variants & props | Location ID, time band, weather, prop flags | Rendered Phaser canvas with parallax & lighting | Fallback to default lighting if variant missing | `02-WORLD-ART-AND-PRESENTATION.md` |
| 15 | Physical | Window Observations | Dedicated window panorama with contextual thought bubbles | Window hotspot click | Contextual thought string, 4 min time jump | Reverts to generic thoughts when pool exhausted | `02-WORLD-ART-AND-PRESENTATION.md` |
| 16 | Physical | Café Meeting | Physical social staging location for Day 11 climax | Travel intent at scheduled time | 2D café scene, 75 min time jump, Ink dialogue | Triggers missed appointment if player is late | `02-WORLD-ART-AND-PRESENTATION.md` |
| 17 | Persistence | Dexie Save System | Versioned serialization of complete simulation state | Autosave trigger, manual save | IndexedDB records (`save_state`, `messages`, `telemetry`)| Migration handler upgrades older schemas | `05-TECHNICAL-ARCHITECTURE.md` |
| 18 | Telemetry | Evaluation Telemetry | Local tracking of gameplay milestones and stats for evaluation | Milestone and state change events | JSON export payload with playtime & progression | Retained purely locally in IndexedDB | `07-IMPLEMENTATION-AND-ACCEPTANCE.md` |

---

## 5. Edge Cases & Boundary Behaviors Table

| # | Feature | Input / Condition | Observed & Specified Behavior |
|---|---|---|---|
| 1 | Clock | Sleep action when active download is running | Download advances proportionally across the entire sleep duration; completes and creates file if time exceeds requirement. |
| 2 | Clock | In-game time jump across midnight (23:55 to 00:30) | Clock rolls over smoothly; day counter increments from $N$ to $N+1$; daily rent/bill checks evaluate correctly. |
| 3 | Software | Installing application with exactly 0 MB free disk remaining | Installer errors gracefully with "Disk Full" dialog; does not corrupt existing filesystem records. |
| 4 | Software | Running uninstaller for portable application extracted from ZIP | Portable apps do not appear in Add/Remove Programs; files can be deleted manually from File Manager to free space. |
| 5 | Software | WeatherBuddy installer with custom install option checked | Unchecking bundled SearchMate toolbar avoids homepage hijack and startup registry changes cleanly. |
| 6 | Software | Attempting to run PhotoBox on Orion 4.8 after upgrading RAM to 1GB | PhotoBox fails OS check (`Requires Orion OS 6.0+`); shows specific OS incompatibility error dialog. |
| 7 | Messenger | Contact scheduled to go offline while active chat dialogue is open | Contact sends a closing excuse (`"gotta sleep brb"`), sets status to `offline`, and disables further choice inputs until next online window. |
| 8 | Messenger | Player ignores incoming message and switches to physical room view | Pulse icon in taskbar flashes; audio chime plays; unread badge counter increments; message persists in chat history upon return. |
| 9 | Messenger | Relationship dimension value exceeds 100 or drops below 0 | `RelationshipSystem` clamps value strictly between `0` and `100`; prevents NaN or negative bounds bugs. |
| 10 | Browser | Navigating to unmapped URL (e.g. `google.com` or `xyz.local`) | Voyager Browser displays custom fictional "Cannot Find Server" error page; no real host network calls are made. |
| 11 | Browser | Submitting empty search query or special characters into FindIt | Search engine renders curated default directory page without crashing or regex errors. |
| 12 | Economy | Attempting to purchase hardware when cash balance is insufficient | Store interface displays "Insufficient Funds" modal; transaction is blocked; ledger remains unchanged. |
| 13 | Economy | Player has insufficient cash to pay Day 7 motel rent ($140) | Landlord dialogue triggers warning; $10 late fee is added to bill; game does NOT game-over; player can pay next day. |
| 14 | Ink Bridge | Ink script outputs malformed or unregistered semantic tag | `NarrativeAdapter` catches schema validation failure, logs developer error, and safely skips invalid tag without crashing dialogue. |
| 15 | Physical | Player attempts to attend Café meeting 3 hours late | Café scene is empty; thought bubble indicates Maya already left; follow-up Pulse message reflects disappointment. |
| 16 | Persistence | User refreshes browser during active download and open windows | Dexie loads latest autosave; in-progress download resumes byte progress; open window coordinates restore accurately. |
| 17 | Persistence | Corrupted IndexedDB database or schema version mismatch | Migration runner catches error; offers safe "Reset to Canonical Day 1 Start" option with error log export. |

---

## 6. Verification and Acceptance Standards

1. **Compilation & Build**:
   - `npm run build` succeeds with zero TypeScript errors under strict mode.
   - `npm run validate:content` verifies 100% Zod content schemas and Ink compilation.
2. **Vitest Unit & Integration Suites**:
   - 100% pass rate across all clock, download, software, economy, relationship, schedule, and persistence suites.
3. **Playwright E2E Suites**:
   - All 4 tiers (Feature Coverage, Boundary Cases, Cross-Feature Scenarios, and Full 14-Day Playthroughs) pass without retries.
4. **Zero Host Interference**:
   - No access to real host filesystem, public network APIs, or real registry.
5. **Evaluation Telemetry Output**:
   - Telemetry JSON exports cleanly, confirming 14 in-game days played, all narrative checkpoints met, and evaluation criteria validated.

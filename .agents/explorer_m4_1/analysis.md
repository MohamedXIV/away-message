# Narrative Engine, Social Layer & 14-Day Story Arc: Deep Technical Analysis

## 1. Executive Summary

This document presents the complete architectural blueprint, runtime integration model, and 14-day branching dialogue content design for **Milestone 4 (M4.1 & M4.2)** of *Away Message*.

The narrative subsystem bridges pure TypeScript headless simulation state with an authored deterministic `inkjs` narrative runtime. It ensures that dialogue choices, relationship metrics, time schedules, physical appointments (such as the Day 11/12 café meeting), and system progression (RAM, OS upgrades, software unlocks) operate with strict causal consistency and zero runtime LLM generation.

---

## 2. Investigation of Existing Codebase & Subsystems

### 2.1 Current State of `src/narrative/`
- Directory `src/narrative/` does not currently exist.
- `inkjs` (v2.4.0) is installed in `package.json` with support for both runtime execution (`inkjs.Story`) and compilation (`inkjs/full` Compiler / CLI).

### 2.2 Current State of `src/engine/SocialEngine.ts`
- Manages 4 core characters:
  1. **Ryan** (`ryan_foodcart`): Coworker, baseline familiarity 40, trust 50, comfort 50, respect 40, annoyance 0. Typing speed: 80 WPM.
  2. **Maya** (`starlight_maya`): Primary emotional arc, baseline familiarity 10, trust 20, comfort 30, respect 40, annoyance 0. Typing speed: 60 WPM.
  3. **Nora** (`NightOwl87`): Internet rabbit-hole guide, baseline familiarity 5, trust 15, comfort 20, respect 50, annoyance 0. Typing speed: 90 WPM.
  4. **Mr. Henderson** (`motel_office`): Motel landlord, baseline familiarity 30, trust 30, comfort 20, respect 40, annoyance 10. Typing speed: 40 WPM.
- Tracks 5 hidden relationship dimensions clamped to `[0, 100]`: `familiarity`, `trust`, `comfort`, `respect`, `annoyance`.
- Features `applySocialAction(buddyId, actionType)` with tuned deltas:
  - `empathy`: `{ familiarity: +3, trust: +4, comfort: +5, respect: +2, annoyance: -2 }`
  - `remembered_detail`: `{ familiarity: +5, trust: +6, comfort: +6, respect: +4, annoyance: -1 }`
  - `tease_playful`: `{ familiarity: +4, trust: +2, comfort: +3, respect: +2, annoyance: 0 }`
  - `dismissive`: `{ familiarity: -1, trust: -5, comfort: -6, respect: -3, annoyance: +8 }`
  - `vulnerable_share`: `{ familiarity: +6, trust: +7, comfort: +8, respect: +3, annoyance: -2 }`
  - `work_camaraderie`: `{ familiarity: +4, trust: +3, comfort: +4, respect: +3, annoyance: 0 }`
  - `intellectual_curiosity`: `{ familiarity: +4, trust: +5, comfort: +2, respect: +6, annoyance: 0 }`
- Manages 14-day schedule blocks, presence updates (`online`, `away`, `busy`, `offline`), away messages, and message records.

### 2.3 Current State of `src/apps/pulse/PulseMessengerApp.tsx`
- Pulse Messenger currently uses a temporary static mock script array (`DIALOGUE_SCRIPTS` in `dialogueTrees.ts`) with hardcoded Day 1 choices.
- `useSimulatedTyping.ts` handles:
  - NPC typing delay calculations based on WPM and message length.
  - Dispatching received messages to `SocialEngine`.
  - Player simulated typing effect (typing 1 char every 20ms) before dispatching `SOCIAL_SEND_MESSAGE` and `SOCIAL_APPLY_ACTION`.
- **Gap to Close in M4**: Replace static `DIALOGUE_SCRIPTS` with the authoritative `NarrativeEngine` and `InkAdapter` runtime.

### 2.4 Existing Narrative State & Actions in `SimulationEngine.ts`
- `NarrativeState` holds:
  - `activeBeatId: string | null`
  - `completedBeats: string[]`
  - `flags: Record<string, boolean | number | string>`
  - `appointments: Appointment[]`
  - `windowObservationHistory: string[]`
- Authoritative Actions: `NARRATIVE_TRIGGER_BEAT`, `NARRATIVE_SET_FLAG`, `NARRATIVE_SCHEDULE_APPOINTMENT`, `VIEW_SWITCH`.

---

## 3. Ink Narrative Engine Runtime (`NarrativeEngine.ts`) Architecture

```
+-----------------------------------------------------------------------------------+
|                               SIMULATION ENGINE                                   |
|   (Authoritative Clock, Economy, Hardware, VFS, Social, Flags, Appointments)      |
+-----------------------------------------------------------------------------------+
                                         ▲
                         Injects Context | Dispatches Actions / Sets Flags
                                         ▼
+-----------------------------------------------------------------------------------+
|                                  INK ADAPTER                                      |
|   (Evaluates Beat Triggers, Presence Hooks, Parses Tags, Dispatches Domain Events)|
+-----------------------------------------------------------------------------------+
                                         ▲
                       Story State / Tags| Evaluates Choices & Knots
                                         ▼
+-----------------------------------------------------------------------------------+
|                               NARRATIVE ENGINE                                    |
|                       (Wraps inkjs.Story, Headless TS)                            |
|                                                                                   |
|  - Injects Simulation Variables (sim_current_day, sim_player_cash, sim_os_ver...) |
|  - Binds External Functions (has_flag, is_installed, get_relationship...)         |
|  - Executes Story Knots / Stitches                                                |
|  - Parses Output Tags (# beat:, # effect:, # social:, # schedule:, # unlock:)     |
|  - Serializes / Deserializes Story State to JSON for Dexie Persistence            |
+-----------------------------------------------------------------------------------+
                                         ▲
                                         │ Dialogue Lines / Choices / Typings
                                         ▼
+-----------------------------------------------------------------------------------+
|                              PULSE MESSENGER / UI                                 |
|          (ChatWindow, useSimulatedTyping, CafeScene, WindowObservations)          |
+-----------------------------------------------------------------------------------+
```

### 3.1 Snapshot Context Injection Specification
Before advancing or evaluating any story branch, `NarrativeEngine` injects read-only simulation variables into `story.variablesState`:

| Ink Variable | TypeScript Source | Type | Description |
|---|---|---|---|
| `sim_current_day` | `state.time.day` | `number` | Current game day (1..14) |
| `sim_current_time_minute` | `state.time.minute + state.time.hour * 60` | `number` | Minute of day (0..1439) |
| `sim_time_of_day` | `state.time.timeOfDay` | `string` | `'morning' \| 'day' \| 'evening' \| 'night' \| 'late_night'` |
| `sim_player_cash` | `state.player.cash` | `number` | Current player wallet balance |
| `sim_player_energy` | `state.player.energy` | `number` | Player energy (0..100) |
| `sim_player_fatigue` | `state.player.fatigue` | `number` | Player fatigue (0..100) |
| `sim_os_version` | `state.hardware.osVersion` | `string` | `'Orion_4.8' \| 'Orion_6.0'` |
| `sim_ram_mb` | `state.hardware.ramMB` | `number` | `512 \| 1024` |
| `sim_connection_type` | `state.hardware.connectionType` | `string` | DSL or Dial-up tier |
| `sim_photobox_installed` | `isInstalled('photobox')` | `boolean` | Whether PhotoBox 3.0 is installed |
| `sim_weatherbuddy_installed` | `isInstalled('weatherbuddy')` | `boolean` | Whether WeatherBuddy is installed |
| `sim_safesweep_installed` | `isInstalled('safesweep')` | `boolean` | Whether SafeSweep is installed |
| `sim_flashfetch_installed` | `isInstalled('flashfetch')` | `boolean` | Whether FlashFetch is installed |
| `sim_zipmate_installed` | `isInstalled('zipmate')` | `boolean` | Whether ZipMate is installed |
| `sim_retroamp_installed` | `isInstalled('retroamp')` | `boolean` | Whether RetroAmp is installed |
| `sim_rent_paid` | `state.player.rentPaid` | `boolean` | Rent paid status |
| `sim_internet_paid` | `state.player.internetBillPaid` | `boolean` | Internet bill paid status |
| `sim_maya_familiarity` | `social.relationships.maya.familiarity` | `number` | Maya familiarity (0..100) |
| `sim_maya_trust` | `social.relationships.maya.trust` | `number` | Maya trust (0..100) |
| `sim_maya_comfort` | `social.relationships.maya.comfort` | `number` | Maya comfort (0..100) |
| `sim_maya_respect` | `social.relationships.maya.respect` | `number` | Maya respect (0..100) |
| `sim_maya_annoyance` | `social.relationships.maya.annoyance` | `number` | Maya annoyance (0..100) |
| `sim_ryan_familiarity` | `social.relationships.ryan.familiarity` | `number` | Ryan relationship metrics |
| `sim_nora_familiarity` | `social.relationships.nora.familiarity` | `number` | Nora relationship metrics |
| `sim_henderson_familiarity` | `social.relationships.henderson.familiarity` | `number` | Henderson relationship metrics |

### 3.2 External Function Bindings
`NarrativeEngine` binds external helper functions to Ink:
- `has_flag(flagKey: string): boolean`
- `get_flag_string(flagKey: string): string`
- `get_flag_number(flagKey: string): number`
- `is_installed(appId: string): boolean`
- `is_file_present(vfsPath: string): boolean`
- `get_relationship(buddyId: string, dimension: string): number`

### 3.3 Semantic Tag Syntax & Parsing

| Tag Prefix | Example Tag | Emitted Simulation Action / Consequence |
|---|---|---|
| `# beat:<id>` | `# beat:maya_day2_frustration` | Dispatches `NARRATIVE_TRIGGER_BEAT` with `beatId`. Sets active beat and records milestone. |
| `# effect:flag:<k>:<v>` | `# effect:flag:maya_shared_photo:true` | Dispatches `NARRATIVE_SET_FLAG` key=`maya_shared_photo`, value=`true`. |
| `# effect:money:<act>:<amt>:<rsn>` | `# effect:money:spend:4:bought_coffee` | Dispatches `PLAYER_SPEND_CASH` amount=4, reason=`bought_coffee`. |
| `# effect:file:create:<path>:<kind>` | `# effect:file:create:C:/Downloads/canal.wav:audio` | Creates virtual file record in `FileSystemEngine`. |
| `# effect:view:switch:<view>` | `# effect:view:switch:cafe` | Dispatches `VIEW_SWITCH` view=`cafe`. |
| `# social:<buddyId>:<action>` | `# social:maya:vulnerable_share` | Dispatches `SOCIAL_APPLY_ACTION` buddyId=`maya`, socialAction=`vulnerable_share`. |
| `# schedule:appointment:<id>:<day>:<sMin>:<eMin>:<loc>:<desc>` | `# schedule:appointment:maya_cafe:11:900:960:cafe:Coffee with Maya` | Dispatches `NARRATIVE_SCHEDULE_APPOINTMENT` for Day 11 at 15:00 at the café. |
| `# unlock:<target_type>:<target_id>` | `# unlock:website:nightboard_thread_104` | Unlocks dynamic website route / search term visibility. |

---

## 4. Fourteen-Day Branching Dialogue Tree Specification

### 4.1 Character 1: Ryan (`ryan_foodcart`) — Coworker & Practical Tech Guide
- **Tone**: Grounded, brotherly, food-cart banter, practical PC hardware hobbyist.
- **Schedule**: Works food cart 09:00–16:00, online evenings 18:00–22:00.
- **14-Day Knot Map**:
  - **Day 1 (`ryan_day1`)**: Explains Pulse Messenger, asks if Room 104 DSL is working, invites player to food cart across canal for al pastor tacos.
  - **Day 2 (`ryan_day2`)**: Suggests downloading RetroAmp MP3 player and FlashFetch accelerator from DownloadHub.
  - **Day 3 (`ryan_day3`)**: Adware warning: cautions player against bundled toolbar extras in WeatherBuddy installer; explains Add/Remove Programs.
  - **Day 4 (`ryan_day4`)**: Hardware tips: mentions searching BidBay for cheap used 512MB SDRAM; offers weekend overtime work shifts.
  - **Day 5 (`ryan_day5`)**: Canal gossip: talks about strange city water department workers near the canal; jokes about Henderson's strict motel rules.
  - **Day 6 (`ryan_day6`)**: Weekend banter: gaming clan stories, tips on freeing HDD disk space before downloading large files.
  - **Day 7 (`ryan_day7`)**: First Rent Check: checks if player has the $140 motel rent for Henderson; offers emergency shift if cash is short.
  - **Day 8 (`ryan_day8`)**: OS Transition: discusses installing Orion OS 6.0 and RAM upgrade; shares excitement for newer app capabilities.
  - **Day 9 (`ryan_day9`)**: PhotoBox unlock: discusses opening high-res photos on OS 6; reflects on long-term life plans.
  - **Day 10 (`ryan_day10`)**: Café Wingman: teases player about meeting Maya at 4th St Café; offers to cover shift so player can attend.
  - **Day 11 (`ryan_day11`)**: Pre/Post Café Meeting: sends encouraging message before meeting and checks in afterward.
  - **Day 12 (`ryan_day12`)**: Post-meeting reaction: funny food-cart customer stories; notices player is really settling into town.
  - **Day 13 (`ryan_day13`)**: Escalation banter: talks about odd internet dropouts and warns player not to get scammed on GoldNet bullion exchanges.
  - **Day 14 (`ryan_day14`)**: Evaluation wrap-up: toasts surviving two weeks; celebrates the upgraded PC and transformed motel room.

### 4.2 Character 2: Maya (`starlight_maya`) — Primary Emotional & Social Arc
- **Tone**: Observant, self-conscious, artistic, loves 35mm photography and ambient music.
- **Schedule**: Online evenings 17:30–24:00; late shift at 4th St Diner some afternoons.
- **14-Day Knot Map**:
  - **Day 1 (`maya_day1`)**: Welcomes player from Room 104 DSL; talks about the neon sign reflection in rain puddles; shares `myplace.local/maya_x`.
  - **Day 2 (`maya_day2`)**: Evening routine: 35mm film developing; diner job frustrations; mentions PhotoBox 3.0.
  - **Day 3 (`maya_day3`)**: Music & memories: asks about player's music tastes; discusses loneliness and late-night browsing.
  - **Day 4 (`maya_day4`)**: Personal disclosure: dreams of photography school in a larger city; asks why player chose this town.
  - **Day 5 (`maya_day5`)**: Work fatigue: feeling burned out by diner shifts; player can offer empathy, playful teasing, or dismissive responses.
  - **Day 6 (`maya_day6`)**: Rainy weekend: sends email attachment `maya_rain_neon.jpg` to Mailbox if trust is high.
  - **Day 7 (`maya_day7`)**: Rent day pressure: shares stress of balancing creative goals with paying bills; deepens connection.
  - **Day 8 (`maya_day8`)**: Photo sharing: if player upgraded to OS 6, she expresses excitement that PhotoBox 3.0 now works.
  - **Day 9 (`maya_day9`)**: Vulnerable disclosure: shares a story about a fallen-out friendship; player's response prepares the invitation.
  - **Day 10 (`maya_day10`)**: The Invitation: invites player to meet in person at 4th St Café on Day 11 at 15:00 (`# schedule:appointment:maya_cafe:11:900:960:cafe`).
  - **Day 11 (`maya_day11_cafe` / `cafe_scene`)**: Physical In-Person Meeting at Café (see Section 5).
  - **Day 12 (`maya_day12`)**: Post-meeting tenderness: acknowledges the awkwardness and warmth of meeting face-to-face; updates her away message with a private reference.
  - **Day 13 (`maya_day13`)**: Old web discovery: shares an archived 2003 personal blog mentioning Room 104's prior resident.
  - **Day 14 (`maya_day14`)**: Evaluation climax: late-night conversation; thanks player for becoming a true anchor over the past two weeks.

### 4.3 Character 3: Nora (`NightOwl87`) — Internet Lore & Rabbit-Hole Guide
- **Tone**: Cryptic, analytical, nocturnal, cynical about corporate tech, audio/signal forensics enthusiast.
- **Schedule**: Nocturnal (22:00–06:00).
- **14-Day Knot Map**:
  - **Day 1 (`nora_day1`)**: Reaches out at 02:00; asks about Room 104 phone line hum and canal acoustic frequencies; links NightBoard thread #104.
  - **Day 2 (`nora_day2`)**: Signal analysis: points player to PeerBox file `sub_canal_drone.wav`; explains audio wave peaks.
  - **Day 3 (`nora_day3`)**: Privacy & adware: warns about spyware telemetry; recommends SafeSweep to clean browser hijacks.
  - **Day 4 (`nora_day4`)**: Rabbit Hole A: unlocks archived 2002 NightBoard threads on municipal pump infrastructure.
  - **Day 5 (`nora_day5`)**: Search indexing: explains dynamic search caching on FindIt; shares hidden query strings (`"canal hum"`, `"starlite 104"`).
  - **Day 6 (`nora_day6`)**: Rabbit Hole B: guides player to cross-reference usernames between forums and old MyPlace guestbooks to find an old BBS moderator.
  - **Day 7 (`nora_day7`)**: Neon sign timing: remarks on electromagnetic cycling; philosophical thoughts on digital impermanence.
  - **Day 8 (`nora_day8`)**: Hardware analysis: analyzes RAM bus timings and hidden OS background services.
  - **Day 9 (`nora_day9`)**: Terminal exploration: guides player to use `ping` and `tracert` against internal IP ranges.
  - **Day 10 (`nora_day10`)**: Observes player's growing connection with Maya; shares perspective on online vs offline personas.
  - **Day 11 (`nora_day11`)**: Signal reflections: discusses physical acoustic properties of the 4th Street café district.
  - **Day 12 (`nora_day12`)**: GoldNet analysis: exposes automated trading algorithms and warns against speculation.
  - **Day 13 (`nora_day13`)**: Contained Escalation: an archived website returns 404; Nora sends an emergency archive file to player's Downloads folder.
  - **Day 14 (`nora_day14`)**: Farewell: marks player as a permanent verified node in her network; leaves a poetic sign-off.

### 4.4 Character 4: Mr. Henderson (`motel_office`) — Motel Landlord & Reality Tether
- **Tone**: Terse, formal, punctual, no-nonsense.
- **Schedule**: Motel office hours 08:00–20:00.
- **14-Day Knot Map**:
  - **Day 1 (`henderson_day1`)**: Room 104 policies: quiet hours at 22:00, internet DSL port rules.
  - **Day 3 (`henderson_day3`)**: Maintenance notice: water heater cycling and electrical junction repairs.
  - **Day 5 (`henderson_day5`)**: Advance rent notice: Week 1 rent ($140.00) due on Day 7 by 20:00.
  - **Day 7 (`henderson_day7`)**: Week 1 Rent Collection: acknowledges payment if paid via `PLAYER_PAY_RENT`; issues warning if unpaid.
  - **Day 9 (`henderson_day9`)**: Package notice: delivers TechMart hardware package to Room 104 door.
  - **Day 11 (`henderson_day11`)**: Lobby observation: notices player heading out to 4th Street Café.
  - **Day 12 (`henderson_day12`)**: Advance rent notice: Week 2 rent ($140.00) due on Day 14.
  - **Day 14 (`henderson_day14`)**: Week 2 Rent Collection & Final Evaluation: acknowledges prompt payments and turning Room 104 into a stable home.

---

## 5. Day 11/12 In-Person Café Meeting Dialogue & Mechanics

### 5.1 Flow & Execution
1. **Appointment Trigger (Day 10)**: Maya's knot emits `# schedule:appointment:maya_cafe:11:900:960:cafe:Coffee with Maya`.
2. **Attending (Day 11, 15:00–16:30)**:
   - Player receives prompt / interacts with Room door when appointment is active.
   - Simulation executes `VIEW_SWITCH` to `'cafe'`.
   - `advanceGameMinutes(75, 'cafe_meeting')` advances simulation clock from 15:00 to 16:15.
   - Consumes $4 for coffee (`PLAYER_SPEND_CASH`).
3. **Dialogue Beats (`cafe_meeting.ink`)**:
   - **Beat 1 (Breaking the screen barrier)**: Awkward laughter, realizing physical voices sound different from typed text.
   - **Beat 2 (Ordering drinks & sitting by the window)**: Ordering black coffee / tea; watching the rain outside.
   - **Beat 3 (Maya's Photo Portfolio)**: Maya hands player physical 35mm photo prints. Player chooses observant comments.
   - **Beat 4 (Personal turning point)**: Maya asks why player moved to this town. Player chooses from 3 distinct motivations (fresh start, escaping past, chasing independence).
   - **Beat 5 (Parting)**: Maya smiles, wraps her coat, and runs through the drizzle, promising to chat on Pulse tonight.
4. **Tags & Consequences**:
   - `# beat:cafe_meeting_complete`
   - `# social:maya:vulnerable_share` (+15 familiarity, +12 trust, +10 comfort)
   - `# effect:flag:cafe_meeting_attended:true`
   - `# effect:view:switch:room`
   - Unlocks special Day 12 Maya away message and online follow-up conversation.

---

## 6. Day 14 Evaluation Conclusion & Free-Play Mode

### 6.1 Evaluation Completion Criteria
On Day 14 at 22:00:
1. `NarrativeEngine` checks if `sim_current_day >= 14` and triggers `ending_knot`.
2. Emits `# beat:evaluation_complete` and `# effect:flag:evaluation_complete:true`.
3. Displays the diegetic `Evaluation Build Complete` modal summarizing:
   - Total in-game days survived: 14
   - Final cash balance & rent status
   - OS upgraded: Yes (`Orion_6.0`) / No (`Orion_4.8`)
   - Software installed count
   - Relationships established with Ryan, Maya, Nora, Henderson
   - In-person café meeting attended: Yes / No
   - Internet rabbit holes uncovered
4. Transition: Player clicks "Continue in Free Play", enabling infinite continuous play on Day 15+.

---

## 7. Concrete File Breakdown for Sub-Milestones M4.1 and M4.2

```
src/narrative/
├── types.ts                      # Interfaces: StoryChoice, DialogueLine, NarrativeTagCommand, EligibleBeat
├── NarrativeEngine.ts            # Headless wrapper for inkjs.Story, state serialization, variable injection
├── InkAdapter.ts                 # Bridge connecting SimulationEngine events, action dispatch, and Pulse
├── compiler/
│   └── compileStory.ts           # Build/dev compiler script compiling .ink sources to JS/JSON
├── compiled/
│   └── storyContent.ts           # Pre-compiled story JSON structure containing all 14-day knots
└── scripts/
    ├── main.ink                  # Story router & variable declarations
    ├── characters/
    │   ├── ryan.ink              # Ryan 14-day dialogue knots
    │   ├── maya.ink              # Maya 14-day dialogue knots
    │   ├── nora.ink              # Nora 14-day dialogue knots
    │   └── henderson.ink         # Henderson 14-day dialogue knots
    └── scenes/
        ├── cafe_meeting.ink      # Day 11/12 in-person café meeting dialogue
        └── ending.ink            # Day 14 evaluation completion & summary

tests/unit/
├── NarrativeEngine.test.ts       # Vitest tests: inkjs loading, snapshot injection, tag parsing, save/load
├── Dialogue14DayArcs.test.ts     # Vitest tests: 14-day reachability for Ryan, Maya, Nora, Henderson
└── CafeMeetingScene.test.ts      # Vitest tests: Café appointment scheduling, execution, post-meeting consequences
```

---

## 8. Implementation Plan

### Sub-Milestone M4.1: Ink Narrative Engine Runtime & Core Story Integration
1. **Types & Interfaces (`src/narrative/types.ts`)**: Define all contracts for narrative tags, choices, lines, and beat criteria.
2. **Runtime Engine (`src/narrative/NarrativeEngine.ts`)**:
   - Wrap `inkjs.Story`.
   - Implement `injectContext(simulationState)` with full variable mapping.
   - Implement `parseTags(rawTags)` for `# beat:`, `# effect:`, `# social:`, `# schedule:`, `# unlock:`.
   - Implement `saveState()` and `loadState(json)` for lossless Dexie persistence.
3. **Simulation Adapter (`src/narrative/InkAdapter.ts`)**:
   - Listen to `time:tick`, `time:jump`, `social:status_changed`.
   - Auto-evaluate eligible beats for online contacts.
   - Translate semantic tags into authoritative simulation actions.
4. **Master Ink Schema & Core Day 1–3 Knots**:
   - Write `main.ink` and initial Day 1–3 scripts for all 4 characters.
   - Implement compilation pipeline.
5. **Vitest Unit Suite (`tests/unit/NarrativeEngine.test.ts`)**:
   - Test variable injection, tag parsing, choice execution, and state persistence.

### Sub-Milestone M4.2: 14-Day Authored Story Trees, Café Meeting & Day 14 Resolution
1. **Complete 14-Day Ink Trees (`ryan.ink`, `maya.ink`, `nora.ink`, `henderson.ink`)**:
   - Author complete Day 1–14 dialogue knots with meaningful branches, relationship deltas, and tech prerequisites.
2. **Café Meeting Scene Minigame (`cafe_meeting.ink` & `CafeScene`)**:
   - Implement appointment scheduling, time jump (75 min), interactive multi-beat café conversation, and post-meeting relationship changes.
3. **Day 14 Evaluation Sequence & Free Play (`ending.ink`)**:
   - Author Day 14 wrap-up dialogue and evaluation summary modal.
4. **Pulse Messenger Integration**:
   - Connect `PulseMessengerApp` and `useSimulatedTyping` to `NarrativeEngine` and `InkAdapter`.
5. **Comprehensive Vitest Suites**:
   - `tests/unit/Dialogue14DayArcs.test.ts` (100% knot reachability check).
   - `tests/unit/CafeMeetingScene.test.ts` (Café workflow & post-meeting consequences).

# Comprehensive Analysis: 2D World, Layered Atmosphere, Café Scene & View Switching
**Sub-Milestone M4.3 Exploration & Architectural Blueprint**
**Agent**: Explorer 2 (2D World & Atmosphere Explorer)
**Date**: 2026-08-26
**Target Working Directory**: `f:/_WIP/away-message/src/world/`

---

## 1. Executive Summary & Problem Boundary

"Away Message" is defined by a fundamental design pillar: **the physical world feeds and complicates the digital world, and the digital world leads back into physical life**. The motel room is the player's physical anchor in 2006. When the player steps away from their desk, the game world continues advancing seamlessly on the authoritative simulation clock.

Milestone M4 (Sub-Milestone M4.3) requires building:
1. **2D Layered Atmospheric Motel Room (`RoomScene.tsx`, `RoomCanvas.ts`)**: A rich HTML5 Canvas 2D scene composed of 8 visual rendering layers, 5 time-of-day lighting cycles (`morning`, `day`, `evening`, `night`, `late_night`), 3 weather overlays (`clear`, `cloudy`, `rain`), dynamic particle systems (dust motes, kettle steam, rain droplets, CRT phosphor glow), and 6 physical interactable hotspots (PC desk, kettle, shower, window, bed, door/work).
2. **In-Person Physical Café Meeting (`CafeScene.tsx`, `CafeCanvas.ts`)**: A cozy, atmospheric 2D coffee shop scene where the player meets Maya in person on Day 11–12, executing branching dialogue with expressive portraits, consuming real in-game time, applying semantic social action tags, and causing tangible shifts in subsequent online chats.
3. **Day 14 Evaluation Resolution Modal (`Day14ResolutionModal.tsx`)**: The full 14-day completion screen presenting a retro certificate/evaluation summary of player finances, hardware evolution, software literacy, social bonds, and telemetry, with lossless transition into continuous **Free-Play Mode**.
4. **Seamless View Routing in `src/App.tsx`**: State-driven view switching between `'pc'`, `'room'`, `'cafe'`, and `'work'`, along with ambient audio loops and modal overlays.

---

## 2. Current Codebase Audit & Bindings

### 2.1 State of `src/world/`
- Currently **does not exist** on disk. All 2D visual presentation, canvas engines, and scene components will be cleanly created in `src/world/`.

### 2.2 State of `src/App.tsx`
- Currently hardcoded to render only `<DesktopShell />`:
  ```tsx
  // Current src/App.tsx:
  export const App: React.FC = () => {
    useSimulationTicker({ enabled: true });
    ...
    return (
      <div data-theme={themeAttr} className="w-full h-full overflow-hidden select-none">
        <DesktopShell />
      </div>
    );
  };
  ```
- **Needs**: Top-level view router switching between `DesktopShell` (`'pc'`), `RoomScene` (`'room'`), `CafeScene` (`'cafe'`), and modal layers (`Day14ResolutionModal`, `WindowObservationModal`, `SleepTransitionOverlay`).

### 2.3 State of `src/desktop/`
- `DesktopShell.tsx`, `Taskbar.tsx`, `StartMenu.tsx`, `SystemTray.tsx`, and `WindowManager.tsx` handle OS 4.8 / OS 6.0 desktop environments.
- **Needs**: An explicit "Step Away to Room" / "Look at Room" button on the Taskbar / System Tray (or shortcut key) so the player can effortlessly step away from the PC while downloads run in the background.

### 2.4 Simulation Engine & Store Bindings (`src/store/useSimulationStore.ts` & `src/engine/SimulationEngine.ts`)
The pure TypeScript simulation engine already contains robust domain action handlers:
- `switchView(view: 'pc' | 'room' | 'cafe' | 'work')` $\to$ Updates `activeView` in engine state and telemetry.
- `interactRoom(activity: 'tea' | 'coffee' | 'meal' | 'shower' | 'window')` $\to$ Advances time by 6m (tea), 5m (coffee), 15m (meal), 12m (shower), 4m (window), restores energy (+5 for tea/coffee, +15 for meal), logs telemetry, and updates window observation counters.
- `workShift(durationMinutes?: 240, wage?: 62)` $\to$ Consumes 240 mins (4 hours), earns $62 cash, consumes energy, logs shift telemetry.
- `restOrSleep(wakeHour?: 8)` $\to$ Jumps clock to 08:00 next morning, computes hours slept, restores energy, advances background downloads and character schedules, emits `time:day_changed`.
- `scheduleAppointment` and `narrativeFlags` $\to$ Tracks appointments (e.g. Maya café meeting on Day 11/12) and story flags (`maya_met_in_person`).

---

## 3. 2D Layered Atmospheric Motel Room Specification

### 3.1 The 8 Visual Rendering Layers

The canvas rendering architecture in `RoomCanvas.ts` will strictly enforce an 8-layer rendering pipeline from back to front:

```
┌────────────────────────────────────────────────────────┐
│ Layer 8: UI Hotspot Tooltips, Cursor & HUD Bar         │
├────────────────────────────────────────────────────────┤
│ Layer 7: Time-of-Day Color Grading & Lighting Cones    │
├────────────────────────────────────────────────────────┤
│ Layer 6: Dynamic Particles (Dust, Steam, Rain, Glow)   │
├────────────────────────────────────────────────────────┤
│ Layer 5: Interactive Hotspots & Clutter Progression    │
├────────────────────────────────────────────────────────┤
│ Layer 4: Furniture Layout (Bed, Desk, Counter, Clock)  │
├────────────────────────────────────────────────────────┤
│ Layer 3: Room Architecture (Walls, Doors, Window Frame)│
├────────────────────────────────────────────────────────┤
│ Layer 2: Street Midground (Road, Lamps, Neon Sign, Cars│
├────────────────────────────────────────────────────────┤
│ Layer 1: Sky & Far Exterior (Distant Skyline, Horizon) │
└────────────────────────────────────────────────────────┘
```

#### Layer 1: Sky & Far Exterior (Window Background)
- Rendered strictly within the window bounding box `[winX, winY, winW, winH]`.
- Gradient changes dynamically with `timeOfDay`:
  - `morning`: `#ff9a76` (peach) $\to$ `#fec194` (soft amber) $\to$ `#708ad4` (pale blue).
  - `day`: `#5fa8d3` (clear sky blue) $\to$ `#b8e1fc` (horizon tint) [or overcast `#6c7a89` $\to$ `#95a5a6` if rainy].
  - `evening`: `#ff4e50` (sunset crimson) $\to$ `#f9d423` (gold) $\to$ `#2c1654` (deep violet twilight).
  - `night`: `#060b1e` (midnight blue) $\to$ `#101c3d` (deep navy).
  - `late_night`: `#02040a` (pitch dark) $\to$ `#080d1a` (faint city skyglow).
- Distant skyline silhouettes with blinking red aircraft warning lights on distant towers (frequency 1.5s pulse).

#### Layer 2: Street & Mid-Exterior (Window Midground)
- Asphalt road and sidewalk view visible from second-story motel room.
- Streetlights: Metal pole lights with glowing radial light cones (lit during `evening`, `night`, `late_night`).
- Neon Diner Sign ("24H DINER / MOTEL"): Neon pink/cyan sign with subtle sinusoidal alpha flicker (`sin(t * 8)` with occasional random 50ms dropouts).
- Ambient Street Traffic: Procedurally generated car headlights/taillights moving across the lower window frame every 15–40s.
- Persistent Entities: The man in the tan trench coat standing by the payphone, the motel clerk smoking by the back alley.

#### Layer 3: Room Architecture & Structural Interior
- Motel walls: retro olive/cream striped wallpaper with slight grunge texture and dark wood baseboards.
- Window aperture: wood-paneled window frame with glass glare reflections.
- Room doors: Left door leading to motel hallway (with brass deadbolt and room number placard "104"); Right doorway leading to bathroom/shower.
- Ceiling light fixture and AC/heating wall unit under the window with visible horizontal vents.

#### Layer 4: Furniture & Room Layout
- **Bed**: Low motel bed frame with rumpled striped bedspread, white pillow, and wood headboard.
- **Nightstand**: Small wooden bedside table holding a retro digital red-LED alarm clock dynamically displaying current game time (`HH:MM`).
- **PC Desk**: Laminated particle-board desk, computer keyboard tray, generic beige office swivel chair.
- **Kitchenette Counter**: Formica counter surface with electric kettle stand, ceramic mug, and noodle packages.
- **Wall Decor**: Pin-up corkboard with sticky notes, band poster, and hardware receipts.

#### Layer 5: Interactive Hotspots & 14-Day Visual Progression
Each hotspot is defined with bounding coordinates `[x, y, w, h]`, hover cursor state, hover tooltip label, and click handler:
1. **PC Desk & Monitor (`hotspot_pc`)**:
   - CRT Monitor with glowing screen (shows miniature desktop with current OS theme colors).
   - Tower PC with green power LED and blinking amber HDD activity LED (blinks when downloads are active).
   - Click Action: `switchView('pc')` (zooms seamlessly into OS desktop).
2. **Kettle & Kitchenette (`hotspot_kettle`)**:
   - Electric kettle and mug.
   - Click Action: Opens Beverage & Snack Menu (Tea: 6m / +5 energy, Coffee: 5m / +5 energy, Instant Noodles: 15m / +15 energy).
3. **Shower & Bathroom Door (`hotspot_shower`)**:
   - Bathroom doorway with gentle towel rack.
   - Click Action: Prompts Hot Shower (12m, restores energy and freshness).
4. **Motel Window (`hotspot_window`)**:
   - Center glass window looking out onto the street.
   - Click Action: Opens Window Observation Modal (4m, reveals contextual narrative thought text).
5. **Bed (`hotspot_bed`)**:
   - Motel bed and pillow.
   - Click Action: Prompts "Go to sleep" (advances clock to 08:00 next day, restores energy to 100%, triggers day transition, saves game).
6. **Exit Door (`hotspot_door`)**:
   - Exterior motel door.
   - Click Action: Opens Travel & Work Menu ("Food Cart Work Shift" 240m / +$62, "Walk around block" 30m, "Travel to Starlight Café" if Maya meeting is scheduled).
- **14-Day Clutter Progression**:
  - Days 1–3: Sparse, lonely room (single mug, plain desk).
  - Days 4–7: Empty instant noodle cup, CD jewel case stack on desk, notebook with scribbled notes.
  - Days 8–10: Upgraded PC speaker boxes (if audio upgraded), spare RAM blister pack, sticky note reminder about rent.
  - Days 11–14: Framed small photo or coaster from café, organized software CD sleeves, personalized space.

#### Layer 6: Dynamic Particle & Atmospheric Systems
- **Sunlight Dust Motes**: 25 floating light particles gently drifting with Brownian motion inside morning/day light beams.
- **Kettle Steam**: 15 upward-curling translucent white vapor particles rising and dissipating when kettle is hot.
- **Window Rain Streaks**: In `rain` weather, 60 slanted rain lines outside + 8 slow vertical water condensation droplets trickling down the window glass.
- **CRT Phosphor Screen Glow**: Pulsing radial blue/green glow originating from the monitor face casting light onto the desk.

#### Layer 7: Time-of-Day Lighting & Color Grading Overlay
Rendered using Canvas 2D composite blending:
- **Morning (06:00–10:59)**: Golden peach wash (`rgba(255, 185, 110, 0.16)`), diagonal sunbeam trapezoid cutting through window across desk (`rgba(255, 235, 190, 0.12)`).
- **Day (11:00–16:59)**: Neutral bright daylight (`rgba(230, 240, 255, 0.04)` [or cool blue-slate `rgba(80, 100, 120, 0.22)` if rainy]).
- **Evening (17:00–20:59)**: Deep warm amber/crimson wash (`rgba(220, 85, 40, 0.26)`), elongated shadows, streetlights turning on.
- **Night (21:00–01:59)**: Cool deep navy wash (`rgba(12, 20, 50, 0.55)`), interior warm lamp pool (`rgba(255, 210, 130, 0.20)`), CRT monitor light cone.
- **Late Night (02:00–05:59)**: Heavy dark slate wash (`rgba(4, 7, 20, 0.74)`), isolated CRT monitor glow (`rgba(80, 160, 255, 0.22)`), blinking red tower beacon outside.

#### Layer 8: UI Hotspot Overlay & HUD
- Interactive retro hover tooltip badge following the cursor (e.g. `[💻 Sit at PC Desk]`, `[🪟 Look Out Window (4m)]`, `[🫖 Make Tea / Noodles]`, `[🚿 Take Shower (12m)]`, `[🛏️ Sleep until Morning]`, `[🚪 Go to Work / Travel]`).
- Top HUD bar displaying:
  - Time badge: `Day 4 — 14:32 (Day)`
  - Cash badge: `$84.50`
  - Energy badge: `Fine [████░░]`
  - Weather icon: `🌧️ Rain`
  - Quick Button: `[🖥️ Zoom to PC Desk]`

---

## 4. In-Person Café Meeting Scene (`CafeScene.tsx` & `CafeCanvas.ts`)

### 4.1 Narrative Staging & Setting
- **Context**: On Day 10, Maya invites the player to meet in person at the Starlight Café on Day 11 or Day 12 between 14:00 and 18:00.
- **Visual Presentation**:
  - Warm, cozy coffee shop interior rendered via HTML5 Canvas (`CafeCanvas.ts`).
  - Wooden booth table with two steaming ceramic coffee mugs and a paper napkin holder.
  - Background: Rain/sun through large cafe plate glass window, hanging art-deco pendant lamps, blurred cafe patrons in background.
  - **Maya's 2D Character Presentation**: Seated across the table, rendered with high-quality expressive retro character portraits:
    - `neutral`: Attentive, observing the player.
    - `smile`: Warm, genuine smile when player shares something empathetic or humorous.
    - `thoughtful`: Looking down at coffee cup when discussing her job / moving to the city.
    - `surprised`: Wide eyes when player remembers a specific detail from earlier Pulse chats.
    - `shy`: Subtle blush when player offers genuine vulnerability.

### 4.2 Dialogue Flow & Ink Integration
- Dialogue tree structured across 5 beats:
  1. **Arrival & Greeting**: Breaking the initial awkwardness of meeting in person vs. online typing.
  2. **The City & Daily Life**: Maya talks about why she moved here and her stressful job.
  3. **Shared Interests**: Music (RetroAmp tracks), late-night internet culture, computers.
  4. **Personal Connection / Moment of Vulnerability**: Player choice determines whether to be supportive (`# social:maya:empathy`), playfully tease (`# social:maya:tease_playful`), or recall an online conversation detail (`# social:maya:remembered_detail`).
  5. **Departure & Next Steps**: Wrapping up coffee, paying ($4.00), and parting ways.
- **Simulation Impact**:
  - Advances clock by 75 minutes.
  - Deducts $4.00 cash (coffee).
  - Sets narrative flag `maya_met_in_person = true`.
  - Applies social actions boosting `trust (+3)`, `comfort (+4)`, `familiarity (+3)`.
  - Next day on Pulse Messenger, Maya opens with personalized messages referencing the physical meeting.

---

## 5. Day 14 Evaluation Resolution Modal (`Day14ResolutionModal.tsx`)

### 5.1 Presentation & Architecture
- Activated when the clock hits Day 14 completion (e.g. Day 14 sleep or reaching Day 15).
- Modal features authentic retro certificate / computer diagnostics styling:
  - Header: **"AWAY MESSAGE — 14-DAY EVALUATION COMPLETE"**
  - Subtitle: *"System Diagnostic & Life Simulation Summary"*

### 5.2 Summary Metrics Display
1. **Time & Survival**: 14 in-game days lived (336 in-game hours), total real playtime.
2. **Financial Lifecycle**:
   - Final Cash Balance vs. Starting Cash ($38.00).
   - Total Food Cart Wages Earned.
   - Rent Status: Week 1 Paid ✅, Week 2 Paid ✅.
3. **Computer Evolution**:
   - Starting Specs: Orion OS 4.8, 512 MB RAM, 256k DSL.
   - Final Specs: Orion OS 6.0 (or 4.8), 1024 MB RAM, DSL 1M.
   - Software Portfolio: Total programs discovered and installed (Pulse, FlashFetch, RetroAmp, ZipMate, PhotoBox, SafeSweep).
   - Filesystem: Total downloads completed and files managed in VFS.
4. **Social Graph & Relationships**:
   - **Ryan**: Coworker & trusted friend who introduced Pulse.
   - **Maya**: Deep connection with in-person meeting completed.
   - **Nora (`NightOwl87`)**: Forum acquaintance and internet rabbit hole explorer.
   - **Mr. Henderson**: Motel manager.
5. **Physical World Exploration**: Window observations made, daily routines completed.

### 5.3 Actions & Free-Play Mode
- **"Continue in Free Play Mode"**: Dismisses the modal, leaves the save intact, and allows the player to continue exploring the PC, browsing sites, chatting with contacts, and working shifts with no day limit.
- **"Export Evaluation Telemetry (JSON)"**: Generates and triggers browser download of `away_message_telemetry.json`.
- **"Start New Save"**: Clears IndexedDB database and restarts from Day 1.

---

## 6. View Routing Architecture in `src/App.tsx`

```
                      ┌──────────────────────────────────────┐
                      │              src/App.tsx             │
                      │  - useSimulationTicker               │
                      │  - useAudioStore (unlockAudio)       │
                      │  - useActiveView selector            │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
                 ▼                       ▼                       ▼
      ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
      │ activeView === 'pc' │ │activeView ==='room' │ │activeView ==='cafe' │
      │   <DesktopShell />  │ │    <RoomScene />    │ │    <CafeScene />    │
      │                     │ │                     │ │                     │
      │  - Taskbar / Window │ │ - 8-Layer Canvas 2D │ │ - 2D Cafe Canvas    │
      │  - "Look at Room"   │ │ - Interactables HUD │ │ - Maya Dialogue Tree│
      │    switch button    │ │ - "Sit at PC" btn   │ │ - "Return to Room"  │
      └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         ▼
                      ┌──────────────────────────────────────┐
                      │            Global Overlays           │
                      │ - Day14ResolutionModal               │
                      │ - WindowObservationModal             │
                      │ - SleepFadeOverlay                   │
                      │ - WorkShiftMontageModal              │
                      │ - CRTOverlay                         │
                      └──────────────────────────────────────┘
```

---

## 7. Concrete File Breakdown & Implementation Plan for Sub-Milestone M4.3

### 7.1 New & Modified Files Directory Structure
```
src/
├── world/
│   ├── RoomScene.tsx              # React component wrapping RoomCanvas with interactive HUD & modals
│   ├── RoomCanvas.ts              # Pure HTML5 2D Canvas engine with 8 visual layers & particle loops
│   ├── CafeScene.tsx              # React component for in-person café meeting with Maya
│   ├── CafeCanvas.ts              # 2D Canvas engine for cozy café booth & lighting
│   ├── types.ts                   # Types for hotspots, layers, time bands, particles, weather
│   ├── data/
│   │   ├── windowThoughts.ts      # Contextual window observations (by day, weather, narrative flags)
│   │   ├── roomInteractables.ts   # Definitions for kettle, shower, bed, door, desk actions
│   │   └── cafeDialogue.ts        # Maya in-person meeting dialogue script & choice trees
│   ├── components/
│   │   ├── WindowObservationModal.tsx # Wide window observation view with thought text
│   │   ├── BeverageModal.tsx          # Tea, coffee, noodle brewing action modal
│   │   ├── DoorActionModal.tsx        # Work shift, errand, travel action modal
│   │   ├── SleepTransitionModal.tsx   # Fade-to-black sleep animation & summary
│   │   └── Day14ResolutionModal.tsx   # Day 14 evaluation completion certificate & free-play modal
├── desktop/
│   └── Taskbar.tsx                # Add "Look at Room / Step Away" button in quick launch / system tray
├── App.tsx                        # Update to route between DesktopShell, RoomScene, CafeScene
```

### 7.2 Step-by-Step Implementation Sequence
1. **Create `src/world/types.ts`**: Define hotspot definitions, particle structs, time band types, and weather states.
2. **Create `src/world/data/`**: Authored content files (`windowThoughts.ts`, `roomInteractables.ts`, `cafeDialogue.ts`).
3. **Implement `src/world/RoomCanvas.ts`**: Pure HTML5 2D Canvas renderer with 8 layers, 5 lighting cycles, 3 weather overlays, particle loops (dust, steam, rain, CRT glow), and mouse interaction hit-testing.
4. **Implement `src/world/RoomScene.tsx`**: React wrapper subscribing to simulation state, displaying HUD, and managing modals (Beverage, Shower, Window Observation, Bed Sleep, Door Work).
5. **Implement `src/world/CafeCanvas.ts` & `src/world/CafeScene.tsx`**: 2D cafe atmosphere, Maya's expressive portrait states, dialogue interaction, time consumption, and return to room.
6. **Implement `src/world/components/Day14ResolutionModal.tsx`**: Complete 14-day evaluation summary modal with telemetry export and free-play mode.
7. **Update `src/desktop/Taskbar.tsx` & `src/desktop/StartMenu.tsx`**: Add quick switch button allowing player to step away from desk to motel room.
8. **Update `src/App.tsx`**: Implement full view routing between `'pc'`, `'room'`, `'cafe'`, and modal layers.

---

## 8. Verification Strategy & Acceptance Matrix

| Verification Target | Test Strategy / Method | Acceptance Criteria |
|---|---|---|
| **Authoritative Clock Sync** | Unit/Integration Test | Clock ticks continuously at 1s = 1m across both PC Desktop and 2D RoomScene. |
| **8 Visual Layers** | Canvas Render Test / Vitest | All 8 layers draw in strict back-to-front order without clipping or artifacting. |
| **5 Lighting Cycles** | Time Parameter Test | Lighting tints smoothly transition across `morning`, `day`, `evening`, `night`, `late_night`. |
| **Weather Overlays** | Weather Switch Test | `rain` spawns animated streaks and condensation drops; `clear` spawns sunbeam dust motes. |
| **PC Desk View Switch** | UI Click / State Test | Clicking PC monitor in Room switches view to PC Desktop; taskbar button returns to Room. |
| **Kettle & Shower** | Action Dispatch Test | Tea advances 6m (+5 energy); Shower advances 12m (+8 energy); Noodles advance 15m (+$15 energy, -$2). |
| **Window Observation** | Thought Dispatch Test | Window advances 4m, logs telemetry, displays contextual thought text based on day/weather. |
| **Bed Sleep** | Clock Jump Test | Bed sleep jumps time to 08:00 next day, restores energy to 100, triggers `time:day_changed`. |
| **Food Cart Work** | Economy Dispatch Test | Door work shift advances 240m (4h), adds +$62.00 cash, deducts 40 energy. |
| **Café Scene with Maya** | Narrative / State Test | In-person meeting executes branching choices, advances 75m, sets `maya_met_in_person: true`. |
| **Day 14 Resolution** | Game Loop Test | Day 14 triggers resolution modal with telemetry export and seamless free-play continuation. |
| **Lossless Persistence** | Save/Reload Test | Refreshing browser restores exact room state, active view, and continuous simulation timeline. |

# Scope: Milestone 4 (Ink Narrative, Social Schedules & 2D World)

## 1. Objectives
Deliver the complete narrative engine, 14-day branching dialogue content, social simulation, and 2D physical atmospheric world:

1. **Ink Narrative Integration & Compilation (`src/narrative/`)**:
   - `NarrativeEngine.ts`: Ink runtime runner using `inkjs.Story`, state synchronization from `SimulationEngine`, and semantic tag execution (`# beat:`, `# effect:`, `# social:`, `# unlock:`, `# schedule:`).
   - `inkCompiler.ts` / narrative compiler: JSON representation or compiled Ink story trees for all 14 game days.
   - 14-Day branching story scripts for all 4 key characters:
     - Ryan (`ryan_foodcart`): coworker -> practical online friend -> physical/social bridge.
     - Maya (`starlight_maya`): unknown contact -> recurring conversations -> personal disclosure -> Day 11/12 café invitation -> changed post-meeting dynamic.
     - Nora (`NightOwl87`): forum handle -> mysterious rabbit hole guide -> Canal / port 8080 lore -> unresolved atmospheric intrigue.
     - Mr. Henderson (`motel_office`): motel landlord -> rent reminders ($140/wk on Day 7 & 14) -> room maintenance.
   - Full 14-day story progression from Day 1 wake-up to Day 14 evaluation completion modal.

2. **2D Physical World Presentation (`src/world/`)**:
   - `RoomScene.tsx` & `RoomCanvas.ts`: Layered 2D atmospheric motel room (8 distinct visual layers, CRT desktop glow, window overlooking the street, rain streaks, day/night cycles).
   - 5 Time-of-day lighting phases (`morning`, `day`, `evening`, `night`, `late_night`) with color grading and ambient overlays.
   - Weather overlays (`clear`, `cloudy`, `rain`) with animated rain particles and window condensation.
   - Physical Room Interactables:
     - **PC Desk**: Switch view between Room Scene and Desktop Shell. Progressive 14-day desktop clutter.
     - **Kettle**: Boil water & make tea (6 min time jump, restores comfort/energy) or instant noodles (15 min).
     - **Shower**: 12 min time jump (restores freshness/energy).
     - **Window View**: 4 min time jump, dedicated zoomed perspective with persistent street entities (recurring car, pedestrian, canal hum), contextual thoughts based on day/weather/story flags.
     - **Bed**: Sleep & rest action. Transitions to next day at 08:00, advancing downloads, schedules, economy, and saving game state.
     - **Door / Work**: Go to food cart shift (advances 240 mins, earns $62, reduces energy).
   - `CafeScene.tsx`: In-person meeting scene at the diner/café with Maya on Day 11/12, multi-beat physical dialogue, and post-meeting online relationship shift.
   - `Day14ResolutionModal.tsx`: Day 14 ending resolution modal presenting game summary, evaluation telemetry snapshot, and continuous free-play mode.

3. **Desktop & World View Switching (`src/App.tsx`)**:
   - Seamless toggling between 2D Room View and PC Desktop View via desk click / ESC / taskbar switcher.
   - Background downloads, game clock, and chat notifications remain active and audible across views.

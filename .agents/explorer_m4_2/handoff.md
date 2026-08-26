# Handoff Report: 2D Layered World, Atmosphere & Café Scene Exploration (Sub-Milestone M4.3)

**Author**: Explorer 2 (2D World & Atmosphere Explorer)
**Target Milestone**: Sub-Milestone M4.3 (2D Layered Room & Café Scene)
**Date**: 2026-08-26
**Working Directory**: `f:/_WIP/away-message/.agents/explorer_m4_2/`
**Target Source Directory**: `f:/_WIP/away-message/src/world/`

---

## 1. Observation

1. **Current Codebase Structure & Missing `src/world/`**:
   - `src/App.tsx` (lines 32–37) directly renders `<div data-theme={themeAttr} className="w-full h-full overflow-hidden select-none"><DesktopShell /></div>`. No view routing is in place yet.
   - `src/world/` does not currently exist on disk.
   - `src/store/useSimulationStore.ts` (lines 31, 45, 50, 53, 54, 158–189, 289) already declares:
     - `activeView: 'pc' | 'room' | 'cafe' | 'work'`
     - `switchView(view)`
     - `interactRoom(activity: 'tea' | 'coffee' | 'meal' | 'shower' | 'window')`
     - `workShift(durationMinutes, wage)`
     - `restOrSleep(wakeHour)`
     - `useActiveView()`, `useGameTime()`, `usePlayerState()`, `useNarrativeState()`
   - `src/engine/SimulationEngine.ts` (lines 28, 188–192, 215–288) provides authoritative handlers:
     - `PLAYER_INTERACT_ROOM`: advances time by 6m (tea), 5m (coffee), 15m (meal), 12m (shower), 4m (window), restores energy (+5 for tea/coffee, +15 for meal), and logs telemetry.
     - `PLAYER_WORK_SHIFT`: advances 240m (4 hours), earns $62.00, deducts energy.
     - `PLAYER_REST_OR_SLEEP`: advances to 08:00 next day, calculates hours slept, restores energy, updates download tasks, and emits `time:day_changed`.
     - `VIEW_SWITCH`: switches `activeView` to `'pc' | 'room' | 'cafe' | 'work'`.
   - `src/audio/SoundManager.ts` and `src/audio/SynthAudio.ts` provide synthesized audio effects (`playDoorOpen`, `playDoorSlam`, `playClick`, `playHddChirp`, `playDialupHandshake`), but room tone/ambient loops need initialization upon entering physical scenes.

2. **Design Specifications**:
   - `docs/02-WORLD-ART-AND-PRESENTATION.md` (lines 45–69, 132–153, 194–207, 283–298) specifies:
     - Fixed/gently panning 2D viewpoints, hotspots, layered scenes (8 layers: Background, Midground, Foreground, Interactive props, Character layer, Ambient animated layers, Lighting/color overlays, Time-of-day variants).
     - 5 time-of-day lighting cycles (`morning`, `day`, `evening`, `night`, `late_night`).
     - Weather overlays (`clear`, `cloudy`, `rain`).
     - Motel room interactables: PC desk, bed, kettle/drink, shower, window, door/work.
     - Café scene: Starlight Café for physical meeting with Maya.
   - `docs/00-VISION-AND-EVALUATION.md` (lines 430–440, 543–562, 579–608) specifies:
     - Day 1 loop: start download on PC $\to$ step away from desk $\to$ make tea $\to$ look out window $\to$ return to PC $\to$ download has advanced on the same clock.
     - Days 11–12: in-person meeting with Maya at café with expressive staging and lasting online consequences.
     - Day 14: evaluation completion modal with full summary of finances, OS/RAM/HDD progression, software portfolio, relationships, and lossless transition to continuous Free-Play mode.

---

## 2. Logic Chain

1. **Decoupled 2D Canvas Architecture**:
   - Because `src/world/` does not yet exist and the pure TypeScript `SimulationEngine` owns all state, a dedicated HTML5 Canvas 2D engine (`RoomCanvas.ts` & `CafeCanvas.ts`) wrapped in React components (`RoomScene.tsx` & `CafeScene.tsx`) provides zero-dependency, 60fps retro layered visual rendering.
2. **8-Layer Render Pipeline**:
   - To satisfy `docs/02-WORLD-ART-AND-PRESENTATION.md` without locking the final art style, `RoomCanvas.ts` renders 8 distinct z-layers:
     - Layer 1: Sky & Far Exterior (distant skyline & tower lights through window aperture)
     - Layer 2: Street Midground (road, streetlamps, neon sign flicker, ambient car silhouettes)
     - Layer 3: Room Architecture (motel walls, window frame, baseboards, doors)
     - Layer 4: Furniture Layout (bed, digital LED alarm clock, PC desk, kitchenette counter)
     - Layer 5: Interactive Hotspots (PC monitor/tower, kettle, shower door, window, bed, door) + 14-day clutter progression
     - Layer 6: Dynamic Particles (sunbeam dust motes, kettle steam, rain droplets, CRT glow)
     - Layer 7: Time-of-Day Lighting & Color Grading (`morning`, `day`, `evening`, `night`, `late_night`)
     - Layer 8: UI Hotspot Tooltips, Cursor & Top HUD Bar
3. **Continuous Simulation & Time Advancement**:
   - In `RoomScene.tsx`, user actions (making tea, showering, observing window, sleeping, going to work) dispatch directly to `useSimulationStore.interactRoom`, `restOrSleep`, and `workShift`.
   - Because `SimulationEngine` advances `GameClock`, `DownloadManager`, and `SocialEngine` in lockstep during discrete time jumps, the player can start a download on PC, switch to `room`, brew tea (6 min), and return to PC to find the download progressed authentically.
4. **Café Meeting & Narrative Bridge**:
   - `CafeScene.tsx` uses `CafeCanvas.ts` to render a cozy 2D cafe booth with Maya seated across the table.
   - Maya's portrait state shifts reactively (`neutral`, `smile`, `thoughtful`, `surprised`, `shy`) as player makes branching dialogue choices.
   - Choosing empathetic or observant replies applies semantic social action tags (`# social:maya:empathy`, `# social:maya:remembered_detail`), sets `maya_met_in_person: true`, consumes 75 minutes, and updates relationship metrics.
5. **Day 14 Resolution Modal & Free Play**:
   - `Day14ResolutionModal.tsx` evaluates all 14-day completion conditions, rendering a retro terminal/certificate evaluation summary.
   - Selecting "Continue in Free Play" seamlessly dismisses the modal, leaving the save active and unconstrained by day limits.

---

## 3. Caveats

1. **Phaser vs. Pure HTML5 Canvas 2D**:
   - Although `docs/05-TECHNICAL-ARCHITECTURE.md` references Phaser, Phaser is not present in `package.json`. A pure HTML5 Canvas 2D engine (`RoomCanvas.ts` / `CafeCanvas.ts`) is dramatically lighter, faster to bundle, has zero foreign dependencies, and executes pixel-perfect layered rendering in React 19 without canvas context conflicts.
2. **Audio Autoplay Policies**:
   - Web Audio ambient loops must honor `useAudioStore.unlockAudio()` and user interaction before starting synthesis.
3. **No Caveats on Core Simulation Integration**:
   - The simulation store and domain engine already expose all required action dispatchers.

---

## 4. Conclusion

The architectural blueprint and implementation plan for Sub-Milestone M4.3 are fully established:
1. Create `src/world/` containing `RoomScene.tsx`, `RoomCanvas.ts`, `CafeScene.tsx`, `CafeCanvas.ts`, `types.ts`, data files (`windowThoughts.ts`, `roomInteractables.ts`, `cafeDialogue.ts`), and modal components (`Day14ResolutionModal.tsx`, `WindowObservationModal.tsx`, `BeverageModal.tsx`, `DoorActionModal.tsx`, `SleepTransitionModal.tsx`).
2. Update `src/desktop/Taskbar.tsx` to provide a "Look at Room / Step Away" button.
3. Update `src/App.tsx` to implement clean view switching between `'pc'`, `'room'`, and `'cafe'`, with global overlay support.

---

## 5. Verification Method

1. **Independent File Inspection**:
   - Inspect `f:/_WIP/away-message/.agents/explorer_m4_2/analysis.md` for complete technical details.
   - Inspect `src/world/` once implemented for compliance with the 8-layer architecture.
2. **Automated Vitest Execution**:
   - Run `npm run test:unit` and `npm run test:integration` to ensure simulation engine and domain rules pass without regression.
3. **Playwright E2E Verification**:
   - Verify Scenario:
     1. Start download in Voyager Browser / FlashFetch on PC.
     2. Switch view to Room (`activeView = 'room'`).
     3. Click kettle $\to$ brew tea (6 min).
     4. Click window $\to$ observe street (4 min).
     5. Switch view back to PC (`activeView = 'pc'`).
     6. Confirm download progress advanced by 10 minutes.
     7. Sleep in bed $\to$ clock advances to 08:00 next day with full energy restoration.

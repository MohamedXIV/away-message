# Handoff Report: Milestone 4 (M4.1 & M4.2) Narrative & Social Subsystems

## 1. Observation

### Codebase and Architecture State
- **Narrative Subsystem**: `src/narrative/` does not exist yet. `inkjs` (v2.4.0) is present in `package.json` with support for both `inkjs.Story` runtime execution and compilation.
- **Social Engine (`src/engine/SocialEngine.ts:12-284`)**:
  - Contains full implementations of 4 characters: `ryan` (coworker, handle `ryan_foodcart`, initial familiarity 40, trust 50, comfort 50, respect 40, annoyance 0, 80 WPM), `maya` (primary arc, handle `starlight_maya`, initial familiarity 10, trust 20, comfort 30, respect 40, annoyance 0, 60 WPM), `nora` (lore guide, handle `NightOwl87`, initial familiarity 5, trust 15, comfort 20, respect 50, annoyance 0, 90 WPM), `henderson` (landlord, handle `motel_office`, initial familiarity 30, trust 30, comfort 20, respect 40, annoyance 10, 40 WPM).
  - Implements 5 hidden relationship dimensions clamped to `[0, 100]` and `applySocialAction(buddyId, actionType)` (`empathy`, `remembered_detail`, `tease_playful`, `dismissive`, `vulnerable_share`, `work_camaraderie`, `intellectual_curiosity`).
  - Implements 14-day schedule blocks, presence calculation, and message records.
- **Simulation Engine (`src/engine/SimulationEngine.ts:28-36, 477-503`)**:
  - Implements `NarrativeState` with `activeBeatId`, `completedBeats`, `flags`, `appointments`, and `windowObservationHistory`.
  - Implements actions `NARRATIVE_TRIGGER_BEAT`, `NARRATIVE_SET_FLAG`, `NARRATIVE_SCHEDULE_APPOINTMENT`, and `VIEW_SWITCH`.
- **Pulse Messenger (`src/apps/pulse/PulseMessengerApp.tsx:1-115`, `src/apps/pulse/data/dialogueTrees.ts:1-193`, `src/apps/pulse/hooks/useSimulatedTyping.ts:1-138`)**:
  - Currently uses a temporary mock script array `DIALOGUE_SCRIPTS` with simple Day 1 scripts.
  - `useSimulatedTyping` already manages WPM-based typing delays, audio triggers (`im_recv`, `im_send`), simulated player keystroke animation, and choice selection.
- **Unit Test Suite**:
  - Ran `npm run test:unit`: 22 test files, 195 unit tests pass with 0 failures in 55.38s.

---

## 2. Logic Chain

1. **State Ownership Separation**:
   - As mandated by `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` and `docs/05-TECHNICAL-ARCHITECTURE.md`, Ink must NOT own simulation state (money, time, hardware, installed software, authoritative relationships).
   - Therefore, `NarrativeEngine` must inject a read-only snapshot of `SimulationState` into `story.variablesState` (`sim_current_day`, `sim_player_cash`, `sim_os_version`, `sim_ram_mb`, `sim_maya_familiarity`, etc.) before evaluating story steps.

2. **Semantic Tag Execution**:
   - Dialogue choices and narrative beats in Ink output semantic tags: `# beat:`, `# effect:`, `# social:`, `# schedule:`, `# unlock:`.
   - `InkAdapter` parses these tags and dispatches authoritative simulation actions (`NARRATIVE_TRIGGER_BEAT`, `SOCIAL_APPLY_ACTION`, `NARRATIVE_SET_FLAG`, `NARRATIVE_SCHEDULE_APPOINTMENT`, `PLAYER_EARN_CASH`, `PLAYER_SPEND_CASH`, `VIEW_SWITCH`).

3. **14-Day Dialogue Arcs Across 4 Characters**:
   - The 14-day story structure is designed across all 4 characters to provide natural pacing, hardware progression gating (OS 6, RAM), financial milestones (Day 7 and Day 14 rent checks), internet lore rabbit holes (NightBoard thread #104, audio frequency analysis), the Day 11/12 in-person café meeting, and Day 14 evaluation completion.

4. **Integration with Pulse Messenger**:
   - By replacing the static `DIALOGUE_SCRIPTS` in `PulseMessengerApp` with `InkAdapter` and `NarrativeEngine`, all in-game chats become driven by compiled Ink stories while preserving the existing realistic typing rhythm and choice UI.

---

## 3. Caveats

- `Phaser 4.x` physical 2D room rendering and canvas layers are part of `src/world/` (addressed in parallel/subsequent M4 tasks). The narrative architecture is designed to remain completely decoupled from rendering engines and works headlessly with zero DOM/Phaser dependencies.
- Dexie persistence for narrative state must store both `SimulationEngine.narrative` (`flags`, `appointments`, `completedBeats`) and `story.state.ToJson()` for complete mid-dialogue restore.

---

## 4. Conclusion

The design for Milestone 4 (M4.1 & M4.2) is fully mapped, verified against existing systems, and ready for immediate implementation.

### Implementation Scope:
- **M4.1**: `src/narrative/types.ts`, `src/narrative/NarrativeEngine.ts`, `src/narrative/InkAdapter.ts`, master Ink compilation pipeline, Day 1–3 knots, and Vitest suite `tests/unit/NarrativeEngine.test.ts`.
- **M4.2**: Complete 14-day Ink scripts for Ryan, Maya, Nora, Henderson, Day 11/12 in-person café meeting dialogue (`cafe_meeting.ink`), Day 14 evaluation resolution, Pulse Messenger runtime binding, and Vitest verification suites `tests/unit/Dialogue14DayArcs.test.ts` and `tests/unit/CafeMeetingScene.test.ts`.

---

## 5. Verification Method

### Verification Commands:
1. `npm run test:unit` to verify existing 22 test suites and 195 tests continue to pass.
2. Compile and run new Vitest suites:
   - `npx vitest run tests/unit/NarrativeEngine.test.ts`
   - `npx vitest run tests/unit/Dialogue14DayArcs.test.ts`
   - `npx vitest run tests/unit/CafeMeetingScene.test.ts`
3. Content & reachability assertions: Verify all 14-day knots for Ryan, Maya, Nora, and Henderson are reachable and valid.

### Invalidation Conditions:
- Any direct mutation of simulation state from inside Ink without going through `InkAdapter` semantic tags.
- Any regression in the 22 existing unit test suites.

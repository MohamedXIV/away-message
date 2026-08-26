# Handoff Report: Pulse Messenger Architecture & Blueprints

**Agent:** explorer_m3_2  
**Target:** implementer (or parent orchestrator_3)  
**Date:** 2026-08-22  
**Status:** Complete  

---

## 1. Observation

1. **Specifications & Domain Requirements**:
   - `docs/03-COMPUTER-OS-AND-SOFTWARE.md` (lines 265–280): Pulse Messenger 5.2 provides contact list, statuses, chat history, notifications, and authored reply choices; Pulse Messenger 6.x adds display pictures (avatars), richer emoticons, and webcam/media indicators on Orion 6.0.
   - `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` (lines 441–486): Messenger conversation UX requires compact log, timestamps, typing indicators, authored response choices, and characterization via typing style and WPM cadence.
   - `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md` (lines 390–420): Hidden relationship dimensions (`familiarity`, `trust`, `comfort`, `respect`, `annoyance`) must be updated via semantic social actions (`empathy`, `tease_playful`, `remembered_detail`, `vulnerable_share`, etc.).
   - `.agents/orchestrator_3/SCOPE_M3.md` (lines 30–36): Requires Buddy list grouped by status (Online, Away, Busy, Offline), custom away message editor, simulated typing cadence, multi-tab chat windows, Web Audio chimes (`door_open`, `door_slam`, `im_recv`, `im_send`), and background desktop notifications.

2. **Existing Engine & Audio Infrastructure**:
   - `src/engine/SocialEngine.ts` (lines 68–139): All 4 characters (`ryan`, `maya`, `nora`, `henderson`) are initialized with `handle`, `displayName`, `initialRelationships`, 14-day schedule blocks, and `typingSpeedWpm` (Ryan: 80, Maya: 60, Nora: 90, Henderson: 40).
   - `src/engine/SocialEngine.ts` (lines 159–185): `updatePresence(currentTotalMinutes)` emits `social:status_changed` whenever contact status or away message changes.
   - `src/engine/SocialEngine.ts` (lines 187–219): `applySocialAction(buddyId, actionType)` applies deterministic deltas to the 5 dimensions.
   - `src/engine/SocialEngine.ts` (lines 221–250): `sendMessage(...)` logs messages, tracks unread state, and emits `social:message_received`.
   - `src/audio/SynthAudio.ts` (lines 377–474): Web Audio synthesizer already implements procedural `playImReceive()`, `playImSend()`, `playDoorOpen()`, `playDoorSlam()`, and `playClick()`.
   - `src/audio/SoundManager.ts` (lines 48–83) and `src/store/useAudioStore.ts` (lines 5–15): Provide `playSound('im_recv' | 'im_send' | 'door_open' | 'door_slam' | 'click')`.
   - `src/desktop/themes/orion48.css` and `src/desktop/themes/orion60.css`: Provide complete CSS variables and utility classes (`.orion-outset`, `.orion-inset`, `.orion-button`, `.orion-input`, `.orion-scrollbar`) for Orion 4.8 and 6.0.

3. **Missing Subsystem**:
   - `src/apps/pulse/` does not currently exist. All UI components, typing cadence hooks, notification toasts, and away message editor need to be implemented according to the blueprint in `analysis.md`.

---

## 2. Logic Chain

1. **Requirement Analysis**:
   - From Observation 1, Pulse Messenger must support dual operating system generational parity (Pulse 5.2 on Orion 4.8 vs Pulse 6.0 on Orion 6.0), status-grouped buddy list, custom away message composer/auto-responder, tabbed conversation windows, simulated typing cadence, and background desktop notification toasts.
2. **State & Architecture Decoupling**:
   - From Observation 2, `SocialEngine` and `SimulationEngine` already manage authoritative presence, message history, schedules, and relationship mechanics.
   - Therefore, the Pulse UI components only need to connect reactively via `useSimulationStore` to read state and dispatch `SOCIAL_SEND_MESSAGE` and `SOCIAL_APPLY_ACTION`.
3. **Sound & Notification Decoupling**:
   - From Observation 2, `SynthAudio` already contains procedural audio models for AIM/MSN sound effects. Hook `usePulseAudio` will listen for presence transitions and dispatch `door_open` and `door_slam`, while message events dispatch `im_recv` and `im_send`.
   - Hook `usePulseNotifications` will detect when messages arrive while Pulse is minimized/inactive and trigger `PulseNotificationToast` above the taskbar.
4. **Cadence & Narrative Mechanics**:
   - From Observation 1 & 2, NPC typing delay should be calculated dynamically from `typingSpeedWpm` ($CPS = (WPM \times 5)/60$), rendering the typing indicator before message emission. Player authored choices will stream into the input box and update the 5 hidden dimensions.
5. **Blueprint Synthesis**:
   - The modular design in `analysis.md` provides complete TypeScript code blueprints, component breakdown, hooks, and test scenarios.

---

## 3. Caveats

1. **Avatar Image Assets**: Orion 6.0 avatar images are referenced at `/avatars/[buddyId].png` with robust fallback to stylized initials and retro solid color backgrounds if static image files are not present.
2. **Dialogue Data Expansion**: `dialogueTrees.ts` provides structured TypeScript scripts for the primary evaluation beats (Days 1–14 for Maya, Ryan, Nora, Henderson); additional narrative beats can be connected directly to the Ink narrative engine via tags.
3. **No External Network Dependencies**: All chat interactions are purely simulated within the local runtime.

---

## 4. Conclusion

The complete architecture and code blueprints for `src/apps/pulse/PulseMessengerApp.tsx` and its supporting components (`BuddyListWindow`, `BuddyGroup`, `BuddyItem`, `UserProfileHeader`, `AwayMessageEditor`, `ChatWindow`, `ChatTabHeader`, `MessageHistoryView`, `MessageInputBar`, `AuthoredResponseMenu`, `PulseNotificationToast`, `usePulseAudio`, `useSimulatedTyping`, `usePulseNotifications`, `emoticonParser`) are fully specified in `f:/_WIP/away-message/.agents/explorer_m3_2/analysis.md`.

The implementation is ready to be executed cleanly by the implementer agent.

---

## 5. Verification Method

1. **Inspect Analysis and Blueprints**:
   - Read `f:/_WIP/away-message/.agents/explorer_m3_2/analysis.md` to verify all required features, types, hooks, and component implementations.
2. **Execute Unit Tests**:
   - Run `npm test` or `npx vitest run tests/unit/SocialEngine.test.ts` to verify underlying social engine logic.
   - Implementers should run newly created unit tests for Pulse Messenger (`tests/unit/PulseMessenger.test.ts`).
3. **Check Theme & Audio Compatibility**:
   - Verify that `useSimulationStore.getState().state.hardware.osVersion` dynamically switches styling and features between Orion 4.8 and Orion 6.0.
   - Verify `door_open`, `door_slam`, `im_recv`, and `im_send` sound triggers in browser Web Audio.

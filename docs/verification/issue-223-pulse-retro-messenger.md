# Issue #223 — retro Worker Messenger UX slice

## What changed

The Worker-playable Pulse now has a period-authentic messenger surface instead of a two-box debug panel:

- Split-pane buddy list + conversation on normal desktop windows (600px default), and a compact layout with a contact rail and a full buddy-list drawer when the Pulse window is narrow. Layout follows the **window/container** width, not the browser viewport.
- Buddy list grouped into **Online** and **Offline** with deterministic signature-color avatars, status dots, away/busy/offline labels, canonical away messages, unread counts, hover/selection states, search, and truthful “Last message …” copy for offline contacts.
- Conversation header with avatar, display name, handle, presence and away message; day separators, era-style `(10:43 AM)` timestamps, player/NPC bubble differentiation, offline-message badges, image history, older/newer paging, and auto-scroll to the newest turn.
- A retro choice composer for authored replies, with numbered 1–9 shortcuts, visible sending state, focused-reply highlight, and explicit “waiting for a reply” / offline-away copy derived from the Worker’s canonical conversation phase and Social presence.
- Subtle in-app unread notice when canonical Social unread increases on another thread. The notice opens that conversation. No React-owned message or presence is created.
- Account screen polish: remembered-ID chips, clear empty state, `role="alert"` errors, and a two-column hero/form layout on wide Pulse windows. Existing sign-up/sign-in/sign-out/persistence semantics were not replaced.
- Signed-in session and selected thread are kept in **UI-only window custom state**, so closing to the tray and reopening restores the same Pulse session and conversation. This is not canonical game state and is cleared on sign-out.
- That UI session is bound to the **actual save-slot ID**. A same-username account in another slot cannot inherit authentication, even when the two slots use different passwords. Save As / slot changes invalidate the UI session immediately.
- New minimal Worker command `markConversationRead(actorId)` forwards to the existing `SimulationKernel.markConversationAsRead`. Acknowledgement is gated on the Pulse window being active and visible, the browser tab being visible, the thread being on the newest page, and no compact buddy drawer obscuring it. A message arriving behind another OS window stays unread until the player focuses the conversation. Unknown identities are refused/no-op; no Social owner was duplicated.
- Secondary labels were raised from 7–9px to 10–12px across the messenger, drawer, conversation and account surfaces while preserving the compact 2005 hierarchy.

## Reused from legacy Pulse

- `PulseLoginSplash` account flow and Pulse purple/yellow visual identity, extended rather than reimplemented.
- `BuddyItem`/`BuddyGroup` presence vocabulary and last-seen/activity presentation ideas, rebuilt over the bounded `SimulationMessengerRead` + `SimulationPresenceRead` projections.
- `MessageHistoryView`/`ChatWindow` conventions for day/time display, sender colors, offline-message marking and paged history, rebuilt without importing the legacy simulation store or AI chat loop.
- Existing `formatSimulationMinutes`, signature-color helpers and `resolveArchetype`.

## Architecture boundaries

- Contacts, presence, transcripts and message timestamps come only from canonical Worker reads.
- Sending still goes exclusively through `pulseNarrative` authored choices → canonical Social.
- No free-text composer is shown while no validated AI intent resolver exists. Authored Ink choices remain always available.
- No fake NPC typing, read receipts or delivery guarantees were added.
- The recently merged actor-voice and World-news behavior in `WorkerPulseNarrative` / `PulseVoice` was not modified.

### Missing typing contract

The Worker exposes **no** NPC typing/transport signal. `SimulationPulseNarrativeResult.phase` exposes `waiting_first` / `waiting_second` / `waiting_outreach`, and Social presence exposes online/away/busy/offline, so the UI truthfully shows “waiting for a reply” rather than inventing typing. A real typing indicator would need a bounded Worker-owned projection/event for in-progress authored delivery (probably derived when a reply is scheduled); it was not fabricated in React.

## Verification

- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- `node scripts/verify-vitest-baseline.mjs --self-test` — pass.
- `node scripts/verify-vitest-baseline.mjs` — **371 files / 2,092 tests pass**.
- `npx playwright test tests/e2e/tier4_scenarios/ScenarioZ_WorkerPulseAcquisition.spec.ts` — pass on the actual `/` Worker route. The scenario checks split layout, online/offline groups, era timestamps, an away-but-reachable canonical contact producing a real authored NPC reply, tray close/reopen preserving the selected transcript, cold reload sign-in and saved transcript restore, then real uninstall.
- Focused unit/component coverage:
  - contact view/grouping/presence copy and waiting/complete state text;
  - Worker mark-read acknowledgement/refusal;
  - same-username/different-password session restore rejected across slots while same-slot tray restore remains signed in;
  - a mounted-but-background Pulse conversation leaves a fresh arrival unread until the Pulse window becomes active.
- Updated screenshots re-captured after the readability pass.
- Screenshots from the real in-game Pulse window:
  - Before: [`00b-before-window.png`](assets/issue-223-pulse-retro/00b-before-window.png)
  - After (split): [`03b-conversation-window.png`](assets/issue-223-pulse-retro/03b-conversation-window.png), [`01b-account-window.png`](assets/issue-223-pulse-retro/01b-account-window.png)
  - After (compact): [`04b-compact-window.png`](assets/issue-223-pulse-retro/04b-compact-window.png), [`05b-compact-drawer-window.png`](assets/issue-223-pulse-retro/05b-compact-drawer-window.png)
  - Full desktop context: [`02-buddy-list-and-conversation.png`](assets/issue-223-pulse-retro/02-buddy-list-and-conversation.png)

## Deliberately not claimed

- Human chat-quality/aesthetic acceptance of every authored thread.
- Actual NPC typing animation (no canonical Worker signal yet).
- AI free-text alongside choices (requires a real provider + validated intent mapping).
- The legacy (non-Worker) Pulse rooms/profile editor were not redesigned.

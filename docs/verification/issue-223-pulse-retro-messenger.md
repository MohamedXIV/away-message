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
- New minimal Worker command `markConversationRead(actorId)` forwards to the existing `SimulationKernel.markConversationAsRead`, so opening a known thread clears its canonical unread state. Unknown identities are refused/no-op; no Social owner was duplicated.

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
- `npx vitest run` — 369 files / 2083 tests pass.
- `npx playwright test tests/e2e/tier4_scenarios/ScenarioZ_WorkerPulseAcquisition.spec.ts` — pass on the actual `/` Worker route. The scenario now also checks split layout, online/offline groups, era timestamps, an away-but-reachable canonical contact producing a real authored NPC reply, tray close/reopen preserving the selected transcript, cold reload sign-in and saved transcript restore, then real uninstall.
- Focused unit coverage: contact view/grouping/presence copy, waiting/complete state text, and Worker mark-read acknowledgement/refusal.
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

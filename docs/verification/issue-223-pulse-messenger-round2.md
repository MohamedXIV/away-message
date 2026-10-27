# Issue #223 — Pulse Messenger round 2 UX refinement

Base: `f367bf9208af921ba8364bedc63724fd108ae566` (`main` after PR #230)
Branch: `feat/223-pulse-messenger-ux-round2`

## Observable problems found in the real Worker audit

1. **The launch window was too short.** Pulse was opened by the installer after other windows, so the OS cascade placed it at `y≈144`; the frame was squeezed to ~369px and the transcript to ~84px.
2. **The compact 340px layout clipped chrome.** The long “Free typing needs a connected AI service” paragraph and several fixed rows consumed the transcript; the composer could be cut off. The pager row was also shown for two-message conversations.
3. **The compact drawer was not a real modal.** Focus stayed on the “Buddies” button behind it; Escape did not close it, Tab could leave it, and the opener was not restored.
4. **The visual identity was off-period.** The app forced Tailwind’s modern `font-sans`, had no application status bar, duplicated version text, and showed “Offline” twice on offline contacts.
5. **New messages interrupted history reading.** A revision always refreshed the newest page and scrolled to the bottom. An offset-from-newest page could shift under the player, and scrolling up inside the newest page did not stop the page from changing underneath them.
6. **Errors were easy to miss.** The error strip lived below the composer, with no retry action.
7. **The composer fallback claimed “Checking what you can say…” forever** when no choices were available without loading.

## Implemented refinement

- Pulse opens near the top of the desktop (`y=24`) so the OS cascade cannot shorten it; minimum height raised to 420px. The real audit now measures transcripts at **210px / 232px / 216px** for approximately 600 / 400 / 340px widths.
- `font-pixel` (MS Sans Serif/Tahoma stack), a classic application status bar, beveled separators, pinned compact “All” control, and denser compact chrome.
- Short conversations no longer show a pager; compact mode hides the duplicated account row, uses a 32px conversation avatar, and replaces the meta AI copy with “Quick replies · Written only · 1–9”.
- The compact buddy drawer now:
  - focuses the search field on open,
  - traps Tab within the drawer,
  - closes with Escape,
  - restores focus to the exact opener (header button or pinned “All” control),
  - covers 92% of narrow windows.
- History reading is protected:
  - the newest page is frozen while the player is scrolled up,
  - incoming canonical unread shows a “New message(s) ↓” control instead of shifting the transcript,
  - clicking it (or scrolling to the bottom) refreshes to the latest page, scrolls down, and acknowledges unread,
  - the pager gains a `Latest` control with the canonical unread count,
  - sending a reply is explicit and returns to the newest turn.
- Unread acknowledgement still requires the conversation to be active/visible, and now also requires the newest turn to be at the bottom of the transcript.
- Errors appear under the header with Retry and Dismiss; the no-options state is truthful instead of an infinite “Checking…”.
- Visible focus outlines, `aria-busy`, an `aria-describedby` reply-help description, and `prefers-reduced-motion` handling are applied within the Pulse panel.
- Offline contacts with no history say “No messages yet”; the unsupported “Connected” claim and duplicate version labels were removed.

## Canonical boundaries

- No changes to Social/Worker message ownership, presence, unread counts, slot isolation, visible-only acknowledgement, Ink narrative, NPC voice, World knowledge or conversation generation.
- All new state is presentation-only: scroll position, frozen history page, drawer focus, error display.
- The compact long-history audit uses an explicit DEV save fixture; no production seeding path was added.

## Verification

- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- `npm run content:check` — pass.
- `node scripts/verify-vitest-baseline.mjs --self-test` — pass.
- `node scripts/verify-vitest-baseline.mjs` — **372 files / 2,099 tests pass**.
- `npx playwright test tests/e2e/tier4_scenarios/ScenarioZ_WorkerPulseAcquisition.spec.ts` — pass (real acquisition → accounts → groups → authored choice → NPC reply → tray restore → cold history → uninstall).
- Focused regressions: transcript bottom/follow decisions; frozen older/latest pages; scrolled-up arrival remains unread and only acknowledges after jump; numbered shortcuts; drawer focus/Escape restoration; truthful no-options state.
- Real Chromium audits:
  - 600 / 400 / 340px layouts; drawer focus lands on Search and Escape restores Buddies.
  - Seeded 81-message multi-day transcript: pages 52–81 → 22–51 → 1–21, `Latest` returns to newest.
  - Sending from scrolled-up history returns to the newest turn and shows the authored NPC reply.

## Screenshots

- Before: [`00-before-split-window-600.png`](assets/issue-223-pulse-round2/00-before-split-window-600.png), [`00-before-compact-340.png`](assets/issue-223-pulse-round2/00-before-compact-340.png), [`00-before-drawer-340.png`](assets/issue-223-pulse-round2/00-before-drawer-340.png)
- After: [`01-after-split-window-600.png`](assets/issue-223-pulse-round2/01-after-split-window-600.png), [`01-after-compact-400.png`](assets/issue-223-pulse-round2/01-after-compact-400.png), [`01-after-compact-340.png`](assets/issue-223-pulse-round2/01-after-compact-340.png), [`01-after-drawer-340.png`](assets/issue-223-pulse-round2/01-after-drawer-340.png)
- Account: [`01-after-account-window-600.png`](assets/issue-223-pulse-round2/01-after-account-window-600.png), [`01-after-account-window-340.png`](assets/issue-223-pulse-round2/01-after-account-window-340.png)
- History: [`02-after-long-history.png`](assets/issue-223-pulse-round2/02-after-long-history.png), [`03-after-oldest-page.png`](assets/issue-223-pulse-round2/03-after-oldest-page.png), [`04-after-send-from-history.png`](assets/issue-223-pulse-round2/04-after-send-from-history.png)

## Remaining limitations

- The compact account form still scrolls vertically at 340px; the primary action is reachable but not simultaneously visible with the hero.
- There is still no canonical Worker typing contract; the UI continues to show waiting/away copy rather than fake typing.
- Free-text conversation remains unavailable until a validated AI intent resolver exists.
- The 81-message multi-day audit is a DEV fixture, not a shipped content path.
- Human aesthetic/chat-quality acceptance is not claimed by automated checks.

# Issue #223 — combined-main Pulse Messenger acceptance

Base: `ebbc200c6f5f37d03a54ce32edf39794d87e4d7f` (`main`, after #230/#231/#232)

## Result

The Worker-playable Pulse passes the combined-main browser acceptance. One real defect was found and fixed: several 9–11px secondary labels were below WCAG AA contrast. No simulation, Social, Ink or narrative behavior was changed.

## Acceptance matrix

| Area | Result |
| --- | --- |
| Real acquisition → installation → account creation | Pass |
| Sign out / sign in / remembered account | Pass |
| Save As to another slot invalidates the UI session | Pass |
| Cold reload → load slot → re-authenticate → history restored | Pass |
| Uninstall Pulse → reinstall from the setup file → history preserved | Pass |
| 600px split layout | Pass |
| 400px compact layout | Pass |
| 340px minimum-width compact layout | Pass |
| Tray minimize/restore at 340px preserves the thread | Pass |
| Buddy-list keyboard Tab navigation + Enter selection | Pass |
| Visible keyboard focus indicator (2px solid outline) | Pass |
| Compact drawer focus trap, Escape close, opener focus restore | Pass |
| Online / away / offline canonical presence | Pass |
| Busy presence | Not producible by current authored schedules; UI mapping is covered by unit tests |
| Authored choice + real NPC reply | Pass |
| Background arrival remains unread, tray count updates, focus acknowledges | Pass |
| Multi-page history + Older/Latest | Pass |
| Scrolled-up conversation does not jump on incoming turns | Pass (component regression) |
| Reduced-motion preference | Pass (`getComputedStyle(...).animationDuration < 1ms`) |
| Readability / clipping at 340–600px | Pass after contrast fix |

## Defect found and fixed

Secondary text was below the 4.5:1 AA threshold for small text:

| Text | Before | After |
| --- | --- | --- |
| Timestamp on NPC bubble | 3.85:1 (`#8b7c9a`) | 6.34:1 (`#6d5684`) |
| Timestamp on player bubble | 3.12:1 | 5.13:1 |
| Day separator | 3.16:1 (`#9a89aa`) | 6.23:1 (`#6d5684`) |
| Composer hint | 3.14:1 (`#8b7c9a`) | 5.15:1 (`#6d5684`) |
| Offline badge | 4.27:1 (`#6f647c`) | 6.12:1 (`#5b4a6d`) |
| Contact secondary / rail status | 4.58–4.80:1 | ~5.3–5.9:1 (`#6b5a7a`) |
| Input placeholders | browser default | 5.93:1 (`#6b5a7a`) |

The visual hierarchy remains period-appropriate; only the low-contrast tokens changed. A component regression asserts the corrected timestamp, day-separator and reply-hint classes.

## Verification

- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- `npm run content:check` — pass.
- `node scripts/verify-vitest-baseline.mjs --self-test` — pass.
- `node scripts/verify-vitest-baseline.mjs` — **372 files / 2,103 tests pass**.
- `npx playwright test tests/e2e/tier4_scenarios/ScenarioZ_WorkerPulseAcquisition.spec.ts` — pass.
- Real Chromium combined acceptance:
  - acquisition/install/account, sign-out/in, widths 600/400/340, tray restore, keyboard focus, drawer Escape/restore, Save As slot isolation, cold reload, uninstall/reinstall — pass.
  - isolated canonical background arrival: My Computer active, pending authored reply delivered, contact row `1 unread` + tray unread title, then focus clears it — pass (run twice).
  - seeded multi-day history: `53–82` → `23–52` → `1–22` paging, Older disabled, Latest returns to newest — pass.
  - A combined long-history + background fixture was not used as a single gate because the fixture could make the pending turn eligible before background focus; the two behaviors were verified independently.

## Screenshots

- Widths: [`01-split-600.png`](assets/issue-223-pulse-combined-acceptance/01-split-600.png), [`02-compact-400.png`](assets/issue-223-pulse-combined-acceptance/02-compact-400.png), [`03-compact-340.png`](assets/issue-223-pulse-combined-acceptance/03-compact-340.png)
- Keyboard/drawer: [`04-keyboard-focus.png`](assets/issue-223-pulse-combined-acceptance/04-keyboard-focus.png), [`05-drawer-focus-340.png`](assets/issue-223-pulse-combined-acceptance/05-drawer-focus-340.png)
- Reinstall: [`06-reinstalled.png`](assets/issue-223-pulse-combined-acceptance/06-reinstalled.png)
- History: [`07-long-history.png`](assets/issue-223-pulse-combined-acceptance/07-long-history.png), [`08-oldest-page.png`](assets/issue-223-pulse-combined-acceptance/08-oldest-page.png)
- Background arrival: [`11-before-background-arrival.png`](assets/issue-223-pulse-combined-acceptance/11-before-background-arrival.png), [`12-background-unread.png`](assets/issue-223-pulse-combined-acceptance/12-background-unread.png), [`13-after-focus-reply.png`](assets/issue-223-pulse-combined-acceptance/13-after-focus-reply.png)

## Limitations

- Current authored schedules do not produce a canonical `busy` presence; the UI supports it but the browser pass could not exercise a real busy actor without fabricating state.
- The 340px account form still scrolls vertically; the primary action is reachable.
- There is still no canonical Worker typing signal or validated free-text AI intent resolver; none was fabricated.
- The multi-page/background audits use an explicit DEV save fixture.
- Human aesthetic and chat-quality acceptance remains outstanding.

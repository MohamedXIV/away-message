# First Worker Human Playtest — Product/Feel Findings (2026-10-23)

Status: **Recorded, NOT fixed.** The game passed an initial **human functional checklist**, but the same player immediately flagged four design/product defects. Automated green CI is not subjective gameplay or final UX acceptance.

Tracking: [parent #211](https://github.com/MohamedXIV/away-message/issues/211); implementation issues [#212](https://github.com/MohamedXIV/away-message/issues/212), [#213](https://github.com/MohamedXIV/away-message/issues/213), [#214](https://github.com/MohamedXIV/away-message/issues/214), [#215](https://github.com/MohamedXIV/away-message/issues/215). Active engineering branch: [Draft PR #204](https://github.com/MohamedXIV/away-message/pull/204), verified head `777357e5fc5c1f8197dcdd4d0b88bbbe19f623d0`. Architecture readiness: [#175](https://github.com/MohamedXIV/away-message/issues/175), [#177](https://github.com/MohamedXIV/away-message/issues/177). Broader Production Phase A visual/target-device gate: [#166](https://github.com/MohamedXIV/away-message/issues/166).

## 1. What the tester actually did

Test environment: **browser game run from GitHub Codespaces** on the current Draft Worker branch. Exact hardware/browser/device versions were not recorded. Do not invent them.

The tester reported **all items in the initial manual checklist completed successfully**:

1. New Game and starting residence.
2. Room/hotspots, needs such as shower/sleep.
3. City map, external trip/activity and home return.
4. Setup/OS installation/boot of owned PC.
5. Desktop, Notepad/VFS write/save.
6. Save game, full browser reload and Continue saved game.

This establishes an initial *human-operated functional path*, **not** a release-accepted UI, true random social encounter, multi-day pacing check or final asset/performance approval.

Complementary automation (not a substitute for the above): [Verify #39900322098](https://github.com/MohamedXIV/away-message/actions/runs/39900322098) succeeded on Draft #204, **354/354 Vitest files; 2,017/2,017 tests; 18/18 Chromium gates; sampled 20/100/250/500 population/Worker benchmarks**. It uses a clearly DEV-seeded café guest for one social route; it does not prove a spontaneous encounter is guaranteed in a fresh unseeded game.

## 2. Observed product defects — user report

### F1 — Orion desktop/OS presentation is not convincing ([#212](https://github.com/MohamedXIV/away-message/issues/212))

**Observed:** Player explicitly said the desktop/OS "isn't right." The supplied screenshot of **Orion 4.8, Worker-backed desktop** shows a broad empty teal desktop, a narrow vertically scrollable icon column, sparse legacy-looking icons, tiny status/debug text in the upper right, and a basic thin taskbar. The OS shell feels technical/placeholder-like rather than like a believable 2005-era fictional desktop.

**Intended:** Distinct Orion/OS visual identity and credible start menu, taskbar, desktop layout, app icons, window behavior and typography. Reuse OS-hosted presentation, not per-app copied chrome or an entirely new desktop owner.

**Evidence limitation:** Screenshot was provided in conversation; this markdown records its observed characteristics and issue context, not a stored binary screenshot asset.

### F2 — Fixed "main characters" are still exposed ([#213](https://github.com/MohamedXIV/away-message/issues/213))

**Observed:** Maya, Mr. Henderson and apparently other authored named identities repeatedly appear in places in the playable world; this breaks the player's requested **dynamic cast, no protected main characters** rule.

**Intended:** The roster can vary per playthrough. Authored situations, Ink flows and social roles dynamically bind to currently eligible people through identity/role/knowledge/presence/relationships. A legacy named actor may be an **optional ordinary inhabitant/test fixture**, but must never be required or guaranteed as a sacred cast member. Test absence/renaming and unseeded worlds.

**Do not mistake:** Removing special-character dependencies does **not** mean banning all NPC names or discarding quality authored content. It means no protected mandatory named IDs.

### F3 — Pulse comes with the starter PC/OS ([#214](https://github.com/MohamedXIV/away-message/issues/214))

**Observed:** Player found Pulse available with starter device/OS, without discovering and installing it.

**Intended:** A clean Orion OS bundles only intentional system components. A normal third-party messenger, Pulse, must be **discovered through the fake internet** (site/directory/search/contact), downloaded through the canonical connection/transfer system to an owned file, and installed via the existing generic installer and compatibility model. Only then may it be launched and appear as installed. Save/cold reload preserve it. Social identity/conversation truth is separate from app installation status.

**Do not mistake:** A visible feature panel's presence is not proof that an ordinary fresh-installed machine owns the Pulse executable; the production UI and the Worker registry must reflect the **same** truth.

### F4 — Starter hardware and internet feel unrealistically instantaneous ([#215](https://github.com/MohamedXIV/away-message/issues/215))

**Observed:** Boot/desktop/tasks/connectivity felt too quick to make future PC, hardware and ISP upgrades desirable.

**Intended:** Measurable **in-world** timed tasks: starter vs upgraded PC, boot/heavy-app/install/file workload and network download/page fetch as appropriate; real bandwidth/bytes where transfer is involved, status/ETA/background continuation, no fabricated instant completion, meaningful hardware/connection upgrade gains. Keep the browser responsive and avoid gratuitous mandatory wall-clock waits.

**Do not mistake:** "simulate slow" does **not** authorize `setTimeout` as the game authority, a second scheduler, duplicate Worker state, a screen-freezing loading spinner or making every click painfully slow. The gameplay clock and existing domain owners decide operation progress.

## 3. Corrective backlog and existing systems

| Severity | Follow-up | Scope boundary |
| --- | --- | --- |
| P0 | [#212 Orion desktop UX](https://github.com/MohamedXIV/away-message/issues/212) | Production OS presentation identity; reuse original host/window APIs |
| P0 | [#213 Dynamic playable cast](https://github.com/MohamedXIV/away-message/issues/213) | Replace player-facing fixed-character assumptions without a second narrative/roster engine |
| P0 | [#214 Pulse discover/download/install](https://github.com/MohamedXIV/away-message/issues/214) | Reuse software catalog, installer, fake internet and existing canonical DownloadService |
| P1 | [#215 Time/performance and ISP meaning](https://github.com/MohamedXIV/away-message/issues/215) | Reuse single canonical Worker/clock, PC stats, download engine and save state |

Implementation may pair **#214 + #215** in one coherent downloadable-software vertical slice; do not create competing downloads or independent task clocks. #212 can proceed as a presentation lane. #213 can proceed as a character/content/Ink lane with coordination when touching the same Worker screens. For each lane, inspect live status/PRs first and avoid modifying #204's ongoing acceptance branch from another owner without coordination.

Earlier completed foundation issues **#5, #9–#12 and #126** define architecture, **not** proof that these fresh human-reported product gaps are fixed. Use these canonical docs as prior authority:
- `AGENTS.md`: open-ended sandbox, dynamic actors, no second simulation owner, human vs CI acceptance.
- `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md`: meaningful hardware/OS/internet progression.
- `docs/03-COMPUTER-OS-AND-SOFTWARE.md`: fictional OS identity, bundled apps, downloads, installer framework, RAM/startup/network effects.
- `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md`: software download through fake sites, dynamic social roster and knowledge-safe character binding.
- `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md`: full sandbox player loop and manual acceptance.
- `docs/13-SCENARIOS-AND-STORY-THREADS.md` and `docs/16-INK-NARRATIVE-AUTHORING-AND-GENERATIVE-INTERNET.md`: optional authored scenarios with dynamic semantic roles; no protected named cast.
- `docs/14-FIRST-PRODUCTION-ART-AND-PLAYABLE-SLICE.md`: production presentation/human visual gate.
- `docs/22-SIMULATION-HOST-AND-WORKER.md` on PR #204: current single-Worker transition evidence.

## 4. Release/merge and review handoff

- This document is a **2026-10-23 playtest record**, not a new overriding spec or implementation itself.
- **Do not mark #211 or its children complete from existing #204 CI**; each requires its own future player-visible evidence and a follow-up human judgement.
- **Do not claim #204 already merged**. At time of recording, #204 is Draft/open and the user has not signed off on the observed product/UX failures. Any merge/closure decision must recheck the actual live repository and clarify whether #175 engineering closure and the separate product-experience gate can be staged without falsely claiming human acceptance.
- After remediation, repeat an **unseeded** New Game and check both core gameplay and social discovery; verify Pulse is absent before install and the starter PC is meaningfully slower, then verify improved machine/ISP and cold save/reload. Capture exact commit, browser/device and gameplay observations; attach screenshots/differences in the resulting PR/issues.
- A later new chat/agent should **start from #211 and its linked #212–#215** rather than reopening architectural discovery.

**Current state:** findings documented, issues open; no production fixes are claimed here.

# Implementation Milestones, Acceptance, and Testing

## Implementation Milestones

This document defines a recommended build order for the complete evaluation game.

The goal is to reach an end-to-end playable build early, then deepen it.

Do not perfect one application while the rest of the game is missing.

---

## Milestone 1 — Foundation and authoritative simulation

Build:
- Vite + TypeScript + React
- Phaser integration
- central simulation engine
- game clock
- room/PC view switching
- IndexedDB save/reset
- developer debug panel
- central time scale

Pass:
- room and PC show same time
- time does not reset across views
- save/load restores time/state

---

## Milestone 2 — Fake OS shell

Build:
- Orion 4 desktop
- taskbar clock
- reusable windows
- open/close/minimize/focus
- My Computer
- Downloads folder
- Add/Remove Programs shell
- Voyager Browser shell

Pass:
- windows do not own simulation state
- desktop survives view changes

---

## Milestone 3 — Download/file/install loop

Build:
- file records
- download tasks
- browser download
- installer framework
- disk usage
- software definitions
- Pulse installation

Pass:
- discover → download → file → install → launch works
- browser can close during download

---

## Milestone 4 — Continuous-world proof

Build:
- tea
- window
- street state
- Ryan schedule stub

Mandatory scenario:
1. start download
2. exit PC
3. make tea
4. look out window
5. return
6. download advanced
7. same clock advanced all systems

Do not continue until this is genuinely simulation-driven.

---

## Milestone 5 — Ink narrative bridge

Build:
- Ink source/build pipeline
- inkjs runtime
- dialogue window
- authored choices
- semantic effect tags
- relationship action handling

Pass:
- opening Ryan chat runs through Ink
- simulation state can gate Ink content
- Ink cannot directly own authoritative money/time/download truth

---

## Milestone 6 — Social simulation

Build:
- contacts
- statuses
- schedules
- unread messages
- offline messages
- Maya introduction
- hidden relationship dimensions
- typing delays

Pass:
- contacts change state while Messenger closed
- message can arrive away from PC
- relationship has no visible number

---

## Milestone 7 — Software ecosystem

Build:
- FlashFetch
- RetroAmp
- ZipMate
- PhotoBox failure
- WeatherBuddy/SearchMate
- SafeSweep
- terminal basics
- uninstall

Pass:
- each program proves a distinct mechanic
- bundled extras reversible
- portable app differs from installed app

---

## Milestone 8 — Fake internet

Build:
- FindIt
- DownloadHub
- TechMart
- BidBay
- NightBoard
- MyPlace
- Mailbox
- CityWire
- Jobs
- first rabbit holes

Pass:
- player can discover useful content through links/search rather than a master app list

---

## Milestone 9 — Economy and first week

Build:
- work shifts
- expenses
- rent
- internet bill
- classifieds purchase
- Day 1–7 authored content

Pass:
- player must make at least one real money priority decision
- no soft lock if player spends imperfectly

---

## Milestone 10 — Hardware and OS 6

Build:
- RAM upgrade
- storage upgrade/cleanup
- internet plan upgrade
- Orion 6 installer
- restart/boot
- newer desktop theme
- PhotoBox/newer Pulse unlock

Pass:
- upgrade changes actual functionality
- old/new OS are visually distinct
- save/load preserves upgraded system

---

## Milestone 11 — Physical social world

Build:
- café
- bus stop/street
- optional shop
- travel/time cost
- Maya appointment
- physical meeting through Ink

Pass:
- online relationship changes after real-world meeting
- physical world and digital world reference each other

---

## Milestone 12 — Days 8–14 and contained strange thread

Build:
- forum/identity rabbit hole
- changing websites/listings
- optional GoldNet
- small ambiguous escalation
- Day 14 ending

Pass:
- start-to-ending playthrough is possible in one save
- at least one optional thread may remain unresolved intentionally

---

## Milestone 13 — Art modularity and atmosphere

Improve:
- layered room
- time variants
- ambient traffic
- rain/cloudy states
- small room upgrades
- character asset slots
- OS visual polish
- website diversity

Do not lock final art direction.

---

## Milestone 14 — Verification and evaluation polish

No major new systems.

Focus:
- bug fixing
- pacing
- save reliability
- missing links
- broken Ink branches
- performance
- browser console cleanliness
- end-to-end tests
- evaluation telemetry export
- documentation of compromises

The final phase exists to produce a stable game to judge, not a bigger feature list.

---

## Acceptance Criteria and Testing

## 1. Definition of complete evaluation build

The build is complete only when a player can:

1. start a new game,
2. live through the motel opening,
3. work and earn money,
4. discover and install Pulse,
5. experience a background download while away from PC,
6. build multiple contacts,
7. install several programs,
8. face at least one compatibility block,
9. make a meaningful hardware/OS upgrade,
10. pay/deal with ordinary financial pressure,
11. explore several linked fake websites,
12. experience at least one internet rabbit hole,
13. meet a significant contact physically,
14. see the online relationship change afterward,
15. reach the Day-14 evaluation ending,
16. reload the save without losing meaningful state.

---

## 2. Critical simulation continuity

- [ ] One authoritative clock exists.
- [ ] PC and world read the same clock.
- [ ] Download progresses while browser is closed.
- [ ] Download progresses outside PC mode.
- [ ] Time jumps update downloads.
- [ ] Contact schedules update while Messenger is closed.
- [ ] Messages can arrive while player is away.
- [ ] Street/world state changes while player is using PC.
- [ ] Sleep advances all relevant systems through one path.
- [ ] Explicit pause is the only normal UI state that stops simulation.

---

## 3. Critical computer progression

- [ ] Pulse is not preinstalled.
- [ ] Software is discoverable through fake internet.
- [ ] Download creates a file.
- [ ] File can launch installer.
- [ ] Installer checks requirements.
- [ ] Install consumes disk.
- [ ] Installed program persists.
- [ ] ZipMate portable path works.
- [ ] Portable app does not appear in Add/Remove Programs.
- [ ] PhotoBox fails on starting machine.
- [ ] PhotoBox becomes compatible after appropriate upgrade.
- [ ] WeatherBuddy optional extras can be avoided.
- [ ] Bundled extras visibly affect browser/startup.
- [ ] Uninstall/cleanup can reverse them.
- [ ] Orion 6 upgrade has functional consequences.
- [ ] Internet upgrade changes real download timing.

---

## 4. Critical social progression

- [ ] Ryan has schedule-driven status.
- [ ] Maya is introduced through authored progression.
- [ ] At least four meaningful contacts exist by late game.
- [ ] Offline/new messages exist.
- [ ] No visible relationship score.
- [ ] Hidden relationship state affects authored content.
- [ ] A contact can initiate rather than always waiting for player.
- [ ] At least one conversation occurs while another system is progressing.
- [ ] Physical meeting is scheduled through game state.
- [ ] Online behavior changes after meeting.

---

## 5. Critical internet

- [ ] Fake URL routing works with no public internet.
- [ ] Search accepts free text.
- [ ] Useful search queries return curated results.
- [ ] At least 15 website/page destinations exist.
- [ ] At least two cross-site rabbit holes exist.
- [ ] Old-dated pages/posts exist.
- [ ] A website/listing can change or disappear over time.
- [ ] Download links create real download tasks.
- [ ] Different sites do not all look like one modern design system.

---

## 6. Critical world/daily life

- [ ] Motel room has PC, bed, kettle, window, travel/work.
- [ ] Window observations depend on state/history.
- [ ] Repeated street detail exists without quest UI.
- [ ] Day/evening/night change location presentation.
- [ ] Work consumes time and pays money.
- [ ] Rent creates a real decision.
- [ ] Player cannot buy every upgrade immediately.
- [ ] Missing one ideal choice does not hard-lock the game.

---

## 7. Narrative/Ink

- [ ] All Ink compiles.
- [ ] Critical knots/beats are reachable.
- [ ] Simulation values gate narrative.
- [ ] Ink effects are validated semantic actions.
- [ ] Ink does not own authoritative money/time/PC truth.
- [ ] A secret cannot be revealed before its allowed stage in canonical tests.
- [ ] Ending reachable from multiple reasonable states.
- [ ] No runtime LLM call is needed.

---

## 8. Persistence

- [ ] IndexedDB save works.
- [ ] Save contains schema version.
- [ ] Installed software restores.
- [ ] in-progress downloads restore.
- [ ] files restore.
- [ ] messages/unread restore.
- [ ] contacts/status-relevant state restores.
- [ ] relationships restore.
- [ ] OS/hardware restores.
- [ ] browser changes restore.
- [ ] narrative state restores.
- [ ] observation history restores.
- [ ] reset/new game produces canonical starting state.

---

## 9. Automated unit tests

Minimum pure-logic tests:

### Clock
- real-time conversion
- explicit time jump
- crossing midnight

### Download
- progress by elapsed minutes
- source speed cap
- connection speed cap
- resume behavior
- completion creates file

### Software
- compatibility
- disk usage
- install/uninstall
- portable app
- bundled extras

### Schedule
- online/offline at boundaries
- time jump across status changes

### Economy
- shift pay
- bill deduction
- purchase affordability
- late-payment path

### Relationship
- semantic social action changes dimensions
- no illegal over/underflow

### Save
- serialize/load round trip

### Content
- Zod validation
- reference integrity

---

## 10. Integration tests

Required:

- one time jump updates download + schedule + events
- installer writes software + files + disk state
- uninstall reverses owned browser modifications
- Orion 6 enables PhotoBox
- appointment event reads relationship/time state
- narrative effect creates valid domain action

---

## 11. Playwright end-to-end scenarios

### Scenario A — Core fantasy
- start game
- work
- find Pulse
- start download
- leave PC
- make tea
- window
- return
- verify progress
- install
- chat

### Scenario B — Software literacy
- download WeatherBuddy
- choose recommended install
- verify toolbar/homepage
- remove/clean
- verify reversal

### Scenario C — OS progression
- obtain RAM
- install Orion 6
- reboot
- run previously incompatible PhotoBox

### Scenario D — Social world
- progress to Maya
- accept appointment
- attend café
- return to PC
- observe changed follow-up dialogue

### Scenario E — Persistence
- mid-download + unread messages + upgraded PC
- reload
- verify all state

### Scenario F — Ending
- progress through canonical run
- reach Day 14 completion

---

## 12. Quality bar

- [ ] No recurring browser-console errors.
- [ ] No critical placeholder button that fakes a feature.
- [ ] No critical system exists only as UI animation.
- [ ] Text remains readable at common desktop resolutions.
- [ ] No copyrighted real OS/site interface is copied one-to-one.
- [ ] No host filesystem/network modification.
- [ ] No external API is required for core play.
- [ ] Final art style is not accidentally hardcoded into domain logic.

---

## 13. Evaluation telemetry

Keep local-only evaluation stats and allow export as JSON.

Useful fields:
- total real play time
- game days reached
- time spent in PC vs physical world
- programs installed
- downloads started/completed/failed
- number of window observations
- work shifts
- money high/low
- OS upgrade day
- contacts reached
- major narrative beats
- meeting attended/missed
- ending reached

No backend is required.

---

## 14. The questions the build must answer

After one or two complete playthroughs, the evaluator should be able to answer:

1. Do I enjoy simply being in the motel room?
2. Do I care when a contact comes online?
3. Is downloading/installing software genuinely satisfying?
4. Does leaving the PC while things continue create good rhythm?
5. Do upgrades feel materially different rather than numerical?
6. Does money create interesting priorities without becoming miserable?
7. Does the fake internet invite curiosity?
8. Does the physical world make the internet feel more real?
9. Does the internet make the physical world more interesting?
10. Do I want to know these characters better?
11. Do I want to continue after Day 14?

If several answers are "no", adding more content is not the solution.

If most answers are "yes", the concept has earned a production-quality art/narrative pass.

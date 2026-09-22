# Implementation Milestones, Acceptance, and Testing

## Implementation Milestones

This document defines a recommended build order for the complete evaluation game.

The goal is to reach an end-to-end playable build early, then deepen it.

Do not perfect one application while the rest of the game is missing.

The living-town expansion tracked by #16 and `08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` deepens the physical-world milestones without turning Away Message into an open-world traversal game.

Residence/housing progression is tracked by #85–#88 and `10-RESIDENCE-HOUSING-AND-SPACE-PROGRESSION.md`. Room 104 is not a required starting/permanent home.

---

## Milestone 1 — Foundation and authoritative simulation

Build:
- Vite + TypeScript + React
- Phaser integration
- central simulation engine
- game clock
- current Place/View switching
- Residence/Tenancy authority
- IndexedDB save/reset
- developer debug panel
- central time scale

Pass:
- current residence/PC/world show the same time
- time does not reset across views
- current-format save/load restores time/state
- `home` resolves from current residence rather than a room-number alias

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
- one residence-capability action such as tea **where the selected residence/facility supports it**
- window or another observation interaction
- street state
- schedule stub

Mandatory scenario:
1. start download
2. exit PC
3. perform a valid physical-world action
4. inspect/observe the living world
5. return
6. download advanced
7. same clock advanced all systems

Do not require a kettle/window merely because an old Room 104 fixture provided them. The proof is simulation continuity across digital and physical actions.

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
- an authored chat runs through Ink
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
- authored introduction content
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
- housing/classified discovery where useful
- first rabbit holes

Pass:
- player can discover useful content through links/search rather than a master app list

---

## Milestone 9 — Economy, housing, and first week

Build:
- work shifts
- expenses
- Residence/Tenancy cost
- initial affordable room choice
- at least one meaningful housing trade-off
- internet bill
- classifieds purchase
- Day 1–7 authored content

Pass:
- player must make at least one real money priority decision
- starting residence is not hard-coded to Room 104
- the cheapest valid room may lack private bathroom/kitchenette without causing a soft lock
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
- current-format save/load preserves upgraded system
- at-home hardware actions resolve the current capable residence/work surface rather than a Room 104 ID

---

## Milestone 11 — Physical social world and town mobility

Build:
- café / meaningful public social place
- at least one living bus stop/street place
- optional shop
- travel/time cost
- significant appointment
- physical meeting through Ink/social systems
- first district grouping over canonical places
- first authored bus line + stops + service/wait/fare truth
- shared player/NPC travel planner
- departure → in-transit → arrival continuity for at least one NPC

Pass:
- online relationship changes after real-world meeting
- physical world and digital world reference each other
- district membership does not create a separate simulation/clock/save
- player can make one local walking trip and one bus trip from authoritative simulation data
- fare/wait/arrival are not invented by React/Phaser
- one NPC can travel through the same network without teleporting at a schedule boundary

The evaluation does not require a continuous open-world city. The mature architecture is one simulated town presented through authored places, district navigation, local walking, and bus transit.

---

## Milestone 12 — Days 8–14 and contained strange thread

Build:
- forum/identity rabbit hole
- changing websites/listings
- optional GoldNet
- small ambiguous escalation
- Day 14 ending

Pass:
- start-to-ending playthrough is possible in one current-format save
- at least one optional thread may remain unresolved intentionally

---

## Milestone 13 — Residence progression, art modularity, and atmosphere

Improve/prove:
- modular current residence instead of one sacred Room 104 scene
- 3D blockout → authored camera → Gen-AI → layered Phaser production path
- residence-owned fixture slots
- player-owned decor such as a rug/lamp/poster or equivalent
- time variants
- ambient traffic
- rain/cloudy states
- better-room/rent progression
- at least one move to another residence
- at least one tiny apartment representable by the same generic Place/Space/View runtime
- character asset slots
- OS visual polish
- website diversity
- district visual identity
- living bus-stop/interior presentation where valuable

Pass:
- changing a bed/desk/decor assignment does not require a separate fully baked room permutation
- moving preserves exact player-owned item identity
- landlord-owned fixtures remain with the old property
- home/delivery/PC actions follow the new residence

Do not lock final art direction.

---

## Milestone 14 — Verification and evaluation polish

No major new systems.

Focus:
- bug fixing
- pacing
- current-format save reliability
- missing links
- broken Ink branches
- performance
- browser console cleanliness
- end-to-end tests
- evaluation telemetry export
- documentation of compromises
- removal of obsolete Room 104/home authority
- removal of duplicate legacy CityMap/transit authority after migration

The final phase exists to produce a stable game to judge, not a bigger feature list.

---

## Acceptance Criteria and Testing

## 1. Definition of complete evaluation build

The build is complete only when a player can:

1. start a new game,
2. choose/receive one of a small number of affordable valid starting residences rather than a sacred Room 104,
3. live through the motel opening,
4. work and earn money,
5. discover and install Pulse,
6. experience a background download while away from PC,
7. build multiple contacts,
8. install several programs,
9. face at least one compatibility block,
10. make a meaningful hardware/OS upgrade,
11. pay/deal with ordinary financial and housing pressure,
12. explore several linked fake websites,
13. experience at least one internet rabbit hole,
14. meet a significant contact physically,
15. see the online relationship change afterward,
16. navigate at least two known town areas/places without requiring open-world traversal,
17. use a real simulated bus trip with stop/service/wait/fare/arrival truth,
18. personalize the current residence with at least one player-owned physical belonging,
19. experience at least one meaningful residence/fixture/rent improvement,
20. move to another valid residence without losing/duplicating belongings,
21. reach the Day-14 evaluation ending,
22. reload the current-format save without losing meaningful state.

---

## 2. Critical simulation continuity

- [ ] One authoritative clock exists.
- [ ] PC and world read the same clock.
- [ ] Current Residence/Tenancy state belongs to simulation/domain truth, not Phaser/React.
- [ ] Download progresses while browser is closed.
- [ ] Download progresses outside PC mode.
- [ ] Time jumps update downloads.
- [ ] Contact schedules update while Messenger is closed.
- [ ] Messages can arrive while player is away.
- [ ] Street/world state changes while player is using PC.
- [ ] Active player/NPC travel can advance while no bus/physical scene is visible.
- [ ] Sleep and explicit time jumps advance all relevant systems through one path.
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
- [ ] PC setup/hardware management resolves a capable current residence/work surface, not Room 104.

---

## 4. Critical social progression

- [ ] At least one recurring contact has schedule-driven status.
- [ ] Authored introductions work for current evaluation content without making legacy names architectural requirements.
- [ ] At least four meaningful contacts exist by late game.
- [ ] Offline/new messages exist.
- [ ] No visible relationship score.
- [ ] Hidden relationship state affects authored content.
- [ ] A contact can initiate rather than always waiting for player.
- [ ] At least one conversation occurs while another system is progressing.
- [ ] Physical meeting is scheduled through game state.
- [ ] Online behavior changes after meeting.
- [ ] Normal cross-place NPC schedule movement can use departure/travel/arrival rather than instant location teleport.
- [ ] A transit co-location fact can prove two actors overlapped at a stop or on a bus without the renderer inventing either actor's presence.

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
- [ ] A website/job/email/address/housing listing can reveal a previously unknown physical place or transit clue without granting unrelated hidden world knowledge.

---

## 6. Critical world / residence / daily life

- [ ] `home` resolves from current Residence/Tenancy state, not `room_104`.
- [ ] Starting housing offers a bounded affordable choice or equivalent valid assignment rather than one sacred room number.
- [ ] A cheapest valid starter room may lack private bathroom and kitchenette.
- [ ] Missing residence facilities remain genuinely unavailable locally; valid shared/other facilities provide alternate paths where required.
- [ ] Current residence provides a valid sleeping path and a feasible route to required core PC functionality without magical freebies.
- [ ] Player-owned decor/belongings use exact physical item identity/location.
- [ ] Residence/landlord-owned fixtures remain distinct from player belongings and may affect rent.
- [ ] At least one fixture/room improvement visibly/behaviorally changes daily life and/or rent.
- [ ] Player can move to another valid residence without duplicating/losing owned items.
- [ ] `home`, deliveries, and at-home PC actions follow the new residence after moving.
- [ ] At least one tiny apartment can use the same generic Place/Space/View/Focus/Anchor runtime.
- [ ] Window observations depend on state/history where the current place provides such a view.
- [ ] Repeated street detail exists without quest UI.
- [ ] Day/evening/night change location presentation.
- [ ] Work consumes time and pays money.
- [ ] Rent creates a real decision.
- [ ] Player cannot buy every upgrade immediately.
- [ ] Missing one ideal choice does not hard-lock the game.
- [ ] Physical town uses stable district/place identities rather than a giant continuous open-world level.
- [ ] Districts are geographic/social groupings over one simulation, not separate clocks/saves/worlds.
- [ ] Town navigation can scale as Town → District → known Places/Stops while preserving canonical `placeId`.
- [ ] Nearby authored places can be reached through simulated walking without mandatory WASD traversal.
- [ ] At least one bus line has first-class stops, service window/headway, segment time, and fare data.
- [ ] A bus quote can include deterministic walk + wait + ride + transfer/final-walk components where applicable.
- [ ] Bus fare is charged exactly once when a trip is committed.
- [ ] Bus presentation can be skipped/compressed without changing authoritative travel duration.
- [ ] A bus stop is a physical living place rather than only a transport modal.
- [ ] A current-format active trip survives save/reload without rerouting, recharging, or early teleport.

---

## 7. Narrative/Ink

- [ ] All Ink compiles.
- [ ] Critical knots/beats are reachable.
- [ ] Simulation values gate narrative.
- [ ] Ink effects are validated semantic actions.
- [ ] Ink does not own authoritative money/time/PC/residence/transit truth.
- [ ] A secret cannot be revealed before its allowed stage in canonical tests.
- [ ] Ending reachable from multiple reasonable states.
- [ ] No runtime LLM call is required for core play.

---

## 8. Persistence

Before an explicit future save-compatibility freeze, historical development saves are disposable. Acceptance applies to **current-format** save/load correctness, not migration from every old experimental snapshot.

- [ ] IndexedDB save works.
- [ ] Save contains/obeys current compatibility/version marker.
- [ ] Incompatible historical/newer saves are refused/reset cleanly rather than silently corrupted.
- [ ] Installed software restores.
- [ ] in-progress downloads restore.
- [ ] files restore.
- [ ] messages/unread restore.
- [ ] contacts/status-relevant state restores.
- [ ] relationships restore.
- [ ] OS/hardware restores.
- [ ] current Residence/Tenancy restores.
- [ ] exact owned-item locations/restored identity are preserved for the current format.
- [ ] browser changes restore.
- [ ] narrative state restores.
- [ ] observation history restores.
- [ ] discovered/known district/place/stop/line/housing state restores.
- [ ] active player trip restores with identical itinerary/leg/arrival/fare-paid state.
- [ ] active NPC trips needed for continuity restore without duplicate arrival consequences.
- [ ] reset/new game produces canonical starting state.

No historical dev-save migration is required until a future explicit save-compatibility freeze.

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

### Residence
- current `home` resolves current residence Place
- changing residence updates `home`
- unavailable facilities do not appear as valid local capabilities
- landlord-owned fixture vs player-owned item semantics
- rent changes from authored tenancy/fixture terms
- moving preserves exact player-owned identities with no duplicates
- delivery/PC setup resolves current residence rather than room ID

### Schedule
- online/offline at boundaries
- time jump across status changes
- departure intent does not teleport a character across town
- arrival occurs only after authoritative travel duration

### Economy
- shift pay
- bill/rent deduction
- purchase affordability
- late-payment path

### Relationship
- semantic social action changes dimensions
- no illegal over/underflow

### Transit
- valid district/place/stop/line cross-references
- direct walk route
- direct one-line bus route
- one-transfer route
- wait/ride/walk totals
- last-service/no-route failure
- explicit service disruption
- stable deterministic tie-break
- fare exactly once per committed itinerary
- player/NPC callers share route truth
- current-format save/reload mid-trip
- large time jump equals incremental trip advancement
- stop/bus co-location truth

### Save
- current-format serialize/load round trip
- incompatible format is refused/reset cleanly

### Content
- Zod/semantic validation
- reference integrity
- district/place/stop/line generated content integrity
- residence capability/fixture references

---

## 10. Integration tests

Required:

- one time jump updates download + schedule + events
- installer writes software + files + disk state
- uninstall reverses owned browser modifications
- Orion 6 enables PhotoBox
- appointment event reads relationship/time state
- narrative effect creates valid domain action
- current residence drives home/delivery/PC-capability resolution
- move to another residence preserves exact belongings and updates home once
- Town → District navigation groups canonical places without changing world identity
- cross-district bus trip charges/advances exactly once and reaches expected place/time
- NPC appointment travel uses the same network and exposes real lateness if service timing causes it
- living bus-stop/interior presentation cannot mutate route/fare/arrival truth independently

---

## 11. Playwright end-to-end scenarios

### Scenario A — Core fantasy
- start game
- choose/enter affordable current residence
- work
- find Pulse
- start download
- leave PC
- perform one valid physical-world action supplied by the current place/facilities
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
- progress to a significant contact/meeting
- accept appointment
- plan/perform travel through authoritative town routing
- attend café/meeting place
- return to PC
- observe changed follow-up dialogue

### Scenario E — Residence progression
- begin in a budget room
- place one player-owned decor/belonging
- inspect/accept one better room/fixture/rent option
- move to another residence
- verify exact belongings survive
- verify `home`, delivery and PC actions now resolve the new residence
- verify old landlord-owned fixtures did not become player property

### Scenario F — Current-format persistence
- mid-download + unread messages + upgraded PC + current residence + active travel/known-town state where applicable
- reload
- verify all current-format state

### Scenario G — Ending
- progress through canonical run
- reach Day 14 completion

### Scenario H — District and bus continuity
- start in one district
- inspect/select a destination in another known district
- compare local walking/bus travel choices where available
- commit bus itinerary
- reach living stop
- board or enter bus presentation
- optionally skip ride presentation
- verify exact authoritative fare/time/arrival
- prove one scheduled NPC travels through the same network
- save/reload during an active trip in the dedicated current-format persistence test path

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
- [ ] No permanent `home -> room_104` product authority remains.
- [ ] No residence capability is invented by a room-number check or renderer.
- [ ] No stateful replaceable residence object requires combinatorial full-room background permutations.
- [ ] No bus/transit result is fabricated by presentation code.
- [ ] No normal NPC cross-place schedule transition depends on renderer visibility or direct teleport once #37 lands.
- [ ] No second transit catalog remains alongside generated TransitNetwork authority after migration cleanup.

---

## 13. Evaluation telemetry

Keep local-only evaluation stats and allow export as JSON.

Useful fields:
- total real play time
- game days reached
- time spent in PC vs physical world
- programs installed
- downloads started/completed/failed
- number of window/observation interactions
- work shifts
- money high/low
- rent paid / housing changes
- starting residence
- residence moves
- OS upgrade day
- contacts reached
- major narrative beats
- meeting attended/missed
- ending reached
- districts visited
- places discovered/visited
- walking trips
- bus trips
- bus waiting/travel time

No backend is required.

---

## 14. The questions the build must answer

After one or two complete playthroughs, the evaluator should be able to answer:

1. Do I enjoy simply being in my current residence, even when it is cheap?
2. Does improving/personalizing/moving home create satisfying material progression?
3. Do I care when a contact comes online?
4. Is downloading/installing software genuinely satisfying?
5. Does leaving the PC while things continue create good rhythm?
6. Do upgrades feel materially different rather than numerical?
7. Does money/housing create interesting priorities without becoming miserable?
8. Does the fake internet invite curiosity?
9. Does the physical world make the internet feel more real?
10. Does the internet make the physical world more interesting?
11. Does the town feel larger than the currently rendered place without needing empty open-world traversal?
12. Do districts, walking, buses, and residence location create understandable mental geography and useful time/money/social choices?
13. Do NPC movements feel believable when their schedules require travel?
14. Do I want to know these characters better?
15. Do I want to continue after Day 14?

If several answers are "no", adding more content is not the solution.

If most answers are "yes", the concept has earned a production-quality art/narrative pass.
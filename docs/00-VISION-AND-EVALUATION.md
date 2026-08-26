# Vision and Complete Evaluation Build

## Game Vision and Design Pillars

## 1. Product statement

This is a **narrative life simulation / room simulation / diegetic computer game** set in a fictionalized version of 2006.

The player does not save the world.

He lives in a cheap motel room, works a normal job, uses an old computer, browses a small and strange internet, meets people, spends money, waits for downloads, notices the street outside, and gradually turns a temporary existence into something that feels like a life.

The game combines:

- a small-scale life simulation,
- a believable fake personal computer,
- a fake mid-2000s internet,
- authored social narrative,
- systemic time and economy,
- quiet observation,
- occasional uncertainty and surprise.

The physical world exists primarily to **feed and complicate the digital world**, and the digital world leads back into physical life.

---

## 2. Emotional arc

The evaluation build must visibly move the player along these axes:

```text
isolated        → connected
broke           → getting by / stable
temporary room  → personal space
bare PC         → personal machine
slow/basic OS   → upgraded system
few contacts    → social graph
outsider        → person who recognizes patterns and people
```

These are not RPG skill bars. Most of them should be felt through the world rather than displayed numerically.

---

## 3. Pillar: the computer is a place

The in-game PC is not a menu.

It should have:

- booting,
- a desktop,
- files,
- folders,
- applications,
- installed software,
- running software,
- a browser,
- downloads,
- installers,
- storage limitations,
- compatibility requirements,
- an operating system generation,
- a later operating-system generation,
- a personal history of what the player chose to install.

The computer should become more personal over time.

By the end of the evaluation build, opening the file system or installed-program list should tell a story about the player's decisions.

---

## 4. Pillar: the internet is exploration

The fake internet is not a linear list of buttons.

The player discovers content through:

- search,
- links,
- forum posts,
- friends,
- coworkers,
- bookmarks,
- advertisements,
- classified listings,
- personal pages,
- software websites,
- email,
- obscure corners.

A strong session can begin with a practical goal and end in a completely different place.

Example:

```text
pay internet bill
→ read a local-news headline
→ search a name
→ find an old forum post
→ click a personal page
→ discover a username
→ recognize it in Messenger
```

This should feel like an old-web rabbit hole, not a modern algorithmic feed.

---

## 5. Pillar: software acquisition is progression

Useful programs are not automatically present because the game needs them.

The desired loop is:

```text
hear about program
→ find website
→ download file
→ wait
→ find file
→ run installer
→ make installation choices
→ launch
→ learn what it enables
```

Software can also create problems:

- incompatibility,
- slow performance,
- disk pressure,
- bundled toolbar,
- homepage change,
- startup load.

Computer literacy should sometimes be a real player skill.

---

## 6. Pillar: waiting creates life

A slow download is not a punishment if the player has other meaningful things to do.

The player can:

- make tea,
- shower,
- eat,
- look through the window,
- go to work,
- browse something else,
- chat with someone,
- organize files,
- leave the PC,
- sleep.

The key feeling is:

> **Waiting becomes planning, not dead time.**

---

## 7. Pillar: the world does not wait for the player

All important systems share one authoritative game clock.

While the player is away from the PC:

- downloads progress,
- contacts go online/offline,
- messages arrive,
- street state changes,
- events become eligible,
- bills approach,
- appointments can be missed,
- software tasks can complete.

While the player is inside the PC:

- the physical street still changes,
- light changes,
- people follow schedules,
- time passes.

The player should frequently return to a screen and find evidence that the world continued without him.

---

## 8. Pillar: relationships are human-readable

Do not display:

`Maya Relationship: 73/100`

The internal simulation may use hidden dimensions, but the player reads relationships through behavior:

- who initiates conversations,
- message length,
- tone,
- response delay,
- willingness to share,
- invitations,
- remembered details,
- awkwardness,
- absence,
- changed status text,
- whether a person chooses to meet.

The social graph is one of the main progression systems, but it should not look like one.

---

## 9. Pillar: not every detail is content

Repeated details can be:

- atmosphere,
- routine,
- coincidence,
- setup,
- character,
- or nothing important.

The player may repeatedly notice a man outside the motel.

That does not automatically become a quest.

The design must resist the modern-game assumption that every unusual thing is a marker.

---

## 10. Pillar: ordinary life gives the strange parts weight

The game can contain:

- mild mystery,
- uncomfortable online behavior,
- scams,
- odd websites,
- financial risks,
- unclear identities,
- suspicious coincidences.

These things work because most of the game is ordinary:

- rent,
- work,
- tea,
- a slow computer,
- a friend coming online,
- a bad download,
- a cheap café,
- a boring afternoon.

Do not make every day dramatic.

---

## 11. Tone

Primary tone:

- intimate,
- nostalgic without becoming a museum,
- slightly lonely,
- warm when social connections grow,
- occasionally funny,
- occasionally uneasy,
- grounded,
- observant.

The setting is fictionalized enough to use invented brands, histories, sites, and characters, but recognizable enough that the mid-2000s social and technological texture is immediate.

---

## 12. What the game is not

It is not:

- a Windows emulator,
- an IT simulator,
- a hacking simulator,
- a visual novel with a desktop skin,
- an open-world city,
- a 3D walking simulator,
- a job simulator,
- a romance spreadsheet,
- a horror game,
- a modern social-media simulator,
- an AI-NPC demo.

The game can borrow small pieces from these forms without becoming them.

---

## Complete Evaluation Build

## 1. Purpose

The evaluation build must be a **small complete game**, not a proof-of-concept menu and not an endless sandbox with no conclusion.

The player must be able to start a new save, live through the beginning, experience meaningful progression, reach at least one physical social meeting, upgrade the PC/OS, face ordinary financial pressure, discover several internet rabbit holes, and reach an evaluation ending.

Target:

- **14 in-game days**
- approximately **3–6 hours** for a first exploratory playthrough
- no hard requirement to see every optional event in one run
- replayable enough that a second run can produce different priorities and social outcomes

The 14-day structure is evaluation content. It is not a commitment to the length of a future commercial game.

---

## 2. Canonical starting state

### Player

- lives alone in a cheap motel room
- has a basic food-service / food-cart job
- starts with `$38`
- has very little disposable income
- has a small existing social graph
- owns a low-end PC

### PC

- fictional older operating system: `Orion OS 4.8`
- old single-core CPU tier
- `512 MB` RAM
- `40 GB` HDD
- approximately `7 GB` free
- `256 kbps` DSL

Preinstalled:

- Voyager Browser
- My Computer / file manager
- Trash
- Add/Remove Programs
- simple Notepad-like editor
- terminal
- basic system settings

Not preinstalled:

- Messenger
- download manager
- music player
- archive utility
- photo viewer/editor
- anti-spyware utility
- P2P client
- webcam utility

---

## 3. Main evaluation characters

Names and visual identities are **provisional evaluation content**. Their system roles are more important than final naming.

### Ryan

Coworker and the player's clearest existing connection.

Functions:

- introduces Pulse Messenger,
- recommends practical software,
- provides work-related context,
- demonstrates a character whose schedule is partly physical and partly online,
- can invite the player to a cheap after-work activity.

Tone:

- casual,
- practical,
- slightly teasing,
- not deeply intimate.

### Maya

New online connection who becomes the primary proof that the computer can carry emotional weight.

Functions:

- arrives through a mutual connection or online community,
- starts as a username/avatar,
- gradually shares more personal context,
- can become a close friend,
- may have mild chemistry depending on choices,
- eventually participates in a physical meeting.

The evaluation build must not require a romance route.

### Nora / `NightOwl87`

Forum regular / internet-native acquaintance.

Functions:

- introduces rabbit-hole browsing,
- shows that online identity can differ from real identity,
- connects several websites and forum threads,
- may surface a small inconsistency or mystery,
- does not need a dramatic payoff.

### Motel staff / street regulars

Small physical-world recurring presences.

Functions:

- make the room feel located in a real place,
- support window observations,
- provide mundane continuity,
- occasionally connect physical and internet information.

---

## 4. Fourteen-day structure

The structure is authored enough to guarantee progression, but several events may move within a day based on player behavior.

### Days 1–3 — The proven opening

Keep the strongest vertical-slice sequence.

Day 1:
- wake in motel
- work shift
- Ryan asks whether player uses Pulse
- find Pulse website
- download installer
- leave PC while download continues
- make tea / look out window
- install Pulse
- first Ryan chat

Day 2:
- wake to offline/new message
- discover FlashFetch
- discover RetroAmp
- meet Maya online
- attempt PhotoBox
- fail compatibility because of OS/RAM
- see first real reason to upgrade

Day 3:
- discover ZipMate installer vs portable ZIP
- encounter WeatherBuddy bundled extras
- optionally get SearchMate toolbar/homepage changes
- learn Add/Remove Programs
- repeated street observation begins to feel familiar

### Days 4–6 — The internet becomes a world

Add:
- local search engine
- city news
- classifieds
- forum / personal page rabbit hole
- used RAM listing
- larger game-demo or media download
- first meaningful disk-space pressure
- first optional technical shortcut through terminal/file knowledge

Narrative:
- Maya becomes a recurring contact rather than a one-off scene
- Nora/NightOwl87 appears through a forum
- player can search a username and find older traces
- one conversation continues while another download or task runs in background

Physical:
- unlock street/bus-stop viewpoint
- first optional short café or convenience-store visit
- room lighting and street population should visibly differ by time

### Day 7 — First pressure point

Weekly motel payment is due.

The player should have to consider money.

Possible states:
- comfortably pays,
- pays but delays a PC upgrade,
- pays late and absorbs a small fee / awkward conversation.

Do not hard-game-over the evaluation build for one missed payment.

This day tests whether the economy gives real weight to upgrades.

### Days 8–9 — Hardware and OS transition

The player should have a realistic path to:

- upgrade RAM to at least `1 GB`,
- free or increase disk capacity,
- obtain `Orion OS 6`.

The upgrade should be diegetic.

The player may:
- buy used RAM through classifieds,
- buy from TechMart,
- choose a cheaper/riskier seller,
- postpone one upgrade.

The OS installation must be a small event:
- compatibility check,
- install screen,
- restart,
- new boot screen,
- visibly newer desktop shell,
- cleaner XP-inspired visual generation while retaining the fictional OS identity.

The newer OS should not be a purely cosmetic reward.

It unlocks:
- PhotoBox,
- newer Pulse version or feature,
- optional webcam/photo functionality,
- newer browser capability.

### Day 10 — Social life crosses the screen

Maya or another close contact suggests a real-world meeting.

The player can:
- accept,
- decline,
- tentatively accept,
- delay because of work/money.

The game must translate authored dialogue choice into a deterministic appointment state.

The meeting should not require an expensive branch.

A broke player can still meet at a cheaper location or adjust the plan.

### Days 11–12 — Physical meeting and consequence

At least one important café/street meeting occurs.

The physical meeting should feel different from online chat:
- longer pauses,
- portrait/sprite staging,
- environmental context,
- fewer rapid-fire choices,
- time advances substantially.

Afterward:
- online tone can change,
- the contact may message about the meeting later,
- another character may know it happened,
- the player may see the physical location differently on return.

This is the evaluation build's clearest test of:
`online life → physical life → online consequence`.

### Day 13 — A strange but contained escalation

Introduce one event that makes the internet feel larger and less predictable.

Examples that fit the evaluation build:
- an old forum post contradicts something a person said,
- a website disappears,
- an unknown user adds the player,
- a recurring street detail aligns with an online clue,
- a classified seller behaves suspiciously,
- a digital-gold service has a sharp price move.

This event should create curiosity without turning the game into horror or a conspiracy thriller.

Not every thread must resolve.

### Day 14 — Evaluation conclusion

The player reaches a small but complete emotional/economic checkpoint.

By the end, the player should plausibly have:

- paid or dealt with two weeks of motel pressure,
- improved the PC,
- seen both OS generations or at minimum earned a clear path to the second,
- installed several chosen programs,
- built a visibly richer contact list,
- experienced one meaningful physical social event,
- discovered at least one strange internet thread,
- changed the room/computer from temporary to personal.

End with a quiet authored sequence rather than a boss fight or giant reveal.

Examples:
- return from work,
- boot the upgraded PC,
- several contacts are online,
- a download completes,
- a message arrives from the person the player now cares about,
- the street outside has its own ongoing life.

Then display:

`Evaluation Build Complete`

Allow free play afterward.

---

## 5. Required complete-game systems

The evaluation build must include working versions of:

- authoritative game clock
- day/night progression
- sleep
- work
- money
- rent/bills
- room actions
- window observations
- street state
- fake OS
- two OS generations
- storage
- RAM/CPU tiers
- internet speed
- downloads
- file records
- installers
- software compatibility
- software uninstall
- browser
- fake websites
- search
- Messenger
- email/webmail
- contacts
- schedules
- offline messages
- hidden relationship dimensions
- Ink-authored choices
- at least one outside social meeting
- save/load
- local evaluation/debug export

---

## 6. Required content quantity

Minimum recommended content for a convincing evaluation:

- 1 motel room with layered presentation
- 1 window/street view with persistent recurring details
- 3–4 additional physical locations
- 2 OS generations
- 10–12 software entries
- 15–20 fake websites/pages with cross-links
- 4–6 meaningful contacts
- several ambient handles/users
- 2 income activities
- 1 major close-relationship arc
- 1 smaller forum/internet arc
- 1 contained financial-risk mechanic
- 1 real-world meeting
- 1 evaluation ending

Quantity is subordinate to coherence.

---

## 7. Failure conditions for the evaluation

The build has failed its purpose if:

- the PC feels like a menu instead of a place,
- most useful software is already installed,
- background systems pause when hidden,
- money stops mattering after the opening,
- the player never anticipates someone coming online,
- the outside world feels unrelated to the computer,
- the story advances only through explicit scene triggers,
- the game requires external APIs to remain playable,
- the final result cannot be played from start to conclusion in one coherent save.

# Vision and Open-Ended Sandbox

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

the sandbox must visibly move the player along these axes:

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

By the end of the sandbox, opening the file system or installed-program list should tell a story about the player's decisions.

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

`Relationship: 73/100`

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

## Open-Ended Sandbox Product Direction

The game does **not** have a canonical campaign length, final day, required ending, or mandatory named social arc.

### What a save is

A save is an ongoing life in one simulated town.

The player may:
- start in any valid affordable residence offered by current content;
- work, change routines and pursue optional income;
- acquire, upgrade, repair, replace and use computers/software;
- discover websites, people, places, jobs, listings and services over time;
- build or lose relationships with a dynamic roster;
- meet people physically when truthful schedules, knowledge, location and relationship state allow it;
- move residence and carry possessions/history forward;
- continue for as long as the systems and authored/generated content remain interesting.

The game is the sandbox from the beginning and remains open-ended.

### Characters

No named NPC is required for a valid save.

Characters such as legacy authored examples may appear in current data during migration, but:
- no character is the mandatory main relationship;
- no romance or meeting is required;
- no engine API may assume one named person exists;
- any role should be resolved through role/capability/state bindings;
- the player may never meet a particular authored character and the game remains valid.

### Optional Scenarios / Story Threads

The sandbox may begin with or acquire a small number of **optional semi-baked Scenarios** that give the player personal context without defining a campaign.

Examples:
- someone from the player's past may be somewhere in town;
- a distant family connection may exist locally;
- an old debt or awkward history may resurface;
- the player may vaguely remember a place;
- a friend-of-a-friend or job lead may have influenced the move.

A Scenario is authored framing, not a mandatory quest. It binds semantic roles to compatible dynamic actors for that save. The same Scenario may bind to different people, fail to instantiate, remain unresolved indefinitely, or never become important.

The old "Maya" direction may survive only as inspiration for a generic `old_acquaintance` role. No named person, romance, reunion or outcome is required.

The first Scenario framework must work with **no dedicated quest UI**. A thread may be hidden or surface later through ordinary sandbox channels such as memory, Inner Voice, search, websites, rumor, dialogue or chance encounter.

See `13-SCENARIOS-AND-STORY-THREADS.md`.

### Progression

Progression is multi-axis and systemic rather than a fixed sequence:
- money and work;
- housing and belongings;
- computer hardware, OS and software;
- internet access and discovered information;
- relationships, memories and social history;
- town knowledge and mobility;
- routines, opportunities and obligations;
- player-created goals.

World events, schedules and authored/generated opportunities may create local arcs, but they do not form one mandatory global plot.

### Completion

There is no product-level completion gate.

Optional milestones, diagnostics, telemetry snapshots or scenario tests may exist for development, but they must never imply that a save ends after a fixed amount of time.

### Product test

The product succeeds when the sandbox remains coherent and interesting across different saves, casts, residences, routines and priorities without requiring the player to follow a predetermined script.

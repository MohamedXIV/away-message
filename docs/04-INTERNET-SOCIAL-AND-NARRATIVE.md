# Internet, Characters, Social Simulation, and Narrative

## Fake Internet and Websites

## 1. Internet design goal

The internet should feel like a collection of places created by different people and companies.

Avoid a modern unified design system.

Different sites can have:
- different navigation,
- different typography,
- different density,
- different bad decisions,
- different ad styles,
- different color palettes.

They should still be readable.

---

## 2. Fictional brands

Use fictional equivalents rather than direct copies.

Examples:
- Pulse Messenger
- Voyager Browser
- FindIt search
- MyPlace personal pages
- BidBay classifieds/auctions
- CityWire local news
- DownloadHub
- TechMart
- NightBoard forums
- GoldNet / BullionNet digital-gold service

Names can change later. The important requirement is that the world is fictional and internally consistent.

---

## 3. Browser routing

All gameplay sites are local content.

Do not use real iframes or depend on the public internet.

Example mapping:

```text
findit.local
pulsechat.local
downloadhub.local
techmart.local
bidbay.local
myplace.local
mailbox.local
nightboard.local
citywire.local
jobs.local
goldnet.local
```

The browser needs:
- address bar,
- back,
- forward,
- home,
- bookmarks/history,
- local URL resolver.

---

## 4. Search

Search is one of the game's strongest "free typing" surfaces.

The player can enter queries.

Implementation can normalize and match against a curated index.

Example query families:
- software name
- username
- local place
- news event
- PC problem
- "slow downloads"
- "Orion OS 6 requirements"
- a person's real name after learning it

Search results can change based on:
- day,
- known information,
- unlocked pages,
- website publication dates.

Do not need a full-text web search engine.

---

## 5. Required site set

### FindIt
Search engine.

### Pulse
Messenger download/support/profile pages.

### DownloadHub
Software directory.
Can surface:
- FlashFetch,
- RetroAmp,
- ZipMate,
- WeatherBuddy,
- SafeSweep.

### TechMart
New hardware/software.
Provides reliable but more expensive upgrades.

### BidBay
Classifieds/auctions.
Provides:
- used RAM,
- used HDD,
- cheap speakers,
- questionable listings,
- physical pickup opportunities.

### MyPlace
Personal social pages.
Supports:
- profile,
- comments,
- photos,
- links,
- music/status flavor.

### Mailbox
Webmail.
Supports:
- inbox,
- unread state,
- simple reply,
- attachments.

### NightBoard
Small forum.
Supports:
- threads,
- handles,
- dates,
- signatures,
- links,
- old posts.

### CityWire
Local news.
Provides:
- ordinary news,
- event context,
- physical-world references.

### Jobs
Small local job board.
Can expose:
- current job details,
- optional second income activity.

### GoldNet / BullionNet
Fictional digital-gold service.
Purpose:
- small optional financial risk,
- period-authentic online-money flavor,
- systemic story generation.

Keep it simple:
- deposit limited cash,
- exchange rate changes by authored/seeded events,
- no deep trading simulation.

---

## 6. Internet rabbit holes

At least two authored rabbit holes should exist.

### Rabbit hole A — software
Forum complaint
→ recommendation
→ DownloadHub
→ software site
→ utility unlock

### Rabbit hole B — identity
Username
→ old forum post
→ personal page
→ city reference
→ recognition of a person/place

The player should be able to discover optional context before a character directly explains it.

---

## 7. Old content matters

Pages can have dates from:
- 2002
- 2003
- 2004
- 2005
- current 2006

An old post can matter later.

This creates the feeling that the internet existed before the player opened the game.

---

## 8. Profiles and photos

Do not reveal every major character immediately through perfect art.

A person can initially be represented by:
- 96×96 avatar,
- username,
- status line.

Later:
- profile photo,
- webcam shot,
- emailed JPEG,
- physical-world sprite/portrait.

This creates discovery and supports period authenticity.

---

## 9. Period media treatment

In-world digital photos may intentionally use:
- small resolution,
- JPEG compression,
- harsh flash,
- imperfect white balance,
- cheap webcam quality.

These are content representations, not final master character art.

---

## 10. Downloads as website actions

A download link should create a real simulated download task.

Do not fake:
- instant download followed by a decorative bar.

The site initiates a domain action:
`startDownload(fileId, sourceId)`

The simulation owns progress.

---

## 11. Website changes over time

Some pages should update as sandbox time and world state advance:
- software version release,
- forum thread gains replies,
- classified listing disappears,
- local news changes,
- profile status changes,
- GoldNet rate/news changes.

A website may also disappear or return an error as an authored event.

---

## 12. Modern patterns to avoid

Avoid:
- infinite algorithmic feed,
- giant mobile-first cards,
- floating rounded SaaS panels,
- modern emoji-heavy chat bubbles,
- current social media "stories",
- uniform design across all sites.

The fake internet should feel fragmented, hand-made, commercial, messy, and personal.

---

## Characters, Social Simulation, and Narrative — OPEN-ENDED SANDBOX

## 1. Narrative philosophy

There is no mandatory global story arc.

Characters live in the same simulated town, maintain relationships and memories, follow governed routines/intents, and may create local stories through truthful state. AI may phrase dialogue, but rules own facts, knowledge, timing and consequences.

No named person is required. Legacy authored names may remain as ordinary content while migration continues.

## 2. World ownership

Simulation/domain systems own:
- world events and knowledge;
- relationships, memories and promises;
- schedules, obligations and CharacterIntent;
- physical location, transit and appointments;
- money, items and ownership.

AI owns only bounded surface text within approved context.

## 3. Dynamic character model

Characters are data-driven actors with:
- stable identity for that save;
- archetype/temperament;
- roles/capabilities;
- schedule/routine pressure;
- local or remote reach;
- relationships and memories;
- knowledge/disclosure state;
- physical/device/online presence;
- optional art/presentation profile.

The product must remain valid when any legacy authored actor is absent.

## 4. Hidden relationship dimensions

Relationship state remains multidimensional and hidden from the player.

Useful dimensions include familiarity, trust, comfort, respect, annoyance, affection, attraction, suspicion and resentment where implemented.

UI should communicate these through behavior, tone, availability and remembered history rather than a visible score.

## 5. Messenger conversation UX

Pulse is one surface into the same person.

A contact can:
- be online, away or offline from truthful presence/device state;
- initiate conversation;
- send messages while the player is elsewhere;
- remember relevant exchanges;
- share links, places or people subject to knowledge rules;
- react differently as relationships evolve.

## 6. Typing style and AI

Typing style/persona may vary by actor.

AI output must:
- use only allowed knowledge;
- never invent canonical state changes;
- pass schema validation;
- degrade to bounded template fallback on failure;
- never make a specific authored NPC necessary for progression.

## 7. Schedules and Life Matrix

Schedules create pressure and intent, not scripted beats.

Characters may prepare, depart, travel, work, rest, socialize, shop or pursue goals according to authoritative systems. Local encounters become possible when actors truthfully overlap in place/time and their state permits interaction.

## 8. Messages while away

The player can miss messages and return later. Conversation continuity, unread state and memories survive UI closure and time advancement.

## 9. Emergent social encounters

Physical meetings are optional sandbox events, not campaign checkpoints.

An encounter may arise from:
- an appointment created by either party;
- work or venue overlap;
- local friendship/relationship state;
- shared transit;
- a discovered event/place;
- chance bounded by deterministic/seeded rules.

No café, romance, character or day is mandatory.

## 10. Secrets and knowledge

Separate:
- world facts;
- actor knowledge;
- player knowledge;
- willingness to disclose.

AI and UI must not expose a fact merely because it exists globally.

## 11. Imperfect memory

Small designed or systemic memory imperfections may exist, but major continuity should remain coherent and explainable.

## 12. Narrative uncertainty

The sandbox may contain clear payoffs, ambiguous details and mundane recurring life without forcing every thread to resolve.

The goal is a town that feels larger than any one save's discovered content—not a fixed story that all saves must complete.

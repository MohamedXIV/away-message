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

Some pages should update across the 14 days:
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

## Characters, Social Simulation, and Narrative — SANDBOX UPDATE (AI-heavy)

> **Deprecated:** Sections 1, 2, 10, 11, 12 in this file describe the old Ink deterministic model. The game is now a **sandbox AI experiment**: Ink beats are removed; `src/engine/WorldEventsEngine.ts` owns global events and every NPC's shared knowledge bank; all chat is via `src/ai/service.ts` with `worldKnowledge` injection. This doc is kept for historical reference; see `PROJECT.md` and `AI_LAB.md`.

## 1. Narrative philosophy (sandbox)

The game now uses **sandbox generative dialogue grounded by world state**, not authored Ink beats.

The player can still trust that:
- relationship changes via closed `socialAction` enum applied deterministically (`SocialEngine.applySocialAction()`),
- world events are shared identically to all NPCs via `WorldEventsEngine.getKnowledgeContext(day)`,
- contradictions are now emergent from AI memory/context, not authored branches.

AI is now **runtime-core**, not dev-only.

---

## 2. World ownership (sandbox — replaces Ink)

WorldEventsEngine owns:
- global event catalog and trigger timing (`GLOBAL_EVENTS_CATALOG`, `checkAndTriggerEvents`),
- world flags and appointment scheduling,
- knowledge bank exposed to AI (`getKnowledgeContext`).

AI owns:
- surface dialogue text within those world constraints.

TypeScript simulation still owns:
- money, time, PC hardware, downloads, schedules, installed software, authoritative relationship values, world truth.

---

## 3. Character model

A meaningful character should have structured state.

Suggested domains:

```text
Identity
- name
- handles
- age
- job
- known locations

Communication
- typical message length
- capitalization
- emoticons
- abbreviations
- typing speed
- response-delay pattern

Schedule
- work
- online windows
- physical availability

Relationship
- familiarity
- trust
- comfort
- respect
- annoyance
- optional attraction

Knowledge
- facts the character knows

Beliefs
- things the character thinks are true

Disclosure
- facts the character is willing to reveal

Story
- arc stage
- event flags
```

Not every NPC needs all fields.

---

## 4. Hidden relationship dimensions

Do not use one `relationshipScore`.

Recommended hidden dimensions:
- familiarity
- trust
- comfort
- respect
- annoyance
- attraction (only where relevant)

Values should change through deterministic semantic actions.

Example:

```text
Player choice tagged:
social_action=remembered_detail
target=maya

Simulation:
+ familiarity
+ comfort
possible + trust
```

Ink should not directly write arbitrary numeric deltas.

---

## 5. Player-facing relationship feedback

The player reads state through:

- contact starts conversation,
- contact stays online to keep talking,
- longer/shorter replies,
- teasing changes,
- more personal topics,
- sharing real name,
- sharing a photo,
- inviting player out,
- silence after a bad interaction,
- changed profile/status.

No hearts. No percentage.

---

## 6. Messenger conversation UX

Period-inspired, not a modern chat app.

Contact list:
- handle/display name
- online / away / busy / offline
- status line
- unread marker

Conversation:
- compact log
- timestamps where useful
- typing indicator
- authored choices
- optional player "typing animation" after choosing a line

The player selects meaning, then the selected message can appear to be typed before sending.

Free typing remains available in:
- search,
- terminal,
- filenames/usernames,
- selected forms,
not general story dialogue.

---

## 7. Typing style as characterization

Each major character should be recognizable through text.

Examples of differentiators:
- `yeah lol`
- `Hahaha, no way :D`
- `ye`
- multi-message bursts
- paragraphs
- correct punctuation
- all lowercase
- frequent `brb`
- sends `?` after waiting

Avoid making everyone sound like the same writer.

---

## 8. Schedules

Characters exist outside active conversations.

A schedule can include:
- work,
- commute,
- online,
- away,
- sleep,
- meeting.

Status must update whether Messenger is visible or not.

A character can go offline mid-conversation because the schedule or authored event says so.

That can be meaningful.

---

## 9. Messages while away

The player can return to:
- offline message,
- new email,
- changed status,
- profile update,
- missed invitation.

The world should not wait for the player to open Messenger.

---

## 10. Narrative beats — DEPRECATED (sandbox)

Beats are removed. Sandbox uses global events instead:

```text
GlobalEvent: MyPlace v2 launch

Trigger:
- day 3, 14:00

Knowledge injected to all NPCs:
- "MyPlace just relaunched as v2 with profile songs and Top 8"

Outcome:
- NPCs may reference it naturally when relevant; no scripted branch.
```

---

## 11. Major evaluation arc

### Ryan
Arc:
coworker → practical online friend → physical/social bridge

### Maya
Arc:
unknown contact → recurring conversation → personal disclosure → invitation/meeting → changed online relationship after meeting

### Nora / NightOwl87
Arc:
forum handle → rabbit-hole guide → person with partial/uncertain identity → small unresolved thread

The build should conclude these evaluation arcs enough to feel intentional without pretending to be the final commercial story.

---

## 12. Physical meetings

A meeting must:
- be scheduled in simulation,
- consume time,
- occur at a location,
- use authored Ink content,
- read hidden relationship state,
- write semantic consequences back to simulation.

After the meeting, the online relationship should visibly change.

---

## 13. Secrets and knowledge

Separate:
- world facts,
- character knowledge,
- character disclosure.

A character can know a fact without being willing to tell the player.

The narrative adapter should only expose to Ink what the current beat is allowed to use.

This prevents accidental early reveals.

---

## 14. Imperfect memory

The evaluation build may include a very small amount of designed imperfect memory.

Example:
- character remembers approximate date incorrectly,
- player corrects them,
- correction becomes state.

Do not use randomness to make major continuity unreliable.

---

## 15. Narrative uncertainty

Some strange details should remain unresolved.

The evaluation build should contain:
- at least one clear authored payoff,
- at least one ambiguous detail,
- at least one mundane repeated detail that never becomes a quest.

This preserves the feeling that the world is larger than the authored plot.

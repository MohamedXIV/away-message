# Changelog

All notable changes to Away Message are documented here, in plain player language.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Game versions use SemVer (`0.x.y` while in demo); save *format* versions are tracked separately — see `src/persistence/slots.ts`.

## [Unreleased]

### Added
- Modular PC Hardware & Silicon & Spares: fresh starts begin on Day 1 with an empty motel desk; visit Milo's Silicon & Spares downtown (Tech Mart) to buy starter towers, RAM sticks, larger hard drives, CRT/LCD monitors, or boxed OS install discs
- Authentic Retro OS Setup Wizard: insert retail OS CD boxes and launch SETUP.EXE with hardware eligibility checks, simulated optical drive/hard drive chatter, BIOS reboot sequence, and era-specific splash screens
- Generational OS Atmosphere: Orion 4.8 Harbor, 5.0 Aurora, 6.0 Glassline, and 7.0 Lumen dynamically reshape window frames, period typography (MS Sans Serif, Tahoma, Trebuchet MS, Segoe UI), window movement sound effects, and Web Audio startup chimes without code duplication
- Buddies feel like themselves now: Maya is shy-guarded, Ryan is forward-warm, and every newcomer gets a fixed temperament that shapes how they talk and act (old saves carry over automatically)
- Buddies live their own lives: they hang out with each other around town, keep weekly plans, say a quick goodbye when work or sleep calls, and you will hear about it
- Buddies can ask you to introduce them to someone, put in a good word, or tell them about a friend — help them, ignore them, or talk behind their back, but if the two compare notes they will both know
- Buddies can quietly crush, start seeing each other, or split up — and they will answer honestly if you ask whether they are with someone
- Shy buddies rarely message first — and often just buzz you instead of typing
- New visible social battery meter: talking, flirting and going out spend it, sleep and solitude repay it — bold talk out of character costs big, and landing badly can empty the whole bar until you apologize
- Reply suggestions are colour-coded by tone (warm green, romantic pink, cold blue) with their battery price on each chip
- Pulse 6.0: buddies tint their own names in chat and use animated emoticons (upgrade to feel it)
- Buddies form their own reads of you: quiet types seem distant until kept promises prove otherwise — and comparing notes aligns their views (cold reads get fewer check-ins, the distrusted get no favors)

### Changed
- Save format v5 introduced the legacy modular-hardware snapshot used by the first Silicon & Spares implementation.
- Save format v6 separates owned physical inventory, assembled computer state, display state, and the nullable installed OS. v2–v5 document saves migrate deterministically: existing working PCs preserve equivalent machine/display/OS state, while no-PC saves no longer fabricate Orion 4.8, RAM, disk, or network hardware.

## [0.1.0] — Itch demo foundation

First playable public build. A full sandbox life-sim with no ending — just Room 104, Oakhaven, and dial-up.

### Added
- Free AI chat with Maya, Ryan, Nora and Henderson (works offline with fallback lines, or with your own Gemini/Groq/OpenRouter key)
- NPCs remember everything: promises, long-term memories, shared photos, relationship stages
- NPCs message you first, gossip about each other, fight, go distant — and sometimes return
- In-person café dates, job board with delayed replies, work shifts and side gigs
- Body needs (hunger, sleep debt, health), living weather, city outings with encounters
- Oakhaven city map with walk/bus travel, street encounters and place hours
- MyPlace profiles with live Top 8s and guestbooks, NightBoard threads, mailbox chains
- Main menu (Continue / New Game / slots / How to Play / AI key), 3 save slots + autosave
- In-game Save / Load window (Start menu → Save / Load Game)

### Fixed
- Pulse profile infinite-update loop on buddy click
- Away-message history duplicates stacking in the feed
- Random unrelated link spam (links are topical-only now)
- Double-charging room noodles ($2 UI + $3 engine)
- Save snapshots going stale behind the state cache
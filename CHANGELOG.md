# Changelog

All notable changes to Away Message are documented here, in plain player language.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Game versions use SemVer (`0.x.y` while in demo); save *format* versions are tracked separately — see `src/persistence/slots.ts`.

## [Unreleased]

### Added
- Buddies feel like themselves now: Maya is shy-guarded, Ryan is forward-warm, and every newcomer gets a fixed temperament that shapes how they talk and act (old saves carry over automatically)
- Buddies live their own lives: they hang out with each other around town, keep weekly plans, say a quick goodbye when work or sleep calls, and you will hear about it
- Buddies can ask you to introduce them to someone, put in a good word, or tell them about a friend — help them, ignore them, or talk behind their back, but if the two compare notes they will both know
- Buddies can quietly crush, start seeing each other, or split up — and they will answer honestly if you ask whether they are with someone
- Shy buddies rarely message first — and often just buzz you instead of typing

### Changed
- Save format v4 (v2/v3 saves upgrade on load; newer-than-current saves are still refused)

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

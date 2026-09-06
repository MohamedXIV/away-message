# Changelog

All notable changes to Away Message are documented here, in plain player language.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Game versions use SemVer (`0.x.y` while in demo); save *format* versions are tracked separately — see `src/persistence/slots.ts`.

## [Unreleased]

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

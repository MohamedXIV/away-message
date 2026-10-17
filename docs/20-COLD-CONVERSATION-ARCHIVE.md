# #173 — Slot-scoped cold conversation archive

Tracking: [#173](https://github.com/MohamedXIV/away-message/issues/173),
stacked [PR #196](https://github.com/MohamedXIV/away-message/pull/196) above #172.

## What this milestone actually implements

The current-format `saveSlot` transaction now stores the **last 32 messages per
conversation** inside the save document and writes older messages as ordered
**64-message IndexedDB archive pages**, scoped by `slotId` and
`conversationId`. Pages use an isolated `conversation_pages` Dexie table
(v5 table schema, not the legacy global `messages` table). The save's
`meta.conversationArchive` contains only the archive version and per-contact
**cold message counts**. There is exactly one durable copy of any message:
recent messages live in the slot document, older ones live in its archive.

On explicit `loadSlotSnapshot`, the whole canonical current-format snapshot
is reassembled **inside one read transaction** before handing it to the
synchronous composed `SimulationKernel`. This is deliberately not ordinary
UI publication. A separate `readSavedConversationPage` selects at most the
necessary cold page(s) plus the small saved tail, preserving the existing
newest-offset and chronological-display ordering even if messages have
out-of-order world timestamps.

Overwriting or deleting a slot updates its document and archived pages in
one write transaction. Missing, extra or malformed archive pages **fail the
load closed** instead of silently manufacturing a truncated social history.
Old complete snapshots without the archive marker still load normally.
`social.getConversationPage`, source-owned unread indexes and legacy
`SocialEngineState` runtime shape are unchanged.

## Limits / acceptance boundary

- The archive is **durable cold save storage** and supports targeted async
  saved-history pages. It does **not** yet turn the live game into an async
  page-backed social runtime: `ConversationHistory` still owns complete
  transcripts in memory after a load, and an explicit export gathers them.
- The production chat UI still consumes the already-bounded
  `SimulationKernel.getConversationRead` owner query; it does not reach into
  another slot's archive. A future Worker-hosted async chat storage interface
  must preserve this privacy/authority boundary.
- `db.messages` and the old multi-table `SaveManager` remain historical
  persistence architecture, to be reconciled under **#174**. This work does
  not make the old shared messages table a second writer.
- No deterministic ID policy or historical migration reset is introduced
  here; **#174** owns those decisions.
- No benchmark claim that full simulation ticks are constant-time follows
  from paged durable save storage. Use #177 for integrated stress.

## Proof obligations

`SimulationColdConversationArchive.test.ts` covers 64-page rollover,
chronological ordering under backdated arrivals, detachable recent/page
projections, exact reconstruction of saved history, per-slot independence,
overwrite/delete cleanup, broken-page fail-closed loading, and full-snapshot
compatibility without an archive manifest.

Do not mark #173 complete on this milestone alone: live history lifecycle and
remaining relationship/graph/presence owner decomposition need explicit closure
evidence before a Ready/merge decision.

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

## Incremental cold-runtime bootstrap contract (not yet production boot)

A cold bootstrap seam is now available via `loadSlotColdBootstrap(slotId)`. Each
new save persists **small owner-derived indexes** from `ConversationHistory`
inside the existing v1 `meta.conversationArchive` manifest: unread totals,
last activity, player-day presence, latest offline-message text, and at most
10 unread previews per contact. The archive page *keys* are inventoried under
a read transaction without retrieving the messages. A missing or extraneous
page key, malformed metadata, or absent index fails closed. Historical pages
are still verified when `readSavedConversationPage` requests them. Legacy v1
manifests without indexes can still use `loadSlotSnapshot` (the eager path).

**Safety boundary:** cold bootstrap returns a **partial conversation snapshot**
plus the index metadata. It is explicitly **not** used by the production boot
until the single Social owner can attach the cold source, merge new messages
and read receipts, and asynchronously export complete history on save. Passing
the bootstrap snapshot directly to the synchronous kernel would truncate
history and is forbidden. The new tests prove the bootstrap avoids historical
message-body fetches; they do not claim that live game loads do so yet.

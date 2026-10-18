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

## Incremental cold-runtime bootstrap contract

A cold bootstrap seam is now available via `loadSlotColdBootstrap(slotId)`. Each
new save persists **small owner-derived indexes** from `ConversationHistory`
inside the existing v1 `meta.conversationArchive` manifest: unread totals,
last activity, player-day presence, latest offline-message text, and at most
10 unread previews per contact. The archive page *keys* are inventoried under
a read transaction without retrieving the messages. A missing or extraneous
page key, malformed metadata, or absent index fails closed. Historical pages
are still verified when `readSavedConversationPage` requests them. Legacy v1
manifests without indexes can still use `loadSlotSnapshot` (the eager path).

### Attached read-only cold runtime seam

`ConversationHistory.restoreCold` can attach the saved cold prefix to its
**one canonical message owner** without allocating old transcript bodies.
`pageAsync` reads only intersecting 64-message pages, enforces detached reads,
and merges post-load appends with the saved tail. All read receipts remain
owned by ConversationHistory; `markRead` marks the immutable cold prefix
through a single overlay, and `exportAllAsync` composes a complete snapshot
without mutating the slot. A synchronous full export or an unmaterialized cold
page read **throws** rather than returning a truncated history.

`readSavedColdConversationChunk` validates the page under the recorded
`updatedAt` save generation; slot overwrites increment the generation
monotonically and invalidate old readers. `SimulationKernel.getConversationReadAsync`
retains the known-handle privacy gate, including after the await.

The production boot still uses the eager `loadSlotSnapshot` path.
However, `saveSlot` now selects `SimulationKernel.exportSnapshotAsync()` when
available: this explicit export awaits complete old pages, rejects changed
simulation revisions/failed pages, and writes the complete snapshot plus
64-message pages in one atomic transaction. The transaction derives the
monotonic slot generation inside its write lock. When a cold-backed engine
writes **its originating slot**, its live cold reader rebinds to that new
generation without hydrating the old message-object graph. A save to another
slot leaves the source reader unchanged. The Pulse **Save log** action also
uses async complete-history export and reports read failures.

`SimulationColdAsyncSlotSave.test.ts` verifies save→load parity, appended
messages and read receipts, original-slot rebind, page-count growth and
fail-closed saves. `SimulationColdAttachedHistory.test.ts` also verifies that
saving a cold-backed game to a second slot produces a full transcript while
an independent overwrite of its **source** slot still invalidates the old
reader.

### Production cutover (#173)

The live App boot path now calls `loadSlotEngine(slotId)`. When the slot has
a validated cold index and complete archive-page key inventory, this creates the
single composed SimulationKernel from the saved recent tails and attaches the
same SocialEngine's `ConversationHistory` to an immutable slot-scoped, generation-
guarded page reader **before publishing the engine to Zustand/React**. It then
rechecks the source slot version; invalid/missing archives refuse boot. Existing
index-free v1 archives retain a complete eager `loadSlotSnapshot` fallback, never
a partial-history fallback. The initial boot loads zero historical page values.

`ChatWindow` uses `useConversationPage` / `getConversationReadAsync` for its
visible 50-message pages, while newest eight-message suggestions still use a
small synchronous owner-backed page. The hook drops cancelled, old actor/offset,
old engine and stale-revision results. A failed page shows Retry rather than a
truncated transcript; log export uses an independently authorized async path.
Real browser proof is `ScenarioH_PulseColdPaging.spec.ts`, running against
IndexedDB, the production loader and the mounted React ChatWindow.

The pre-save-format-freeze legacy path remains only for complete index-free
snapshots; future #174 owns unrelated old persistence cleanup. A future Worker
transport remains #175's responsibility.

**Safety boundary:** cold bootstrap returns a **partial conversation snapshot**
plus the index metadata. It is explicitly **not** used by the production boot
until the normal boot path attaches the single Social owner to its validated
slot-bound cold reader and routes older Pulse pages through async projections.
Passing the bootstrap snapshot directly to the synchronous kernel without
that attachment would truncate history and is forbidden. The new tests prove
that a **test-owned attachment** supports complete async saves and reads;
they do not claim production boot or Pulse older-page UI has been switched.

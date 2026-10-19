# #173 — Canonical Social ownership and cold conversation persistence

Tracking: [Issue #173](https://github.com/MohamedXIV/away-message/issues/173),
stacked [Draft PR #196](https://github.com/MohamedXIV/away-message/pull/196) on #172.
This document describes the **implemented production path**, not the intermediate
cold-bootstrap spikes. No Ready transition, merge or issue closure is implied.

## Authority and storage contract

- `SocialEngine` remains the sole public mutation/event coordinator. Internal
  `ConversationHistory` owns **all canonical chat writes, read receipts,
  summary indexes and live history**. Roster, player relationships, sparse
  NPC bonds, presence, memory/promises, contact directory, mediations and
  player-belief projections have distinct private domain owners.
- The live owner retains at most **32 recent + 63 pending** materialized
  message objects per conversation; completed local older groups are serialized.
  After a cold save boots, older saved messages are not allocated into a
  parallel live message graph: one immutable slot-scoped archive supplies them.
- An explicit `saveSlot` stores the **32 newest** messages/contact in the v6
  save document and all earlier messages in **64-message** IndexedDB
  `conversation_pages`. Its v1 archive manifest carries exact cold counts
  and compact *derived from ConversationHistory* unread/last-activity/player-day/
  offline-message indexes and up to 10 unread previews. The historical global
  `db.messages` table is **not** a second writer.
- Archive pages and the save document are overwritten/deleted in **one Dexie
  transaction**. The generation token `updatedAt` advances inside the write
  transaction even when writes occur in the same millisecond. A reader of a
  different save generation fails closed. Unread overlays on immutable saved
  pages remain owned by ConversationHistory and are exported into the next save.

## Actual production boot

`App.tsx` uses `loadSlotEngine(slotId)`, not eager
`loadSlotSnapshot(slotId)`, for an indexed cold archive:

1. `loadSlotColdBootstrap` reads the saved **recent tails + derived indexes**
   and inventories expected archive **keys** in one transaction. It loads no
   historical message bodies. Missing/extra page keys and bad metadata reject
   the bootstrap.
2. A single `SimulationKernel` is constructed from the matching partial
   snapshot, then `SocialEngine.attachColdConversations` attaches its **existing**
   ConversationHistory to the slot-specific, generation-checked page reader.
   No partially restored engine is exposed to the React store.
3. The saved slot generation is checked again after construction. If it changed,
   the boot is refused. Each subsequent cold-page read independently checks
   the source generation and validates content/page size.
4. An **index-free older full save** uses `loadSlotSnapshot`, which atomically
   reassembles complete history before constructing the kernel. This is a
   compatibility fallback, *never* permission to boot a partial archive.

**Integrity limit:** cold boot inventories keys without reading historical
values, so damaged page *contents* may be discovered only when the page is
requested/exported. Such reads throw or surface an error; they never present
truncated history as complete.

## UI, privacy and save contract

- `ChatWindow` requests 50-message historical pages through
  `useConversationPage` → `SimulationKernel.getConversationReadAsync`.
  Page queries are bounded, detachable and authorized by the **player-known
  handle** rule, including a second authorization/revision check after awaits.
  The hook cancels stale actor/tab/offset/engine/revision results; the UI shows
  loading, Retry or an error instead of quietly omitting cold messages.
- The latest eight messages needed for reply suggestions still use a bounded
  synchronous hot owner projection. No normal page load or revision publishes
  a full Social transcript/world snapshot. Only explicit exports load all
  historical bodies.
- `MessageHistoryView` Save Log uses the distinct
  `SimulationKernel.getConversationLogAsync` API, enforcing the same
  known-handle and revision policy. Failed exports do not create partial logs.
- `SimulationKernel.exportSnapshotAsync` obtains complete conversations
  from the canonical Social owner, then composes the other owners' save state.
  If the world changes during the await or any cold page is unreadable,
  the operation throws and `saveSlot` writes nothing. Synchronous full
  export deliberately **throws** on attached, unmaterialized cold history.
- Saving over the cold reader's **originating slot** atomically persists all
  history and rebinds that owner's immutable prefix to the new generation
  without duplicating appended turns. Saving to another slot leaves the
  source reader bound to its original generation.

## Acceptance evidence

- `SimulationSocialConversationOwner.test.ts`,
  `SimulationColdConversationArchive.test.ts`,
  `SimulationColdBootstrapIndex.test.ts`,
  `SimulationColdAttachedHistory.test.ts`,
  `SimulationColdLiveConversationOwner.test.ts`,
  `SimulationColdAsyncSlotSave.test.ts`,
  `SimulationProductionColdBoot.test.ts` cover one-writer invariants, bounded
  hot pages, read/index parity, key-only bootstrap, source slot generation,
  full async save/reload, unread overlays, source isolation, corrupt-page
  refusal, old index-free fallback and player-knowledge safety.
- `ScenarioG_PulsePaging.spec.ts` and
  `ScenarioH_PulseColdPaging.spec.ts` use the **mounted real React ChatWindow
  in Chromium**. Scenario H loads a 200-message saved cold archive via the
  production loader, browses older/newer pages, verifies full Save Log,
  re-saves/reloads through the same persistence path and checks unknown-contact
  privacy.
- [Exact-head Verify #39161890697](https://github.com/MohamedXIV/away-message/actions/runs/39161890697)
  succeeded on implementation commit `44c8273`: content check, typecheck,
  build, baseline guard, **312/312 files and 1,794/1,794 tests**, living-world
  Chromium **6/6**, Pulse normal paging **1/1**, Pulse cold paging **1/1**.
  The population and publication benchmarks were **skipped by the workflow**
  on this stacked branch, not verified. A separate Vercel status reported failure.

## Boundaries and follow-ons

- **#174** owns deterministic ID and obsolete persistence cleanup;
  older multi-table `SaveManager` and `db.messages` are not hot authorities.
- **#175** owns actual Dedicated Worker hosting and transport/recovery;
  this work only establishes serialization- and async-friendly contracts.
- **#177** owns integrated deterministic 20/100/250/500 actor benchmarks and
  long-running gameplay/performance acceptance; this PR does **not** claim FPS
  or constant-time full simulation ticks.
- PR #196 remains **Draft** and issue #173 **Open** pending review/explicit
  merge authorization and any acceptance gap a reviewer substantiates.

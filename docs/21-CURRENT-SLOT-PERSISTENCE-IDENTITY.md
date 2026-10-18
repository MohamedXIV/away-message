# #174 — Current-format persistence and deterministic identity (incremental)

Tracking: [Issue #174](https://github.com/MohamedXIV/away-message/issues/174);
stacked [Draft PR #201](https://github.com/MohamedXIV/away-message/pull/201)
on #173 / PR #196 (and #172 / PR #195). No save-compatibility freeze.

## Implemented, not merely proposed

1. **Canonical Social message identities:** `SocialEngine.sendMessage` requests
   IDs from its existing single `ConversationHistory` owner. Each ID encodes
   the canonical conversation key and **the ordinal of the next message across
   the entire conversation history**. It does not depend on `Date.now()`,
   `Math.random()`, renderer frame timing or how many old message bodies are
   currently materialized. The ID is identical under replay with the same
   canonical message sequence, and distinct for duplicate same-minute messages
   or interleaved contacts. The recorded count includes immutable archived cold
   pages, so after save → cold boot → re-save no second persisted allocator
   or schema change is needed. Existing saved IDs are not rewritten.
2. **Remove the dead competing writer:** the legacy `SaveManager.ts`
   multi-table save/load implementation has been deleted. Real production and
   integration tests use `slots.ts` / `loadSlotEngine`, which persist a v6
   slot document and one generation-guarded, per-slot cold archive.
3. **Preserve adversarial behavior tests:** tests formerly operating on the
   unused multi-table writer have been moved onto the actual save contract:
   repeated 100-cycle save/load, 25 simultaneous distinct slots, DownloadTask
   progress, repeated open-ended world-time advancement, corruption/missing archive pages and
   invalid indexes, atomic transaction rollback, 500 VFS files and 500
   historical messages. Independent software-installation/adware gates remain
   unchanged. No game invariant test was silently removed to retire old code.

4. **Retire the obsolete v5 writer and migration chain:** delete
   `slotsV5Core.ts` and its duplicate v5 `saveSlot/loadSlotSnapshot`.
   Preserve only active menu/boot/slot-selection helpers in a narrow
   `slotUi.ts`. The one `slots.ts` reader now checks the current v6
   document version and validates cold pages; earlier development snapshots
   are refused by policy rather than upgraded by v4→v5→v6 runtime chains.
   UI metadata and Pulse local-storage attachment remain non-authoritative.

5. **Remove unused table-row migration runners:** the old exported
   `schemaV5Core.MIGRATIONS` schema-row patch engine was not invoked by
   `AwayMessageDB`. It is removed; Dexie's real versioned schema upgrade
   history is still declared in `db.ts` and retained to open existing
   IndexedDB databases. Character Lives now tests current-format canonical
   traits/bonds rather than relying on a retired v3 loader.

6. **Collapse the v5 schema facade:** `schema.ts` now directly owns the
   v6 Zod save validator, current save-record and the type-only historical
   table definitions required by Dexie's frozen upgrade history. No v5
   schema file survives. Null connection/OS represent a valid no-PC save;
   the active writer never loads historical migration blobs.

## Verified contract and limits

- PR branch remains stacked, Draft and unmerged. #174 stays open.
- `schema.ts` now owns one v6 document schema plus the type-only
  historical table records required by `db.ts`. Dexie's v1–v5 upgrade
  declarations remain, especially the v5 `conversation_pages` table.
  Retiring physical stores requires a separate usage/upgrade audit; none
  is a second active simulation writer.
- **#174 deterministic VFS/Downloads identity cutover:** Both
  `FileSystemEngine` and `DownloadManager` now allocate IDs from monotonic,
  owner-held ordinals. `VirtualFileSystemState.nextFileOrdinal` and
  `SimulationState.downloadNextOrdinal` checkpoint those ordinals in the
  existing canonical slot document. File deletion, trash operations, and
  cancelled download removal do not roll the counters back; restoring a
  partial/older development state derives a safe lower bound from remaining
  IDs. Files created with explicit `file_N` IDs also advance the VFS
  sequence. Creation does not scan the VFS. The new fields are domain-owner
  truth, not UI publication or an independent database table.
- `SoftwareRegistry.startInstallerWizard` uses a transient wizard-session ID;
  installed software truth uses stable `inst_<catalog-id>` identity instead.
  `TelemetryEngine` records real timestamps for diagnostics; those are not
  deterministic domain-entity identities. Neither diagnostic clock nor
  ephemeral wizard session is used to allocate these canonical VFS/download
  records.
- `#175` Worker transport, `#176` Rust and `#177` population benchmarks
  are out of scope. The pre-freeze policy allows refusing obsolete saves;
  **corruption of a current-format save must still fail closed**.

## Verification

The first deterministic-ID implementation commit `cadfc182` passed exact-head
Verify [#39167688675](https://github.com/MohamedXIV/away-message/actions/runs/39167688675):
313/313 test files, 1,798/1,798 tests, build/typecheck and Chromium
living-world smoke 6/6.

The second coherent removal + migration batch initially hit a **legitimate
AdversarialM1Stress legacy import dependency** in typecheck; the dependency was
migrated, not deleted or ignored. The corrected head `2cb4376` passed exact-
head Verify [#39168448468](https://github.com/MohamedXIV/away-message/actions/runs/39168448468).
That workflow did not run the PR-branch-restricted Pulse browser gates. This
branch enables both normal and cold Pulse gates in the CI config so the final
exact head checks them alongside living-world Chromium.

## New deterministic storage acceptance

`SimulationDeterministicStorageIdentity.test.ts` exercises deterministic
replay, no wall-clock/RNG calls for FileSystem, renamed/moved/restored file
identity, same-path recreation after deletion, cancelled-transfer tombstone
semantics, explicit `file_N` allocator reconciliation, composed
SimulationKernel export/reload, and **real Dexie IndexedDB save → cold boot
→ save → cold boot**. The test equips an actual modular network card using
HardwareEngine policy: download attempts without connectivity remain illegal.

Exact-head implementation [`7284a94`](https://github.com/MohamedXIV/away-message/commit/7284a946f1aba71e19724c24e7668e921e3c974e)
passed [Verify #39169985889](https://github.com/MohamedXIV/away-message/actions/runs/39169985889):
**314/314 Vitest files and 1,802/1,802 tests**, typecheck, production build,
living-world Chromium **6/6**, normal Pulse paging **1/1**, cold Pulse paging
**1/1**. Population benchmarks remain #177. Separate Vercel status failed.

Do not call this the complete #174 issue until the historical persistence
facades and table schema are audited/retired or justified and all remaining
genuinely canonical identity sources are accounted for. No partial save boots.

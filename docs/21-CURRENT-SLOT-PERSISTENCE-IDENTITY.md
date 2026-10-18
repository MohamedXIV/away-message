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

## Verified contract and limits

- PR branch remains stacked, Draft and unmerged. #174 stays open.
- The rest of the historical `slotsV5Core.ts` / `schemaV5Core.ts`
  facades, migrations and Dexie schema generations still need a **targeted
  dependency audit** before removal. They currently provide required names,
  schemas and historical migration functions — they are not another live
  snapshot writer on the production import path.
- FileSystemEngine and DownloadManager still have timestamp/random ID
  allocation for certain canonical records. Fix each only after confirming
  ownership, deletion/recreation behavior, and deterministic save/replay
  fixtures. A current-format identity policy cannot assume a mutable
  `Map.size` is a durable monotonic counter where deletion is possible.
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

Do not call this the complete #174 issue until remaining authoritative
ID sources and obsolete facades are reconciled, and no partial save boots.

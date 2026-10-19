# #172 — Bounded publication closure audit

**Source:** [issue #172](https://github.com/MohamedXIV/away-message/issues/172) ·
**canonical implementation:** [Draft PR #195](https://github.com/MohamedXIV/away-message/pull/195)
· **reviewed baseline:** `7d89b40b96b8e190759cd50544f1619f30a509ec`
· **main:** `c04ebcbbc951fa55322489dce8280480ccf02a85`

This is an **acceptance/ownership audit**, not another open-ended optimization backlog.
Re-evaluate it against the new exact HEAD whenever this PR changes.

## Decision table

| #172 requirement | Verdict | Evidence and limits |
|---|---|---|
| No giant snapshot required by **normal change subscribers** | **PASS** | `SimulationKernel.subscribeChanges` transports a frozen `SimulationChange` containing revision, game minute and observed domain names, without calling `getState`. `notifySubscribers` only builds a full state when an explicit **legacy** `subscribe` consumer exists. See `SimulationPublication.test.ts`. |
| Remove duplicate `subscribe → getState()` | **PASS** | `useSimulationStore.ts` listens to `subscribeChanges`. Its old `state` property is a per-revision lazy Proxy; broad materialization happens only on explicit compatibility property access. See `SimulationPublication.test.ts`, `SimulationWebsiteAndLazyStore.test.ts`. |
| React and Phaser consume bounded source-owned read models | **PASS for ordinary live UI** | `useBoundedSimulationRead.ts` caches an owner query by revision using `useSyncExternalStore`; `RoomScene`, `CafeScene` and browser/Pulse UI use these reads. A production-source regression test, `SimulationUiBoundedBoundary.test.ts`, rejects the old hot selectors and legacy snapshot subscription in UI/Phaser presentation modules. Source-owned privacy/limit tests cover Pulse pages, selected actors, town/transit, residence, website and Mailbox. |
| Full snapshot/export is an **explicit** boundary | **PASS, with compatibility caveat** | `SimulationKernel.exportSnapshot` materializes state for persistence/debug. Explicit old `engine.subscribe` and the legacy Zustand `state` property remain for compatibility but are **not** used by the ordinary UI publication path. AI Lab's button-triggered dry-run preview constructs a temporary `WorldEventsEngine` from World state; this is an explicit diagnostics/authoring command, not a per-tick consumer. Retiring compatibility APIs is not required to prove the normal-path invariant. |
| Worker-serializable change/projection contract | **PASS for contract; Worker deployment DEFERRED** | `SimulationChange` is plain JSON-safe `{revision,atMinute,changedDomains}`. Player-safe actor / Situation / conversation and other bounded read models have serialization/ownership tests. Actual `postMessage`, Worker command/query host and recovery belong to #175; these are **not** implied by #172. |
| Semantic projection law following #187 | **PASS within existing consumers** | #187 is merged/closed. Selected actor projections use semantic reach/relationship/interaction eligibility; player-safe knowledge is distinct from private NPC knowledge; Situation exposes source-backed world influence and events. Tests: `SimulationSemanticUiRead.test.ts`, `SimulationConversationPrivacyRead.test.ts`. New Ink consumer wiring belongs to #179–#185. |

## Conservative dirty-domain contract — intentionally unresolved precision

`SimulationChange.changedDomains` **always includes `unknown`** at the current
implementation head. Other domain names are **observed provenance**, not a complete
dirty set. In particular, nested/silent owner changes cannot yet be proven exhaustive.
It is **unsafe** for UI or a future Worker transport to skip a projection update
merely because its domain name is absent from a change event.

**This is not a false claim of precision and is not a blocker to bounded
publication:** normal readers currently invalidate by `revision`, so the
conservative token is safe. Do not remove `unknown`, enable domain-only
invalidations, or claim complete owner attribution until explicit coverage
proof has been added. Improving provenance accuracy alone is not a reason
to prolong #172 indefinitely.

## What the measurements establish (and do not establish)

Latest previously verified exact-head CI:
[Verify #39065164685](https://github.com/MohamedXIV/away-message/actions/runs/39065164685),
**298/298 files; 1,744/1,744 unit tests**, content/typecheck/build/baseline
guard all green; **6/6** living-world Chromium and **1/1** Pulse bounded paging.

The 500-actor **publication-only** benchmark recorded **zero broad
`getState` reads** and a median of **0.009 ms**. This is **not** evidence that
500-actor full simulation ticks run at 60 FPS, nor that Worker transport,
message history storage, or long-game save/export scales. Those assertions
require #173–#177, especially the #177 integration gate.

## Explicitly excluded from #172

- **#173:** Social owner decomposition and cold paged conversation persistence.
- **#174:** simplify current-format persistence and deterministic simulation identity.
- **#175:** actual canonical Dedicated Worker `SimulationHost` and fault handling.
- **#177:** integrated deterministic 20/100/250/500 actor and browser acceptance.
- **#179–#185:** Ink host/narrative consumers of the already bounded semantic views.
- **#176:** conditional Rust measurement; no Rust rewrite implied here.

## Review/exit recommendation

The currently supported #172 acceptance is **normal-path bounded publication with a
conservative revision invalidation protocol**; it does **not** require exhaustive
fine-grained dirty-domain precision or completed Worker transport. If the
production source boundary test and existing exact-head checks pass, request a
human review of #195 as a **bounded-publication completion candidate**.

Do **not** merge, mark Ready, or close #172 without explicit authorization.
Do **not** turn discovered future optimizations into blockers unless they
demonstrably violate a #172 acceptance item above.

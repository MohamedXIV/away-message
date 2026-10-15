# #187 — Semantic ownership implementation notes

Status: **Draft / in progress**. Parent #168. Depends on merged #171.

Canonical design: [17-SEMANTIC-WORLD-AND-CHARACTER-MODEL.md](../../17-SEMANTIC-WORLD-AND-CHARACTER-MODEL.md).

## First vertical slice

- **WorldEventsEngine** continues to own triggered event truth, flags and published facts. It now composes **one** `KnowledgeLedger` (not a parallel global store) for semantic facts, possibly false claims and actor-specific learning receipts.
- An assertible **fact** is `subjectId / predicate / value` with source provenance; a **claim** refers to a fact ID but has its own asserted value and publisher. Contradictory claims cannot alter facts.
- A knowledge **receipt** records an actor (or `player`) learning a fact or hearing a claim from a source. No receipt = no visibility in actor-safe views. Data and source IDs are bounded, JSON-serializable, validated and current-format round-tripped.
- Existing public world events remain canonical WorldEvents events. Public feed exposure is *deterministic and actor-scoped*, not universally known. Explicit `learnEventForBuddy` enables sourced disclosure. Historical source-less `buddyKnowledge` is preserved as migration input; do not mistake it for world truth.
- **SocialEngine** remains the only owner of actor identity, relationship dimensions and long-term memories. `CoreMemoryMeaning` can now encode participants, subject, source, salience and valence while keeping its fallback prose. Resolving a promise records this meaning without creating a second promise ledger.
- **SimulationKernel** offers a bounded read `getActorSemanticView` derived purely from Social/NPC Life and an owner-facing provenance query `getActorLifeInfluences` derived from existing WorldModifiers.
- No universal scripting DSL, separate actor truth store, AI-chosen facts, or renderer dependency was introduced.

## Scope and remaining acceptance

This draft **does not close #187**. Future work:
1. Untangle persisted actor lifecycle/contact states from old `status: friend | close | distant | gone | blocked` labels, while relationship stage stays derived.
2. Make real UI/Ink/AI knowledge exposure use actor/player-safe views and authorized domain-disclosure actions.
3. Extend evidence/fidelity coverage using 20/100/250/500 fixture scenarios and special event conditions.
4. Coordinate #172 bounded revisions, #173 Social/history ownership, #174 deterministic remaining IDs (messages and others).
5. Preserve current narrative text only as wording; facts and memories require domain provenance.

## Verification expectations

- `tests/unit/SemanticKnowledge.test.ts`: fact/rumor contradiction, actor and player knowledge isolation, explicit exposure, deterministic event discovery, corruption-safe round trip and read purity.
- `tests/unit/ActorSemanticModel.test.ts`: pure relationship/lifecycle semantics, local/remote fidelity, explainable blockers, WorldModifier source provenance, structured promise-memory round trip and defensive reads.
- Full content check, TypeScript, production build, baseline guard, tests and browser smoke on exact final head before calling this ready.

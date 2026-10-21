# Ink Narrative Authoring & Generative Internet

Status: **Canonical narrative/runtime direction**

Date: 2026-10-11

Tracking epic: #179

Execution roadmap: `docs/superpowers/plans/2026-10-11-ink-narrative-runtime-roadmap.md`

Companion simulation refactor: #168–#177

Semantic model: `docs/17-SEMANTIC-WORLD-AND-CHARACTER-MODEL.md`

## Purpose

Restore real Ink/inkjs as Away Message's preferred authored narrative and conversational flow language while preserving the open-ended sandbox, current character identity model, offline playability, and deterministic simulation authority.

Core rule:

```text
Simulation decides what is true and what may happen.
Ink decides the authored conversational/narrative flow and intended meaning.
AI optionally realizes or rephrases that approved meaning.
```

Ink is not a replacement for the SimulationKernel, Life Matrix, Social authority, Scenario runtime, knowledge rules, transit, jobs, education, economy, or world events.

---

## 1. Current live-code reality

This direction is based on the current repository, not on the older removed-Ink architecture.

### Ink runtime is restored (#180–#182)

- `inkjs` is a real dependency and `npm run ink:compile` compiles authored `.ink` sources into committed JSON fixtures/flows;
- `src/narrative/ink/InkRuntime.ts` wraps compiled stories; `NarrativeHost` validates bounded context queries and typed semantic effect requests;
- `src/narrative/NarrativeCoordinator.ts` starts/resumes compiled flows from explicit interaction requests or meaningful semantic events;
- `SimulationNarrativeAdapter` maps the coordinator onto bounded SimulationKernel reads and canonical owner commands without a full `getState()` snapshot;
- the legacy `NarrativeEngine` / `InkAdapter` / StoryKnot path is migration-only, unmounted in production, and has a bounded deletion plan in §17.2.

Restoring Ink therefore means a real runtime/compiler path, not merely renaming the existing adapter.

### Character identity already has local/remote reach

`BuddyCharacter` already includes:

```ts
reach?: 'local' | 'remote'
```

Current semantics are important and must be preserved.

A **local** buddy:
- is a canonical social actor;
- may participate in town/spatial/transit/in-person life;
- may have art/presentation;
- currently receives `important_local` Life Matrix fidelity.

A **remote** buddy:
- is still the same canonical `BuddyCharacter` social model;
- retains relationships, memories, conversations, temperament, goals and online presence;
- is projected physically as `remote`;
- cannot interact in person while remote;
- receives `background_remote` fidelity;
- is not given a fake local place just because a stale mobility/place record exists.

The current tests explicitly prove that one identity can move:

```text
remote → local → remote
```

without forking actor identity or social history.

### Online-origin newcomers already default to remote in CharacterDirector

`CharacterDirector` currently assigns:

```text
work / intro / seed  → local
nightboard / myplace / pulse-room → remote
```

for generated newcomers.

This is the intended distinction.

### Not every internet author is a BuddyCharacter

The fake internet currently contains multiple identity/content levels.

NightBoard includes:
- static authored anonymous/tripcode posts;
- deterministic weekly posts authored by existing canonical buddies;
- world-event-derived dynamic threads.

Generated websites may contain flavor voices/content without defining a persistent social actor.

MyPlace stores profile presentation separately from canonical social state and can create pages from roster identities.

Therefore the architecture must **not** introduce a second InternetPersona relationship engine.

---

## 2. Canonical identity model

Use three conceptual levels, but only one persistent social actor authority.

### Level A — local social actor

A canonical `BuddyCharacter` with `reach='local'`.

May own/participate in:
- Social relationships;
- memories/promises;
- online presence;
- Life Matrix;
- town position;
- transit;
- physical encounters;
- character presentation.

### Level B — remote social actor

A canonical `BuddyCharacter` with `reach='remote'`.

May own/participate in:
- Social relationships;
- memories/promises;
- Pulse/chat;
- MyPlace profile;
- remote routine/presence;
- coarse Life Matrix goals/pressure;
- online relationships.

Must not automatically own:
- town XYZ;
- local physical place;
- in-person availability;
- physical character art requirement.

A later canonical event may change reach while keeping the same actor ID/history.

Examples:
- a remote online friend visits Oakhaven;
- a remote student later moves to town;
- a local actor moves away but remains in contact.

Reach is physical scope, not identity class.

### Level C — internet surface identity/content

Examples:
- Anonymous NightBoard author;
- tripcode;
- one-off forum username;
- generated guestbook author;
- ambient website voice;
- procedural comment account.

These may remain content/provenance only.

They need not have:
- a relationship graph;
- Life Matrix;
- town position;
- full memories;
- a persistent social roster record.

If gameplay upgrades one into a meaningful persistent relationship, use an explicit promotion/binding path:

```text
Internet surface identity
        ↓ governed promotion
canonical BuddyCharacter
        ↓
reach decided from canonical evidence/source
```

Online-origin promotion normally starts remote unless the game already knows the person is local.

Do not silently create a second actor when an existing handle already maps to a canonical identity.

---

## 3. Known current inconsistency to fix

The model is stronger than every current surface.

The current MyPlace "Add to Friends" path can call `buildCharacter()` without explicitly supplying `reach`.

`buildCharacter()` currently defaults an unspecified reach to `local`.

That means an online profile can accidentally be promoted into a local physical actor even though `CharacterDirector` correctly makes MyPlace-origin newcomers remote.

This is implementation debt, not product law.

#181 tracks the audit/fix.

All promotion paths should share one governed resolver instead of relying on individual UI call sites.

---

## 4. Why restore Ink

The current TypeScript StoryKnot runtime already recreates several things Ink is designed to do:
- branching;
- conditions;
- choices;
- local flow state;
- transitions;
- semantic tags/effects.

As content grows into:
- school conversations;
- work interactions;
- romance;
- arguments/reconciliation;
- online chat;
- Scenario hooks;
- forum structures;
- email;
- web discoveries;

authoring those flows directly as TypeScript becomes unnecessary systems-code pressure.

Ink offers text-first authored branching and recombination without forcing a visual node/tree editor.

The target is not "Ink owns the story".

The target is:

> **Ink is Away's authored narrative/conversational language.**

---

## 5. Target runtime architecture

```text
                  canonical truth
              SimulationHost / domains
                       │
       semantic events + bounded projections
                       │
                       ▼
                 NarrativeHost
                       │
          ┌────────────┴────────────┐
          │                         │
 NarrativeCoordinator          InkRuntime
 trigger/context policy          inkjs only
          │                         │
          └────────────┬────────────┘
                       ▼
             Utterance/Content Plan
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
      Offline/default        Optional AI Realizer
      authored wording       within freedom policy
            │                     │
            └──────────┬──────────┘
                       ▼
                 presentation
```

Logical boundaries matter more than thread placement.

After #175, SimulationHost may live in a Dedicated Worker. Ink/NarrativeHost may run in that worker or elsewhere if profiling/packaging recommends it, but NarrativeHost remains a separate logical authority boundary.

---

## 6. NarrativeHost

NarrativeHost is the application-facing seam for authored narrative.

Representative responsibilities:
- start/resume an Ink flow;
- provide safe narrative context;
- expose choices/continuations;
- persist Ink-local runtime state;
- emit an UtterancePlan;
- submit validated semantic effect requests;
- subscribe to meaningful semantic events.

It must not expose mutable simulation objects directly to Ink.

Conceptually:

```ts
interface NarrativeHost {
  start(flowId: string, context: NarrativeStartContext): NarrativeFrame;
  choose(choiceId: string): NarrativeFrame;
  continue(): NarrativeFrame;
  save(): NarrativeRuntimeState;
  load(state: NarrativeRuntimeState): void;
}
```

Exact API is implementation detail.

---

## 7. Narrative context

Ink reads projections, not the whole universe.

The preferred projection/query vocabulary comes from the semantic model in `docs/17-SEMANTIC-WORLD-AND-CHARACTER-MODEL.md`. Ink should ask for stable meaning such as `actor.is_student`, `actor.knows(fact)`, `relationship.is(trusted)` or `interaction.can(study_together)` rather than bind authored content to raw engine storage fields.

Examples:
- current day/time band;
- actor identity safe for this interaction;
- relationship stage/dimensions when content is allowed to branch on them;
- actor knowledge / player knowledge projections;
- current location/co-location;
- current obligation or event context;
- Scenario-safe hook metadata;
- school/work context later;
- current mood/needs if relevant.

Avoid old-style full `engine.getState()` injection.

Narrative context should be serializable and bounded for the new Worker architecture.

---

## 8. Ink-owned state versus simulation-owned state

### Ink may own

Only local narrative-flow state such as:
- asked_about_exam;
- joke_used;
- current topic;
- conversation tension specific to this flow;
- whether a local branch was visited;
- local counters;
- flow continuation point.

### Ink must not own

- cash;
- inventory;
- item ownership;
- relationship dimensions;
- actor location;
- reach;
- school grade;
- job result;
- appointment truth;
- transit;
- weather/world-event truth;
- player knowledge when canonical knowledge owns it;
- CharacterIntent;
- Scenario role binding/lifecycle.

Ink may query those facts.

Ink may request a semantic action.

The owning domain validates and commits it.

---

## 9. Effects and commands

Bad:

```ink
~ money -= 20
~ nina_trust += 10
~ actor_location = "cafe"
```

Target:

```ink
~ request_effect("pay_meal", "meal_123")
~ request_effect("social_act", "vulnerable_share")
```

The bridge produces a typed request.

Simulation/domain owner decides:
- whether it is valid now;
- actual cost/effect;
- whether preconditions still hold;
- resulting canonical state.

Ink receives success/failure/result projection and continues appropriately.

---

## 10. Trigger model

Do not restore the current legacy pattern where the adapter repeatedly reevaluates all knots from generic time ticks.

Narrative flows should wake from meaningful semantic events or direct interaction.

Examples:
- ConversationStarted;
- MessageReceived;
- ActorEncountered;
- ActorEnteredPlace;
- ClassEnded;
- ExamScheduled;
- ShiftEnded;
- RelationshipStageChanged;
- PromiseBroken;
- ScenarioHookAvailable;
- KnowledgeFactLearned;
- PlayerInspectedObject;
- WorldRumorPublished.

A time boundary may trigger a semantic event, but Ink should not scan the whole story corpus every minute.

---

## 11. Scenario integration

The completed Scenario framework remains canonical for:
- scenario definitions;
- semantic roles;
- deterministic role binding;
- scenario-local lifecycle;
- consumed hook state;
- safe scenario projection.

Ink does not replace it.

Target flow:

```text
Scenario observes canonical state
        ↓
ScenarioHookAvailable
        ↓
NarrativeCoordinator selects Ink flow
        ↓
Ink presents authored conversation/discovery
        ↓
validated domain effects
```

Scenario bindings remain in Scenario state, not Ink variables.

Ink may use bound role IDs supplied in safe context.

---

## 12. AI realization policy

AI is optional wording realization, not content authority.

### L0 — Exact authored

Ink output is final.

Use when:
- wording is important;
- clue must be exact;
- legal/system/UI text;
- high-risk continuity;
- strong authored joke/line.

### L1 — Style rewrite

Ink provides complete semantic sentence.

AI may restyle voice while preserving every required proposition.

No new facts.

### L2 — Constrained realization

Ink/NarrativeCoordinator supplies a structured plan such as:

```text
speaker: actor_42
speech_act: reassure
required_facts:
  - player has exam tomorrow
  - actor believes player studied hard
  - actor offers to study together tonight
tone:
  - warm
  - playful
forbidden:
  - claim exam result
  - invent romance
  - invent unseen events
```

AI writes surface wording.

Canonical local/remote buddies normally stop at L2.

### L3 — Generative surface

Wider freedom for surfaces where generation/unreliability is itself the fiction:
- ambient forum banter;
- generated personal pages;
- one-off handles;
- procedural guestbook chatter;
- noncanonical hobby sites;
- background comments.

Even L3 cannot silently mutate world truth.

---

## 13. Offline parity

AI-on and AI-off may differ in wording variety.

They must not differ in required gameplay meaning.

Every canonical L0–L2 plan needs:
- a complete offline/default realization;
- the same choices;
- the same semantic effects;
- the same knowledge limits;
- the same consequence rules.

Target:

```text
Ink semantic meaning
        │
   ┌────┴────┐
   ▼         ▼
offline    online
default    AI realization
   │         │
   └────┬────┘
        ▼
same gameplay meaning
```

The current generic free-form fallback such as "connection's being weird" is not sufficient for long-term school/relationship content.

Generated L3 internet surfaces may use deterministic/template fallback rather than authored line-by-line equivalents.

---

## 14. Fake internet model

The fake internet remains local simulated content. Real public internet is not required.

Ink may orchestrate **structure and information flow**, while existing domain truth remains canonical.

### NightBoard

Current NightBoard already merges:
1. static authored threads;
2. deterministic posts from canonical buddies;
3. world-event-derived dynamic threads.

Future Ink use may define:
- opening-post purpose;
- reply phases;
- disagreement;
- correction;
- escalation;
- clue reveal;
- thread death/return;
- optional Scenario link.

AI may realize L3 wording for noncanonical posters and L0–L2 wording for canonical buddies.

### MyPlace

MyPlace profile state is presentation/social surface state, not a second character identity authority.

Canonical buddy identity and reach remain in Social.

Ink may drive:
- profile-change events;
- guestbook interaction flow;
- discovery/reveal;
- Scenario-safe clues.

Adding a profile to persistent social life must use the governed promotion rule.

### Generated websites

Ink may provide:
- site-event structure;
- discoverable clue patterns;
- authored navigation/reveal flow;
- reusable content templates.

AI may generate visual/text flavor within schema and provenance constraints.

---

## 15. Claims, facts and provenance

Internet text is not automatically truth.

Generated or authored statements should be treated conceptually as one of:
- canonical fact;
- rumor/claim;
- opinion;
- lie/roleplay;
- unknown/unverified.

The exact data model may be simpler than these five labels, but provenance must make the distinction possible.

Example:

```text
NightBoard user:
"heard route 2 is shutting down tomorrow"
```

This may be a rumor.

It must not close route 2 in TransitNetwork.

Only canonical transit/world-event state may do that.

AI is allowed to invent plausible **claims** in L3 contexts when the surface policy permits it.

It is not allowed to invent canonical **facts**.

---

## 16. Character identity and internet claims

A handle may belong to:
- a canonical local actor;
- a canonical remote actor;
- no canonical actor yet;
- an anonymous surface account;
- an intentionally ambiguous identity.

Do not infer locality from:
- MyPlace profile existence;
- forum posting;
- Pulse availability;
- generated bio text.

Reach must come from canonical character creation/promotion/world state.

Do not infer real name from a surface handle unless player knowledge allows it.

A future reveal may bind a previously surface-only handle to an existing actor without creating a duplicate actor.

---

## 17. Migration from StoryKnots

Use a strangler migration.

```text
existing StoryKnot path
        │
        ├─ keep working during migration
        │
new InkRuntime + NarrativeHost
        │
migrate representative flows
        │
migrate remaining authored flows
        │
delete legacy adapter/StoryKnot runtime
```

Do not rewrite all narrative content in one PR.

Once the Ink gate passes:
- new authored conversational flow should prefer Ink;
- TypeScript remains for systems/policies/contracts;
- no new StoryKnot-specific architecture should be added.

### 17.1 NarrativeCoordinator (#182)

`NarrativeCoordinator` is the application-facing authored-flow seam over the
#180 foundation:

```text
explicit interaction / semantic event / Scenario hook
                    ↓
          NarrativeCoordinator
      (trigger policy + active flow)
                    ↓
     NarrativeHost + compiled InkRuntime
       bounded queries / validated effects
                    ↓
   NarrativeEffectOwner (canonical owner)
```

Rules:
- triggers are explicit interactions or meaningful semantic events
  (`conversation_started`, `actor_encountered`, `knowledge_fact_learned`,
  `object_inspected`, `scenario_hook_available`); ordinary time ticks are not
  triggers and the coordinator has no tick subscription;
- context comes from `NarrativeContextSource`, implemented by bounded owner
  reads (HUD/time/cash, needs, selected actor read, NPC place, Scenario
  projection). Ink never receives a full `engine.getState()` snapshot;
- effect requests still pass the #180 typed validation, then an
  `NarrativeEffectOwner` turns them into ordinary `SimulationAction`s. Owners
  validate preconditions and commit; Ink never mutates canonical state;
- active-flow state (Ink continuation, session refs, last bounded context) is
  serializable through `save()`/`load()`. Wiring that state into the main save
  slot belongs to the #185 integration gate; #182 deliberately does not change
  kernel persistence contracts;
- Scenario hooks are consumed through the existing Scenario runtime. The
  coordinator stores only an instance/hook reference for the active flow; it
  does not copy Scenario facts, bindings or consumed-hook lists.

Representative migrated flows:
- `src/narrative/ink/flows/cafe-meeting.ink` — the existing authored Starlight
  Café in-person opener, now branchable Ink with validated social effects;
- `src/narrative/ink/flows/scenario-old-debt.ink` — launched by the existing
  `old_debt` Scenario hook (`debt_search` / `debtor_nearby`), read-only over
  bounded Scenario context.

A representative StoryKnot migration is no longer possible from production
content because the named campaign knots were removed by the open-ended
sandbox decision (#127) and `ALL_STORY_KNOTS` is empty. The café interaction is
the representative authored interaction being migrated; future authored
content must be Ink-first.

### 17.2 Bounded StoryKnot / InkAdapter retirement plan

Current legacy inventory (all unmounted in production):
- `src/narrative/InkAdapter.ts` — tick listeners + full `getState()` snapshot;
- `src/narrative/NarrativeEngine.ts`, `types.ts`, `tagParser.ts` — TS StoryKnot
  evaluation and semantic-tag parsing;
- `src/narrative/data/allKnots.ts` — intentionally empty catalog (no named
  campaign);
- `src/apps/pulse/data/dialogueTrees.ts` and the Pulse `DIALOGUE_SCRIPTS`
  consumers — empty bridge from knots to scripted NPC messages;
- legacy tests: `tests/unit/NarrativeEngine.test.ts`,
  `tests/unit/CafeMeetingScene.test.ts`, tag-parser coverage.

Deletion gate: #185, after the integration/offline gate proves authored
conversation coverage through `NarrativeCoordinator`.

Ordered steps:
1. Route every remaining authored interaction through compiled Ink +
   `NarrativeCoordinator` (no new StoryKnot registration).
2. Move any remaining narrative flags/beats to canonical World owners; the
   deprecated aliases already route there.
3. Remove `DIALOGUE_SCRIPTS` consumption from Pulse (AI/template dialogue
   remains the non-authored path).
4. Delete the legacy files and their tests in one focused PR; run
   typecheck/build/full suite and confirm no production import remains.
5. Pre-freeze development snapshots containing `narrative` fields may be
   refused/reset cleanly; do not add a parallel narrative save authority.

No production path may instantiate `InkAdapter`; it must not regain tick
polling or full-state access during the transition.

---

## 18. Refactor dependencies

Tracked under #179:

- #180 — inkjs + NarrativeHost contracts;
- #181 — local/remote reach and promotion hardening;
- #182 — NarrativeCoordinator + StoryKnot migration;
- #183 — AI realization tiers + offline parity;
- #184 — fake-net/forum generation + provenance;
- #185 — final integration gate.

Relationship to simulation refactor:
- #171/#172 establish the composition/projection boundary Ink should consume;
- #175 establishes the Worker host boundary;
- Narrative implementation should not deepen coupling to the old inherited SimulationEngine while those issues are active.

---

## 19. Non-goals

This direction does not:
- restore a mandatory campaign;
- require a named protagonist NPC;
- require romance;
- replace Scenarios;
- make Ink a quest engine;
- let AI decide canonical outcomes;
- create a second social graph;
- convert every forum username into a fully simulated NPC;
- require every remote buddy to become local;
- require online AI/network services for gameplay;
- replace React/Phaser.

---

## 20. Exit condition

Ink restoration is complete when:
- real compiled Ink runs through a clean InkRuntime;
- NarrativeHost uses bounded context and typed effect requests;
- local and remote canonical actors preserve one identity model;
- online promotion cannot accidentally create false locality;
- StoryKnot runtime is retired or has no remaining production-authoring role;
- Scenario hooks can launch Ink flows safely;
- canonical buddy dialogue uses L0–L2 realization with meaningful offline defaults;
- fake-net L3 content has explicit provenance/claim safety;
- representative offline play remains complete with external AI disabled;
- no narrative layer duplicates simulation truth.

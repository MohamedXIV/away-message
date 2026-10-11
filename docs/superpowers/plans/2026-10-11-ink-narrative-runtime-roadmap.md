# Ink Narrative Runtime Roadmap

Date: 2026-10-11

Canonical design: `docs/16-INK-NARRATIVE-AUTHORING-AND-GENERATIVE-INTERNET.md`

Tracking epic: #179

Companion simulation refactor: #168–#177

## Goal

Restore real Ink as the preferred authored narrative/conversation language while keeping canonical world truth in simulation and preserving the existing local/remote character model.

## Dependency shape

```text
#180 InkRuntime + NarrativeHost contracts
        ├────────────┐
        ↓            ↓
#181 reach/promotion  #171/#172 simulation composition/projections
        └──────┬─────┘
               ↓
#182 NarrativeCoordinator + StoryKnot migration
               ↓
#183 AI realization tiers + offline parity
               ↓
#184 fake-net/forum provenance + generated surfaces
               ↓
#185 integration/offline/identity gate
```

#175 Worker hosting may land before or during the later Ink runtime work. Do not hard-couple Ink to the old SimulationEngine while that migration is in progress.

---

## P0 — restore the runtime seam

### #180

Add real inkjs/compiler/runtime support.

Keep the wrapper narrow:
- load compiled story;
- continue;
- choose;
- read/write Ink-local variables;
- save/load Ink-local state;
- surface tags/metadata.

Define NarrativeHost contracts around it.

No canonical mutation from Ink variables.

---

## P0 — harden existing identity semantics

### #181

Audit all current routes that create a canonical buddy.

Preserve the existing law:

```text
local BuddyCharacter
= town-capable canonical actor

remote BuddyCharacter
= canonical social actor without local physical life

surface internet identity
= not automatically a BuddyCharacter
```

Known audit target:
- MyPlace direct "Add to Friends" path currently builds without an explicit reach and may inherit the factory's local default.

Add promotion tests before fake-net generation expands.

---

## P1 — authored flow migration

### #182

Introduce NarrativeCoordinator.

Use semantic triggers rather than generic tick scanning.

Migrate representative flows:
- one Pulse conversation;
- one in-person interaction;
- one Scenario hook.

Keep legacy StoryKnots only as temporary migration input.

---

## P1 — AI as realization

### #183

Implement L0–L3 policy.

Canonical buddies:
- L0 exact;
- L1 rewrite;
- L2 constrained realization.

Generated/unreliable internet:
- may use L3.

Every L0–L2 plan must contain enough authored/default wording to function offline.

Do not let AI output decide semantic effects.

---

## P2 — fake internet

### #184

Build on existing NightBoard/MyPlace/generated-site systems.

Do not replace them with a monolithic "AI internet".

Add:
- Ink-authored structural flows;
- claim/provenance semantics;
- wider generation for surface-only identities;
- explicit promotion/binding into Social when needed.

Preserve:
- static threads;
- deterministic canonical-buddy posts;
- world-event-driven content;
- local .local routing.

---

## Gate

### #185

Prove:
- real Ink;
- no duplicate authority;
- local vs remote semantics;
- surface identity promotion;
- Scenario integration;
- L0–L3 enforcement;
- meaningful offline play;
- fake-net misinformation cannot mutate canonical truth.

After this gate, new authored narrative should default to Ink rather than TypeScript StoryKnots.

---

## Verification

At minimum:
- focused Ink runtime unit tests;
- effect validation tests;
- local/remote reach regression tests;
- remote→local→remote identity continuity;
- MyPlace/Pulse/NightBoard promotion tests;
- Scenario→Ink integration test;
- offline/no-key integration test;
- AI realization schema/meaning guards;
- normal repository typecheck/build/full-test gates.

Do not create wall-clock/network-dependent tests for core acceptance.

---

## Relationship to Senior Year

Senior Year benefits directly from Ink because it adds large amounts of authored conversational structure:
- classes;
- teachers;
- classmates;
- exams;
- study conversations;
- clubs;
- work/school conflicts;
- romance;
- graduation;
- online relationships.

Education rules and outcomes remain simulation/domain code.

Ink expresses the conversation around those facts.

AI optionally varies wording.

This keeps school content authorable without growing TypeScript condition forests or node graphs.

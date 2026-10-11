# Semantic World & Character Model

Status: **Canonical semantic-simulation direction**

Date: 2026-10-11

Tracking refactor epic: #168

Primary implementation issue: #187

Companion runtime design: `docs/15-SIMULATION-KERNEL-AND-RUNTIME-BOUNDARY.md`

Companion narrative design: `docs/16-INK-NARRATIVE-AUTHORING-AND-GENERATIVE-INTERNET.md`

## Purpose

Define the semantic layer that sits between Away Message's canonical simulation state and higher-level consumers such as Life Matrix, Ink, UI projections, fake-internet generation, AI realization, testing and future Education content.

The design borrows the useful architectural ideas associated with Paradox/Clausewitz/Jomini-style simulation:

- small canonical state;
- explicit scopes/context;
- pure triggers/queries;
- validated effects/commands;
- derived modifiers/influences with provenance;
- semantic events;
- long-lived situations;
- data-authored content composed over engine primitives;
- explainable decision scoring;
- fidelity tiers for different simulation importance.

Away does **not** need a Clausewitz clone, a generic scripting language, a universal modifier engine or a GOAP planner.

The goal is simpler:

> **Store a small amount of irreducible truth. Derive rich semantic meaning from it. Let content compose those meanings without owning the world.**

---

## 1. Core law: truth, meaning, action and presentation are different layers

Do not collapse these concepts into one state object.

```text
Canonical state
    ↓
Derived semantics
    ↓
Queries / opportunities / intent
    ↓
Validated commands/effects
    ↓
Canonical state changes
    ↓
Presentation / Ink / UI / AI wording
```

Examples:

```text
Canonical:
actor has exam tomorrow
actor fatigueBand = tired
actor discipline = 82

Derived:
actor.is_exam_anxious
actor.study_readiness = 68
actor.is_available_for_long_chat = false

Narrative:
study_together opportunity is eligible

Presentation:
"She's distracted and keeps checking the clock."
```

The derived values above should not become persisted booleans unless they are truly irreducible facts.

---

## 2. Current live-code foundation to preserve

The current repository already contains several strong primitives.

### Stable temperament

`CharacterTraits` currently owns:

- shyness;
- warmth;
- discipline;
- spontaneity;
- loyalty.

These are fixed at actor creation and are already used as deterministic rule inputs.

Preserve this idea.

Do not replace it with an LLM personality brain.

### Multidimensional relationships

Player↔actor and NPC↔NPC relationships already model dimensions such as:

- familiarity;
- trust;
- comfort;
- respect;
- annoyance;
- affection;
- attraction;
- suspicion;
- resentment.

Preserve these dimensions.

Do not collapse them into one generic "opinion score".

### Reach

`BuddyCharacter.reach` already distinguishes:

```text
local
remote
```

Reach controls physical scope, not identity.

A remote actor remains a real canonical social actor with relationships, memories and online presence.

### Goals, obligations and intent

Life Matrix already separates:

```text
Goal
≠ Obligation
≠ CharacterIntent
```

This is the correct architecture.

A goal may survive days or months.

An obligation constrains a time/place/commitment.

An intent is a derived next action and is not itself the owner of the outcome.

### World modifiers

`LifeWorldModifierView` already demonstrates the right modifier philosophy:

- source provenance;
- explicit active interval;
- derived on demand;
- not persisted as a duplicate outcome state;
- consumers decide how to apply the effect.

This pattern should be preserved and extended by domain-specific influence resolvers rather than replaced with one universal ModifierEngine.

---

## 3. Canonical character model

A character should be understood as a composition of domain-owned truths, not one giant mutable object.

```text
Actor
│
├── Identity
│   ├── stable id
│   ├── names / handles
│   ├── reach
│   ├── roles / capabilities
│   └── authored/procedural provenance
│
├── Temperament
│   └── stable traits
│
├── Social
│   ├── relationship dimensions
│   ├── structural relations
│   ├── commitments
│   └── social continuity
│
├── Mind
│   ├── knowledge
│   ├── claims / beliefs
│   └── memories
│
├── Life
│   ├── goals
│   ├── irreducible pressure / needs
│   ├── obligations
│   └── current intent (derived)
│
├── Physical
│   ├── reach
│   ├── spatial presence
│   ├── transit
│   └── possessions
│
└── Presentation
    ├── appearance DNA
    ├── wardrobe
    ├── renderer
    └── online presentation
```

No layer may silently become a second owner of another layer's truth.

---

## 4. Identity and roles

Identity answers:

> Who is this persistent actor?

It does not answer:

> What are they doing right now?

Roles/capabilities are semantic and composable.

Examples:

```text
student
teacher
coworker
landlord
cafe_regular
musician
classmate
neighbor
roommate
moderator
```

A person may hold many roles simultaneously.

Do not create class hierarchies such as:

```text
StudentCharacter
TeacherCharacter
CoworkerCharacter
```

when generic role/capability data is sufficient.

### Archetype is a generation/content seed, not permanent behavior authority

Current archetypes such as `student`, `artist`, `nightowl`, `trader` remain useful for:

- generation;
- content palettes;
- defaults;
- procedural names/profiles;
- fallback behavior.

But once an actor exists, important decisions should prefer actual traits, roles, goals, relationships, obligations, knowledge and current context over broad archetype labels.

---

## 5. Lifecycle, connection and relationship must be separated

Current `BuddyLifecycleStatus` mixes several concepts:

```text
stranger
acquaintance
friend
close
distant
gone
blocked
```

At the same time, `RelationshipStage` is already explicitly derived from relationship dimensions.

This creates conceptual duplication.

The target should separate at least:

### Actor lifecycle

Representative semantics:

```text
active
inactive
departed
unreachable
archived
```

Exact enum names are implementation detail.

### Connection/contact state

Representative semantics:

```text
unknown
known
contact
blocked_by_player
blocked_player
```

Only store this where it represents irreducible communication/network truth.

### Relationship semantics

Derived from relationship dimensions plus context:

```text
stranger
acquaintance
friend
close
strained

trusted
comfortable
attracted
resentful
guarded
admiring
conflicted
```

Avoid persisting derived friendship labels in a second location if the relationship dimensions already determine them.

---

## 6. Structural relation versus emotional relationship

Some relationships are facts:

```text
classmate
coworker
teacher_of
student_of
sibling
parent
neighbor
roommate
ex_partner
```

These are structural relations.

Others are derived emotional semantics:

```text
trusted
close
resentful
attracted
conflicted
```

Do not conflate the two.

Example:

```text
structural:
Nina is the player's classmate.

emotional:
Nina trusts the player but is currently resentful.
```

Ink/content may query both.

---

## 7. Memory is not knowledge

Current `CoreMemory` is useful but text-centric:

```text
id
text
kind
day
```

For important long-term simulation history, canonical meaning should become structured.

Representative direction:

```ts
interface SemanticMemory {
  id: MemoryId;
  kind: MemoryKind;
  occurredAtMinute: number;
  participants: ActorId[];
  subject?: SemanticRef;
  placeId?: PlaceId;
  sourceEventId?: string;
  salience: 'low' | 'medium' | 'high';
  valence?: 'positive' | 'neutral' | 'negative' | 'mixed';
  privacy?: 'private' | 'shared' | 'public';
  provenance: SemanticProvenance;
  fallbackSummary?: string;
}
```

Exact shape is implementation detail.

The important rule:

> The memory's semantic fact is canonical. Its prose is presentation.

Example:

```text
Memory truth:
player broke promise study_together_4 with Nina

Possible wording:
"you said you'd call and never did"
```

AI may rewrite the wording.

It may not rewrite the event into a different memory.

---

## 8. Knowledge, claim, belief and world truth are separate

This is one of the most important new boundaries.

Current `WorldEventsEngine` effectively treats every triggered global event as known to every buddy.

That is acceptable migration-era behavior but cannot support the intended school/fake-internet/rumor simulation.

Canonical distinction:

```text
World Fact
≠ Actor Knowledge
≠ Claim / Rumor
≠ Belief
≠ Player Knowledge
```

### World fact

What is actually true.

Example:

```text
english_exam.date = Friday 09:00
```

### Actor knowledge

An actor has learned that fact through a valid source.

### Claim / rumor

A statement exists in the world but may be wrong.

Example:

```text
NightBoard post:
"heard the English exam is cancelled"
```

### Belief

Optional/coarse representation of whether an actor accepts a claim as likely true.

Do not require a probabilistic belief system for every fact.

Use only where gameplay needs uncertainty.

### Player knowledge

What the player is entitled to know.

The UI, Ink and AI must use player-safe projections rather than omniscient world state.

---

## 9. Knowledge provenance

Where useful, knowledge should remember how it was obtained.

Examples:

```text
source:
school_notice
teacher
friend
nightboard_post
citywire
direct_observation
scenario_seed
email
pulse_message
```

This enables:

- believable disclosure;
- rumor spread;
- contradiction;
- source credibility;
- online discovery;
- Scenario-safe clues;
- contextual dialogue.

It also lets content ask:

```text
actor.knows(fact)
actor.heard(claim)
player.knows(fact)
knowledge.source_is("nightboard")
```

without parsing conversation text.

---

## 10. Commitments rather than generic favor points

Current promises are a strong foundation.

They may later generalize into structured commitments such as:

```text
promise
favor
debt
invitation
agreement
responsibility
```

Prefer concrete provenance-rich commitments over generic currencies such as:

```text
favorPoints += 10
```

Example:

```text
kind: favor_received
from: nina
to: player
context: covered_shift
```

Rules may later derive willingness, resentment or reciprocity from the record.

---

## 11. Goals are not intents

Preserve this separation.

Example:

```text
Goal:
pass_english_exam

Possible intents:
study
travel_to_school
ask_friend_for_help
rest_before_exam
```

The same goal may produce different short-lived intents as time/context changes.

Intent remains derived orchestration output.

It must not own:
- transit result;
- grade;
- relationship consequence;
- job outcome;
- money;
- attendance outcome.

---

## 12. Obligations are the shared life-sim primitive

Current obligations are one of the most important reusable systems in Away.

The target is for school, work and adult life to share the same generic concept.

Representative sources:

```text
routine
appointment
employment
education
promise / commitment
world event
commerce
personal goal
```

Education may use subtypes such as:

```text
class
exam
assignment
club
```

without requiring a separate student brain.

Obligations compete for:

- time;
- place;
- priority;
- flexibility;
- travel;
- energy;
- social commitments.

That competition creates life-sim pressure.

---

## 13. Derived semantics

Higher-level consumers should query meaning instead of implementation fields.

Representative queries:

```text
actor.is_student
actor.is_local
actor.is_available_for_chat
actor.can_meet_in_person
actor.is_busy
actor.is_exam_anxious

relationship.is_trusted
relationship.is_conflicted
relationship.has_context("classmate")

knowledge.actor_knows(fact)
knowledge.player_knows(fact)
knowledge.actor_heard(claim)

interaction.can_confide
interaction.can_invite
interaction.can_study_together
```

These should be:
- pure;
- deterministic;
- testable;
- explainable;
- bounded in scope.

Do not create hundreds in advance.

Create a semantic query when at least two real consumers need the same meaning or when exposing raw internals would duplicate logic.

---

## 14. Semantic context / scope

Content should receive the smallest relevant context.

Representative conceptual scope:

```text
actor
target_actor
player
relationship
current_place
current_obligation
current_situation
current_scenario
current_course
current_job
current_online_identity
```

Do not hand Ink or UI the entire mutable simulation state.

A bounded context makes:
- worker serialization smaller;
- tests simpler;
- knowledge safety enforceable;
- content reusable;
- refactors cheaper.

---

## 15. Queries/triggers are read-only

A trigger answers a question.

Examples:

```text
is_student(actor)
is_local(actor)
knows(actor, fact)
is_colocated(actor, player)
has_obligation(actor, "education")
can_interact(actor, player, "study_together")
```

A query/trigger:
- has no side effects;
- cannot mutate canonical state;
- returns an explainable result where useful.

Representative explainable result:

```text
can_study_together = false

✓ both are students
✓ know same course
✓ relationship permits invitation
✗ target is currently in work shift
```

---

## 16. Effects/commands are validated actions

An effect/command requests a change from the owning domain.

Examples:

```text
social.confide
social.apologize
knowledge.reveal
schedule.propose_meetup
education.study_together
employment.request_shift_swap
economy.purchase
```

Ink, UI or AI never apply raw numeric state mutation.

Bad:

```text
trust += 10
money -= 20
location = school
```

Good:

```text
submit SocialAct(confide)
submit Purchase(itemId)
submit TravelRequest(destination)
```

The owner validates current truth and commits consequences.

---

## 17. Influences / modifiers

Use typed, domain-owned influences.

Avoid a universal modifier engine that can mutate arbitrary fields.

Representative resolution:

```text
StudyReadiness
  base
  + disciplined
  + well_rested
  + quiet_place
  - hungry
  - exam_anxiety
  - recent_argument
```

Each influence should expose, where useful:

```text
source
kind
value
duration/validity
provenance
```

Many resolved values should be derived and not persisted.

Current `LifeWorldModifierView` is a good pattern.

---

## 18. Traits create preferences and costs

Traits should influence generic behavior, not merely flavor text.

Examples:

### Discipline

```text
high discipline
→ keeps obligations more strongly
→ prepares earlier
→ breaking own commitments may cause more internal pressure
```

### Shyness

```text
high shyness
→ lower spontaneous in-person initiation
→ online interaction may be easier
→ attraction may be expressed less directly
```

### Spontaneity

```text
high spontaneity
→ more sudden plans
→ accepts unexpected opportunities more often
→ weaker routine adherence
```

### Loyalty

```text
high loyalty
→ stronger promise-keeping preference
→ betrayal produces stronger resentment/internal conflict
```

A character may still act against temperament because obligations, needs or events demand it.

The cost/pressure of doing so helps preserve personality coherence.

---

## 19. Interactions as reusable semantic actions

Away should gradually converge on reusable interactions rather than named-character special cases.

Examples:

```text
Invite
Confide
Apologize
Flirt
AskOut
AskForHelp
OfferHelp
StudyTogether
HangOut
Borrow
Lend
Introduce
Gossip
Confront
Reconcile
AskShiftSwap
```

An interaction can have:

```text
CanUse
Acceptance/priority evaluation
Cost/commitment
Canonical consequences
Narrative intent
```

Example:

```text
StudyTogether
│
├─ can_use?
│   shared education context
│   free/compatible time
│   sufficient knowledge
│
├─ acceptance
│   relationship
│   discipline
│   stress
│   schedule
│
└─ accepted
    create commitment/appointment
```

Ink presents the conversation.

Simulation decides eligibility and outcome.

---

## 20. Explainable scoring

NPC decision scoring should be deterministic and inspectable.

Representative result:

```text
MessagePlayer score = 62

+20 warmth
+15 close relationship
+12 social need
+10 shared event
-25 busy
-20 annoyed
-15 tired
```

Do not expose these raw scores to the player by default.

Expose them to tests/debug tooling.

Player-facing presentation should use human-readable behavior.

---

## 21. Situations

A Situation is a bounded world/social context that modifies opportunities and pressure over a period without becoming a quest script.

Examples:

```text
Finals Week
Graduation Month
Storm Week
Bus Strike
Town Festival
Flu Wave
Local Recession
ISP Launch
School Rumor Cycle
```

A Situation may:
- start/end deterministically;
- publish semantic influences;
- affect availability/opportunities;
- alter content eligibility;
- emit semantic events.

It must not:
- own unrelated domain truth;
- force specific actors into scripted scenes;
- create canonical outcomes outside owning systems.

Example:

```text
Finals Week
→ student stress pressure ↑
→ study opportunities ↑
→ school occupancy ↑
→ late-night online activity ↑
→ work/school conflicts ↑
```

The resulting stories emerge from actors' existing traits, obligations, relationships and choices.

---

## 22. Events are opportunities, not commands

Avoid:

```text
Day 8:
Nina must meet player in café
```

Prefer:

```text
conditions:
- actor is classmate
- actor knows player failed exam
- relationship permits support
- truthful interaction context exists

→ NarrativeOpportunity: comfort_after_exam
```

The eligible actor can be any compatible actor.

Ink may author the interaction.

The simulation remains free to produce different histories.

---

## 23. Fidelity tiers

The current type already contains:

```text
important_local
local_offscreen
background_remote
```

but current behavior does not yet exploit the full distinction consistently.

Target conceptual policy:

### Focused / interacting

Highest semantic fidelity:
- active interaction;
- rich narrative;
- current relationship context;
- detailed Life Matrix;
- full presentation when visible.

This may be represented as an interaction state rather than a persisted tier.

### Important local

Known local actors:
- normal obligations;
- goals;
- relationships;
- travel;
- meaningful events;
- event-driven/coarse simulation.

### Background/offscreen local

Less important local actors:
- schedule/obligation continuity;
- coarse needs/pressure;
- occasional social events;
- lower update frequency;
- no expensive narrative work until promoted.

### Remote known

Canonical social actor:
- relationships;
- online presence/routine;
- meaningful life changes;
- no town spatial/transit simulation while remote.

### Surface-only internet identity

Not a canonical actor:
- no Life Matrix;
- no relationship graph;
- no spatial life;
- content/provenance only until explicit promotion.

Fidelity changes must never fork identity.

---

## 24. Performance law

Do not solve a scheduling problem by rewriting it in Rust.

The semantic architecture should make the simulation cheap before language-level optimization.

Avoid:

```text
every frame
  × every actor
    × every goal
    × every relationship
    × every route
```

Prefer:

```text
semantic event / scheduled boundary
→ wake relevant systems
→ evaluate affected actors
→ publish bounded changes
```

Time jumps should resolve relevant boundaries rather than simulate every rendered frame.

#169/#170 own the first measured implementation step.

---

## 25. Headless long-run simulation

Performance and correctness should eventually be measured across simulated life, not only FPS.

Representative soak fixtures:

```text
20 actors
100 actors
250 actors
500 actors

30 days
1 year
5 years
```

Validators should catch impossible states such as:
- overlapping incompatible obligations;
- remote actor physically present in town;
- actor stranded in transit indefinitely;
- impossible sleep/work duration;
- runaway economy;
- every relationship converging to the same extreme;
- stale Situation never ending;
- knowledge leaking globally without source;
- duplicate identity promotion.

#169 establishes the benchmark harness; later gates can add semantic validators.

---

## 26. Simulation Inspector direction

A complex semantic simulation needs explainability.

Future developer tooling should be able to inspect an actor like:

```text
Actor: alex_0182

Identity
  reach: local
  roles: student, cafe_customer

Traits
  discipline: 82
  warmth: 58
  shyness: 71

Current context
  place: school/library
  obligations:
    15:00 study
    18:00 work shift

Intent
  study

Why?
  + exam tomorrow
  + disciplined
  + library available
  - hungry

Next reevaluation
  15:45
```

And explain a query:

```text
comfort_before_exam eligible?

✓ same course
✓ actor knows exam
✓ relationship trusted
✗ actor busy
```

#187 only needs to establish the explainable contracts/provenance needed for this.

A polished inspector UI can be a later developer-tool issue.

---

## 27. Relationship to Ink

Ink should consume semantic projections rather than engine implementation fields.

Preferred:

```text
actor.is_student
actor.knows(exam_date)
relationship.is("trusted")
interaction.can("study_together")
```

Avoid:

```text
npcLives[id].pressure.stressBand
social.relationships[id].trust > 58
```

Ink may request semantic effects.

Simulation validates them.

AI may realize approved wording.

This keeps authored content stable while engine internals evolve.

---

## 28. Relationship to fake internet

The knowledge/claim separation is essential for generated internet.

Example:

```text
canonical fact:
English exam is Friday.

NightBoard claim:
"heard they cancelled it."

actor A:
heard claim, does not believe it.

actor B:
heard claim, believes it.

player:
has seen the thread.

Education:
exam remains Friday.
```

Generated text may create claims/opinions/rumors where the surface policy allows it.

It never creates canonical world truth by printing a sentence.

---

## 29. Relationship to Education / Senior Year

If this layer is correct, much of Senior Year becomes content plus a focused Education domain rather than a second game engine.

```text
roles:
student
teacher

places:
school
classroom
library

obligations:
class
exam
assignment

situations:
finals_week
graduation_month

interactions:
study_together
ask_for_notes
talk_to_teacher
skip_class

Ink:
school/social flows
```

Education owns grade/course/assignment truth.

Generic simulation owns:
- actors;
- time;
- obligations;
- relationships;
- knowledge;
- location;
- commitments;
- interactions;
- situations.

University later reuses the same primitives.

---

## 30. What not to build

Do not introduce by default:

- a new scripting language;
- a generic Clausewitz/Jomini clone;
- a universal scope interpreter;
- a reflection-driven rule engine;
- a universal ModifierEngine;
- a general-purpose GOAP planner;
- behavior trees for every actor;
- ECS solely for this model;
- per-NPC LLM decision brains;
- persisted booleans for every derived semantic;
- a second character/relationship authority for online identities.

Add a primitive only when real consumers justify it.

---

## 31. Migration priorities

Tracked by #187 and neighboring SIM-KERNEL issues.

### Preserve

- `CharacterTraits`;
- relationship dimensions;
- sparse NPC bonds;
- reach;
- goals;
- obligations;
- intent separation;
- spatial/transit ownership boundaries;
- provenance-based derived world modifiers.

### Refactor

1. split lifecycle/contact concepts from derived relationship stage;
2. evolve important memories from text-only truth toward structured semantic records;
3. separate world fact / actor knowledge / claim / player knowledge;
4. stop universal triggered-event knowledge as the long-term model;
5. make fidelity tiers affect simulation cost/behavior;
6. introduce bounded semantic query/context contracts;
7. add typed domain effects/commands only where shared consumers need them;
8. preserve provenance/explanations for derived scores/influences.

---

## 32. Proof slice after the refactor

Before building full Senior Year, prove the architecture with a tiny non-product fixture:

```text
2 local students
1 remote online friend
1 teacher

1 class
1 exam
1 work shift

Situation:
Finals Week

Interactions:
StudyTogether
AskForHelp
SkipClass

Knowledge:
canonical exam date
one false forum rumor

Memory:
studied together

Narrative:
one school Ink flow
one Pulse Ink flow
one NightBoard thread
```

The proof should demonstrate:

- no hardcoded named actor dependency;
- local/remote physical rules;
- rumor ≠ truth;
- actor-specific knowledge;
- structured memory callback;
- obligation conflict;
- explainable intent;
- Situation influence;
- bounded Ink context;
- full offline functionality.

This fixture belongs to the final SIM-KERNEL/Ink readiness gates, not to production Senior Year content.

---

## 33. Product law

> **A character is not a script.**
>
> A character is a relatively small amount of persistent identity, temperament, relationship, knowledge, memory, goals, commitments and irreducible state living inside shared world systems.
>
> Rich stories emerge when those systems intersect.

This is the semantic foundation for growing Away Message from Senior Year into university, work and later life without rebuilding the game around each life stage.

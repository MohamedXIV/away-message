# Optional Scenarios and Story Threads

Status: **Canonical product/architecture direction for optional semi-baked scenarios**

This document defines how Away Message may add authored personal context and local story structure **without turning the open-ended sandbox back into a fixed campaign**.

The design deliberately preserves the product laws already established in `AGENTS.md`, especially:
- no mandatory named core character;
- no fixed romance route;
- no required global story;
- no fixed ending/day limit;
- dynamic roster;
- simulation authorities remain canonical;
- rules decide state, AI only paraphrases approved surfaces.

The working product term is **Scenario**. A player-facing name may later differ.

---

## 1. Why scenarios exist

Pure sandbox systems can create rich emergent play, but a player avatar may still feel as if they arrived in town with no personal history, unresolved past, social context, or reason to care about particular discoveries.

Scenarios add **authored framing**.

They do not prescribe a route.

A Scenario may establish something like:

> The player grew up in a nearby village. Years ago they knew someone from this town. There was an unresolved almost-romantic closeness. The player knows that person is associated with this town, but does not know their current address or even whether they still live here.

The game does **not** then require:
- a named Maya;
- a Find Maya quest;
- a day on which this thread unlocks;
- a romance outcome;
- even a successful reunion.

The sandbox simply begins with a personal thread that may later become relevant.

---

## 2. Core definition

> **Scenario = authored situation + dynamic role binding + optional opportunities, not a quest script.**

A Scenario supplies:
- preconditions/eligibility;
- semantic roles;
- authored pre-game or current-context facts;
- bounded hooks/opportunities;
- optional scenario-local progress metadata;
- optional projection data for future player-facing presentation.

It does **not** become a second authority for:
- actor location;
- relationships;
- jobs;
- appointments;
- world events;
- transit;
- money;
- items;
- residence;
- canonical knowledge;
- Life Matrix intent;
- conversation outcomes.

Those remain with their owning systems.

---

## 3. Three-layer model

The canonical conceptual split is:

```text
ScenarioDefinition
    authored reusable template
            ↓
ScenarioInstance
    save-specific role bindings + scenario-local state
            ↓
ScenarioProjection
    optional read model for player-facing presentation
```

### ScenarioDefinition

Static authored content.

Representative shape:

```ts
interface ScenarioDefinition {
  id: ScenarioId;
  tags: string[];

  eligibility?: ScenarioEligibility;
  roles: Record<ScenarioRoleId, ScenarioRoleDefinition>;

  initialFacts: ScenarioSeedFact[];
  hooks: ScenarioHookDefinition[];

  presentation?: {
    titleKey?: string;
    summaryKey?: string;
  };
}
```

Exact names may differ.

### ScenarioInstance

Per-save state created only when the definition successfully instantiates.

Representative shape:

```ts
interface ScenarioInstance {
  id: ScenarioInstanceId;
  definitionId: ScenarioId;

  bindings: Record<ScenarioRoleId, ActorId | null>;

  startedAtMinute: number;
  state: 'active' | 'dormant' | 'resolved' | 'abandoned';

  consumedHookIds: string[];
  scenarioFacts: Record<string, ScenarioLocalValue>;
}
```

Only **scenario-owned facts** belong here.

Do not copy canonical relationship/location/job/item state into this object.

### ScenarioProjection

A read-only semantic projection suitable for future surfaces.

Possible future presentation modes include:
- completely hidden;
- memory/background;
- rumor;
- journal note;
- Inner Voice;
- soft objective;
- mini-quest;
- website/search clue;
- conversation cue.

The framework must **not** decide now that every Scenario is a visible quest.

---

## 4. Dynamic role binding

Scenario definitions refer to semantic roles, never sacred actor IDs.

Example:

```text
Scenario: someone_from_before
Role: old_acquaintance
```

At save/world creation:

```text
old_acquaintance
      ↓
eligible dynamic actor
      ↓
actor_184
```

The template must remain valid whether the bound actor is:
- an authored seed actor;
- a generated local;
- a renamed legacy actor;
- a person the player never manages to meet.

Do not write:

```ts
actorId: 'maya'
```

as product authority.

A legacy actor named Maya may still happen to satisfy the role in a particular save. That is ordinary content, not a requirement.

---

## 5. Binding rules

Role resolution must be:
- deterministic for a given seed/content/state where required;
- data-driven;
- explainable;
- bounded;
- compatible with dynamic rosters.

Role constraints may include semantic conditions such as:
- plausible age/history range;
- origin/background compatibility;
- town/locality association;
- relationship eligibility;
- occupation/role compatibility;
- gender or attraction compatibility only where a specific scenario genuinely requires it;
- availability/presence constraints;
- exclusion of incompatible role collisions.

Constraints must not become character-specific hardcoding.

### Failed binding is valid

A Scenario does not have to instantiate.

If required roles cannot be resolved safely:

```text
definition exists
→ binding fails
→ no ScenarioInstance
```

That is preferable to forcing a named character into every save.

A future character-generation policy may explicitly permit creating a compatible actor for some scenarios, but Scenario itself must not secretly bypass roster-generation rules.

---

## 6. Pre-game history and initialization

Scenarios may establish facts that happened before playable time.

Examples:
- the player knew someone years ago;
- the player comes from a nearby village;
- a family friend once helped the player;
- the player remembers a place imperfectly;
- someone owes the player a favor;
- the player left a relationship unresolved.

The Scenario framework may request **initialization transactions** into canonical owners.

Example:

```text
ScenarioDefinition
  old_acquaintance role
        ↓
scenario initialization
        ├─ SocialEngine: seed appropriate prior familiarity/history
        ├─ Player Knowledge: seed only facts the player should know
        └─ ScenarioInstance: remember role binding + thread provenance
```

Scenario must not maintain a second hidden copy of relationship truth.

If the Scenario says there was "almost-romantic closeness," canonical social/relationship state should be initialized accordingly through the normal Social authority.

---

## 7. Scenario-owned versus domain-owned truth

### Scenario may own

- definition ID;
- per-save instance ID;
- role bindings;
- which optional scenario hook has already been consumed;
- scenario-local provenance;
- scenario-local state such as active/dormant/resolved when that state is truly specific to the thread;
- references to canonical records.

### Scenario must not own

- exact actor position;
- route/travel state;
- appointment outcome;
- job status/wages;
- current relationship dimensions;
- item ownership/location;
- current residence;
- WorldEvent status;
- Life Matrix intent;
- player knowledge that already has a canonical knowledge owner;
- canonical conversation history.

Prefer references/projections over copies.

---

## 8. Observation and hooks

Scenarios should primarily **observe canonical simulation** and expose optional hooks when conditions become true.

Example:

```text
player searches an old surname
        ↓
Search / Player Knowledge changes
        ↓
Scenario observes a relevant canonical fact
        ↓
optional hook becomes available
```

A hook may lead to:
- a line of Inner Voice;
- a discoverable web page;
- a rumor from an NPC;
- an address clue;
- a phone number;
- a chance encounter;
- no immediate visible presentation at all.

Hooks are not mandatory objectives.

They should be deterministic/seeded according to existing game rules and must not force canonical outcomes.

---

## 9. Outcomes are systemic

Scenario definitions may describe possible **resolution categories**, but ordinary systems should produce the actual result.

For `someone_from_before`, possible outcomes may include:

- the player never finds the person;
- the person left town;
- they meet accidentally;
- the player actively traces them through local information;
- they reconnect as friends;
- a romance develops;
- the relationship goes badly;
- the person is already committed elsewhere;
- the player decides not to pursue the thread;
- the memory mattered more to the player than to the other person.

Do not encode these as a mandatory branching route unless a future specific scenario explicitly needs an authored branch.

Relationships remain SocialEngine truth.

Presence remains spatial/Life Matrix truth.

Knowledge remains knowledge truth.

---

## 10. First reference scenario — Someone From Before

This is the canonical design example, inspired by an old direction for the game but rewritten to obey the open-ended sandbox model.

### Premise

- The player comes from a nearby village/area.
- Years ago, the player knew someone associated with the current town.
- There was some unresolved emotional or almost-romantic closeness.
- The player remembers the person but does not have reliable current contact/address information.
- The player may not know whether the person still lives in town.

### Dynamic role

```text
old_acquaintance
```

The role may bind to any compatible actor.

The Scenario must never require the actor to be named Maya.

### Initial knowledge examples

The player may know:
- the person's name at the time they knew them;
- that they were from/connected to this town;
- one old memory;
- perhaps one old username, school/work detail, surname, or mutual acquaintance.

The player should **not** automatically know:
- current address;
- current job;
- current relationship status;
- current phone number;
- hidden social state.

### Discovery routes

Potential routes may include:
- local search;
- old forum/profile;
- asking another person;
- finding a surname/address reference;
- chance physical overlap;
- no discovery.

No route is mandatory.

---

## 11. Additional scenario families

The framework should be generic enough for other semi-baked threads.

### Family Connection

A distant relative, family friend, or parent acquaintance may live locally.

The relationship can be warm, strained, useful, awkward, or irrelevant.

### Old Debt

Someone once helped the player, or the player feels they owe someone.

This may be financial, practical, or purely emotional.

### Bad History

A person from the past is someone the player would rather avoid.

They may or may not still be in town.

### The Place You Remember

The player vaguely remembers a place from childhood or an earlier visit.

The remembered version may be incomplete or outdated.

### Friend of a Friend

The player has an old contact name/number/handle from someone else:

> "If you ever end up there, ask for..."

The contact may be useful, distant, changed, or unreachable.

### First Job Lead

The move was partially motivated by a rumor or personal lead about work.

This is not guaranteed employment.

---

## 12. Multiple scenarios per save

A save may instantiate several compatible scenarios.

Example:

```text
Someone From Before
Family Connection
First Job Lead
```

They may overlap naturally through shared canonical actors/places/systems.

Avoid artificial isolation.

A bound actor may participate in more than one thread only when constraints allow it and doing so does not collapse the town into a tiny cast.

---

## 13. Scenario selection

Initial policy should be bounded and deterministic.

Possible first implementation:

- choose from eligible authored definitions at new-game initialization;
- use a deterministic seed;
- respect mutually exclusive tags/role conflicts;
- support zero scenarios;
- support a small configurable number, for example 0–3 or 1–3, without making that number a product law;
- allow future player setup/preferences to influence eligibility without requiring it now.

Do not hard-code that every save must receive a romantic scenario.

---

## 14. Player-facing presentation is intentionally deferred

The first framework should work even if no dedicated Scenario UI exists.

Do not commit yet to:
- quest log;
- objective tracker;
- exclamation marks;
- map markers;
- visible completion percentages;
- XP rewards.

The first implementation may expose only semantic read data and use existing surfaces where appropriate.

A later UX decision may choose among:
- hidden story threads;
- journal/memory entries;
- subtle goals;
- mini-quests;
- phone notes;
- Inner Voice prompts;
- mixed presentation per Scenario.

That choice is separate from Scenario authority.

---

## 15. Inner Voice integration

Inner Voice is a natural presentation surface, but Scenario does not bypass its governance.

Scenario may expose an approved semantic cue such as:

```text
remembered_old_acquaintance_nearby
```

Inner Voice rules decide:
- whether now is an appropriate moment;
- priority/cooldown/dedupe;
- knowledge safety;
- deterministic fallback.

AI may only paraphrase the approved meaning.

---

## 16. Internet/search integration

Scenario threads can reuse the fake internet and search systems without adding privileged knowledge.

Examples:
- an old forum post;
- an obsolete username;
- an archived profile;
- a local directory entry;
- a CityWire article;
- a classified/listing;
- a school/work reference.

Search results must still respect authored index/knowledge rules.

Scenario does not magically reveal a matching page.

---

## 17. Life Matrix and encounters

Scenario does not schedule actors into place merely to satisfy a story beat.

If a reunion occurs physically:

```text
Scenario role binding
        +
normal actor Life Matrix/schedule
        +
normal transit/presence
        +
player location
        ↓
truthful opportunity to meet
```

A future bounded opportunity modifier may increase plausibility, but it must not teleport actors or overwrite canonical intent without explicit domain-supported rules.

---

## 18. Content pipeline

Scenario definitions are authorable content.

Target flow:

```text
Content UI / TinyBase
        ↓
scenario definitions
        ↓
schema validation
        ↓
generated typed registry
        ↓
Scenario runtime
```

Do not create a second hand-maintained TypeScript scenario catalog as permanent authority.

Per-save ScenarioInstances remain save/simulation state, not static content.

---

## 19. Persistence and determinism

Persist:
- instantiated definition IDs;
- resolved role bindings;
- scenario-local consumed hooks/provenance/state that cannot be derived safely.

Derive where possible:
- current relationship state;
- current place;
- current knowledge;
- current availability;
- current domain outcomes.

For a current-format save:
- reload must preserve the same bindings;
- time jumps must not reroll roles;
- hooks must not duplicate unintentionally;
- deterministic initialization from the same seed/content should remain reproducible where required.

Historical development-save compatibility remains subject to the pre-freeze save policy.

---

## 20. Scenario state is not "quest completion"

A Scenario may be:
- active;
- dormant;
- resolved;
- abandoned.

These states are internal thread lifecycle concepts.

They do not imply:
- game completion;
- reward chest;
- mandatory success;
- failure screen.

A dormant or abandoned Scenario can be a perfectly valid life outcome.

---

## 21. Architecture boundary

Recommended conceptual owner:

```text
ScenarioDirector / ScenarioEngine
```

Exact name is implementation detail.

It may:
- instantiate definitions;
- bind roles;
- coordinate initialization transactions;
- observe canonical state/events;
- keep scenario-local lifecycle/provenance;
- produce ScenarioProjection.

It must not become:
- NarrativeEngine 2;
- SocialEngine 2;
- Life Matrix 2;
- Quest-state copy of the simulation.

---

## 22. Testing laws

At minimum prove:

### Definitions and binding
- deterministic eligibility/binding;
- no sacred actor ID required;
- failed binding safely skips/non-instantiates;
- conflicting role constraints resolve deterministically;
- same current-format save keeps the same bindings.

### Initialization
- pre-game relationship/history is seeded through canonical Social authority;
- player knowledge is seeded only through the canonical knowledge path;
- no duplicate relationship/knowledge truth lives in Scenario state.

### Observation/hooks
- hooks react to canonical facts/events;
- one-shot hooks do not duplicate across ticks/reload;
- Scenario does not mutate unrelated authority directly;
- time jumps do not reroll bindings.

### Dynamic-roster resilience
- reference Scenario works with a non-Maya actor;
- removing/renaming legacy seed actors does not invalidate the framework;
- a save may contain zero eligible scenarios without breaking core gameplay.

### Presentation boundary
- framework functions with no quest UI;
- ScenarioProjection can be consumed without exposing hidden actor facts;
- Inner Voice integration remains governed/knowledge-safe.

---

## 23. Non-goals

The first Scenario foundation does **not** require:

- a main quest;
- a visible quest log;
- mandatory romance;
- Maya;
- fixed campaign chapters;
- fixed day triggers;
- scripted actor teleportation;
- authored endings;
- rewards/XP;
- replacing emergent social simulation;
- making every save instantiate every Scenario;
- AI selecting canonical outcomes.

---

## 24. Product law for future agents

If a future Scenario proposal requires:

> "This exact named character must exist and the player must meet them for the game to work,"

then the proposal conflicts with the sandbox direction unless the user explicitly changes the product.

The correct default is:

```text
authored situation
+ semantic roles
+ dynamic binding
+ canonical simulation
= optional personal story
```

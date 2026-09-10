# Away Message — Orion Salvage and Life Matrix Integration Design

Date: 2026-09-10
Status: approved design direction; implementation planning follows after review

## Purpose

Away Message should take the strongest systemic ideas from Orion without importing Orion as a second game architecture.

The goal is **best of both worlds**:

- preserve Away Message systems that are already implemented and stronger for this project;
- adapt Orion concepts only where they add missing depth;
- merge overlapping concepts behind one authority instead of creating parallel state;
- explicitly reject Orion assumptions that conflict with Away Message's authored-scene, non-open-world direction.

This document is the canonical salvage rule for future work involving Life Matrix, character simulation, social state, travel, jobs, appointments, deliveries, world events, and physical/online presence.

---

## 1. Primary law: extend authorities, do not duplicate them

A useful Orion idea does **not** automatically justify a new engine.

Before adding a system, first ask:

1. Does Away already own this truth?
2. If yes, can Orion's idea become an input, policy, projection, or extension of that owner?
3. If not, is a new bounded authority actually required?

There must never be two competing canonical stores for the same fact.

Examples:

- relationships remain owned by Away's social domain;
- appointments remain owned by the appointment/world state path;
- world events remain owned by the world-events domain;
- physical items remain owned by the physical ownership/location model;
- travel timing remains owned by the shared town/transit planner;
- Life Matrix must not copy any of those truths into a second private database.

The desired architecture is orchestration over existing authorities, not replacement by a monolith.

---

## 2. Life Matrix role in Away Message

Orion's useful Life Matrix concept is retained, but its role is narrowed and made compatible with Away.

Conceptually:

```text
Character Life Matrix
        │
        ├── Routine / flexible schedule
        ├── Obligations
        ├── Needs / current pressure
        ├── Personal goals
        ├── Dynamic opportunities / disruptions
        │
        ├── reads SocialEngine truth
        ├── reads WorldEventsEngine truth
        ├── reads appointments / jobs / commerce truth
        ├── reads body/economy/context truth
        └── asks TransitNetwork for travel truth

                    ↓

             CharacterIntent
                    ↓
        departure / travel / activity
                    ↓
       consequences committed by the
       subsystem that already owns them
```

The Life Matrix therefore owns **intent orchestration** for a person's life.

It does not own relationships, payments, appointments, parcels, transit topology, or world events.

### Why this matters

A confirmed café appointment may create an obligation in the Life Matrix, but:

- RSVP remains appointment/social authority;
- relationship consequences remain social authority;
- destination availability remains place/world authority;
- route and arrival time remain transit authority;
- the Life Matrix decides when the character should prepare/leave and what competing intention wins.

This separation is the core integration rule.

---

## 3. Salvage decision matrix

### 3.1 Relationships and social graph — KEEP AWAY, enrich through Life Matrix

**Current Away authority:** `SocialEngine` and the existing character/social state.

Away already has richer relationship machinery than a generic Life Matrix requires, including:

- player↔NPC relationship dimensions;
- directed NPC↔NPC bonds;
- symmetric affinity ties;
- stable character traits;
- memories and promises;
- social agenda data;
- mediations;
- witnessable NPC↔NPC interactions;
- relationship lifecycle state;
- persistence and deterministic social deltas.

**Decision:** do not port a second Orion relationship graph.

The Life Matrix consumes this social truth as an input.

Examples:

- a promise may become a high-priority obligation;
- affection/comfort can make a social visit more likely;
- resentment can make avoidance more likely;
- trust may change how much reason a character reveals when leaving;
- a strong NPC↔NPC bond can produce a visit or shared activity;
- a damaged tie can reduce willingness to reschedule a missed meeting.

Relationship dimensions remain canonical only in the existing social authority.

### 3.2 Personality, identity, memory, knowledge — KEEP AWAY; selectively enrich

**Current Away authority:** character definitions/engine + SocialEngine + world knowledge state.

Keep:

- stable identity;
- traits;
- dynamic roster support;
- memories/promises;
- relationship history;
- per-character world-event knowledge/attitude;
- existing knowledge safety rules.

Adapt from Orion only the useful conceptual separation between:

```text
world truth
character knowledge
character belief
character claim
player knowledge
```

Do not give Life Matrix or AI unrestricted hidden truth.

Future values/preferences may be added as authored character data if they materially affect decisions. They should not become another personality engine.

### 3.3 Routine and agenda — MERGE

**Current Away authority:** existing weekly schedules, schedule blocks, and social agendas.

**Useful Orion addition:** schedules should describe normal rhythm and preferred timing rather than teleportation commands.

Evolve current routine data toward concepts equivalent to:

- preferred time;
- acceptable window;
- priority;
- location/destination;
- flexibility;
- prerequisites;
- consequence of lateness/failure where meaningful.

Existing schedules remain migration input. Do not discard working presence/schedule behavior in one rewrite.

The Life Matrix should translate routine pressure into intents.

### 3.4 Obligations — ADAPT ORION AS A NEW BOUNDED LAYER

This is one of the most valuable missing pieces.

An obligation represents something a character needs or intends to satisfy, such as:

- work shift;
- confirmed appointment;
- promise;
- pickup;
- delivery;
- paying something;
- visiting another person;
- buying groceries;
- returning an item;
- calling or messaging someone;
- attending a local event.

An obligation should reference its source authority instead of copying it.

Conceptual shape:

```ts
interface CharacterObligation {
  id: string;
  actorId: string;
  source: 'routine' | 'appointment' | 'job' | 'promise' | 'commerce' | 'world_event' | 'personal_goal';
  sourceId?: string;
  preferredAt?: number;
  earliestAt?: number;
  latestAt?: number;
  destinationPlaceId?: string;
  priority: number;
  status: 'pending' | 'planned' | 'in_progress' | 'satisfied' | 'missed' | 'cancelled';
}
```

Exact fields may differ. The important rule is referential ownership.

### 3.5 Needs and current state — KEEP AWAY FOR PLAYER; ADD LIGHTWEIGHT NPC PRESSURE

Away already has player body/economy systems. Do not rebuild them inside Life Matrix.

For important NPCs, add only enough state to create believable decisions, for example:

- energy/fatigue pressure;
- stress;
- broad mood;
- available money band where actually relevant;
- hunger/need only when it changes behavior;
- current activity and interruption tolerance.

This must stay lightweight. We are not building Sims-style meter maintenance for every NPC.

NPC state should be event-driven/coarsely advanced off-screen where possible.

### 3.6 Personal goals — ADAPT ORION, KEEP SMALL

Personal goals provide medium-term direction beyond today's schedule.

Examples:

- save for a purchase;
- find better work;
- repair a strained relationship;
- spend more time with a person;
- avoid someone;
- attend an event;
- finish a practical task;
- upgrade a computer;
- move toward or away from a life circumstance.

Goals should influence obligation generation and intent scoring, not script exact daily choreography.

Important characters should have a small bounded set of goals. Background characters need less or none.

Goals are game-authored/system-generated semantic state. AI may phrase them but must not invent canonical goals freely.

### 3.7 World events — KEEP AWAY, EXPAND CONSEQUENCES

**Current Away authority:** `WorldEventsEngine`.

Keep the existing deterministic event catalog, triggered state, flags, and per-character knowledge/attitudes.

Adapt Orion's stronger idea that events affect existing systems rather than merely produce news/context.

Examples:

- storm → bus delay + lower outdoor activity;
- sick day → staffing change or cancelled obligation;
- courier backlog → delivery ETA modifier;
- local festival → new social opportunity and changed place activity;
- outage → computer/internet constraints;
- shop closure → rerouted errand.

The event engine publishes conditions/modifiers. It must not implement duplicate travel, job, or commerce rules internally.

### 3.8 Appointments — KEEP AWAY, PROJECT INTO OBLIGATIONS

**Current Away authority:** existing `AppointmentDirector` plus canonical appointment state.

Do not replace RSVP/show logic.

Once an appointment becomes authoritative, expose it to Life Matrix as an obligation with:

- destination;
- arrival window;
- participants;
- priority/flexibility;
- cancellation state.

The Life Matrix handles preparation and departure timing.

Transit determines plausible arrival.

Appointment/social systems commit attendance, lateness, cancellation, and relationship consequences.

### 3.9 Jobs and work — KEEP AWAY, PROJECT ACCEPTED WORK INTO LIFE

**Current Away authority:** `JobDirector`, economy/work rules, existing appointment integration.

Do not build an Orion jobs subsystem in parallel.

Adapt the valuable behavior:

- accepted work creates a real obligation;
- work belongs to a place and time window;
- travel time matters;
- current energy/state can affect what is feasible;
- lateness/absence can have consequences;
- relationships may continue affecting access/opportunity through current rules.

Job discovery/application/acceptance stays with current Away systems.

### 3.10 Transit and physical travel — KEEP THE NEW AWAY DIRECTION

**Current/future Away authority:** district-aware `TransitNetwork` and shared travel planner from the approved district/transit direction.

Life Matrix asks transit for a route and expected timing. It does not estimate travel itself.

This creates the Orion behavior we want:

```text
obligation pressure
→ prepare
→ depart
→ walk/wait/bus/transfer
→ arrive
→ perform activity
```

without importing Orion's continuous isometric movement model.

### 3.11 Local/remote/online presence — MERGE CAREFULLY

Retain Orion's strong principle that local and remote are **presence modes of the same person**, not different character classes.

Integrate this with Away's existing social/presence systems and future physical travel state.

Conceptually distinguish:

- physical place/presence;
- `in_transit`;
- remote/off-town;
- online active;
- online idle/away;
- unavailable.

Do not permit contradictory truth such as a character physically riding a bus while also actively chatting from their home desktop unless a period-appropriate device/context actually permits it.

Presence should be a projection of physical/device/life state, not a detached messenger flag.

Do not rewrite the entire current presence system in one issue; migrate it behind a coherent resolver.

### 3.12 Commerce, orders, parcels, pickup — MERGE INTO AWAY'S EXISTING OWNERSHIP/D DELIVERY PATH

**Current Away authority:** `DeliveryEngine` plus the newer physical item ownership/location rules.

Away already persists deliveries and supports deterministic ETA behavior, but current scope is narrower than the desired world.

Adapt the stronger lifecycle:

```text
purchase
→ fulfillment selected
→ shipment/preparation
→ parcel or pickup becomes physically available
→ player/NPC receives or collects it
→ contained items gain real physical locations
```

Do not add an independent CommerceEngine if `DeliveryEngine` can be evolved/generalized behind a clearer fulfillment contract.

The key integration target is the existing physical-world issue for parcels/bags/delivery/pickup.

### 3.13 NPC↔NPC life and co-location — KEEP AWAY SOCIAL RESULTS, IMPROVE PHYSICAL CAUSALITY

Away already has deterministic NPC↔NPC social interactions and bond changes.

Keep those rules.

Improve the cause of encounters so they increasingly derive from:

- real overlapping plans;
- destination activity;
- transit co-location;
- work shifts;
- social obligations;
- events;
- shared places.

The social engine owns the relationship result. Life/transit owns why the people were in the same place/time.

This removes arbitrary-feeling run-ins without replacing the proven social machinery.

### 3.14 Encounter Director — ADAPT LATER AS A SURFACING LAYER

A lightweight encounter selector is useful only after trustworthy co-location, obligations, places, and world events exist.

It may select which eligible event is surfaced to the player based on:

- current place;
- present people;
- time/weather;
- recent cooldowns;
- relationship context;
- active obligations/events.

It must not spawn fake canonical people or relationships merely to create drama.

Treat it as presentation/opportunity selection over simulation truth.

### 3.15 Physical location catalog / service ecology — ADAPT CONTENT, NOT ORION GEOMETRY

Retain useful Orion categories and service-loop ideas where they fit Away:

- motel services;
- diner/café;
- library;
- computer/electronics shop;
- copy/print;
- internet café;
- park/canal;
- convenience store;
- jobs and small services.

Map them into Away's district/place content model.

Do not import Orion's exact village geometry or continuous movement assumptions.

### 3.16 Continuous isometric open world — REJECT

Do not import:

- one continuous traversable village renderer;
- WASD city traversal as the default physical loop;
- canonical per-meter NPC movement everywhere;
- isometric world-coordinate requirements;
- Arcade/Matter movement architecture as the basis of travel;
- flattened requirement that every interior be part of one continuous map.

Away keeps its authored living scenes, focus views, district navigation, walking abstractions, and bus network.

One simulation does not require one continuously rendered map.

### 3.17 Action-card/menu fallback as normal physical UX — REJECT AS DEFAULT

Orion's Action Card fallback was useful for shipping incomplete spatial locations, but Away's chosen physical direction is stronger:

- actual objects;
- shelves;
- counters;
- people;
- doors;
- focus views;
- living authored scenes.

A temporary/debug/fallback action surface may exist for unproduced content, but it must not define the target physical interaction language.

### 3.18 AI character boundary — KEEP AWAY'S AUTHORITY, ADOPT THE STRONGEST ORION FORMULATION

Life Matrix decisions are rules/state decisions.

AI can help interpret or phrase communication, but it must not become authority for:

- relationship deltas;
- current location;
- route choice truth;
- obligation completion;
- money/items;
- event truth;
- appointment feasibility;
- canonical goals;
- hidden knowledge.

The concise law remains useful:

> The game runs the character; AI speaks for the character within approved truth.

This should coexist with Away's current AI-heavy conversation goals without turning the LLM into simulation state.

---

## 4. Proposed ownership boundaries

The intended long-term dependency shape is:

```text
Character definitions / SocialEngine
  ├── identity
  ├── traits
  ├── relationships
  ├── NPC bonds / affinity
  ├── memories / promises
  └── social outcomes

WorldEventsEngine
  ├── global/local events
  ├── event knowledge
  └── bounded world modifiers

Appointment / Job / Commerce authorities
  └── source records and consequences

TransitNetwork
  └── feasible routes, wait, fare, travel duration

Life Matrix / Life Director
  ├── reads all of the above
  ├── routine pressure
  ├── obligations
  ├── lightweight current-state pressure
  ├── personal goals
  ├── intent scoring
  └── departure/activity orchestration

Presence Resolver
  └── projects physical + transit + device + life state
      into messenger/world availability

Phaser / React / character renderer
  └── presentation only
```

No arrow implies ownership reversal.

---

## 5. Life Matrix output contract

Life Matrix should produce semantic intents rather than directly mutating unrelated systems.

Example intent kinds:

```text
stay_current_activity
prepare_to_leave
travel_to_place
perform_work
attend_appointment
shop_for_need
visit_person
return_home
use_computer
call_or_message
rest_or_sleep
pursue_personal_goal
```

An intent should explain enough deterministic context for debugging/testing:

- actor;
- reason/source obligation or goal;
- selected destination/activity;
- priority/score;
- earliest/latest timing;
- required route if applicable;
- blockers;
- expected completion/reevaluation point.

The exact scoring formula can evolve. It must remain testable and deterministic for the same state/seed.

---

## 6. Layered simulation fidelity

Not every person needs identical simulation cost.

Use at least three conceptual fidelity bands:

### Important local / currently relevant character

- full current intent;
- active obligations;
- transit state;
- social context;
- lightweight needs/pressure;
- observable current activity.

### Known but off-screen local character

- same canonical identity/relationships;
- coarser life advancement;
- travel/activity transitions resolved by time boundaries;
- no renderer pathfinding requirement.

### Remote/background person

- event-driven routine/presence;
- broad location/state;
- online/device context;
- obligations/social events only when relevant.

A character moving between fidelity bands must preserve identity/history and must not duplicate state.

---

## 7. Safe migration strategy

Do not create a giant `LifeMatrixEngine` PR that rewrites SocialEngine, schedules, jobs, appointments, transit, and persistence simultaneously.

Preferred progression:

1. document ownership and add read-only adapters/selectors around current systems;
2. introduce obligation + intent contracts with no behavior replacement;
3. feed current schedules/appointments/jobs/promises into obligations;
4. introduce deterministic intent selection;
5. connect transit/departure/arrival;
6. migrate physical/online presence to consume real life/transit truth;
7. expand NPC current-state pressure and personal goals;
8. connect commerce/world-event modifiers;
9. replace old teleport/run-in shortcuts only after equivalent behavior is proven;
10. remove compatibility bridges once no caller depends on them.

Each step must keep one authoritative source per fact.

---

## 8. Testing laws

Implementation plans must include tests proving at minimum:

- Life Matrix does not store a duplicate relationship matrix;
- changing a SocialEngine relationship changes later intent input without synchronization code;
- a confirmed appointment creates/references an obligation without duplicating RSVP truth;
- an accepted job creates/references a work obligation without duplicating job acceptance truth;
- a promise can influence an obligation while promise ownership remains social;
- schedules create departure pressure rather than destination teleportation;
- transit timing determines actual arrival;
- large time jumps and minute-by-minute advancement resolve equivalent completed trips/obligations;
- an in-transit character is not simultaneously physically present at either endpoint;
- online presence does not contradict physical/device state;
- world events modify existing system conditions without copying their state;
- NPC↔NPC interaction still commits through existing social rules when co-location comes from Life Matrix/transit;
- save/load preserves active obligations/intents/travel deterministically;
- old saves migrate without inventing relationships, goals, obligations, or completed actions.

---

## 9. Relationship with existing living-world roadmap

This design sits above and connects the already-approved physical-world direction rather than replacing it.

Important existing work remains valid:

- physical content authoring;
- universal item/location ownership;
- Phaser 4 living-place runtime;
- generic place/view/focus/anchor model;
- lighting/weather/audio/character rendering;
- parcels/delivery/pickup;
- district-aware TransitNetwork;
- district/bus presentation;
- NPC departure/transit/arrival continuity.

The Life Matrix should become the character-life orchestration layer that connects those systems to Away's existing SocialEngine, appointments, jobs, economy, and world events.

The future implementation plan should update the roadmap/issues so this dependency is explicit rather than allowing #37 or another travel issue to accidentally become a standalone character-life rewrite.

---

## 10. Final design rules

1. **Best of both worlds means selective integration, not porting Orion wholesale.**
2. **Existing Away authorities win when they already own mature state.**
3. **Life Matrix owns intent orchestration, not every piece of character truth.**
4. **SocialEngine remains the relationship/social authority.**
5. **Schedules create pressure and intentions, not teleportation.**
6. **Appointments, jobs, promises, commerce and events feed obligations through references.**
7. **Transit owns route/time/fare truth for both player and NPCs.**
8. **Presence is derived from physical/transit/device/life truth, not an isolated chat flag.**
9. **World events modify existing systems instead of creating parallel simulation.**
10. **NPC↔NPC social outcomes remain in Away's existing social machinery; Life Matrix improves why/where encounters happen.**
11. **The authored district/place presentation remains; Orion's continuous isometric world is rejected.**
12. **Migration must be incremental, testable, save-safe, and authority-preserving.**

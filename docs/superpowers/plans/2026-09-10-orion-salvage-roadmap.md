# Orion Salvage Integration Roadmap

> This roadmap decomposes the approved `2026-09-10-orion-salvage-life-matrix-design.md` into independently reviewable workstreams. It is not permission to implement the whole design in one PR.

## Goal

Take the strongest systemic ideas from Orion while preserving Away Message's existing, already-working authorities. The target is a richer living-character simulation layered over the current SocialEngine, appointments, jobs, events, delivery/ownership, district/transit, and authored-scene world — not a second parallel simulation.

## Governing law

For every imported concept, classify it as one of:

- **KEEP AWAY** — Away already owns the truth; do not duplicate it.
- **MERGE** — evolve the existing Away owner with a compatible contract.
- **ADAPT ORION** — add the missing concept as a bounded layer that reads existing truth.
- **REJECT** — do not import the Orion assumption because it conflicts with Away's direction.

The canonical design matrix lives in:

`docs/superpowers/specs/2026-09-10-orion-salvage-life-matrix-design.md`

## Existing authorities that remain authoritative

```text
SocialEngine
  = relationships, NPC↔NPC bonds, affinity, traits, memories,
    promises, social outcomes, existing agenda/social history

WorldEventsEngine
  = triggered events, flags, per-character event knowledge/attitudes

AppointmentDirector + world appointment state
  = appointment truth, RSVP/show/cancel consequences

JobDirector + work/economy paths
  = job discovery/application/acceptance and work consequences

DeliveryEngine + physical ownership model
  = order/fulfillment timing and physical ownership/location evolution

TransitNetwork / TravelPlanner (#35)
  = route feasibility, service, waits, fares, durations, active travel truth

Life Matrix
  = intent orchestration only
```

No child issue may create a second canonical relationship graph, appointment store, travel calculator, delivery ledger, event catalog, or player/NPC location truth.

---

## Workstream A — Life Matrix foundation

**Priority:** P0
**Gate:** start implementation only from the latest safe base after #14 closes/PR #4 is ready, because the current worker is still changing `SimulationEngine*` and nearby integration code.

Deliverables:

- renderer-neutral `src/engine/life/` package;
- stable semantic types for life snapshots, obligation references, and future intents;
- read-only source adapters over current Away authorities;
- deterministic `getLifeSnapshot(actorId, now)`-style projection;
- zero behavior change to existing social, schedule, appointment, event, job, or delivery outcomes;
- no save-format bump because this first slice adds no new mutable canonical state.

This is the compatibility seam that later workstreams depend on.

---

## Workstream B — Canonical obligations

**Priority:** P0
**Blocked by:** Workstream A

Add a bounded obligation layer whose records reference the source authority instead of copying its truth.

Initial obligation sources:

```text
routine / existing agenda
appointment
accepted-work appointment / job provenance
promise
world-event opportunity or disruption
commerce/pickup when relevant
personal goal (after Workstream C)
```

An obligation carries planning information such as actor, source reference, preferred/earliest/latest timing, destination, priority, and status. Source-specific completion and consequences stay with the original owner.

Examples:

- a café appointment creates a meet obligation, but appointment state owns RSVP/attendance consequences;
- an accepted shift creates a work obligation, but economy/job state owns wage/result;
- a promise may produce a social obligation, but SocialEngine owns promise and relationship truth.

---

## Workstream C — Personal goals + lightweight NPC pressure

**Priority:** P1
**Blocked by:** Workstream A

Add only the life state that Away does not already own.

Important NPCs may receive bounded semantic pressure such as:

- energy/fatigue band;
- stress band;
- broad mood;
- money/resource band only when behavior needs it;
- interruption tolerance/current activity;
- a small set of medium-term personal goals.

Do **not** copy the player's full body/economy meters onto every NPC. Background/remote characters use cheaper fidelity.

Goals influence obligation generation and intent scoring; they do not script exact daily choreography and are not freely invented by AI.

---

## Workstream D — Deterministic CharacterIntent planning

**Priority:** P1
**Blocked by:** Workstreams B and C foundation where needed

Select one semantic next intent from current routine pressure, obligations, social context, goals, current state, and world conditions.

Representative outputs:

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

For the same state/seed, selection must be deterministic and explainable through reason/source/priority/blockers. This is not a GOAP engine and not an LLM decision loop.

---

## Workstream E — Shared mobility and departure continuity

**Priority:** P1
**Existing issues:** #35 + #37
**Blocked by:** Transit foundation #35 + CharacterIntent planning

#35 remains the sole route/travel-time authority. #37 becomes the execution bridge from a `travel_to_place` intent to:

```text
AtPlace
→ AboutToLeave
→ InTransit
→ Arrived
→ AtPlace
```

Life Matrix decides **why/when the actor wants to go**. Transit decides **whether/how long/how much the trip is**. Neither may copy the other's truth.

Appointments, shifts, errands, and personal plans can then be early, on-time, late, missed, or cancelled from real travel timing rather than schedule teleportation.

---

## Workstream F — Presence resolver

**Priority:** P1
**Blocked by:** Workstream E

Unify physical, transit, device, and messenger availability as projections of one person state.

The same identity can be:

```text
local_at_place
in_transit
remote/off-town
online_active
online_idle/away
busy
unavailable
```

These are compatible dimensions/projections, not separate character classes.

Hard requirement: do not claim a person is actively chatting from a home PC while authoritative physical state says they are riding a bus, unless a period-appropriate alternate device/context explicitly permits it.

Migration must preserve current Pulse/social presence behavior until equivalent resolver tests are green.

---

## Workstream G — World events as bounded cross-system modifiers

**Priority:** P1
**Existing authority:** `WorldEventsEngine`

Keep the current event catalog/triggered state/knowledge system. Extend event effects through typed, bounded modifiers consumed by existing owners.

Examples:

```text
storm
→ TransitNetwork delay/headway modifier
→ lower outdoor-activity desirability

sick day
→ staffing / availability modifier

courier backlog
→ DeliveryEngine ETA modifier

local festival
→ place activity + social opportunity

outage
→ network/computer capability modifier
```

WorldEventsEngine publishes context/modifiers. It must not implement a second transit/job/delivery system.

---

## Workstream H — Physical commerce / parcel lifecycle

**Priority:** P1
**Existing issue:** #24

#24 remains the material/ownership implementation path and evolves `DeliveryEngine` rather than replacing it.

Target lifecycle:

```text
purchase
→ preparation/shipment
→ physical parcel or pickup becomes available
→ actor receives/collects it
→ parcel opens once
→ contained item instances move through the physical ownership/location model
```

Life Matrix may later create pickup/delivery obligations for NPCs or the player, but it never owns order or item state.

---

## Workstream I — Simulation-grounded encounter surfacing

**Priority:** P2
**Blocked by:** obligations + mobility/co-location + presence + world-event context

Only after truthful co-location exists, add a lightweight Encounter Director that chooses which already-valid opportunity is surfaced to the player.

It may score eligible moments from place, time, weather, nearby people, relationship context, obligations, and cooldowns. It may not spawn fake canonical people, teleport actors, fabricate relationships, or create a second event reality merely to make drama.

---

## Explicit Orion rejections

Do not import:

- continuous isometric/open-world town traversal;
- WASD city navigation as Away's default physical loop;
- per-meter NPC simulation across the whole town;
- Arcade/Matter movement as transit authority;
- one giant spatial village map as a requirement;
- a duplicate Orion relationship graph;
- a duplicate Orion appointment/job/delivery/event system;
- Action Cards as the target physical-world interaction language;
- LLM-authored canonical plans/goals/location/relationship deltas.

Away keeps authored living scenes, district navigation, local walking abstraction, real bus infrastructure, and a pure TS simulation shared by physical and digital life.

---

## Dependency map

```text
#14 / PR #4 integration gate
        │
        ├──────────────→ #17 world/transit content
        │                    └→ #35 TransitNetwork
        │
        └→ Life Matrix foundation
             ├→ obligations
             ├→ lightweight NPC state/goals
             └→ CharacterIntent planner
                        │
                        ├───────────────┐
                        │               │
#35 TransitNetwork ─────┘               │
        │                               │
        └────────→ #37 mobility execution
                         │
                         └→ presence resolver

WorldEvents typed modifiers can begin after foundation and integrate into
Transit/Delivery/Places only as those owners become available.

#18 physical ownership → #24 parcel/fulfillment

obligations + #37 co-location + presence + events
        └→ Encounter Director (late/P2)

#16 physical-world epic + Life Matrix epic
        └→ #29 final cross-system living-world gate
```

---

## Parallel-work policy

To avoid collisions with the current hourly worker and local agents:

1. **Until #14 is closed**, do not start runtime Life Matrix implementation that modifies `SimulationEngine.ts`, `SimulationEngineCore.ts`, persistence roots, or PC/world integration seams.
2. Documentation/issues may progress independently.
3. After #14, Life Matrix foundation and #17 content work may run in parallel if branches are isolated.
4. #35 can progress once #17's transit definitions exist.
5. Personal goals/lightweight NPC state can progress beside #35 after the Life Matrix foundation lands.
6. #37 waits for both the intent contract and #35 route contract.
7. Presence consolidation waits for #37 so it does not invent temporary transit truth.
8. Encounter surfacing stays late; it must consume truthful systems, not substitute for them.

Every implementation issue gets its own branch/PR and RED→GREEN evidence. Do not assign two agents overlapping ownership of `SimulationEngineCore.ts` at the same time.

---

## Cross-system acceptance scenario

The combined roadmap is successful when one important NPC can, without scripted teleportation:

1. begin the day with a normal routine;
2. have a real relationship/history from the existing SocialEngine;
3. receive or already hold a source-backed obligation (for example, work then café appointment);
4. choose a deterministic next intent based on obligation priority, current state, relationship context, and world conditions;
5. prepare and leave early enough based on TransitNetwork truth;
6. walk/wait/ride/transfer through the same network available to the player;
7. arrive on time or late according to actual service;
8. have the original appointment/job/social owner commit the outcome;
9. expose coherent physical/online presence throughout;
10. survive save/reload or a large time jump without rerolling route, duplicating consequences, or losing identity/history.

A later scenario should additionally prove an event disruption and a real parcel/pickup obligation without adding duplicate authorities.
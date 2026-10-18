# Spatial Presence, Venue Activities, and Actor Presentation

## Status

This document records the canonical bridge between Away Message's living-character simulation and its authored physical-world presentation.

It extends the existing town, Life Matrix, transit, Place/View, physical-item, and character-renderer architecture. It does **not** turn Away Message into a top-down/free-movement game.

The core model is:

```text
Character / Life truth
        ↓
WHY / WHEN
Life Matrix + source-backed obligations + CharacterIntent
        ↓

WHERE
Spatial presence in one town-space
        ↓

WHAT
Venue purpose / activity / role / local capability execution
        ↓

HOW IT IS SHOWN
Authored Place → Space → View → Focus → Anchor
+ full puppet / silhouette / background presentation
```

The essential separation is:

> **Where an actor is is not why they are there, what they are doing there, or how the camera represents them.**

---

## 1. Preserve Away Message's authored-view interaction language

The town may become much more spatial and systemic internally, but the player-facing interaction model remains authored living views.

The player does not freely walk a character through continuous streets. NPCs do not need city navmesh/pathfinding either.

Preferred flow:

```text
Town / district navigation view
        ↓ choose destination
simulated travel / transit
        ↓
Place
  ↓
Space
  ↓
Authored View(s)
  ↓
Anchors / objects / actors / Focus Views
```

An exterior street, park, bus stop, motel frontage, shopping strip, café, store, apartment or workplace may all be normal Places with one or more authored views.

**Do not collapse View and Anchor.** One authored View can expose several independent anchors/hotspots and focus targets. Add a distinct View only when another camera composition or interaction surface is actually useful; important locations may have several Views, while small places may need only one. View/focus changes are presentation transitions, never a new source of canonical location, item, or actor truth. Multiple view-specific drawings/placements of the same fixture still represent **one** canonical object. The #167 single-main-view spike proves a bounded rendering case, not a one-view limit on all interiors.

For the approved **3D spatial-reference → authored cameras → Gen-AI/paint-over → layered 2D runtime** workflow, and the criteria for choosing view counts and protecting modular assets across views, consult `docs/14-FIRST-PRODUCTION-ART-AND-PLAYABLE-SLICE.md` §4. This document owns the spatial/semantic distinction; that production document owns the art pipeline.

A district overview may itself be an authored horizontal or top-down navigation composition. That does not make it a free-roam game map.

Explicit non-goals:

- no WASD town movement;
- no continuous top-down/isometric traversal;
- no player street pathfinding;
- no per-meter NPC street navigation;
- no city navmesh;
- no traffic/vehicle simulation merely to support presence;
- no requirement to render travel continuously.

---

## 2. One canonical town-space position

Local physical actors should have a future-ready town-space position equivalent to:

```ts
interface SpatialPosition {
  x: number;
  y: number;
  z: number;
}
```

### `z` policy

`z` exists from the beginning so future content can represent:

- second floors;
- basements;
- rooftops;
- raised platforms;
- bridges;
- multi-floor apartments/buildings.

Current content should normally use `z = 0` and must not invent multi-floor complexity merely because the field exists.

### Shared coordinate space

For the current mostly single-floor town, interior positions should remain consistent with the surrounding district/town coordinate space where practical.

Example:

```text
Silver Cup footprint:
  x = 50..70
  y = 65..85

Actor inside Silver Cup:
  x = 58.4
  y = 73.1
  z = 0
```

The actor does not jump into an unrelated coordinate universe merely because the Place has an interior View.

This gives the simulation useful spatial truth while allowing presentation to remain authored 2D/2.5D.

---

## 3. Spatial state is separate from activity state

Avoid state names that collapse location and purpose into one concept such as:

```text
AtWork
AtStore
AtCafe
```

The same physical position/place may support very different reasons and activities.

Representative separation:

```ts
interface ActorSpatialState {
  position: SpatialPosition;
  districtId?: string;
  placeId?: string;
  spaceId?: string;
  anchorId?: string;
}

interface ActorActivityState {
  purpose: string;
  activityKind: string;
  roleId?: string;
  targetActorId?: string;
  targetObjectId?: string;
  activityInstanceId?: string;
}
```

Example — identical location, different meaning:

```text
WHERE
Silver Cup / x 58.4 / y 73.1 / z 0

WHY
work

WHAT
serving_customer
```

Later:

```text
WHERE
Silver Cup / similar physical area

WHY
leisure

WHAT
having_coffee
```

Or:

```text
WHY
shelter

WHAT
waiting_for_rain
```

Changing purpose/activity must not imply changing physical membership.

---

## 4. Place and Space containment are calculated truth

Physical Places/Spaces should be able to expose simple authored spatial bounds/footprints.

A practical definition may contain concepts equivalent to:

```ts
interface SpatialBounds {
  polygon: Array<{ x: number; y: number }>;
  minZ?: number;
  maxZ?: number;
}
```

Exact implementation may use rectangles or another simpler shape where sufficient.

The authoritative direction is:

```text
SpatialPosition
      ↓
SpatialResolver
      ↓
District membership
Place membership
Space membership
```

A cached `placeId`/`spaceId` is allowed for performance/convenience only if it remains a projection of the same spatial truth rather than a competing authority.

Ambiguous overlapping bounds should fail validation or use explicit authored priority. Renderer draw order must never decide physical containment.

---

## 5. Enter/Exit triggers are derived events, not location authority

Triggers are useful, but they should be consequences of spatial truth.

Correct direction:

```text
actor position changes
        ↓
resolve containment
        ↓
old membership vs new membership
        ↓
DistrictEntered / DistrictExited
PlaceEntered / PlaceExited
SpaceEntered / SpaceExited
```

These events can drive:

- ambience/audio changes;
- greetings;
- venue activation;
- observation/achievement hooks;
- content loading/projection;
- contextual Inner Voice candidates;
- encounter eligibility;
- authored reactions.

A Phaser overlap/hotspot callback must not be the only reason the simulation believes an actor is inside a Place.

Because Away uses semantic/discrete movement, containment does **not** need to run every render frame. Re-evaluate on meaningful spatial changes such as:

- trip arrival;
- destination/place transition;
- anchor/station change where position changes;
- authored local transition;
- scripted/world-event relocation;
- new game/load;
- developer relocation/debug action.

---

## 6. Transit remains cross-place mobility authority

The existing TransitNetwork / TravelPlanner and NPC departure → in-transit → arrival work remain authoritative for cross-place movement.

Spatial presence extends that model; it does not replace route/timing truth.

Conceptually:

```text
Actor at origin XYZ
        ↓
CharacterIntent says travel is needed
        ↓
Transit / walking plan commits
        ↓
InTransit
        ↓
authoritative arrival time
        ↓
resolve destination access/entry XYZ
        ↓
SpatialResolver derives destination membership
```

Do not add continuous coordinates along every bus/walking leg unless a future gameplay requirement proves it useful.

The same spatial contract should be usable by the player and NPCs.

---

## 7. Venue Operations: local affordances, not a second NPC brain

Life Matrix / CharacterIntent already answers **why and when** a character wants to act.

The venue layer answers:

> **Given that intent and the current physical place, what can actually happen here now?**

A venue may expose an optional operations graph:

```text
Place / Venue
├── Roles
├── Stations / semantic Anchors
├── Capabilities / Services
├── Resources / required physical providers
└── Activity templates / phases
```

Not every Place needs this depth. A café, store, workplace, diner, library or staffed service likely does. A canal overlook may not.

Venue operations must not become another store for:

- relationships;
- Life Matrix goals;
- obligations;
- schedules;
- employment/wage truth;
- transit routes/timing;
- inventory ownership;
- appointment outcomes;
- WorldEvent truth.

It queries/consumes those systems and delegates final consequences back to their owners.

---

## 8. Roles and staffing activate real services

Roles are semantic participation in a Place, not character-specific hardcoding.

Examples:

```text
barista
cook
waiter
cashier
clerk
attendant
librarian
customer
visitor
```

A real actor may fill a role because an existing job/shift/obligation says so.

Example service:

```text
CoffeeService
requires:
  Barista role occupied by a physically present/on-shift actor
  CounterStation exists and is available
  required coffee machine/resource state is valid
```

If the barista is late, absent or on break, the service may be unavailable/degraded.

If the cook is absent while the barista is present, coffee may remain available while food service does not.

This creates emergent consequences from real staffing/state rather than bespoke scripted variants.

---

## 9. Anchors and Stations are semantic occupancy, not pathfinding nodes

The existing `Anchor` concept gains an important optional role: semantic actor/object occupancy.

Examples:

```text
barista_counter
customer_counter
cashier_station
queue_01
queue_02
table_03
window_seat
staff_break
shelf_snacks
fridge_drinks
bus_stop_bench
exterior_waiting_point
```

An anchor/station may describe:

- occupancy capacity;
- compatible roles;
- capability tags;
- interaction targets;
- optional world-space position;
- view-specific presentation placement;
- visible/focus rules.

It is **not** a node in a city navmesh.

A local activity can move an actor semantically between stations:

```text
queue
→ customer_counter
→ table_03
```

Offscreen this may be a timed semantic transition. Onscreen Phaser may show a short authored tween/cut/animation. The animation does not become activity authority.

---

## 10. ActivityInstance: bounded local execution

Some local interactions need more than a one-shot action.

Use a bounded semantic state machine where useful.

Customer coffee example:

```text
present
→ queueing
→ ordering
→ waiting_for_item
→ receiving
→ optional seat/drink
→ done / leave
```

Worker example:

```text
role active
→ receive order
→ prepare
→ hand over
→ return idle / next task
```

The activity state should retain enough provenance to know:

- actor;
- purpose/activity kind;
- venue/place;
- relevant role/station;
- target actor/object when applicable;
- source intent/obligation if useful;
- current phase;
- timing/progress boundary;
- original consequence owner.

Do not build a universal GOAP/action language. Add only practical activities the game needs.

---

## 11. Simulation fidelity remains bounded

Away does not need Sims-scale per-frame simulation for every person.

Useful fidelity levels:

```text
Town / offscreen
  actor place + broad purpose/activity may be sufficient

Relevant same-place actor
  ActivityInstance / station occupancy when needed

Visible actor
  presentation consumes station/activity state
```

Time jumps and offscreen progression should resolve deterministic semantic activity outcomes without running renderer animations.

This keeps a larger dynamic population affordable.

---

## 12. Actor presentation is a projection, never character truth

A physically present persistent actor may be represented as:

```text
full character puppet
silhouette (large/medium)
small/background silhouette
hidden outside active view
```

The representation is derived from the active authored camera/view and is normally not persisted.

The default decision inputs are:

```text
camera mode
+
view-relative camera distance/depth
+
authored visibility
+
focus / interaction state
```

**Do not use town `(x,y,z)` as the default silhouette-tier calculation.**

World coordinates answer simulation geography. Authored view placement answers how the composition shows that actor.

---

## 13. Camera modes

Keep camera modes small and explicit.

Representative modes:

```text
eye_level
city_topdown
```

### `eye_level`

Normal interior/exterior living composition.

Typical policy:

```text
near / focused
→ full CharacterRenderer / Away Puppet

medium
→ larger silhouette

far
→ small/background silhouette
```

Exact thresholds are art/tuning data rather than architecture.

### `city_topdown`

Town/district/navigation composition.

Normally:

```text
selected/notable nearby actor
→ top-down/abstract silhouette marker

ordinary visible actor
→ small silhouette

far/unimportant actor
→ omit or ambient representation
```

Full puppets are normally unnecessary in this camera mode.

This remains a navigation/presentation view, not free movement.

---

## 14. Authored View placement remains artist-friendly

A View may describe actor placement with presentation-friendly data such as:

```text
screenX / screenY or normalized position
view-relative distance/depth
facing family
scale range
visible anchor/station
```

Do not require a general town-coordinate-to-screen projection engine.

This separation is intentional:

```text
Simulation space
  x / y / z
  district/place/space containment

View placement
  screen position / depth / facing / scale

Presentation policy
  camera mode / distance / focus
  → full / silhouette / background / hidden
```

---

## 15. Silhouette families

Use a bounded reusable silhouette vocabulary rather than one shape for everyone or full-detail puppets for every background actor.

Useful facing families may include:

```text
front
front_3q_left
front_3q_right
side_left
side_right
back_3q
back
```

A few broad height/build variants may be added only if they materially improve readability.

Persistent actor silhouettes keep the same actor identity under the hood.

Ambient anonymous crowd silhouettes remain a separate decorative system and do not need full persistent NPC state.

---

## 16. Silhouettes remain interactive people

Clicking a persistent silhouette should resolve the real actor and a context-sensitive interaction projection.

Possible actions include:

```text
Look / Inspect
Approach / Greet
Talk
Wave / Call Over
Join / Sit With
Order
Pay
Ask For Help
```

The available actions come from real context:

- player knowledge of identity;
- relationship/social state;
- actor purpose/activity;
- venue role/capability;
- distance/focus policy;
- busy/conversation/departure state;
- current place/object context.

Do not create one universal hardcoded silhouette menu.

---

## 17. Knowledge-safe identity presentation

Physical existence does not imply player knowledge.

The game may know the actor ID while presentation only knows enough to say:

```text
Someone by the window
A person at the counter
The cashier
```

After legitimate introduction/knowledge:

```text
Erin
```

The renderer/context menu must not reveal hidden roster metadata merely because it can access a canonical actor ID.

---

## 18. Interaction may promote a silhouette to full character presentation

Distance tiers are defaults, not a barrier to interaction.

A useful flow is:

```text
Silhouette in scene
      ↓ select / approach / talk
Authored focus / dialogue staging
      ↓
Full CharacterRenderer / Away Puppet
      ↓ interaction ends
Return to normal view tier
```

Promotion/demotion must preserve:

- actor identity;
- current appearance;
- current activity/purpose;
- relationships/memories;
- simulation state.

The full puppet adapter from the character-renderer work remains the renderer for high-detail characters. The silhouette resolver decides when that renderer is needed.

---

## 19. Content/data ownership

Authorable definitions should flow through the existing Content UI → TinyBase → validation/codegen pipeline.

Likely authorable data includes:

### Geography
- Place/Space footprint or bounds;
- optional Z range;
- entry/access positions;
- station/anchor world positions where needed.

### Venue operations
- venue roles;
- station/anchor capacity and role compatibility;
- service/capability requirements;
- activity templates/phases;
- static resource/provider requirements.

### Presentation
- camera mode per View;
- actor placement/depth/facing metadata;
- silhouette asset families;
- distance/depth tier tuning where art direction needs it.

Mutable per-save state remains simulation truth:

- actor current XYZ;
- current purpose/activity;
- role assignment/occupancy when dynamic;
- activity instance/phase when irreducible;
- player knowledge;
- item/resource state;
- active travel.

Do not put mutable actor activity/presence into static content definitions.

---

## 20. Integration with existing authorities

This direction extends existing completed/active work rather than replacing it.

### Life Matrix / CharacterIntent

Owns **WHY / WHEN**.

It selects intents from obligations, goals, social context, pressure and world context.

### Transit / mobility

Owns cross-place route/service/wait/fare/travel duration and departure/in-transit/arrival continuity.

### Spatial presence

Owns **WHERE** after arrival/local relocation through XYZ + containment.

### Venue operations

Owns local availability and bounded activity execution — **WHAT can happen here now**.

### Original domain owners

Own consequences:

- SocialEngine → relationship/social effects;
- Appointment owner → attendance/lateness outcome;
- Job/Economy → wage/work result;
- physical item/shop systems → item ownership/stock/payment;
- WorldEventsEngine → event truth/modifier provenance.

### Phaser / CharacterRenderer

Owns **HOW THE CURRENT VIEW SHOWS IT**.

No renderer creates physical presence, role assignment, activity success or location truth.

---

## 21. Persistence

Before save compatibility freeze, historical development saves remain disposable per `AGENTS.md`.

Current-format persistence should preserve irreducible state needed for continuity, such as:

- actor XYZ when it cannot be safely reconstructed;
- active travel through existing transit state;
- active venue activity phase when abandoning/reconstructing it would change outcomes;
- dynamic role/station occupancy where it cannot be reconstructed from source records.

Derived values should normally be recomputed:

- Place/Space membership from position/bounds;
- enter/exit event eligibility from old/new resolved membership;
- silhouette/full-puppet tier from current view/camera/focus;
- knowledge-safe display label from actor knowledge.

Do not persist renderer representation merely for convenience.

---

## 22. Performance rules

This architecture should reduce, not increase, population cost.

Prefer:

- coarse offscreen activity;
- event/time-bound updates;
- detailed station/activity state only for relevant actors;
- full puppets only for near/focused characters;
- silhouettes for medium/far persistent characters;
- cheap ambient silhouettes for anonymous background population;
- no per-frame full-population Life Matrix reevaluation;
- no per-frame containment check when no spatial move occurred;
- no per-meter NPC pathfinding.

---

## 23. Acceptance direction

The architecture is proven when the game can demonstrate all of the following without special-case place code:

1. one actor has a canonical `(x,y,z)` position;
2. Place/Space membership is derived from authored containment;
3. changing purpose/activity does not change spatial membership;
4. moving across a boundary produces derived Exit/Enter events;
5. a café service requires a real role/station/resource state;
6. worker absence/break can change service availability;
7. a customer/worker activity advances through bounded semantic phases offscreen or onscreen;
8. no local activity system duplicates Life Matrix/job/social/transit/item truth;
9. the same persistent actor appears as full puppet or silhouette depending on active camera/distance/focus;
10. a city/top-down view can use silhouette-only policy;
11. clicking a silhouette resolves the real actor and contextual actions;
12. an unknown actor remains knowledge-safe;
13. interaction can promote a silhouette to full character presentation without changing identity;
14. none of this introduces WASD/free-roam/pathfinding as Away Message's world loop.

---

## 24. Implementation tracking

Tracked by:

- #92 — spatial presence / venue activities / actor-presentation epic;
- #93 — canonical XYZ positions, containment and derived place events;
- #94 — generic venue operations, roles, stations and ActivityInstance execution;
- #95 — camera-distance silhouette/full-character presentation and contextual interaction.

Important existing dependencies/owners remain:

- #20 — generic Place/Space/View/Focus/Anchor runtime;
- #25 — full CharacterRenderer / Inochi-capable puppet contract;
- #35/#37 — route/travel timing and NPC departure/transit/arrival;
- #44 — CharacterIntent WHY/WHEN;
- #45 — coherent physical/device/messenger presence;
- #47 — truthful encounter surfacing;
- #86 — generic physical object/affordance/context interaction foundation.

Do not reopen those systems as competing authorities.
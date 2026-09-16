# Residence, Housing, and Living-Space Progression

## 1. Purpose

This document defines Away Message's canonical residence, housing, and living-space direction.

The player's residence is dynamic simulation/economy state. It selects which canonical `Place` currently functions as home, but it does **not** grant gameplay abilities by itself.

The implementation backlog is tracked by:

- #85 — residence/housing progression epic;
- #86 — Residence/Tenancy authority plus contextual physical-interaction resolution;
- #87 — modular residence visuals and fixture-slot/blockout-to-Phaser production contract;
- #88 — housing choice, rent/upgrades, and moving.

---

## 2. Core design laws

> **A place owns location-wide policy; it is not a bag of object actions.**

> **Direct physical actions belong to the concrete objects that expose them.**

> **Recipes/composed interactions declare requirements; the runtime resolves those requirements from the player's current context.**

A residence uses the same canonical world model as every other physical place:

```text
Town
  ↓
District
  ↓
Place
  ↓
Space
  ↓
Anchor / Placement Slot
  ↓
Installed Object
  ↓
Nested Slots + Components
  ↓
Affordances / Tool Capabilities / Containers / Resources
```

Residence/Tenancy state says **which valid Place currently functions as the player's home** and what the occupancy/economic terms are. It does not create a second location system and it does not own derived object actions such as "can use a computer", "can sleep", or "can bathe".

Do not implement rules equivalent to:

```ts
residence.canUseComputer
place.canBathe
place.canPrepareFood
```

when those actions naturally come from concrete reachable objects or contextual requirements.

Some facts legitimately remain place-level because they describe a destination/service policy rather than an object action. Examples include whether a place accepts deliveries, visitor/access policy, opening/access rules, or other location-wide service contracts.

---

## 3. Three interaction layers

Keep these three concepts distinct.

### 3.1 Place / service policy

Place-level state answers questions about the location as a destination or service boundary.

Examples:

- `canReceiveDelivery` / delivery acceptance policy;
- reception/door/parcel handling policy;
- visitor access policy;
- opening/access restrictions;
- mail/service handling where relevant.

A place-level policy may decide whether an operation is permitted or how it should be routed. It should **not** manufacture object affordances that are absent from the physical graph.

For delivery, for example:

```text
Place delivery policy allows delivery
        +
valid target/route exists
        ↓
parcel can be delivered
```

The policy and the concrete target are separate concerns.

### 3.2 Object affordances

A concrete accessible object directly exposes the user actions that make sense on that object.

Examples:

```text
Bathtub  → Bathe
Bed      → Sleep
Computer → Use / Power / Inspect
Fridge   → Open
Wardrobe → Open Storage
```

If an accessible bathtub exists, its context menu may expose `Bathe`. There is no need for a separate `canBathe(place)` check.

If the object is absent, inaccessible, locked, broken, or otherwise unusable, the affordance is absent or disabled according to the object's own conditions.

A planner may later search the world for a semantic affordance such as `bathe`, but that is an index/query over concrete object affordances; it is not a stored Place capability.

### 3.3 Context-composed requirements

Some actions are not owned by one object. They combine items, resources, and tool capabilities from multiple reachable sources.

Example:

```text
instant noodles item
+ water
+ any provider capable of heating water
        ↓
prepare instant noodles
```

This is where the contextual requirement resolver is authoritative.

---

## 4. Placement graph

`Place`, `Space`, and `Anchor` define spatial identity, containment, presentation, and legal placement.

An anchor/slot declares what category of object it accepts. An installed object may expose additional child slots.

Representative chain:

```text
floor furniture slot
  ↓ accepts
Desk
  ↓ provides
work-surface slot
  ↓ accepts
Computer
  ↓ exposes
Use / Power / Inspect affordances
```

Another chain may be:

```text
fixture slot
  ↓ accepts
Kitchenette fixture
  ├─ cabinet container
  ├─ water source
  └─ appliance slot
       ↓ accepts
     Kettle
       ↓ provides
     heat_water tool capability
```

The parent place never needs to know that a computer or kettle exists. It only owns/reaches the spatial graph in which those objects are installed.

Placement compatibility should be data-driven through practical categories/tags/components rather than one-off IDs. Keep the taxonomy bounded; this is a gameplay object graph, not a universal furniture simulator.

---

## 5. Objects and components

Concrete runtime objects may provide one or more orthogonal components:

- **Placement** — what slot/category can contain the object;
- **Slots** — child placement locations exposed by the object;
- **Affordances** — direct user-facing actions exposed by the object, such as `bathe`, `sleep`, `use`, `open`, or `inspect`;
- **Container** — physical items stored inside the object;
- **Tool capability provider** — semantic tool abilities used by composed requirements, such as `heat_water`, `cook`, or another bounded capability needed by recipes/systems;
- **Resource provider** — environmental/resource access such as water or power where the design needs it;
- **Presentation mapping** — view-specific art/layers for the same semantic object instance.

Object identity, affordance identity, and tool-capability identity are intentionally separate.

A direct object action should stay direct when no abstraction is needed. For example, a bathtub can simply expose `bathe`; it does not need to provide an abstract `can_bathe` capability just so the player can use it.

For composed interactions, prefer a semantic requirement like:

```text
requires tool capability: heat_water
```

over:

```text
requires object id: kettle
```

when multiple valid tools can satisfy the same need.

---

## 6. Contextual interaction resolution

Use contextual resolution only where an action needs to combine multiple sources or search semantically across reachable state.

Build a local `InteractionContext` from authoritative physical state. The context may include:

```text
player inventory
+ equipped/carried items
+ current Place/Space object graph
+ accessible containers in that graph
+ installed tool/resource providers
+ reachable object affordances when a semantic query needs them
```

This is a **virtual resolution scope**, not an inventory merge. Items keep their exact identity, owner, and physical location.

The resolver should:

1. determine the player's authoritative current location;
2. traverse reachable installed objects/slots for that context;
3. expose accessible object affordances when queried;
4. collect reachable tool/resource providers;
5. expose items from player inventory and accessible local containers;
6. evaluate composed interaction/recipe requirements;
7. execute only after the requirements are satisfied;
8. consume/mutate the exact source items/providers required by the action.

Accessibility matters. A locked container, inaccessible room, remote object, or object in another place does not enter the context merely because it exists in simulation.

Do not force every simple object interaction through the requirement resolver. Clicking an accessible bathtub and choosing `Bathe` is already sufficient unless that action itself has additional requirements.

The same rules must work outside residences. Shared facilities, workplaces, shops, or other living places use the same object/policy/context model.

---

## 7. Requirement and recipe model

Composed interactions and item recipes describe what they need. They should not encode a specific residence, room, or fixture arrangement when a semantic requirement is enough.

A bounded requirement vocabulary may support concepts equivalent to:

```text
item / quantity
tool capability
resource
allOf(...)
anyOf(...)
```

Example for an instant-food item:

```text
required item: instant_noodles
+ required resource: water
+ any valid way to heat water
```

The noodles may come from the player's inventory or from an accessible cupboard/container in the current place. The heat source may come from any reachable provider that satisfies the recipe requirement.

The recipe does **not** require a hard-coded "kitchenette" boolean on the place. A kitchenette is a useful authored fixture/arrangement because it can contain/provide tools, storage, water, and slots; it is not magical capability authority.

This pattern should extend naturally to future recipes and composed interactions without adding place-specific booleans.

---

## 8. Interaction examples

### Computer use and hardware setup

A valid furniture slot may accept a desk. The desk may expose a work-surface slot. A computer installed on a compatible surface exposes its own direct interactions.

The player uses the actual reachable computer object. The residence itself does not provide `use_computer`.

A higher-level planner may query for a usable computer affordance/provider, but the source remains the concrete computer instance.

### Sleep

A bed or other sleeping object exposes `Sleep` when usable. If no reachable sleeping object exists, there is no local sleep interaction.

### Hygiene

A bathtub/shower object exposes its own `Bathe`/`Shower` action. A shared facility in another canonical place works identically once the player is physically there.

Do not add `place.canBathe` merely to decide whether the bathtub context menu should exist.

### Food preparation

Food preparation is usually a composed action: recipe requirements plus accessible items/resources/tool providers. The place does not gain food-preparation powers from a flag.

### Delivery

Delivery is different because accepting a delivery is legitimately a **place/service policy**.

`home` resolves the current residence Place. The place's delivery policy determines whether/how the destination accepts delivery. A concrete target/route such as reception, front door, parcel shelf/container, or another authored target then determines where the parcel materializes or is handed off.

If delivery is not accepted, or an allowed policy requires a target that cannot be resolved, the system must follow an explicit alternative policy or fail/defer. It must not silently invent a hidden target.

### Storage

Storage comes from actual `Container` components. Capacity and contents belong to the concrete container/object instances, not to a residence-wide storage number unless a later UI projection intentionally summarizes them.

---

## 9. Residence/Tenancy authority

Mutable residence truth belongs in simulation/save state.

A representative purpose-level model is:

```ts
interface ResidenceState {
  currentResidencePlaceId: PlaceId;
  tenancyId: string;
  moveInMinute: number;
  currentRent: number;
}
```

Exact names and nesting should follow implementation conventions.

The residence system must not duplicate:

- canonical Place definitions;
- installed-object/fixture state;
- physical item ownership/location;
- object containers or recipe inputs;
- economy cash truth;
- delivery order truth;
- computer/hardware truth;
- transit truth.

`home` is a semantic resolver:

```text
home
  ↓
ResidenceState.currentResidencePlaceId
  ↓
canonical Place + runtime object graph
```

The Residence authority selects the root context. Place-level policy, concrete object affordances, and contextual requirement resolution determine what can actually happen there.

---

## 10. Ownership domains and fixture packages

Housing progression depends on a strict distinction between property-owned fixtures and player-owned belongings.

### Property-owned fixtures

Examples include supplied beds/desks/chairs, built-in storage, bathroom fixtures, kitchenette fixtures, windows, and included service equipment.

They may affect rent or tenancy terms and remain with the property when the player leaves.

They should still exist as concrete fixture/object assignments in the place graph when gameplay needs to interact with them. A rent package may summarize them, but the summary is not interaction authority.

### Player-owned belongings

Examples include decor, portable electronics, books/media, bags, personal bedding, purchased hardware, and movable furniture where the tenancy allows it.

These are concrete physical item/object instances. When moved or installed, the same instance changes location/placement; do not delete/recreate it as decorative state.

Property-owned and player-owned objects obey the same placement compatibility rules. Ownership affects transfer/economy permissions, not the fundamental object graph.

---

## 11. Housing progression

Housing is a material/lifestyle progression axis, not a visible level system.

Representative arc:

```text
very cheap lodging
        ↓
personalized cheap space
        ↓
better supplied room / different room
        ↓
larger or better-equipped lodging
        ↓
tiny apartment at a specific town address
        ↓
future residences if needed
```

Starting options should normally be a small set of affordable residences with meaningful trade-offs.

A cheap residence may have no private hygiene fixture, no food-preparation fixture set, weak storage, or only a minimal furniture layout. That is valid as long as the game provides a feasible world path to required core systems.

The changed physical world is the progression UI. Do not add Housing XP or a generic home-quality score as the primary expression of progression.

---

## 12. Rent and moving

Housing cost may reflect tenancy terms and the supplied property fixture/service package.

Changing residence should:

```text
select/commit tenancy
→ change currentResidencePlaceId
→ preserve old property's fixtures
→ move eligible player-owned objects/items through physical transfer rules
→ install them only into compatible target slots
→ update home/navigation/delivery context
```

Moving must preserve exact owned-item identity with no duplication or silent deletion.

A practical assisted moving action is acceptable; the domain model does not need box-by-box simulation.

---

## 13. Modular visual architecture

A physical place must not be one permanently flattened image when gameplay state requires objects to change.

Use presentation categories equivalent to:

```text
Place View
├── static architecture/background
├── structural fixtures
├── installed replaceable objects
├── player-owned movable objects/decor
├── temporary world state
├── characters
├── foreground/ambient layers
└── lighting/weather/effect layers
```

One semantic object instance may map to different authored art in different views. Do not duplicate gameplay identity merely because multiple camera compositions require different sprites/assets.

The default production workflow remains:

```text
simple 3D blockout / spatial reference
→ lock proportions and authored cameras
→ render references/masks as useful
→ Gen-AI generation / paint pass
→ separate gameplay-stateful layers
→ author per-view mappings + placement anchors
→ Phaser 4 composition
```

The blockout is production reference, not runtime authority. Phaser presents projections of canonical simulation/content state; it does not own tenancy, placement, inventory, policy, affordance, tool-capability, or recipe truth.

---

## 14. Soft-lock rule

The cheapest valid starting path must still have a feasible route to required core systems.

This does **not** mean every residence receives invisible facilities.

Valid alternatives include:

- use a shared hygiene facility elsewhere;
- buy ready-to-eat food or use another place's preparation tools;
- acquire/install a compatible desk or work surface later;
- route deliveries through an authored reception/door/parcel policy/target;
- carry a portable tool when the item and placement rules allow it.

Design alternatives, not hidden freebies.

---

## 15. Pre-release save policy

Historical development saves do not constrain this architecture.

Until the project explicitly declares a save-compatibility freeze:

```text
breaking persisted-state change
→ increment/invalidate development save compatibility as needed
→ refuse/reset incompatible old dev save cleanly
→ start from canonical new-game state
```

Do not add historical dev-save migrations, aliases, obsolete fields, dual authorities, or architecture shims solely to keep experimental saves alive.

---

## 16. Evaluation / acceptance direction

The residence/housing foundation should prove at least:

1. `home` resolves to the current Residence/Tenancy Place;
2. changing residence changes the root context without changing canonical place identity;
3. location-wide service rules such as delivery acceptance may remain legitimate Place policy;
4. a concrete accessible object exposes its own direct affordance without requiring a duplicate `Place.canX` flag;
5. removing/moving that object removes/moves the affordance without changing the Place definition;
6. a placement slot can accept a compatible object and that object can expose nested slots;
7. a composed recipe can combine an item from player inventory with a tool/resource provider from the current place;
8. the same recipe can source an item from an accessible local container instead;
9. missing required providers/resources/items leave the composed interaction unavailable rather than inventing a place-level capability;
10. delivery requires the appropriate Place/service policy and resolves the concrete route/target required by that policy;
11. a bathtub/shower proves the direct-object-affordance path: `Bathe`/`Shower` comes from the object, not `place.canBathe`;
12. shared facilities use the same object/policy/context rules outside the home context;
13. moving preserves exact player-owned object/item identity and placement legality;
14. visual projection can swap/move stateful objects without changing semantic identity;
15. content check, typecheck, build, baseline guard, focused tests, and full tests are green.

This three-layer model is the canonical direction for physical interactions:

```text
Place policy          → location/service rules
Object affordance     → direct action on a concrete object
Context requirements  → composed action from items/resources/tools
```

Residence/Tenancy chooses the home root; concrete world state and legitimate place policy determine what the player can do.
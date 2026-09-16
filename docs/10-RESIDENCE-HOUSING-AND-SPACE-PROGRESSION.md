# Residence, Housing, and Living-Space Progression

## 1. Purpose

This document defines Away Message's canonical residence, housing, and living-space direction.

The player's residence is dynamic simulation/economy state. It selects which canonical `Place` currently functions as home, but it does **not** grant gameplay abilities by itself.

The implementation backlog is tracked by:

- #85 — residence/housing progression epic;
- #86 — Residence/Tenancy authority plus contextual object-capability resolution;
- #87 — modular residence visuals and fixture-slot/blockout-to-Phaser production contract;
- #88 — housing choice, rent/upgrades, and moving.

---

## 2. Core design laws

> **A place is topology and containment, not a capability bag.**

> **Gameplay capability comes from concrete objects/components that actually exist in the reachable local graph.**

> **Recipes/interactions declare requirements; the runtime resolves those requirements from the player's current context.**

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
Capability Providers / Containers / Resources
```

Residence/Tenancy state says **which valid Place currently functions as the player's home** and what the occupancy/economic terms are. It does not create a second location system and it does not own derived facilities such as "can cook", "can use a computer", or "can shower".

Do not implement rules equivalent to:

```ts
residence.canUseComputer
place.hasKitchenette
place.canPrepareFood
```

when those facts can be derived from the concrete object graph.

---

## 3. Placement graph

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
  ↓ provides
use_computer
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
     heat_water
```

The parent place never needs to know that a computer or kettle exists. It only owns/reaches the spatial graph in which those objects are installed.

Placement compatibility should be data-driven through practical categories/tags/components rather than one-off IDs. Keep the taxonomy bounded; this is a gameplay object graph, not a universal furniture simulator.

---

## 4. Objects and components

Concrete runtime objects may provide one or more orthogonal components:

- **Placement** — what slot/category can contain the object;
- **Slots** — child placement locations exposed by the object;
- **Container** — physical items stored inside the object;
- **Capability provider** — semantic actions/tools the object can perform, such as `use_computer`, `sleep`, `heat_water`, or `bathe`;
- **Resource provider** — environmental/resource access such as water or power where the design needs it;
- **Presentation mapping** — view-specific art/layers for the same semantic object instance.

Object identity and capability identity are intentionally separate.

For example, an interaction should prefer a requirement like:

```text
requires capability: heat_water
```

over:

```text
requires object id: kettle
```

when multiple valid tools can satisfy the same need.

---

## 5. Contextual interaction resolution

When the player requests an interaction, build a local `InteractionContext` from authoritative physical state.

The context may include:

```text
player inventory
+ equipped/carried items
+ current Place/Space object graph
+ accessible containers in that graph
+ installed capability/resource providers
```

This is a **virtual resolution scope**, not an inventory merge. Items keep their exact identity, owner, and physical location.

The resolver should:

1. determine the player's authoritative current location;
2. traverse reachable installed objects/slots for that context;
3. collect accessible capability/resource providers;
4. expose items from player inventory and accessible local containers;
5. evaluate the interaction/recipe requirements;
6. execute only after the requirements are satisfied;
7. consume/mutate the exact source items/providers required by the action.

Accessibility matters. A locked container, inaccessible room, remote object, or object in another place does not enter the context merely because it exists in simulation.

The same resolver must work outside residences. Shared facilities, workplaces, shops, or other living places use the same rule.

---

## 6. Requirement and recipe model

Interactions and item recipes describe what they need. They should not encode a specific residence, room, or fixture arrangement when a semantic requirement is enough.

A bounded requirement vocabulary may support concepts equivalent to:

```text
item / quantity
capability
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

This pattern should extend naturally to future recipes and interactions without adding place-specific booleans.

---

## 7. Interaction examples

### Computer use and hardware setup

A valid furniture slot may accept a desk. The desk may expose a work-surface slot. A computer installed on a compatible surface provides the computer interaction capability.

The runtime resolves the actual computer/provider reachable from the current context. The residence itself does not provide `use_computer`.

### Sleep

A bed or other valid sleeping object provides the sleep capability. If no reachable object provides it, sleep is unavailable in that context.

### Hygiene

A shower/bath facility provides the relevant hygiene capability. A shared facility in another canonical place works through exactly the same resolver once the player is physically there.

### Food preparation

Food availability is derived from the recipe requirements plus accessible items/resources/tools. The room does not gain food-preparation powers from a flag.

### Delivery

`home` resolves the current residence Place. Within that place graph, a valid delivery provider/target such as a door, reception point, parcel container, or authored delivery anchor determines where a parcel may materialize.

If no valid provider exists, the system must follow an explicit alternative policy or fail/defer; it must not silently invent a hidden delivery target.

### Storage

Storage comes from actual `Container` components. Capacity and contents belong to the concrete container/object instances, not to a residence-wide storage number unless a later UI projection intentionally summarizes them.

---

## 8. Residence/Tenancy authority

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

The Residence authority selects the root context. The object graph and requirement resolver determine what can actually be done there.

---

## 9. Ownership domains and fixture packages

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

## 10. Housing progression

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

## 11. Rent and moving

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

## 12. Modular visual architecture

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

The blockout is production reference, not runtime authority. Phaser presents projections of canonical simulation/content state; it does not own tenancy, placement, inventory, capability, or recipe truth.

---

## 13. Soft-lock rule

The cheapest valid starting path must still have a feasible route to required core systems.

This does **not** mean every residence receives invisible facilities.

Valid alternatives include:

- use a shared hygiene facility elsewhere;
- buy ready-to-eat food or use another place's preparation tools;
- acquire/install a compatible desk or work surface later;
- route deliveries through an authored reception/door/parcel provider;
- carry a portable tool when the item and placement rules allow it.

Design alternatives, not hidden freebies.

---

## 14. Pre-release save policy

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

## 15. Evaluation / acceptance direction

The residence/housing foundation should prove at least:

1. `home` resolves to the current Residence/Tenancy Place;
2. changing residence changes the root context without changing canonical place identity;
3. no core at-home action depends on a specific place ID;
4. a placement slot can accept a compatible object and that object can expose nested slots;
5. an installed provider makes its capability available through contextual resolution;
6. removing/moving that provider removes the capability without changing the Place definition;
7. an interaction recipe can combine an item from player inventory with a provider/resource from the current place;
8. the same recipe can source an item from an accessible local container instead;
9. missing required providers/resources/items leave the interaction unavailable rather than inventing a place-level capability;
10. delivery resolution follows a valid provider/target in the current home graph;
11. shared facilities use the same resolver outside the home context;
12. moving preserves exact player-owned object/item identity and placement legality;
13. visual projection can swap/move stateful objects without changing semantic identity;
14. content check, typecheck, build, baseline guard, focused tests, and full tests are green.

This object/component chain is the canonical direction for physical interactions. Residence/Tenancy chooses the home root; concrete world state determines what the player can do.
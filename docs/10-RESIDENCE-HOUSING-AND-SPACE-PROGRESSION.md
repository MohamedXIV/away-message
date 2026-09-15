# Residence, Housing, and Living-Space Progression

## 1. Purpose

This document defines Away Message's canonical residence/housing direction.

It supersedes any older design assumption that Room 104 is the guaranteed starting room, permanent player home, delivery target, PC-setup location, or flagship place that must be finished at production quality before the residence system can evolve.

Room 104 may remain in content as an ordinary motel room or reference fixture. It is not sacred.

The implementation backlog is tracked by:

- #85 — residence/housing progression epic;
- #86 — Residence/Tenancy authority and dynamic home resolution;
- #87 — modular residence visuals and blockout-to-Phaser production contract;
- #88 — housing choice, rent/upgrades, and moving.

---

## 2. Core design law

> **The player's home is a current residence, not a room number.**

No core system may assume:

- the player starts in Room 104;
- the player permanently lives in Room 104;
- `home` means `room_104`;
- deliveries always target Room 104;
- PC setup/hardware management is tied to Room 104;
- every starter room has a kitchenette;
- every starter room has a private bathroom;
- every residence has the same storage/furniture capabilities;
- the same authored view count is required for every home.

A residence uses the same canonical world model as any other physical place:

```text
Town
  ↓
District
  ↓
Place
  ↓
Space
  ↓
View / Focus
  ↓
Anchors + interactions + capabilities
```

Residence/Tenancy state says **which valid Place currently functions as the player's home** and what the current occupancy/economic terms are. It does not create a second location system.

---

## 3. Intended housing progression

Housing is a material/lifestyle progression axis, not a visible level system.

Representative arc:

```text
very cheap motel room
        ↓
personalized cheap room
        ↓
better supplied room / different motel room
        ↓
larger or better-equipped motel room
        ↓
tiny apartment at a specific town address
        ↓
future residences if the game later needs them
```

The player should feel that their living situation improves because the actual space, costs, facilities, privacy, storage, commute, and possessions change.

Do not add:

- Housing Level;
- room XP;
- arbitrary prestige score;
- numerical home-quality stat as the primary expression of progression.

The changed world is the progression UI.

---

## 4. Starting residence choice

Do not force one canonical starting room solely because the previous implementation began with Room 104.

The preferred opening is constrained choice:

- the player has little money;
- only a small set of currently available rooms are realistic options;
- normally 2–3 cheap motel rooms are enough;
- the rooms have meaningful trade-offs rather than obvious tier-number upgrades.

Possible starting differences:

- lowest rent but no private bathroom;
- slightly higher rent for a better window/view;
- better desk/work surface but weak storage;
- different supplied bed/desk package;
- closer to shared bathroom/laundry/stairs;
- noisier/quieter position;
- different delivery/storage convenience.

The cheapest valid starting room may have:

- no private bathroom;
- no kitchenette;
- minimal supplied furniture;
- shared motel facilities instead.

This is desirable. It creates real progression and makes later facilities meaningful.

The player should receive agency without being able to skip the early economic arc merely by selecting an expensive home they cannot reasonably support.

---

## 5. Residence/Tenancy authority

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
- district/transit geography;
- physical item ownership/location;
- economy cash truth;
- delivery order truth;
- PC/hardware truth;
- landlord-owned fixture definitions.

`home` is a semantic resolver:

```text
home
  ↓
ResidenceState.currentResidencePlaceId
  ↓
canonical Place definition + current runtime state
```

It is not a permanent generated alias to `room_104`.

---

## 6. Capabilities, not room-number checks

At-home actions must resolve from the current residence and its actual capabilities.

Examples:

### PC setup
Requires a valid current-residence work/desk surface or equivalent authored capability. It does not require Room 104.

### Sleep
Requires an available sleeping capability/fixture.

### Hygiene
A cheap room with no private bathroom must not expose a fake shower action. The player may need to use a shared motel bathroom or another valid facility.

### Food preparation
A room with no kitchenette must not magically provide kettle/fridge/noodle preparation because an old room script expected those actions.

### Delivery
Delivery resolves an appropriate current-residence delivery anchor/reception/door policy. Changing residence changes the home delivery target.

### Storage
Storage exists only where the residence/fixtures/owned containers actually provide it.

This capability-driven rule is more important than preserving old room UI behavior.

---

## 7. Two ownership domains

Housing progression depends on a strict distinction between what belongs to the property and what belongs to the player.

### 7.1 Residence-owned / landlord-owned fixtures

Examples:

- supplied bed;
- supplied desk;
- supplied chair;
- built-in wardrobe;
- private bathroom;
- kitchenette;
- mini-fridge supplied with the room;
- built-in shelves/cabinets;
- window/view/room position;
- room size;
- included utilities/services.

These may affect rent or room category.

They stay with the residence when the player moves unless a specific contract says otherwise.

### 7.2 Player-owned belongings

Examples:

- rug;
- desk lamp;
- posters;
- books/CDs;
- bags;
- portable electronics;
- personal bedding/decor;
- later movable furniture where a tenancy allows it;
- the player's PC/hardware and other purchased items.

These are concrete physical item instances under the universal physical-item/location model.

They normally do not increase rent merely because the player owns or places them.

When the player moves, these exact instances may move with them. Do not delete/recreate them as decorative state.

---

## 8. Rent and residence upgrades

Housing cost should reflect the actual tenancy and supplied property features rather than an abstract room level.

Representative inputs may include:

- base room/apartment rent;
- room size/tier;
- supplied fixture package;
- private bathroom;
- kitchenette/mini-fridge;
- better position/window/view;
- included services/amenities.

A motel may offer changes that function as service/package upgrades:

```text
cheap supplied bed
→ better supplied bed

small supplied desk
→ better/larger supplied desk

basic room
→ room with mini-fridge

shared bathroom
→ private bathroom room
```

These are not automatically player-owned purchases. They may instead raise recurring rent because the property is supplying a better room/fixture package.

Player-owned decor is separate.

Do not simulate real-world hotel/motel law in excessive detail. The game needs a coherent economic/ownership rule, not a tenancy-law simulator.

---

## 9. Moving

The game should support changing residence without changing world architecture.

A representative flow is:

```text
learn/find available residence
→ inspect location, capabilities and terms
→ commit tenancy/move-in cost
→ current residence changes
→ move eligible owned belongings
→ old property keeps landlord-owned fixtures
→ home/navigation/deliveries now resolve the new residence
```

The player does not need to carry every box manually.

A practical assisted moving action is acceptable, but the domain result must still preserve:

- exact player-owned item identity;
- no duplication;
- no silent deletion;
- old-residence fixture ownership;
- new current residence truth;
- correct delivery/home routing.

Moving can consume time and money later if it improves pacing, but it should not become a moving-company simulator.

---

## 10. Apartments and housing availability

Later housing should use specific canonical authored Places in the town.

Examples:

- tiny studio over a shop;
- cheap apartment in another district;
- small basement/attic unit;
- other bounded authored residences if needed.

Availability may change through simulation/content state:

- vacant;
- occupied;
- not yet known to the player;
- unavailable;
- available after a listing/conversation/event.

Do not create infinite abstract apartments that exist only in a housing menu if the rest of the town uses stable Place identities.

Housing geography matters because moving can change:

- commute/walk/bus convenience;
- district identity;
- access to shops/work/social places;
- delivery behavior;
- neighborhood atmosphere;
- recurring encounters.

---

## 11. Multi-view residences

Multi-view remains valid and useful.

A residence may use:

- one excellent hero view;
- multiple authored main views;
- focus views;
- any combination justified by spatial memory and interaction.

The rule is still:

> **Multi-view is not a quality tier.**

A tiny cheap room may need only one or two strong compositions. A larger apartment may need several. The runtime must not require every residence to look like the old Room 104 three-view contract.

---

## 12. Modular visual architecture

A physical place must not be one permanently flattened image when gameplay state requires pieces to change.

Use layers/categories equivalent to:

```text
Residence View
├── static architecture/background
├── structural/built-in fixtures
├── replaceable residence-owned fixture slots
├── player-owned movable props/decor
├── temporary world state
├── characters
├── foreground/ambient layers
├── lighting/weather treatment
└── optional normal maps / effect masks
```

Not every object needs its own sprite/layer.

Separate an element when the game needs to:

- replace it;
- move it;
- hide/show it;
- transfer ownership/location;
- animate it independently;
- change it without regenerating every room permutation.

Examples that should normally remain modular when stateful:

- bed variant;
- desk/chair variant;
- rug;
- lamp;
- curtains;
- PC/monitor;
- parcels/bags;
- visible clothing/clutter;
- selected small decor.

---

## 13. Multi-view asset mapping

One semantic object/fixture may require different art for different camera compositions.

Example:

```text
bed fixture instance / assignment
        ↓
view A asset variant
view B asset variant
(no asset in view C because it is not visible)
```

Do not duplicate the bed as three gameplay objects merely because three images are needed.

State identity remains one thing; presentation mapping is view-specific.

This applies to:

- furniture;
- curtains;
- rugs;
- PC/monitor;
- larger decor;
- characters when staging requires view-specific scale/position.

---

## 14. 3D blockout → Gen-AI → Phaser production pipeline

The default production workflow for important interiors/exteriors should be:

```text
1. SIMPLE 3D BLOCKOUT
        ↓
2. LOCK SPATIAL RELATIONSHIPS
        ↓
3. CHOOSE AUTHORED CAMERAS / VIEWS
        ↓
4. RENDER REFERENCE SHOTS / MASKS AS USEFUL
        ↓
5. GEN-AI VISUAL GENERATION / PAINT PASS
        ↓
6. SEPARATE STATEFUL / REPLACEABLE ELEMENTS
        ↓
7. AUTHOR VIEW-SPECIFIC ASSETS + ANCHORS
        ↓
8. PHASER 4 RUNTIME COMPOSITION
```

### Why use the blockout

The blockout provides:

- consistent room dimensions;
- consistent furniture placement;
- camera/perspective reference;
- agreement between multiple views;
- exterior/interior spatial consistency;
- repeatable references when generating variants/upgrades;
- easier masks/object IDs/depth references where useful.

### What the blockout is not

It is not:

- the shipped realtime environment;
- a reason to switch to a 3D engine/runtime;
- a requirement for free walking;
- the canonical gameplay state.

Phaser remains the active physical-world renderer under the current architecture.

---

## 15. Gen-AI asset rule

Gen-AI is a first-class production tool, but it should not decide spatial truth independently every time an image is generated.

Prefer:

- known blockout composition;
- fixed camera reference;
- stable architectural dimensions;
- consistent material/era references;
- separate generation of important stateful furniture/props where needed;
- controlled per-view variants.

Avoid generating every possible home state as one full-room image such as:

```text
room + bed A + desk A + rug A
room + bed A + desk A + rug B
room + bed B + desk A + rug A
room + bed B + desk B + rug C
...
```

That combinatorial approach destroys the value of the modular system.

---

## 16. Phaser 4 responsibilities

Phaser composes the active residence/view from projections of canonical state.

It may own:

- image/sprite layers;
- normal-map lighting;
- particles;
- ambient motion;
- camera/view transitions;
- pointer hit regions;
- presentation depth;
- visual interpolation;
- weather/window effects.

It does not own:

- tenancy truth;
- rent payment authority;
- physical item ownership;
- current home identity;
- delivery order truth;
- PC ownership/OS state;
- the decision that a fixture upgrade was purchased/accepted.

Those come from simulation/content authorities.

---

## 17. Interaction consequences of a poor starter room

Starting with a worse room is useful only if it changes behavior, not just background art.

Examples:

### No private bathroom
The player uses a shared motel facility. Hygiene consumes different time/convenience and can create small social/ambient opportunities.

### No kitchenette
The player relies more on motel/common facilities, convenience-store food, café/work food, or cheap no-cook items.

### Poor desk
PC setup may still be possible if the desk is capable, but space/storage/comfort presentation is worse. Do not introduce a soft lock if the cheapest valid starter path requires a PC later.

### Weak storage
The player has fewer supplied storage anchors/containers and may rely on bags/owned storage.

### Better room later
A better room should visibly and behaviorally improve daily life rather than grant a generic percentage bonus.

---

## 18. Soft-lock rule

Housing progression must never accidentally make the canonical game impossible.

The cheapest valid starting choice must still have a feasible path to required core systems.

This does **not** mean every room must directly contain every facility.

For example:

- no private shower is fine if a shared bathroom exists;
- no kitchenette is fine if affordable food routes exist;
- a minimal room can still support or later gain access to a PC-capable surface;
- deliveries may go to reception/door if the room itself lacks a suitable parcel anchor.

Design alternatives, not invisible freebies.

---

## 19. Pre-release save policy

Historical development saves do not constrain this architecture.

Until the project explicitly declares a save-compatibility freeze for a content-complete Alpha/Beta/release milestone:

```text
breaking persisted-state change
        ↓
increment/invalidate development save compatibility as needed
        ↓
refuse/reset incompatible old dev save cleanly
        ↓
start from canonical new-game state
```

Do not add:

- historical dev-save migrations;
- permanent aliases;
- obsolete fields;
- dual authorities;
- architecture shims;

solely to keep old experimental saves alive.

After an explicit future save-compatibility freeze, migration/backward-compatibility policy becomes mandatory from that point forward.

---

## 20. Room 104 status

Room 104 is now one of three things only:

1. an ordinary motel-room content definition;
2. a useful reference/test fixture for generic living-place behavior;
3. a possible residence in a playthrough if availability/economy permits.

It is **not**:

- the player's identity;
- the permanent home alias;
- the required starting room;
- the only PC setup location;
- the only delivery destination;
- the required final-art vertical slice.

Reusable generic work from the former #26 / PR #80 should be preserved. Room-104-only production polish should not continue unless required to de-specialize/prove the generic system.

---

## 21. Evaluation / acceptance direction

A future housing/residence gate should prove at least:

1. a new player can choose among a few affordable available rooms;
2. the selected residence becomes dynamic `home` truth;
3. the cheapest room can lack private bathroom/kitchenette without fake local actions;
4. at least one player-owned decor item can be placed and moved;
5. at least one residence-owned fixture/package can change rent without becoming player property;
6. a better motel room can become available and be selected;
7. moving preserves exact owned belongings with no duplicates/loss;
8. home navigation/deliveries/PC actions follow the new residence;
9. one tiny apartment at a canonical town address can use the same generic residence/place runtime;
10. the visual pipeline can swap bed/desk/rug state across relevant views without full-room permutation art.

That is a stronger proof of the game's living-world architecture than permanently polishing one sacred Room 104.

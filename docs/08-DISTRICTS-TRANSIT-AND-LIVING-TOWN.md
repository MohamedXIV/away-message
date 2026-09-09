# Districts, Transit, and the Living Town

## Status

This document records the canonical physical-town direction for Away Message.

It extends the existing living-world architecture without changing the core genre: Away Message is **not** becoming an open-world walking game or a transport simulator.

The approved model is:

```text
ONE SIMULATED TOWN
        ↓
geographic/social Districts
        ↓
Places + Transit Stops
        ↓
Bus Lines + local walking
        ↓
authored living physical scenes
```

The simulation sees one town. The player sees it through authored places, district navigation, local transitions, bus stops, and occasional bus rides.

---

## 1. Core decision: one world, several districts

Away Message should use **districts / distinct town areas**, not one giant continuous open-world map.

A district is a geographic and social grouping of places. It is useful for:

- mental geography;
- visual identity;
- grouping many locations without a giant icon cloud;
- local routines and character identity;
- transit planning;
- gradual discovery;
- future content expansion.

A district is **not**:

- a game level;
- a Phaser scene class;
- a separate save;
- a separate clock;
- a separately simulated world;
- a loading-zone excuse for resetting NPC state.

All districts share the same authoritative time, weather/world state, economy, character state, appointments, deliveries, and event history.

> **One town, one simulation. Districts organize geography; they do not divide reality.**

---

## 2. Why not one continuous open world

The game benefits more from authored density than from traversable square mileage.

A continuous top-down/isometric city would spend production budget on:

- long streets between interesting places;
- collision/pathfinding for the player;
- repeated exterior geometry;
- traversal animation;
- camera/navigation edge cases;
- making empty distance feel justified.

Those costs do not strengthen Away Message's main fantasy.

The preferred loop is closer to:

```text
Room 104
  ↓
local/town map or physical exit
  ↓
walk to a nearby place OR reach a bus stop
  ↓
travel happens in authoritative simulation
  ↓
arrive at another authored living place
```

The town can therefore feel much larger than the currently rendered scene while each destination receives strong composition, atmosphere, sound, objects, and characters.

---

## 3. Target town density

The town should eventually be large enough that characters can have routines that do not all collapse into the same café, store, and park.

A useful long-term target is **dozens of stable place definitions**, while only a minority need flagship production depth at any one time.

Place depth remains variable:

### Flagship
Examples: Room 104, a deeply important home.

- several authored views when useful;
- deep containers/physical objects;
- strong state continuity;
- high environmental detail.

### Major
Examples: important café, workplace, recurring social location.

- one or two living views;
- character anchors;
- focused interactions;
- strong time/weather/audio response.

### Normal
Examples: convenience store, diner, library, laundromat, electronics store.

- one strong hero view;
- a few focus views/hotspots;
- persistent state where relevant.

### Light / ambient
Examples: bus stop, canal, alley, street corner, small service.

- one living composition;
- weather/time/audio/ambient actors;
- a few meaningful interactions.

### Contextual
Examples: obscure office, clinic, private address, temporary event site.

- one simple authored view when needed;
- may later be promoted without changing canonical `placeId`.

The design goal is **small-town density**, not maximum map size.

---

## 4. District identity

Districts should differ by more than map color.

They can carry different mixes of:

- rent/wealth level;
- architecture and signage;
- businesses and services;
- foot traffic;
- bus coverage;
- day/night activity;
- ambient noise;
- recurring NPC populations;
- weather exposure;
- local reputation;
- opening hours.

Illustrative groupings, not frozen final names:

```text
Motel / Old Commercial
  motel
  laundromat
  corner store
  cheap diner
  pawn/thrift shop
  copy shop
  local bus stop

Downtown
  library
  computer store
  café
  record shop
  offices
  cinema
  transit hub

Riverside / Canal
  canal walk
  park
  quieter café
  apartments
  scenic bus stop
  evening venue

Industrial / Outskirts
  warehouses
  service businesses
  cheaper jobs
  sparse night service
```

A character's preferred district can become part of their identity and routine without requiring scripted exposition.

---

## 5. Preserve and promote the existing bus idea

Away Message already has bus travel in `src/engine/CityMap.ts`.

Today that system models bus access as `bus: true` on selected street edges, with a `$2` flat trip and roughly half the walking time when every path leg supports bus travel.

That implementation is useful **seed behavior**, not something to throw away.

The direction is to promote it into a real transit domain:

```text
DistrictDefinition
PlaceDefinition
TransitStopDefinition
BusLineDefinition
TransitService
TravelPlan / TravelLeg
ActiveTravelState
```

The legacy edge booleans should eventually stop being authoritative once first-class lines/stops are proven.

---

## 6. Bus transit is infrastructure, not fast travel

A bus trip is a real world action with:

- an origin;
- a stop;
- a line;
- a departure opportunity;
- waiting time;
- ride time;
- destination stop;
- optional transfer;
- fare;
- arrival time;
- possible service disruption.

The player does not need to watch every minute of the trip, but the simulation must know the trip happened.

A human-readable travel choice may look like:

```text
Walk — 38 min — free
Bus — 7 min wait + 14 min ride — $2
```

If a transfer is required, present it simply:

```text
Route 1 → Downtown Terminal
transfer to Route 2 → Riverside West
```

Do not make the player operate a professional timetable planner.

---

## 7. Initial fare/service policy

To preserve the current game's tuning while the architecture changes:

- the initial evaluation bus fare remains **$2 per complete bus itinerary**;
- transfers within that planned itinerary are included in that fare;
- line service uses authored start/end times and regular headways;
- walking remains free;
- future content may introduce other fare/service policies through data without changing the public planner contract.

This is a migration/tuning default, not a promise that every future route or game version costs exactly $2.

---

## 8. Transit data model

Exact implementation names may evolve, but content needs concepts equivalent to:

```ts
interface DistrictDefinition {
  id: string;
  name: string;
  mapPosition?: { x: number; y: number };
  tags?: string[];
}

interface PlaceDefinition {
  id: string;
  districtId: string;
  name: string;
  accessStops?: Array<{
    stopId: string;
    walkMinutes: number;
  }>;
}

interface TransitStopDefinition {
  id: string;
  districtId: string;
  name: string;
  placeId?: string;
}

interface BusLineDefinition {
  id: string;
  name: string;
  stops: string[];
  serviceStartMinute: number;
  serviceEndMinute: number;
  headwayMinutes: number;
  segmentMinutes: number[];
  fare: number;
}
```

Content definitions describe the normal network.

Per-save state describes current reality:

- disruptions;
- known/unknown places and routes;
- active trips;
- current itinerary leg;
- actor origin/destination;
- expected arrival;
- dynamic closures/delays.

---

## 9. Travel planner

The pure TypeScript simulation owns travel planning.

A travel plan may contain:

```text
walk
→ wait
→ bus
→ transfer walk/wait
→ bus
→ final walk
```

The planner should be deterministic for the same:

- origin;
- destination;
- departure time;
- network definitions;
- active service/disruption state;
- route policy.

For the authored small-town network, a small time-dependent shortest/earliest-arrival planner is enough. There is no need for GTFS-scale infrastructure or traffic simulation.

Renderer/UI code never invents:

- fare;
- wait time;
- arrival time;
- line availability;
- transfer validity.

It presents the simulation's quote/itinerary.

---

## 10. Local walking still matters

The bus is not an arbitrary gate.

Nearby places within a district can usually be reached by authored walking links. Adjacent districts may also permit walking when plausible.

The tradeoff can therefore be contextual:

- walk to save money;
- take the bus to save time/energy;
- walk because service ended;
- take a bus because weather is bad;
- walk with another person;
- miss a connection and choose an alternative.

We do **not** render continuous walking between every location. Walking is a simulated travel leg that may use a short transition or authored street scene when useful.

---

## 11. Town and district navigation

The map should scale hierarchically rather than becoming one giant flat list of locations.

Preferred mental model:

```text
Town Map
  ↓
District
  ↓
known local Places + Stops
  ↓
Living Place
```

The town-level view emphasizes:

- districts;
- major transit lines/hubs;
- important known destinations.

The district view emphasizes:

- local places;
- nearby stops;
- local walking relationships;
- current knowledge/availability.

This hierarchy is presentation only. Canonical place IDs remain stable regardless of how the map groups them.

---

## 12. Bus stops are real places

A bus stop should use the same `Place → Space → View → Focus → Anchor` world language as other physical locations.

A normal stop may need only one hero view, but it can still contain:

- shelter/bench;
- stop sign;
- route board/timetable;
- posters/local ads;
- weather and wetness;
- traffic;
- ambient pedestrians;
- physically present NPCs;
- lighting and spatial audio.

The player can inspect the board or wait for a bus by interacting with the actual place.

A bus stop should not be a full-screen transport menu pretending to be world content.

---

## 13. Bus interior as a reusable living scene

A bus interior is a high-value, relatively cheap Away Message scene.

Default target:

- one authored hero composition;
- reusable seat/rider anchors;
- moving exterior/window layers;
- route/district-dependent exterior treatment;
- day/night/weather lighting;
- engine/road/rain/interior audio;
- physically present riders when simulation says they overlap the trip.

The ride presentation is optional/compressible.

```text
Authoritative trip = 21 game minutes

Presentation can be:
- full short living scene;
- abbreviated montage;
- immediate skip after boarding;

All paths still advance exactly the same 21 game minutes once.
```

Presentation never becomes travel authority.

---

## 14. NPCs use the same town

NPC schedules should not normally teleport characters from one place to another.

The target state progression is:

```text
AtPlace
  ↓
AboutToLeave / departure pressure
  ↓
InTransit
  ↓
Arrived
  ↓
AtPlace
```

Schedules express intended destinations/times. The travel system resolves how long reaching them actually takes.

This allows meaningful outcomes without continuous NPC street rendering:

- an NPC leaves work early enough to catch a bus;
- misses service and arrives late;
- walks after the last bus;
- cancels when no valid route remains;
- overlaps another NPC or the player at a stop;
- rides the same bus segment;
- reaches an appointment after a believable travel interval.

The renderer only shows a character at a stop/bus/place when simulation state supports that presence.

---

## 15. Transit co-location creates social texture

The network can generate small unscripted social moments because actors share real travel state.

Examples:

- the player boards and recognizes someone already seated;
- two NPCs wait at the same stop;
- a contact later references having seen the player on a line;
- an appointment starts with someone arriving late because of transit;
- a recurring commuter becomes familiar over time.

These moments should come from truthful co-location windows, not arbitrary spawn rolls that contradict schedules.

Transit supplies the evidence; social/narrative systems decide whether anything noteworthy happens.

---

## 16. Place and route discovery

The town can know about locations/routes before the player does.

Player knowledge can progress semantically through states equivalent to:

```text
unknown
→ heard of / address learned
→ known on map
→ visited
→ familiar
→ personally meaningful
```

Transit knowledge can work similarly without gamey fog-of-war bars.

Discovery can come from:

- NPC conversation;
- local websites/directories;
- classifieds and job listings;
- email/address information;
- posters/signage;
- route boards;
- riding a line;
- invitations/appointments.

This is important because the digital world should help reveal the physical town, and physical travel should reveal more of the digital/social world.

---

## 17. Weather, time, and world events affect transit

Transit should consume shared world state rather than run its own weather/event simulation.

Useful bounded effects include:

- rain increasing walking time or making bus travel more attractive;
- severe weather increasing headway/delay through an explicit service modifier;
- temporary stop closure;
- reduced late-night/Sunday service;
- community event rerouting or crowding flavor;
- last-bus pressure.

Do not build vehicle traffic or traffic-light simulation.

Any gameplay-affecting disruption must be deterministic/seeded or explicit world state and must survive save/load correctly.

---

## 18. Data-driven ownership

The existing Content UI → TinyBase → validation/codegen pipeline remains authoritative for authorable town definitions.

It should own definitions for:

- districts;
- places and district membership;
- transit stops;
- access walking links;
- bus lines and ordered stops;
- normal service windows/headways;
- segment travel times;
- initial fare/service metadata;
- route/stop presentation assets where applicable.

Simulation/save state owns mutable travel reality.

Phaser/React consume generated definitions and simulation state. They do not open `content/store.json` directly.

---

## 19. Persistence and determinism

Active travel must be saveable.

At minimum the saved state must preserve enough to reconstruct exactly:

- actor;
- origin;
- destination;
- departure time;
- expected arrival;
- itinerary;
- current leg/progress boundary;
- associated appointment/obligation when relevant.

Reloading must not:

- reroll the route;
- charge fare again;
- teleport early;
- duplicate arrival consequences;
- lose an NPC in transit.

A large time jump across a trip must reach the same final state as normal ticking.

---

## 20. Production scaling rule

Adding a district should be primarily a content expansion, not an engine rewrite.

A new district can begin with:

- a stable district definition;
- several lightweight place definitions;
- one or two living public scenes;
- one or more stops;
- connection to an existing/new bus line.

Individual locations can later be promoted from simple to richer presentation without changing their canonical identity.

This lets the town grow to dozens of destinations while production effort stays concentrated on the places that matter most.

---

## 21. Explicit non-goals

Do not turn this direction into:

- continuous open-world player traversal;
- isometric/top-down WASD city navigation;
- drivable buses;
- bus vehicle physics;
- traffic simulation;
- a professional timetable/GTFS simulator;
- unique bus art for every route;
- every district visible from Day 1;
- every place receiving Room 104 production depth;
- district-specific copies of global simulation state.

---

## 22. Migration from current `CityMap.ts`

The current city graph should be migrated, not deleted blindly.

Preserve as initial evidence/data:

- current place identities where still useful;
- current walking times/links;
- current bus-capable corridors as seeds for first bus-line topology;
- the current `$2` fare as the initial evaluation fare;
- existing travel callers and encounter behavior where compatible.

Migration order:

```text
current CityMap graph
  ↓
generated District/Place/Stop/Line definitions
  ↓
TransitNetwork + TravelPlanner becomes authority
  ↓
legacy quoteTravel / bus-edge adapter only while callers migrate
  ↓
remove duplicate authority
```

Do not leave both systems authoritative indefinitely.

---

## 23. Implementation tracking

This direction is tracked by the living-world epic and dedicated issues:

- #16 — living physical-world epic;
- #17 — physical-world/town content authoring;
- #20 — generic Place/Space/View/Focus/Anchor runtime;
- #29 — final living-world integration gate;
- #35 — district-aware TransitNetwork + shared routing;
- #36 — district navigation + living stops + bus-ride presentation;
- #37 — NPC departure/transit/arrival continuity.

Technical design:

`docs/superpowers/specs/2026-09-10-districts-and-transit-design.md`

Implementation plan:

`docs/superpowers/plans/2026-09-10-districts-and-transit.md`

---

## 24. Final design law

The intended feeling is:

> **A small town large enough for people to have lives outside the player, presented through intimate authored places rather than open-world traversal.**

The bus network is one of the main systems that makes that illusion truthful. It connects economy, time, weather, appointments, character routines, discovery, and physical/social meetings without requiring the game to render every meter between them.

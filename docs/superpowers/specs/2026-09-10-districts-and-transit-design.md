# Districts and Transit Design

## Status

Approved architectural direction for Away Message's physical-town geography and transit layer.

This spec implements the product direction in `docs/08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` and is tracked by #16, #35, #36, and #37.

## 1. Problem

The current town model in `src/engine/CityMap.ts` is intentionally small and useful, but it does not scale to the intended living-town direction:

- places are one flat node set;
- bus service is represented by `bus: true` on selected graph edges;
- bus timing is derived as roughly half walking time;
- there are no first-class districts, stops, lines, service windows, waits, transfers, or active transit state;
- character schedules can know locations without a shared transit continuity model.

Away Message needs a town that can grow to dozens of authored places without becoming an open-world walking game or a giant flat map.

## 2. Chosen architecture

```text
Content UI / TinyBase
        ↓
validated generated definitions
        ↓
District / Place / TransitStop / BusLine registries
        ↓
TransitNetwork + TravelPlanner
        ↓
ActiveTravelState / actor mobility
        ↓
SimulationEngine
   ┌────────────┴────────────┐
   ↓                         ↓
player navigation       NPC schedules/presence
   ↓                         ↓
React town UI           character systems
   └────────────┬────────────┘
                ↓
      Phaser active Place/View
```

The architecture follows five fixed laws:

1. **One town, one simulation.** Districts never create a second clock, save, world state, or simulation instance.
2. **Districts organize geography; Places remain canonical destinations.** A district is not a level or Phaser scene class.
3. **Transit is simulation truth.** UI/renderers never invent fares, waits, service, routes, or arrival times.
4. **Player and NPCs share routing truth.** Different actors may have preferences, but valid movement comes from the same network.
5. **No continuous open-world requirement.** Walking and bus travel can be simulated between authored living scenes.

## 3. Content definitions

The exact storage encoding may follow TinyBase conventions, but generated runtime types should be equivalent to the following.

```ts
export type DistrictId = string;
export type PlaceId = string;
export type TransitStopId = string;
export type BusLineId = string;

export interface DistrictDefinition {
  id: DistrictId;
  name: string;
  mapX: number;
  mapY: number;
  tags: string[];
}

export interface PlaceTransitAccess {
  stopId: TransitStopId;
  walkMinutes: number;
}

export interface PlaceDefinition {
  id: PlaceId;
  districtId: DistrictId;
  name: string;
  transitAccess: PlaceTransitAccess[];
}

export interface TransitStopDefinition {
  id: TransitStopId;
  districtId: DistrictId;
  name: string;
  placeId: PlaceId | null;
  mapX: number;
  mapY: number;
}

export interface BusLineDefinition {
  id: BusLineId;
  name: string;
  stopIds: TransitStopId[];
  serviceStartMinute: number;
  serviceEndMinute: number;
  headwayMinutes: number;
  segmentMinutes: number[];
  fare: number;
}
```

### Required validation

Validation fails before runtime when:

- a place references a missing district;
- a stop references a missing district or physical place;
- a place access entry references a missing stop;
- `walkMinutes <= 0` for a non-identical access relation;
- a line has fewer than two stops;
- a line references a missing stop;
- adjacent duplicate stop IDs occur;
- `segmentMinutes.length !== stopIds.length - 1`;
- any segment duration is non-positive;
- `headwayMinutes <= 0`;
- fare is negative;
- service time cannot be normalized into a valid recurring daily service window.

The generated definitions are immutable runtime inputs. Dynamic closures/delays and actor trips are state, not content.

## 4. Initial authored migration seed

The current `CityMap.ts` remains the source for initial migration values while #35 is implemented.

Current place identities include:

```text
home
lobby
cart
cafe
diner
canal
laundry
techmart
```

Current bus-capable corridors seed the first line topology rather than being deleted blindly:

```text
lobby ↔ cafe
lobby ↔ diner
diner ↔ cafe
cart ↔ diner
```

Current tuning also seeds:

```text
bus fare = $2
```

The new architecture must preserve useful walking times and behavior through a compatibility adapter until callers migrate. `bus: true` must stop being authoritative once the generated TransitNetwork is active.

## 5. Initial fare policy

The evaluation default is intentionally simple and preserves current tuning:

```text
$2 per complete planned bus itinerary
```

Transfers inside that itinerary are included in the same $2 fare.

This is represented by the planner result, not deducted separately by UI. A future fare-policy abstraction may change the content model, but the public travel request/result contract should remain stable.

Fare is charged exactly once when the trip is committed. Cancelling before trip commitment charges nothing. Reloading an already committed trip does not charge again.

## 6. Service model

Each line has one daily recurring service window and a fixed headway for the first implementation.

For a line with:

```ts
serviceStartMinute = 360; // 06:00
serviceEndMinute = 1380;  // 23:00
headwayMinutes = 20;
```

base departures from the first stop are:

```text
06:00, 06:20, 06:40, ... 22:40
```

Arrival/departure time at later stops is the base departure plus the sum of preceding `segmentMinutes`.

For a boarding request at a stop and game minute `t`, the planner finds the first service instance whose stop-arrival/departure time is `>= t` and whose trip remains within the authored service run.

Cross-midnight service is not required in the first implementation. A line that needs late-night service should use `serviceEndMinute <= 1440`; service after midnight belongs to the next game day. This keeps the first planner deterministic and small.

## 7. Runtime service modifiers

Dynamic transit state may apply bounded modifiers without editing definitions.

```ts
export interface TransitServiceState {
  closedStopIds: TransitStopId[];
  closedLineIds: BusLineId[];
  lineDelayMinutes: Record<BusLineId, number>;
  headwayMultiplier: Record<BusLineId, number>;
}
```

Rules:

- a closed line contributes no bus edges;
- a closed stop cannot be boarded/alighted at;
- `lineDelayMinutes` shifts the line's current service instances;
- `headwayMultiplier >= 1` may reduce service frequency for an explicit world event;
- modifiers are simulation state and persist when they affect saved outcomes.

No traffic simulation is introduced.

## 8. Travel plan model

The planner returns a complete immutable itinerary proposal.

```ts
export type TravelLeg =
  | {
      kind: 'walk';
      fromPlaceId?: PlaceId;
      toPlaceId?: PlaceId;
      fromStopId?: TransitStopId;
      toStopId?: TransitStopId;
      minutes: number;
    }
  | {
      kind: 'wait';
      stopId: TransitStopId;
      lineId: BusLineId;
      minutes: number;
      boardAtMinute: number;
    }
  | {
      kind: 'bus';
      lineId: BusLineId;
      fromStopId: TransitStopId;
      toStopId: TransitStopId;
      boardAtMinute: number;
      alightAtMinute: number;
      minutes: number;
    };

export interface TravelPlan {
  originPlaceId: PlaceId;
  destinationPlaceId: PlaceId;
  departAtMinute: number;
  arriveAtMinute: number;
  legs: TravelLeg[];
  walkMinutes: number;
  waitMinutes: number;
  rideMinutes: number;
  totalMinutes: number;
  fare: number;
  transferCount: number;
  busLineIds: BusLineId[];
}
```

A no-op trip from a place to itself returns zero time, zero fare, and no legs.

## 9. Planner algorithm

Use a small deterministic earliest-arrival search over a time-dependent graph.

Graph concepts:

- `Place → Stop` access edges use authored walking minutes;
- authored direct place-to-place walking links may remain available for local movement;
- `Stop → Stop` bus movement is calculated from line schedules;
- transfer waits are derived from the next valid line service after reaching a stop.

The recommended implementation is Dijkstra-style earliest-arrival search where the cost stored for a node is absolute arrival minute, not static distance.

When expanding a bus option at a stop:

1. calculate the next valid service time for that line at the current stop;
2. add deterministic wait time;
3. calculate arrival at downstream stops from authored segment durations;
4. ignore unavailable line/stop options;
5. update candidate arrival times.

Tie breaking must be stable:

1. earliest arrival;
2. lower fare;
3. fewer transfers;
4. fewer walk minutes;
5. lexical stable key as final deterministic tie-break.

The network is small enough that optimization beyond clear deterministic code is unnecessary.

## 10. Route policies

The planner public API supports a bounded policy enum:

```ts
export type TravelPolicy =
  | 'fastest'
  | 'cheapest'
  | 'walk_only'
  | 'prefer_bus';
```

Initial behavior:

- `fastest`: earliest arrival, then standard tie-breaks;
- `cheapest`: prefer zero-fare walking if it reaches the destination, with arrival time as secondary score;
- `walk_only`: ignore all bus edges;
- `prefer_bus`: among reasonable valid plans, prefer a bus itinerary unless walking arrives at least 15 minutes sooner.

NPC character configuration may choose one of these policies. The route network itself stays shared.

## 11. Weather and walking

Existing behavior where rain increases walking duration is preserved as a general travel modifier.

Initial rule:

```text
rain walking multiplier = 1.25
```

The multiplier applies to walking legs before schedule lookup. Therefore rain can cause a traveler to miss an earlier bus naturally.

Weather does not silently modify bus segment duration unless an explicit transit service modifier/world event does so.

## 12. Active travel state

Once a plan is committed, simulation stores enough state to avoid rerouting or recharging on reload.

```ts
export interface ActiveTravelState {
  actorId: string;
  plan: TravelPlan;
  committedAtMinute: number;
  currentLegIndex: number;
  farePaid: number;
  status: 'active' | 'arrived' | 'cancelled';
  purposeRef?: string;
}
```

The persisted itinerary is a snapshot of the committed route. Later service changes do not retroactively rewrite an actor already aboard a leg. They may affect future unstarted legs only if the explicit trip-state transition policy supports replanning; the first implementation should keep committed plans stable and resolve newly impossible future legs through a controlled failure/replan action rather than silent mutation.

## 13. Player travel execution

The player-facing flow separates planning, commitment, and presentation.

```text
request travel quote
  ↓
show walk/bus options
  ↓
player chooses plan
  ↓
commit plan + charge fare once
  ↓
ActiveTravelState
  ↓
optional stop / bus presentation
  ↓
advance through authoritative time path
  ↓
arrive
```

A compressed/skip ride still advances the exact remaining itinerary duration once.

React/Phaser must never call `cash -= 2` or independently set `player.location = destination`.

## 14. NPC travel execution

Normal cross-place schedule movement uses the same planner.

Character mobility exposes state equivalent to:

```text
AtPlace
AboutToLeave
InTransit
AtPlace
```

A schedule/appointment provides a target place and desired arrival time. A mobility coordinator asks the planner for a route early enough to meet that arrival where possible.

The first implementation does not require sophisticated backwards timetable optimization. It may compute a route from candidate departure times before the target and choose the latest plan whose `arriveAtMinute <= desiredArrivalMinute`; if none exists, it chooses the fastest valid plan and exposes lateness.

Arrival consequences remain owned by existing appointment/job/social systems.

## 15. Transit co-location

Transit state must make physical overlap queryable.

Two actors overlap when their committed plans place them:

- waiting at the same stop during intersecting time intervals; or
- on the same `lineId` and overlapping bus segment/time interval; or
- at the same destination after arrival according to normal place presence rules.

The transit layer exposes facts such as:

```ts
interface TransitCoLocation {
  actorIds: [string, string];
  kind: 'stop' | 'bus';
  stopId?: TransitStopId;
  lineId?: BusLineId;
  startMinute: number;
  endMinute: number;
}
```

It does not decide whether dialogue or an encounter occurs.

## 16. District and route knowledge

Physical existence and player knowledge are separate.

Suggested player-facing knowledge state:

```ts
export type PlaceKnowledge = 'unknown' | 'heard' | 'mapped' | 'visited' | 'familiar';

export interface TownKnowledgeState {
  districts: Record<DistrictId, 'unknown' | 'known'>;
  places: Record<PlaceId, PlaceKnowledge>;
  stops: Record<TransitStopId, 'unknown' | 'known' | 'used'>;
  lines: Record<BusLineId, 'unknown' | 'known' | 'used'>;
}
```

This state controls what navigation UI may expose. It does **not** change whether the physical route exists.

NPCs are not restricted by player knowledge.

## 17. Presentation contracts

### Town/district navigation

React or the appropriate presentation layer receives a projection containing only knowledge-safe data:

- known districts;
- known places;
- known stops/lines;
- current origin;
- travel quotes from the simulation.

It may group places by district and render line diagrams, but must not recompute network truth.

### Bus stop

A stop is represented through the generic `Place/Space/View/Anchor` runtime from #20. The scene may show route signage, weather, riders and timetable information resolved from simulation/content.

### Bus interior

The bus interior is a reusable contextual place/view bound to the current active bus leg. Rider anchors are populated from actual transit co-location facts. The renderer never creates a rider identity merely for ambience when that rider is supposed to be a persistent known NPC.

## 18. Save/load behavior

Persist:

- dynamic transit service state when relevant;
- player town knowledge;
- active player trip;
- active NPC trips needed for continuity;
- schedule/appointment purpose references required to resolve arrival consequences once.

After reload:

- fare is not deducted again;
- committed plan remains identical;
- actor presence reflects the restored clock and leg;
- if restored time is already beyond plan arrival, the simulation resolves arrival idempotently once;
- time-jump processing and incremental ticks reach equivalent final states.

Any breaking persisted shape follows the repository save-format migration law.

## 19. Failure behavior

Planning may fail with explicit reason codes equivalent to:

```ts
export type TravelPlanFailure =
  | 'unknown_origin'
  | 'unknown_destination'
  | 'no_route'
  | 'service_ended'
  | 'stop_closed'
  | 'line_closed';
```

The domain returns a failure object. UI turns it into human-readable presentation.

No route failure may partially charge fare or mutate actor location.

## 20. Testing strategy

### Content tests

Prove valid/invalid district/place/stop/line references and generated-output drift.

### Planner unit tests

Cover:

- same-place no-op;
- walk-only local trip;
- direct bus;
- one transfer;
- rain changes walking/connection timing;
- last service missed;
- line/stop closure;
- deterministic tie-break;
- fare exactly once per itinerary;
- stable outputs for same inputs.

### Active-trip tests

Cover:

- commit without partial mutation;
- incremental leg advancement;
- compressed full-trip advancement;
- save/reload mid-wait and mid-bus;
- idempotent arrival;
- no duplicate fare.

### NPC mobility tests

Cover:

- schedule creates departure intent instead of destination teleport;
- route chosen from shared planner;
- late arrival from missed service;
- stop/bus co-location;
- online/physical presence during transit;
- large time jump equals minute-by-minute result.

### Presentation integration tests

Cover:

- district grouping preserves canonical place IDs;
- unknown places/routes remain hidden from player map;
- stop view receives authoritative service projection;
- bus interior binds to active bus leg and actual riders;
- skipping ride presentation does not change duration/fare outcome.

## 21. Non-goals

This subsystem does not include:

- continuous street navigation;
- player/NPC per-meter pathfinding;
- vehicle physics;
- traffic simulation;
- drivable buses;
- GTFS import/export;
- complex zone fares;
- real-time traffic prediction;
- unique bus interiors for each line;
- a full Life Matrix rewrite;
- social consequences decided inside transit code.

## 22. Rollout order

1. #17 extends content definitions/codegen for districts/stops/lines.
2. #35 introduces generated TransitNetwork + planner and migrates current CityMap semantics.
3. #37 moves NPC schedule continuity onto shared travel truth.
4. #20 provides generic stop/interior physical place semantics.
5. #36 builds player-facing district navigation, living stops and bus presentation.
6. #29 proves the entire system end to end and removes legacy duplicate authority.

This ordering keeps the active PC/OS work isolated and avoids building presentation before transit truth exists.

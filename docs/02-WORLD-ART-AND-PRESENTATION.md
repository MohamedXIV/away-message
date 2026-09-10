# World, Art, and Presentation

## World, Time, and Physical Locations

## 1. World scope

Away Message takes place in **one simulated town larger than any single rendered physical scene**.

The town is organized into geographic/social **districts**. Districts help the player build mental geography and let the content grow to many stable locations without becoming one giant flat map or a continuous open-world traversal space.

The player experiences the town through:

- motel room,
- window/street views,
- work,
- bus stops / street corners,
- buses when a ride is worth presenting,
- cafés and diners,
- used electronics / small shops,
- library, laundromat, parks/canal and other local services,
- browser/news/forums/classifieds,
- messages from people in other districts or parts of town.

This creates the impression of a large, lived-in place without requiring open-world walking.

Canonical model:

```text
ONE SIMULATED TOWN
        ↓
Districts
        ↓
Places + Transit Stops
        ↓
local walking + Bus Lines
        ↓
authored living scenes
```

A district is not a game level, separate save, separate world clock, or Phaser scene authority. All districts share the same simulation.

See `08-DISTRICTS-TRANSIT-AND-LIVING-TOWN.md` for the full town/transit direction.

---

## 2. Physical-world interaction model

Prefer:

- fixed or gently panning 2D viewpoints,
- multiple authored views only where they improve spatial understanding,
- focus views for shelves/drawers/fridges/close interaction,
- hotspots on physical objects and people,
- layered scenes,
- short transitions,
- character puppets/sprites/portraits,
- small ambient loops.

Do not require free walking for the evaluation build or later living-world architecture.

The desired language is closer to:
- old adventure games,
- Japanese adventure/VN staging,
- room simulation,
than to a side-scroller, isometric life RPG, or 3D exploration game.

Outside the in-game computer, interaction should begin from the physical place rather than from SaaS-like action cards whenever practical.

---

## 3. Place production depth

Not every location needs Room 104 production cost.

Use variable depth:

### Flagship places
Examples: Room 104, a deeply important home.

- several authored main views where useful,
- deep physical-object/container state,
- replaceable objects,
- strong lighting/weather/audio response.

### Major places
Examples: recurring café/work/social place.

- one or two strong living views,
- meaningful character/object anchors,
- focus views only where useful.

### Normal places
Examples: convenience store, diner, library, laundromat, electronics store.

- one strong hero view,
- several meaningful hotspots/focuses,
- persistent state where gameplay benefits.

### Light/ambient places
Examples: bus stop, canal, alley, street corner.

- one authored composition,
- weather/time/audio/ambient actors,
- a few meaningful interactions.

### Contextual places
Examples: obscure office, service, temporary/private address.

- one simple view when needed,
- may later be promoted without changing canonical `placeId`.

The long-term world may contain dozens of stable place definitions while only a smaller number are production-heavy at once.

---

## 4. Motel room

The room is the player's anchor.

Required interactables:

- PC desk
- bed
- kettle / drink area
- window
- door / work / travel action
- optional TV/radio
- visible room-upgrade slots

The room should feel slightly depressing at the beginning but not horror-coded.

Important:
- old computer,
- cheap furniture,
- practical lighting,
- visible signs of temporary living.

Over the evaluation build it should become subtly more personal.

The richer living-world direction may use several authored views of the same room rather than one flattened panorama.

---

## 5. Window

The window is an observational surface, not a stat button.

Interaction:
- opens a dedicated wide view or focused scene,
- advances a small amount of time,
- presents contextual thought text,
- can show persistent and ambient elements.

Thought examples:
- `Nice out today.`
- `Busy for a Thursday.`
- `That guy's here again.`
- `Someone finally moved that car.`
- `Huh. He's not there today.`

Thought selection can depend on:
- day,
- time,
- weather,
- observation count,
- street state,
- narrative flags.

Do not show:
- quest started,
- objective marker,
- mystery meter.

---

## 6. Street simulation

Use two layers of street entities.

### Ambient

Not individually persistent:
- cars,
- pedestrians,
- dogs,
- delivery vans,
- school-age groups,
- distant workers.

These can be spawned procedurally or by simple authored patterns.

### Persistent

A small set with schedules/history:
- repeated man outside,
- motel staff,
- old woman with dog,
- delivery person,
- recurring parked car,
- known NPCs genuinely present at a stop or street place.

Only persistent entities need saved identity/state.

Persistent NPCs must not be spawned into a location merely because the renderer needs visual life. Their physical presence comes from simulation/travel truth.

---

## 7. Time of day

At minimum support:

- morning
- day
- evening
- night
- late night

The visual implementation may use fewer unique painted backgrounds and more overlays in the evaluation build.

Simulation time of day must affect:
- lighting,
- ambient density,
- contact schedules,
- available work,
- some location availability,
- bus service/last-bus availability where authored,
- window thoughts,
- selected narrative events.

---

## 8. Weather

Use a light weather system.

Evaluation states:
- clear,
- cloudy,
- rain.

Weather is primarily atmosphere and contextual text, but travel may consume deterministic weather modifiers.

It may lightly affect:
- street density,
- meeting description,
- window observations,
- walking duration,
- transit preference,
- explicit bus-service delay/disruption when a world event says so.

Do not build a deep climate or traffic simulation.

---

## 9. Work location

The normal job is intentionally mundane.

The evaluation build may represent it through:
- short location scene,
- 20–40 second interaction montage,
- quick-shift action after the first full introduction.

The first time should establish:
- where Ryan works,
- what the player does,
- why the job is boring,
- that work consumes a large block of the day.

Later shifts should be fast unless an authored event occurs.

Travel to/from work should ultimately use the same authoritative town/transit timing as other place-to-place movement.

---

## 10. Café

The café is an important physical social location, but it is one place in a larger town rather than the universal meeting point for everyone.

Required:
- at least day/evening presentation,
- one or two staging positions,
- enough room for a meaningful conversation,
- ambient people/noise,
- time passing.

It should feel grounded and cheap enough to be plausible for the protagonist.

Other districts should eventually have their own recurring social/services mix so character routines do not all collapse into one café.

---

## 11. Bus stops / street corners

A bus stop is a **real light-weight living place**, not merely transitional texture and not a transport modal.

A typical stop needs only one authored hero view, but may include:

- stop sign / shelter / bench,
- route board or timetable hotspot,
- posters/signage/local ads,
- day/night/weather treatment,
- traffic and street ambience,
- current waiting riders,
- known NPCs only when simulation says they are physically there.

The player may inspect route information, wait, talk to someone present, or leave through ordinary physical interaction.

The stop does not require movement gameplay.

---

## 12. Bus ride presentation

Bus travel is authoritative simulation state, but an optional reusable bus-interior scene can present selected trips.

Default target:

- one strong interior composition,
- reusable rider/seat anchors,
- moving exterior/window layers,
- district/route-dependent exterior treatment,
- day/night/weather lighting,
- engine/road/rain/interior audio,
- persistent NPC riders only when transit co-location says they overlap the ride.

The player does not need to watch the full simulated duration.

A 21-minute authoritative trip may be shown as:

- a short living scene,
- an abbreviated montage,
- or an immediate skip after boarding.

All variants advance exactly the same authoritative 21 game minutes once. The renderer never determines the fare, service, route, wait, or arrival time.

---

## 13. Used electronics / TechMart

This can be:
- physical shop,
- online site,
- or both.

The evaluation build should demonstrate that a product seen online can have a physical-world consequence or vice versa.

The mature physical-world architecture should allow the store to belong to a district and be reached through local walking/transit like any other canonical place.

---

## 14. Town and district navigation

As the world grows, avoid a giant flat cloud of every location icon.

Preferred presentation:

```text
Town map
  ↓
District
  ↓
known local Places + Stops
  ↓
Living Place
```

Town-level navigation can emphasize districts and major transit connections. District-level navigation can emphasize local places, stops, and walking relationships.

This hierarchy is presentation only. It never changes canonical place identity or divides simulation state.

Places/routes may physically exist before the player knows about them. The map should expose only knowledge-safe destinations learned through people, websites, jobs, email, signs, or travel.

---

## 15. Travel presentation

Local movement and transit are real time/economy choices without requiring continuous traversal rendering.

Examples:

```text
Walk — 38 min — free
Bus — 7 min wait + 14 min ride — $2
```

The simulation owns all route/timing/fare calculations. UI may present alternatives clearly but must not calculate them independently.

Walking can remain available when plausible, including across adjacent districts. The bus is infrastructure, not an arbitrary gate.

---

## 16. Continuous simulation rule

Physical scenes are views over world state.

They must not own:
- the master clock,
- download state,
- contact state,
- event truth,
- money,
- district/place identity,
- bus service,
- travel timing,
- fares,
- NPC transit/presence truth.

Phaser scenes read from the simulation and send player intents/actions back to it.

The town continues to exist while only one physical view is rendered.

---

## 17. Application closure

The game world does **not** need real-world offline progression while the browser/application is closed.

Save/load resumes the stored game state.

The "world keeps running" rule applies while the game session is running and during in-game time jumps, including active player/NPC travel.

This keeps the evaluation deterministic and testable.

---

## Art and Presentation Architecture

## 1. Important status

**Final art style is intentionally not frozen for the evaluation build.**

The evaluation may use:
- pixel art,
- low-resolution raster art,
- illustrated 2D,
- hybrid presentation,
- generated temporary backgrounds,
- provisional portraits.

The purpose is to discover what feels right through play.

Do not treat the visual style chosen for the evaluation build as final art direction.

---

## 2. What is frozen: asset architecture

A physical location must not depend conceptually on one permanently flattened image.

The presentation system should support:

```text
Place / View
├── Background / architecture
├── Midground
├── Foreground
├── Interactive props
├── Character layer
├── Ambient animated layers
├── Lighting/color overlays
└── Time/weather variants
```

Not every evaluation asset needs to be physically separated into all layers, but the runtime/content model must allow it.

---

## 3. Time variants

Support at least these semantic variants:

- morning
- day
- evening
- night
- late night

A location may implement them through:
- separate images,
- color overlays,
- light layers,
- alternate windows,
- changed ambient sprites,
- combinations.

Do not require five fully generated paintings for every location.

---

## 4. Ambient motion

A static scene should gain life from small independent elements.

Examples:
- curtains,
- traffic,
- neon sign,
- fan,
- steam,
- TV flicker,
- rain,
- reflections,
- pedestrians,
- smoke,
- lights switching,
- distant silhouettes,
- bus-window exterior movement.

Prefer:
- sprite movement,
- tween,
- opacity,
- parallax,
- particles,
- short loops,
before using a full video.

---

## 5. Parallax

Locations can use:
- background slow movement,
- midground medium,
- foreground faster.

Small camera pans can create depth without 3D.

Phaser owns this physical presentation.

---

## 6. Wide views and panoramas

Important rooms/locations may use:
- wide illustrated scene,
- gentle horizontal pan,
- multiple fixed viewpoints.

True 360° rendering is not required.

The build should prefer the simplest authored method that creates a sense of place. Multi-view is not a quality tier: add another viewpoint only when it improves spatial understanding or interaction.

---

## 7. Character asset slots

Character presentation must be replaceable.

Suggested slots:

```text
CharacterPresentation
├── WorldSprite / Puppet
├── DialoguePortrait
├── MessengerAvatar
├── ProfilePhoto
├── WebcamImage
├── Expressions
└── SpecialImages
```

The same character can look different through different media while retaining identity.

---

## 8. Evaluation character art

Temporary character images are allowed.

They must not become architectural dependencies.

Do not hardcode:
- one fixed portrait size,
- one character rendering style,
- one assumption that every character always has a portrait.

Some contacts may exist as username/avatar only for a long time.

---

## 9. Period authenticity

Whatever final style is eventually chosen, the **content design** should communicate the era through:

- electronics,
- clothing,
- hair,
- cars,
- store signage,
- public-transit signage/interiors,
- PC hardware,
- CRT/LCD proportions,
- phones,
- MP3 players,
- webcams,
- CDs/DVDs,
- advertising,
- web design,
- furniture.

Pixel art alone does not make something 2006. Period detail must exist in the design.

---

## 10. Fake OS visual generations

### Older OS
Inspired by:
- Windows 98 / ME / 2000 era

Characteristics:
- compact,
- beveled,
- denser,
- older icons,
- modest animation.

### Newer OS
Inspired by:
- Windows XP era

Characteristics:
- warmer,
- cleaner,
- friendlier,
- richer icons,
- controlled gradients,
- slightly softer geometry.

Avoid:
- exact copies,
- copyrighted logos,
- modern flat UI disguised with a retro wallpaper.

---

## 11. Websites

Websites should intentionally vary.

The fake internet can look inconsistent in a good way.

However:
- body text stays readable,
- navigation remains usable,
- essential actions remain obvious enough.

---

## 12. Color/lighting bridge

Even while style is provisional, a build should try to maintain internal cohesion through:
- warm tungsten interiors,
- cooler night exteriors,
- controlled bright accents,
- slightly dirty neutrals,
- CRT glow where relevant.

Districts may develop distinct material/signage/ambient identities without breaking the broader visual language.

This is guidance, not a final palette bible.

---

## 13. Final-art protections

A future final-art pass should be able to replace:
- backgrounds,
- portraits,
- sprites,
- icons,
- wallpapers,
- website images,
- district-map art,
- bus stop/interior presentation,
without rewriting simulation or narrative logic.

Art asset identifiers belong in content definitions, not game rules.

---

## 14. Evaluation priority

For this build:

1. readability
2. atmosphere
3. layered/modular behavior
4. period coherence
5. consistency
6. final polish

A beautiful image that blocks modular time/weather/interaction changes is less valuable than a slightly rougher scene that supports the game's life.

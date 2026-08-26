# World, Art, and Presentation

## World, Time, and Physical Locations

## 1. World scope

The city is larger than the playable physical map.

The player experiences the city through:

- motel room,
- window/street view,
- work,
- bus stop / street corner,
- café,
- used electronics / small shop,
- browser/news/forums/classifieds,
- messages from people in other parts of the city.

This creates the impression of a large place without building open-world traversal.

---

## 2. Physical-world interaction model

Prefer:

- fixed or gently panning 2D viewpoints,
- hotspots,
- layered scenes,
- short transitions,
- character sprites/portraits,
- small ambient loops.

Do not require free walking for the evaluation build.

The desired language is closer to:
- old adventure games,
- Japanese adventure/VN staging,
- room simulation,
than to a side-scroller or 3D exploration game.

---

## 3. Motel room

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

---

## 4. Window

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

## 5. Street simulation

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
- recurring parked car.

Only persistent entities need saved state.

---

## 6. Time of day

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
- window thoughts,
- selected narrative events.

---

## 7. Weather

Use a light weather system.

Evaluation states:
- clear,
- cloudy,
- rain.

Weather is primarily atmosphere and contextual text.

It may lightly affect:
- street density,
- meeting description,
- window observations.

Do not build a deep climate simulation.

---

## 8. Work location

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

---

## 9. Café

The café is the primary physical social location.

Required:
- at least day/evening presentation,
- one or two staging positions,
- enough room for a meaningful conversation,
- ambient people/noise,
- time passing.

It should feel grounded and cheap enough to be plausible for the protagonist.

---

## 10. Bus stop / street corner

Purpose:
- transitional city texture,
- one or two observations,
- a place to see posters/signage,
- possible bridge from physical clue to website.

It does not need movement gameplay.

---

## 11. Used electronics / TechMart

This can be:
- physical shop,
- online site,
- or both.

The evaluation build should demonstrate that a product seen online can have a physical-world consequence or vice versa.

---

## 12. Continuous simulation rule

Physical scenes are views over world state.

They must not own:
- the master clock,
- download state,
- contact state,
- event truth,
- money.

Phaser scenes read from the simulation and send player intents/actions back to it.

---

## 13. Application closure

The game world does **not** need real-world offline progression while the browser/application is closed.

Save/load resumes the stored game state.

The "world keeps running" rule applies while the game session is running and during in-game time jumps.

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
Location
├── Background
├── Midground
├── Foreground
├── Interactive props
├── Character layer
├── Ambient animated layers
├── Lighting/color overlays
└── Time-of-day variants
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
- distant silhouettes.

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

The evaluation build should prefer the simplest method that creates a sense of place.

---

## 7. Character asset slots

Character presentation must be replaceable.

Suggested slots:

```text
CharacterPresentation
├── WorldSprite
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

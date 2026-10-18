# First Production Art & Playable Slice

Status: **Canonical Production Phase A**

Purpose: move Away Message from architecture-complete sandbox systems into its first genuinely playable visual production slice, without prematurely committing the entire game to one final art style.

This phase is intentionally **not** another engine-foundation phase.

The simulation, world, residence, transit, environment, character presentation, Scenario, and content-authoring foundations already exist. The next product question is whether those systems feel coherent, attractive, readable, modular, and worth expanding once they are driven by real production assets.

---

## 1. Phase goal

Build one compact but representative playable slice with real art and presentation quality high enough to judge the game.

The slice should let a player meaningfully experience:

```text
cheap starter residence
  ↓
physical belongings / PC setup
  ↓
window / street atmosphere
  ↓
leave home
  ↓
public place interaction
  ↓
persistent character presentation
  ↓
bus stop / bus ride
  ↓
return home
  ↓
PC / internet / messages
  ↓
time + weather + mood + scenarios continue underneath
```

The goal is not content quantity.

The goal is to answer:

- does Away Message visually feel like a real game rather than a systems prototype?
- does the modular asset architecture survive production-quality art?
- does the residence progression feel materially visible?
- can one character presentation style work across puppet/world/avatar/profile surfaces?
- do lighting, weather, ambient motion and audio create convincing continuity?
- does the authored-place / simulated-town model feel coherent without free roaming?
- is the current art direction worth scaling?

---

## 2. What is already frozen

Do not reopen these foundations merely because art production begins.

### Runtime / ownership

- pure TypeScript simulation remains canonical;
- Phaser remains the active physical-world renderer;
- React remains the actual OS/software/web renderer;
- CharacterRenderer/Away Puppet remains the character presentation seam;
- Environment/Game Context remains the source for time/weather/Needs/Mood presentation;
- Residence/Tenancy remains canonical home authority;
- generated Place/Space/View/Anchor content remains the physical-world content contract;
- transit remains authoritative simulation infrastructure;
- Scenarios remain optional semantic framing over canonical simulation.

### Asset architecture

A Place/View continues to support:

```text
static architecture
structural fixtures
replaceable fixture slots
player-owned props/decor
temporary world objects
character layer
foreground / ambient layers
lighting / color overlays
time / weather variants
```

Stateful objects must remain separable when gameplay needs to swap/move/hide/recolor/transfer them.

A production-quality flattened painting does not override this law.

---

## 3. What is deliberately NOT frozen yet

The **final visual style** of the whole game is still not frozen.

Production Phase A should test a small number of strong visual treatments in the actual runtime before scaling content.

Acceptable exploration may include:
- painterly stylized realism;
- Western illustrated stylized realism;
- restrained low-resolution / raster hybrid;
- a controlled hybrid with realistic materials and slightly simplified forms.

Avoid:
- anime character language;
- hyper-photorealism that makes modular generation prohibitively expensive;
- art that only works as one flattened screenshot;
- a style whose consistency depends on hand-authoring every room from scratch.

The selected Phase A treatment becomes the **production baseline**, not an irreversible franchise-wide law.

---

## 4. Production method

Important spaces should use a repeatable production pipeline:

```text
simple 3D blockout / spatial reference
  ↓
lock architecture, dimensions and authored cameras
  ↓
render reference shots / masks / object IDs where useful
  ↓
Gen-AI generation and/or paint pass
  ↓
separate mutable/stateful layers
  ↓
author asset IDs, view mappings and anchors
  ↓
Phaser composition
  ↓
test time/weather/characters/interactions in runtime
```

The blockout is production reference only.

Do not convert the game to realtime 3D.

### Authored place, view, focus, and anchor decisions (binding for Phase A)

The canonical interaction topology is **Place → Space → authored View(s) → Focus / Anchor(s)**; see `docs/11-SPATIAL-PRESENCE-VENUES-AND-ACTOR-PRESENTATION.md` for the physical-world and spatial-ownership rules.

- A **Place** is the canonical physical destination; its **Space(s)** describe semantic/spatial sub-areas where necessary. Neither is a single background image.
- A **View** is an authored camera/composition of a Space. A Place/Space can have **one or multiple Views**. Multiple Views do **not** imply multiple independent game worlds or separate copies of canonical items/actors.
- A **Focus** changes framing/zoom/attention **within** an existing View when this is sufficient. A distinct View is appropriate when the camera direction, meaningful occlusion, readable surface, or interaction context truly needs another authored composition.
- An **Anchor / hotspot** is a semantic interaction or presentation placement in its authored View. **Multiple anchors in one View are normal**. The number of anchors does not determine the number of Views. Anchors emit requests/intents outward; Phaser never owns the resulting domain outcome.
- **View navigation** changes presentation and interaction visibility. It must not silently teleport the player/actors, change ownership, or create a second spatial truth. Real movement between Spaces/Places continues through their canonical systems.

Choose the **fewest Views that clearly express the actual place and gameplay**, not a universal one-view or multi-view template:

| Place/use case | Practical authored-view decision |
| --- | --- |
| Small, rarely visited, or visually simple place | One strong View with multiple Anchors/Focus targets can be sufficient. |
| Frequently visited residence, workplace, or service | Add a secondary View **when needed** to expose a distinct side/corner, interactions, characters, objects, or useful spatial relationship that focus alone cannot communicate. |
| Complex or hero place | Use multiple connected authored Views if they materially improve readability, atmosphere, or play. No fixed quota; avoid needless near-duplicate shots. |

The #167 layered starter-room spike intentionally proves **one** strong main View as a bounded runtime test. **It is not an architectural cap** on other rooms, residences, or public places. Likewise, more Views are never required merely to make an implementation look advanced. Production decisions should identify their actual Place/Space/View/Anchor mapping.

### Shared 3D reference → consistent 2D/AI-assisted production

Using a shared **3D model/blockout/space as an authoring reference is explicitly allowed and encouraged when it improves consistency**, especially for multi-view places. It is an optional production tool for simple one-view locations, **not a real-time 3D runtime requirement**.

1. Establish one coherent spatial/layout reference per Place/Space: architecture, room dimensions, permanent fixtures, meaningful object locations, and camera/view definitions. Record camera framing and scale/lens/perspective conventions where they matter.
2. Render reference images from the **authored cameras**, including depth/object-ID/mask passes where useful. Derive alternate viewpoints and lighting reference from the **same geometry**, rather than asking generative AI to invent unrelated versions of one location.
3. Use Gen-AI generation, inpainting, editing, and/or paint-over to produce the **final 2D/2.5D art**. Preserve the selected visual language across camera angles, time/weather variants, and named shared objects.
4. Separate static architecture from anything that can change: fixture swaps, player-owned props, inventory/parcel state, actors, curtains/foliage, window/outside/weather, lamps/lights, and foreground occluders **as gameplay requires**. A final full-frame reference render is not a license to flatten mutable layers.
5. Map each shared semantic object/fixture to **per-View presentation assets/placements** when needed. Different camera-angle images are representations of the **same canonical item**, not new identities or duplicate ownership. Author stable asset IDs, masks, anchors, and view relationships through the existing content pipeline.
6. Validate a representative multi-view place in the **real Phaser runtime**: recognizable shared geometry across views, appropriate hotspots, focus transitions, correct props/masks/light/weather, and no duplicate domain effects. A beautiful standalone render cannot substitute for this test.

These are scalable production constraints, **not a mandate to build a complex 3D asset pipeline before #159 can compare a few treatments**. Phase A locks a repeatable reference convention first; more elaborate tooling needs a measured production need.

---

## 5. Vertical-slice content

The first production slice should cover a deliberately small set of environments that exercise most presentation systems.

### A. Cheap starter residence

This is the deepest scene in the slice.

It must support:
- one strong main authored View for the first slice, with additional Views if spatial clarity, interaction legibility, or a meaningfully different camera composition benefits (this does not limit future residences to one View);
- cheap-room material identity;
- PC-capable desk/work surface;
- bed/sleep fixture;
- storage where authored;
- window/observation;
- door/travel;
- modular fixture/prop slots;
- player belongings/decor;
- time/weather/light response;
- no fake bathroom/kitchen if the selected cheapest room lacks those capabilities.

The residence is not a sacred room ID.

The art should be reusable through the generic Residence/Place runtime.

### B. Shared prop / furniture kit

Create a bounded reusable kit sufficient to prove visible progression:

- bed variants;
- desk;
- chair;
- rug;
- lamp;
- PC/monitor case variants;
- storage;
- parcel;
- small decor/clutter;
- at least one landlord-owned fixture variation;
- at least one player-owned movable item.

The kit must prove that changing a fixture or moving a belonging does not require a whole-room repaint.

### C. First production character kit

Build at least one real production-quality modular character presentation.

Target visual direction:
- Western / non-anime;
- stylized realism rather than photorealism;
- readable at world, portrait, avatar and profile-image scales;
- compatible with the Away Puppet / Inochi presentation path.

The kit should prove useful modularity such as:
- face/head base;
- hair;
- brows;
- eyes;
- mouth;
- clothing;
- skin/hair/eye color variation where supported;
- several expressions/poses required by current runtime.

Do not make the framework depend on this specific actor.

### D. One hero public place

Use one recurring public place to prove real production art outside the home.

Initial target may be the existing convenience store or café content, whichever provides the strongest bounded slice from live code/content.

It should prove:
- one excellent hero composition;
- real persistent object/stock state where applicable;
- character/cashier presence;
- focus views only where needed;
- authored signs/props with period coherence;
- environment/audio integration;
- no return to SaaS-like card menus for physical interaction.

### E. Street/window + transit set

Create enough production art to make the town feel connected:

- residence window/street view;
- one bus stop/street-corner composition;
- one reusable bus interior presentation;
- basic district/town visual identity where necessary for transition context.

This is not an open-world city art pass.

It is the minimum visual bridge needed to make leaving home and taking transit feel like travel through one town.

---

## 6. Atmosphere pass

The same small slice must demonstrate systemic atmosphere.

### Time

At least:
- morning;
- day;
- evening;
- night;
- late night.

Do not require five fully repainted scenes.

Use overlays, alternate windows, practical lights, emissive layers and ambient changes where cheaper.

### Weather

At least:
- clear;
- overcast/cloudy where current semantics use it;
- rain / heavy rain or storm representative state.

Where supported, show:
- window rain;
- wet surfaces;
- puddles/reflections;
- reduced visibility;
- weather-aware ambience.

### Ambient motion

Use small cheap motion before video:
- fan;
- curtain;
- sign/light flicker;
- distant traffic;
- pedestrians/silhouettes;
- steam;
- rain;
- reflections;
- bus-window movement.

### Audio

The slice should audibly demonstrate:
- residence ambience;
- weather ambience;
- public-place ambience;
- transit ambience;
- sensible spatial/listener behavior where supported;
- no duplicated/stuck ambience after navigation.

---

## 7. Style evaluation

Do not evaluate art treatment from isolated concept sheets alone.

At least one representative scene should be tested **inside the actual game runtime** with:
- UI around it;
- character layer;
- lighting;
- weather;
- hotspots/focus behavior;
- fixture swaps;
- window/street depth.

When useful, compare 2–3 tightly bounded treatments before selecting the Phase A production baseline.

The chosen direction should be judged by:
1. readability;
2. atmosphere;
3. modular behavior;
4. period coherence;
5. character/environment compatibility;
6. Gen-AI / solo-production repeatability;
7. consistency;
8. polish.

---

## 8. Period-authentic content requirement

The art must communicate approximately 2005-era life through design, not merely filters.

Use appropriate:
- CRT/LCD proportions;
- PC cases/peripherals;
- phones;
- MP3/CD/DVD media;
- webcams;
- furniture;
- clothing/hair;
- cars;
- store signage;
- packaging;
- transit signage/interiors;
- advertisements;
- web/OS imagery.

Avoid exact copyrighted branding where unnecessary.

---

## 9. Integration laws

Production art must consume existing content/runtime contracts rather than bypass them.

Do not:
- hardcode art asset paths in gameplay rules;
- special-case one residence renderer;
- special-case one character ID;
- bake player-owned/replaceable objects permanently into backgrounds;
- make Phaser invent Environment truth;
- make art placement become actor simulation truth;
- create a new quest/story system for the slice;
- create a new transit authority;
- restore fixed Room 104 assumptions.

If production art exposes a missing generic runtime capability, fix the generic capability in a bounded issue rather than hiding it in scene-specific code.

---

## 10. First-playable acceptance loop

A strong Phase A build should allow a short real play session approximately like:

```text
start in cheap residence
→ inspect/use room
→ set up / use PC
→ look through window
→ leave residence
→ travel to public place
→ interact with a persistent actor
→ shop/work/socialize as existing systems permit
→ use bus/transit
→ return home
→ continue PC/internet/social life
→ observe time/weather change
→ save/reload
```

Optional Scenario hooks may occur naturally but are not required for every run.

The player should be able to understand the game's identity from this loop without reading architecture docs.

---

## 11. Relationship to #140

Issue #140 remains the canonical local visual/audio/target-device acceptance gate for the living-world foundation.

Production Phase A should make that gate **meaningful** by replacing placeholder/provisional presentation with the first representative production slice.

The final Phase A playable gate should either:
- execute #140 as part of the same local test session; or
- record sufficient exact evidence for the user to close #140 immediately afterward.

Do not silently close #140 from CI.

---

## 12. What this phase does NOT require

Do not block Phase A on:

- final art for every district/place;
- full roster art;
- dozens of residences;
- complete website image replacement;
- final soundtrack;
- every furniture variant;
- final map art;
- all Scenario presentation UX;
- M5 adversarial hardening;
- content-complete Alpha/Beta;
- save-compatibility freeze.

This phase is a **quality and production-pipeline proof**, not content completion.

---

## 13. Exit condition

Production Phase A is complete when:

- the representative residence/public/transit loop uses real production-intent assets;
- modular/stateful objects visibly work without full-scene repainting;
- at least one modular character works through the real character renderer;
- time/weather/lighting/audio/ambient motion work coherently across the slice;
- the playable loop is locally usable and visually legible;
- the user can make an informed decision about scaling this art direction;
- #140 can be completed from real representative presentation rather than placeholders;
- no new duplicate simulation authority was introduced.

At that point the project transitions from **building the production pipeline** to **scaling content production**.

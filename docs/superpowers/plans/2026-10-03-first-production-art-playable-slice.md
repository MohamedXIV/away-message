# Production Phase A — First Production Art & Playable Slice Roadmap

Date: 2026-10-03

Canonical design: `docs/14-FIRST-PRODUCTION-ART-AND-PLAYABLE-SLICE.md`

This phase begins after the major living-world, Environment/Needs/Mood, and optional Scenario foundations are implemented.

## Goal

Create one real, representative, modular, atmospheric playable slice before expanding final art across the whole game.

## Dependency shape

```text
Art direction runtime treatment
        ↓
Shared prop/furniture production kit
        ↓
Starter residence production slice
        ├──────────────┐
        ↓              ↓
Production character  Hero public place
        └──────┬───────┘
               ↓
Street / bus stop / bus interior set
               ↓
Atmosphere integration: time/weather/light/audio/motion
               ↓
First Production Playable Gate
               ↓
#140 local living-world acceptance can close from representative art
               ↓
scale content production
```

Some art lanes may proceed in parallel once their asset contracts are stable.

## Slice principle

Do not produce the whole game.

Produce enough to test:

- one cheap dynamic residence;
- modular fixture/belonging swaps;
- one real modular character;
- one strong public place;
- one street/window composition;
- one bus stop;
- one reusable bus interior;
- representative time/weather/lighting/audio states.

## Art-direction lane

Compare no more than 2–3 serious treatments.

Judge them in runtime, not only as concept art.

Lock a **Phase A production baseline** once one treatment proves:
- readable;
- atmospheric;
- modular;
- period coherent;
- compatible with character art;
- realistically repeatable by a solo developer using Gen-AI + blockouts + paint/editing.

This baseline may still evolve later.

## Prop/furniture lane

Create reusable art contracts and representative assets for:
- bed variants;
- desk/chair;
- rug;
- lamp;
- PC/monitor;
- storage;
- parcel;
- small decor/clutter.

Prove view-specific mappings where necessary.

Do not permanently bake mutable objects into the room architecture.

## Residence lane

Use current Residence/Tenancy + Place/View contracts.

The cheapest/starting representative room should visually communicate economic constraints.

If the authored residence lacks private bathroom/kitchenette, do not add those visually merely because old prototypes had them.

## Character lane

Produce at least one Western/non-anime stylized-realism modular character through the real Away Puppet/CharacterRenderer seam.

Prove the same identity across useful media surfaces without forcing one universal image:
- world/puppet;
- dialogue;
- messenger avatar;
- profile/photo/webcam where applicable.

## Public-place lane

Choose one existing canonical hero place from live content.

Prefer the place that best exercises:
- persistent object state;
- actor presence;
- physical interactions;
- lighting/audio;
- period detail.

Do not create a new architectural one-off place engine.

## Street/transit lane

Produce only enough to connect the playable loop:
- window/street;
- bus stop/street corner;
- bus interior;
- transition context.

Do not expand into open-world traversal.

## Atmosphere lane

Integrate:
- five semantic day phases using efficient layers/overlays;
- representative clear/rain/heavy-rain states;
- ambient motion;
- environmental audio;
- spatial/listener behavior where supported.

Prove cleanup through navigation.

## Final playable gate

The gate should exercise:

```text
residence
→ PC
→ window/street
→ public place
→ persistent character
→ transit
→ home
→ time/weather change
→ save/reload
```

It should include:
- visual coherence;
- modular fixture swap/movable belonging;
- character identity continuity;
- no obvious duplicate render/audio layers;
- acceptable frame pacing on target browser;
- console sanity;
- #140 checklist where applicable.

## Issue/PR policy

- Keep art/content changes data-driven through current authoring contracts.
- One canonical issue/PR per coherent production lane.
- Asset files may be large; avoid duplicate generated variants in Git history.
- Store only selected/usable production assets and necessary references.
- Treat blockout/source/reference artifacts according to repository policy; do not commit enormous disposable generation intermediates.
- If a generic runtime gap is discovered, fix the generic seam in the same issue only when tightly coupled and bounded; otherwise open one focused blocker/support issue.
- Do not reopen completed systems merely to restructure for aesthetic preference.

## Verification

For code/content integration changes:
- content check where generated definitions change;
- TypeScript;
- build;
- baseline/full tests;
- focused presentation/runtime tests where practical.

For visual/audio acceptance:
- local browser evidence is legitimate and expected;
- never claim subjective visual/audio quality from headless CI alone.

## Exit

After this phase:
- do not immediately return to architecture expansion;
- scale successful production patterns into more residences, public places, characters, props, districts, website/media art and sound;
- use actual play feedback to decide which content/system gaps deserve future issues.

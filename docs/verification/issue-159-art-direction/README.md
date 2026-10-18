# Issue #159 — Runtime Art Direction & Production Reference Contract

Status: **review material, not a decision.** This lane produces real,
in-runtime art-direction comparisons for the Phase A starter room. The
direction is selected by the human owner; nothing here claims #159 is
accepted, and no direction is frozen.

Stacked on PR #198 (`feat/167-layered-room-spike-qwen`): the treatment
system layers on the #167 layered-room pipeline and reuses it unchanged —
same View/Anchor/prop content, same masks, ropes, weather, swap groups,
focus cameras.

## Evidence tiers (read this first)

| Tier | Claim | Evidence |
| --- | --- | --- |
| Implemented | treatment resolution, preload, signature routing, QA gating | code below, unit tests |
| Locally green | content:check, tsc, build, vitest, focused Playwright | run logs in PR body |
| Browser-verified | runtime texture swap at identical framing, 5 states × 3 treatments | `tests/e2e/tier1_features/14_ArtDirectionTreatments.spec.ts` + `compare/` sheets |
| **Quota-limited** | Gen-AI batch completed the `sr` set + one `gn` layer | see "Honest production status" |

## Honest production status (Gen-AI quota)

ImageGen was available and produced real stylized-realism art, but the batch
hit a hard quota ceiling (HTTP 403) partway through the second treatment.
Final state:

- **`sr` (Western Stylized Realism)** — 9 layers are **real generated art**
  processed through the pipeline: architecture plate (+ derived normal map),
  exterior, both foliage trees, curtain, window glass, desk, CRT/PC, lamp.
  The desk plate arrived with the CRT composited into it, so it was split
  into two layers to preserve the authored PC swap slot. Remaining layers
  (beds, chair, dresser, rug, parcel, AC, door, glow) fall back to the
  blockout per-layer — visible in the captures, never hidden.
- **`gn` (Painterly Western Graphic Novel)** — 1 layer of **real generated
  art** (bed A, generated before the wall went up) plus 9 **deterministic
  paint-over drafts** (`tools/art/paintover.py`) of the `sr` layers. Drafts
  prove the direction's palette/contrast/line behavior at identical framing;
  they are **not** finished Gen-AI art. The QA bar labels the treatment
  "Graphic Novel \*", the runtime registry carries `draftNote`, and content
  rows for draft layers carry the `draft-paintover` tag. No blockout or CSS
  filter is ever presented as production art.
- **Raster hybrid (optional third)** — not attempted; budget went to
  completing two directions honestly.

After quota reset, `tools/art/layers.json` and `tools/art/treatments.json`
record the prompt and layer-processing recipes for the remaining art.
The **processing and alignment are repeatable**, but ImageGen may produce
different source imagery from the same prompt; original Gen-AI pixels are
**not guaranteed reproducible**. The runtime does not need changes to
accept newly authored layers.

## The camera / reference contract

Canonical production method (docs/14 §4), adapted for a solo developer:

```text
shared spatial reference   = the #167 SVG blockout layers (sanctioned
                             alternative to a 3D blockout; identical role)
authored cameras           = fixed 1600×900 frame, normalized prop geometry
reference renders / masks  = blockout intrinsic frames + canonical openings
Gen-AI pass                = per-layer prompt on a magenta #FF00FF key
layered 2D assets          = mat.py: unmix → clean → trim → frame-fit
Phaser                     = unchanged generic layered runtime
```

Hard rules the tooling enforces mechanically:

1. **A treatment may never move geometry.** `mat.py` reads the blockout's
   intrinsic frame and fits the keyed art into it, so the authored
   normalized x/y/width/height keep their exact meaning across treatments.
2. **Openings are canonical.** `tools/art/treatments.json` declares the
   window `(284,154,432×376)` and door `(1438,98,146×442)` rects plus the
   fixed casing rects. `ArtCameraContract.test.ts` checks these against the
   authored scene-prop/anchor geometry. The window matches within rounding;
   the existing door panel sits about 10px below the cutout (bounded in the
   test, not represented as a perfect match until visual alignment). `tools/art/architecture.py` cover-fits a generated
   wall plate, warps its detected floor line onto the blockout's contract
   line (y=670), punches the openings, and draws the treatment-colored
   casing — a generated plate can change paint but cannot drift the holes
   every mask, glass pane, curtain pin and streak emitter resolves against.
3. **Normals follow the paint.** The runtime lights the view background from
   its linked normal map, so each treatment's architecture bakes its own
   (`bake_normal`, Sobel from its own diffuse) instead of inheriting the
   blockout's.
4. **Chroma discipline.** Generated props sit on magenta; `mat.py` measures
   the actual background cast (`unmix`) rather than a distance guess, so
   semi-transparent detail (foliage) keys without purple fringe, and
   genuinely rose-colored art is protected by `--spill-margin`.

## Layer inventory & asset-ID convention

```text
base id (blockout)        spike_desk                 content row, production
treatment variant         spike_desk_sr / _gn        content row, production
draft variant (gn only)   tags += draft-paintover    honest label, still gated
normal variant            spike_architecture_sr_n    linked via normalMapAssetId
files                     public/assets/world/starter-spike/{sr,gn}/<id>.png
```

Resolution lives in exactly one module,
`src/world/phaser/layeredRoom/artTreatments.ts`:

- `resolveTreatmentAssetId(base, treatment)` returns the variant **only** if
  the generated catalog carries it as a production-tagged image; otherwise
  the base row (per-layer fallback, never another treatment's art).
- The treatment is **presentation-only**: prop ids, anchors, geometry,
  intents, zones are untouched (unit + e2e both pin this).
- The structure signature now includes `backgroundAssetId`, so a treatment
  switch routes through the rebuild path; `preloadAssetIds` on the
  projection makes every authored treatment load up front, so switching in
  the QA bar is hitch-free. The generic load plan still gates every preload
  id through the production tag.

## Views, anchors, and the secondary camera reference

One representative starter room, **one authored hero View** — justified, not
accidental: the room is small, the hero camera composes all seven semantic
anchors (bed, desk, PC, window, storage, parcel, door), and every state the
game needs (day/evening/night, clear/rain, swaps, focus) is a presentation
dimension inside that View, not a separate view. #167's single view is not a
global limit: the content schema already supports multiple `views` per space
with per-view anchors/props, and the treatment convention scales per view
because it keys off authored asset ids, not view ids.

The **secondary camera reference** is demonstrated rather than merely
documented: the focus system (`focus: desk|window`, zoom 1.35 through the
authored anchor) is a second authored framing of the same spatial reference,
captured in `compare-focus-desk.png` across all three treatments. A future
second full View (e.g. a door-side reverse angle) would add one architecture
variant set + one anchor mapping per treatment — no runtime change.

Shared semantic identity across representations: blockout, `sr` and `gn` all
resolve the same `spike_prop_*` ids, the same `spike_anchor_*` ids and the
same outward intents (`work`, `sleep`, `observe_window`, …). There is no
per-view simulation state anywhere in the treatment path.

## Modularity proof (runtime, not concept sheet)

All #167 capabilities survive a treatment switch, asserted in spec 14:
independent bed A/B swap (gn paints only variant A, proving per-layer
fallback inside a swap group), movable desk, wind-driven curtain rope,
swaying foliage, window-masked glass with weather streaks, day/night phases,
lamp practical + additive glow, AC vibration, door panel, parcel. Nothing
gameplay-mutable is baked into the architecture plate — the generated wall
contains no furniture, no window, no door (prompt-enforced, opening-punch
verified).

## How to look at it

For the offline compositing/compare tools, use **Python 3.12** and install
pinned dependencies in a clean environment first:

```bash
python3 -m pip install -r tools/art/requirements.txt
```

This installs NumPy, SciPy, Pillow and CairoSVG. The source images from the
ImageGen pass are separate inputs; these tools reproduce the matte, camera
reference, compositing and comparison steps, not the original generated
pixels. The geometry contract also has a Python-free Vitest guard:
`tests/unit/ArtCameraContract.test.ts`.

```bash
npm run content:pull && npm run content:check
npx vite --host 127.0.0.1 --port 5199
# open http://127.0.0.1:5199/?fixture=room   (DEV-gated QA harness)
# ART buttons: Blockout | Stylized Realism | Graphic Novel * (draft)
# or deep-link: ?fixture=room&treatment=sr
npx playwright test tests/e2e/tier1_features/14_ArtDirectionTreatments.spec.ts
python3 tools/art/compare.py    # rebuilds compare/*.png from captures
```

Gating: the harness only mounts under `import.meta.env.DEV` with
`?fixture=room` (inherited from #167); treatment art lives behind
production-tagged content rows referenced only by the spike view; the QA
fixture isolation suite (PR #198) keeps the spike place out of player
catalogs.

## Tradeoffs, as visible in the runtime (no verdict)

**Blockout (baseline)** — perfect readability of the layer structure; zero
atmosphere; obviously a spatial reference, not a look.

**Stylized Realism (`sr`)** — the generated wall/exterior bring believable
2005 materiality (plaster wear, laminate, courtyard haze) and the room reads
as a place; mixed with unpainted blockout props it currently reads as two
unfinished layers side by side; period coherence ultimately depends on the
remaining prop passes (beds, chair, rug) landing at the bar the desk/CRT set
shows.

**Graphic Novel (`gn`)** — strongest atmosphere per generated pixel (the one
real generated bed dominates its frame), and the draft pass shows the
direction's palette/line logic holds the room together even on ungenerated
layers; but drafts flatten material detail (posterize + ink edges lose
laminate/fabric specificity), the vignette interacts with the runtime's own
night grade, and the direction's repeatability across 40+ rooms is unproven
without a real generated set.

Solo repeatability note: `sr` needed per-layer prompt tuning (the desk plate
came back with the CRT fused in); `gn` drafts are one command per layer from
the `sr` set. Neither is currently a "one prompt, any prop" pipeline.

## What this lane does NOT claim

- It does not select or freeze the Phase A direction. That is the owner's
  gate, and the two directions above both have visible gaps by design.
- It does not claim #159 acceptance from green tests.
- The `gn` treatment is a labeled draft; a selection made on it should be
  re-verified against a real generated `gn` set once quota returns.

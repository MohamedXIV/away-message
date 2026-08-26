# Manus Run Constraints

> Provider-specific execution notes only.
>
> This file is **not** part of the engine-agnostic game design, narrative, art-direction, or technical source of truth.
> The general game docs must remain usable by Manus, Gemini, Codex, a human developer, or any other implementation workflow.

## Purpose

Use this file only when running the evaluation build through Manus.

The goal is to spend Manus-specific generation capacity on assets that most improve our ability to judge the **feel of the complete game**, while keeping the implementation architecture independent of any one provider.

## Current Manus Generation Limits

- **Images:** maximum 20 generated images per day.
- **Video:** maximum 1 generated video per day.

Treat these as hard daily production budgets.

Do not waste generation quota on assets that can be represented adequately with CSS, simple shapes, procedural effects, placeholders, text, or reused layers.

## Gemini Comparison Note

For the later Gemini implementation/evaluation run:

- Image generation is effectively **unlimited for our intended workflow**.
- Video generation is limited, but available and useful.

Therefore the two runs should share the **same game specification and acceptance criteria**, while provider-specific generation strategy stays outside the core docs.

Do not weaken the general game specification just because Manus has stricter media limits.

## Manus Image Budget Strategy

Prioritize the 20 daily images approximately in this order:

1. **New physical locations required to make the game playable end-to-end**
   - motel / room views
   - workplace
   - café
   - shop
   - street / bus stop
   - other required story locations

2. **Major time-of-day variants when they materially change atmosphere**
   - day
   - evening
   - night

3. **High-value environmental layers**
   - background
   - midground
   - foreground
   - window/street view
   - major replaceable props

4. **Important diegetic internet content**
   - product photos
   - classified listing photos
   - website banners
   - period-appropriate photos or media that cannot be convincingly represented with CSS alone

5. **Temporary character representations only when required for evaluation**
   - avatar
   - placeholder portrait
   - profile/webcam photo

Character images produced during this run are **evaluation assets, not final character art direction**.

## What Should Usually NOT Consume an Image Generation Slot

Prefer implementation instead of generation for:

- operating-system windows
- browser chrome
- messenger UI
- installers
- buttons
- dialogs
- progress bars
- file manager
- terminal
- menus
- toolbars
- simple icons that can be drawn/reused
- text-heavy websites
- gradients
- lighting overlays that can be done with CSS/Phaser
- rain, dust, steam, flicker, simple traffic, and other procedural ambient effects
- minor variants that can be created by compositing existing layers

## Asset Reuse and Modularity

A generated scene should be treated as raw material for a modular location whenever practical.

Prefer:

- base background
- separate foreground
- separate interactive props
- reusable light/color overlays
- animated ambient layers
- time-of-day overlays or variants

Avoid making every state of a location a completely new flattened image.

The evaluation build may use flattened images when necessary for speed, but gameplay code must not depend on a specific flattened composition.

## Video Budget Strategy

Only one generated video is available per day.

Reserve it for something that answers a question a still image cannot answer well.

Good candidates:

- an important ambient animation reference
- a location motion study
- a character-motion concept
- a short atmospheric sequence
- a visual proof for a transition or special event

Do **not** spend the daily video on decorative filler.

If the same result can be produced with:
- sprite movement,
- parallax,
- opacity,
- looping layers,
- particles,
- tweening,
- or a few still-image states,

use those instead.

## Daily Media Planning Rule

Before generating media for the day:

1. List every desired image/video.
2. Rank each item as:
   - Critical to playable evaluation
   - High-value atmosphere
   - Nice to have
3. Spend quota on Critical items first.
4. Keep several image slots uncommitted until late in the working session for missing assets or failed generations.
5. Reuse, crop, layer, recolor, or procedurally animate existing assets before requesting another generation.

## Failure / Retry Rule

A failed or mediocre generation still consumes scarce production time and potentially quota.

Do not repeatedly regenerate an asset for polish during the evaluation build.

If an image is:
- readable,
- coherent,
- period-compatible enough,
- and sufficient to judge gameplay,

accept it temporarily and continue.

Final art direction is intentionally deferred.

## Comparison Fairness

When comparing Manus and Gemini later, compare them primarily on:

- complete-game feel
- gameplay/system completeness
- coherence
- reliability
- architecture
- iteration speed
- content quality
- visual coherence
- amount of manual correction required

Do not judge Manus negatively merely because Gemini can generate more images.

Media quotas are provider constraints, not game-design constraints.

## Core Rule

**The game docs define what the game should be.  
This file defines how to spend Manus-specific resources while building the evaluation version.**

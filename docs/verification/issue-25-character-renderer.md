# Issue #25 — Character Renderer / Away Puppet Verification

Status: PR #116 working evidence. This file records what is actually proven and what still requires execution before #25 can close.

## Acceptance architecture

The game-facing boundary is renderer-neutral:

```text
simulation/content
  -> CharacterVisualState / CharacterRenderer
  -> AwayPuppetCharacterRenderer
  -> Away semantic puppet session
  -> CharacterMeshFrame
  -> PhaserCharacterSurface
  -> Phaser 4.2 Mesh2D
```

Simulation/content does not receive Inochi pointers, raw `in_*` symbols, Phaser `Mesh2D` instances, or character-specific asset ids.

## Real pinned Inochi evidence inherited from #34

Pinned upstream source:

- `Inochi2D/inochi2d@ec702261dd6428141bfd0b174a015f8af872d3ed`

A historical Hookset run still has retained logs even though its downloadable artifact has expired:

- workflow run: `34763479831`
- job: `103740242328`
- candidate WASM SHA-256: `1465e682bce80ca69349f30f9d5df849817e1fa7dbd7c906dc648da7ebe410d2`
- Ada fixture: upstream `examples/ada-static.inx`
- Ada SHA-256: `8821f5d8de9f225cbafa3d496de93633d77c84dd95e6bc702a3d23739e238f93`
- Ada bytes: `7,123,901`

That run executed real `update -> draw -> draw-list` and reported:

- `useBaseVertex = 1`
- `commandCount = 1`
- `commandBytes = 128`
- `vertexBytes = 64`
- `indexBytes = 24`
- `allocationCount = 1`
- `renderableAllocationCount = 1`

The same run also performed a real Part texture replacement on Ada and verified readback plus restore:

- node: `ada-chan.png`
- attachment: `1`
- replacement texture index: `0`
- assignment readback matched
- restore readback matched

This is real Inochi/WASM evidence. It is not a browser screenshot and is not counted as the #25 browser/performance result by itself.

## PR #116 render bridge

The current branch converts only the pinned WASM32 renderer ABI required by Away:

- `in_drawcmd_t` command copies;
- XY/UV vertex tuples;
- uint32 index data;
- draw-list allocations;
- texture dimensions/channels/pixels copied into JS-owned RGBA;
- Part multiply tint / opacity;
- supported blend modes.

Raw pointers never leave `src/tooling/away-puppet`.

The bridge fails closed rather than silently degrading when it sees:

- mask/composite draw states;
- unknown normal draw types;
- unsupported blend modes;
- non-base-vertex draw lists;
- missing textures or out-of-range geometry.

Texture pixels are copied once per runtime texture identity and cached. Per-frame geometry remains detached JS data.

## Part/tint mutation extensions

The Away Hookset candidate already has a proven Part texture get/set extension.

PR #116 additionally defines Part multiply-tint get/set primitives and routes semantic tint channels through them. Runtime tint mutation performs set -> readback validation when the getter is present.

A real-Ada tint probe is now part of the Hookset workflow, but the current GitHub Actions infrastructure is not executing jobs, so no real-Ada tint result is claimed yet.

## Modular compatibility rig

#25 explicitly permits a small compatibility runtime when required. The technical fixture therefore uses one generic test profile, never a canonical NPC asset, and exercises the exact production `CharacterRenderer` semantic contract.

In technical-fixture mode, absence of an externally supplied `characters` roster intentionally lets the Scene own this default group; an explicit empty roster still clears characters. This distinction prevents the React/runtime synchronization path from erasing the fixture immediately after boot.

The representative group contains three actors reusing one profile while varying:

- body mass/frame and face roundness;
- eyes, brows and mouth;
- two hairstyles;
- top and outerwear choice;
- skin, hair, iris, clothing and outerwear tint;
- expression;
- blink;
- breathing idle;
- hair secondary motion;
- cloth secondary motion.

The fixture emits renderer-neutral mesh frames and the Phaser surface constructs real Phaser 4.2 `Mesh2D` children from them.

## Browser/performance acceptance

The reproducible browser gate is:

```bash
npx playwright test tests/e2e/tier1_features/11_AwayPuppetRenderer.spec.ts --project=chromium
```

It requires:

- one Phaser canvas;
- three live Away Puppet surfaces;
- real Mesh2D children (at least 30 for the representative group);
- non-zero runtime samples/FPS;
- logged average/max character update cost;
- stable surface identities across View A1 -> A2 -> A1;
- authored-anchor visibility: 3 visible surfaces in A1, 0 in anchorless A2, then the same 3 surfaces visible again in A1.

The test logs one line beginning with:

```text
[away-puppet-performance]
```

No FPS/update number is recorded in this document until that test actually runs.

## Current infrastructure status

Do not treat these as code-test failures:

- GitHub Verify on recent #116 heads creates a job with no steps and fails before repository commands execute.
- Hookset run `36487776989` on #116 completed with zero jobs.
- Vercel deployment `dpl_B1zRUPo28FoNw3tEFVdUNuC36Kcu` is `BLOCKED` before build.

Older Hookset logs demonstrate that the same workflow lane previously ran real compiler/runtime probes successfully; the current no-job/no-step state is infrastructure evidence only.

## Remaining close gate

Before marking PR #116 Ready / closing #25:

1. focused type/unit/browser verification must pass on the final implementation head;
2. record the actual `[away-puppet-performance]` result and browser outcome;
3. run the repository-required content/typecheck/build/full-test/baseline gate once on the review-ready head;
4. inspect the final diff/reviews and merge only if all #25 acceptance criteria remain satisfied.

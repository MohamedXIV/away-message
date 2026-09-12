# Away Puppet — Inochi2D Web/Authoring API Gap Inventory

Status: evidence snapshot for Issue #34. This document is intentionally an inventory, not an editor implementation plan.

Upstream baseline inspected: `Inochi2D/inochi2d` main at `ec702261dd6428141bfd0b174a015f8af872d3ed` (2026-08-01).

## Scope and classification

The goal is to identify what an eventual AI-assisted Away Character Studio can do through the current Web/TypeScript/WASM surface without binding model-facing tools to raw pointers.

Classifications used below:

- **Web/TS exposed** — usable from the current `web/inochi2d-ts` wrapper.
- **Core/WASM present, wrapper incomplete** — underlying runtime export is visible but the high-level TypeScript wrapper is missing or incomplete.
- **Creator/native authoring path** — authoring exists in the Inochi ecosystem, but no supported high-level Web/TS authoring API was found in the inspected surface.
- **Not proven** — do not build an Away contract around this until a concrete upstream API is verified.

This inventory is deliberately conservative. Absence from the inspected Web wrapper is not treated as proof that an operation can never be added upstream.

## Runtime surface already usable

The current high-level TypeScript wrapper intends to provide the runtime primitives needed by the Away semantic adapter direction:

- load a puppet from bytes through `new Puppet(ArrayBufferLike)`;
- inspect puppet name/author and enumerate parameters;
- inspect a root node and recursively enumerate children;
- read parameter name/dimensions/bounds/current value;
- set parameter values;
- read/set node enabled state and generic numeric properties;
- create a generic node and reparent nodes;
- configure top-level puppet physics enablement, gravity, and pixels-per-meter;
- update/draw a puppet;
- free the puppet;
- inspect texture-cache/resource metadata through the lower-level wrapper surface.

Away should continue hiding all raw IDs behind semantic rig metadata even where the upstream wrapper exposes them.

## Verified upstream Web/WASM load blocker

The real-puppet gate was re-checked against artifacts produced from the exact pinned commit, not against a fake adapter.

Evidence used:

- upstream commit: `ec702261dd6428141bfd0b174a015f8af872d3ed`;
- nightly run `34665426390` from that exact head;
- release WASM artifact `inochi2d-wasm-release`, artifact id `10289440605`, `inochi2d.wasm` SHA-256 `49dd528af9e58341513f363ca5b0639da80a20f1c6f1a95f47c0c67da788dd0a`;
- debug WASM artifact `inochi2d-wasm-debug`, artifact id `10288529795`;
- upstream real model `examples/ada-static.inx` from the matching Linux artifact, size `7,123,901` bytes, SHA-256 `8821f5d8de9f225cbafa3d496de93633d77c84dd95e6bc702a3d23739e238f93`.

Two independent blockers are present in the inspected Web path:

1. **High-level wrapper initialization order is broken at the pinned source.** `core.ts` evaluates `scratchpad: { size: 0, ptr: scrptr(128) }` while constructing the assignment to `__inochi2d`, but `scrptr()` immediately reads `__inochi2d.scratchpad`. Because the right-hand object is evaluated before `__inochi2d` receives it, the published high-level `in_init()` path cannot safely establish its first scratchpad from a fresh module instance as written.
2. **The matching raw WASM allocator cannot accept the real Ada fixture in the tested Node/WASI path.** After `in_init()`, `nu_malloc(7_123_901)` returns `0` for both the release and debug artifacts. Manually growing exported WebAssembly memory is not a valid workaround: the subsequent load path traps inside `dlmalloc` with an out-of-bounds memory access. The allocator must own/understand heap growth; callers must not patch this by manipulating exported memory directly.

This means #34 must **not** claim that actual production-sized puppet bytes have passed the current upstream high-level Web wrapper. The issue explicitly allows the upstream capability gate to be considered clearly blocked when supported by concrete evidence; this is that evidence.

The appropriate next step is a small isolated Away/upstream Web adapter correction, not a fake fixture and not a model-facing raw-pointer API. The correction must establish allocator/scratchpad initialization and real model loading first, then re-run load → enumerate parameters/nodes → mutate at least two parameters → copied draw-data inspection → dispose/reload against a real model.

## Runtime blocker: draw-list bridge

The current TypeScript source imports the WASM draw-list accessors (`in_drawlist_get_commands`, vertex/index data, allocations, and base-vertex state), and the renderer documentation defines draw lists as the renderer-facing contract. However, the high-level Web wrapper is not yet a complete host-renderer bridge for those structures.

For #34 this means:

1. `Puppet.draw()` alone is not evidence that a browser host can consume all draw data.
2. Away must prove commands + vertex/index/allocation data against a real puppet before claiming Web renderer readiness.
3. If a small wrapper completion is required, keep it behind an Away adapter; do not expose pointer/allocator operations as model-facing MCP tools.

## Authoring operation matrix

| Operation | Current classification | Evidence / implication for Away |
| --- | --- | --- |
| Create parameter | Creator/native authoring path | No high-level parameter constructor/add-to-puppet API is exposed by the inspected Web/TS wrapper. Do not fake this by editing runtime arrays. |
| Delete parameter | Creator/native authoring path | No supported Web/TS deletion API was found. Requires an authoring bridge before Studio/MCP exposes it. |
| Read parameter metadata/value | Web/TS exposed | Name, active state, dimensions, bounds, and value are available after a working loader boundary exists. Safe to wrap semantically. |
| Set parameter value | Web/TS exposed | Runtime mutation is present in the wrapper surface and fits `AwayPuppet.setMorph` / expression / pose semantics once real loading is restored. |
| Create generic node | Web/TS exposed, limited | `Node` can construct a generic node. This is not yet proof that Away can create a fully authored Part/Composite/Deformer node with all required payloads. |
| Reparent node | Web/TS exposed | Parent getter/setter exists. Future authoring tools still need transaction/validation semantics around hierarchy edits. |
| Delete node | Not proven | No explicit supported high-level node removal/delete authoring operation was verified. Do not infer deletion from ref-count disposal. |
| Create/edit parameter binding | Creator/native authoring path | No high-level Web binding/key authoring API appears in the inspected wrapper. Required before AI rigging can author morph deformation. |
| Create/edit binding keyframe | Creator/native authoring path | Same blocker as bindings: runtime parameter setting is not equivalent to authoring binding keys. |
| Mesh topology / vertex editing | Creator/native authoring path | Current runtime wrapper exposes render resources, not a supported authoring mesh-edit API. Keep this out of normal MCP until bridged safely. |
| Automatic mesh generation | Creator-native tooling path | Treat as editor/tooling functionality; no supported Web/TS API was verified. |
| Texture inspection | Web/TS/lower-level runtime exposed | Texture cache/resource access exists for runtime inspection. |
| Texture import / replacement | Creator/native authoring path | Runtime texture access is not evidence of a safe authoring import/replace transaction. A future bridge needs ownership/lifetime rules. |
| Physics enable/gravity/scale | Web/TS exposed | Puppet-level runtime controls exist. |
| Detailed physics rig configuration | Creator/native authoring path / not proven in Web | No high-level Web authoring surface for building physics rigs was verified. |
| Save/export INP/INX | Creator/native authoring path | The inspected Web/TS API loads from memory but exposes no high-level save/export operation. This is a hard requirement for a browser Character Studio. |
| Undo/redo | Creator-only concern today | No transaction history exists in the runtime wrapper. Away should own an editor transaction layer rather than expose one-operation-at-a-time destructive MCP writes. |
| Atomic authoring transaction | Not proven | Must be designed on the Away side or mapped to a future upstream authoring transaction API before model-driven writes are enabled. |

## What the first Away authoring bridge should expose

Do not mirror the entire native API. The minimum useful editor-facing boundary should be semantic and transactional:

```text
puppet.open
puppet.inspect
puppet.validate

rig.transaction.begin
rig.transaction.commit
rig.transaction.rollback

rig.parameter.create / remove
rig.node.create / reparent / remove
rig.binding.create / set_key / remove
rig.mesh.replace_or_edit
rig.texture.import_or_replace
rig.physics.configure
rig.save
```

Normal model-facing MCP should operate on stable handles/names and semantic roles. Raw WASM pointers, allocator functions, resource addresses, and direct memory writes remain outside the normal namespace.

## Recommended implementation order after #34 runtime proof

1. Repair/isolate the Web loader initialization/allocator boundary, then repeat real load → enumerate → mutate → draw-data → dispose/reload proof.
2. Wire `puppet.open`, `puppet.inspect`, `puppet.validate`, parameter/node inspection tools over that real adapter.
3. Prove save/export before investing in destructive browser authoring. Without save/export, editor mutations are not a viable production workflow.
4. Add a transaction layer before create/delete/reparent/binding/mesh MCP mutations.
5. Bridge parameter + binding authoring first; it unlocks useful facial/body rig automation with much smaller blast radius than arbitrary mesh editing.
6. Add texture/mesh and detailed physics authoring only after deterministic rollback/validation tests exist.

## Explicit non-decisions

- This does **not** justify an INP/INX format fork.
- This does **not** require shipping Inochi Creator inside Away Message.
- This does **not** make raw allocator/pointer calls acceptable MCP operations.
- This does **not** claim browser rendering is complete; draw-list host consumption still needs the real-puppet proof after the loader blocker is corrected.
- This does **not** claim every missing Web API is absent from the D core; it records only what is safe to depend on from the inspected Web-facing surface.

The architectural default remains: extend/wrap upstream behavior, keep standard puppet compatibility, store Away semantics in namespaced metadata, and make the shipped game depend only on the Away Puppet semantic runtime contract.
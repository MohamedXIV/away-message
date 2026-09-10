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

The current high-level TypeScript wrapper provides enough runtime primitives to justify the Away semantic adapter direction:

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
| Read parameter metadata/value | Web/TS exposed | Name, active state, dimensions, bounds, and value are available. Safe to wrap semantically. |
| Set parameter value | Web/TS exposed | Runtime mutation is available and already fits `AwayPuppet.setMorph` / expression / pose semantics. |
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

1. Finish real Web/WASM load → enumerate → mutate → draw-data → dispose/reload proof.
2. Add `puppet.open`, `puppet.inspect`, `puppet.validate`, parameter/node inspection tools over that real adapter.
3. Prove save/export before investing in destructive browser authoring. Without save/export, editor mutations are not a viable production workflow.
4. Add a transaction layer before create/delete/reparent/binding/mesh MCP mutations.
5. Bridge parameter + binding authoring first; it unlocks useful facial/body rig automation with much smaller blast radius than arbitrary mesh editing.
6. Add texture/mesh and detailed physics authoring only after deterministic rollback/validation tests exist.

## Explicit non-decisions

- This does **not** justify an INP/INX format fork.
- This does **not** require shipping Inochi Creator inside Away Message.
- This does **not** make raw allocator/pointer calls acceptable MCP operations.
- This does **not** claim browser rendering is complete; draw-list host consumption still needs the real-puppet proof.
- This does **not** claim every missing Web API is absent from the D core; it records only what is safe to depend on from the inspected Web-facing surface.

The architectural default remains: extend/wrap upstream behavior, keep standard puppet compatibility, store Away semantics in namespaced metadata, and make the shipped game depend only on the Away Puppet semantic runtime contract.
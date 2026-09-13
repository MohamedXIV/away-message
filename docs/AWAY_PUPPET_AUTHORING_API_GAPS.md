# Away Puppet — Inochi2D Web/Authoring API Gap Inventory

Status: evidence snapshot for Issue #34. This document is intentionally an inventory, not an editor implementation plan.

Upstream baseline inspected: `Inochi2D/inochi2d` at `ec702261dd6428141bfd0b174a015f8af872d3ed` (2026-08-01).

## Scope and classification

The goal is to identify what the Away Puppet tooling lane can safely depend on through the pinned Web/TypeScript/WASM surface without binding gameplay or model-facing tools to raw pointers.

Classifications used below:

- **Web/TS exposed** — usable from the current `web/inochi2d-ts` surface or the corrected Away bootstrap over the same exports.
- **Core/WASM present, wrapper incomplete** — underlying runtime export exists but the high-level TypeScript wrapper is missing/incomplete.
- **Creator/native authoring path** — authoring exists in the Inochi ecosystem, but no supported high-level Web/TS authoring API was found in the inspected surface.
- **Not proven** — do not build an Away contract around this until a concrete upstream API is verified.

This inventory is deliberately conservative. Absence from the inspected Web wrapper is not treated as proof that an operation can never be added upstream.

## Runtime surface now proven usable

The current branch has executable proof against a WASM build from the exact pinned Inochi2D commit with one build correction: link Numem's `hookset-wasm` subpackage in the WASM configuration.

The corrected path has now proven all of the following with actual upstream puppet bytes:

- corrected two-phase module bootstrap (`in_init()` followed by explicit scratchpad allocation);
- real puppet byte allocation and `in_puppet_load_from_memory`;
- puppet metadata, parameter inventory, root-node and recursive node-tree inventory;
- real `update → draw → in_puppet_get_drawlist` followed by copying commands, vertex data, index data and allocation metadata into JS-owned data;
- deterministic dispose/reload with inventory equality across independent reloads;
- production `puppet.open` composition through the corrected low-level WASM module → `InochiWebLifecycle` → Away semantic MCP service.

The real Ada proof uses upstream `examples/ada-static.inx` from the pinned Inochi2D source, size `7,123,901` bytes, SHA-256 `8821f5d8de9f225cbafa3d496de93633d77c84dd95e6bc702a3d23739e238f93`.

Raw allocator, pointer, and `in_*` operations remain inside the tooling/runtime adapter boundary. They are not normal MCP tools and are not available to Away gameplay/simulation callers.

## Proven Web/WASM build corrections

### High-level wrapper initialization order

At the pinned upstream source, the high-level wrapper constructs `scratchpad: { size: 0, ptr: scrptr(128) }` while assigning `__inochi2d`, but `scrptr()` immediately reads `__inochi2d.scratchpad`. The Away bridge therefore uses a corrected two-phase bootstrap rather than copying that initialization order.

### Numem allocator hookset

The published pinned WASM artifact could initialize but its allocator returned `0` when asked to allocate even upstream's tiny `examples/empty08.inx` payload. Host-side `memory.grow()` was also proven invalid as a workaround because it does not make Numem's allocator own the newly visible memory and can lead to allocator traps.

The pinned Inochi2D dependency graph accepts `numem >=1.6.5`, and that Numem release contains `numem:hookset-wasm`. Rebuilding the exact pinned Inochi2D commit with that hookset linked changed the experiment from allocator failure to successful real puppet loads. The hypothesis is therefore no longer speculative: the hookset selection is a proven required correction for this WASM lane.

Away does **not** change the INP/INX format to solve this. The correction stays at the Web/WASM build/bootstrap boundary.

## Real parameter-mutation acceptance gap

The remaining parameter proof is deliberately fail-closed.

- `ada-static.inx` is a valid current upstream runtime fixture for load/tree/render/lifecycle proof, but exposes no parameters suitable for the required two-parameter mutation acceptance test.
- The official `Inochi2D/example-models` `Aka.inx` fixture exposes 34 parameters and a full node tree, but it is a legacy 0.7-era model. On the pinned 0.9 WASM path it goes through the legacy upgrade/deserialization path and returns corrupt parameter float state (zero bounds for some parameters and canonical NaNs for others).
- Raw pointer addresses and little-endian float decoding were separately inspected; the returned pointers are valid and the bad values already exist at the CFFI boundary. The probe therefore refuses to count Aka as mutation success.

The outstanding acceptance artifact is a **rigged current-format INP2 puppet with at least two readable/mutable parameters**. Once such real bytes are available, the existing probe already supports `--mutation-proof` / `--runtime-proof` and requires set → readback → restore for at least two parameters.

Do not weaken this by using fabricated parameter arrays or treating the legacy Aka upgrade failure as proof against current INP2 parameter mutation.

## Draw-list bridge — proven

The renderer proof is no longer an open blocker. The current branch calls the pinned CFFI draw-list accessors after a real Ada `update → draw`, then copies renderer-facing data into JS-owned structures through `InochiDrawListBridge`.

The gate requires non-empty commands, vertex bytes, index bytes, allocation metadata, and renderable geometry. A successful `Puppet.draw()` call by itself is not counted as renderer success.

## Deterministic lifecycle — proven

Lifecycle proof is independent of parameter mutation. The current real-WASM probe loads a puppet, inventories it, frees it, performs two independent reloads from the same real bytes, compares metadata/parameter/node inventory, and frees each reload. This is now part of the Hookset CI lane.

## Real slot-assignment blocker

`away.assign_slot` remains intentionally fail-closed on the real adapter.

The semantic contract is already correct: callers provide an Away slot name and asset id; metadata resolves the slot to its internal node id; raw Inochi ids never become model-facing arguments. The missing piece is the actual pinned runtime mutation operation.

Concrete pinned CFFI evidence:

- the texture-cache API exposes size/get/get-all/prune operations;
- the Part API exposes mesh lookup, blend mode, opacity, emission, and mesh-effect operations;
- there is no CFFI operation to import a replacement texture, set a Part texture slot, or atomically replace a Part's texture/resource binding;
- the high-level Web wrapper mirrors that limitation;
- the native D `Part` implementation owns texture references, so native/Creator code can author them, but that ownership is not exposed as a supported Web/CFFI replacement transaction.

Therefore the real adapter must **not** implement `away.assign_slot` as node visibility, direct pointer writes, or mutation of returned cache arrays. The smallest honest unblock is an upstream-compatible CFFI/Web extension that provides explicit resource ownership and Part texture/asset replacement semantics, then wraps that operation behind Away's existing semantic slot contract.

This is an API-surface blocker, not a reason to fork INP2.

## Authoring operation matrix

| Operation | Current classification | Evidence / implication for Away |
| --- | --- | --- |
| Load real puppet bytes | Web/WASM proven with Away bootstrap correction | Hookset candidate build + corrected bootstrap load real upstream bytes. |
| Read metadata / parameter inventory / node tree | Web/WASM proven | Keep raw ids internal to the adapter. |
| Set parameter value | Web/TS exposed; real current-INP2 mutation proof still pending | Existing probe requires finite bounds/value, readback, and restore on ≥2 parameters. |
| Read copied draw-list data | Web/WASM proven | Commands + vertex/index/allocation data are copied into JS-owned structures. |
| Dispose/reload | Web/WASM proven | Two independent real-byte reloads match inventory after disposal. |
| Create parameter | Creator/native authoring path | No high-level parameter constructor/add-to-puppet API is exposed by the inspected Web/TS wrapper. |
| Delete parameter | Creator/native authoring path | No supported Web/TS deletion API was found. |
| Create generic node | Web/TS exposed, limited | Generic node construction is not proof of fully authored Part/Composite/Deformer creation. |
| Reparent node | Web/TS exposed | Future authoring tools still need transaction/validation semantics. |
| Delete node | Not proven | Do not infer deletion from ref-count disposal. |
| Create/edit parameter binding | Creator/native authoring path | Runtime parameter setting is not equivalent to authoring binding keys. |
| Mesh topology / vertex editing | Creator/native authoring path | Keep arbitrary mesh editing out of normal MCP until safely bridged. |
| Texture inspection | Web/TS/lower-level runtime exposed | Texture cache/resource inspection exists. |
| Texture / Part replacement | Creator/native authoring path; pinned CFFI gap | Required real primitive for `away.assign_slot`; do not fake it with visibility or raw memory writes. |
| Physics enable/gravity/scale | Web/TS exposed | Puppet-level runtime controls exist. |
| Detailed physics rig configuration | Creator/native authoring path / not proven in Web | No high-level Web authoring surface was verified. |
| Save/export INP/INX | Creator/native authoring path | Current Web runtime loads bytes but exposes no high-level save/export operation. |
| Atomic authoring transaction | Not proven | Must exist before destructive model-driven authoring writes are enabled. |

## What a later Away authoring bridge should expose

Do not mirror the native API. Keep editor-facing operations semantic and transactional, for example:

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

## Explicit non-decisions

- This does **not** justify an INP/INX format fork.
- This does **not** require shipping Inochi Creator inside Away Message.
- This does **not** make raw allocator/pointer calls acceptable MCP operations.
- This does **not** treat legacy Aka parameter corruption as success or as a current-INP2 failure.
- This does **not** fake slot replacement with visibility or direct memory mutation.
- This does **not** claim every missing Web API is absent from the D core; it records only what is safe to depend on from the inspected Web-facing surface.

The architectural default remains: extend/wrap upstream behavior, keep standard puppet compatibility, store Away semantics in namespaced metadata, and make the shipped game depend only on the Away Puppet semantic runtime contract.

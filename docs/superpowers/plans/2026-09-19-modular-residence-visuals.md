# Issue #87 — Modular Residence Visuals / Fixture Slots

## Goal
Make residence visuals an authored projection of the existing generic physical graph. Residence ownership/tenancy chooses which authored Place is home; it does not create a residence-specific object, capability, or renderer authority.

## Architecture
- Reuse generated `objectPlacements`, `placementSlots`, and `physicalObjectDefs` as the semantic fixture graph.
- Reuse `PhysicalContextRuntime` for concrete runtime object instances and exact identities.
- Keep visual projection derived from authored view/object metadata. Phaser may render the projection but never owns placement, occupancy, or interaction truth.
- A property-owned fixture variant is a change to authored/runtime fixture presentation at an existing semantic placement. It must not change the residence Place identity or create a second location graph.
- Missing/unsupported fixture visual metadata fails closed to a neutral/absent projection; no fixed-room fallback.
- Generic tests and fixtures use synthetic IDs only.

## Delivery slices
1. **Pure fixture visual projection.** Add a renderer-neutral projection module that accepts a view id, authored object placements/slots, physical object definitions, and explicit visual-variant metadata. Return deterministic fixture render descriptors keyed by semantic object/placement identity. Tests prove ordering, view filtering, missing metadata behavior, and no residence/place identity mutation.
2. **Property-owned variant selection.** Map a semantic fixture/slot to an allowed authored visual variant. Preserve semantic placement and Place identity while changing only the selected visual asset/variant. Reject unknown fixture/variant pairs deterministically.
3. **Generic physical-context integration.** Bridge projected fixtures to `PhysicalContextRuntime` identities/capabilities rather than duplicating interaction logic. Tests prove the rendered fixture points at the same concrete physical object identity used for inspect/open/use actions.
4. **Phaser/view adapter.** Consume the pure projection from the existing authored-view presentation path. Phaser creates/updates/destroys visuals from descriptors only; it does not mutate occupancy, residence, or capability truth.
5. **Acceptance / regression gate.** Use a synthetic residence Place with multiple authored views and fixture slots. Prove a fixture variant can change without changing Place identity, authored view identity, physical object identity, or semantic interaction source. Run content check, typecheck, build, baseline guard/self-test, focused tests, full tests, and exact-head GitHub Verify before Ready/merge.

## Non-goals
No Room 104 special casing, no housing progression/economy (#88), no new residence capability bag, no renderer-owned placement state, no save migration for historical dev saves, and no redesign of generated content output.
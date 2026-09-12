# Room 104 Flagship Migration Plan

> Issue: #26
> Base: `main@ba9a9ad19df4d1b85f2a5ec85cce54b8aa6ef678`

## Goal

Move the active Room 104 physical presentation off the bespoke Canvas2D renderer and onto the generic Phaser 4 living-place stack from #19/#20, without recreating PC/OS, item, environment, audio, or inner-voice authority.

This branch owns Room 104 presentation/integration only. It must not overlap #34 Away Puppet or #47 Encounter Director.

## Architecture laws

- Pure simulation remains canonical.
- `PhysicalWorldHost` / `WorldScene` render projections and emit semantic intents only.
- Room 104 authored layout is data, not a bespoke Phaser scene class.
- Existing PC/OS lifecycle remains authoritative; room presentation only reflects it.
- Existing room actions keep their current SimulationEngine owners.
- View changes cannot mutate physical item identity/location or simulation state.
- Do not remove the legacy RoomCanvas implementation until the new active path is proven; leaving the file as a rollback artifact is acceptable for this slice.

## Slice 1 — RED: Room 104 authored contract

- [ ] Add focused tests proving `room_104` resolves through the generic projection layer.
- [ ] Require three main authored views: desk/window, bed/wardrobe, entrance/kitchenette.
- [ ] Require semantic hotspots for PC, window, bed, wardrobe/storage, kettle, door, and parcel/storage surfaces where relevant.
- [ ] Require deterministic authored neighbor navigation.

Expected RED: current generated/registered world content has only the `place_a1` fixture, so Room 104 has no available views/anchors.

## Slice 2 — Authored Room 104 data bridge

- [ ] Add a bounded Room 104 authored-content module consumed by the generic projection adapter.
- [ ] Keep the data separate from rendering behavior and expose the same shape as generated place/space/view/anchor/interaction definitions.
- [ ] Add Room 104 light/audio/environment metadata through existing generic contracts where useful.
- [ ] Do not add a `Room104PhaserScene` with custom drawing rules.

This bridge is intentionally presentation data. A later content-pipeline cleanup may move the same records into `content/store.json`; do not block the active-renderer migration on rewriting the global content store through this connector-only lane.

## Slice 3 — Active Room 104 host

- [ ] Add a Room 104 React integration component around `PhysicalWorldHost`.
- [ ] Drive time/weather from current simulation state.
- [ ] Drive desk/PC status from the existing PC/OS lifecycle.
- [ ] Translate semantic hotspots to the existing room actions/modals.
- [ ] Preserve three-view navigation locally as presentation state only.
- [ ] Keep React overlays contextual; do not reintroduce an action-card room UI.

## Slice 4 — Regression / parity checks

- [ ] View navigation does not mutate exported simulation/physical-world state.
- [ ] PC interaction preserves no-PC → package → assembled → desktop authority.
- [ ] Tea/window/bed/door actions still route to their existing owners.
- [ ] Phaser lifecycle tests remain green.
- [ ] Legacy RoomCanvas is no longer the active `activeView === 'room'` path.

## Verification

Run on exact branch head:

```text
npm run content:check
npx tsc --noEmit
npm run build
node scripts/verify-vitest-baseline.mjs --self-test
node scripts/verify-vitest-baseline.mjs
```

Baseline policy is zero failures.

## Completion policy

Open a Draft PR once the active Room 104 Phaser path and automated regressions are green. Do not close #26 until remaining container/item visual parity and manual dawn/day/afternoon/dusk/night + clear/rain smoke are genuinely proven.
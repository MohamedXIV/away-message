# Coherent Character Presence — implementation slice

Issue: #45

## Goal

Add one derived semantic presence projection over existing Away authorities without creating a new persisted presence ledger.

## Authority order

1. `NpcTrips.getNpcPlaceState()` owns current physical mobility/place truth.
2. `SocialEngine.getPresence()` remains the legacy messenger-presence input during migration.
3. `BuddyCharacter.reach` distinguishes local from remote actors when no local mobility/place fact exists.
4. Renderer/view state is never an input.

## First implementation slice

Add a pure `src/engine/life/Presence.ts` resolver and expose it through the SimulationEngine facade.

Rules:
- `at_place` preserves the authoritative place id.
- a pre-departure `planned` trip still means physically at its origin, with a `departure_planned` reason.
- `in_transit` is neither endpoint.
- a remote buddy with no local mobility truth projects `remote`.
- local actors with no physical fact project `unknown` rather than inventing a place.
- legacy `online` normally maps to `online_active`.
- active transit without an explicitly authored portable messaging device may not project `online_active`; degrade to `online_idle` while preserving the legacy login fact.
- legacy `away`, `busy`, and `offline` retain their visible semantics.
- calls and in-person interaction are impossible in transit in this 2005 baseline unless later authored device/context rules explicitly allow them.
- `canInteractInPerson` requires `at_place`; when caller supplies `playerPlaceId`, the place ids must match.
- no new presence projection is persisted.

## TDD

RED first through facade-level compatibility tests, then implement the minimum pure resolver and facade seam. Follow with save/reload and time-boundary regressions after the basic contract is green.

## Non-goals

No Pulse UI rewrite, no route planning, no new device inventory model, no smartphone/mobile internet assumptions, no renderer integration, no deletion of legacy SocialEngine presence state.

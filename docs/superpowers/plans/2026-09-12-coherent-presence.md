# Coherent Character Presence — implementation slice

Issue: #45

## Goal

Add one derived semantic presence projection over existing Away authorities without creating a new persisted presence ledger.

## Authority order

1. `BuddyCharacter.reach === 'remote'` prevents stale local mobility state from materializing a remote-only identity into the local world.
2. For local actors, `NpcTrips.getNpcPlaceState()` owns current physical mobility/place truth.
3. `SocialEngine.getPresence()` remains the legacy messenger-presence input during migration.
4. Explicit semantic device context can further constrain active communication without becoming a new persisted device authority.
5. Renderer/view state is never an input.

## Implementation slice

Use the pure `src/engine/life/Presence.ts` resolver plus a narrow read-only simulation-source adapter. The adapter consumes the existing SimulationEngine surface (`social` + `getNpcPlaceState`) without making presence a new engine-owned state bucket.

Rules:
- `at_place` preserves the authoritative place id for local actors.
- a pre-departure `planned` trip still means physically at its origin, with a `departure_planned` reason.
- `in_transit` is neither endpoint.
- remote reach projects `remote` even if stale local mobility data exists; a real visit transitions the same identity to local reach.
- local actors with no physical fact project `unknown` rather than inventing a place.
- legacy `online` normally maps to `online_active` while explicit device context is absent, preserving migration compatibility.
- explicit `messagingDeviceContext: 'none'` downgrades legacy online to `online_idle` with `no_active_device_context`.
- active transit without an explicitly authored portable messaging device may not project `online_active`; fixed PC/terminal contexts do not override transit.
- legacy `away`, `busy`, and `offline` retain their visible semantics.
- calls and in-person interaction are impossible in transit in this 2005 baseline unless later authored rules explicitly allow them.
- `canInteractInPerson` requires `at_place`, a known `playerPlaceId`, and exact place equality; unknown player place is not treated as co-location.
- no new presence projection is persisted.

## Legacy migration seam

Existing Pulse readers still understand `online | away | busy | offline`. Provide a loss-limited compatibility mapper while consumers migrate:

- `online_active` → `online`
- `online_idle` → `away`
- `away` → `away`
- `busy` → `busy`
- `offline` → `offline`

The mapper is read-only and never writes the derived result back into `SocialEngine`.

## TDD / review findings

The branch was developed through RED → GREEN slices covering the initial compatibility contract, save/reload and large-jump equivalence, lifecycle/remote/local transitions, transit/device behavior, and legacy Pulse compatibility. Final review added three focused correctness regressions before merge:

1. unknown player place may not imply in-person availability;
2. canonical remote reach overrides stale local place state;
3. explicit lack of a plausible messaging device may not remain `online_active`.

## Non-goals

No Pulse UI rewrite, no route planning, no new device inventory model, no smartphone/mobile internet assumptions, no renderer integration, no deletion of legacy SocialEngine presence state.

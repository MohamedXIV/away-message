# Coherent Character Presence contract

Status: implementation contract for #45.

Presence is a read model, not a new authority.

```text
NpcMobility / place truth ─┐
SocialEngine presence ─────┼─→ CharacterPresenceProjection
Buddy reach/lifecycle ─────┤
Device context ─────────────┘
```

The projection may answer physical location mode, communication status and interaction availability, but it must never rewrite the source systems merely by being queried.

## Physical semantics

- `at_place(placeId)` — actor is physically at one authoritative place.
- `in_transit(origin,destination,leg)` — actor is between places and is not simultaneously at either endpoint.
- `remote` — actor is a remote identity without local physical-world presence.
- `unknown` — local actor has no authoritative physical fact yet; never invent a place to avoid this state.

A `planned` #37 trip remains `at_place(origin)` until its actual departure boundary. `BuddyCharacter.reach === 'remote'` is authoritative over stale local mobility/place snapshots; a temporary local visit requires the same identity to transition to local reach rather than pretending a remote-only actor occupies a local place.

## Communication semantics

- `online_active`
- `online_idle`
- `away`
- `busy`
- `offline`

Existing SocialEngine `online/away/busy/offline` values remain migration input. `online_active` is only valid when current physical/device context does not contradict active use.

For the 2005 baseline, active transit has no implicit mobile internet/device. If an unattended logged-in PC would otherwise be `online`, the coherent projection becomes `online_idle`, not an impossible actively-used home PC. A legacy `away` session may remain `away` while its person is elsewhere.

Optional semantic device context can identify `home_pc`, `work_pc`, `public_terminal`, `portable`, or `none`. During migration, absence of explicit device context preserves current legacy online behavior unless stronger physical truth such as transit contradicts it. An explicit `none` cannot produce `online_active` and instead projects `online_idle` with `no_active_device_context`. Fixed-device contexts never make transit active; an explicitly authored portable device may permit `online_active` in transit. The older portable-device boolean remains a compatibility alias while callers migrate.

## Availability semantics

The projection exposes bounded capability booleans such as messaging, calls and in-person interaction. These are facts for consumers; the resolver does not perform communication or social consequences.

`canInteractInPerson` requires physical `at_place`, an explicitly known `playerPlaceId`, and exact place equality. If player place is unknown, the resolver returns false and explains it with `player_place_unknown`; physical presence alone must not become player knowledge or interaction availability. In the baseline, transit disables calls and in-person interaction; messaging may still be delivered asynchronously to an idle/away account.

## Persistence

No derived projection, reason code, or compatibility status is persisted. Save/reload reconstructs the same projection from canonical mobility/social/identity state. Large time jumps and incremental progression must produce equivalent final projection when the canonical source systems do.

## Migration

Legacy SocialEngine presence remains intact while downstream consumers migrate.

A compatibility projection may map the richer communication state back to the legacy Pulse shape without mutation:

```text
online_active → online
online_idle   → away
away          → away
busy          → busy
offline       → offline
```

This mapping intentionally does not write back into `SocialEngine`: otherwise a temporary transit projection would become a second canonical state and could survive after the actor arrives.

Initial #45 work therefore provides both the coherent resolver and a one-call legacy read adapter. It does not delete legacy presence state or rewrite Pulse wholesale.

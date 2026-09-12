# Coherent Character Presence contract

Status: implementation contract for #45.

Presence is a read model, not a new authority.

```text
NpcMobility / place truth ─┐
SocialEngine presence ─────┼─→ CharacterPresenceProjection
Buddy reach/lifecycle ─────┘
```

The projection may answer physical location mode, communication status and interaction availability, but it must never rewrite the source systems merely by being queried.

## Physical semantics

- `at_place(placeId)` — actor is physically at one authoritative place.
- `in_transit(origin,destination,leg)` — actor is between places and is not simultaneously at either endpoint.
- `remote` — actor is a remote identity without local physical-world presence.
- `unknown` — local actor has no authoritative physical fact yet; never invent a place to avoid this state.

A `planned` #37 trip remains `at_place(origin)` until its actual departure boundary.

## Communication semantics

- `online_active`
- `online_idle`
- `away`
- `busy`
- `offline`

Existing SocialEngine `online/away/busy/offline` values remain migration input. `online_active` is only valid when current physical/device context does not contradict active use.

For the 2005 baseline, active transit has no implicit mobile internet/device. If an unattended logged-in PC would otherwise be `online`, the coherent projection becomes `online_idle`, not an impossible actively-used home PC.

## Availability semantics

The projection exposes bounded capability booleans such as messaging, calls and in-person interaction. These are facts for consumers; the resolver does not perform communication or social consequences.

`canInteractInPerson` requires physical `at_place`, and if the caller provides a player place it also requires exact place equality.

## Persistence

No derived projection, reason code, or compatibility status is persisted. Save/reload reconstructs the same projection from canonical mobility/social/identity state.

## Migration

Legacy SocialEngine presence remains intact until downstream consumers have compatibility coverage. Initial #45 work adds the resolver/facade seam; it does not delete legacy state or rewrite Pulse wholesale.

# Optional Scenario / Story Thread Roadmap

Date: 2026-10-01

Canonical design: `docs/13-SCENARIOS-AND-STORY-THREADS.md`

This roadmap introduces optional semi-baked Scenario threads **after** the living-world architecture foundation. It does not reopen the fixed-cast/fixed-campaign direction.

## Product goal

Give each save optional personal context and unresolved threads while preserving open-ended sandbox play.

A Scenario is:

```text
authored situation
+ dynamic role binding
+ canonical domain state
+ optional hooks
```

It is not a mandatory quest route.

## Dependency shape

```text
Scenario Definition / Instance contracts
                ↓
deterministic role binding + pre-game initialization
                ↓
domain-safe observation / hooks / persistence
                ↓
first semi-baked scenario pack
                ↓
optional Scenario Projection API
                ↓
end-to-end gate
```

Player-facing quest/journal UX is intentionally not required for the first foundation.

## Phase A — contracts + content

Create:
- authored ScenarioDefinition schema;
- generated typed registry;
- ScenarioInstance save shape;
- semantic role constraints;
- scenario-local lifecycle/provenance rules.

Prove that scenario content lives in the existing Content UI/TinyBase pipeline.

## Phase B — dynamic role binding + initialization

Build deterministic binding of semantic Scenario roles to compatible actors.

Requirements:
- no sacred actor IDs;
- failure to bind is valid;
- bindings persist per save;
- role conflicts/exclusions deterministic;
- pre-game relationship/history initialized through SocialEngine;
- player knowledge initialized through canonical knowledge authority;
- Scenario stores references/provenance, not duplicated domain truth.

Use `Someone From Before` as the reference contract.

## Phase C — observation and hooks

Add a bounded runtime that can observe canonical simulation facts/events and make optional Scenario hooks available.

Examples:
- old username becomes searchable;
- another actor learns/discloses a relevant clue;
- player enters a relevant place;
- bound actor becomes physically encounterable through normal life/presence.

No teleportation or forced outcome.

## Phase D — first scenario pack

Author a small pack, initially something like:
- Someone From Before;
- Family Connection;
- Old Debt;
- Bad History;
- First Job Lead.

Exact pack may evolve.

At least one save should prove multiple compatible Scenarios can coexist.

Do not require every definition to instantiate.

## Phase E — optional projection API

Expose a read-only ScenarioProjection suitable for future UI/surfaces.

It may expose semantic information such as:
- hidden/dormant/active;
- player-known summary;
- currently available clue/hook;
- safe role presentation after the actor is known.

Do not build a quest tracker unless separately approved.

Existing surfaces such as Inner Voice/search/dialogue may consume scenario-safe cues through their own governance.

## Phase F — integration gate

Prove:
- deterministic new-game selection;
- dynamic role binding with no Maya/fixed actor dependency;
- current-format save/reload stability;
- canonical Social/Knowledge/Life Matrix/Spatial authorities remain owners;
- no duplicate relationship/location/knowledge truth;
- one Scenario can remain unresolved indefinitely;
- one Scenario can fail to instantiate;
- multiple Scenarios can coexist;
- no dedicated quest UI is required;
- no regression to fixed campaign/day limits.

## Implementation policy

- One canonical issue/branch/PR per slice.
- Do not mix Scenario implementation into the already-merged #29 living-world PR.
- Do not close or weaken the local #140 visual/audio acceptance requirement because Scenario work is independent.
- Content definitions use TinyBase/content validation/codegen.
- Prefer semantic IDs/tags/roles over actor names.
- Use focused tests during implementation and full exact-head repository verification near merge readiness.
- Current-format determinism matters; historical development-save migration does not block a cleaner design before save freeze.

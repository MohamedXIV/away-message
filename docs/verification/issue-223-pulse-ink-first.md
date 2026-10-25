# Pulse offline authored conversation — first delivery (#223)

## Owner-approved UX law

Contextual **Ink choices are always available**, even if an optional AI service is later connected. Without an enabled, validated AI intent resolver, the player does **not** get a free-text box that pretends to understand arbitrary prose. Free text can be added *alongside* choices only behind a genuine provider+semantic validation gate.

## First vertical slice (non-AI)

- `pulse-checkin.ink` is a reusable, actor-agnostic compiled inkjs flow. The Worker begins it through `NarrativeCoordinator` using `conversation_started` with `channel: 'pulse'`, and derives actor data through `SimulationNarrativeAdapter` bounded canonical reads.
- `WorkerPulseNarrative` authorizes current installed Pulse and player-known real actors, offers at most eight authored reply choices and revalidates the selected *index + exact current wording* inside one Worker FIFO request. No arbitrary player-provided text reaches Social on this surface.
- The Worker dispatches the selected authored message into the canonical Social transcript. Eligible online contacts can answer with the complete authored Ink line and validated semantic social effects. Offline contacts receive the message but do **not** produce a fake immediate reply. Both halves persist through the existing Social save and cold conversation archive.
- The authenticated Worker Pulse UI shows clickable contextual reply options. Old `PULSE_SEND_MESSAGE` raw-text commands fail closed while AI intent parsing is not implemented.
- Uses the same NarrativeHost/Ink/Simulation owner seam as the in-person Café; no Pulse-specific second chat history or shadow relationship owner.

## Deliberately unfinished

This is the **first** repeatable check-in flow, not full dynamic context coverage: rich actor memory/scene/relationship/availability branches, delayed responses when offline contacts return, emergent event-driven dialogue, full visual Messenger parity, optional AI free-text intent mapping, and real human chat-quality/UX approval remain tracked in #223. No guarantee of the same exact wording for every NPC forever; authored flow coverage must expand without producing protected named protagonists.

## Evidence

- New unit tests exercise offered-choice authorization, tamper/stale wording rejection, same-owner outbound/inbound transcript and cold persistence, and offline response suppression.
- ScenarioZ (real DOS/Orion/download/install) exercises a live Worker Pulse choice; historical ScenarioW free-text UI usage is migrated to choice UI. Exact-head verification status belongs to the PR, not this prose.

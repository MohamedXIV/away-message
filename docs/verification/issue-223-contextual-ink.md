# #223 — Contextual Ink-first Pulse conversations

This iteration extends merged PR #225 without moving dialogue truth into React
or inventing a second Social history.

## Worker-owned selection

Every available reply continues to come from a compiled, authored **Ink** scene.
A small deterministic routing policy selects an appropriate reusable flow from
current, canonical actor facts, in this priority:

1. A conflicted relationship: a guarded repair conversation.
2. A typed `shared_moment` that explicitly contains **both** the player and
   selected actor: reminiscence. Text-only memories and memories about other
   participants never grant knowledge.
3. A trusted relationship: an honest, closer exchange.
4. A remote person: online-only chat, never an invented local encounter.
5. Local diner staff, canal night owl, shift worker: role-sensitive talk.
6. Generic Ink check-in for all remaining known people.

These are authored **situations**, not sacred story characters or generated
free-text: generated world casts participate based on their truth and roles.
The actual available reply index and current text are revalidated inside the
Worker before a Social owner write. The same unavailable/offline gate and
cold-save transcript contract remain. Ink owns authored choices and proposed
validated social actions; Simulation/Social owns consequences.

## Explicit limits

This release improves *choice relevance* and supplies seven authored,
branch-specific NPC responses, but is not a fully emergent chat simulation.
Follow-up multi-turn arcs, delayed responses to an offline outbound message,
memories that develop from conversation, a full retro Messenger presentation,
and an optional AI semantic input lane **alongside** existing choices remain
in issue #223. A real human review is still required.

## Contract gate

`tests/unit/WorkerPulseNarrative.test.ts` now covers local-vs-remote, conflict,
trust, mutual-memory knowledge and cold restore; the separate compiled-flow
test checks that every authored .ink and compiled .ink.json still agree and
runs in inkjs. The existing real installed-Messenger Chromium check retains
a deterministic first choice for early acquaintances.

# #223 — NPC-initiated Pulse outreach (fourth slice)

NPCs can now message the player without a preceding player text input.
The existing canonical Worker advance calls one social reconciliation function:
it first delivers owed authored offline replies, then considers **at most two**
player-known contacts as unsolicited outreach candidates for the world day.
Only installed Pulse, day 2+, daytime/evening, available and unblocked actors,
non-conflicted relationships, a willing daily mood, and no ongoing or recently
finished conversation can initiate. Candidate selection and authored variant
selection are seeded deterministic hashes of actor id/day, not random mutable
state or React polling. The Social transcript supplies both duplicate
suppression and the thread bookmark across saves.

Authoring split:
- A tiny reusable systemic intent/line bank produces the **NPC's opening
  message** according to canonical motivations (actual shared typed memories
  witnessed by both participants, outstanding Social promise, trusted bond,
  remote identity or known occupational role). Text-only and private memories
  never unlock a claim that the two experienced something together.
- `pulse-outreach-reply.ink` provides all **player choices** and the NPC's
  subsequent response. The full thread, reply choice and any deferred NPC
  answer are validated by the Worker and persisted only through canonical
  Social messages. No second message history, offline arbitrary NLP input or
  Gen AI service is introduced.

Safety/performance: one initiative per actor per day, a two-world-day cooldown,
only the first two stable daily candidate ids considered, and existing
world-minute reconciliation/availability gates for owed replies. No NPC may
interrupt an unfinished player-initiated chat. Outbound NPC messages can
arrive while Pulse is installed even when its window is closed; real canonical
unread counts deliver the notification.

This is **not** completion of #223: richer narrative stakes, more personally
distinguishable voice, longer authored arcs, cross-domain knowledge prompts,
retro animation/notifications and human review are still open.

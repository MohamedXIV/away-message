// #223 Open-promise outreach: the Social ledger must still contain a real unresolved promise.
// Canonical Social provenance gates this flow; Ink owns only choices and wording.
EXTERNAL narrative_query(key, arg)
EXTERNAL request_social_act(buddyId, action)

-> start

=== start ===
Pick something to say to your friend. # greeting
{ narrative_query("actor_trusted", ""):
    You've shared a few good conversations already. # trusted
- else:
    You're still getting to know each other. # guarded
}
* [Where do we stand on what we agreed?] -> ask_how
* [Can we plan when to pick this back up?] -> joke
* [I haven't forgotten, but I can't deal with it today.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
We can take another look at what we agreed and work out the next step. # empathy # tier:l2 # speech:reassure # fact:what we agreed # fact:next step # tone:warm # forbid:promise fulfilled
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Let's find a time to talk it through. I haven't crossed it off. # curious # tier:l2 # speech:observe # fact:find a time # fact:talk it through # tone:curious # forbid:appointment booked
-> close

=== pause ===
That's okay. We can come back to the plan when you're ready. # quiet # tier:l1 # speech:observe # fact:that's okay # fact:when you're ready # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

// #223 Mutual-memory outreach: requires a typed Social shared_moment with both participants.
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
* [What do you remember about that time together?] -> ask_how
* [Does that day ever come back to you?] -> joke
* [I remember too, but can't talk about it just now.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
I remember being there with you. Some parts of it have stayed with me. # empathy # tier:l2 # speech:reassure # fact:being there # fact:parts stayed # tone:warm # forbid:it was a happy time
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Sometimes. I still think about what that moment meant to us. # curious # tier:l2 # speech:observe # fact:sometimes # fact:what it meant # tone:curious # forbid:an invented event
-> close

=== pause ===
I hear you. We can leave that memory alone for now. # quiet # tier:l1 # speech:observe # fact:I hear you # fact:leave it alone # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

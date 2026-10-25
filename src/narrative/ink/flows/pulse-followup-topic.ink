// #223 follow-up scene (pulse-followup-topic): phase two in canonical Social message thread.
// Never accept arbitrary free-text messages as if this flow understood them.
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
* [Did you enjoy it?] -> ask_how
* [What made you think about that?] -> joke
* [Maybe we can talk about it another time.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
Parts of it, yeah. Other parts were tiring. # empathy # tier:l2 # speech:reassure # fact:parts of it # fact:other parts # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Hard to say. It just stayed on my mind. # curious # tier:l2 # speech:observe # fact:hard to say # fact:stayed on my mind # tone:curious # forbid:an insult
-> close

=== pause ===
Sure. Another time sounds good. # quiet # tier:l1 # speech:observe # fact:another time # fact:sounds good # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

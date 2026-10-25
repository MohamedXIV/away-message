// #223 currently conflicted relationship: reusable Ink conversation, never tied to actor ID.
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
* [Can we talk about what happened?] -> ask_how
* [I'm sorry for my part in it.] -> joke
* [I can give you some space if you want.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "vulnerable_share")
We can talk, but I don't want to pretend everything's fine. # empathy # tier:l2 # speech:reassure # fact:We can talk # fact:everything's fine # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "vulnerable_share")
I hear you. I still need some time to sort things out. # empathy # tier:l2 # speech:reassure # fact:still need # fact:sort things out # tone:guarded # forbid:an insult
-> close

=== pause ===
Thanks. I think that would help right now. # quiet # tier:l1 # speech:observe # fact:would help # fact:right now # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

// #223 remote online friend: reusable Ink conversation, never tied to actor ID.
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
* [Hey! How have you been lately?] -> ask_how
* [What's been happening on your side of the screen?] -> joke
* [Hope your connection stays up tonight.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
Not too bad over here. It's good to hear from you. # empathy # tier:l2 # speech:reassure # fact:over here # fact:hear from you # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Little things, mostly. Different streets, same kind of week. # curious # tier:l2 # speech:question # fact:Little things # fact:Different streets # tone:curious # forbid:an insult
-> close

=== pause ===
Same here. If I drop offline, that's probably why. # quiet # tier:l1 # speech:observe # fact:drop offline # fact:probably why # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

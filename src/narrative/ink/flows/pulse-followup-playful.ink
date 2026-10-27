// #223 follow-up for authored playful banter. No claim of knowing the account owner.
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
* [Haha, sounds like your keyboard needs a break.] -> ask_how
* [So what's keeping you online tonight?] -> joke
* [I'll let you escape the chat window ;)] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
it really does. maybe i should go outside for once. # empathy # tier:l2 # speech:reassure # fact:keyboard needs a break # fact:go outside # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Nothing dramatic. Just couldn't sleep yet. # curious # tier:l2 # speech:observe # fact:nothing dramatic # fact:couldn't sleep # tone:curious # forbid:an insult
-> close

=== pause ===
lol okay, talk later! # quiet # tier:l1 # speech:observe # fact:talk later # fact:okay # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

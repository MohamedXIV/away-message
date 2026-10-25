// Authored offline Pulse check-in with the same inkjs narrative/effects contract.
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
* [Do you ever log off, or is that just a myth? ;)] -> joke
* [Hope you're having a nice evening.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
Doing okay, thanks for checking in. How about you? # empathy # tier:l2 # speech:reassure # fact:doing okay # fact:how about you # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "tease_playful")
lol. fair question. some days it feels like i live in this window. # playful # tier:l2 # speech:tease # fact:fair question # fact:some days # tone:playful # forbid:an insult
-> close

=== pause ===
You too. Talk soon :) # quiet # tier:l1 # speech:observe # fact:talk soon # fact:you too # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

// #223 local canal night owl: reusable Ink conversation, never tied to actor ID.
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
* [Been by the canal lately?] -> joke
* [You should get some sleep when you can.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
Still awake, obviously. How about you? # empathy # tier:l2 # speech:reassure # fact:still awake, # fact:iously how about you # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
I've walked that way a few times. It's quieter after dark. # curious # tier:l2 # speech:tease # fact:i've walked # fact:'s quieter after dark # tone:playful # forbid:an insult
-> close

=== pause ===
I know. Just one more thing before I log off. # quiet # tier:l1 # speech:observe # fact:i know # fact:hing before i log off # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

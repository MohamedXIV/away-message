// #223 known nearby diner friend: reusable Ink conversation, never tied to actor ID.
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
* [How was your shift at the diner?] -> joke
* [Hope you get a chance to rest after work.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
It was a long shift, but I'm doing okay. Thanks for asking. # empathy # tier:l2 # speech:reassure # fact:it was # fact:ay thanks for asking # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "work_camaraderie")
A lot of people passed through today. I'm glad it's quieter now. # work # tier:l2 # speech:tease # fact:a lot # fact:glad it's quieter now # tone:playful # forbid:an insult
-> close

=== pause ===
Thanks. I could use a little quiet tonight. # quiet # tier:l1 # speech:observe # fact:thanks i # fact: little quiet tonight # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

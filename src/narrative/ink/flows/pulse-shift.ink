// #223 friend with shift work: reusable Ink conversation, never tied to actor ID.
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
* [How's work treating you these days?] -> joke
* [Take it easy on your next shift.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
A little tired, but holding up. How are you? # empathy # tier:l2 # speech:reassure # fact:a little # fact:lding up how are you # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "work_camaraderie")
Some days are easier than others. You know how it goes. # work # tier:l2 # speech:tease # fact: you know how it goes # fact: you know how it goes # tone:playful # forbid:an insult
-> close

=== pause ===
Thanks. I'll try to remember that. # quiet # tier:l1 # speech:observe # fact:thanks i'll # fact: try to remember that # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

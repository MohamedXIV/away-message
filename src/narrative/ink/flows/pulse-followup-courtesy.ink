// #223 follow-up scene (pulse-followup-courtesy): phase two in canonical Social message thread.
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
* [Just wanted you to know I'm here.] -> ask_how
* [No pressure to reply right away.] -> joke
* [Good night. Talk to you soon.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
I appreciate that. It means something. # empathy # tier:l2 # speech:reassure # fact:appreciate that # fact:means something # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Thanks for understanding. I'll be around when I can. # curious # tier:l2 # speech:observe # fact:thanks for understanding # fact:around when I can # tone:curious # forbid:an insult
-> close

=== pause ===
Night. Take care of yourself. # quiet # tier:l1 # speech:observe # fact:take care # fact:of yourself # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

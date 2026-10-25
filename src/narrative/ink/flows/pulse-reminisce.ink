// #223 mutual shared experience in Social memory: reusable Ink conversation, never tied to actor ID.
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
* [Remember when we spent that time together?] -> joke
* [I'm glad we had that moment.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
I'm okay. Good to hear from you again. # empathy # tier:l2 # speech:reassure # fact:Good to hear # fact:again # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "remembered_detail")
Yeah, I remember. That was a good day. # remembered # tier:l2 # speech:reflect # fact:I remember # fact:good day # tone:warm # forbid:an insult
-> close

=== pause ===
Me too. It still makes me smile. # quiet # tier:l1 # speech:observe # fact:makes me smile # fact:Me too # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

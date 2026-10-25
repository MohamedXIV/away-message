// #223 trusted close bond: reusable Ink conversation, never tied to actor ID.
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
* [Something on your mind? You can tell me.] -> joke
* [I'm glad we can talk openly like this.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
I'm okay. It's nice that you checked in. # empathy # tier:l2 # speech:reassure # fact:nice that # fact:checked in # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "vulnerable_share")
Maybe. Give me a moment to figure out where to start. # vulnerable # tier:l2 # speech:reassure # fact:Give me a moment # fact:where to start # tone:warm # forbid:an insult
-> close

=== pause ===
Me too. I don't take that for granted. # quiet # tier:l1 # speech:observe # fact:don't take # fact:for granted # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

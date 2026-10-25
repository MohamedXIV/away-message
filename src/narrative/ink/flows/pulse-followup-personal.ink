// #223 follow-up scene (pulse-followup-personal): phase two in canonical Social message thread.
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
* [That sounds like a lot. Want to say more?] -> ask_how
* [We can switch to something lighter.] -> joke
* [I'll let you get some rest.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
Thanks for asking. I'd rather take it slowly. # empathy # tier:l2 # speech:reassure # fact:rather take # fact:it slowly # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Maybe. Tell me something good about your day instead. # curious # tier:l2 # speech:observe # fact:something good # fact:your day # tone:curious # forbid:an insult
-> close

=== pause ===
Thanks. I'll catch up with you later. # quiet # tier:l1 # speech:observe # fact:catch up # fact:later # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

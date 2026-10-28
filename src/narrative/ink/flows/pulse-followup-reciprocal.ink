// #223 follow-up for a real incoming question about the player's day. No invented player facts.
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
* [I'm alright, actually. Anything good happen on your end?] -> ask_how
* [Honestly? Pretty wiped out today.] -> joke
* [Not too bad, thanks. I'll let you get back to it.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
Nothing earth-shattering, but it's been nice to slow down a bit. # empathy # tier:l2 # speech:reassure # fact:nothing earth-shattering # fact:slowing down # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Oof. Hope you get a break soon. Don't push yourself too hard. # curious # tier:l2 # speech:observe # fact:hope for a break # fact:don't push too hard # tone:gentle # forbid:an insult
-> close

=== pause ===
Sure thing. Catch you later :) # quiet # tier:l1 # speech:observe # fact:catch up # fact:later # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

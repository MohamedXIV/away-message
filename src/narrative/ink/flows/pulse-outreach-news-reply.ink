// #223 news-specific reply when the NPC actually learned a triggered World event.
// World/Social provenance gates this flow; Ink only owns authored choices and words.
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
* [What did you make of that news?] -> ask_how
* [Do you think anything will change?] -> joke
* [I can't talk about it now, but thanks for telling me.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
That story's still on my mind. I want to see what actually happens. # empathy # tier:l2 # speech:reassure # fact:story # fact:what actually happens # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
It's hard to tell yet. I'll keep an eye on what happens next. # curious # tier:l2 # speech:observe # fact:hard to tell # fact:what happens next # tone:curious # forbid:an insult
-> close

=== pause ===
Of course. We can talk about it another time. # quiet # tier:l1 # speech:observe # fact:of course # fact:another time # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

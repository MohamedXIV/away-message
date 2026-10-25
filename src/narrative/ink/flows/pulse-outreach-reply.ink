// #223 NPC-initiated Pulse response: player choices in canonical Social thread.
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
* [Hey, good to hear from you. What's up?] -> ask_how
* [Thanks for checking in. I'm around.] -> joke
* [I can't talk much now, but I saw your message.] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
Nothing urgent. I just wanted to check in with you. # empathy # tier:l2 # speech:reassure # fact:nothing urgent # fact:check in # tone:warm # forbid:exam result
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "intellectual_curiosity")
Good to know you're there. How's your day going? # curious # tier:l2 # speech:observe # fact:good to know # fact:your day # tone:curious # forbid:an insult
-> close

=== pause ===
No worries. Talk when you've got a moment. # quiet # tier:l1 # speech:observe # fact:no worries # fact:a moment # tone:quiet
-> close

=== close ===
* [Close this conversation for now] -> END

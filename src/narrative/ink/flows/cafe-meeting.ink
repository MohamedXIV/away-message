// Migrated authored café interaction: the Starlight Café in-person opener.
// Canonical social consequences are requested as validated effects only.
EXTERNAL narrative_query(key, arg)
EXTERNAL request_social_act(buddyId, action)

-> start

=== start ===
Hey! You made it! It's... honestly so strange seeing you outside of that little chat box. But in a really good way. I grabbed the booth by the radiator — sit, sit. # greeting
{ narrative_query("actor_trusted", ""):
    Up close they look easier than their messages sounded. # trusted
- else:
    Up close they look like someone deciding how much of the truth to tell. # guarded
}
* [Ask how they've been] -> ask_how
* [Make a dry joke about the coffee] -> joke
* [Let the pause sit] -> pause

=== ask_how ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "empathy")
For a second they just look at the mug. Then the week comes out sideways, in pieces. # empathy # tier:l2 # speech:reassure # fact:the week # fact:pieces # tone:warm # forbid:the exact reason
-> close

=== joke ===
~ temp speaker = narrative_query("actor_id", "")
~ request_social_act(speaker, "tease_playful")
The joke lands somewhere between a cough and a laugh. You'll take it. # playful # tier:l2 # speech:tease # fact:the joke # fact:a laugh # tone:playful # forbid:an insult
-> close

=== pause ===
The silence settles. Not uncomfortable. Just... there. # quiet # tier:l1 # speech:observe # fact:the silence settles # fact:not uncomfortable # tone:quiet
-> close

=== close ===
* [Let the conversation find its own way] -> END

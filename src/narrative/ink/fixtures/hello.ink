EXTERNAL request_effect(type, payload)
EXTERNAL narrative_query(key, arg)

VAR asked = false

-> start

=== start ===
Hello there. # greeting
{ narrative_query("actor_trusted", ""):
    I trust you. # trusted
- else:
    I don't know you yet. # untrusted
}
What would you like to do?
* [Ask about the exam] -> ask_exam
* [Say goodbye] -> goodbye

=== ask_exam ===
~ asked = true
You asked about the exam. # effect:flag:asked_exam:true
~ request_effect("social_act", "empathy")
-> DONE

=== goodbye ===
Goodbye! # farewell
-> END
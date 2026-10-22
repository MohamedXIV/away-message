// Launched by the existing old_debt Scenario hooks (debt_search / debtor_nearby).
// Scenario bindings, facts and lifecycle remain owned by ScenarioDirector.
EXTERNAL narrative_query(key, arg)

VAR hook_seen = ""

-> start

=== start ===
~ hook_seen = narrative_query("scenario_hook_id", "")
{ hook_seen == "debt_search":
    A search you typed without thinking brings it back: something unfinished, from before Oakhaven. # scenario
- else:
    Something unfinished surfaces, from before Oakhaven. # scenario
}
{ narrative_query("actor_known", ""):
    You know exactly whose name belongs to this feeling. # known
- else:
    The name is still somewhere behind the feeling, out of reach. # unknown
}
* [Sit with it for a minute] -> sit_with_it
* [Close the window] -> close

=== sit_with_it ===
Nothing resolves. Some things just wait. # remembered
-> END

=== close ===
The window closes. The feeling doesn't. # avoided
-> END

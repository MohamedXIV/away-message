// Henderson 14-Day Dialogue Arc

=== henderson_day1 ===
This is the Starlite Motel Front Office. Welcome to Room 104.
Quiet hours begin promptly at 22:00. The DSL jack is provided as a courtesy; do not tamper with the external wall junction box.
+ [Understood, Mr. Henderson. I will keep noise down and respect the property.]
    # beat:henderson_day1_complete
    # social:henderson:empathy
    Good. We value quiet tenants. Let me know if the plumbing needs inspection.
    -> DONE
+ [Thank you. Is the copper line dedicated or shared across the south motel wing?]
    # beat:henderson_day1_complete
    # social:henderson:intellectual_curiosity
    Dedicated copper pair straight to the main distribution frame. Do not overload the circuit with unapproved appliances.
    -> DONE

=== henderson_day7 ===
Today is Day 7 rent reconciliation day.
Checking the payment ledger for Room 104...
+ [Paid in full ($140.00) through the simulation action portal, Mr. Henderson.]
    # beat:henderson_day7_complete
    # social:henderson:work_camaraderie
    Payment received and logged. Room 104 is in good standing for Week 2. Enjoy your evening.
    -> DONE
+ [Finishing up today’s work shift wages right now to complete the payment.]
    # beat:henderson_day7_complete
    # social:henderson:empathy
    Ensure the balance is cleared before 20:00 tonight. We do not extend credit.
    -> DONE

=== henderson_day14 ===
Day 14 evaluation concluded. Both weekly rent obligations have been processed successfully.
Zero noise complaints, zero property damage, and prompt accounts. Room 104 is officially yours for as long as you wish to stay.
+ [Thank you for providing a stable, quiet home, Mr. Henderson. Honored to stay here.]
    # beat:henderson_day14_complete
    # effect:flag:henderson_arc_completed:true
    # social:henderson:vulnerable_share
    Welcome permanently to Starlite Motel. The desk is always open if you need anything.
    -> DONE
+ [Room 104 will continue to be kept in impeccable condition.]
    # beat:henderson_day14_complete
    # effect:flag:henderson_arc_completed:true
    # social:henderson:work_camaraderie
    Excellent. Keep up the good work. Good evening, neighbor.
    -> DONE

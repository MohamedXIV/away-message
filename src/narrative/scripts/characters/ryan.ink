// Ryan 14-Day Dialogue Arc

=== ryan_day1 ===
yo wanderer! smell anything sizzling across the canal?
grilling fresh al pastor on the cart today. Best tacos in Oakhaven (Y) Did you get the Room 104 DSL hooked up?
+ [Save me three tacos! I will walk over in twenty minutes.]
    # beat:ryan_day1_complete
    # social:ryan:work_camaraderie
    -> ryan_day1_tacos
+ [Hey Ryan! Yeah, DSL is running. Did you finish overclocking that SDRAM module yet?]
    # beat:ryan_day1_complete
    # social:ryan:intellectual_curiosity
    -> ryan_day1_overclock

=== ryan_day1_tacos ===
done! extra cilantro and lime on the house for Room 104. See ya soon! # beat:ryan_day1_complete
-> DONE

=== ryan_day1_overclock ===
haha YES! Pushed the PC133 SDRAM to 150MHz CL2 with custom copper heatsinks. Super stable.
check TechMart if you need a memory kit too. Makes everything fly! # beat:ryan_day1_complete
-> DONE

=== ryan_day2 ===
hey man! If you want to listen to tunes while browsing, grab RetroAmp from DownloadHub.
and get FlashFetch too — multi-threaded download acceleration makes huge files take half the time on our copper lines.
+ [Nice, I will download RetroAmp right away. What MP3s are you listening to?]
    # beat:ryan_day2_complete
    # effect:flag:ryan_suggested_retroamp:true
    # social:ryan:intellectual_curiosity
    mostly 90s trip-hop and trance mixes from peerbox.local. Fits the rainy weather perfectly.
    -> DONE
+ [As long as your playlist isn’t 100% eurodance remixes again...]
    # beat:ryan_day2_complete
    # effect:flag:ryan_suggested_retroamp:true
    # social:ryan:tease_playful
    hey! That 140 BPM synth breakdown keeps the taco cart moving fast during lunch rush haha.
    -> DONE

=== ryan_day3 ===
heads up: my buddy downloaded WeatherBuddy yesterday and it secretly bundled the SearchMate browser toolbar.
uncheck all the extra checkboxes during installation, or run SafeSweep if your browser starts opening popups!
+ [Thanks for the heads up, Ryan. I always uncheck optional bundled toolbars.]
    # beat:ryan_day3_complete
    # effect:flag:ryan_adware_warned:true
    # social:ryan:empathy
    smart move! Good software hygiene keeps Orion OS running like butter.
    -> DONE
+ [Where do I get SafeSweep if something does slip past?]
    # beat:ryan_day3_complete
    # effect:flag:ryan_adware_warned:true
    # social:ryan:intellectual_curiosity
    it is on safesweep.local or DownloadHub. Scans your registry and cleans out hijacked homepage settings.
    -> DONE

=== ryan_day7 ===
hey! Don’t forget Week 1 rent ($140) is due today. Henderson starts knocking on doors around 8 PM.
you got enough cash saved up, or do you need me to spot you twenty bucks from the cart till?
+ [I budgeted carefully — got the $140 ready to pay through the desk terminal.]
    # beat:ryan_day7_complete
    # effect:flag:ryan_rent_reminder:true
    # social:ryan:work_camaraderie
    awesome! Henderson will be happy. One full week down in Room 104!
    -> DONE
+ [It’s a little tight this week, but I think I can make it if I work an extra shift.]
    # beat:ryan_day7_complete
    # effect:flag:ryan_rent_reminder:true
    # social:ryan:vulnerable_share
    you got this. Just hit the work button whenever you have energy. We’ll get through it.
    -> DONE

=== ryan_day14 ===
DAY 14! (party) You officially survived two weeks at Starlite Motel!
from a bare desk and noisy phone line to a full workstation and tight-knit crew. Cheers to you, buddy.
+ [Cheers to you too, Ryan! Couldn’t have done it without your shifts and tech advice.]
    # beat:ryan_day14_complete
    # effect:flag:ryan_arc_completed:true
    # social:ryan:work_camaraderie
    anytime! First round of tacos on Day 15 is on me. See you around the canal!
    -> DONE
+ [Here is to the next chapter. Free play mode begins tomorrow!]
    # beat:ryan_day14_complete
    # effect:flag:ryan_arc_completed:true
    # social:ryan:vulnerable_share
    hell yeah! We’re just getting started. Keep the pulse going!
    -> DONE

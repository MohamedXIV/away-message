// Café In-Person Meeting Scene

=== cafe_scene ===
(Maya sits in the corner window booth wearing a dark green wool coat. She looks up and waves with a shy, warm smile.)
You made it! It is... so surreal seeing you in three dimensions instead of a little blue Pulse buddy icon.
+ [It really is. Hearing your real voice is so much warmer than text on a screen.]
    # social:maya:vulnerable_share
    -> cafe_ordering
+ [I was almost expecting typing indicators to hover above your head before you spoke!]
    # social:maya:tease_playful
    -> cafe_ordering

=== cafe_ordering ===
(The waitress drops off two steaming mugs of black diner coffee and a small plate of cinnamon toast.)
# effect:money:spend:4:bought_coffee
I ordered the house blend for us. Look at the rain streaking down the glass outside... this is my favorite booth in the entire town.
+ [Holding a hot ceramic mug while watching the rain... this is perfect.]
    # social:maya:empathy
    -> cafe_portfolio
+ [Is this the same booth where you developed your concept for the neon puddle reflections?]
    # social:maya:remembered_detail
    -> cafe_portfolio

=== cafe_portfolio ===
(Maya reaches into her messenger bag and places a black archival portfolio folder onto the table.)
Here they are. Real 8x10 fiber silver gelatin prints. You can see the actual silver grain in the shadows of the Starlite Motel sign.
+ [The tonal depth here is breathtaking. You captured the quiet melancholy of 3:00 AM so perfectly.]
    # social:maya:remembered_detail
    -> cafe_questions
+ [How did you achieve such crisp contrast between the neon filament and the rain puddles?]
    # social:maya:intellectual_curiosity
    -> cafe_questions

=== cafe_questions ===
(Maya places her hands around her warm mug, looking into your eyes with genuine curiosity.)
When we talk on Pulse, I feel like you really see me. What is it that you’re looking for in this town, honestly?
+ [A clean slate. A quiet place where I can heal, rebuild my independence, and figure out my own path.]
    # social:maya:vulnerable_share
    -> cafe_parting
+ [Real human connection. I was adrift until our conversations gave every evening a purpose.]
    # social:maya:vulnerable_share
    -> cafe_parting
+ [Just simple honesty, good friends, and the freedom to create something meaningful on my computer.]
    # social:maya:work_camaraderie
    -> cafe_parting

=== cafe_parting ===
(Maya smiles gently, her eyes shining with warmth. She wraps her dark green coat and zips it up.)
Thank you for being so honest with me. Meeting you in person made everything feel complete. I’ll message you on Pulse as soon as I get home tonight!
# beat:cafe_meeting_complete
# effect:flag:cafe_meeting_attended:true
# effect:view:switch:room
# social:maya:vulnerable_share
-> DONE

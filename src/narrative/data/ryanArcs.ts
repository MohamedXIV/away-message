import { StoryKnot } from '../types';

export const RYAN_14DAY_KNOTS: StoryKnot[] = [
  // Day 1
  {
    id: 'ryan_day1',
    characterId: 'ryan',
    title: 'Tacos Across the Canal',
    day: 1,
    lines: [
      {
        id: 'r1_1',
        speaker: 'ryan',
        text: 'yo wanderer! smell anything sizzling across the canal?',
      },
      {
        id: 'r1_2',
        speaker: 'ryan',
        text: 'grilling fresh al pastor on the cart today. Best tacos in Oakhaven (Y) Did you get the Room 104 DSL hooked up?',
      },
    ],
    choices: [
      {
        id: 'c_r1_tacos',
        text: 'Save me three tacos! I will walk over in twenty minutes.',
        socialAction: 'work_camaraderie',
        targetKnot: 'ryan_day1_tacos',
        tags: ['# beat:ryan_day1_complete', '# social:ryan:work_camaraderie'],
      },
      {
        id: 'c_r1_pc',
        text: 'Hey Ryan! Yeah, DSL is running. Did you finish overclocking that SDRAM module yet?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'ryan_day1_overclock',
        tags: ['# beat:ryan_day1_complete', '# social:ryan:intellectual_curiosity'],
      },
    ],
  },
  {
    id: 'ryan_day1_tacos',
    characterId: 'ryan',
    lines: [
      {
        id: 'r1_t1',
        speaker: 'ryan',
        text: 'done! extra cilantro and lime on the house for Room 104. See ya soon!',
        tags: ['# beat:ryan_day1_complete'],
      },
    ],
  },
  {
    id: 'ryan_day1_overclock',
    characterId: 'ryan',
    lines: [
      {
        id: 'r1_o1',
        speaker: 'ryan',
        text: 'haha YES! Pushed the PC133 SDRAM to 150MHz CL2 with custom copper heatsinks. Super stable.',
      },
      {
        id: 'r1_o2',
        speaker: 'ryan',
        text: 'check TechMart if you need a memory kit too. Makes everything fly!',
        tags: ['# beat:ryan_day1_complete'],
      },
    ],
  },

  // Day 2
  {
    id: 'ryan_day2',
    characterId: 'ryan',
    title: 'Essential Software Recommendations',
    day: 2,
    lines: [
      {
        id: 'r2_1',
        speaker: 'ryan',
        text: 'hey man! If you want to listen to tunes while browsing, grab RetroAmp from DownloadHub.',
      },
      {
        id: 'r2_2',
        speaker: 'ryan',
        text: 'and get FlashFetch too — multi-threaded download acceleration makes huge files take half the time on our copper lines.',
      },
    ],
    choices: [
      {
        id: 'c_r2_retroamp',
        text: 'Nice, I will download RetroAmp right away. What MP3s are you listening to?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'ryan_day2_music',
        tags: ['# beat:ryan_day2_complete', '# effect:flag:ryan_suggested_retroamp:true'],
      },
      {
        id: 'c_r2_tease',
        text: 'As long as your playlist isn’t 100% eurodance remixes again...',
        socialAction: 'tease_playful',
        targetKnot: 'ryan_day2_eurodance',
        tags: ['# beat:ryan_day2_complete', '# effect:flag:ryan_suggested_retroamp:true'],
      },
    ],
  },
  {
    id: 'ryan_day2_music',
    characterId: 'ryan',
    lines: [
      {
        id: 'r2_m1',
        speaker: 'ryan',
        text: 'mostly 90s trip-hop and trance mixes from peerbox.local. Fits the rainy weather perfectly.',
        tags: ['# beat:ryan_day2_complete'],
      },
    ],
  },
  {
    id: 'ryan_day2_eurodance',
    characterId: 'ryan',
    lines: [
      {
        id: 'r2_e1',
        speaker: 'ryan',
        text: 'hey! That 140 BPM synth breakdown keeps the taco cart moving fast during lunch rush haha.',
        tags: ['# beat:ryan_day2_complete'],
      },
    ],
  },

  // Day 3
  {
    id: 'ryan_day3',
    characterId: 'ryan',
    title: 'Adware & Toolbar Warning',
    day: 3,
    lines: [
      {
        id: 'r3_1',
        speaker: 'ryan',
        text: 'heads up: my buddy downloaded WeatherBuddy yesterday and it secretly bundled the SearchMate browser toolbar.',
      },
      {
        id: 'r3_2',
        speaker: 'ryan',
        text: 'uncheck all the extra checkboxes during installation, or run SafeSweep if your browser starts opening popups!',
      },
    ],
    choices: [
      {
        id: 'c_r3_thanks',
        text: 'Thanks for the heads up, Ryan. I always uncheck optional bundled toolbars.',
        socialAction: 'empathy',
        targetKnot: 'ryan_day3_cautious',
        tags: ['# beat:ryan_day3_complete', '# effect:flag:ryan_adware_warned:true'],
      },
      {
        id: 'c_r3_safesweep',
        text: 'Where do I get SafeSweep if something does slip past?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'ryan_day3_tools',
        tags: ['# beat:ryan_day3_complete', '# effect:flag:ryan_adware_warned:true'],
      },
    ],
  },
  {
    id: 'ryan_day3_cautious',
    characterId: 'ryan',
    lines: [
      {
        id: 'r3_c1',
        speaker: 'ryan',
        text: 'smart move! Good software hygiene keeps Orion OS running like butter.',
        tags: ['# beat:ryan_day3_complete'],
      },
    ],
  },
  {
    id: 'ryan_day3_tools',
    characterId: 'ryan',
    lines: [
      {
        id: 'r3_t1',
        speaker: 'ryan',
        text: 'it is on safesweep.local or DownloadHub. Scans your registry and cleans out hijacked homepage settings.',
        tags: ['# beat:ryan_day3_complete'],
      },
    ],
  },

  // Day 4
  {
    id: 'ryan_day4',
    characterId: 'ryan',
    title: 'Hardware Upgrades & Weekend Shifts',
    day: 4,
    lines: [
      {
        id: 'r4_1',
        speaker: 'ryan',
        text: 'yo! BidBay has a few used 512MB RAM sticks for cheap this week.',
      },
      {
        id: 'r4_2',
        speaker: 'ryan',
        text: 'also, if you need cash before rent next week, let me know. I can give you a 4-hour evening prep shift at the food cart.',
      },
    ],
    choices: [
      {
        id: 'c_r4_work',
        text: 'I could definitely use the extra wages. Sign me up for food cart prep.',
        socialAction: 'work_camaraderie',
        targetKnot: 'ryan_day4_accept_shift',
        tags: ['# beat:ryan_day4_complete', '# effect:flag:ryan_shift_available:true'],
      },
      {
        id: 'c_r4_ram',
        text: 'Will 1GB of RAM make Orion OS 6.0 run smoothly without paging to disk?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'ryan_day4_ram_talk',
        tags: ['# beat:ryan_day4_complete', '# effect:flag:ryan_shift_available:true'],
      },
    ],
  },
  {
    id: 'ryan_day4_accept_shift',
    characterId: 'ryan',
    lines: [
      {
        id: 'r4_w1',
        speaker: 'ryan',
        text: 'awesome! $20 wage plus free food. You can clock in anytime from the room door.',
        tags: ['# beat:ryan_day4_complete'],
      },
    ],
  },
  {
    id: 'ryan_day4_ram_talk',
    characterId: 'ryan',
    lines: [
      {
        id: 'r4_r1',
        speaker: 'ryan',
        text: 'absolutely. 512MB on OS 6 gets sluggish with heavy apps like PhotoBox, but 1024MB makes it sing.',
        tags: ['# beat:ryan_day4_complete'],
      },
    ],
  },

  // Day 5
  {
    id: 'ryan_day5',
    characterId: 'ryan',
    title: 'Canal Observations & Landlord Gossip',
    day: 5,
    lines: [
      {
        id: 'r5_1',
        speaker: 'ryan',
        text: 'did you see those city utility vans idling near the canal bridge past midnight?',
      },
      {
        id: 'r5_2',
        speaker: 'ryan',
        text: 'Henderson was out there yelling at them about vibrations rattling the motel foundation haha.',
      },
    ],
    choices: [
      {
        id: 'c_r5_vibe',
        text: 'I watched them from my motel window. They had some heavy acoustic sensor gear.',
        socialAction: 'vulnerable_share',
        targetKnot: 'ryan_day5_sensors',
        tags: ['# beat:ryan_day5_complete'],
      },
      {
        id: 'c_r5_henderson',
        text: 'Henderson loves protecting his precious junction boxes!',
        socialAction: 'tease_playful',
        targetKnot: 'ryan_day5_henderson_joke',
        tags: ['# beat:ryan_day5_complete'],
      },
    ],
  },
  {
    id: 'ryan_day5_sensors',
    characterId: 'ryan',
    lines: [
      {
        id: 'r5_s1',
        speaker: 'ryan',
        text: 'Nora was probably watching them too. She’s convinced the whole canal is an acoustic antenna.',
        tags: ['# beat:ryan_day5_complete'],
      },
    ],
  },
  {
    id: 'ryan_day5_henderson_joke',
    characterId: 'ryan',
    lines: [
      {
        id: 'r5_h1',
        speaker: 'ryan',
        text: 'haha right? Don’t let him catch you with extra electronics plugged in Room 104!',
        tags: ['# beat:ryan_day5_complete'],
      },
    ],
  },

  // Day 6
  {
    id: 'ryan_day6',
    characterId: 'ryan',
    title: 'Weekend Gaming & Disk Cleanup',
    day: 6,
    lines: [
      {
        id: 'r6_1',
        speaker: 'ryan',
        text: 'weekend is here! Spent all morning cleaning up my hard drive. Freed up 3 GB of temp files.',
      },
      {
        id: 'r6_2',
        speaker: 'ryan',
        text: 'remember to empty your trash folder in Orion OS if you are downloading large install packages.',
      },
    ],
    choices: [
      {
        id: 'c_r6_cleanup',
        text: 'Good call. 40 GB fills up faster than you expect with audio and installers.',
        socialAction: 'work_camaraderie',
        targetKnot: 'ryan_day6_disk',
        tags: ['# beat:ryan_day6_complete'],
      },
      {
        id: 'c_r6_lan',
        text: 'Remember when we used to haul heavy CRT monitors to LAN parties on weekends?',
        socialAction: 'remembered_detail',
        targetKnot: 'ryan_day6_nostalgia',
        tags: ['# beat:ryan_day6_complete'],
      },
    ],
  },
  {
    id: 'ryan_day6_disk',
    characterId: 'ryan',
    lines: [
      {
        id: 'r6_d1',
        speaker: 'ryan',
        text: 'yeah! Keep at least 2 GB free so the virtual memory swapfile has room to breathe.',
        tags: ['# beat:ryan_day6_complete'],
      },
    ],
  },
  {
    id: 'ryan_day6_nostalgia',
    characterId: 'ryan',
    lines: [
      {
        id: 'r6_n1',
        speaker: 'ryan',
        text: 'man, hauling 45-pound 19-inch glass CRTs up three flights of stairs was a real workout! Good times.',
        tags: ['# beat:ryan_day6_complete'],
      },
    ],
  },

  // Day 7
  {
    id: 'ryan_day7',
    characterId: 'ryan',
    title: 'Week 1 Rent Day Check',
    day: 7,
    lines: [
      {
        id: 'r7_1',
        speaker: 'ryan',
        text: 'hey! Don’t forget Week 1 rent ($140) is due today. Henderson starts knocking on doors around 8 PM.',
      },
      {
        id: 'r7_2',
        speaker: 'ryan',
        text: 'you got enough cash saved up, or do you need me to spot you twenty bucks from the cart till?',
      },
    ],
    choices: [
      {
        id: 'c_r7_good',
        text: 'I budgeted carefully — got the $140 ready to pay through the desk terminal.',
        socialAction: 'work_camaraderie',
        targetKnot: 'ryan_day7_prepared',
        tags: ['# beat:ryan_day7_complete', '# effect:flag:ryan_rent_reminder:true'],
      },
      {
        id: 'c_r7_borrow',
        text: 'It’s a little tight this week, but I think I can make it if I work an extra shift.',
        socialAction: 'vulnerable_share',
        targetKnot: 'ryan_day7_tight',
        tags: ['# beat:ryan_day7_complete', '# effect:flag:ryan_rent_reminder:true'],
      },
    ],
  },
  {
    id: 'ryan_day7_prepared',
    characterId: 'ryan',
    lines: [
      {
        id: 'r7_p1',
        speaker: 'ryan',
        text: 'awesome! Henderson will be happy. One full week down in Room 104!',
        tags: ['# beat:ryan_day7_complete'],
      },
    ],
  },
  {
    id: 'ryan_day7_tight',
    characterId: 'ryan',
    lines: [
      {
        id: 'r7_t1',
        speaker: 'ryan',
        text: 'you got this. Just hit the work button whenever you have energy. We’ll get through it.',
        tags: ['# beat:ryan_day7_complete'],
      },
    ],
  },

  // Day 8
  {
    id: 'ryan_day8',
    characterId: 'ryan',
    title: 'Orion OS 6.0 Transition',
    day: 8,
    lines: [
      {
        id: 'r8_1',
        speaker: 'ryan',
        text: 'happy Week 2! Did you get a chance to check out Orion OS 6.0 yet?',
      },
      {
        id: 'r8_2',
        speaker: 'ryan',
        text: 'the rounded blue taskbar and smooth font smoothing look so modern compared to 4.8.',
      },
    ],
    choices: [
      {
        id: 'c_r8_os6',
        text: 'Yeah, the UI styling is gorgeous, and PhotoBox 3.0 finally launches!',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'ryan_day8_modern',
        tags: ['# beat:ryan_day8_complete'],
      },
      {
        id: 'c_r8_nostalgia',
        text: 'I kind of miss the old gray beveled 90s aesthetic, but the new features are nice.',
        socialAction: 'tease_playful',
        targetKnot: 'ryan_day8_classic',
        tags: ['# beat:ryan_day8_complete'],
      },
    ],
  },
  {
    id: 'ryan_day8_modern',
    characterId: 'ryan',
    lines: [
      {
        id: 'r8_m1',
        speaker: 'ryan',
        text: 'right?! 32-bit color rendering makes Maya’s 35mm photo uploads look ten times sharper.',
        tags: ['# beat:ryan_day8_complete'],
      },
    ],
  },
  {
    id: 'ryan_day8_classic',
    characterId: 'ryan',
    lines: [
      {
        id: 'r8_c1',
        speaker: 'ryan',
        text: 'haha, classic gray will always have a place in our hearts. But OS 6 is the future!',
        tags: ['# beat:ryan_day8_complete'],
      },
    ],
  },

  // Day 9
  {
    id: 'ryan_day9',
    characterId: 'ryan',
    title: 'Long-Term Plans & Town Life',
    day: 9,
    lines: [
      {
        id: 'r9_1',
        speaker: 'ryan',
        text: 'slow evening at the cart today. Got me thinking... how are you liking this town so far?',
      },
      {
        id: 'r9_2',
        speaker: 'ryan',
        text: 'most people just pass through Starlite Motel on their way somewhere else, but you feel like you belong here.',
      },
    ],
    choices: [
      {
        id: 'c_r9_stay',
        text: 'I needed a quiet place to reboot my life. Having good friends like you and Maya makes it feel like home.',
        socialAction: 'vulnerable_share',
        targetKnot: 'ryan_day9_home',
        tags: ['# beat:ryan_day9_complete'],
      },
      {
        id: 'c_r9_dreams',
        text: 'What about you, Ryan? Ever think of opening a full restaurant instead of the cart?',
        socialAction: 'empathy',
        targetKnot: 'ryan_day9_restaurant',
        tags: ['# beat:ryan_day9_complete'],
      },
    ],
  },
  {
    id: 'ryan_day9_home',
    characterId: 'ryan',
    lines: [
      {
        id: 'r9_h1',
        speaker: 'ryan',
        text: 'that means a lot, man. We’re really glad you stayed.',
        tags: ['# beat:ryan_day9_complete'],
      },
    ],
  },
  {
    id: 'ryan_day9_restaurant',
    characterId: 'ryan',
    lines: [
      {
        id: 'r9_r1',
        speaker: 'ryan',
        text: 'someday! Brick-and-mortar near 4th Street with retro arcade machines in the corner. That’s the dream.',
        tags: ['# beat:ryan_day9_complete'],
      },
    ],
  },

  // Day 10
  {
    id: 'ryan_day10',
    characterId: 'ryan',
    title: 'Café Wingman',
    day: 10,
    lines: [
      {
        id: 'r10_1',
        speaker: 'ryan',
        text: 'psst... Maya mentioned she invited you to meet at 4th St Diner tomorrow afternoon!',
      },
      {
        id: 'r10_2',
        speaker: 'ryan',
        text: 'don’t worry about work shifts tomorrow — I will cover the whole lunch and dinner prep so you can go.',
      },
    ],
    choices: [
      {
        id: 'c_r10_nervous',
        text: 'Thanks Ryan. Honestly a little nervous to transition from chat windows to face-to-face.',
        socialAction: 'vulnerable_share',
        targetKnot: 'ryan_day10_encourage',
        tags: ['# beat:ryan_day10_complete'],
      },
      {
        id: 'c_r10_tease',
        text: 'Just make sure you don’t burn the al pastor while I’m sipping coffee!',
        socialAction: 'tease_playful',
        targetKnot: 'ryan_day10_banter',
        tags: ['# beat:ryan_day10_complete'],
      },
    ],
  },
  {
    id: 'ryan_day10_encourage',
    characterId: 'ryan',
    lines: [
      {
        id: 'r10_e1',
        speaker: 'ryan',
        text: 'she’s awesome in person, just as sweet and thoughtful. You two are gonna have a blast.',
        tags: ['# beat:ryan_day10_complete'],
      },
    ],
  },
  {
    id: 'ryan_day10_banter',
    characterId: 'ryan',
    lines: [
      {
        id: 'r10_b1',
        speaker: 'ryan',
        text: 'haha! My culinary honor is spotless. Have fun tomorrow!',
        tags: ['# beat:ryan_day10_complete'],
      },
    ],
  },

  // Day 11
  {
    id: 'ryan_day11',
    characterId: 'ryan',
    title: 'Post-Café Check-In',
    day: 11,
    lines: [
      {
        id: 'r11_1',
        speaker: 'ryan',
        text: 'saw you two sitting by the diner window through the rain! How did the in-person meeting go?',
      },
    ],
    choices: [
      {
        id: 'c_r11_great',
        text: 'It was wonderful. Maya showed me her 35mm photo prints in person. Real connection.',
        socialAction: 'vulnerable_share',
        targetKnot: 'ryan_day11_success',
        tags: ['# beat:ryan_day11_complete'],
      },
      {
        id: 'c_r11_coffee',
        text: 'Diner coffee was steaming hot, rain was pouring, couldn’t have asked for a better afternoon.',
        socialAction: 'work_camaraderie',
        targetKnot: 'ryan_day11_atmosphere',
        tags: ['# beat:ryan_day11_complete'],
      },
    ],
  },
  {
    id: 'ryan_day11_success',
    characterId: 'ryan',
    lines: [
      {
        id: 'r11_s1',
        speaker: 'ryan',
        text: 'that is so cool! Her photography is really special. Happy for you two.',
        tags: ['# beat:ryan_day11_complete'],
      },
    ],
  },
  {
    id: 'ryan_day11_atmosphere',
    characterId: 'ryan',
    lines: [
      {
        id: 'r11_a1',
        speaker: 'ryan',
        text: 'classic Oakhaven weather. Glad you made it out of the room!',
        tags: ['# beat:ryan_day11_complete'],
      },
    ],
  },

  // Day 12
  {
    id: 'ryan_day12',
    characterId: 'ryan',
    title: 'Settling Into the Community',
    day: 12,
    lines: [
      {
        id: 'r12_1',
        speaker: 'ryan',
        text: 'had the funniest customer today at the cart. Some guy tried to pay for four carnitas tacos with a 3.5" floppy disk!',
      },
      {
        id: 'r12_2',
        speaker: 'ryan',
        text: 'said it had proprietary encryption algorithms on it worth thousands haha.',
      },
    ],
    choices: [
      {
        id: 'c_r12_nora',
        text: 'Are you sure that wasn’t one of Nora’s mysterious forum contacts?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'ryan_day12_nora_joke',
        tags: ['# beat:ryan_day12_complete'],
      },
      {
        id: 'c_r12_laugh',
        text: 'Floppy disk economy! Should have traded him a half taco for 1.44 MB of data.',
        socialAction: 'tease_playful',
        targetKnot: 'ryan_day12_floppy_joke',
        tags: ['# beat:ryan_day12_complete'],
      },
    ],
  },
  {
    id: 'ryan_day12_nora_joke',
    characterId: 'ryan',
    lines: [
      {
        id: 'r12_n1',
        speaker: 'ryan',
        text: 'haha right? Nora’s night owls are everywhere in this town.',
        tags: ['# beat:ryan_day12_complete'],
      },
    ],
  },
  {
    id: 'ryan_day12_floppy_joke',
    characterId: 'ryan',
    lines: [
      {
        id: 'r12_f1',
        speaker: 'ryan',
        text: 'lmao! 1 taco per 720KB formatted sector. New currency standard!',
        tags: ['# beat:ryan_day12_complete'],
      },
    ],
  },

  // Day 13
  {
    id: 'ryan_day13',
    characterId: 'ryan',
    title: 'Pre-Evaluation Wrap & GoldNet Warning',
    day: 13,
    lines: [
      {
        id: 'r13_1',
        speaker: 'ryan',
        text: 'can you believe tomorrow is Day 14 already? Two full weeks since you moved into Room 104.',
      },
      {
        id: 'r13_2',
        speaker: 'ryan',
        text: 'also heads up, someone on NightBoard was talking about goldnet.local speculative scams. Don’t gamble your rent money away!',
      },
    ],
    choices: [
      {
        id: 'c_r13_scams',
        text: 'No worries, my rent money stays in my wallet. Ready for Henderson tomorrow.',
        socialAction: 'work_camaraderie',
        targetKnot: 'ryan_day13_solid',
        tags: ['# beat:ryan_day13_complete'],
      },
      {
        id: 'c_r13_time',
        text: 'Time really flew by. Upgraded PC, great memories, and real friendships.',
        socialAction: 'vulnerable_share',
        targetKnot: 'ryan_day13_grateful',
        tags: ['# beat:ryan_day13_complete'],
      },
    ],
  },
  {
    id: 'ryan_day13_solid',
    characterId: 'ryan',
    lines: [
      {
        id: 'r13_s1',
        speaker: 'ryan',
        text: 'smart man. Hard honest work beats sketchy digital gold every time.',
        tags: ['# beat:ryan_day13_complete'],
      },
    ],
  },
  {
    id: 'ryan_day13_grateful',
    characterId: 'ryan',
    lines: [
      {
        id: 'r13_g1',
        speaker: 'ryan',
        text: 'and you built a solid rig too. Proud of how far you’ve come.',
        tags: ['# beat:ryan_day13_complete'],
      },
    ],
  },

  // Day 14
  {
    id: 'ryan_day14',
    characterId: 'ryan',
    title: 'Two-Week Milestone Toast',
    day: 14,
    lines: [
      {
        id: 'r14_1',
        speaker: 'ryan',
        text: 'DAY 14! (party) You officially survived two weeks at Starlite Motel!',
      },
      {
        id: 'r14_2',
        speaker: 'ryan',
        text: 'from a bare desk and noisy phone line to a full workstation and tight-knit crew. Cheers to you, buddy.',
      },
    ],
    choices: [
      {
        id: 'c_r14_toast',
        text: 'Cheers to you too, Ryan! Couldn’t have done it without your shifts and tech advice.',
        socialAction: 'work_camaraderie',
        targetKnot: 'ryan_day14_celebrate',
        tags: ['# beat:ryan_day14_complete', '# effect:flag:ryan_arc_completed:true'],
      },
      {
        id: 'c_r14_future',
        text: 'Here is to the next chapter. Free play mode begins tomorrow!',
        socialAction: 'vulnerable_share',
        targetKnot: 'ryan_day14_future',
        tags: ['# beat:ryan_day14_complete', '# effect:flag:ryan_arc_completed:true'],
      },
    ],
  },
  {
    id: 'ryan_day14_celebrate',
    characterId: 'ryan',
    lines: [
      {
        id: 'r14_c1',
        speaker: 'ryan',
        text: 'anytime! First round of tacos on Day 15 is on me. See you around the canal!',
        tags: ['# beat:ryan_day14_complete', '# effect:flag:ryan_arc_completed:true'],
      },
    ],
  },
  {
    id: 'ryan_day14_future',
    characterId: 'ryan',
    lines: [
      {
        id: 'r14_fu1',
        speaker: 'ryan',
        text: 'hell yeah! We’re just getting started. Keep the pulse going!',
        tags: ['# beat:ryan_day14_complete', '# effect:flag:ryan_arc_completed:true'],
      },
    ],
  },
];

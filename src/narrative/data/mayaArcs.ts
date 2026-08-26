import { StoryKnot } from '../types';

export const MAYA_14DAY_KNOTS: StoryKnot[] = [
  // Day 1
  {
    id: 'maya_day1_greeting',
    characterId: 'maya',
    title: 'Wanderer in Room 104',
    day: 1,
    lines: [
      {
        id: 'm1_1',
        speaker: 'maya',
        text: 'hey wanderer! saw you logged into Pulse from the motel DSL :)',
      },
      {
        id: 'm1_2',
        speaker: 'maya',
        text: 'did you settle into Room 104 okay? how is the copper line holding up over there?',
      },
    ],
    choices: [
      {
        id: 'c_m1_warm',
        text: 'Hey Maya! Yeah, just got unpacked. The copper line here is surprisingly fast.',
        socialAction: 'empathy',
        targetKnot: 'maya_day1_fast',
        tags: ['# beat:maya_day1_complete', '# social:maya:empathy'],
      },
      {
        id: 'c_m1_curious',
        text: 'Settled in fine. The rain outside is intense, but the neon sign is right outside my window.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day1_neon',
        tags: ['# beat:maya_day1_complete', '# social:maya:vulnerable_share'],
      },
      {
        id: 'c_m1_dry',
        text: 'Just testing the connection. Lots of noise on the phone line.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'maya_day1_noise',
        tags: ['# beat:maya_day1_complete', '# social:maya:intellectual_curiosity'],
      },
    ],
  },
  {
    id: 'maya_day1_fast',
    characterId: 'maya',
    lines: [
      {
        id: 'm1_f1',
        speaker: 'maya',
        text: 'haha yeah! Mr. Henderson patched the junction box last month. Glad it works!',
      },
      {
        id: 'm1_f2',
        speaker: 'maya',
        text: 'im working the late shift at 4th St Diner tonight. Come by later if you want coffee or fries! (C)',
        tags: ['# beat:maya_day1_complete'],
      },
    ],
  },
  {
    id: 'maya_day1_neon',
    characterId: 'maya',
    lines: [
      {
        id: 'm1_n1',
        speaker: 'maya',
        text: 'oh i LOVE that neon sign! (:camera:) I took a bunch of 35mm exposures of the reflection in the puddles.',
      },
      {
        id: 'm1_n2',
        speaker: 'maya',
        text: 'uploaded them to myplace.local/maya_x if you wanna see them. Stay warm!',
        tags: ['# beat:maya_day1_complete'],
      },
    ],
  },
  {
    id: 'maya_day1_noise',
    characterId: 'maya',
    lines: [
      {
        id: 'm1_no1',
        speaker: 'maya',
        text: 'yeah, the copper wires run right under the canal bridge. Nora said there is some strange frequency hum on it at night.',
      },
      {
        id: 'm1_no2',
        speaker: 'maya',
        text: 'check NightBoard thread #104 if you like solving local mysteries. Talk to you soon!',
        tags: ['# beat:maya_day1_complete'],
      },
    ],
  },

  // Day 2
  {
    id: 'maya_day2',
    characterId: 'maya',
    title: '35mm Film & Darkroom Memories',
    day: 2,
    lines: [
      {
        id: 'm2_1',
        speaker: 'maya',
        text: 'just finished developing three rolls of Tri-X 400 black and white film in my bathroom darkroom.',
      },
      {
        id: 'm2_2',
        speaker: 'maya',
        text: 'the smell of fixer chemical takes forever to clear out haha. Do you ever take photos?',
      },
    ],
    choices: [
      {
        id: 'c_m2_darkroom',
        text: 'Film developing is such a tactile art. Watching an image appear in the developer bath is pure magic.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'maya_day2_magic',
        tags: ['# beat:maya_day2_complete', '# social:maya:intellectual_curiosity'],
      },
      {
        id: 'c_m2_comfort',
        text: 'Make sure you keep the window cracked for ventilation! Don’t breathe in too much fixer.',
        socialAction: 'empathy',
        targetKnot: 'maya_day2_caring',
        tags: ['# beat:maya_day2_complete', '# social:maya:empathy'],
      },
    ],
  },
  {
    id: 'maya_day2_magic',
    characterId: 'maya',
    lines: [
      {
        id: 'm2_m1',
        speaker: 'maya',
        text: 'yes!! That exact moment under the amber safelight is why I fell in love with photography.',
        tags: ['# beat:maya_day2_complete'],
      },
    ],
  },
  {
    id: 'maya_day2_caring',
    characterId: 'maya',
    lines: [
      {
        id: 'm2_c1',
        speaker: 'maya',
        text: 'aw thank you for looking out for me :) Window is wide open to the rain now.',
        tags: ['# beat:maya_day2_complete'],
      },
    ],
  },

  // Day 3
  {
    id: 'maya_day3',
    characterId: 'maya',
    title: 'Midnight Playlists & Rainy Solitude',
    day: 3,
    lines: [
      {
        id: 'm3_1',
        speaker: 'maya',
        text: 'late night again... listening to ambient synth loops on RetroAmp while rain taps on the glass.',
      },
      {
        id: 'm3_2',
        speaker: 'maya',
        text: 'sometimes late at night it feels like everyone in the world is asleep except for a few glowing monitors.',
      },
    ],
    choices: [
      {
        id: 'c_m3_vulnerable',
        text: 'I know that exact feeling. The internet feels quiet and intimate after midnight, like whispered secrets across the wires.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day3_intimate',
        tags: ['# beat:maya_day3_complete', '# social:maya:vulnerable_share'],
      },
      {
        id: 'c_m3_music',
        text: 'What track is playing on RetroAmp right now? I will look it up on PeerBox.',
        socialAction: 'empathy',
        targetKnot: 'maya_day3_tracks',
        tags: ['# beat:maya_day3_complete', '# social:maya:empathy'],
      },
    ],
  },
  {
    id: 'maya_day3_intimate',
    characterId: 'maya',
    lines: [
      {
        id: 'm3_i1',
        speaker: 'maya',
        text: 'you describe that so poetically... it makes me really glad we met on here.',
        tags: ['# beat:maya_day3_complete'],
      },
    ],
  },
  {
    id: 'maya_day3_tracks',
    characterId: 'maya',
    lines: [
      {
        id: 'm3_t1',
        speaker: 'maya',
        text: 'an old Boards of Canada demo track. I can send the file over if you like vintage tape textures!',
        tags: ['# beat:maya_day3_complete'],
      },
    ],
  },

  // Day 4
  {
    id: 'maya_day4',
    characterId: 'maya',
    title: 'Art School Dreams & New Beginnings',
    day: 4,
    lines: [
      {
        id: 'm4_1',
        speaker: 'maya',
        text: 'can I ask you something personal? What brought you to Starlite Motel and this town?',
      },
      {
        id: 'm4_2',
        speaker: 'maya',
        text: 'I’ve been saving up diner tips to apply to photography programs in the city next year, but sometimes I feel stuck.',
      },
    ],
    choices: [
      {
        id: 'c_m4_reboot',
        text: 'I needed a fresh start away from old expectations. Just a quiet room, a PC, and space to figure out who I want to be.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day4_reboot_reply',
        tags: ['# beat:maya_day4_complete', '# social:maya:vulnerable_share'],
      },
      {
        id: 'c_m4_support',
        text: 'Your photography is incredible, Maya. You definitely have the talent for art school. Don’t lose faith in yourself.',
        socialAction: 'empathy',
        targetKnot: 'maya_day4_support_reply',
        tags: ['# beat:maya_day4_complete', '# social:maya:empathy'],
      },
    ],
  },
  {
    id: 'maya_day4_reboot_reply',
    characterId: 'maya',
    lines: [
      {
        id: 'm4_rb1',
        speaker: 'maya',
        text: 'that takes a lot of courage. It makes me feel less alone knowing someone else is rebuilding too.',
        tags: ['# beat:maya_day4_complete'],
      },
    ],
  },
  {
    id: 'maya_day4_support_reply',
    characterId: 'maya',
    lines: [
      {
        id: 'm4_sp1',
        speaker: 'maya',
        text: 'hearing you say that really means the world to me. Thank you so much :’)',
        tags: ['# beat:maya_day4_complete'],
      },
    ],
  },

  // Day 5
  {
    id: 'maya_day5',
    characterId: 'maya',
    title: 'Exhaustion at the 4th St Diner',
    day: 5,
    lines: [
      {
        id: 'm5_1',
        speaker: 'maya',
        text: 'exhausted today... someone spilled a full pot of coffee all over booth 4 right during lunch rush.',
      },
      {
        id: 'm5_2',
        speaker: 'maya',
        text: 'feet hurt, hands smell like grease, and my manager complained about table turnover speed :(',
      },
    ],
    choices: [
      {
        id: 'c_m5_empathy',
        text: 'That sounds like a brutal shift. Put your feet up, put on some calming music, and let yourself rest.',
        socialAction: 'empathy',
        targetKnot: 'maya_day5_rest',
        tags: ['# beat:maya_day5_complete', '# social:maya:empathy'],
      },
      {
        id: 'c_m5_tease',
        text: 'At least coffee smells better than hot grease! I’ll bring you some al pastor tacos from Ryan’s cart if you want.',
        socialAction: 'tease_playful',
        targetKnot: 'maya_day5_tacos',
        tags: ['# beat:maya_day5_complete', '# social:maya:tease_playful'],
      },
      {
        id: 'c_m5_dismiss',
        text: 'That’s just retail work. Everyone deals with messy customers.',
        socialAction: 'dismissive',
        targetKnot: 'maya_day5_cold',
        tags: ['# beat:maya_day5_complete', '# social:maya:dismissive'],
      },
    ],
  },
  {
    id: 'maya_day5_rest',
    characterId: 'maya',
    lines: [
      {
        id: 'm5_r1',
        speaker: 'maya',
        text: 'making chamomile tea right now. Talking to you always lowers my stress :)',
        tags: ['# beat:maya_day5_complete'],
      },
    ],
  },
  {
    id: 'maya_day5_tacos',
    characterId: 'maya',
    lines: [
      {
        id: 'm5_t1',
        speaker: 'maya',
        text: 'haha omg yes please! Ryan makes the best salsa. You’re the sweetest.',
        tags: ['# beat:maya_day5_complete'],
      },
    ],
  },
  {
    id: 'maya_day5_cold',
    characterId: 'maya',
    lines: [
      {
        id: 'm5_c1',
        speaker: 'maya',
        text: '...I guess so. Sorry for complaining.',
        tags: ['# beat:maya_day5_complete'],
      },
    ],
  },

  // Day 6
  {
    id: 'maya_day6',
    characterId: 'maya',
    title: 'Rainy Neon Photography Gift',
    day: 6,
    lines: [
      {
        id: 'm6_1',
        speaker: 'maya',
        text: 'i scanned that 35mm photo of the Starlite neon reflection in the rain puddles!',
      },
      {
        id: 'm6_2',
        speaker: 'maya',
        text: 'i attached `maya_rain_neon.jpg` to an email and sent it to your Mailbox app. Hope you like it (:camera:)',
      },
    ],
    choices: [
      {
        id: 'c_m6_detail',
        text: 'I just opened it in PhotoBox — the film grain and color saturation on the neon tube reflection are stunning.',
        socialAction: 'remembered_detail',
        targetKnot: 'maya_day6_praise',
        tags: [
          '# beat:maya_day6_complete',
          '# effect:flag:maya_shared_photo:true',
          '# effect:file:create:C:/Downloads/maya_rain_neon.jpg:image',
          '# social:maya:remembered_detail',
        ],
      },
      {
        id: 'c_m6_technical',
        text: 'What shutter speed and aperture did you use to catch the reflections without blurring the rain drops?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'maya_day6_shutter',
        tags: [
          '# beat:maya_day6_complete',
          '# effect:flag:maya_shared_photo:true',
          '# effect:file:create:C:/Downloads/maya_rain_neon.jpg:image',
          '# social:maya:intellectual_curiosity',
        ],
      },
    ],
  },
  {
    id: 'maya_day6_praise',
    characterId: 'maya',
    lines: [
      {
        id: 'm6_p1',
        speaker: 'maya',
        text: 'yay!! I was so nervous you’d think it was amateurish. You just made my entire weekend!',
        tags: ['# beat:maya_day6_complete'],
      },
    ],
  },
  {
    id: 'maya_day6_shutter',
    characterId: 'maya',
    lines: [
      {
        id: 'm6_s1',
        speaker: 'maya',
        text: '1/30s at f/2.0 with a 50mm prime lens resting steady on the window sill! You really know your photography!',
        tags: ['# beat:maya_day6_complete'],
      },
    ],
  },

  // Day 7
  {
    id: 'maya_day7',
    characterId: 'maya',
    title: 'Rent Day Shared Realities',
    day: 7,
    lines: [
      {
        id: 'm7_1',
        speaker: 'maya',
        text: 'first week down! Henderson just came around collecting rent checks.',
      },
      {
        id: 'm7_2',
        speaker: 'maya',
        text: 'it is hard balancing creative dreams with everyday bills, but making it through Week 1 feels like a real achievement.',
      },
    ],
    choices: [
      {
        id: 'c_m7_budget',
        text: 'It really is. We’re both making it work, one day at a time.',
        socialAction: 'empathy',
        targetKnot: 'maya_day7_progress',
        tags: ['# beat:maya_day7_complete', '# social:maya:empathy'],
      },
      {
        id: 'c_m7_camaraderie',
        text: 'Surviving Week 1 with our bills paid and our sanity intact calls for a mini celebration!',
        socialAction: 'work_camaraderie',
        targetKnot: 'maya_day7_celebrate',
        tags: ['# beat:maya_day7_complete', '# social:maya:work_camaraderie'],
      },
    ],
  },
  {
    id: 'maya_day7_progress',
    characterId: 'maya',
    lines: [
      {
        id: 'm7_pr1',
        speaker: 'maya',
        text: 'one day at a time. I really value our nightly conversations.',
        tags: ['# beat:maya_day7_complete'],
      },
    ],
  },
  {
    id: 'maya_day7_celebrate',
    characterId: 'maya',
    lines: [
      {
        id: 'm7_cb1',
        speaker: 'maya',
        text: 'definitely! Virtual high five across the dialup lines (Y)',
        tags: ['# beat:maya_day7_complete'],
      },
    ],
  },

  // Day 8
  {
    id: 'maya_day8',
    characterId: 'maya',
    title: 'High-Res Photo Viewing on OS 6',
    day: 8,
    lines: [
      {
        id: 'm8_1',
        speaker: 'maya',
        text: 'did Ryan help you upgrade to Orion OS 6.0 yet?',
      },
      {
        id: 'm8_2',
        speaker: 'maya',
        text: 'PhotoBox 3.0 has a full color management engine that renders 24-bit JPEG scans without banding artifacts.',
      },
    ],
    choices: [
      {
        id: 'c_m8_photobox',
        text: 'Yes! PhotoBox 3.0 runs beautifully on OS 6 now. Your photos look so rich.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'maya_day8_photobox_reply',
        tags: ['# beat:maya_day8_complete', '# social:maya:intellectual_curiosity'],
      },
      {
        id: 'c_m8_tease',
        text: 'All this hardware horsepower just to stare at your rainy street photos! Worth every megabyte.',
        socialAction: 'tease_playful',
        targetKnot: 'maya_day8_tease_reply',
        tags: ['# beat:maya_day8_complete', '# social:maya:tease_playful'],
      },
    ],
  },
  {
    id: 'maya_day8_photobox_reply',
    characterId: 'maya',
    lines: [
      {
        id: 'm8_p1',
        speaker: 'maya',
        text: 'that makes me so happy! I have a whole new series of print exposures I want to show you.',
        tags: ['# beat:maya_day8_complete'],
      },
    ],
  },
  {
    id: 'maya_day8_tease_reply',
    characterId: 'maya',
    lines: [
      {
        id: 'm8_t1',
        speaker: 'maya',
        text: 'haha omg don’t flatter me too much! But really, thank you.',
        tags: ['# beat:maya_day8_complete'],
      },
    ],
  },

  // Day 9
  {
    id: 'maya_day9',
    characterId: 'maya',
    title: 'Vulnerability & Fallen Leaves',
    day: 9,
    lines: [
      {
        id: 'm9_1',
        speaker: 'maya',
        text: 'can I tell you something I haven’t told anyone else in town?',
      },
      {
        id: 'm9_2',
        speaker: 'maya',
        text: 'before I moved here, I had a falling out with my closest friend from high school. We stopped speaking overnight, and it left a quiet hole in my life.',
      },
    ],
    choices: [
      {
        id: 'c_m9_open',
        text: 'Losing someone without closure hurts deeper than most people realize. I have carried similar quiet aches. Thank you for trusting me with that, Maya.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day9_intimacy',
        tags: [
          '# beat:maya_day9_complete',
          '# effect:flag:maya_vulnerability_unlocked:true',
          '# social:maya:vulnerable_share',
        ],
      },
      {
        id: 'c_m9_comfort',
        text: 'You have such a kind, gentle heart, Maya. Anyone who walked away from that missed out on a wonderful soul.',
        socialAction: 'empathy',
        targetKnot: 'maya_day9_gentle',
        tags: [
          '# beat:maya_day9_complete',
          '# effect:flag:maya_vulnerability_unlocked:true',
          '# social:maya:empathy',
        ],
      },
    ],
  },
  {
    id: 'maya_day9_intimacy',
    characterId: 'maya',
    lines: [
      {
        id: 'm9_i1',
        speaker: 'maya',
        text: 'i felt a tear roll down my cheek reading that... I feel like you understand me in a way few people ever have.',
        tags: ['# beat:maya_day9_complete'],
      },
    ],
  },
  {
    id: 'maya_day9_gentle',
    characterId: 'maya',
    lines: [
      {
        id: 'm9_g1',
        speaker: 'maya',
        text: 'thank you... you always know the exact right words to say.',
        tags: ['# beat:maya_day9_complete'],
      },
    ],
  },

  // Day 10
  {
    id: 'maya_day10',
    characterId: 'maya',
    title: 'The In-Person Invitation',
    day: 10,
    lines: [
      {
        id: 'm10_1',
        speaker: 'maya',
        text: 'so... I was thinking. We’ve been chatting on Pulse every night for ten days straight.',
      },
      {
        id: 'm10_2',
        speaker: 'maya',
        text: 'would you like to meet in person tomorrow afternoon? I have a table reserved by the corner window at 4th St Diner around 3:00 PM (15:00). I can bring my physical 35mm portfolio!',
      },
    ],
    choices: [
      {
        id: 'c_m10_yes',
        text: 'I would love that more than anything, Maya. 3:00 PM at 4th St Diner — I’ll be there.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day10_accept',
        tags: [
          '# beat:maya_day10_complete',
          '# schedule:appointment:maya_cafe:11:900:960:cafe:Coffee with Maya',
          '# effect:flag:maya_cafe_scheduled:true',
          '# social:maya:vulnerable_share',
        ],
      },
      {
        id: 'c_m10_playful',
        text: 'Only if you promise to sign one of your photo prints for me! See you tomorrow at 3:00 PM.',
        socialAction: 'tease_playful',
        targetKnot: 'maya_day10_playful_accept',
        tags: [
          '# beat:maya_day10_complete',
          '# schedule:appointment:maya_cafe:11:900:960:cafe:Coffee with Maya',
          '# effect:flag:maya_cafe_scheduled:true',
          '# social:maya:tease_playful',
        ],
      },
    ],
  },
  {
    id: 'maya_day10_accept',
    characterId: 'maya',
    lines: [
      {
        id: 'm10_a1',
        speaker: 'maya',
        text: 'yay!! (heart) I’m so excited. Look for the girl in the dark green wool coat by the window booth!',
        tags: ['# beat:maya_day10_complete'],
      },
    ],
  },
  {
    id: 'maya_day10_playful_accept',
    characterId: 'maya',
    lines: [
      {
        id: 'm10_pa1',
        speaker: 'maya',
        text: 'haha deal! I will bring silver archival ink. See you tomorrow at 3:00 PM!',
        tags: ['# beat:maya_day10_complete'],
      },
    ],
  },

  // Day 11 (Post-Café Check-In)
  {
    id: 'maya_day11_post',
    characterId: 'maya',
    title: 'After the Café Rain',
    day: 11,
    lines: [
      {
        id: 'm11_1',
        speaker: 'maya',
        text: 'just got home and hung up my damp coat :)',
      },
      {
        id: 'm11_2',
        speaker: 'maya',
        text: 'it was so surreal hearing your actual voice in person after reading your typed words for so long. It felt like no time had passed at all.',
      },
    ],
    choices: [
      {
        id: 'c_m11_warmth',
        text: 'Seeing you smile across the table made everything in this town feel real and warm. That was the best coffee I’ve had in years.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day11_tender',
        tags: ['# beat:maya_day11_complete', '# social:maya:vulnerable_share'],
      },
      {
        id: 'c_m11_prints',
        text: 'Holding your physical 35mm prints gave me chills. You have a true gift, Maya.',
        socialAction: 'remembered_detail',
        targetKnot: 'maya_day11_admire',
        tags: ['# beat:maya_day11_complete', '# social:maya:remembered_detail'],
      },
    ],
  },
  {
    id: 'maya_day11_tender',
    characterId: 'maya',
    lines: [
      {
        id: 'm11_t1',
        speaker: 'maya',
        text: 'my heart was beating so fast when you walked through the door. Thank you for coming today.',
        tags: ['# beat:maya_day11_complete'],
      },
    ],
  },
  {
    id: 'maya_day11_admire',
    characterId: 'maya',
    lines: [
      {
        id: 'm11_ad1',
        speaker: 'maya',
        text: 'having someone who truly appreciates my vision makes all the long darkroom hours worth it.',
        tags: ['# beat:maya_day11_complete'],
      },
    ],
  },

  // Day 12
  {
    id: 'maya_day12',
    characterId: 'maya',
    title: 'The Window Seat Away Message',
    day: 12,
    lines: [
      {
        id: 'm12_1',
        speaker: 'maya',
        text: 'did you notice my new away message on Pulse today?',
      },
      {
        id: 'm12_2',
        speaker: 'maya',
        text: '"watching rain from the corner booth ~ 35mm silver prints & warm coffee"',
      },
    ],
    choices: [
      {
        id: 'c_m12_smile',
        text: 'I saw it the moment I logged in. It made me smile at my desk.',
        socialAction: 'remembered_detail',
        targetKnot: 'maya_day12_sweet',
        tags: [
          '# beat:maya_day12_complete',
          '# effect:flag:maya_post_meeting_active:true',
          '# social:maya:remembered_detail',
        ],
      },
      {
        id: 'c_m12_deepen',
        text: 'It feels like our shared secret now. A bridge between the digital screen and the physical world.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day12_intimacy',
        tags: [
          '# beat:maya_day12_complete',
          '# effect:flag:maya_post_meeting_active:true',
          '# social:maya:vulnerable_share',
        ],
      },
    ],
  },
  {
    id: 'maya_day12_sweet',
    characterId: 'maya',
    lines: [
      {
        id: 'm12_s1',
        speaker: 'maya',
        text: 'i hoped you would see it :)',
        tags: ['# beat:maya_day12_complete'],
      },
    ],
  },
  {
    id: 'maya_day12_intimacy',
    characterId: 'maya',
    lines: [
      {
        id: 'm12_i1',
        speaker: 'maya',
        text: 'a bridge between two worlds... yes. That’s exactly what this is.',
        tags: ['# beat:maya_day12_complete'],
      },
    ],
  },

  // Day 13
  {
    id: 'maya_day13',
    characterId: 'maya',
    title: 'Archived Web & Digital Footprints',
    day: 13,
    lines: [
      {
        id: 'm13_1',
        speaker: 'maya',
        text: 'Nora sent me a link to an archived 2003 personal blog on myplace.local earlier.',
      },
      {
        id: 'm13_2',
        speaker: 'maya',
        text: 'the author lived in Room 104 three years ago and wrote about the canal acoustics. It’s strange how places hold memories across strangers.',
      },
    ],
    choices: [
      {
        id: 'c_m13_lore',
        text: 'Every room is a layered tapestry of people seeking quiet transitions. Now it’s our chapter in the story.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'maya_day13_chapter',
        tags: ['# beat:maya_day13_complete', '# social:maya:intellectual_curiosity'],
      },
      {
        id: 'c_m13_grateful',
        text: 'I’m just glad our paths crossed in this chapter. It turned an ordinary motel room into something unforgettable.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day13_grateful_reply',
        tags: ['# beat:maya_day13_complete', '# social:maya:vulnerable_share'],
      },
    ],
  },
  {
    id: 'maya_day13_chapter',
    characterId: 'maya',
    lines: [
      {
        id: 'm13_ch1',
        speaker: 'maya',
        text: 'our chapter... I like the sound of that. A lot.',
        tags: ['# beat:maya_day13_complete'],
      },
    ],
  },
  {
    id: 'maya_day13_grateful_reply',
    characterId: 'maya',
    lines: [
      {
        id: 'm13_gr1',
        speaker: 'maya',
        text: 'you turned this whole town into something unforgettable for me too.',
        tags: ['# beat:maya_day13_complete'],
      },
    ],
  },

  // Day 14
  {
    id: 'maya_day14',
    characterId: 'maya',
    title: 'Two-Week Evaluation Climax',
    day: 14,
    lines: [
      {
        id: 'm14_1',
        speaker: 'maya',
        text: 'fourteen days, wanderer... two whole weeks.',
      },
      {
        id: 'm14_2',
        speaker: 'maya',
        text: 'when you first logged in on Day 1, I thought you were just another passing traveler. But you became my anchor.',
      },
    ],
    choices: [
      {
        id: 'c_m14_love',
        text: 'You gave me a reason to look forward to every single evening, Maya. This isn’t the end — it’s just the foundation.',
        socialAction: 'vulnerable_share',
        targetKnot: 'maya_day14_forever',
        tags: [
          '# beat:maya_day14_complete',
          '# effect:flag:maya_arc_completed:true',
          '# social:maya:vulnerable_share',
        ],
      },
      {
        id: 'c_m14_promise',
        text: 'Thank you for opening up your world and your art to me. I promise to keep chatting with you every night.',
        socialAction: 'empathy',
        targetKnot: 'maya_day14_promise_reply',
        tags: [
          '# beat:maya_day14_complete',
          '# effect:flag:maya_arc_completed:true',
          '# social:maya:empathy',
        ],
      },
    ],
  },
  {
    id: 'maya_day14_forever',
    characterId: 'maya',
    lines: [
      {
        id: 'm14_f1',
        speaker: 'maya',
        text: 'just the foundation. Here’s to many more late nights, neon reflections, and quiet rainy days together (heart)',
        tags: ['# beat:maya_day14_complete', '# effect:flag:maya_arc_completed:true'],
      },
    ],
  },
  {
    id: 'maya_day14_promise_reply',
    characterId: 'maya',
    lines: [
      {
        id: 'm14_pr1',
        speaker: 'maya',
        text: 'i’ll hold you to that promise :) Sweet dreams, my favorite wanderer.',
        tags: ['# beat:maya_day14_complete', '# effect:flag:maya_arc_completed:true'],
      },
    ],
  },
];

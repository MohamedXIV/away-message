import { StoryKnot } from '../types';

export const CAFE_MEETING_KNOTS: StoryKnot[] = [
  {
    id: 'cafe_scene_start',
    characterId: 'maya',
    title: '4th St Diner In-Person Meeting: Screen Barrier',
    lines: [
      {
        id: 'cs_1',
        speaker: 'maya',
        text: '(Maya sits in the corner window booth wearing a dark green wool coat. She looks up and waves with a shy, warm smile.)',
      },
      {
        id: 'cs_2',
        speaker: 'maya',
        text: 'You made it! It is... so surreal seeing you in three dimensions instead of a little blue Pulse buddy icon.',
      },
    ],
    choices: [
      {
        id: 'c_cs_smile',
        text: 'It really is. Hearing your real voice is so much warmer than text on a screen.',
        socialAction: 'vulnerable_share',
        targetKnot: 'cafe_scene_ordering',
        tags: ['# social:maya:vulnerable_share'],
      },
      {
        id: 'c_cs_tease',
        text: 'I was almost expecting typing indicators to hover above your head before you spoke!',
        socialAction: 'tease_playful',
        targetKnot: 'cafe_scene_ordering',
        tags: ['# social:maya:tease_playful'],
      },
    ],
  },
  {
    id: 'cafe_scene_ordering',
    characterId: 'maya',
    title: 'Hot Coffee & Steaming Rain',
    lines: [
      {
        id: 'cs_ord1',
        speaker: 'maya',
        text: '(The waitress drops off two steaming mugs of black diner coffee and a small plate of cinnamon toast.)',
        tags: ['# effect:money:spend:4:bought_coffee'],
      },
      {
        id: 'cs_ord2',
        speaker: 'maya',
        text: 'I ordered the house blend for us. Look at the rain streaking down the glass outside... this is my favorite booth in the entire town.',
      },
    ],
    choices: [
      {
        id: 'c_cs_savor',
        text: 'Holding a hot ceramic mug while watching the rain... this is perfect.',
        socialAction: 'empathy',
        targetKnot: 'cafe_scene_portfolio',
        tags: ['# social:maya:empathy'],
      },
      {
        id: 'c_cs_memory',
        text: 'Is this the same booth where you developed your concept for the neon puddle reflections?',
        socialAction: 'remembered_detail',
        targetKnot: 'cafe_scene_portfolio',
        tags: ['# social:maya:remembered_detail'],
      },
    ],
  },
  {
    id: 'cafe_scene_portfolio',
    characterId: 'maya',
    title: '35mm Darkroom Silver Prints',
    lines: [
      {
        id: 'cs_port1',
        speaker: 'maya',
        text: '(Maya reaches into her messenger bag and places a black archival portfolio folder onto the table.)',
      },
      {
        id: 'cs_port2',
        speaker: 'maya',
        text: 'Here they are. Real 8x10 fiber silver gelatin prints. You can see the actual silver grain in the shadows of the Starlite Motel sign.',
      },
    ],
    choices: [
      {
        id: 'c_cs_admire_grain',
        text: 'The tonal depth here is breathtaking. You captured the quiet melancholy of 3:00 AM so perfectly.',
        socialAction: 'remembered_detail',
        targetKnot: 'cafe_scene_questions',
        tags: ['# social:maya:remembered_detail'],
      },
      {
        id: 'c_cs_technical_print',
        text: 'How did you achieve such crisp contrast between the neon filament and the rain puddles?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'cafe_scene_questions',
        tags: ['# social:maya:intellectual_curiosity'],
      },
    ],
  },
  {
    id: 'cafe_scene_questions',
    characterId: 'maya',
    title: 'Personal Turning Point',
    lines: [
      {
        id: 'cs_q1',
        speaker: 'maya',
        text: '(Maya places her hands around her warm mug, looking into your eyes with genuine curiosity.)',
      },
      {
        id: 'cs_q2',
        speaker: 'maya',
        text: 'When we talk on Pulse, I feel like you really see me. What is it that you’re looking for in this town, honestly?',
      },
    ],
    choices: [
      {
        id: 'c_cs_fresh_start',
        text: 'A clean slate. A quiet place where I can heal, rebuild my independence, and figure out my own path.',
        socialAction: 'vulnerable_share',
        targetKnot: 'cafe_scene_parting',
        tags: ['# social:maya:vulnerable_share'],
      },
      {
        id: 'c_cs_connection',
        text: 'Real human connection. I was adrift until our conversations gave every evening a purpose.',
        socialAction: 'vulnerable_share',
        targetKnot: 'cafe_scene_parting',
        tags: ['# social:maya:vulnerable_share'],
      },
      {
        id: 'c_cs_quiet_life',
        text: 'Just simple honesty, good friends, and the freedom to create something meaningful on my computer.',
        socialAction: 'work_camaraderie',
        targetKnot: 'cafe_scene_parting',
        tags: ['# social:maya:work_camaraderie'],
      },
    ],
  },
  {
    id: 'cafe_scene_parting',
    characterId: 'maya',
    title: 'Parting in the Afternoon Drizzle',
    lines: [
      {
        id: 'cs_part1',
        speaker: 'maya',
        text: '(Maya smiles gently, her eyes shining with warmth. She wraps her dark green coat and zips it up.)',
      },
      {
        id: 'cs_part2',
        speaker: 'maya',
        text: 'Thank you for being so honest with me. Meeting you in person made everything feel complete. I’ll message you on Pulse as soon as I get home tonight!',
        tags: [
          '# beat:cafe_meeting_complete',
          '# effect:flag:cafe_meeting_attended:true',
          '# effect:view:switch:room',
          '# social:maya:vulnerable_share',
        ],
      },
    ],
  },
];

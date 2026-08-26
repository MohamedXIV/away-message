import { StoryKnot } from '../types';

export const EVALUATION_ENDING_KNOTS: StoryKnot[] = [
  {
    id: 'evaluation_day14_conclusion',
    characterId: 'system',
    title: '14-Day Evaluation Milestone Climax',
    day: 14,
    lines: [
      {
        id: 'eval_1',
        speaker: 'system',
        text: '=== FOURTEEN-DAY EVALUATION COMPLETE ===',
      },
      {
        id: 'eval_2',
        speaker: 'system',
        text: 'You have successfully navigated the first 14 days at Starlite Motel, balancing finances, PC hardware upgrades, digital mysteries, and authentic human connections.',
        tags: [
          '# beat:evaluation_complete',
          '# effect:flag:evaluation_complete:true',
          '# effect:flag:free_play_unlocked:true',
        ],
      },
    ],
    choices: [
      {
        id: 'c_eval_freeplay',
        text: 'Continue in Free Play Mode (Day 15+)',
        socialAction: 'work_camaraderie',
        targetKnot: 'evaluation_freeplay_started',
        tags: ['# effect:flag:free_play_active:true'],
      },
    ],
  },
  {
    id: 'evaluation_freeplay_started',
    characterId: 'system',
    lines: [
      {
        id: 'eval_fp1',
        speaker: 'system',
        text: 'Free Play Mode active. You may now continue exploring websites, chatting with contacts, downloading software, and living in Room 104 indefinitely.',
      },
    ],
  },
];

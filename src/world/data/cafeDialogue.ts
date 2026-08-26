// src/world/data/cafeDialogue.ts

import { CafeDialogueBeat } from '../types';

export const CAFE_DIALOGUE_BEATS: Record<string, CafeDialogueBeat> = {
  intro: {
    id: 'intro',
    speaker: 'Maya',
    expression: 'smile',
    text: 'Hey! You made it! It\'s... honestly so strange seeing you outside of that little orange Pulse chat box. But in a really good way.',
    choices: [
      {
        id: 'greet_warm',
        text: 'It\'s great to meet you in person, Maya. You look exactly like your avatar sketch.',
        nextBeatId: 'beat_drinks',
        socialTag: 'empathy',
        socialActionName: 'maya_warm_greeting',
        comfortDelta: 3,
        familiarityDelta: 2,
        mayaReactionExpression: 'shy',
      },
      {
        id: 'greet_humor',
        text: 'No lag, no typing indicators... it\'s like high-bandwidth conversation.',
        nextBeatId: 'beat_drinks',
        socialTag: 'tease_playful',
        socialActionName: 'maya_playful_greeting',
        comfortDelta: 2,
        familiarityDelta: 2,
        mayaReactionExpression: 'smile',
      },
    ],
  },

  beat_drinks: {
    id: 'beat_drinks',
    speaker: 'Maya',
    expression: 'neutral',
    text: 'I already grabbed a booth by the radiator. The coffee here has this dark, chocolatey roast that actually keeps you awake. How has your week in the city been treating you so far?',
    choices: [
      {
        id: 'city_busy',
        text: 'Working the food cart shifts and tweaking my PC. It\'s noisy, but it feels alive.',
        nextBeatId: 'beat_maya_job',
        comfortDelta: 2,
        familiarityDelta: 2,
        mayaReactionExpression: 'smile',
      },
      {
        id: 'city_solitary',
        text: 'Honestly, spending a lot of nights staring at dial-up progress bars in that motel room.',
        nextBeatId: 'beat_maya_job',
        comfortDelta: 3,
        trustDelta: 2,
        mayaReactionExpression: 'thoughtful',
      },
    ],
  },

  beat_maya_job: {
    id: 'beat_maya_job',
    speaker: 'Maya',
    expression: 'thoughtful',
    text: 'I know what you mean about the noise. My agency has me laying out magazine spreads twelve hours a day. Half the time I feel like I\'m just pushing pixels around until my eyes blur, wondering why I packed two suitcases and moved here in the first place.',
    choices: [
      {
        id: 'support_courage',
        text: 'Moving to a new city alone takes serious guts. The work is exhausting now, but you\'re building something real.',
        nextBeatId: 'beat_interests',
        socialTag: 'empathy',
        socialActionName: 'maya_supportive_encouragement',
        trustDelta: 4,
        comfortDelta: 4,
        familiarityDelta: 2,
        mayaReactionExpression: 'shy',
      },
      {
        id: 'recall_portfolio',
        text: 'Is this about that typography spread you stayed up until 4 AM refining the other night on Pulse?',
        nextBeatId: 'beat_interests',
        socialTag: 'remembered_detail',
        socialActionName: 'maya_remember_detail',
        trustDelta: 4,
        comfortDelta: 3,
        familiarityDelta: 4,
        mayaReactionExpression: 'surprised',
      },
      {
        id: 'lighthearted_distraction',
        text: 'Well, on the bright side, your taste in late-night music downloads is impeccable.',
        nextBeatId: 'beat_interests',
        socialTag: 'tease_playful',
        socialActionName: 'maya_music_compliment',
        trustDelta: 2,
        comfortDelta: 4,
        familiarityDelta: 3,
        mayaReactionExpression: 'smile',
      },
    ],
  },

  beat_interests: {
    id: 'beat_interests',
    speaker: 'Maya',
    expression: 'smile',
    text: 'You actually remember that? Wow... that means a lot, seriously. Most people back home didn\'t really get why I wanted to do design or why I loved digging through weird internet forums at 2 AM. Sitting here talking with you makes this whole city feel a little smaller and a lot less lonely.',
    choices: [
      {
        id: 'shared_connection',
        text: 'I feel the exact same way. That motel room felt pretty isolated until we started talking.',
        nextBeatId: 'beat_conclusion',
        trustDelta: 3,
        comfortDelta: 3,
        familiarityDelta: 3,
        mayaReactionExpression: 'smile',
      },
      {
        id: 'look_forward',
        text: 'We should definitely do this again. In-person coffee beats instant kettle brew every time.',
        nextBeatId: 'beat_conclusion',
        trustDelta: 3,
        comfortDelta: 4,
        familiarityDelta: 3,
        mayaReactionExpression: 'shy',
      },
    ],
  },

  beat_conclusion: {
    id: 'beat_conclusion',
    speaker: 'Maya',
    expression: 'smile',
    text: 'Definitely. I need to head back toward the studio before the evening print run, but thank you for coming out today. Message me on Pulse when you\'re back at your desk, okay? I\'ll send you that song track we talked about!',
    isEnd: true,
  },
};

/** Small authored *systemic* messages for an NPC who contacts the player
 * first. These aren't AI-generated and never claim knowledge of an unstated
 * event. The player's response and the NPC's next answer are authored by Ink.
 * Role/relationship eligibility comes exclusively from Worker Social reads.
 */
export const PULSE_OUTREACH_LINES = {
  promise: [
    'Hey, I remember we still have something to work out together. Got a minute?',
    'About that thing we said we would do together — can we check in soon?',
  ],
  shared: [
    'I was thinking about the time we spent together. How have you been?',
    'Remember that day we shared? Thought I would check in on you.',
  ],
  trusted: [
    'Hey, you have been on my mind. How are you doing?',
    'It has been a bit quiet here. Thought I would say hi to someone I trust.',
  ],
  remote: [
    'Hey, checking in from over here. How is everything on your side?',
    'It is nice having someone to talk to across the distance. How are things?',
  ],
  diner: [
    'Hey! How has your week been? The diner has been on my mind.',
    'I was thinking about the café crowd. What have you been up to?',
  ],
  canal: [
    'Have you been down by the canal lately? Thought I would say hello.',
    'Hey, the canal came to mind today. How have you been?',
  ],
  shift: [
    'Hey, how is your day going? I have been thinking about my next shift.',
    'It has been one of those weeks. Hope your day is going all right.',
  ],
  hello: [
    'Hey, I was wondering how you are doing. Got a minute?',
    'Hi! Thought I would say hello. How have things been?',
  ],
} as const;

export type PulseOutreachMotive = keyof typeof PULSE_OUTREACH_LINES;

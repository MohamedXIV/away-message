import type { CharacterTraits } from '../../engine/types';
import { pulseVoiceFor, type PulseVoice } from './PulseVoice';

/** Small authored *systemic* messages for an NPC who contacts the player
 * first. The subject is selected from canonical Social/World knowledge; these
 * lines never assert an unobserved event or private memory.
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

/** The actor's stable traits change *wording*, never eligibility, meaning or
 * motive. Identity/roles/relationship remain the source of subject selection.
 */
const STYLED_OUTREACH: Record<Exclude<PulseVoice, 'direct'>, Record<PulseOutreachMotive, readonly string[]>> = {
  reserved: {
    promise: ["Hey. About what we said we'd do together... can we talk?"],
    shared: ['I remembered that time we spent together. Hope you are doing okay.'],
    trusted: ['Hi. Just wanted to check in. How are you?'],
    remote: ['Hey. How are things on your end of the screen?'],
    diner: ['Hey. Was thinking about the diner. How have you been?'],
    canal: ['Been thinking about the canal. How are things?'],
    shift: ['Hi. Work has been on my mind. How are you?'],
    hello: ['Hi. Just checking in. How are you?'],
  },
  bright: {
    promise: ["Hey! Remember that thing we said we'd do together? Got a second?"],
    shared: ['Hey! Remember our time together? That popped into my head today!'],
    trusted: ['Hey you! How has your day been going?'],
    remote: ["Hey from the other side of the screen! What's new with you?"],
    diner: ["Hey! The diner came to mind today. What's new with you?"],
    canal: ["Hey! Thought of the canal and figured I'd say hi!"],
    shift: ["Hey! Work has been on my mind. How's your week going?"],
    hello: ["Hey! Just felt like saying hi. What's up?"],
  },
  gentle: {
    promise: ["Hey, I've been thinking about what we agreed to do together. Is now a good time?"],
    shared: ["I was remembering the time we spent together. I hope you've been well."],
    trusted: ["Hey, I care about how you're doing. Got a little time to talk?"],
    remote: ["Hi, it's nice we can keep in touch from so far away. How are you?"],
    diner: ["Hi! The diner came to mind and I thought I'd see how you're doing."],
    canal: ["I was thinking about the canal today. Hope things are going well for you."],
    shift: ["Hey, work has been on my mind. I hope your day is going okay."],
    hello: ["Hi! I hope you're doing okay. Just wanted to say hello."],
  },
};

export function pulseOutreachOptions(motive: PulseOutreachMotive, traits: CharacterTraits): readonly string[] {
  const voice = pulseVoiceFor(traits);
  return voice === 'direct' ? PULSE_OUTREACH_LINES[motive] : STYLED_OUTREACH[voice][motive];
}

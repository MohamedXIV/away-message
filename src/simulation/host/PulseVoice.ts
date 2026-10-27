import type { BuddyAttitude, CharacterTraits } from '../../engine/types';

export type PulseVoice = 'reserved' | 'bright' | 'gentle' | 'direct';

/** Read-only presentation derived from canonical fixed temperament, not a
 * second actor profile. Identical saved traits always yield the same voice.
 */
export function pulseVoiceFor(traits: CharacterTraits): PulseVoice {
  const scores: Array<[PulseVoice, number]> = [
    ['gentle', traits.warmth * 1.15 + traits.loyalty * 0.1],
    ['direct', traits.discipline * 1.15 + (100 - traits.spontaneity) * 0.1],
    ['bright', traits.spontaneity * 1.15 + (100 - traits.discipline) * 0.1],
    ['reserved', traits.shyness * 1.15 + (100 - traits.warmth) * 0.1],
  ];
  return scores.reduce((best, next) => next[1] > best[1] ? next : best)[0];
}

/** Exact Ink utterance -> hand-authored, meaning-equivalent surface wording.
 * Unknown or clue-sensitive Ink lines remain verbatim. In particular this
 * never varies the player's choices, effect requests, facts or thread tags.
 */
const REPLY_VOICES: Record<string, Record<PulseVoice, string>> = {
  "It was a long shift, but I'm doing okay. Thanks for asking.": {
    reserved: "It was a long shift. I'm doing okay, though. Thanks for asking.",
    bright: "Whew, that was a long shift! I'm doing okay now, thanks for asking.",
    gentle: "It was a long shift, but I'm doing okay. Really, thanks for asking.",
    direct: "A long shift, but I'm doing okay. Thanks for asking.",
  },
  "A lot of people passed through today. I'm glad it's quieter now.": {
    reserved: "Lots of people passed through today. It's quieter now, thankfully.",
    bright: "So many people came through today! Glad it's quieter now.",
    gentle: "A lot of people passed through today. I'm happy it's a little quieter now.",
    direct: "Busy day. A lot of people passed through, and it's quieter now.",
  },
  "Not too bad over here. It's good to hear from you.": {
    reserved: "Not too bad over here. Good to hear from you.",
    bright: "Not bad over here! Hey, good to hear from you!",
    gentle: "Things aren't too bad over here. It's really good to hear from you.",
    direct: "Things are fine over here. Good to hear from you.",
  },
  "A little tired, but holding up. How are you?": {
    reserved: "A bit tired. Holding up, though. How are you?",
    bright: "Tired, but still going! How about you?",
    gentle: "I'm a little tired, but holding up. How are you doing?",
    direct: "Tired, but holding up. How are you?",
  },
  "I'm okay. It's nice that you checked in.": {
    reserved: "I'm okay. Thanks for checking in.",
    bright: "I'm okay! Really nice of you to check in.",
    gentle: "I'm okay. It means a lot that you checked in.",
    direct: "I'm okay. I appreciate you checking in.",
  },
  "Yeah, I remember. That was a good day.": {
    reserved: "I remember. It was a good day.",
    bright: "Yeah, I remember! That was such a good day.",
    gentle: "Of course I remember. That was a good day to share.",
    direct: "I remember that day. It was a good one.",
  },
  "Thanks for asking. I'd rather take it slowly.": {
    reserved: "Thanks for asking. I'd rather take it slowly, if that's okay.",
    bright: "Hey, thanks for asking! I'd still rather take it slowly.",
    gentle: "Thanks for asking. I'd feel better taking it slowly.",
    direct: "Thanks for asking. I'd rather take it slowly.",
  },
  "Maybe. Tell me something good about your day instead.": {
    reserved: "Maybe. Could you tell me something good about your day instead?",
    bright: "Maybe! Tell me something good about your day instead!",
    gentle: "Maybe. I'd love to hear something good about your day instead.",
    direct: "Maybe. Tell me something good about your day instead.",
  },
  "Thanks. I'll catch up with you later.": {
    reserved: "Thanks. We can catch up later.",
    bright: "Thanks! Catch you later!",
    gentle: "Thanks for understanding. I'll catch up with you later.",
    direct: "Thanks. I'll catch up with you later.",
  },
  "Parts of it, yeah. Other parts were tiring.": {
    reserved: "Some parts, yeah. The others were tiring.",
    bright: "Some parts were great! Others were pretty tiring.",
    gentle: "I enjoyed parts of it, yeah. Other parts were tiring.",
    direct: "Parts were good. The rest was tiring.",
  },
  "I appreciate that. It means something.": {
    reserved: "Thanks. That means something to me.",
    bright: "Hey, thanks! That really means something.",
    gentle: "I appreciate that more than you know. It means something.",
    direct: "I appreciate that. It means something.",
  },
  "Nothing urgent. I just wanted to check in with you.": {
    reserved: "Nothing urgent. Just wanted to check in with you.",
    bright: "Nothing urgent! Just wanted to check in with you, that's all.",
    gentle: "Nothing urgent. I just wanted to check in and see how you are.",
    direct: "Nothing urgent. I wanted to check in with you.",
  },
  "Good to know you're there. How's your day going?": {
    reserved: "Good to know you're there. How's your day?",
    bright: "Glad you're there! How's your day going?",
    gentle: "It's good knowing you're there. How's your day going?",
    direct: "Good to know you're there. How's your day going?",
  },
  "That story's still on my mind. I want to see what actually happens.": {
    reserved: "That story's still on my mind. I'll see what actually happens.",
    bright: "I keep thinking about that story! I really want to see what happens!",
    gentle: "That story's stayed with me. I hope things work out well.",
    direct: "That story's on my mind. I'm waiting to see what actually happens.",
  },
  "It's hard to tell yet. I'll keep an eye on what happens next.": {
    reserved: "Hard to tell yet. I'll keep an eye on what happens.",
    bright: "Who knows yet! I'm keeping an eye on what happens next.",
    gentle: "It's hard to know yet. I'll keep an eye on what happens.",
    direct: "Too early to tell. I'll watch what happens next.",
  },
  "No worries. Talk when you've got a moment.": {
    reserved: "No worries. Talk when you've got a moment.",
    bright: "No worries! Catch you when you've got a moment!",
    gentle: "No worries at all. Talk when you've got a moment.",
    direct: "No worries. Talk when you've got a moment.",
  },
};

export function realizePulseReply(authoredText: string, traits: CharacterTraits): string {
  return REPLY_VOICES[authoredText]?.[pulseVoiceFor(traits)] ?? authoredText;
}

/** Only call with a World-owned event title that this actor has actually
 * learned. Its own World-owned attitude supplies the reaction. No date,
 * source, participation or player knowledge is invented by this formatter.
 */
export function formatPulseNewsLine(title: string, attitude: BuddyAttitude, traits: CharacterTraits): string {
  const topic = title.replace(/\s+/g, ' ').trim().slice(0, 100);
  const openings: Record<PulseVoice, string> = {
    reserved: `I heard about "${topic}".`,
    bright: `Hey, did you catch "${topic}"?`,
    gentle: `Hi. I heard about "${topic}" and thought I'd ask you.`,
    direct: `There's news about "${topic}".`,
  };
  const reactions: Record<BuddyAttitude, string> = {
    hyped: "I'm looking forward to seeing what happens.",
    curious: "I'm curious what happens next.",
    skeptical: "I'm not convinced yet.",
    annoyed: "I'm not thrilled about it.",
    indifferent: "I don't have much of an opinion yet.",
    worried: "I'm a little uneasy about it.",
  };
  return `${openings[pulseVoiceFor(traits)]} ${reactions[attitude]}`;
}

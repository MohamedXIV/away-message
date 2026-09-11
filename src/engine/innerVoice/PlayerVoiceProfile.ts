// src/engine/innerVoice/PlayerVoiceProfile.ts
// Data-driven Player Inner Voice style contract (#23).
//
// The voice stays consistent through one semantic profile instead of
// scattered strings. Future selectable/procedural profiles can replace the
// default without breaking the ThoughtIntent API.

import { pickSeeded } from '../characterTemplates';
import type { ThoughtIntent, ThoughtTone } from './types';

export interface PlayerVoiceProfile {
  id: string;
  name: string;
  /** Semantic style direction for AI paraphrase prompts (never quoted literally). */
  description: string;
  /** Hard cap for any resolved thought line. */
  thoughtMaxChars: number;
  /** Deterministic offline pools keyed by trigger kind, then tone. */
  templates: Record<string, Partial<Record<ThoughtTone, readonly string[]>>>;
  /** Generic fallback pools per tone when no kind-specific pool matches. */
  genericByTone: Record<ThoughtTone, readonly string[]>;
}

/**
 * Default voice: grounded, observant, intimate, occasionally funny/uneasy.
 * Never a quippy protagonist who comments on everything. Lowercase-leaning,
 * era-locked (1998-2006 inner life: no smartphones, no modern slang).
 */
export const DEFAULT_PLAYER_VOICE_PROFILE: PlayerVoiceProfile = {
  id: 'default-quiet-observer',
  name: 'Quiet observer',
  description:
    'grounded, observant, intimate, occasionally funny or uneasy; short first-person ' +
    'asides, lowercase-leaning, era-appropriate for 1998-2006; never quippy, never narrating others.',
  thoughtMaxChars: 140,
  templates: {
    weather: {
      neutral: [
        'rain on the awning. good weather for staying in.',
        'started raining while i wasnt looking. figures.',
        'that wet-concrete smell. i kind of like it.',
      ],
      uneasy: [
        'rain again. hope the walk home isnt miserable.',
        'sky went dark fast. i should keep track of time.',
      ],
    },
    body_state: {
      tired: [
        'running on fumes. chair, bed, floor — any of those.',
        'my eyes feel heavy. maybe i pushed too long today.',
      ],
      neutral: [
        'stomach is starting to complain. noted.',
        'i should eat something before i get weird about it.',
      ],
    },
    street_detail: {
      neutral: [
        'huh. never noticed that before.',
        'small detail, but it stuck with me for some reason.',
      ],
      curious: [
        'that corner always has something new going on.',
        'wonder how long thats been like that.',
      ],
      amused: ['this street never runs out of small weirdness.'],
    },
    inspect_item: {
      neutral: [
        'heavier than it looks. or maybe im just tired.',
        'been a while since i really looked at this.',
      ],
      curious: ['wonder where this even came from.'],
      warm: ['funny how the small stuff sticks around.'],
    },
    inspect_place: {
      neutral: [
        'taking it in for a minute. its fine here.',
        'same place, slightly different light. i like that.',
      ],
    },
    place_changed: {
      curious: ['something moved since last time. or im imagining it.'],
      uneasy: ['this was different yesterday. pretty sure.'],
    },
    missed_event: {
      uneasy: [
        'did i miss something? that nagging feeling again.',
        'hope nobody was waiting on me for that.',
      ],
      tired: ['too much to keep track of lately.'],
    },
    economy_pressure: {
      uneasy: [
        'money is getting tight. i can feel it already.',
        'that total hurt a little. noted, wallet.',
      ],
      tired: ['everything costs something. even standing here.'],
      annoyed: ['of course it costs that much. of course.'],
    },
    purchase: {
      warm: ['okay. that felt like a decent call.'],
      neutral: ['done. no take-backs now.'],
      uneasy: ['hope that was worth it. too late anyway.'],
    },
    social_aftermath: {
      warm: ['that went better than i expected. nice.'],
      neutral: ['okay. that happened. sitting with it a sec.'],
      uneasy: ['hope that didnt land weird. probably fine. probably.'],
      tired: ['people are a lot. good, but a lot.'],
    },
    old_object: {
      warm: ['oh. this one. forgot i kept it.'],
      neutral: ['found it again. past me had reasons, probably.'],
    },
    explicit_think: {
      neutral: [
        'taking a second to think. thats allowed.',
        'alright, brain. what do we actually think about this.',
      ],
    },
  },
  genericByTone: {
    neutral: [
      'noted. filing that away for later.',
      'huh. okay. moving on.',
    ],
    curious: ['wonder what thats about.'],
    uneasy: ['something about this sits weird. noting it.'],
    warm: ['small moment. keeping it.'],
    tired: ['too tired for big thoughts. small ones only.'],
    annoyed: ['yeah. sure. of course.'],
    amused: ['heh. fair enough.'],
  },
};

/** Deterministic offline line for an approved intent. Pure and seeded. */
export function renderFallbackText(
  intent: ThoughtIntent,
  profile: PlayerVoiceProfile = DEFAULT_PLAYER_VOICE_PROFILE,
  seedExtra = '',
): string {
  const kindPool = profile.templates[intent.source.split(':')[0] ?? ''];
  const byKind = kindPool?.[intent.tone] ?? kindPool?.neutral;
  const pool = byKind && byKind.length > 0 ? byKind : profile.genericByTone[intent.tone];
  const seed = `${intent.id}:${intent.cooldownKey ?? intent.topic}:${seedExtra || intent.semanticMeaning}`;
  const picked = pickSeeded(pool, seed);
  return picked.length > profile.thoughtMaxChars
    ? picked.slice(0, profile.thoughtMaxChars).trim()
    : picked;
}

import { NpcDialogueScript } from '../types';
import { ALL_STORY_KNOTS } from '../../../narrative/data/allKnots';
import { StoryKnot } from '../../../narrative/types';
import { CORE_IDS } from '../../../engine/coreBuddies';

function knotToScript(knot: StoryKnot): NpcDialogueScript {
  return {
    id: knot.id,
    buddyId: knot.characterId,
    day: knot.day,
    triggerMinuteMin: knot.timeWindow?.startMinute,
    triggerMinuteMax: knot.timeWindow?.endMinute,
    requiredBeatId: knot.requiredBeatId,
    messages: knot.lines
      .filter((l) => l.speaker !== 'player')
      .map((l) => ({
        text: l.text,
        delaySeconds: l.delaySeconds ?? 1.2,
        tags: l.tags,
      })),
    playerChoices: knot.choices?.map((c) => ({
      id: c.id,
      text: c.text,
      socialAction: (c.socialAction || 'empathy') as any,
      requiredFamiliarity: c.requiredFamiliarity,
      requiredTrust: c.requiredTrust,
      conditionFlag: c.conditionFlag,
      nextScriptId: c.targetKnot || c.nextScriptId,
    })),
  };
}

const baseScripts: NpcDialogueScript[] = ALL_STORY_KNOTS.map(knotToScript);

// Backwards-compatible aliases for existing unit tests
const ryanIntroScript: NpcDialogueScript = {
  id: 'ryan_intro',
  buddyId: CORE_IDS.RYAN,
  day: 1,
  messages: [
    { text: 'yo wanderer! smell anything sizzling across the canal?', delaySeconds: 1 },
    { text: 'grilling fresh al pastor on the cart today. Best tacos in Oakhaven (Y)', delaySeconds: 1.5 },
  ],
  playerChoices: [
    {
      id: 'c_r_tacos',
      text: 'Save me three tacos! I will walk over in twenty minutes.',
      socialAction: 'work_camaraderie',
      nextScriptId: 'ryan_day1_tacos',
    },
    {
      id: 'c_r_overclock',
      text: 'Hey Ryan! Did you finish overclocking that SDRAM module yet?',
      socialAction: 'intellectual_curiosity',
      nextScriptId: 'ryan_day1_overclock',
    },
  ],
};

const noraIntroScript: NpcDialogueScript = {
  id: 'nora_intro',
  buddyId: CORE_IDS.NORA,
  day: 1,
  messages: [
    { text: '...you are in Room 104 at Starlite, right?', delaySeconds: 1.2 },
    { text: 'pay attention to your audio speakers tonight around 2:45 AM. The canal sub-bass resonance leaks into the sound card line-in.', delaySeconds: 1.8 },
  ],
  playerChoices: [
    {
      id: 'c_n_rec',
      text: 'I will set up RetroAmp and line-in recording to capture the frequency spectrum.',
      socialAction: 'intellectual_curiosity',
      nextScriptId: 'nora_day1_forensics',
    },
    {
      id: 'c_n_skeptic',
      text: 'Isn’t that just the municipal water pumps cycling?',
      socialAction: 'empathy',
      nextScriptId: 'nora_day1_skeptic',
    },
  ],
};

export const DIALOGUE_SCRIPTS: NpcDialogueScript[] = [
  ...baseScripts,
  ryanIntroScript,
  noraIntroScript,
];

export function findDialogueScript(id: string): NpcDialogueScript | undefined {
  return DIALOGUE_SCRIPTS.find((s) => s.id === id);
}

export function getDialogueScriptsForBuddy(buddyId: string, day?: number): NpcDialogueScript[] {
  return DIALOGUE_SCRIPTS.filter((s) => s.buddyId === buddyId && (day === undefined || s.day === day));
}

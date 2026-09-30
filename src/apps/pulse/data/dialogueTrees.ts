import { NpcDialogueScript } from '../types';
import { ALL_STORY_KNOTS } from '../../../narrative/data/allKnots';
import { StoryKnot } from '../../../narrative/types';

function knotToScript(knot: StoryKnot): NpcDialogueScript {
  return {
    id: knot.id,
    buddyId: knot.characterId,
    day: knot.day,
    triggerMinuteMin: knot.timeWindow?.startMinute,
    triggerMinuteMax: knot.timeWindow?.endMinute,
    requiredBeatId: knot.requiredBeatId,
    messages: knot.lines
      .filter((line) => line.speaker !== 'player')
      .map((line) => ({
        text: line.text,
        delaySeconds: line.delaySeconds ?? 1.2,
        tags: line.tags,
      })),
    playerChoices: knot.choices?.map((choice) => ({
      id: choice.id,
      text: choice.text,
      socialAction: (choice.socialAction || 'empathy') as any,
      requiredFamiliarity: choice.requiredFamiliarity,
      requiredTrust: choice.requiredTrust,
      conditionFlag: choice.conditionFlag,
      nextScriptId: choice.targetKnot || choice.nextScriptId,
    })),
  };
}

/**
 * Optional authored dialogue scripts only.
 *
 * The old named Day-1 compatibility intros were removed with the retired
 * fixed-cast campaign. Runtime content may register actor-specific scripts,
 * but no named actor or day-by-day story is built into the product.
 */
export const DIALOGUE_SCRIPTS: NpcDialogueScript[] = ALL_STORY_KNOTS.map(knotToScript);

export function findDialogueScript(id: string): NpcDialogueScript | undefined {
  return DIALOGUE_SCRIPTS.find((script) => script.id === id);
}

export function getDialogueScriptsForBuddy(buddyId: string, day?: number): NpcDialogueScript[] {
  return DIALOGUE_SCRIPTS.filter(
    (script) => script.buddyId === buddyId && (day === undefined || script.day === day),
  );
}

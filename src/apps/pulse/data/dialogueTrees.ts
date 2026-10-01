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
 * Runtime content may register actor-specific scripts, but no named actor or
 * day-by-day story is built into the product.
 */
export const DIALOGUE_SCRIPTS: NpcDialogueScript[] = ALL_STORY_KNOTS.map(knotToScript);

/**
 * Validate a dialogue graph independently of whether production ships any
 * authored scripts. An empty list is valid; malformed entries and dangling
 * branch targets are not.
 */
export function validateDialogueScripts(scripts: readonly NpcDialogueScript[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  scripts.forEach((script, scriptIndex) => {
    const at = `script[${scriptIndex}]`;
    if (!script.id?.trim()) {
      errors.push(`${at}.id must be non-empty`);
    } else if (ids.has(script.id)) {
      errors.push(`${at}.id duplicates '${script.id}'`);
    } else {
      ids.add(script.id);
    }

    if (!script.buddyId?.trim()) errors.push(`${at}.buddyId must be non-empty`);
    if (!Array.isArray(script.messages) || script.messages.length === 0) {
      errors.push(`${at}.messages must contain at least one message`);
    } else {
      script.messages.forEach((message, messageIndex) => {
        if (!message.text?.trim()) errors.push(`${at}.messages[${messageIndex}].text must be non-empty`);
      });
    }

    script.playerChoices?.forEach((choice, choiceIndex) => {
      const choiceAt = `${at}.playerChoices[${choiceIndex}]`;
      if (!choice.id?.trim()) errors.push(`${choiceAt}.id must be non-empty`);
      if (!choice.text?.trim()) errors.push(`${choiceAt}.text must be non-empty`);
      if (!choice.socialAction) errors.push(`${choiceAt}.socialAction must be set`);
    });
  });

  scripts.forEach((script, scriptIndex) => {
    script.playerChoices?.forEach((choice, choiceIndex) => {
      if (choice.nextScriptId && !ids.has(choice.nextScriptId)) {
        errors.push(`script[${scriptIndex}].playerChoices[${choiceIndex}].nextScriptId '${choice.nextScriptId}' does not exist`);
      }
    });
  });

  return errors;
}

export function findDialogueScript(id: string): NpcDialogueScript | undefined {
  return DIALOGUE_SCRIPTS.find((script) => script.id === id);
}

export function getDialogueScriptsForBuddy(buddyId: string, day?: number): NpcDialogueScript[] {
  return DIALOGUE_SCRIPTS.filter(
    (script) => script.buddyId === buddyId && (day === undefined || script.day === day),
  );
}

import { StoryKnot } from '../types';
import { RYAN_14DAY_KNOTS } from './ryanArcs';
import { MAYA_14DAY_KNOTS } from './mayaArcs';
import { NORA_14DAY_KNOTS } from './noraArcs';
import { HENDERSON_14DAY_KNOTS } from './hendersonArcs';
import { CAFE_MEETING_KNOTS } from './cafeMeetingArc';
import { EVALUATION_ENDING_KNOTS } from './evaluationEndingArc';

export const ALL_STORY_KNOTS: StoryKnot[] = [
  ...RYAN_14DAY_KNOTS,
  ...MAYA_14DAY_KNOTS,
  ...NORA_14DAY_KNOTS,
  ...HENDERSON_14DAY_KNOTS,
  ...CAFE_MEETING_KNOTS,
  ...EVALUATION_ENDING_KNOTS,
];

export function getStoryKnotsByCharacter(characterId: string): StoryKnot[] {
  return ALL_STORY_KNOTS.filter((k) => k.characterId === characterId);
}

export function getStoryKnotsByDay(day: number): StoryKnot[] {
  return ALL_STORY_KNOTS.filter((k) => k.day === day);
}

export function findStoryKnot(id: string): StoryKnot | undefined {
  return ALL_STORY_KNOTS.find((k) => k.id === id);
}

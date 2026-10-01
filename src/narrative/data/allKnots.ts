import { StoryKnot } from '../types';

/**
 * Optional authored narrative content may register actor/state-driven knots at
 * runtime/content boundaries. The sandbox intentionally provides no mandatory
 * global story sequence or required named cast.
 */
export const ALL_STORY_KNOTS: StoryKnot[] = [];

export function getStoryKnotsByCharacter(characterId: string): StoryKnot[] {
  return ALL_STORY_KNOTS.filter((k) => k.characterId === characterId);
}

export function getStoryKnotsByDay(day: number): StoryKnot[] {
  return ALL_STORY_KNOTS.filter((k) => k.day === day);
}

export function findStoryKnot(id: string): StoryKnot | undefined {
  return ALL_STORY_KNOTS.find((k) => k.id === id);
}

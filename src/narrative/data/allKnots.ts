import { StoryKnot } from '../types';

/**
 * The fixed day-by-day campaign knots were retired with the old evaluation experiment.
 *
 * The sandbox does not ship a canonical global story sequence or mandatory named cast.
 * Optional authored narrative content may register knots at runtime/content boundaries,
 * but this module intentionally provides no built-in campaign.
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

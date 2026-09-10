// src/ai/characterSchemas.ts
// Governed schema for AI-generated newcomers — never trust raw JSON.
// The engine re-validates via CharacterEngine.buildCharacter before registering.

import { z } from 'zod';

const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max);

export const NewcomerAiSchema = z.object({
  id: z.string().trim().min(2).max(32).regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case starting with a letter'),
  displayName: boundedText(1, 40),
  handle: boundedText(1, 40),
  archetype: z.enum(['coworker', 'nightowl', 'student', 'trader', 'artist', 'regular']),
  headline: boundedText(6, 60),
  bio: boundedText(20, 180),
  interests: z.array(boundedText(2, 20)).min(3).max(5),
  songTitle: boundedText(3, 50),
  introText: boundedText(10, 300),
  // Fixed appearance (natural hair, honest eyes) + languages with proficiency.
  hair: boundedText(2, 24),
  eyes: boundedText(2, 24),
  languages: z.array(z.object({
    lang: z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'zh', 'ja']),
    level: z.number().int().min(1).max(5),
  })).min(1).max(3),
}).strict();

export type NewcomerAi = z.infer<typeof NewcomerAiSchema>;

export function parseNewcomer(value: unknown): NewcomerAi {
  return NewcomerAiSchema.parse(value);
}

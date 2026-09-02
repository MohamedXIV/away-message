// src/ai/proceduralSchemas.ts
// Zod schemas for governed procedural generation — AI output is validated, never trusted raw.

import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().min(1).max(max);

// Allowed categories — must match GlobalEventCategory in engine/types
export const PROCEDURAL_CATEGORY_ENUM = z.enum([
  'os_release',
  'site_launch',
  'city_news',
  'economy',
  'culture',
  'system',
]);

export const ProceduralWorldEventSchema = z.object({
  id: z.string().trim().min(3).max(40).regex(/^[a-z0-9_]+$/, 'id must be snake_case a-z0-9_'),
  title: boundedText(80),
  description: boundedText(400),
  category: PROCEDURAL_CATEGORY_ENUM,
  // Trigger 1..365, but caller will clamp to near future (currentDay+1 .. currentDay+7)
  triggerDay: z.number().int().min(1).max(365),
  triggerHour: z.number().int().min(0).max(23).optional().default(10),
  knowledgePrompt: boundedText(220),
  siteUrl: z.string().trim().max(160).regex(/^https?:\/\/[a-z0-9_-]+\.local(\/[a-zA-Z0-9_./?=&%-]*)?$/).optional().nullable(),
  cityWireHeadline: boundedText(90).optional().nullable(),
  cityWireBody: boundedText(900).optional().nullable(),
  cityWireByline: boundedText(60).optional().nullable(),
}).strict();

export const ProceduralBatchSchema = z.object({
  events: z.array(ProceduralWorldEventSchema).min(1).max(3),
}).strict();

export type ProceduralWorldEvent = z.infer<typeof ProceduralWorldEventSchema>;
export type ProceduralBatch = z.infer<typeof ProceduralBatchSchema>;

export function parseProceduralBatch(value: unknown): ProceduralBatch {
  return ProceduralBatchSchema.parse(value);
}

// Controls that govern generation — fed as initial info + hard constraints.
export interface ProceduralControls {
  worldSeed: string;
  currentDay: number;
  currentHour?: number;
  existingEventIds: string[];
  recentTitles: string[];
  allowedCategories: Array<z.infer<typeof PROCEDURAL_CATEGORY_ENUM>>;
  maxEvents: number; // 1..3
  tone: 'grounded' | 'whimsical' | 'melancholy' | 'hopeful';
  bannedPhrases: string[];
  mustAvoidDuplicateIds: boolean;
  // Optional guidance — e.g., force MyPlace or Orion mention for this batch
  preferCategories?: Array<z.infer<typeof PROCEDURAL_CATEGORY_ENUM>>;
  locale?: string; // 'en' | 'ar' etc, default en
}

export const DEFAULT_PROCEDURAL_CONTROLS: Partial<ProceduralControls> = {
  maxEvents: 2,
  tone: 'grounded',
  bannedPhrases: ['real company', 'iPhone', 'COVID', 'Trump', 'MAGA'],
};

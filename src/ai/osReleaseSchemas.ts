// src/ai/osReleaseSchemas.ts
// Governed schema for AI-generated OS releases — never trust raw JSON.

import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const OsReleaseAiSchema = z.object({
  id: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_.-]+$/, 'id must be alphanumeric _ . -'),
  version: boundedText(12), // e.g. "7.1", "5.0.1"
  codename: boundedText(20).optional().nullable(),
  displayName: boundedText(60),
  family: z.enum(['4.x', '5.x', '6.x', '7.x']),
  kind: z.enum(['major', 'minor', 'patch', 'beta', 'hotfix']),
  channel: z.enum(['stable', 'beta', 'hotfix']),
  changelog: z.array(boundedText(120)).min(1).max(6),
  blurb: boundedText(120).optional().nullable(),
  installSizeGB: z.number().min(0.1).max(4.0),
  ramOverheadMB: z.number().int().min(48).max(256),
  bootTimeSeconds: z.number().int().min(28).max(75),
  minRamMB: z.number().int().min(256).max(2048),
  minDiskGB: z.number().min(0.2).max(4.0),
  price: z.number().min(0).max(99).optional().nullable(),
  theme: z.enum(['orion48', 'orion50', 'orion60', 'orion70']),
}).strict();

export const OsReleaseBatchSchema = z.object({
  releases: z.array(OsReleaseAiSchema).min(1).max(2),
}).strict();

export type OsReleaseAi = z.infer<typeof OsReleaseAiSchema>;
export type OsReleaseAiBatch = z.infer<typeof OsReleaseBatchSchema>;

export function parseOsReleaseBatch(value: unknown): OsReleaseAiBatch {
  return OsReleaseBatchSchema.parse(value);
}

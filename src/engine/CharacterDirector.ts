// src/engine/CharacterDirector.ts
// Governed newcomer generator — AI proposes, Zod validates, CharacterEngine builds,
// templates guarantee an offline result. Mirrors the ProceduralDirector pattern.

import type { BuddyMetVia, CharacterArchetype } from './types';
import { buildCharacter, type BuiltCharacter, type CharacterDefinition } from './CharacterEngine';
import {
  CHARACTER_ARCHETYPES,
  listArchetypes,
  pickTemplateIntroLine,
  pickTemplateName,
} from './characterTemplates';
import { parseNewcomer, type NewcomerAi } from '../ai/characterSchemas';

export interface NewcomerRequest {
  metVia: BuddyMetVia;
  day: number;
  seed?: string;
  archetype?: CharacterArchetype;
  useAI?: boolean;
  /** Manual override (AI Lab / MyPlace add) — skips name pools. */
  displayName?: string;
  handle?: string;
  id?: string;
}

export interface NewcomerProfilePatch {
  headline: string;
  bio: string;
  interests: string[];
  songTitle: string;
}

export interface NewcomerResult {
  definition: CharacterDefinition;
  personaHint: string;
  profilePatch: NewcomerProfilePatch;
  /** First Pulse message (MyPlace link appended). Empty when caller passes silent. */
  introText: string;
  source: 'ai' | 'template';
  error?: string;
}

export const NEWCOMER_METVIA_ROTATION: BuddyMetVia[] = ['nightboard', 'myplace', 'work', 'pulse-room'];

/** Pure throttle decision — deterministic, testable. */
export function shouldAutoDiscover(day: number, lastNewcomerDay: number): boolean {
  if (day < 6) return false;
  if (day - lastNewcomerDay < 4) return false;
  return hashSeed(`newcomer:${day}`) % 100 < 35;
}

export function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return /^[a-z]/.test(slug) ? slug : `pal_${slug}`;
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

const METVIA_FLAVOR: Record<BuddyMetVia, string> = {
  nightboard: 'you crossed paths on NightBoard late at night',
  myplace: 'you found each other browsing MyPlace',
  'pulse-room': 'you met in a Pulse chat room',
  work: 'you met during a food-cart shift',
  intro: 'a mutual friend introduced you',
  core: 'you have known each other a while',
};

function buildIntroText(displayName: string, archetype: CharacterArchetype, seed: string, myplaceId: string): string {
  const line = pickTemplateIntroLine(archetype, seed, displayName);
  return `${line} http://myplace.local/${myplaceId}`;
}

function templateProfilePatch(displayName: string, archetype: CharacterArchetype): NewcomerProfilePatch {
  const template = CHARACTER_ARCHETYPES[archetype];
  return {
    headline: `${displayName} • Oakhaven local`,
    bio: template.personaHint,
    interests: [...template.defaultInterests],
    songTitle: template.defaultSong,
  };
}

export async function generateNewcomer(
  req: NewcomerRequest,
  ctx: { existingIds: string[]; existingHandles?: string[] }
): Promise<NewcomerResult> {
  const seed = req.seed ?? `newcomer-day-${req.day}`;
  const taken = new Set([...ctx.existingIds, ...(ctx.existingHandles ?? [])]);
  const archetype: CharacterArchetype =
    req.archetype && CHARACTER_ARCHETYPES[req.archetype]
      ? req.archetype
      : listArchetypes()[hashSeed(`${seed}:arch`) % listArchetypes().length]!;

  // Manual names (AI Lab / MyPlace add) win over pools.
  let id: string;
  let displayName: string;
  let handle: string;
  if (req.displayName?.trim() && req.handle?.trim()) {
    displayName = req.displayName.trim().slice(0, 40);
    handle = req.handle.trim().slice(0, 40);
    id = uniqueId(slugify(req.id?.trim() || handle), taken);
    if (taken.has(handle)) handle = `${handle}_${id.split('_').pop()}`;
  } else {
    const picked = pickTemplateName(archetype, seed, taken);
    id = picked.id;
    displayName = picked.displayName;
    handle = picked.handle;
  }

  const useAI = req.useAI !== false;
  if (useAI) {
    try {
      const { loadAISettings } = await import('../ai/settings');
      const settings = loadAISettings();
      const hasKey = (() => {
        try {
          const prov = settings.activeProvider;
          const keys = settings.byokKeys as Record<string, string>;
          if (keys[prov]?.trim()) return true;
          const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
          const map: Record<string, string | undefined> = {
            gemini: 'VITE_GEMINI_API_KEY',
            groq: 'VITE_GROQ_API_KEY',
            openrouter: 'VITE_OPENROUTER_API_KEY',
            fal: 'VITE_FAL_API_KEY',
          };
          const envKey = map[prov];
          return !!envKey && !!env[envKey]?.trim();
        } catch {
          return false;
        }
      })();
      if (hasKey) {
        const { completeJson, getProviderModel, resolveApiKey } = await import('../ai/providers');
        const providerId = settings.activeProvider;
        const model = getProviderModel(providerId);
        const { key } = resolveApiKey(providerId, settings);
        if (key) {
          const existing = [...taken].slice(0, 24).join(', ') || 'none';
          const system =
            'You invent ONE new friend for a fictional 2005 desktop sandbox game (Oakhaven, dial-up era). ' +
            'Return JSON only, matching the schema exactly. Mundane believable person, no real people, no real brands, ' +
            'handles like 2005 forum names. Keep every field personality-consistent with the archetype.';
          const user =
            `Archetype: ${archetype} (${CHARACTER_ARCHETYPES[archetype].personaHint}) | ` +
            `Met via: ${METVIA_FLAVOR[req.metVia]} | Current day: ${req.day} | ` +
            `Taken ids/handles (avoid all): ${existing}. ` +
            `introText: their first Pulse message to the player (10-300 chars, era voice, no URL — link appended automatically).`;
          const schema = {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', pattern: '^[a-z][a-z0-9_]*$', minLength: 2, maxLength: 32 },
              displayName: { type: 'string', minLength: 1, maxLength: 40 },
              handle: { type: 'string', minLength: 1, maxLength: 40 },
              archetype: { type: 'string', enum: ['coworker', 'nightowl', 'student', 'trader', 'artist', 'regular'] },
              headline: { type: 'string', minLength: 6, maxLength: 60 },
              bio: { type: 'string', minLength: 20, maxLength: 180 },
              interests: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string', minLength: 2, maxLength: 20 } },
              songTitle: { type: 'string', minLength: 3, maxLength: 50 },
              introText: { type: 'string', minLength: 10, maxLength: 300 },
            },
            required: ['id', 'displayName', 'handle', 'archetype', 'headline', 'bio', 'interests', 'songTitle', 'introText'],
          } as const;
          const raw = await completeJson({
            providerId,
            model,
            apiKey: key,
            systemPrompt: system,
            userPrompt: user,
            jsonSchema: schema as unknown as Record<string, unknown>,
            signal: new AbortController().signal,
          });
          const parsed: NewcomerAi = parseNewcomer(raw);
          const aiId = uniqueId(slugify(parsed.id), taken);
          let aiHandle = parsed.handle.trim().slice(0, 40);
          if (taken.has(aiHandle)) aiHandle = `${aiHandle}_${aiId.split('_').pop()}`;
          const built: BuiltCharacter = buildCharacter({
            id: aiId,
            displayName: parsed.displayName.trim().slice(0, 40),
            handle: aiHandle,
            archetype: parsed.archetype,
            metVia: req.metVia,
            createdDay: req.day,
            status: 'stranger',
          });
          return {
            definition: built.definition,
            personaHint: built.personaHint,
            profilePatch: {
              headline: parsed.headline.trim().slice(0, 60),
              bio: parsed.bio.trim().slice(0, 180),
              interests: parsed.interests.map((s) => String(s).slice(0, 20)).slice(0, 5),
              songTitle: parsed.songTitle.trim().slice(0, 50),
            },
            introText: `${parsed.introText.trim()} http://myplace.local/${aiId}`,
            source: 'ai',
          };
        }
      }
    } catch (err) {
      // Fall through to template with the error attached
      return templateResult(id, displayName, handle, archetype, req, seed, err instanceof Error ? err.message : String(err));
    }
  }
  return templateResult(id, displayName, handle, archetype, req, seed);
}

function templateResult(
  id: string,
  displayName: string,
  handle: string,
  archetype: CharacterArchetype,
  req: NewcomerRequest,
  seed: string,
  error?: string
): NewcomerResult {
  const built = buildCharacter({
    id,
    displayName,
    handle,
    archetype,
    metVia: req.metVia,
    createdDay: req.day,
    status: 'stranger',
  });
  return {
    definition: built.definition,
    personaHint: built.personaHint,
    profilePatch: templateProfilePatch(displayName, archetype),
    introText: buildIntroText(displayName, archetype, seed, id),
    source: 'template',
    error,
  };
}

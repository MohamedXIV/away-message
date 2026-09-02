// src/engine/ProceduralDirector.ts
// Governed procedural event director — decides WHEN, AI decides WHAT (within strict controls).

import { loadAISettings } from '../ai/settings';
import { buildLorePrompt } from '../ai/worldLore';
import { parseProceduralBatch, type ProceduralControls, type ProceduralWorldEvent } from '../ai/proceduralSchemas';
import { pickTemplateEvents } from '../ai/proceduralTemplates';
import type { GlobalEvent } from './types';
import type { WorldEventsEngine } from './WorldEventsEngine';

const PROCEDURAL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    events: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9_]+$', maxLength: 40 },
          title: { type: 'string', minLength: 6, maxLength: 80 },
          description: { type: 'string', minLength: 20, maxLength: 400 },
          category: { type: 'string', enum: ['os_release', 'site_launch', 'city_news', 'economy', 'culture', 'system'] },
          triggerDay: { type: 'integer', minimum: 1, maximum: 365 },
          triggerHour: { type: 'integer', minimum: 0, maximum: 23 },
          knowledgePrompt: { type: 'string', minLength: 20, maxLength: 220 },
          siteUrl: { type: ['string', 'null'], maxLength: 160 },
          cityWireHeadline: { type: ['string', 'null'], maxLength: 90 },
          cityWireBody: { type: ['string', 'null'], maxLength: 900 },
          cityWireByline: { type: ['string', 'null'], maxLength: 60 },
        },
        required: ['id', 'title', 'description', 'category', 'triggerDay', 'knowledgePrompt'],
      },
    },
  },
  required: ['events'],
} as const;

function stableId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'proc_event';
}

function clampDay(day: number, currentDay: number): number {
  // Procedural events must be near-future: currentDay+1 .. currentDay+7
  if (day <= currentDay) return currentDay + 1;
  if (day > currentDay + 7) return currentDay + 3;
  return day;
}

function normalizeEvent(raw: ProceduralWorldEvent, currentDay: number, existingIds: Set<string>): GlobalEvent {
  let id = stableId(raw.id);
  let suffix = 0;
  let uniqueId = id;
  while (existingIds.has(uniqueId)) {
    suffix += 1;
    uniqueId = `${id}_${suffix}`;
  }
  existingIds.add(uniqueId);

  const siteUrl = raw.siteUrl && raw.siteUrl.trim().endsWith('.local') || raw.siteUrl?.includes('.local/')
    ? raw.siteUrl.trim()
    : raw.siteUrl?.trim() ?? undefined;

  // Validate .local
  let safeSiteUrl: string | undefined = undefined;
  if (siteUrl) {
    try {
      const u = new URL(siteUrl);
      if (u.hostname.endsWith('.local')) safeSiteUrl = siteUrl;
    } catch {
      if (siteUrl.startsWith('http://') && siteUrl.includes('.local')) safeSiteUrl = siteUrl;
    }
  }

  return {
    id: uniqueId,
    title: raw.title.trim().slice(0, 80),
    description: raw.description.trim().slice(0, 400),
    category: raw.category,
    triggerDay: clampDay(raw.triggerDay, currentDay),
    triggerHour: Math.max(0, Math.min(23, raw.triggerHour ?? 10)),
    knowledgePrompt: raw.knowledgePrompt.trim().slice(0, 220),
    siteUrl: safeSiteUrl,
    isTriggered: false,
  };
}

function buildProceduralPrompt(controls: ProceduralControls, ctx: {
  recentTriggered: GlobalEvent[];
  pendingCount: number;
  playerSummary?: string;
}): { system: string; user: string } {
  const lore = buildLorePrompt();
    const allowed = (controls.allowedCategories as string[]).join(', ');
  const recent = ctx.recentTriggered.slice(-4).map((e) => `- [Day ${e.triggerDay}] ${e.title} (${e.category}): ${e.knowledgePrompt}`).join('\n') || 'none yet';
  const banned = controls.bannedPhrases.length > 0 ? `Banned phrases (must not appear): ${controls.bannedPhrases.join(', ')}.` : '';
  const prefer = controls.preferCategories && (controls.preferCategories as string[]).length > 0 ? `Prefer categories: ${(controls.preferCategories as string[]).join(', ')}.` : '';

  return {
    system: [
      `You generate governed procedural world events for a fictional desktop sandbox game set in 1998-2006.`,
      `Return JSON only, matching the provided schema exactly. No prose outside JSON.`,
      `Era & lore: ${lore}`,
      `Hard controls: Categories must be from [${allowed}]. Tone must be ${controls.tone}. Era 1998-2006 only. Fictional Oakhaven only. All siteUrl must be http://*.local or null. Never invent real brands, real politicians, real celebrities, or real news. Max ${controls.maxEvents} events.`,
      `TriggerDay for each event must be between ${controls.currentDay + 1} and ${controls.currentDay + 7}. KnowledgePrompt must be one sentence a NPC could say naturally. CityWireHeadline/Body are optional but if present must read like a short local newspaper lede.`,
      `Avoid duplicate ids/titles vs existing: ${controls.existingEventIds.slice(0, 8).join(', ') || 'none'}. Recent titles to avoid repeating: ${controls.recentTitles.slice(0, 6).join(' | ') || 'none'}. ${prefer} ${banned}`,
      `If you cannot satisfy controls, return the closest valid batch rather than adding extra fields.`,
    ].join('\n'),
    user: [
      `World seed: "${controls.worldSeed}" | Current day: ${controls.currentDay} | Pending events: ${ctx.pendingCount} | Tone: ${controls.tone}`,
      `Recent triggered events:\n${recent}`,
      ctx.playerSummary ? `Player snapshot: ${ctx.playerSummary}` : '',
      `Generate ${controls.maxEvents} new procedural events for days ${controls.currentDay + 1}..${controls.currentDay + 7}. Keep them mundane, plausible, and varied across categories.`,
    ].filter(Boolean).join('\n\n'),
  };
}

export interface DirectorGenerateOptions {
  worldSeed?: string;
  maxEvents?: number; // 1..3
  allowedCategories?: ProceduralControls['allowedCategories'];
  preferCategories?: ProceduralControls['allowedCategories'];
  tone?: ProceduralControls['tone'];
  useAI?: boolean; // default true, fallback to templates when false or no key
}

export class ProceduralDirector {
  constructor(private world: WorldEventsEngine) {}

  public async generateNextBatch(
    currentDay: number,
    currentTotalMinutes: number,
    options: DirectorGenerateOptions = {},
  ): Promise<{ events: GlobalEvent[]; meta: { source: 'ai' | 'template' | 'mixed'; latencyMs: number; error?: string } }> {
    const startedAt = performance.now();
    const maxEvents = Math.max(1, Math.min(3, options.maxEvents ?? 2));
    const allowedCategories = options.allowedCategories ?? ['city_news', 'site_launch', 'economy', 'culture', 'system', 'os_release'];
    const seed = options.worldSeed ?? `oakhaven-${currentDay}`;
    const existingIds = new Set([...this.world.getTriggeredEvents().map((e) => e.id), ...this.world.getPendingEvents().map((e) => e.id)]);
    const recentTitles = this.world.getTriggeredEvents().slice(-6).map((e) => e.title);

    const controls: ProceduralControls = {
      worldSeed: seed,
      currentDay,
      existingEventIds: Array.from(existingIds),
      recentTitles,
      allowedCategories: allowedCategories as any,
      maxEvents,
      tone: options.tone ?? 'grounded',
      bannedPhrases: ['iPhone', 'COVID', 'TikTok', 'Trump'],
      mustAvoidDuplicateIds: true,
      preferCategories: options.preferCategories as any,
    };

    const useAI = options.useAI !== false;
    const settings = loadAISettings();
    const hasKey = (() => {
      try {
        const prov = settings.activeProvider;
        const keys = settings.byokKeys as Record<string, string>;
        if (keys[prov]?.trim()) return true;
        const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
        const map: Record<string, string | undefined> = { gemini: 'VITE_GEMINI_API_KEY', groq: 'VITE_GROQ_API_KEY', openrouter: 'VITE_OPENROUTER_API_KEY' };
        const envKey = map[prov];
        return !!envKey && !!env[envKey]?.trim();
      } catch { return false; }
    })();

    // Fast path: no key or caller disabled AI → templates only
    if (!useAI || !hasKey) {
      const templ = pickTemplateEvents(seed, currentDay, allowedCategories as string[], maxEvents);
      const normalized = templ.map((e) => normalizeEvent(e as any, currentDay, new Set(existingIds)));
      this.injectIntoWorld(normalized, currentTotalMinutes);
      return { events: normalized, meta: { source: 'template', latencyMs: Math.round(performance.now() - startedAt) } };
    }

    // AI path with governance
    try {
      const prompt = buildProceduralPrompt(controls, {
        recentTriggered: this.world.getTriggeredEvents(),
        pendingCount: this.world.getPendingEvents().length,
        playerSummary: `Day ${currentDay}, pending ${this.world.getPendingEvents().length}`,
      });

      const { completeJson } = await import('../ai/providers');
      const { getProviderModel, resolveApiKey } = await import('../ai/providers');
      const providerId = settings.activeProvider;
      const model = getProviderModel(providerId);
      const { key } = resolveApiKey(providerId, settings);
      if (!key) throw new Error('No API key');

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 28_000);
      let raw: unknown;
      try {
        raw = await completeJson({
          providerId,
          model,
          apiKey: key,
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
          jsonSchema: PROCEDURAL_JSON_SCHEMA as unknown as Record<string, unknown>,
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }

      const parsed = parseProceduralBatch(raw);
      const limited = parsed.events.slice(0, maxEvents);
      const normalized = limited.map((e) => normalizeEvent(e as ProceduralWorldEvent, currentDay, new Set(existingIds)));

      // Inject
      this.injectIntoWorld(normalized, currentTotalMinutes);
      return { events: normalized, meta: { source: 'ai', latencyMs: Math.round(performance.now() - startedAt) } };
    } catch (error) {
      // Fallback to templates on any AI failure, but keep error for UI
      const msg = error instanceof Error ? error.message : String(error);
      const templ = pickTemplateEvents(seed + ':fallback', currentDay, allowedCategories as string[], maxEvents);
      const normalized = templ.map((e) => normalizeEvent(e as any, currentDay, new Set(existingIds)));
      this.injectIntoWorld(normalized, currentTotalMinutes);
      return { events: normalized, meta: { source: 'template', latencyMs: Math.round(performance.now() - startedAt), error: msg.slice(0, 300) } };
    }
  }

  private injectIntoWorld(events: GlobalEvent[], _currentTotalMinutes: number): void {
    this.world.injectProceduralEvents(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        triggerDay: e.triggerDay,
        triggerHour: e.triggerHour,
        knowledgePrompt: e.knowledgePrompt,
        siteUrl: e.siteUrl,
      })),
    );
  }

  public getStatus(currentDay: number): { pending: number; triggered: number; nextDay?: number } {
    const pending = this.world.getPendingEvents();
    const triggered = this.world.getTriggeredEvents();
    const next = pending
      .filter((e) => e.triggerDay >= currentDay)
      .sort((a, b) => a.triggerDay - b.triggerDay)[0];
    return { pending: pending.length, triggered: triggered.length, nextDay: next?.triggerDay };
  }
}

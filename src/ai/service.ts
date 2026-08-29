import { readAICache, writeAICache } from './cache';
import { parseGeneratedChat, parseGeneratedSite } from './schemas';
import {
  AI_PROVIDERS,
  getProviderModel,
  resolveApiKey,
  completeJson,
} from './providers';
import { getSiteArchetype } from './siteArchetypes';
import type {
  AIProviderId,
  AIResult,
  AISettings,
  BenchmarkResult,
  ChatGenerationRequest,
  GeneratedChatResponse,
  GeneratedSiteContent,
  SiteGenerationRequest,
} from './types';

const SITE_PROMPT_VERSION = 'site-v3';
const CHAT_PROMPT_VERSION = 'chat-v1';
const REQUEST_TIMEOUT_MS = 30_000;

const SITE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    siteName: { type: 'string' },
    title: { type: 'string' },
    tagline: { type: 'string' },
    eraStyle: { type: 'string' },
    archetype: { type: 'string' },
    layout: { type: 'string', enum: ['centered', 'columns', 'forum', 'catalog', 'newspaper', 'sidebar'] },
    theme: {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: { type: 'string' },
        secondary: { type: 'string' },
        accent: { type: 'string' },
        paper: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['primary', 'secondary', 'accent', 'paper', 'text'],
    },
    statusLine: { type: 'string' },
    footerNote: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
        required: ['heading', 'body', 'items'],
      },
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { label: { type: 'string' }, href: { type: 'string' } },
        required: ['label', 'href'],
      },
    },
    quirks: { type: 'array', items: { type: 'string' } },
    searchKeywords: { type: 'array', items: { type: 'string' } },
    storyHooks: { type: 'array', items: { type: 'string' } },
  },
  required: ['siteName', 'title', 'tagline', 'eraStyle', 'archetype', 'layout', 'theme', 'statusLine', 'footerNote', 'sections', 'links', 'quirks', 'searchKeywords', 'storyHooks'],
};

const CHAT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    messages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string' }, tone: { type: 'string' } },
        required: ['text', 'tone'],
      },
    },
    socialAction: {
      type: 'string',
      enum: [
        'empathy',
        'remembered_detail',
        'tease_playful',
        'dismissive',
        'vulnerable_share',
        'work_camaraderie',
        'intellectual_curiosity',
        'none',
      ],
    },
    storyHookId: { type: ['string', 'null'] },
  },
  required: ['messages', 'socialAction', 'storyHookId'],
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  activeProvider: 'gemini',
  byokKeys: {},
};

function stable(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function siteCacheKey(request: SiteGenerationRequest, providerId: AIProviderId, model: string): string {
  return [
    'site',
    SITE_PROMPT_VERSION,
    providerId,
    model,
    (request.worldSeed || 'away-message-demo').trim().toLowerCase(),
    (request.locale || 'en').trim().toLowerCase(),
    request.host.trim().toLowerCase(),
    request.pathname.trim() || '/',
  ].join(':');
}

function chatCacheKey(request: ChatGenerationRequest, providerId: AIProviderId, model: string): string {
  const lastMessages = request.recentMessages.slice(-8);
  return [
    'chat',
    CHAT_PROMPT_VERSION,
    providerId,
    model,
    request.buddyId,
    request.playerMessage.trim(),
    stable(lastMessages),
    request.relationshipSummary.trim(),
  ].join(':');
}

function buildSitePrompts(request: SiteGenerationRequest): { system: string; user: string } {
  const archetype = getSiteArchetype(request.host, request.worldSeed);
  return {
    system: [
      'You generate small fictional websites for a narrative desktop game set around 1998-2006.',
      'Return JSON only and follow the provided schema exactly.',
      'Use fictional names and local .local links only. Never include real URLs, HTML, CSS, JavaScript, scripts, or executable code.',
      'The archetype is a strong design direction, not a fixed template. Vary the number and wording of sections, navigation labels, visual palette, status copy, and small details on every host.',
      'Use one of the allowed layouts and choose a five-color hex palette that fits the site. Do not default every site to blue paper with the same header.',
      'Keep the site period-authentic but let the archetype decide whether it feels like a forum, shop, archive, fan page, newsletter, directory, or personal homepage.',
      'Do not create supernatural claims as facts. Story hooks must be short identifiers or empty content that the game can ignore.',
    ].join(' '),
    user: [
      `Create a fictional site for host "${request.host}" at path "${request.pathname}".`,
      `Selected archetype: ${archetype.label}. Direction: ${archetype.direction}`,
      `Recommended content: ${archetype.recommendedSections}. Visual motif: ${archetype.visualMotif}.`,
      'The result must feel like an independent site rather than another copy of a generic portal.',
    ].join('\n'),
  };
}

function buildChatPrompts(request: ChatGenerationRequest): { system: string; user: string } {
  return {
    system: [
      'You write one short, believable instant-message reply for a fictional NPC in a late-1990s/early-2000s desktop simulation.',
      'Return JSON only and follow the provided schema exactly.',
      'Stay in the persona, do not mention being an AI, and do not invent irreversible game events.',
      'Do not change money, files, relationships, or narrative state. Choose only one allowed socialAction.',
      'Prefer lowercase shorthand, pauses, emoticons, and era-appropriate tone when they fit the persona.',
    ].join(' '),
    user: [
      `NPC: ${request.displayName} (${request.handle})`,
      `Persona: ${request.persona}`,
      `Relationship snapshot: ${request.relationshipSummary}`,
      `Recent messages: ${JSON.stringify(request.recentMessages.slice(-8))}`,
      `Player message: ${request.playerMessage}`,
      'Reply with one or two short messages, not a monologue.',
    ].join('\n'),
  };
}

function stringValue(value: unknown, fallback: string, max: number): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback;
}

function layoutValue(value: unknown, fallback: GeneratedSiteContent['layout']): GeneratedSiteContent['layout'] {
  const layouts: GeneratedSiteContent['layout'][] = ['centered', 'columns', 'forum', 'catalog', 'newspaper', 'sidebar'];
  return typeof value === 'string' && layouts.includes(value as GeneratedSiteContent['layout']) ? value as GeneratedSiteContent['layout'] : fallback;
}

function normalizeInternalHref(value: unknown): string {
  if (typeof value !== 'string') return '/';
  const raw = value.trim();
  try {
    if (raw.startsWith('/')) {
      const path = raw.split('#')[0] ?? '/';
      return /^\/[a-zA-Z0-9_./?=&%-]*$/.test(path) ? path.slice(0, 160) : '/';
    }

    const parsed = new URL(raw);
    if (parsed.hostname.endsWith('.local')) {
      const path = `${parsed.pathname || '/'}${parsed.search || ''}`.split('#')[0] ?? '/';
      return /^\/[a-zA-Z0-9_./?=&%-]*$/.test(path) ? path.slice(0, 160) : '/';
    }
  } catch {
    const path = `/${raw.replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '')}`;
    return path === '/' ? '/' : path.slice(0, 160);
  }

  return '/';
}

export function normalizeGeneratedSitePayload(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const raw = value as Record<string, unknown>;
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const rawLinks = Array.isArray(raw.links) ? raw.links : [];
  const fallbackArchetype = getSiteArchetype(String(raw.siteName || 'fictional-site'));
  const archetype = stringValue(raw.archetype, fallbackArchetype.label, 60);
  const themeFallback = fallbackArchetype.theme;

  return {
    siteName: stringValue(raw.siteName, 'fictional local site', 80),
    title: stringValue(raw.title, 'under construction', 120),
    tagline: stringValue(raw.tagline, 'best viewed at 800x600', 240),
    eraStyle: stringValue(raw.eraStyle, 'handmade personal portal', 80),
    archetype,
    layout: layoutValue(raw.layout, fallbackArchetype.defaultLayout),
    theme: {
      primary: colorValue((raw.theme as Record<string, unknown> | undefined)?.primary, themeFallback.primary),
      secondary: colorValue((raw.theme as Record<string, unknown> | undefined)?.secondary, themeFallback.secondary),
      accent: colorValue((raw.theme as Record<string, unknown> | undefined)?.accent, themeFallback.accent),
      paper: colorValue((raw.theme as Record<string, unknown> | undefined)?.paper, themeFallback.paper),
      text: colorValue((raw.theme as Record<string, unknown> | undefined)?.text, themeFallback.text),
    },
    statusLine: stringValue(raw.statusLine, 'last updated: recently', 180),
    footerNote: stringValue(raw.footerNote, 'A small corner of the Orion web.', 240),
    sections: rawSections.map((section) => {
      const item = section && typeof section === 'object' ? section as Record<string, unknown> : {};
      return {
        heading: stringValue(item.heading, 'Notice', 80),
        body: stringValue(item.body, 'The webmaster has not written this section yet.', 800),
        items: Array.isArray(item.items) ? item.items.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().slice(0, 180)).filter(Boolean).slice(0, 12) : [],
      };
    }).slice(0, 8),
    links: rawLinks.map((link) => {
      const item = link && typeof link === 'object' ? link as Record<string, unknown> : {};
      return {
        label: stringValue(item.label, 'home', 80),
        href: normalizeInternalHref(item.href),
      };
    }).slice(0, 16),
    quirks: Array.isArray(raw.quirks) ? raw.quirks.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().slice(0, 180)).filter(Boolean).slice(0, 10) : [],
    searchKeywords: Array.isArray(raw.searchKeywords) ? raw.searchKeywords.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().slice(0, 40)).filter(Boolean).slice(0, 20) : [],
    storyHooks: Array.isArray(raw.storyHooks) ? raw.storyHooks.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().slice(0, 120)).filter(Boolean).slice(0, 8) : [],
  };
}

function makeFallbackSite(request: SiteGenerationRequest): GeneratedSiteContent {
  const readableName = request.host.replace(/\.local$/i, '').replace(/[-_]/g, ' ');
  const archetype = getSiteArchetype(request.host, request.worldSeed);
  const theme = archetype.theme;
  return {
    siteName: `${readableName} local`,
    title: `${readableName.toUpperCase()} — ${archetype.label}`,
    tagline: `${archetype.direction.split('.')[0]}.`,
    eraStyle: 'handmade Orion web page',
    archetype: archetype.label,
    layout: archetype.defaultLayout,
    theme,
    statusLine: `offline copy • ${archetype.label} • last updated: sometime yesterday`,
    footerNote: `${archetype.visualMotif}; generated as an offline test copy.`,
    sections: [
      {
        heading: 'Welcome, visitor',
        body: `This placeholder page for ${request.host} is assembled from the site name while the connection is quiet.`,
        items: ['guestbook coming soon', 'last updated: sometime yesterday', 'please email the webmaster'],
      },
      {
        heading: 'Local notice board',
        body: 'The page is available offline. Try refreshing later for a newly generated version.',
        items: ['free counter: 00427', 'under construction gif missing', 'sign my guestbook'],
      },
    ],
    links: [{ label: 'home', href: '/' }],
    quirks: ['a missing image icon appears where the logo should be'],
    searchKeywords: [readableName, 'local', 'under construction'],
    storyHooks: [],
  };
}

function makeFallbackChat(request: ChatGenerationRequest): GeneratedChatResponse {
  const name = request.displayName || request.buddyId;
  return {
    messages: [{ text: `uhh hey, ${name} here... connection's being weird. what were you saying?`, tone: 'distracted' }],
    socialAction: 'none',
    storyHookId: null,
  };
}

function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (!value || typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    if (key === 'additionalProperties') continue;
    if (key === 'type' && typeof child === 'string') {
      output[key] = child.toUpperCase();
    } else if (key === 'type' && Array.isArray(child)) {
      output[key] = child[0] === 'string' ? 'STRING' : child[0];
      if (child.includes('null')) output.nullable = true;
    } else {
      output[key] = toGeminiSchema(child);
    }
  }
  return output;
}

async function invokeProvider(
  providerId: AIProviderId,
  model: string,
  key: string,
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await completeJson({
      providerId,
      model,
      apiKey: key,
      systemPrompt,
      userPrompt,
      jsonSchema: providerId === 'gemini' ? toGeminiSchema(schema) as Record<string, unknown> : schema,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export class AIGenerationService {
  public async generateSite(
    request: SiteGenerationRequest,
    settings: AISettings = DEFAULT_AI_SETTINGS
  ): Promise<AIResult<GeneratedSiteContent>> {
    const providerId = request.providerId || settings.activeProvider;
    const model = getProviderModel(providerId);
    const cacheKey = siteCacheKey(request, providerId, model);
    const startedAt = performance.now();

    if (request.useCache !== false) {
      const cached = await readAICache<GeneratedSiteContent>(cacheKey);
      if (cached) {
        return {
          data: parseGeneratedSite(cached.payload),
          meta: { providerId, model, keySource: 'none', latencyMs: Math.round(performance.now() - startedAt), fromCache: true, fallback: false },
        };
      }
    }

    const { key, source } = resolveApiKey(providerId, settings);
    if (!key) {
      return {
        data: makeFallbackSite(request),
        meta: { providerId, model, keySource: 'none', latencyMs: Math.round(performance.now() - startedAt), fromCache: false, fallback: true, error: 'No API key configured.' },
      };
    }

    try {
      const prompts = buildSitePrompts(request);
      const raw = await invokeProvider(providerId, model, key, prompts.system, prompts.user, SITE_JSON_SCHEMA);
      const parsed = parseGeneratedSite(normalizeGeneratedSitePayload(raw));
      await writeAICache({ key: cacheKey, kind: 'site', providerId, model, payload: parsed });
      return {
        data: parsed,
        meta: { providerId, model, keySource: source, latencyMs: Math.round(performance.now() - startedAt), fromCache: false, fallback: false },
      };
    } catch (error) {
      return {
        data: makeFallbackSite(request),
        meta: { providerId, model, keySource: source, latencyMs: Math.round(performance.now() - startedAt), fromCache: false, fallback: true, error: error instanceof Error ? error.message : 'Unknown AI error.' },
      };
    }
  }

  public async generateChat(
    request: ChatGenerationRequest,
    settings: AISettings = DEFAULT_AI_SETTINGS
  ): Promise<AIResult<GeneratedChatResponse>> {
    const providerId = request.providerId || settings.activeProvider;
    const model = getProviderModel(providerId);
    const cacheKey = chatCacheKey(request, providerId, model);
    const startedAt = performance.now();

    if (request.useCache !== false) {
      const cached = await readAICache<GeneratedChatResponse>(cacheKey);
      if (cached) {
        return {
          data: parseGeneratedChat(cached.payload),
          meta: { providerId, model, keySource: 'none', latencyMs: Math.round(performance.now() - startedAt), fromCache: true, fallback: false },
        };
      }
    }

    const { key, source } = resolveApiKey(providerId, settings);
    if (!key) {
      return {
        data: makeFallbackChat(request),
        meta: { providerId, model, keySource: 'none', latencyMs: Math.round(performance.now() - startedAt), fromCache: false, fallback: true, error: 'No API key configured.' },
      };
    }

    try {
      const prompts = buildChatPrompts(request);
      const parsed = parseGeneratedChat(await invokeProvider(providerId, model, key, prompts.system, prompts.user, CHAT_JSON_SCHEMA));
      await writeAICache({ key: cacheKey, kind: 'chat', providerId, model, payload: parsed });
      return {
        data: parsed,
        meta: { providerId, model, keySource: source, latencyMs: Math.round(performance.now() - startedAt), fromCache: false, fallback: false },
      };
    } catch (error) {
      return {
        data: makeFallbackChat(request),
        meta: { providerId, model, keySource: source, latencyMs: Math.round(performance.now() - startedAt), fromCache: false, fallback: true, error: error instanceof Error ? error.message : 'Unknown AI error.' },
      };
    }
  }

  public async benchmarkSite(request: SiteGenerationRequest, settings: AISettings): Promise<BenchmarkResult> {
    const providerId = request.providerId || settings.activeProvider;
    const result = await this.generateSite({ ...request, providerId, useCache: false }, settings);
    return {
      kind: 'site',
      providerId,
      model: result.meta.model,
      ok: !result.meta.fallback,
      latencyMs: result.meta.latencyMs,
      structuralScore: scoreSite(result.data),
      preview: `${result.data.title}\n${result.data.tagline}`,
      error: result.meta.error,
      data: result.data,
    };
  }

  public async benchmarkChat(request: ChatGenerationRequest, settings: AISettings): Promise<BenchmarkResult> {
    const providerId = request.providerId || settings.activeProvider;
    const result = await this.generateChat({ ...request, providerId, useCache: false }, settings);
    return {
      kind: 'chat',
      providerId,
      model: result.meta.model,
      ok: !result.meta.fallback,
      latencyMs: result.meta.latencyMs,
      structuralScore: scoreChat(result.data),
      preview: result.data.messages.map((message) => message.text).join(' / '),
      error: result.meta.error,
      data: result.data,
    };
  }
}

function scoreSite(site: GeneratedSiteContent): number {
  const checks = [
    site.siteName.length > 0,
    site.title.length > 0,
    site.tagline.length > 0,
    site.sections.length >= 1,
    site.sections.every((section) => section.heading && section.body),
    site.links.every((link) => link.href.startsWith('/')),
    site.searchKeywords.length >= 1,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function scoreChat(chat: GeneratedChatResponse): number {
  const checks = [
    chat.messages.length >= 1,
    chat.messages.every((message) => message.text.length > 0 && message.text.length <= 500),
    chat.socialAction.length > 0,
    chat.storyHookId === null || chat.storyHookId.length <= 80,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export const aiService = new AIGenerationService();
export { AI_PROVIDERS };

import type { AIKeySource, AIProviderDefinition, AIProviderId, AISettings } from './types';

export const AI_PROVIDERS: AIProviderDefinition[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-3.1-flash-lite',
    envKeyName: 'VITE_GEMINI_API_KEY',
    envModelName: 'VITE_GEMINI_MODEL',
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultModel: 'openai/gpt-oss-20b',
    envKeyName: 'VITE_GROQ_API_KEY',
    envModelName: 'VITE_GROQ_MODEL',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'openrouter/free',
    envKeyName: 'VITE_OPENROUTER_API_KEY',
    envModelName: 'VITE_OPENROUTER_MODEL',
  },
];

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

export function getProviderDefinition(providerId: AIProviderId): AIProviderDefinition {
  const provider = AI_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) throw new Error(`Unknown AI provider: ${providerId}`);
  return provider;
}

export function getProviderModel(providerId: AIProviderId): string {
  const definition = getProviderDefinition(providerId);
  return env[definition.envModelName]?.trim() || definition.defaultModel;
}

export function resolveApiKey(
  providerId: AIProviderId,
  settings: AISettings = { activeProvider: providerId, byokKeys: {} }
): { key: string; source: AIKeySource } {
  const byok = settings.byokKeys[providerId]?.trim();
  if (byok) return { key: byok, source: 'byok' };

  const definition = getProviderDefinition(providerId);
  const fromEnv = env[definition.envKeyName]?.trim();
  if (fromEnv) return { key: fromEnv, source: 'env' };

  return { key: '', source: 'none' };
}

export function hasConfiguredKey(providerId: AIProviderId, settings: AISettings): boolean {
  return resolveApiKey(providerId, settings).source !== 'none';
}

export interface ProviderCompletionInput {
  providerId: AIProviderId;
  model: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  signal: AbortSignal;
}

export async function completeJson(input: ProviderCompletionInput): Promise<unknown> {
  switch (input.providerId) {
    case 'gemini':
      return completeGemini(input);
    case 'groq':
      return completeOpenAICompatible(input, 'https://api.groq.com/openai/v1/chat/completions');
    case 'openrouter':
      return completeOpenAICompatible(input, 'https://openrouter.ai/api/v1/chat/completions');
  }
}

async function completeGemini(input: ProviderCompletionInput): Promise<unknown> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: input.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: input.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: input.jsonSchema,
          temperature: 0.8,
        },
      }),
    }
  );

  const payload = await readJsonResponse(response);
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('');
  if (!text) throw new Error('Gemini returned an empty response.');
  return JSON.parse(text);
}

async function completeOpenAICompatible(input: ProviderCompletionInput, endpoint: string): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
      ...(input.providerId === 'openrouter'
        ? {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Away Message AI Lab',
          }
        : {}),
    },
    signal: input.signal,
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      temperature: 0.8,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: input.providerId === 'groq' ? 'away_message_output' : 'away_message_output',
          strict: true,
          schema: input.jsonSchema,
        },
      },
    }),
  });

  const payload = await readJsonResponse(response);
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${input.providerId} returned an empty response.`);
  return JSON.parse(text);
}

async function readJsonResponse(response: Response): Promise<any> {
  const raw = await response.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`AI provider returned non-JSON HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const detail = payload?.error?.message || payload?.error?.status || `HTTP ${response.status}`;
    throw new Error(String(detail).slice(0, 300));
  }

  return payload;
}

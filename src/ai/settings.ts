import type { AIProviderId, AISettings } from './types';
import { DEFAULT_AI_SETTINGS } from './service';

const STORAGE_KEY = 'away-message-ai-settings-v1';

export function loadAISettings(): AISettings {
  if (typeof window === 'undefined') return { ...DEFAULT_AI_SETTINGS, byokKeys: {} };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS, byokKeys: {} };
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    const activeProvider: AIProviderId = parsed.activeProvider === 'groq' || parsed.activeProvider === 'openrouter' ? parsed.activeProvider : 'gemini';
    const byokKeys = parsed.byokKeys && typeof parsed.byokKeys === 'object' ? parsed.byokKeys : {};
    return { activeProvider, byokKeys };
  } catch {
    return { ...DEFAULT_AI_SETTINGS, byokKeys: {} };
  }
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearBYOK(settings: AISettings, providerId: AIProviderId): AISettings {
  const nextKeys = { ...settings.byokKeys };
  delete nextKeys[providerId];
  const next = { ...settings, byokKeys: nextKeys };
  saveAISettings(next);
  return next;
}

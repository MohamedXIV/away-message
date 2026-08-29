export type AIProviderId = 'gemini' | 'groq' | 'openrouter';
export type AIKeySource = 'env' | 'byok' | 'none';

export interface AIProviderDefinition {
  id: AIProviderId;
  label: string;
  defaultModel: string;
  envKeyName: string;
  envModelName: string;
}

export interface AISettings {
  activeProvider: AIProviderId;
  byokKeys: Partial<Record<AIProviderId, string>>;
}

export interface GeneratedSiteSection {
  heading: string;
  body: string;
  items: string[];
}

export interface GeneratedSiteLink {
  label: string;
  href: string;
}

export type GeneratedSiteLayout = 'centered' | 'columns' | 'forum' | 'catalog' | 'newspaper' | 'sidebar';

export interface GeneratedSiteTheme {
  primary: string;
  secondary: string;
  accent: string;
  paper: string;
  text: string;
}

export interface GeneratedSiteContent {
  siteName: string;
  title: string;
  tagline: string;
  eraStyle: string;
  archetype: string;
  layout: GeneratedSiteLayout;
  theme: GeneratedSiteTheme;
  statusLine: string;
  footerNote: string;
  sections: GeneratedSiteSection[];
  links: GeneratedSiteLink[];
  quirks: string[];
  searchKeywords: string[];
  storyHooks: string[];
}

export type SocialAction =
  | 'empathy'
  | 'remembered_detail'
  | 'tease_playful'
  | 'dismissive'
  | 'vulnerable_share'
  | 'work_camaraderie'
  | 'intellectual_curiosity'
  | 'none';

export interface GeneratedChatMessage {
  text: string;
  tone: string;
}

export interface GeneratedChatResponse {
  messages: GeneratedChatMessage[];
  socialAction: SocialAction;
  storyHookId: string | null;
}

export interface AIResultMeta {
  providerId: AIProviderId;
  model: string;
  keySource: AIKeySource;
  latencyMs: number;
  fromCache: boolean;
  fallback: boolean;
  error?: string;
}

export interface AIResult<T> {
  data: T;
  meta: AIResultMeta;
}

export interface SiteGenerationRequest {
  host: string;
  pathname: string;
  worldSeed?: string;
  locale?: string;
  providerId?: AIProviderId;
  useCache?: boolean;
}

export interface ChatGenerationRequest {
  buddyId: string;
  displayName: string;
  handle: string;
  persona: string;
  relationshipSummary: string;
  recentMessages: Array<{ sender: string; text: string }>;
  playerMessage: string;
  providerId?: AIProviderId;
  useCache?: boolean;
}

export interface BenchmarkResult {
  kind: 'site' | 'chat';
  providerId: AIProviderId;
  model: string;
  ok: boolean;
  latencyMs: number;
  structuralScore: number;
  preview: string;
  error?: string;
  data?: GeneratedSiteContent | GeneratedChatResponse;
}

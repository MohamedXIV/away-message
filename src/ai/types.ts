export type AIProviderId = 'gemini' | 'groq' | 'openrouter' | 'fal';
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

export type GeneratedSiteLayout =
  | 'centered'
  | 'columns'
  | 'forum'
  | 'catalog'
  | 'newspaper'
  | 'sidebar'
  | 'geocities_table'
  | 'myspace_profile'
  | 'guestbook'
  | 'blog_diary'
  | 'webring';

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
  imagePrompt?: string | null;
  imageCaption?: string | null;
}

export interface GeneratedChatResponse {
  messages: GeneratedChatMessage[];
  socialAction: SocialAction;
  storyHookId: string | null;
  imagePrompt?: string | null;
  imageCaption?: string | null;
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
  worldKnowledge?: string;
  currentDay?: number;
}

export interface ReplySuggestionRequest {
  buddyId: string;
  displayName: string;
  /** Short NPC persona line so suggestions fit who the player is talking to. */
  buddyPersona?: string;
  relationshipSummary: string;
  recentMessages: Array<{ sender: string; text: string }>;
  /** One recalled fact/memory to ground a suggestion (optional). */
  memoryHint?: string;
  providerId?: AIProviderId;
}

export interface SuggestedReplies {
  replies: string[];
}

/** Approved semantic input for an Inner Voice paraphrase (#23). Meaning only — never hidden knowledge. */
export interface InnerVoiceParaphraseRequest {
  semanticMeaning: string;
  tone: string;
  topic: string;
  voiceHint?: string;
}

/** The only shape an Inner Voice paraphrase may take: one short thought, nothing else. */
export interface InnerVoiceThought {
  thought: string;
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

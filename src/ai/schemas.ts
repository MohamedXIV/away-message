import { z } from 'zod';
import type { GeneratedChatResponse, GeneratedSiteContent, SuggestedReplies } from './types';

const boundedText = (max: number) => z.string().trim().min(1).max(max);

const DEFAULT_SITE_THEME = {
  primary: '#1b4965',
  secondary: '#cae9ff',
  accent: '#f4a261',
  paper: '#f7f3df',
  text: '#1f2933',
};

export const GeneratedSiteSchema = z.object({
  siteName: boundedText(80),
  title: boundedText(120),
  tagline: boundedText(240),
  eraStyle: boundedText(80),
  archetype: boundedText(60).default('personal homepage'),
  layout: z.enum(['centered', 'columns', 'forum', 'catalog', 'newspaper', 'sidebar', 'geocities_table', 'myspace_profile', 'guestbook', 'blog_diary', 'webring']).default('centered'),
  theme: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    paper: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).strict().default(DEFAULT_SITE_THEME),
  statusLine: boundedText(180).default('last updated: recently'),
  footerNote: boundedText(240).default('A small corner of the Orion web.'),
  sections: z.array(z.object({
    heading: boundedText(80),
    body: boundedText(800),
    items: z.array(boundedText(180)).max(12).default([]),
  })).min(1).max(8),
  links: z.array(z.object({
    label: boundedText(80),
    href: z.string().regex(/^\/[a-zA-Z0-9_./?=&%-]*$/).max(160),
  })).max(16).default([]),
  quirks: z.array(boundedText(180)).max(10).default([]),
  searchKeywords: z.array(boundedText(40)).max(20).default([]),
  storyHooks: z.array(boundedText(120)).max(8).default([]),
}).strict();

export const GeneratedChatResponseSchema = z.object({
  messages: z.array(z.object({
    text: boundedText(500),
    tone: boundedText(40),
    imagePrompt: z.string().trim().max(200).nullable().optional(),
    imageCaption: z.string().trim().max(120).nullable().optional(),
  })).min(1).max(3),
  socialAction: z.enum([
    'empathy',
    'remembered_detail',
    'tease_playful',
    'dismissive',
    'vulnerable_share',
    'work_camaraderie',
    'intellectual_curiosity',
    'none',
  ]),
  storyHookId: z.string().trim().max(80).nullable(),
  imagePrompt: z.string().trim().max(200).nullable().optional(),
  imageCaption: z.string().trim().max(120).nullable().optional(),
}).strict();

export function parseGeneratedSite(value: unknown): GeneratedSiteContent {
  return GeneratedSiteSchema.parse(value);
}

export function parseGeneratedChat(value: unknown): GeneratedChatResponse {
  return GeneratedChatResponseSchema.parse(value);
}

export const SuggestedRepliesSchema = z.object({
  replies: z.array(boundedText(120)).min(3).max(3),
}).strict();

/** Lenient parse: trims/dedupes model output into exactly 3 replies, or throws. */
export function parseSuggestedReplies(value: unknown): SuggestedReplies {
  const parsed = SuggestedRepliesSchema.parse(value);
  const seen = new Set<string>();
  const replies = parsed.replies
    .map((reply) => reply.trim().replace(/\s+/g, ' ').slice(0, 120))
    .filter((reply) => {
      const key = reply.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (replies.length < 3) throw new Error('Expected 3 distinct suggested replies.');
  return { replies };
}

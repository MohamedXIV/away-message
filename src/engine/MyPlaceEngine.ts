// src/engine/MyPlaceEngine.ts
// Heavy MyPlace — versioned like Orion OS, with profile, Top 8, guestbook, and governed procedural updates.

import { EventBus } from './EventBus';
import {
  getAllMyPlaceReleases,
  getMyPlaceReleaseById,
  registerProceduralMyPlaceRelease,
  getProceduralMyPlaceReleases,
  restoreProceduralMyPlaceReleases,
  type MyPlaceRelease,
} from './MyPlaceCatalog';
import { CHARACTER_ARCHETYPES } from './characterTemplates';
import { CORE_BUDDIES } from './coreBuddies';
import type { CharacterArchetype } from './types';

export interface MyPlaceProfile {
  username: string;
  displayName: string;
  headline: string;
  bio: string;
  interests: string[];
  songTitle: string;
  avatarGlyph: string;
  top8: Array<{ handle: string; name: string; avatar: string }>;
  glitterIntensity: number; // 0..5
  tiledBackground?: string; // e.g. 'stars', 'hearts', null
  archetype?: CharacterArchetype;
  visibility?: 'public' | 'friendsOnly';
}

export interface MyPlaceEngineState {
  currentMyPlaceId: string; // e.g. 'myplace_2.0'
  lastUpdateAtMinute?: number;
  lastUpdateLog?: string[];
  userProfile: MyPlaceProfile;
  npcProfiles: Record<string, MyPlaceProfile>; // maya_x, tacocart_ryan, nightowl87
  guestbook: Record<string, Array<{ author: string; text: string; date: string; minute: number }>>; // key: username
  proceduralCatalog?: MyPlaceRelease[];
}

/**
 * P5.4 legacy handle aliases: engine buddy ids/handles predate these profile keys
 * (buddy 'maya' / handle 'starlight_maya' ↔ profile 'maya_x'). Used to resolve
 * which profile page belongs to a buddy. Derived from the registry.
 */
export const CORE_PROFILE_ALIASES: Record<string, string> = Object.fromEntries(
  CORE_BUDDIES.flatMap((b) => (b.myplace ? [[b.id, b.myplace], [b.handle, b.myplace]] : []))
);

const DEFAULT_PROFILE: MyPlaceProfile = {
  username: 'wanderer06',
  displayName: 'wanderer06',
  headline: 'New in Oakhaven — Room 104',
  bio: 'Just moved. Learning the hum of the canal.',
  interests: ['Music', 'Walks'],
  songTitle: '— none —',
  avatarGlyph: '💻',
  top8: [],
  glitterIntensity: 0,
  visibility: 'public',
};

/**
 * Roster-driven NPC pages: every registry buddy with a myplace username gets
 * a generated page (archetype template × backstory flavor). No hand-authored
 * profiles — rename the data and the pages follow. Top 8 starts empty and
 * fills through the affinity refresh; guestbooks start empty and fill
 * through life.
 */
export function buildRosterProfile(input: {
  username: string;
  displayName: string;
  archetype?: CharacterArchetype;
  backstory?: { label?: string; bioSeed?: string };
}): MyPlaceProfile {
  const archetype: CharacterArchetype = input.archetype && CHARACTER_ARCHETYPES[input.archetype] ? input.archetype : 'regular';
  const template = CHARACTER_ARCHETYPES[archetype] ?? CHARACTER_ARCHETYPES['regular'];
  const bioSeed = (input.backstory?.bioSeed || '').trim();
  return {
    username: input.username,
    displayName: input.displayName,
    headline: `${input.displayName} • Oakhaven local`,
    bio: bioSeed || template.personaHint,
    interests: [...template.defaultInterests],
    songTitle: template.defaultSong,
    avatarGlyph: MyPlaceEngine.ARCHETYPE_AVATARS[archetype] ?? '👤',
    top8: [],
    glitterIntensity: 0,
    visibility: 'public',
    archetype,
  };
}

export class MyPlaceEngine {
  private eventBus: EventBus;
  private currentMyPlaceId: string;
  private lastUpdateAtMinute?: number;
  private lastUpdateLog: string[] = [];
  private userProfile: MyPlaceProfile;
  private npcProfiles: Map<string, MyPlaceProfile> = new Map();
  private guestbook: Map<string, Array<{ author: string; text: string; date: string; minute: number }>> = new Map();

  constructor(eventBus: EventBus, initialState?: Partial<MyPlaceEngineState>) {
    this.eventBus = eventBus;
    this.currentMyPlaceId = initialState?.currentMyPlaceId ?? 'myplace_1.0';
    this.lastUpdateAtMinute = initialState?.lastUpdateAtMinute;
    this.lastUpdateLog = initialState?.lastUpdateLog ?? [];
    this.userProfile = initialState?.userProfile ? { ...initialState.userProfile } : { ...DEFAULT_PROFILE };
    // NPC profiles — generated from the content roster (no hand-authored pages).
    if (initialState?.npcProfiles) {
      for (const [k, v] of Object.entries(initialState.npcProfiles)) this.npcProfiles.set(k, { ...v, top8: v.top8.map((t) => ({ ...t })) });
    } else {
      for (const b of CORE_BUDDIES) {
        if (!b.myplace) continue;
        this.npcProfiles.set(b.myplace, buildRosterProfile({
          username: b.myplace,
          displayName: b.displayName,
          archetype: b.archetype,
          backstory: b.backstory ?? undefined,
        }));
      }
    }
    if (initialState?.guestbook) {
      for (const [k, v] of Object.entries(initialState.guestbook)) this.guestbook.set(k, v.map((e) => ({ ...e })));
    }
    // Guestbooks start empty — life fills them (no seeded history).
    if (initialState?.proceduralCatalog) {
      try {
        restoreProceduralMyPlaceReleases(initialState.proceduralCatalog);
      } catch {}
    }
  }

  public getCurrentRelease(): MyPlaceRelease {
    return getMyPlaceReleaseById(this.currentMyPlaceId) ?? getMyPlaceReleaseById('myplace_1.0')!;
  }

  public getCurrentMyPlaceId(): string {
    return this.currentMyPlaceId;
  }

  public getState(): MyPlaceEngineState {
    let procedural: MyPlaceRelease[] = [];
    try {
      procedural = getProceduralMyPlaceReleases();
    } catch {
      procedural = [];
    }
    const gb: Record<string, Array<{ author: string; text: string; date: string; minute: number }>> = {};
    for (const [k, v] of this.guestbook.entries()) gb[k] = v.map((e) => ({ ...e }));
    const npc: Record<string, MyPlaceProfile> = {};
    for (const [k, v] of this.npcProfiles.entries()) npc[k] = { ...v, top8: v.top8.map((t) => ({ ...t })) };
    return {
      currentMyPlaceId: this.currentMyPlaceId,
      lastUpdateAtMinute: this.lastUpdateAtMinute,
      lastUpdateLog: [...this.lastUpdateLog],
      userProfile: { ...this.userProfile, top8: this.userProfile.top8.map((t) => ({ ...t })) },
      npcProfiles: npc,
      guestbook: gb,
      proceduralCatalog: procedural,
    };
  }

  public loadState(state: Partial<MyPlaceEngineState>): void {
    if (state.currentMyPlaceId) this.currentMyPlaceId = state.currentMyPlaceId;
    if (state.lastUpdateAtMinute !== undefined) this.lastUpdateAtMinute = state.lastUpdateAtMinute;
    if (state.lastUpdateLog) this.lastUpdateLog = [...state.lastUpdateLog];
    if (state.userProfile) this.userProfile = { ...state.userProfile, top8: state.userProfile.top8.map((t) => ({ ...t })) };
    if (state.npcProfiles) {
      this.npcProfiles.clear();
      for (const [k, v] of Object.entries(state.npcProfiles)) this.npcProfiles.set(k, { ...v, top8: v.top8.map((t) => ({ ...t })) });
    }
    if (state.guestbook) {
      this.guestbook.clear();
      for (const [k, v] of Object.entries(state.guestbook)) this.guestbook.set(k, v.map((e) => ({ ...e })));
    }
    if (state.proceduralCatalog) {
      try {
        restoreProceduralMyPlaceReleases(state.proceduralCatalog);
      } catch {}
    }
  }

  public getAvailableReleases(currentDay: number): MyPlaceRelease[] {
    return getAllMyPlaceReleases()
      .filter((r) => r.releaseDay <= currentDay)
      .filter((r) => r.id !== this.currentMyPlaceId);
  }

  public canUpdateTo(targetId: string, currentDay: number): { ok: boolean; reasons: string[]; release?: MyPlaceRelease } {
    const target = getMyPlaceReleaseById(targetId);
    if (!target) return { ok: false, reasons: [`Unknown MyPlace release: ${targetId}`] };
    const reasons: string[] = [];
    if (target.releaseDay > currentDay) reasons.push(`Not yet released (Day ${target.releaseDay}, today Day ${currentDay}).`);
    if (target.id === this.currentMyPlaceId) reasons.push(`Already on ${target.displayName}.`);
    return { ok: reasons.length === 0, reasons, release: target };
  }

  public updateTo(targetId: string, currentDay: number, currentMinute: number): { success: boolean; error?: string; release?: MyPlaceRelease } {
    const check = this.canUpdateTo(targetId, currentDay);
    if (!check.ok) return { success: false, error: check.reasons.join(' ') };
    const target = check.release!;
    const prev = this.currentMyPlaceId;
    this.currentMyPlaceId = target.id;
    this.lastUpdateAtMinute = currentMinute;
    this.log(`Updated ${prev} → ${target.id} (${target.displayName})`);
    this.eventBus.emit('world:global_event_triggered' as any, { event: { id: target.id, title: target.displayName, category: 'site_launch' } });
    return { success: true, release: target };
  }

  // Auto-advance: called when WorldEvents triggers a MyPlace site_launch — sync version forward
  public syncFromWorldState(_world: { triggeredEvents: Array<{ id: string; title: string; category: string; triggerDay: number }> }, currentDay: number, currentMinute: number): void {
    const all = getAllMyPlaceReleases().filter((r) => r.releaseDay <= currentDay);
    if (all.length === 0) return;
    const latest = all[all.length - 1]!;
    if (latest.id !== this.currentMyPlaceId) {
      const can = this.canUpdateTo(latest.id, currentDay);
      if (can.ok) this.updateTo(latest.id, currentDay, currentMinute);
    }
  }

  public registerProceduralRelease(release: MyPlaceRelease): MyPlaceRelease {
    const added = registerProceduralMyPlaceRelease(release);
    this.eventBus.emit('world:global_event_triggered' as any, { event: { id: added.id, title: added.displayName, category: 'site_launch' } });
    return added;
  }

  // Profile — user and NPCs
  public getUserProfile(): MyPlaceProfile {
    return { ...this.userProfile, top8: this.userProfile.top8.map((t) => ({ ...t })) };
  }

  public updateUserProfile(patch: Partial<MyPlaceProfile>): void {
    this.userProfile = { ...this.userProfile, ...patch, top8: patch.top8 ? patch.top8.map((t) => ({ ...t })) : this.userProfile.top8 };
  }

  public getNpcProfile(username: string): MyPlaceProfile | undefined {
    const p = this.npcProfiles.get(username);
    return p ? { ...p, top8: p.top8.map((t) => ({ ...t })) } : undefined;
  }

  public static readonly ARCHETYPE_AVATARS: Record<CharacterArchetype, string> = {
    coworker: '🧰',
    nightowl: '🦉',
    student: '🎒',
    trader: '📈',
    artist: '🎸',
    regular: '🙂',
  };

  /**
   * Ensure a MyPlace page exists for a newly registered buddy.
   * Stub is derived from the archetype template + backstory flavor (not
   * hardcoded per-id), so any buddy gets a sensible page on first sight.
   */
  public ensureNpcProfile(input: { username: string; displayName: string; archetype?: CharacterArchetype; backstory?: { label?: string; bioSeed?: string } }): MyPlaceProfile {
    const existing = this.npcProfiles.get(input.username);
    if (existing) return { ...existing, top8: existing.top8.map((t) => ({ ...t })) };
    const stub = buildRosterProfile(input);
    this.npcProfiles.set(input.username, stub);
    return { ...stub, top8: [] };
  }

  public getAllNpcProfiles(): Record<string, MyPlaceProfile> {
    const out: Record<string, MyPlaceProfile> = {};
    for (const [k, v] of this.npcProfiles.entries()) out[k] = { ...v, top8: v.top8.map((t) => ({ ...t })) };
    return out;
  }

  public updateNpcProfile(username: string, patch: Partial<MyPlaceProfile>): void {
    const existing = this.npcProfiles.get(username);
    if (!existing) return;
    const updated = { ...existing, ...patch, top8: patch.top8 ? patch.top8.map((t) => ({ ...t })) : existing.top8 };
    this.npcProfiles.set(username, updated);
    this.log(`NPC ${username} updated profile: ${patch.headline ?? patch.bio?.slice(0, 30) ?? 'change'}`);
    this.eventBus.emit('myplace:profile_updated' as any, { username, profile: { ...updated } });
  }

  // AI-driven periodic NPC profile mutation — governed, personality-consistent.
  // Candidates are ALL npc profiles (core 3 keep their exact legacy personas/picks).
  public async maybeUpdateRandomNpcProfile(currentDay: number, currentMinute: number, _socialEngine?: { getRelationships: (id: string) => unknown }): Promise<{ username: string; profile: MyPlaceProfile } | null> {
    // Throttle: only once every 2 days, 30% chance
    if (currentDay < 3) return null;
    const roll = this.hash(`${this.currentMyPlaceId}:${currentDay}`) % 100;
    if (roll > 35) return null;
    const candidates = [...this.npcProfiles.keys()];
    if (candidates.length === 0) return null;
    const pickIdx = this.hash(`pick:${currentDay}:${currentMinute}`) % candidates.length;
    const username = candidates[pickIdx]!;
    const current = this.npcProfiles.get(username);
    if (!current) return null;

    // Try AI, fallback to template mutation
    try {
      // Persona comes from the page itself (bio carries the voice) — no per-id map.
      const persona = `${current.bio.slice(0, 120)} Interests: ${current.interests.join(', ')}`;
      const features = this.getCurrentRelease().features;
      const prompt = `You are updating MyPlace profile for ${username} (${persona}). Current headline: "${current.headline}" Bio: "${current.bio}" Interests: ${current.interests.join(', ')} Song: "${current.songTitle}" Features available: ${JSON.stringify(features)} Current day: ${currentDay}. Generate a NEW headline (<=60 chars), bio (1-2 sentences, <=180 chars), interests (3-5 tags), and songTitle (if music enabled, else keep). Keep it personality-consistent, mundane, 2005-appropriate, no real brands. Return JSON.`;
      const { loadAISettings } = await import('../ai/settings');
      const settings = loadAISettings();
      const hasKey = (() => {
        try {
          const prov = settings.activeProvider;
          const keys = (settings.byokKeys as Record<string, string>);
          if (keys[prov]?.trim()) return true;
          const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
          const map: Record<string, string | undefined> = { gemini: 'VITE_GEMINI_API_KEY', groq: 'VITE_GROQ_API_KEY', openrouter: 'VITE_OPENROUTER_API_KEY', fal: 'VITE_FAL_API_KEY' };
          const envKey = map[prov];
          return !!envKey && !!env[envKey]?.trim();
        } catch { return false; }
      })();
      if (hasKey) {
        const { completeJson } = await import('../ai/providers');
        const { getProviderModel, resolveApiKey } = await import('../ai/providers');
        const providerId = settings.activeProvider;
        const model = getProviderModel(providerId);
        const { key } = resolveApiKey(providerId, settings);
        if (key) {
          const schema = {
            type: 'object',
            additionalProperties: false,
            properties: {
              headline: { type: 'string', minLength: 6, maxLength: 60 },
              bio: { type: 'string', minLength: 20, maxLength: 180 },
              interests: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string', minLength: 2, maxLength: 20 } },
              songTitle: { type: 'string', minLength: 3, maxLength: 50 },
            },
            required: ['headline', 'bio', 'interests', 'songTitle'],
          } as const;
          const raw = await completeJson({
            providerId,
            model,
            apiKey: key,
            systemPrompt: 'You update MyPlace profiles. Return JSON only, small and personality-consistent, era 2005, fictional, no real brands.',
            userPrompt: prompt,
            jsonSchema: schema as unknown as Record<string, unknown>,
            signal: new AbortController().signal,
          });
          const parsed = raw as { headline: string; bio: string; interests: string[]; songTitle: string };
          const patch: Partial<MyPlaceProfile> = {
            headline: String(parsed.headline).slice(0, 60),
            bio: String(parsed.bio).slice(0, 180),
            interests: (parsed.interests as string[]).slice(0, 5).map((s) => String(s).slice(0, 20)),
            songTitle: String(parsed.songTitle).slice(0, 50),
          };
          this.updateNpcProfile(username, patch);
          return { username, profile: this.getNpcProfile(username)! };
        }
      }
    } catch {}
    // Fallback: deterministic template mutation from the archetype (rename-proof).
    const arch = current.archetype && CHARACTER_ARCHETYPES[current.archetype] ? current.archetype : 'regular';
    const template = CHARACTER_ARCHETYPES[arch] ?? CHARACTER_ARCHETYPES['regular'];
    const patch: Partial<MyPlaceProfile> = {
      headline: `${current.displayName} update // day ${currentDay}`,
      bio: `${template.blurb} — refreshed my headline and song.`,
      interests: [...template.defaultInterests],
      songTitle: template.defaultSong,
    };
    this.updateNpcProfile(username, patch);
    return { username, profile: this.getNpcProfile(username)! };
  }

  private hash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h;
  }

  public getGuestbook(username: string): Array<{ author: string; text: string; date: string; minute: number }> {
    return [...(this.guestbook.get(username) ?? [])];
  }

  public addGuestbookComment(username: string, author: string, text: string, minute: number): void {
    const list = this.guestbook.get(username) ?? [];
    list.unshift({ author, text, date: 'Just now', minute });
    this.guestbook.set(username, list.slice(0, 20));
  }

  /**
   * P5.4 governed Top 8 rewrite (periodic refresh from live affinities).
   * Validated + capped at 8; unknown profiles rejected. Returns success.
   */
  public setNpcTop8(username: string, top8: Array<{ handle: string; name: string; avatar: string }>): boolean {
    const existing = this.npcProfiles.get(username);
    if (!existing || !Array.isArray(top8)) return false;
    const clean = top8
      .filter((t) => t && typeof t.handle === 'string' && t.handle.trim() && typeof t.name === 'string' && t.name.trim())
      .slice(0, 8)
      .map((t) => ({
        handle: t.handle.trim().slice(0, 40),
        name: t.name.trim().slice(0, 40),
        avatar: typeof t.avatar === 'string' && t.avatar ? t.avatar.slice(0, 8) : '📷',
      }));
    existing.top8 = clean;
    return true;
  }

  private log(msg: string): void {
    this.lastUpdateLog.push(msg);
    if (this.lastUpdateLog.length > 20) this.lastUpdateLog = this.lastUpdateLog.slice(-20);
  }

  public getInstallLog(): string[] {
    return [...this.lastUpdateLog];
  }
}

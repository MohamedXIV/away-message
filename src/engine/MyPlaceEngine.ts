// src/engine/MyPlaceEngine.ts
// Heavy MyPlace — versioned like Orion OS, with profile, Top 8, guestbook, and governed procedural updates.

import { EventBus } from './EventBus';
import {
  getAllMyPlaceReleases,
  getMyPlaceReleaseById,
  registerProceduralMyPlaceRelease,
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

const DEFAULT_NPC_PROFILES: Record<string, MyPlaceProfile> = {  maya_x: {
    username: 'maya_x',
    displayName: 'Maya Lin',
    headline: 'Taking 35mm photos in the rain // 4th St Diner shifts',
    bio: '21. Part-time diner waitress, full-time analogue photography enthusiast. Obsessed with wet pavement neon reflections and motel sign lettering.',
    interests: ['Film Cameras', 'Darkrooms', 'French Fries', 'Lo-Fi Tape Hiss', 'Rain'],
    songTitle: 'Track 03 - Rain Over Motel (Lo-Fi Cut)',
    avatarGlyph: '📷',
    top8: [
      { handle: 'tacocart_ryan', name: 'Ryan', avatar: '🌮' },
      { handle: 'nightowl87', name: 'Nora', avatar: '🦉' },
      { handle: 'wanderer06', name: 'wanderer06', avatar: '💻' },
    ],
    glitterIntensity: 1,
    visibility: 'public',
    archetype: 'artist',
  },
  tacocart_ryan: {
    username: 'tacocart_ryan',
    displayName: 'Ryan (Street Tacos)',
    headline: 'Corner of 4th & Industrial // Best salsa in the district',
    bio: 'Grilling al pastor and carnitas from 11am to midnight. Overclocking PCs and tuning engines when the grill cools down.',
    interests: ['Custom Coolers', 'SDRAM Overclocking', 'Spicy Salsa', 'Motorbikes'],
    songTitle: '4th Street Diner Echoes (Instrumental)',
    avatarGlyph: '🌮',
    top8: [{ handle: 'maya_x', name: 'Maya', avatar: '📷' }],
    glitterIntensity: 0,
    visibility: 'public',
    archetype: 'coworker',
  },
  nightowl87: {
    username: 'nightowl87',
    displayName: 'Nora // Nocturne',
    headline: 'Documenting the sub-canal infrastructure hum',
    bio: 'Late night net archivist. If you listen closely at 3 AM near the sluice gates, you can hear the frequency modulation.',
    interests: ['Audio Forensics', 'Hydroelectric Canals', 'NightBoard Threads', 'Urban Exploration'],
    songTitle: 'Sub-Canal Infrastructure Hum (Field Recording 01)',
    avatarGlyph: '🦉',
    top8: [{ handle: 'maya_x', name: 'Maya', avatar: '📷' }],
    glitterIntensity: 0,
    visibility: 'friendsOnly',
    archetype: 'nightowl',
  },
};

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
    // NPC profiles — customizable and AI-mutable
    if (initialState?.npcProfiles) {
      for (const [k, v] of Object.entries(initialState.npcProfiles)) this.npcProfiles.set(k, { ...v, top8: v.top8.map((t) => ({ ...t })) });
    } else {
      for (const [k, v] of Object.entries(DEFAULT_NPC_PROFILES)) this.npcProfiles.set(k, { ...v, top8: v.top8.map((t) => ({ ...t })) });
    }
    if (initialState?.guestbook) {
      for (const [k, v] of Object.entries(initialState.guestbook)) this.guestbook.set(k, v.map((e) => ({ ...e })));
    } else {
      // Seed guestbooks for Maya/Ryan/Nora
      this.guestbook.set('maya_x', [
        { author: 'tacocart_ryan', text: 'Left some tacos at the counter for you!', date: 'Aug 22, 11:30 AM', minute: 0 },
        { author: 'nightowl87', text: 'Check the new recordings on NightBoard thread 104.', date: 'Aug 21, 02:40 AM', minute: 0 },
      ]);
      this.guestbook.set('tacocart_ryan', [{ author: 'maya_x', text: 'Best salsa in town!', date: 'Aug 21, 03:00 PM', minute: 0 }]);
      this.guestbook.set('nightowl87', [{ author: 'maya_x', text: 'Your night photos are haunting.', date: 'Aug 20, 11:00 PM', minute: 0 }]);
    }
    if (initialState?.proceduralCatalog) {
      try {
        const { restoreProceduralMyPlaceReleases } = require('./MyPlaceCatalog');
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
      const mod = require('./MyPlaceCatalog');
      procedural = mod.getProceduralMyPlaceReleases();
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
        const mod = require('./MyPlaceCatalog');
        mod.restoreProceduralMyPlaceReleases(state.proceduralCatalog);
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

  private static readonly ARCHETYPE_AVATARS: Record<CharacterArchetype, string> = {
    coworker: '🧰',
    nightowl: '🦉',
    student: '🎒',
    trader: '📈',
    artist: '🎸',
    regular: '🙂',
  };

  /**
   * Ensure a MyPlace page exists for a newly registered buddy.
   * Stub is derived from the archetype template (not hardcoded per-id), so any
   * CharacterEngine buddy gets a sensible page on first sight.
   */
  public ensureNpcProfile(input: { username: string; displayName: string; archetype?: CharacterArchetype }): MyPlaceProfile {
    const existing = this.npcProfiles.get(input.username);
    if (existing) return { ...existing, top8: existing.top8.map((t) => ({ ...t })) };
    const archetype: CharacterArchetype = input.archetype && CHARACTER_ARCHETYPES[input.archetype] ? input.archetype : 'regular';
    const template = CHARACTER_ARCHETYPES[archetype];
    const stub: MyPlaceProfile = {
      username: input.username,
      displayName: input.displayName,
      headline: `${input.displayName} • Oakhaven local`,
      bio: template.personaHint,
      interests: [...template.defaultInterests],
      songTitle: template.defaultSong,
      avatarGlyph: MyPlaceEngine.ARCHETYPE_AVATARS[archetype],
      top8: [],
      glitterIntensity: 0,
      visibility: 'public',
      archetype,
    };
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
      const personaMap: Record<string, string> = {
        maya_x: 'Maya — quiet, lowercase, photography, guarded then warm, loves rain and 35mm',
        tacocart_ryan: 'Ryan — practical, teasing, tacos, hardware, energetic',
        nightowl87: 'Nora — dry humor, night archivist, canal hum, cryptic but warm',
      };
      const archetype = current.archetype && CHARACTER_ARCHETYPES[current.archetype] ? current.archetype : undefined;
      const persona = personaMap[username] ?? (archetype ? CHARACTER_ARCHETYPES[archetype].personaHint : 'Believable Oakhaven resident');
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
    // Fallback: deterministic template mutation (core 3 keep legacy patches verbatim)
    const fallbacks: Record<string, Partial<MyPlaceProfile>> = {
      maya_x: { headline: 'Darkroom nights // new film roll', bio: 'Developed a new roll of canal night shots. The neon is bleeding just right.', interests: ['Film Cameras', 'Rain', 'Neon'], songTitle: 'Night Canal (New Mix)' },
      tacocart_ryan: { headline: 'Tacos + test bench // 512MB stick for sale', bio: 'Cart is busy. Also testing a spare stick on the bench.', interests: ['Tacos', 'Benchmarks', 'Salsa'], songTitle: 'Grill Hiss FM' },
      nightowl87: { headline: 'Hum log updated // 03:14 AM', bio: 'New capture below the sluice. Frequency shifted 2Hz after the substation work.', interests: ['Audio Forensics', 'Canals', 'Logs'], songTitle: 'Hum Log 03 — Sluice' },
    };
    const legacy = fallbacks[username];
    if (legacy) {
      this.updateNpcProfile(username, legacy);
      return { username, profile: this.getNpcProfile(username)! };
    }
    // Generic archetype fallback for dynamic buddies
    const arch = current.archetype && CHARACTER_ARCHETYPES[current.archetype] ? current.archetype : 'regular';
    const template = CHARACTER_ARCHETYPES[arch];
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

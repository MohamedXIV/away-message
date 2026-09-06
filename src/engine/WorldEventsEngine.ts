// src/engine/WorldEventsEngine.ts
// Sandbox global events + world knowledge bank — replaces Ink/Narrative beats.

import { EventBus } from './EventBus';
import { Appointment, GlobalEvent, WorldState, BuddyAttitude, BuddyEventKnowledge, CharacterArchetype } from './types';
import { normalizeBuddyId } from './SocialEngine';
import { ARCHETYPE_ATTITUDES, resolveArchetype } from './characterTemplates';
import { CORE_IDS, coreBuddyIds } from './coreBuddies';

// Re-export for convenience
export type { GlobalEvent, WorldState };
export type WorldEventsState = WorldState;

/**
 * Catalog of sandbox global events. Sandbox = no scripted beats; these are
 * ambient world news that feed every NPC's knowledge bank.
 *
 * Later we can add Orion OS 7, MyPlace v2 (MySpace-like), etc. via trigger.
 */
export const GLOBAL_EVENTS_CATALOG: Omit<GlobalEvent, 'isTriggered' | 'triggeredAtMinute'>[] = [
  {
    id: 'myplace_v2_launch',
    title: 'MyPlace v2 — Now with music & top 8',
    description: 'MyPlace relaunched with profile songs, top friends, and glitter layouts.',
    category: 'site_launch',
    triggerDay: 3,
    triggerHour: 14,
    knowledgePrompt: 'MyPlace just relaunched as v2 with profile songs and Top 8 — everyone is customizing their page.',
    siteUrl: 'http://myplace.local/',
  },
  {
    id: 'city_canal_festival',
    title: 'Canal Bridge Night Market announced',
    description: 'CityWire reports a weekend night market by the canal bridge.',
    category: 'city_news',
    triggerDay: 5,
    triggerHour: 10,
    knowledgePrompt: 'The city announced a night market by the canal bridge this weekend — people are talking about going.',
    siteUrl: 'http://citywire.local/article/canal-festival',
  },
  {
    id: 'orion_os_7_beta',
    title: 'Orion OS 7 Beta leaked screenshots',
    description: 'OrionSoft teased glossy screenshots of Orion OS 7 beta.',
    category: 'os_release',
    triggerDay: 7,
    triggerHour: 11,
    knowledgePrompt: 'Leaked Orion OS 7 beta screenshots are circulating — glossy, new dock, people argue if it is worth upgrading.',
    siteUrl: 'http://orionsoft.local/beta',
  },
  {
    id: 'goldnet_surge',
    title: 'GoldNet price surge',
    description: 'Digital gold on GoldNet jumped after a CityWire article.',
    category: 'economy',
    triggerDay: 9,
    triggerHour: 9,
    knowledgePrompt: 'GoldNet digital gold surged after a news article — some friends made money, others missed it.',
    siteUrl: 'http://goldnet.local/',
  },
  {
    id: 'orion_os_7_release',
    title: 'Orion OS 7 Official Release',
    description: 'Orion OS 7 is now available for download and in stores.',
    category: 'os_release',
    triggerDay: 11,
    triggerHour: 10,
    knowledgePrompt: 'Orion OS 7 officially released today — stores have it, download mirrors are slow, everyone has an opinion.',
    siteUrl: 'http://orionsoft.local/',
  },
  {
    id: 'myplace_glitter_craze',
    title: 'MyPlace glitter & autoplay craze',
    description: 'MyPlace profiles are now full of glitter GIFs and autoplay music.',
    category: 'culture',
    triggerDay: 13,
    triggerHour: 16,
    knowledgePrompt: 'MyPlace is now overrun with glitter graphics and autoplay songs — love it or hate it, you cannot avoid it.',
    siteUrl: 'http://myplace.local/trending',
  },
];

export class WorldEventsEngine {
  private eventBus: EventBus;
  private flags: Map<string, boolean | number | string> = new Map();
  private appointments: Appointment[] = [];
  private windowObservationHistory: string[] = [];
  private triggeredEvents: Map<string, GlobalEvent> = new Map();
  private pendingEvents: Map<string, Omit<GlobalEvent, 'isTriggered' | 'triggeredAtMinute'>> = new Map();
  private _cachedState: WorldEventsState | null = null;
  private _stateVersion = 0;
  // Optional roster provider (set by SimulationEngine): lets attitudes cover dynamic
  // buddies via their archetype instead of the legacy 4-id table.
  private buddyProvider: (() => Array<{ id: string; archetype?: CharacterArchetype }>) | null = null;

  public setBuddyProvider(provider: (() => Array<{ id: string; archetype?: CharacterArchetype }>) | null): void {
    this.buddyProvider = provider;
    this.bumpVersion();
  }

  private listBuddyIds(): string[] {
    if (this.buddyProvider) {
      try {
        const ids = this.buddyProvider().map((b) => b.id);
        if (ids.length > 0) return ids;
      } catch { /* fall through to legacy list */ }
    }
    return coreBuddyIds();
  }

  private archetypeFor(buddyId: string): CharacterArchetype {
    if (this.buddyProvider) {
      try {
        const found = this.buddyProvider().find((b) => b.id === buddyId);
        if (found) return resolveArchetype(buddyId, found.archetype);
      } catch { /* fall through */ }
    }
    return resolveArchetype(buddyId);
  }
  private buddyKnowledge: Map<string, BuddyEventKnowledge[]> = new Map(); // buddyId -> knowledge[]

  constructor(eventBus: EventBus, initialState?: Partial<WorldEventsState>) {
    this.eventBus = eventBus;

    // Load catalog into pending
    for (const evt of GLOBAL_EVENTS_CATALOG) {
      this.pendingEvents.set(evt.id, evt);
    }

    if (initialState) {
      this.loadState(initialState);
    }
  }

  public getState(): WorldEventsState {
    if (this._cachedState) return this._cachedState;
    const buddyKnowledge: Record<string, BuddyEventKnowledge[]> = {};
    for (const [k, v] of this.buddyKnowledge.entries()) buddyKnowledge[k] = v.map((e) => ({ ...e }));
    const state: WorldEventsState = {
      flags: Object.fromEntries(this.flags.entries()),
      appointments: this.appointments.map((a) => ({ ...a })),
      windowObservationHistory: [...this.windowObservationHistory],
      triggeredEvents: Array.from(this.triggeredEvents.values()).map((e) => ({ ...e })),
      buddyKnowledge,
    };
    this._cachedState = state;
    return state;
  }

  private bumpVersion(): void {
    this._stateVersion++;
    this._cachedState = null;
  }

  public loadState(state: Partial<WorldEventsState>): void {
    this.flags.clear();
    if (state.flags) {
      for (const [k, v] of Object.entries(state.flags)) this.flags.set(k, v);
    }
    this.appointments = state.appointments ? state.appointments.map((a) => ({ ...a })) : [];
    this.windowObservationHistory = state.windowObservationHistory ? [...state.windowObservationHistory] : [];
    this.triggeredEvents.clear();
    if (state.triggeredEvents) {
      for (const e of state.triggeredEvents) {
        this.triggeredEvents.set(e.id, { ...e });
        this.pendingEvents.delete(e.id);
      }
    }
    // Restore per-buddy attitudes (normalize old handle keys to canonical ids)
    this.buddyKnowledge.clear();
    const rawKnowledge = (state as unknown as { buddyKnowledge?: Record<string, BuddyEventKnowledge[]> }).buddyKnowledge;
    if (rawKnowledge) {
      for (const [rawBid, list] of Object.entries(rawKnowledge)) {
        const bid = normalizeBuddyId(rawBid);
        const existing = this.buddyKnowledge.get(bid) ?? [];
        this.buddyKnowledge.set(bid, [...existing, ...list.map((k) => ({ ...k }))].slice(-20));
      }
    }
    // Ensure pending still contains non-triggered catalog entries
    for (const evt of GLOBAL_EVENTS_CATALOG) {
      if (!this.triggeredEvents.has(evt.id) && !this.pendingEvents.has(evt.id)) {
        this.pendingEvents.set(evt.id, evt);
      }
    }
    // Backfill attitudes for already-triggered events (migration)
    for (const evt of this.triggeredEvents.values()) {
      this.ensureBuddyAttitudes(evt, evt.triggeredAtMinute ?? 0);
    }
    this.bumpVersion();
  }

  // --- Per-buddy attitude generation (deterministic, archetype palette-based) ---
  private hashStr(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h;
  }

  private attitudeForBuddy(buddyId: string, evt: GlobalEvent): { attitude: BuddyAttitude; personalTake: string } {
    const cat = evt.category;
    const lower = (evt.title + ' ' + evt.knowledgePrompt).toLowerCase();
    // Archetype palette keeps the original 4 voices byte-identical
    // (coworker=ryan, artist=maya, nightowl=nora, regular=henderson).
    const archetype = this.archetypeFor(buddyId);
    const buddyPalette = ARCHETYPE_ATTITUDES[archetype];
    const entry = buddyPalette[cat] ?? buddyPalette['city_news']!;
    // Deterministic pick among takes + slight variance by id hash
    const idx = this.hashStr(`${buddyId}:${evt.id}`) % entry.takes.length;
    const take = entry.takes[idx]!;
    // Override for strong keywords (preserved from the legacy table)
    if (lower.includes('glitter') && (buddyId === CORE_IDS.MAYA || archetype === 'artist')) {
      return { attitude: 'annoyed', personalTake: "glitter is pretty for 5 seconds then my 56k dies — " + take };
    }
    if (lower.includes('orion 7') && (buddyId === CORE_IDS.NORA || archetype === 'nightowl')) {
      return { attitude: 'skeptical', personalTake: take };
    }
    return { attitude: entry.att, personalTake: take };
  }

  private ensureBuddyAttitudes(evt: GlobalEvent, atMinute: number): void {
    const buddies = this.listBuddyIds();
    let changed = false;
    for (const bid of buddies) {
      const list = this.buddyKnowledge.get(bid) ?? [];
      if (list.some((k) => k.eventId === evt.id)) continue;
      const { attitude, personalTake } = this.attitudeForBuddy(bid, evt);
      list.push({ eventId: evt.id, attitude, personalTake, learnedAtMinute: atMinute });
      this.buddyKnowledge.set(bid, list.slice(-20));
      changed = true;
    }
    if (changed) this.bumpVersion();
  }

  /**
   * Backfill attitudes for a late-registered buddy across all triggered events
   * (so a newcomer shares the timeline instead of seeing blank takes).
   */
  public ensureAttitudesForBuddy(rawBuddyId: string, atMinute: number): void {
    const buddyId = normalizeBuddyId(rawBuddyId);
    let changed = false;
    for (const evt of this.triggeredEvents.values()) {
      const list = this.buddyKnowledge.get(buddyId) ?? [];
      if (list.some((k) => k.eventId === evt.id)) continue;
      const { attitude, personalTake } = this.attitudeForBuddy(buddyId, evt);
      list.push({ eventId: evt.id, attitude, personalTake, learnedAtMinute: atMinute });
      this.buddyKnowledge.set(buddyId, list.slice(-20));
      changed = true;
    }
    if (changed) this.bumpVersion();
  }

  /** Called on every time advance to check for newly due global events */
  public checkAndTriggerEvents(currentTotalMinutes: number, currentDay: number): GlobalEvent[] {
    const newlyTriggered: GlobalEvent[] = [];
    for (const [id, template] of Array.from(this.pendingEvents.entries())) {
      const triggerHour = template.triggerHour ?? 9;
      const triggerTotalMinutes = (template.triggerDay - 1) * 1440 + triggerHour * 60;
      if (currentTotalMinutes >= triggerTotalMinutes || currentDay > template.triggerDay || (currentDay === template.triggerDay && currentTotalMinutes % 1440 >= triggerHour * 60)) {
        const event: GlobalEvent = {
          ...template,
          isTriggered: true,
          triggeredAtMinute: currentTotalMinutes,
        };
        this.triggeredEvents.set(id, event);
        this.pendingEvents.delete(id);
        newlyTriggered.push(event);
        this.ensureBuddyAttitudes(event, currentTotalMinutes);
        this.eventBus.emit('world:global_event_triggered' as any, { event: { ...event } });
        this.flags.set(`event_${id}`, true);
        this.flags.set(`event_${id}_day`, currentDay);
      }
    }
    if (newlyTriggered.length > 0) this.bumpVersion();
    return newlyTriggered;
  }

  public triggerEventById(eventId: string, currentTotalMinutes: number): GlobalEvent | null {
    const template = this.pendingEvents.get(eventId);
    if (!template) return null;
    const event: GlobalEvent = {
      ...template,
      isTriggered: true,
      triggeredAtMinute: currentTotalMinutes,
    };
    this.triggeredEvents.set(eventId, event);
    this.pendingEvents.delete(eventId);
    this.ensureBuddyAttitudes(event, currentTotalMinutes);
    this.eventBus.emit('world:global_event_triggered' as any, { event: { ...event } });
    this.flags.set(`event_${eventId}`, true);
    this.bumpVersion();
    return event;
  }

  public getTriggeredEvents(): GlobalEvent[] {
    return Array.from(this.triggeredEvents.values()).sort((a, b) => (a.triggeredAtMinute ?? 0) - (b.triggeredAtMinute ?? 0));
  }

  public getPendingEvents(): Omit<GlobalEvent, 'isTriggered' | 'triggeredAtMinute'>[] {
    return Array.from(this.pendingEvents.values());
  }

  /** Global knowledge context (shared) */
  public getKnowledgeContext(currentDay: number, maxEvents = 4): string {
    const triggered = this.getTriggeredEvents().filter((e) => e.triggerDay <= currentDay);
    if (triggered.length === 0) return 'No major world events yet — early days, quiet internet.';
    const recent = triggered.slice(-maxEvents);
    return recent.map((e) => `- [Day ${e.triggerDay}] ${e.title}: ${e.knowledgePrompt}`).join('\n');
  }

  /** Per-buddy knowledge context — same events but with that buddy's attitude/take */
  public getKnowledgeContextForBuddy(rawBuddyId: string, currentDay: number, maxEvents = 4): string {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const triggered = this.getTriggeredEvents().filter((e) => e.triggerDay <= currentDay).slice(-maxEvents);
    if (triggered.length === 0) return 'No major world events yet — early days, quiet internet.';
    const knowledge = this.buddyKnowledge.get(buddyId) ?? [];
    const map = new Map(knowledge.map((k) => [k.eventId, k]));
    return triggered
      .map((e) => {
        const k = map.get(e.id);
        const att = k ? ` [${k.attitude}]` : '';
        const take = k ? ` — you feel: "${k.personalTake}"` : '';
        return `- [Day ${e.triggerDay}] ${e.title}${att}: ${e.knowledgePrompt}${take}`;
      })
      .join('\n');
  }

  public getBuddyKnowledge(rawBuddyId: string): BuddyEventKnowledge[] {
    return [...(this.buddyKnowledge.get(normalizeBuddyId(rawBuddyId)) ?? [])];
  }

  /** Per-buddy knowledge check — for sandbox every buddy knows every triggered event */
  public isEventKnownToBuddy(_rawBuddyId: string, eventId: string): boolean {
    return this.triggeredEvents.has(eventId);
  }

  // ---- Flags / Appointments / Observations (sandbox world state) ----

  public setFlag(key: string, value: boolean | number | string): void {
    this.flags.set(key, value);
    this.bumpVersion();
  }

  public getFlag(key: string): boolean | number | string | undefined {
    return this.flags.get(key);
  }

  public hasFlag(key: string): boolean {
    const v = this.flags.get(key);
    return v !== undefined && v !== false;
  }

  public scheduleAppointment(appt: Omit<Appointment, 'isCompleted' | 'isMissed'>): Appointment {
    const full: Appointment = { ...appt, isCompleted: false, isMissed: false, status: appt.status ?? 'scheduled' };
    this.appointments.push(full);
    this.bumpVersion();
    return { ...full };
  }

  public getAppointments(): Appointment[] {
    return this.appointments.map((a) => ({ ...a }));
  }

  /**
   * P5 governed patch for the live-meeting lifecycle (status/rsvp/show flags).
   * Unknown ids and illegal keys are ignored; returns the patched copy or null.
   */
  public updateAppointment(id: string, patch: Partial<Pick<Appointment, 'status' | 'rsvp' | 'npcShowed' | 'playerShowed' | 'isCompleted' | 'isMissed' | 'wageOverride'>>): Appointment | null {
    const appt = this.appointments.find((a) => a.id === id);
    if (!appt) return null;
    const statuses = ['scheduled', 'confirmed', 'happened', 'missed', 'cancelled'];
    const rsvps = ['yes', 'no', 'maybe'];
    if (patch.status !== undefined && statuses.includes(patch.status)) appt.status = patch.status;
    if (patch.rsvp !== undefined && rsvps.includes(patch.rsvp)) appt.rsvp = patch.rsvp;
    if (typeof patch.npcShowed === 'boolean') appt.npcShowed = patch.npcShowed;
    if (typeof patch.playerShowed === 'boolean') appt.playerShowed = patch.playerShowed;
    if (typeof patch.isCompleted === 'boolean') appt.isCompleted = patch.isCompleted;
    if (typeof patch.isMissed === 'boolean') appt.isMissed = patch.isMissed;
    if (typeof patch.wageOverride === 'number' && Number.isFinite(patch.wageOverride) && patch.wageOverride >= 0) {
      appt.wageOverride = Math.min(500, Math.round(patch.wageOverride));
    }
    this.bumpVersion();
    return { ...appt };
  }

  public addWindowObservation(entry: string): void {
    this.windowObservationHistory.push(entry);
    if (this.windowObservationHistory.length > 100) {
      this.windowObservationHistory = this.windowObservationHistory.slice(-100);
    }
    this.bumpVersion();
  }

  public getFlags(): Record<string, boolean | number | string> {
    return Object.fromEntries(this.flags.entries());
  }

  // ---- Procedural injection (governed) ----

  public injectProceduralEvents(
    events: Array<Omit<GlobalEvent, 'isTriggered' | 'triggeredAtMinute'>>,
  ): string[] {
    const added: string[] = [];
    for (const evt of events) {
      if (this.triggeredEvents.has(evt.id) || this.pendingEvents.has(evt.id)) continue;
      if (!/^[a-z0-9_]+$/.test(evt.id)) continue;
      this.pendingEvents.set(evt.id, {
        id: evt.id,
        title: evt.title.slice(0, 80),
        description: evt.description.slice(0, 400),
        category: evt.category,
        triggerDay: Math.max(1, Math.min(365, evt.triggerDay)),
        triggerHour: Math.max(0, Math.min(23, evt.triggerHour ?? 10)),
        knowledgePrompt: evt.knowledgePrompt.slice(0, 220),
        siteUrl: evt.siteUrl,
      });
      added.push(evt.id);
    }
    if (added.length > 0) this.bumpVersion();
    return added;
  }

  public getBuddyKnowledgeMap(): Record<string, BuddyEventKnowledge[]> {
    const out: Record<string, BuddyEventKnowledge[]> = {};
    for (const [k, v] of this.buddyKnowledge.entries()) out[k] = v.map((e) => ({ ...e }));
    return out;
  }

  public getCityWireArticles(currentDay: number): Array<{
    id: string;
    headline: string;
    body: string;
    byline: string;
    day: number;
    category: string;
    siteUrl?: string;
  }> {
    const triggered = this.getTriggeredEvents().filter((e) => e.triggerDay <= currentDay);
    // Most recent first, up to 12
    return [...triggered]
      .sort((a, b) => (b.triggeredAtMinute ?? 0) - (a.triggeredAtMinute ?? 0))
      .slice(0, 12)
      .map((e) => ({
        id: e.id,
        headline: e.title,
        body: e.description,
        byline: `CityWire Staff // Day ${e.triggerDay}`,
        day: e.triggerDay,
        category: e.category,
        siteUrl: e.siteUrl,
      }));
  }
}

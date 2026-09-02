// src/engine/WorldEventsEngine.ts
// Sandbox global events + world knowledge bank — replaces Ink/Narrative beats.

import { EventBus } from './EventBus';
import { Appointment, GlobalEvent, WorldState, BuddyAttitude, BuddyEventKnowledge } from './types';

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
    const buddyKnowledge: Record<string, BuddyEventKnowledge[]> = {};
    for (const [k, v] of this.buddyKnowledge.entries()) buddyKnowledge[k] = v.map((e) => ({ ...e }));
    return {
      flags: Object.fromEntries(this.flags.entries()),
      appointments: this.appointments.map((a) => ({ ...a })),
      windowObservationHistory: [...this.windowObservationHistory],
      triggeredEvents: Array.from(this.triggeredEvents.values()).map((e) => ({ ...e })),
      buddyKnowledge,
    };
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
    // Restore per-buddy attitudes
    this.buddyKnowledge.clear();
    const rawKnowledge = (state as unknown as { buddyKnowledge?: Record<string, BuddyEventKnowledge[]> }).buddyKnowledge;
    if (rawKnowledge) {
      for (const [bid, list] of Object.entries(rawKnowledge)) {
        this.buddyKnowledge.set(bid, list.map((k) => ({ ...k })));
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
  }

  // --- Per-buddy attitude generation (deterministic, palette-based) ---
  private hashStr(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h;
  }

  private attitudeForBuddy(buddyId: string, evt: GlobalEvent): { attitude: BuddyAttitude; personalTake: string } {
    const cat = evt.category;
    const lower = (evt.title + ' ' + evt.knowledgePrompt).toLowerCase();
    // Personality palettes
    const palettes: Record<string, Record<string, { att: BuddyAttitude; takes: string[] }>> = {
      ryan: {
        os_release: { att: 'hyped', takes: ["gonna camp TechMart for the box", "benchmarked it on my rig already", "my cart is ready"] },
        site_launch: { att: 'curious', takes: ["checking if my band page survives v2", "hope my links don't break"] },
        economy: { att: 'hyped', takes: ["flipped a stick and bought tacos", "watching BidBay like a hawk"] },
        culture: { att: 'curious', takes: ["glitter is wild but fun", "need that tiler for my page"] },
        city_news: { att: 'indifferent', takes: ["saw it from the cart", "night market sounds good after shift"] },
        system: { att: 'worried', takes: ["throttle will kill my downloads", "gonna queue overnight"] },
      },
      maya: {
        os_release: { att: 'skeptical', takes: ["glossy is pretty but my 512 is fine", "not upgrading just for a dock"] },
        site_launch: { att: 'annoyed', takes: ["Top 8 feels like ranking friends", "autoplay blasts at 2am"] },
        economy: { att: 'indifferent', takes: ["not my game", "glad someone made money"] },
        culture: { att: 'curious', takes: ["love the canal rain song", "tiling stars is kinda pretty"] },
        city_news: { att: 'curious', takes: ["night market by the canal — want to go?", "hum kept me up, heard it too?"] },
        system: { att: 'annoyed', takes: ["throttle ruins my playlist loads", "will stay up late anyway"] },
      },
      nora: {
        os_release: { att: 'skeptical', takes: ["skin backport is the real story", "bench says 7 is slower on 512"] },
        site_launch: { att: 'curious', takes: ["threaded replies will save NightBoard", "archiving the launch"] },
        economy: { att: 'curious', takes: ["watching GoldNet like a tape", "canal air moves markets"] },
        culture: { att: 'skeptical', takes: ["glitter is archival noise", "counter tracks the decay"] },
        city_news: { att: 'hyped', takes: ["hum is infrastructure — logged it", "have a spectral capture"] },
        system: { att: 'curious', takes: ["throttle is a good control variable", "logging packet loss"] },
      },
      henderson: {
        os_release: { att: 'indifferent', takes: ["as long as the office PC boots", "support ends for 4.8?"] },
        site_launch: { att: 'indifferent', takes: ["keep it quiet after 10pm", "no glitter in the lobby"] },
        economy: { att: 'worried', takes: ["rent still due regardless", "don’t gamble rent on GoldNet"] },
        culture: { att: 'annoyed', takes: ["glitter slows the office machine", "please no autoplay in hours"] },
        city_news: { att: 'curious', takes: ["night market needs a permit?", "hum is the substation, per city"] },
        system: { att: 'worried', takes: ["maintenance affects motel DSL too", "guests complained last time"] },
      },
    };
    const buddyPalette = palettes[buddyId] ?? palettes['ryan']!;
    const entry = buddyPalette[cat] ?? buddyPalette['city_news']!;
    // Deterministic pick among takes + slight variance by id hash
    const idx = this.hashStr(`${buddyId}:${evt.id}`) % entry.takes.length;
    const take = entry.takes[idx]!;
    // Override for strong keywords
    if (lower.includes('glitter') && buddyId === 'maya') return { attitude: 'annoyed', personalTake: "glitter is pretty for 5 seconds then my 56k dies — " + take };
    if (lower.includes('orion 7') && buddyId === 'nora') return { attitude: 'skeptical', personalTake: take };
    return { attitude: entry.att, personalTake: take };
  }

  private ensureBuddyAttitudes(evt: GlobalEvent, atMinute: number): void {
    const buddies = ['ryan', 'maya', 'nora', 'henderson'];
    for (const bid of buddies) {
      const list = this.buddyKnowledge.get(bid) ?? [];
      if (list.some((k) => k.eventId === evt.id)) continue;
      const { attitude, personalTake } = this.attitudeForBuddy(bid, evt);
      list.push({ eventId: evt.id, attitude, personalTake, learnedAtMinute: atMinute });
      // keep last 20
      this.buddyKnowledge.set(bid, list.slice(-20));
    }
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
        // Also set a flag so search/sites can gate on it
        this.flags.set(`event_${id}`, true);
        this.flags.set(`event_${id}_day`, currentDay);
      }
    }
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
  public getKnowledgeContextForBuddy(buddyId: string, currentDay: number, maxEvents = 4): string {
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

  public getBuddyKnowledge(buddyId: string): BuddyEventKnowledge[] {
    return [...(this.buddyKnowledge.get(buddyId) ?? [])];
  }

  /** Per-buddy knowledge check — for sandbox every buddy knows every triggered event */
  public isEventKnownToBuddy(_buddyId: string, eventId: string): boolean {
    return this.triggeredEvents.has(eventId);
  }

  // ---- Flags / Appointments / Observations (sandbox world state) ----

  public setFlag(key: string, value: boolean | number | string): void {
    this.flags.set(key, value);
  }

  public getFlag(key: string): boolean | number | string | undefined {
    return this.flags.get(key);
  }

  public hasFlag(key: string): boolean {
    const v = this.flags.get(key);
    return v !== undefined && v !== false;
  }

  public scheduleAppointment(appt: Omit<Appointment, 'isCompleted' | 'isMissed'>): Appointment {
    const full: Appointment = { ...appt, isCompleted: false, isMissed: false };
    this.appointments.push(full);
    return full;
  }

  public addWindowObservation(entry: string): void {
    this.windowObservationHistory.push(entry);
    // Keep last 100
    if (this.windowObservationHistory.length > 100) {
      this.windowObservationHistory = this.windowObservationHistory.slice(-100);
    }
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
      // Validate id
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

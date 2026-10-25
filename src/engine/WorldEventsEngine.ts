// src/engine/WorldEventsEngine.ts
// Sandbox global events + world knowledge bank — replaces Ink/Narrative beats.

import { EventBus } from './EventBus';
import { Appointment, GlobalEvent, WorldState, BuddyAttitude, BuddyEventKnowledge, CharacterArchetype } from './types';
import {
  KnowledgeLedger,
  type ActorKnowledgeView,
  type ClaimRecord,
  type KnowledgeProvenance,
  type KnowledgeReceipt,
  type WorldFactRecord,
} from './semantic/KnowledgeLedger';
import { normalizeBuddyId } from './SocialEngine';
import { ARCHETYPE_ATTITUDES, resolveArchetype } from './characterTemplates';
import { GENERATED_EVENT_MODIFIERS } from './worldContent.generated';
import {
  projectActiveModifiers,
  toModifierSpecs,
  type WorldModifier,
  type WorldModifierFilter,
  type WorldModifierSpec,
} from './WorldModifiers';

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
    id: 'canal_storm_warning',
    title: 'Canal storm front warning',
    description: 'CityWire posts a short-lived storm warning for the canal district and surrounding streets.',
    category: 'city_news',
    triggerDay: 4,
    triggerHour: 15,
    knowledgePrompt: 'A fast storm front is crossing Oakhaven; the canal paths and exposed streets are taking the worst of it.',
    siteUrl: 'http://citywire.local/article/canal-storm-warning',
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
      } catch { /* no live roster available */ }
    }
    return [];
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
  private buddyKnowledge: Map<string, BuddyEventKnowledge[]> = new Map(); // learned public events
  /** Sole authority for structured world facts, rumors and scoped awareness. */
  private readonly semanticKnowledge = new KnowledgeLedger();
  /** Load-only generation: normal event writes must not invalidate AI work. */
  private loadEpoch = 0;

  constructor(
    eventBus: EventBus,
    initialState?: Partial<WorldEventsState>,
    private readonly modifierSpecs: readonly WorldModifierSpec[] = toModifierSpecs(GENERATED_EVENT_MODIFIERS),
  ) {
    this.eventBus = eventBus;

    // Load catalog into pending
    for (const evt of GLOBAL_EVENTS_CATALOG) {
      this.pendingEvents.set(evt.id, evt);
    }

    if (initialState) {
      this.loadState(initialState);
    }
  }

  public getLoadEpoch(): number { return this.loadEpoch; }

  public getState(): WorldEventsState {
    if (this._cachedState) return this._cachedState;
    const buddyKnowledge: Record<string, BuddyEventKnowledge[]> = {};
    for (const [k, v] of this.buddyKnowledge.entries()) buddyKnowledge[k] = v.map((e) => ({ ...e }));
    // Static authored pending events come from the catalog, not save data.
    // Dynamic future events are canonical world truth and must survive cold boots.
    const catalogIds = new Set(GLOBAL_EVENTS_CATALOG.map(event => event.id));
    const pendingProceduralEvents = Array.from(this.pendingEvents.values())
      .filter(event => !catalogIds.has(event.id))
      .map(event => ({ ...event }));
    const state: WorldEventsState = {
      flags: Object.fromEntries(this.flags.entries()),
      appointments: this.appointments.map((a) => ({ ...a })),
      windowObservationHistory: [...this.windowObservationHistory],
      triggeredEvents: Array.from(this.triggeredEvents.values()).map((e) => ({ ...e })),
      ...(pendingProceduralEvents.length ? { pendingProceduralEvents } : {}),
      buddyKnowledge,
      semanticKnowledge: this.semanticKnowledge.getState(),
    };
    this._cachedState = state;
    return state;
  }

  private bumpVersion(): void {
    this._stateVersion++;
    this._cachedState = null;
  }

  public loadState(state: Partial<WorldEventsState>): void {
    this.loadEpoch++;
    this.semanticKnowledge.loadState(state.semanticKnowledge);
    this.flags.clear();
    if (state.flags) {
      for (const [k, v] of Object.entries(state.flags)) this.flags.set(k, v);
    }
    this.appointments = state.appointments ? state.appointments.map((a) => ({ ...a })) : [];
    this.windowObservationHistory = state.windowObservationHistory ? [...state.windowObservationHistory] : [];
    // A hot load must never retain queued events from the previous world.
    // The source-of-truth snapshot and authored catalog rebuild this queue.
    this.pendingEvents.clear();
    this.triggeredEvents.clear();
    if (state.triggeredEvents) {
      for (const e of state.triggeredEvents) {
        this.triggeredEvents.set(e.id, { ...e });
      }
    }
    // Restore per-buddy attitudes (normalize old handle keys to canonical ids)
    this.buddyKnowledge.clear();
    const rawKnowledge = (state as unknown as { buddyKnowledge?: Record<string, BuddyEventKnowledge[]> }).buddyKnowledge;
    if (rawKnowledge) {
      for (const [rawBid, list] of Object.entries(rawKnowledge)) {
        if (!Array.isArray(list)) continue;
        const bid = normalizeBuddyId(rawBid);
        const existing = this.buddyKnowledge.get(bid) ?? [];
        this.buddyKnowledge.set(bid, [...existing, ...list.map((k) => ({
          ...k, ...(k.source ? { source: { ...k.source } } : {}),
        }))].slice(-20));
      }
    }
    // Authored pending entries are deterministic content, never stored twice.
    const catalogIds = new Set(GLOBAL_EVENTS_CATALOG.map(event => event.id));
    for (const evt of GLOBAL_EVENTS_CATALOG) {
      if (!this.triggeredEvents.has(evt.id)) this.pendingEvents.set(evt.id, evt);
    }
    // Persisted procedural events may be future obligations: restore only
    // structurally valid, non-catalog, non-triggered definitions.
    for (const evt of Array.isArray(state.pendingProceduralEvents) ? state.pendingProceduralEvents : []) {
      if (!evt || typeof evt.id !== 'string' || !/^[a-z0-9_]+$/.test(evt.id)
        || catalogIds.has(evt.id) || this.triggeredEvents.has(evt.id)
        || this.pendingEvents.has(evt.id)
        || typeof evt.title !== 'string' || !evt.title
        || typeof evt.description !== 'string' || !evt.description
        || typeof evt.knowledgePrompt !== 'string' || !evt.knowledgePrompt
        || !Number.isSafeInteger(evt.triggerDay)
        || (evt.triggerHour !== undefined && !Number.isSafeInteger(evt.triggerHour))
        || !(['city_news', 'site_launch', 'economy', 'culture', 'system', 'os_release', 'pulse_update'] as string[])
          .includes(evt.category)) continue;
      this.pendingEvents.set(evt.id, {
        id: evt.id,
        title: evt.title.slice(0, 80),
        description: evt.description.slice(0, 400),
        category: evt.category,
        triggerDay: Math.max(1, Math.min(365, evt.triggerDay)),
        triggerHour: Math.max(0, Math.min(23, evt.triggerHour ?? 10)),
        knowledgePrompt: evt.knowledgePrompt.slice(0, 220),
        ...(typeof evt.siteUrl === 'string' && /^https?:\/\/[a-z0-9_-]+\.local(?:\/|$)/i.test(evt.siteUrl)
          ? { siteUrl: evt.siteUrl.slice(0, 160) } : {}),
      });
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
    // Archetype palette drives event reactions without named-character exceptions.
    const archetype = this.archetypeFor(buddyId);
    const buddyPalette = ARCHETYPE_ATTITUDES[archetype] ?? ARCHETYPE_ATTITUDES['regular'];
    const entry = (buddyPalette[cat] ?? buddyPalette['city_news'])!;
    // Deterministic pick among takes + slight variance by id hash
    const idx = this.hashStr(`${buddyId}:${evt.id}`) % entry.takes.length;
    const take = entry.takes[idx]!;
    if (lower.includes('glitter') && archetype === 'artist') {
      return { attitude: 'annoyed', personalTake: "glitter is pretty for 5 seconds then my 56k dies — " + take };
    }
    if (lower.includes('orion 7') && archetype === 'nightowl') {
      return { attitude: 'skeptical', personalTake: take };
    }
    return { attitude: entry.att, personalTake: take };
  }

  /**
   * Publicly available news is discoverable, not telepathically known.
   * Stable per-actor/event feed exposure models limited discovery without RNG
   * state. Direct disclosure is a separate explicit command.
   */
  private discoversPublicEvent(buddyId: string, evt: GlobalEvent): boolean {
    return this.hashStr(`public-news:${evt.id}:${buddyId}`) % 100 < 60;
  }

  private makePublicEventKnowledge(buddyId: string, evt: GlobalEvent, atMinute: number): BuddyEventKnowledge {
    const { attitude, personalTake } = this.attitudeForBuddy(buddyId, evt);
    return {
      eventId: evt.id, attitude, personalTake, learnedAtMinute: atMinute,
      source: { kind: 'citywire', sourceId: evt.id, atMinute },
    };
  }

  private ensureBuddyAttitudes(evt: GlobalEvent, atMinute: number): void {
    const buddies = this.listBuddyIds();
    let changed = false;
    for (const bid of buddies) {
      const list = this.buddyKnowledge.get(bid) ?? [];
      if (list.some((k) => k.eventId === evt.id) || !this.discoversPublicEvent(bid, evt)) continue;
      list.push(this.makePublicEventKnowledge(bid, evt, atMinute));
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
      if (list.some((k) => k.eventId === evt.id) || !this.discoversPublicEvent(buddyId, evt)) continue;
      list.push(this.makePublicEventKnowledge(buddyId, evt, atMinute));
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

  /** Website HUD-visible flags only; never clone NPC knowledge or semantic ledgers. */
  public getPublicFlags(): Record<string, boolean | number | string> {
    return Object.fromEntries(this.flags.entries());
  }

  /**
   * Website-only public event feed, owned by World. Keep the most recent
   * authored events in chronological/stable insertion order with bounded
   * allocation; do not copy pending event definitions or NPC knowledge.
   */
  public getPublicWebsiteFeed(maxEvents = 256): {
    triggeredEvents: GlobalEvent[];
    pendingEventCount: number;
  } {
    const limit = Number.isFinite(maxEvents)
      ? Math.max(0, Math.min(256, Math.trunc(maxEvents))) : 256;
    const latest: GlobalEvent[] = [];
    if (limit > 0) {
      for (const event of this.triggeredEvents.values()) {
        const at = event.triggeredAtMinute ?? 0;
        if (latest.length === limit && at < (latest[0]!.triggeredAtMinute ?? 0)) continue;
        // Insert after equal times: identical ordering to stable getTriggeredEvents().
        let lo = 0;
        let hi = latest.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if ((latest[mid]!.triggeredAtMinute ?? 0) <= at) lo = mid + 1;
          else hi = mid;
        }
        latest.splice(lo, 0, event);
        if (latest.length > limit) latest.shift();
      }
    }
    return {
      triggeredEvents: latest.map(event => ({ ...event })),
      pendingEventCount: this.pendingEvents.size,
    };
  }

  /**
   * Public selected-actor event lookup. At most eight detached events are
   * returned, in the same stable time/insertion order as the legacy filtered
   * triggered-event feed. Only requested IDs can cross the UI boundary.
   */
  public getTriggeredEventsForIds(ids: ReadonlySet<string>, atMostDay = Number.POSITIVE_INFINITY): GlobalEvent[] {
    if (ids.size === 0) return [];
    const selected: GlobalEvent[] = [];
    for (const event of this.triggeredEvents.values()) {
      if (!ids.has(event.id) || event.triggerDay > atMostDay) continue;
      const minute = event.triggeredAtMinute ?? 0;
      // Stable insertion after equal timestamps; oldest drops first.
      let low = 0;
      let high = selected.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if ((selected[mid]!.triggeredAtMinute ?? 0) <= minute) low = mid + 1;
        else high = mid;
      }
      selected.splice(low, 0, event);
      if (selected.length > 8) selected.shift();
    }
    return selected.map(event => ({ ...event }));
  }

  /**
   * Pulse initiative decisions only need authored headlines from the current
   * and previous game day. Keep the latest 256 such events in stable
   * chronological/insertion order; never transport the full World event feed
   * (or the private knowledge banks) just to choose a gossip topic.
   */
  public getInitiativeEventTitlesRead(day: number): Array<{ title: string; triggerDay: number }> {
    if (!Number.isFinite(day)) return [];
    const latest: GlobalEvent[] = [];
    const limit = 256;
    for (const event of this.triggeredEvents.values()) {
      if ((event.triggerDay !== day && event.triggerDay !== day - 1) || event.title.trim().length <= 3) continue;
      const minute = event.triggeredAtMinute ?? 0;
      if (latest.length === limit && minute < (latest[0]!.triggeredAtMinute ?? 0)) continue;
      // Keep insertion order for equal timestamps, as the stable legacy sort did.
      let lo = 0;
      let hi = latest.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if ((latest[mid]!.triggeredAtMinute ?? 0) <= minute) lo = mid + 1;
        else hi = mid;
      }
      latest.splice(lo, 0, event);
      if (latest.length > limit) latest.shift();
    }
    return latest.map(({ title, triggerDay }) => ({ title, triggerDay }));
  }

  public getTriggeredEvents(): GlobalEvent[] {
    return Array.from(this.triggeredEvents.values()).sort((a, b) => (a.triggeredAtMinute ?? 0) - (b.triggeredAtMinute ?? 0));
  }

  public getPendingEvents(): Omit<GlobalEvent, 'isTriggered' | 'triggeredAtMinute'>[] {
    return Array.from(this.pendingEvents.values());
  }

  /** Inspector-only counts. Never clone queued definitions or public headlines. */
  public getLabEventCounts(): { pending: number; triggered: number; pendingOs: number } {
    let pendingOs = 0;
    for (const event of this.pendingEvents.values()) {
      if (event.category === 'os_release') pendingOs++;
    }
    return { pending: this.pendingEvents.size, triggered: this.triggeredEvents.size, pendingOs };
  }

  /**
   * Bounded active-modifier query (#46). Pure projection over authored specs
   * × canonical triggered events × time: deterministic, idempotent, and
   * mutation-free (fresh frozen copies per call). Owning domains decide how
   * to apply the returned effects; this engine never touches consumer state.
   *
   * Time is explicit and must be finite: there is no "current time" inside
   * this engine, and inferring it from event history would resurrect expired
   * modifiers. Non-finite time yields no modifiers.
   */
  public queryActiveModifiers(
    options: WorldModifierFilter & { atMinute: number },
  ): WorldModifier[] {
    const atMinute = options?.atMinute;
    if (!Number.isFinite(atMinute)) return [];
    return projectActiveModifiers(
      this.modifierSpecs,
      this.triggeredEvents.values(),
      atMinute,
      { domain: options.domain, kind: options.kind, targetId: options.targetId },
    );
  }

  /**
   * A rolling, day-eligible World read shared by public story/news surfaces.
   * Retain chronological order and original insertion order at equal minutes,
   * as Array.sort's stable legacy path did, without cloning all triggered
   * events. The caller owns the finite display limit (never persistence).
   */
  private getRecentTriggeredEventsForDay(
    currentDay: number, maxEvents: number, newestFirst = false,
  ): GlobalEvent[] {
    if (!Number.isFinite(currentDay) || !Number.isSafeInteger(maxEvents) || maxEvents <= 0) return [];
    const selected: GlobalEvent[] = [];
    for (const event of this.triggeredEvents.values()) {
      if (event.triggerDay > currentDay) continue;
      const minute = event.triggeredAtMinute ?? 0;
      if (selected.length === maxEvents) {
        const oldest = newestFirst ? selected[selected.length - 1]! : selected[0]!;
        const cutoff = oldest.triggeredAtMinute ?? 0;
        // Descending CityWire keeps EARLIER inserted records at tied minutes,
        // while ascending prompt context keeps LATER inserted records at ties.
        if (newestFirst ? minute <= cutoff : minute < cutoff) continue;
      }
      let lo = 0;
      let hi = selected.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        const at = selected[mid]!.triggeredAtMinute ?? 0;
        if (newestFirst ? at >= minute : at <= minute) lo = mid + 1;
        else hi = mid;
      }
      selected.splice(lo, 0, event);
      if (selected.length > maxEvents) {
        if (newestFirst) selected.pop();
        else selected.shift();
      }
    }
    return selected;
  }

  /** Compact global context for AI prompt generation, never a WorldState read. */
  public getKnowledgeContext(currentDay: number, maxEvents = 4): string {
    const limit = Number.isFinite(maxEvents) ? Math.max(1, Math.min(16, Math.trunc(maxEvents))) : 4;
    const recent = this.getRecentTriggeredEventsForDay(currentDay, limit);
    if (recent.length === 0) return 'No major world events yet — early days, quiet internet.';
    return recent.map((e) => `- [Day ${e.triggerDay}] ${e.title}: ${e.knowledgePrompt}`).join('\n');
  }

  /** Per-buddy knowledge context — same events but with that buddy's attitude/take */
  public getKnowledgeContextForBuddy(rawBuddyId: string, currentDay: number, maxEvents = 4): string {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const knowledge = this.buddyKnowledge.get(buddyId) ?? [];
    const map = new Map(knowledge.map((k) => [k.eventId, k]));
    const limit = Number.isFinite(maxEvents) ? Math.max(0, Math.min(8, Math.floor(maxEvents))) : 4;
    if (limit === 0) return 'No known major world events yet.';
    // The public-event knowledge bank is already bounded per actor. Scan
    // event references once and keep at most eight known, day-eligible records;
    // never sort/clone every event just to build one chat context.
    const triggered = this.getTriggeredEventsForIds(new Set(map.keys()), currentDay).slice(-limit);
    const eventLines = triggered.map((e) => {
      const k = map.get(e.id);
      const att = k ? ` [${k.attitude}]` : '';
      const take = k ? ` — you feel: "${k.personalTake}"` : '';
      return `- [Day ${e.triggerDay}] ${e.title}${att}: ${e.knowledgePrompt}${take}`;
    });
    // This is consumed by Pulse DM prompt context. A claim provides only
    // what the NPC heard; never dereference its fact ID to expose hidden truth.
    const learned = this.semanticKnowledge.forActor(buddyId);
    const factLines = learned.facts.slice(-limit).map((fact) =>
      `- Known fact: ${fact.subjectId}.${fact.predicate} = ${JSON.stringify(fact.value)} (via ${fact.established.kind})`);
    const claimLines = learned.claims.slice(-limit).map((claim) =>
      `- Unverified rumor about ${claim.factId}: asserted ${JSON.stringify(claim.assertedValue)} (via ${claim.published.kind})`);
    const lines = [...eventLines, ...factLines, ...claimLines].slice(-limit * 2);
    return lines.length > 0 ? lines.join('\n') : 'No known major world events yet.';
  }

  public getBuddyKnowledge(rawBuddyId: string): BuddyEventKnowledge[] {
    return (this.buddyKnowledge.get(normalizeBuddyId(rawBuddyId)) ?? [])
      .map(k => ({ ...k, ...(k.source ? { source: { ...k.source } } : {}) }));
  }

  /** Direct discovery/disclosure uses explicit provenance and cannot create world events. */
  public learnEventForBuddy(rawBuddyId: string, eventId: string, source: KnowledgeProvenance): boolean {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const evt = this.triggeredEvents.get(eventId);
    if (!evt || !this.listBuddyIds().includes(buddyId) || !Number.isSafeInteger(source?.atMinute)
      || source.atMinute < 0 || !source.sourceId || !source.kind) return false;
    const existing = this.buddyKnowledge.get(buddyId) ?? [];
    if (existing.some(k => k.eventId === eventId)) return false;
    const entry = this.makePublicEventKnowledge(buddyId, evt, source.atMinute);
    entry.source = { ...source };
    this.buddyKnowledge.set(buddyId, [...existing, entry].slice(-20));
    this.bumpVersion();
    return true;
  }

  public isEventKnownToBuddy(rawBuddyId: string, eventId: string): boolean {
    return (this.buddyKnowledge.get(normalizeBuddyId(rawBuddyId)) ?? [])
      .some(entry => entry.eventId === eventId && this.triggeredEvents.has(eventId));
  }

  /** Structured semantic truth writes are domain-owned, never AI/Ink free writes. */
  public establishSemanticFact(fact: WorldFactRecord): boolean {
    const changed = this.semanticKnowledge.establishFact(fact);
    if (changed) this.bumpVersion();
    return changed;
  }

  public publishSemanticClaim(claim: ClaimRecord): boolean {
    const changed = this.semanticKnowledge.publishClaim(claim);
    if (changed) this.bumpVersion();
    return changed;
  }

  public learnSemanticReference(actorId: string, receipt: KnowledgeReceipt): boolean {
    const changed = this.semanticKnowledge.learn(actorId, receipt);
    if (changed) this.bumpVersion();
    return changed;
  }

  public actorKnowsSemanticFact(actorId: string, factId: string): boolean {
    return this.semanticKnowledge.knowsFact(actorId, factId);
  }

  public actorHeardSemanticClaim(actorId: string, claimId: string): boolean {
    return this.semanticKnowledge.heardClaim(actorId, claimId);
  }

  /** Player-safe when actorId is 'player'; hidden truth is never included. */
  public getActorSemanticKnowledge(actorId: string): ActorKnowledgeView {
    return this.semanticKnowledge.forActor(actorId);
  }

  /** One subject's facts and heard claims known to a specified viewer. */
  public getKnownSemanticContextForSubject(viewerId: string, subjectId: string): ActorKnowledgeView {
    return this.semanticKnowledge.forActorSubject(viewerId, subjectId);
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

  /** Inspector-only, bounded appointment page plus a short today summary. */
  public getLabAppointmentRead(day: number, offset = 0, limit = 16): {
    total: number;
    todayCount: number;
    today: Appointment[];
    page: Appointment[];
  } {
    const start = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
    const size = Number.isFinite(limit) ? Math.max(1, Math.min(16, Math.trunc(limit))) : 16;
    let todayCount = 0;
    const today: Appointment[] = [];
    const page: Appointment[] = [];
    for (let i = 0; i < this.appointments.length; i++) {
      const appt = this.appointments[i]!;
      if (appt.targetDay === day) {
        todayCount++;
        if (today.length < 8) today.push({ ...appt });
      }
      if (i >= start && i < start + size) page.push({ ...appt });
    }
    return { total: this.appointments.length, todayCount, today, page };
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
    if (added.length > 0) {
      this.bumpVersion();
      // Source provenance for async procedural writers. The consumer's
      // outer boundary, not this event, decides when to publish a revision.
      this.eventBus.emit('world:procedural_events_injected' as any, { ids: [...added] });
    }
    return added;
  }

  public getBuddyKnowledgeMap(): Record<string, BuddyEventKnowledge[]> {
    const out: Record<string, BuddyEventKnowledge[]> = {};
    for (const [k, v] of this.buddyKnowledge.entries()) out[k] = v.map((e) => ({
      ...e, ...(e.source ? { source: { ...e.source } } : {}),
    }));
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
    // Exactly the same 12 most recent eligible events as the stable legacy
    // ascending-sort then descending-sort path, but never sort all history.
    return this.getRecentTriggeredEventsForDay(currentDay, 12, true)
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

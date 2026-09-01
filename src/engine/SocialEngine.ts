import {
  BuddyPresenceStatus,
  RelationshipDimensions,
  BuddyCharacter,
  BuddyPresence,
  MessageRecord,
  SocialEngineState,
  ScheduleBlock,
} from './types';
import { EventBus } from './EventBus';

export class SocialEngine {
  private buddies: Map<string, BuddyCharacter> = new Map();
  private relationships: Map<string, RelationshipDimensions> = new Map();
  private presence: Map<string, BuddyPresence> = new Map();
  private conversations: Map<string, MessageRecord[]> = new Map();
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialState?: SocialEngineState) {
    this.eventBus = eventBus;
    this.initializeCharacters();

    if (initialState) {
      this.restoreState(initialState);
    } else {
      this.initializeDefaultState();
    }
  }

  public getState(): SocialEngineState {
    const rels: Record<string, RelationshipDimensions> = {};
    for (const [id, r] of this.relationships.entries()) rels[id] = { ...r };

    const pres: Record<string, BuddyPresence> = {};
    for (const [id, p] of this.presence.entries()) pres[id] = { ...p };

    const convs: Record<string, MessageRecord[]> = {};
    for (const [id, msgs] of this.conversations.entries()) convs[id] = msgs.map(m => ({ ...m }));

    return { relationships: rels, presence: pres, conversations: convs };
  }

  public restoreState(state: SocialEngineState): void {
    this.relationships.clear();
    for (const [id, r] of Object.entries(state.relationships)) {
      this.relationships.set(id, { ...r });
    }

    this.presence.clear();
    for (const [id, p] of Object.entries(state.presence)) {
      this.presence.set(id, { ...p });
    }

    this.conversations.clear();
    for (const [id, msgs] of Object.entries(state.conversations)) {
      this.conversations.set(id, msgs.map(m => ({ ...m })));
    }
  }

  private initializeDefaultState(): void {
    for (const buddy of this.buddies.values()) {
      this.relationships.set(buddy.id, { ...buddy.initialRelationships });
      this.presence.set(buddy.id, { status: 'offline', awayMessage: '' });
      this.conversations.set(buddy.id, []);
    }
  }

  private initializeCharacters(): void {
    // 1. Ryan (Food Cart Coworker)
    const ryanSchedule = this.generateStandardSchedule([
      { start: 0, end: 420, status: 'offline', msg: 'asleep' },
      { start: 420, end: 540, status: 'offline', msg: 'commute' },
      { start: 540, end: 960, status: 'offline', msg: 'work @ cart' },
      { start: 960, end: 1080, status: 'away', msg: 'afk grabbin tacos' },
      { start: 1080, end: 1320, status: 'online', msg: 'gaming / chilling' },
      { start: 1320, end: 1440, status: 'offline', msg: 'sleep is for the weak' },
    ]);

    this.buddies.set('ryan', {
      id: 'ryan',
      displayName: 'Ryan',
      handle: 'ryan_foodcart',
      schedule: ryanSchedule,
      initialRelationships: { familiarity: 40, trust: 50, comfort: 50, respect: 40, annoyance: 0 },
      typingSpeedWpm: 80,
    });

    // 2. Maya (Primary Arc)
    const mayaSchedule = this.generateStandardSchedule([
      { start: 0, end: 480, status: 'offline', msg: 'sleeping' },
      { start: 480, end: 540, status: 'offline', msg: 'morning tea' },
      { start: 540, end: 1050, status: 'away', msg: 'at the desk... dont look at me' },
      { start: 1050, end: 1260, status: 'online', msg: 'home! making coffee :)' },
      { start: 1260, end: 1440, status: 'online', msg: 'listening to the rain ~ myplace/mayablue' },
    ]);

    this.buddies.set('maya', {
      id: 'maya',
      displayName: 'Maya',
      handle: 'starlight_maya',
      schedule: mayaSchedule,
      initialRelationships: { familiarity: 10, trust: 20, comfort: 30, respect: 40, annoyance: 0 },
      typingSpeedWpm: 60,
    });

    // 3. Nora (NightOwl87)
    const noraSchedule = this.generateStandardSchedule([
      { start: 0, end: 300, status: 'online', msg: 'the night is quiet' },
      { start: 300, end: 360, status: 'away', msg: 'watching dawn' },
      { start: 360, end: 1140, status: 'offline', msg: 'offline' },
      { start: 1140, end: 1320, status: 'away', msg: 'indexing old logs' },
      { start: 1320, end: 1440, status: 'online', msg: 'nightboard / logs' },
    ]);

    this.buddies.set('nora', {
      id: 'nora',
      displayName: 'Nora',
      handle: 'NightOwl87',
      schedule: noraSchedule,
      initialRelationships: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0 },
      typingSpeedWpm: 90,
    });

    // 4. Mr. Henderson (Landlord)
    const hendersonSchedule = this.generateStandardSchedule([
      { start: 0, end: 480, status: 'offline', msg: 'office closed' },
      { start: 480, end: 1200, status: 'online', msg: 'motel front desk open' },
      { start: 1200, end: 1440, status: 'offline', msg: 'office closed' },
    ]);

    this.buddies.set('henderson', {
      id: 'henderson',
      displayName: 'Mr. Henderson',
      handle: 'motel_office',
      schedule: hendersonSchedule,
      initialRelationships: { familiarity: 30, trust: 30, comfort: 20, respect: 40, annoyance: 10 },
      typingSpeedWpm: 40,
    });
  }

  private generateStandardSchedule(
    blocks: Array<{ start: number; end: number; status: BuddyPresenceStatus; msg: string }>
  ): Record<number, ScheduleBlock[]> {
    const sched: Record<number, ScheduleBlock[]> = {};
    for (let day = 1; day <= 14; day++) {
      sched[day] = blocks.map(b => ({
        startMinuteOfDay: b.start,
        endMinuteOfDay: b.end,
        status: b.status,
        awayMessage: b.msg,
      }));
    }
    return sched;
  }

  /**
   * Updates contact presence based on current game time.
   */
  public updatePresence(currentTotalMinutes: number): void {
    const day = Math.floor(currentTotalMinutes / 1440) + 1;
    const minuteOfDay = currentTotalMinutes % 1440;

    for (const [id, buddy] of this.buddies.entries()) {
      const daySched = buddy.schedule[day] || buddy.schedule[1];
      let currentBlock = daySched?.find(
        b => minuteOfDay >= b.startMinuteOfDay && minuteOfDay < b.endMinuteOfDay
      );

      if (!currentBlock && daySched && daySched.length > 0) {
        currentBlock = daySched[0];
      }

      if (currentBlock) {
        const prev = this.presence.get(id);
        if (!prev || prev.status !== currentBlock.status || prev.awayMessage !== currentBlock.awayMessage) {
          const newPresence: BuddyPresence = {
            status: currentBlock.status,
            awayMessage: currentBlock.awayMessage,
          };
          this.presence.set(id, newPresence);
          this.eventBus.emit('social:status_changed', { buddyId: id, presence: newPresence });
        }
      }
    }
  }

  public applySocialAction(buddyId: string, actionType: string): RelationshipDimensions {
    const current = this.relationships.get(buddyId);
    if (!current) throw new Error(`Buddy not found: ${buddyId}`);

    const deltas: Record<string, Partial<RelationshipDimensions>> = {
      empathy: { familiarity: 3, trust: 4, comfort: 5, respect: 2, annoyance: -2 },
      remembered_detail: { familiarity: 5, trust: 6, comfort: 6, respect: 4, annoyance: -1 },
      tease_playful: { familiarity: 4, trust: 2, comfort: 3, respect: 2, annoyance: 0 },
      dismissive: { familiarity: -1, trust: -5, comfort: -6, respect: -3, annoyance: 8 },
      vulnerable_share: { familiarity: 6, trust: 7, comfort: 8, respect: 3, annoyance: -2 },
      work_camaraderie: { familiarity: 4, trust: 3, comfort: 4, respect: 3, annoyance: 0 },
      intellectual_curiosity: { familiarity: 4, trust: 5, comfort: 2, respect: 6, annoyance: 0 },
    };

    const delta = deltas[actionType] || { familiarity: 1 };

    const updated: RelationshipDimensions = {
      familiarity: Math.max(0, Math.min(100, current.familiarity + (delta.familiarity ?? 0))),
      trust: Math.max(0, Math.min(100, current.trust + (delta.trust ?? 0))),
      comfort: Math.max(0, Math.min(100, current.comfort + (delta.comfort ?? 0))),
      respect: Math.max(0, Math.min(100, current.respect + (delta.respect ?? 0))),
      annoyance: Math.max(0, Math.min(100, current.annoyance + (delta.annoyance ?? 0))),
    };

    this.relationships.set(buddyId, updated);
    this.eventBus.emit('social:relationship_updated', {
      buddyId,
      dimensions: { ...updated },
      delta,
    });

    return { ...updated };
  }

  public sendMessage(
    conversationId: string,
    senderId: string,
    recipientId: string,
    text: string,
    currentMinute: number,
    deliveredAway = false,
    tags?: string[],
    imageUrl?: string,
    imagePrompt?: string,
    imageCaption?: string
  ): MessageRecord {
    const day = Math.floor(currentMinute / 1440) + 1;
    const msg: MessageRecord = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conversationId,
      senderId,
      recipientId,
      text,
      timestampMinute: currentMinute,
      day,
      isRead: senderId === 'player',
      deliveredAway,
      tags,
      imageUrl,
      imagePrompt,
      imageCaption,
    };

    const existing = this.conversations.get(conversationId) || [];
    existing.push(msg);
    this.conversations.set(conversationId, existing);

    this.eventBus.emit('social:message_received', { message: { ...msg } });
    return { ...msg };
  }

  public markAsRead(conversationId: string): void {
    const msgs = this.conversations.get(conversationId);
    if (msgs) {
      for (const m of msgs) {
        m.isRead = true;
      }
    }
  }

  public getBuddy(id: string): BuddyCharacter | undefined {
    return this.buddies.get(id);
  }

  public getBuddies(): BuddyCharacter[] {
    return Array.from(this.buddies.values());
  }

  public getRelationships(id: string): RelationshipDimensions | undefined {
    const rel = this.relationships.get(id);
    return rel ? { ...rel } : undefined;
  }

  public getPresence(id: string): BuddyPresence | undefined {
    const pres = this.presence.get(id);
    return pres ? { ...pres } : undefined;
  }

  public getMessages(conversationId: string): MessageRecord[] {
    const msgs = this.conversations.get(conversationId) || [];
    return msgs.map(m => ({ ...m }));
  }
}

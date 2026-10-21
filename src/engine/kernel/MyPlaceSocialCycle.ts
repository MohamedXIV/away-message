import type { CoreDomainOwners } from './CoreDomainOwners';
import { SEED_PROFILE_ALIASES } from '../MyPlaceEngine';
import { SEED_BY_ID } from '../seedCharacters';
import type { TimeAdvanceMode } from './TimeAdvancement';
import { appointmentRoll } from '../AppointmentDirector';
import {
  pickGuestbookLine,
  pickGuestbookReplyLine,
  pickTop8NewsLine,
  pickMyplaceUpdateLine,
} from '../characterTemplates';

type SocialSiteOwners = Pick<
  CoreDomainOwners,
  'clock' | 'social' | 'world' | 'myplace' | 'telemetry' | 'events'
>;

/**
 * Life on MyPlace is domain-owned social/world work, not a simulation kernel
 * responsibility. Reuses the single roster, relationship graph and site state.
 *
 * Run when the canonical EventBus emits a day transition. This coordinator
 * stores no second roster, account history, clock or daily progression state.
 */
export class MyPlaceSocialCycle {
  constructor(
    private readonly owners: SocialSiteOwners,
    /** Late AI/template completion occurs after the clock boundary has closed. */
    private readonly publishAsyncCompletion: () => void = () => {},
  ) {}

  public processDay(day: number): void {
    // Preserve historical order: Top 8 re-ranks can produce news, then the
    // guestbook culture generates replies and NPC-to-NPC notes.
    this.refreshTop8Periodic(day);
    this.processGuestbookDaily(day);
  }

  public resolveProfileUsername(buddy: { id: string; handle: string }): string | null {
    try {
      const alias = SEED_PROFILE_ALIASES[buddy.id] ?? SEED_PROFILE_ALIASES[buddy.handle];
      if (alias && this.owners.myplace.getNpcProfile(alias)) return alias;
      if (this.owners.myplace.getNpcProfile(buddy.handle)) return buddy.handle;
      if (this.owners.myplace.getNpcProfile(buddy.id)) return buddy.id;
    } catch { /* resolution is best-effort */ }
    return null;
  }

  private static top8StageBonus(stage: string): number {
    if (stage === 'close') return 30;
    if (stage === 'friend') return 20;
    if (stage === 'acquaintance') return 10;
    if (stage === 'stranger') return 0;
    return -50; // strained: out of the running
  }

  /** Periodic Top 8 re-rank from live affinities (days 4, 7, 10, ...). Rules only. */
  private refreshTop8Periodic(newDay: number): void {
    if (newDay <= 1 || newDay % 3 !== 1) return;
    try {
      const minutes = this.owners.clock.getTotalMinutes();
      for (const buddy of this.owners.social.getBuddies()) {
        if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const profileKey = this.resolveProfileUsername(buddy);
        if (!profileKey) continue;
        const ranked = this.owners.social.getBuddies()
          .filter((o) => o.id !== buddy.id && o.status !== 'distant' && o.status !== 'gone' && o.status !== 'blocked')
          .map((o) => ({
            buddy: o,
            score: this.owners.social.getAffinity(buddy.id, o.id) + MyPlaceSocialCycle.top8StageBonus(this.owners.social.getRelationshipStage(o.id)),
          }))
          .sort((x, y) => y.score - x.score || (x.buddy.id < y.buddy.id ? -1 : 1))
          .slice(0, 8);
        const prevTop3 = String(this.owners.world.getFlag(`top3_${profileKey}`) || '').split(',').filter(Boolean);
        const nextTop3 = ranked.slice(0, 3).map((s) => s.buddy.id);
        this.owners.myplace.setNpcTop8(profileKey, ranked.map((s) => {
          const uname = this.resolveProfileUsername(s.buddy) ?? s.buddy.handle;
          const avatar = this.owners.myplace.getNpcProfile(uname)?.avatarGlyph || '📷';
          return { handle: uname, name: s.buddy.displayName, avatar };
        }));
        this.owners.world.setFlag(`top3_${profileKey}`, nextTop3.join(','));
        // Entries celebrate (positive-only news, one per day max)
        const entered = nextTop3.filter((id) => !prevTop3.includes(id));
        if (entered.length > 0 && !this.owners.world.getFlag(`top8news_${newDay}`)) {
          const entering = this.owners.social.getBuddy(entered[0]!);
          if (entering) {
            const stage = this.owners.social.getRelationshipStage(entering.id);
            if (stage === 'friend' || stage === 'close') {
              this.owners.world.setFlag(`top8news_${newDay}`, true);
              const rank = nextTop3.indexOf(entering.id) + 1;
              this.owners.social.sendMessage(entering.id, entering.id, 'player', pickTop8NewsLine(`${profileKey}:${newDay}`, buddy.displayName, rank), minutes, false, ['myplace', 'top8']);
              this.owners.telemetry.logEvent('social', 'myplace_top8_news', minutes, { buddyId: entering.id, owner: profileKey, rank });
            }
          }
        }
      }
    } catch { /* Top 8 never breaks the tick */ }
  }

  /** Daily guestbook life: NPC→NPC notes (max 2) + owner replies to yesterday's player notes (max 2). */
  private processGuestbookDaily(newDay: number): void {
    try {
      const minutes = this.owners.clock.getTotalMinutes();
      const active = this.owners.social.getBuddies().filter((b) => b.status !== 'distant' && b.status !== 'gone' && b.status !== 'blocked');
      if (active.length >= 2) {
        for (let slot = 0; slot < 2; slot++) {
          const writer = active[appointmentRoll(`${newDay}:gbw:${slot}`) % active.length]!;
          const others = active.filter((b) => b.id !== writer.id);
          if (others.length === 0) continue;
          const target = others[appointmentRoll(`${newDay}:gbt:${slot}`) % others.length]!;
          const targetKey = this.resolveProfileUsername(target);
          if (!targetKey) continue;
          // Guestbook culture is casual: any active, non-strained buddy signs
          if (this.owners.social.getRelationshipStage(writer.id) === 'strained') continue;
          const writerKey = this.resolveProfileUsername(writer) ?? writer.handle;
          this.owners.myplace.addGuestbookComment(targetKey, writerKey, pickGuestbookLine(`${targetKey}:${newDay}:${slot}`, target.displayName), minutes);
          this.owners.telemetry.logEvent('social', 'myplace_guestbook', minutes, { from: writer.id, to: targetKey });
        }
      }
      let replies = 0;
      for (const buddy of this.owners.social.getBuddies()) {
        if (replies >= 2) break;
        if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const key = this.resolveProfileUsername(buddy);
        if (!key) continue;
        const entries = this.owners.myplace.getGuestbook(key);
        const playerNote = entries.find((e) => e.author === 'wanderer06' && Math.floor(e.minute / 1440) + 1 === newDay - 1);
        if (!playerNote) continue;
        const alreadyReplied = entries.some((e) => e.minute > playerNote.minute
          && (e.author === key || e.author === buddy.handle || e.author === buddy.id));
        if (alreadyReplied) continue;
        if (appointmentRoll(`${key}:${newDay}:gbreply`) >= 60) continue;
        this.owners.myplace.addGuestbookComment(key, key, pickGuestbookReplyLine(`${key}:${newDay}`), minutes);
        replies++;
        this.owners.telemetry.logEvent('social', 'myplace_guestbook_reply', minutes, { to: key });
      }
    } catch { /* guestbook never breaks the tick */ }
  }

  public scheduleDailyProfileUpdate(
    mode: TimeAdvanceMode,
    day: number,
    currentMinutes: number,
  ): void {
    void this.owners.myplace.maybeUpdateRandomNpcProfile(day, currentMinutes).then((res) => {
      if (!res) return;
      try {
        const link = `http://myplace.local/${res.username}`;
        const announcer = Object.values(SEED_BY_ID).find((b) => b.myplace === res.username);
        const traits = announcer
          ? this.owners.social.getTraits(announcer.id)
          : { shyness: 50, discipline: 50 };
        const text = pickMyplaceUpdateLine(traits.shyness, traits.discipline, link);
        try {
          this.owners.social.sendMessage(
            res.username, res.username, 'player',
            text, currentMinutes, false, ['myplace_update'],
          );
        } catch {
          // Existing profile announcers are best effort.
        }
        if (mode === 'realtime') {
          // Preserve the original realtime-only notification/co-comment behavior
          // until a dedicated Social side-effect cutover owns it.
          this.maybeCoCommentProfileUpdate(res.username, day, currentMinutes);
          try {
            this.owners.events.emit('social:message_received' as any, {
              message: { senderId: res.username, text },
            });
          } catch {
            // Non-critical UI event.
          }
          this.maybeCoCommentProfileUpdate(res.username, day, currentMinutes);
        }
      } finally {
        // Even if optional social narration fails, the already committed
        // source-owned profile must still become visible to bounded readers.
        this.publishAsyncCompletion();
      }
    }).catch(() => {});
  }

  /** P5.4 co-comment: when an NPC refreshes their page, a mutual friend may sign the guestbook. */
  private maybeCoCommentProfileUpdate(username: string, day: number, currentMinutes: number): void {
    try {
      if (appointmentRoll(`${username}:${day}:gbco`) >= 50) return;
      const owner = this.owners.social.getBuddies().find((b) =>
        b.handle === username || b.id === username
        || SEED_PROFILE_ALIASES[b.id] === username || SEED_PROFILE_ALIASES[b.handle] === username);
      const candidates = this.owners.social.getBuddies().filter((b) => {
        if (owner && b.id === owner.id) return false;
        if (b.status === 'distant' || b.status === 'gone' || b.status === 'blocked') return false;
        const stage = this.owners.social.getRelationshipStage(b.id);
        return stage === 'friend' || stage === 'close';
      });
      if (candidates.length === 0) return;
      const commenter = candidates[appointmentRoll(`${username}:${day}:gbco2`) % candidates.length]!;
      const ownerProfile = this.owners.myplace.getNpcProfile(username);
      const authorKey = this.resolveProfileUsername(commenter) ?? commenter.handle;
      this.owners.myplace.addGuestbookComment(username, authorKey, pickGuestbookLine(`${username}:${day}:gbco`, ownerProfile?.displayName ?? username), currentMinutes);
      this.owners.telemetry.logEvent('social', 'myplace_guestbook', currentMinutes, { from: commenter.id, to: username });
    } catch { /* co-comments never break the tick */ }
  }

  /** P5.4 stub MyPlace pages for a buddy (myplace username when known, else handle/id). */
  public ensureMyPlaceStub(buddy: { handle?: string; id: string; displayName: string; archetype?: any; reach?: 'local' | 'remote'; backstory?: { label?: string; bioSeed?: string } }): void {
    try {
      // One page per buddy: prefer the registry myplace username so links stay canonical.
      const username = SEED_BY_ID[buddy.id]?.myplace || buddy.handle || buddy.id;
      this.owners.myplace.ensureNpcProfile({
        username,
        displayName: buddy.displayName,
        archetype: buddy.archetype,
        reach: buddy.reach ?? SEED_BY_ID[buddy.id]?.reach,
        actorId: buddy.id,
        backstory: buddy.backstory ?? SEED_BY_ID[buddy.id]?.backstory ?? undefined,
      });
      // Also index by raw id so MyPlace routing works with either key
      if (buddy.handle && buddy.handle !== buddy.id) {
        this.owners.myplace.ensureNpcProfile({
          username: buddy.id,
          displayName: buddy.displayName,
          archetype: buddy.archetype,
          reach: buddy.reach ?? SEED_BY_ID[buddy.id]?.reach,
          actorId: buddy.id,
          backstory: buddy.backstory ?? SEED_BY_ID[buddy.id]?.backstory ?? undefined,
        });
      }
    } catch { /* MyPlace stub is best-effort */ }
  }


}

import type { CoreDomainOwners } from './CoreDomainOwners';
import { traitCompatibility } from '../SocialEngine';
import {
  classifyScheduleBlock,
  AGENDA_LABELS,
  rollSeeded100,
  pickSeeded,
  spreadSeed,
  pickRuninSpot,
  pickRuninVerb,
  pickBackstoryReintro,
  pickMediationAskLine,
} from '../characterTemplates';

function isBuddyAvailable<T extends { status?: string }>(buddy: T | undefined): buddy is T {
  return !!buddy && buddy.status !== 'distant'
    && buddy.status !== 'gone' && buddy.status !== 'blocked';
}

/**
 * Canonical Social/World-bound actor-day policies. Never owns its own roster,
 * agendas, relationships, memories, messages, random-state or clock.
 * The caller invokes processDay once at each authoritative day boundary.
 * This does not execute independently of the simulation kernel.
 */
export class NpcSocialLifeCycle {
  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'social' | 'world' | 'clock' | 'telemetry'>,
  ) {}

  public processDay(newDay: number): void {
    try { this.ensureAgendaForDay(newDay); } catch { /* agenda never breaks the tick */ }
    try { this.ensureAgendaForDay(newDay + 1); } catch { /* planning ahead never breaks the tick */ }
    try { this.processNpcRunins(newDay); } catch { /* run-ins never break the tick */ }
    try { this.progressRomance(newDay); } catch { /* romance never breaks the tick */ }
    try { this.maybeRequestMediations(newDay); } catch { /* asks never break the tick */ }
    try { this.maybeReintroduceBackstories(newDay); } catch { /* re-intros never break the tick */ }
  }

  private buddyDisplayName(buddyId: string): string {
    try {
      return this.owners.social.getBuddy(buddyId)?.displayName ?? buddyId;
    } catch { return buddyId; }
  }

  /** Schedule blocks for a buddy on a day (exact → weekly rotation → day 1, like presence). */
  private dayBlocks(buddyId: string, day: number): Array<{ startMinuteOfDay: number; endMinuteOfDay: number; status: string; awayMessage: string }> {
    const buddy = this.owners.social.getBuddy(buddyId);
    if (!buddy) return [];
    const weeklyDay = ((day - 1) % 7) + 1;
    return buddy.schedule[day] ?? buddy.schedule[weeklyDay] ?? buddy.schedule[1] ?? [];
  }

  /**
   * Weekly-fill planning: buddies with an empty day get 0–2 social/errand items
   * in free (online/away, non-sleep/work) windows. Seeded by (buddy, day);
   * spontaneity raises the odds. Never overwrites hand-set items.
   */
  private ensureAgendaForDay(day: number): void {
    const safeDay = Math.max(1, Math.floor(day) || 1);
    for (const buddy of this.owners.social.getBuddies()) {
      if (!isBuddyAvailable(buddy)) continue;
      if (this.owners.social.getAgenda(buddy.id, safeDay).length > 0) continue;
      const free = this.dayBlocks(buddy.id, safeDay).filter(
        (b) => (b.status === 'online' || b.status === 'away') && !classifyScheduleBlock(b.awayMessage)
      );
      if (free.length === 0) continue;
      const traits = this.owners.social.getTraits(buddy.id);
      if (rollSeeded100(`${buddy.id}:agenda:${safeDay}`) >= 30 + traits.spontaneity * 0.35) continue;
      const count = rollSeeded100(`${buddy.id}:agenda:${safeDay}:count`) < traits.spontaneity * 0.3 ? 2 : 1;
      const fresh: Array<{ kind: 'social' | 'errand'; label: string; day: number; startMinute: number; endMinute: number }> = [];
      for (let i = 0; i < count; i++) {
        const window = pickSeeded(free, `${buddy.id}:agenda:${safeDay}:win:${i}`);
        const span = Math.max(1, window.endMinuteOfDay - window.startMinuteOfDay - 30);
        const start = window.startMinuteOfDay + (spreadSeed(`${buddy.id}:agenda:${safeDay}:at:${i}`) % span);
        const end = Math.min(window.endMinuteOfDay, start + 45 + (spreadSeed(`${buddy.id}:agenda:${safeDay}:len:${i}`) % 45));
        const kind = rollSeeded100(`${buddy.id}:agenda:${safeDay}:kind:${i}`) < 55 ? 'social' as const : 'errand' as const;
        const label = pickSeeded(AGENDA_LABELS[kind], `${buddy.id}:agenda:${safeDay}:what:${i}`);
        fresh.push({ kind, label, day: safeDay, startMinute: start, endMinute: end });
      }
      const merged = [...this.owners.social.getAgenda(buddy.id), ...fresh.map((f, i) => ({ id: `ag_${safeDay}_${buddy.id}_${i}`, ...f }))];
      this.owners.social.setAgenda(buddy.id, merged);
    }
  }

  /** True when both buddies share a non-offline window of >= 30 minutes that day. */
  private schedulesOverlap(a: string, b: string, day: number): boolean {
    const blocksA = this.dayBlocks(a, day).filter((x) => x.status !== 'offline');
    const blocksB = this.dayBlocks(b, day).filter((x) => x.status !== 'offline');
    for (const x of blocksA) {
      for (const y of blocksB) {
        const overlap = Math.min(x.endMinuteOfDay, y.endMinuteOfDay) - Math.max(x.startMinuteOfDay, y.startMinuteOfDay);
        if (overlap >= 30) return true;
      }
    }
    return false;
  }

  /** Pick the NPC↔NPC action from bond state (seeded; rules only). */
  private pickNpcAction(a: string, b: string, day: number): string {
    const out = this.owners.social.getNpcBond(a, b);
    const back = this.owners.social.getNpcBond(b, a);
    const roll = rollSeeded100(`runinact:${a}:${b}:${day}`);
    const hot = Math.max(out.dims.annoyance, back.dims.annoyance) >= 50
      || Math.max(out.dims.resentment, back.dims.resentment) >= 40;
    if (hot) return roll < 50 ? 'argument' : 'cold_shoulder';
    const involved = out.romance !== 'none' || back.romance !== 'none';
    if (involved) return roll < 45 ? 'deep_talk' : roll < 75 ? 'shared_activity' : 'warm_chat';
    const mutualWarm = out.dims.affection >= 20 && back.dims.affection >= 20
      && out.dims.attraction >= 15 && back.dims.attraction >= 15;
    if (mutualWarm && !this.owners.social.isDatingAnyone(a) && !this.owners.social.isDatingAnyone(b)) {
      return roll < 40 ? 'flirt' : 'deep_talk';
    }
    if (roll < 10) return 'support_crisis';
    if (roll < 25) return 'small_favor';
    if (roll < 50) return 'deep_talk';
    if (roll < 75) return 'shared_activity';
    return 'warm_chat';
  }

  /**
   * NPC↔NPC run-ins: overlapping schedules + seeded lottery (spontaneity and
   * warmth raise the odds). Max 3/day, 1/pair/day. Applies the fixed delta
   * table both directions, logs a witness line, and runs the mediation
   * exposure check for the pair.
   */
  private processNpcRunins(day: number): void {
    const ids = this.owners.social.getBuddies().filter(isBuddyAvailable).map((b) => b.id).sort();
    if (ids.length < 2) return;
    const currentMinutes = this.owners.clock.getTotalMinutes();
    const done = new Set(
      this.owners.social.getNpcSocialLog(day).map((l) => [l.firstId, l.secondId].sort().join('__'))
    );
    let run = 0;
    for (let i = 0; i < ids.length && run < 3; i++) {
      for (let j = i + 1; j < ids.length && run < 3; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const key = [a, b].sort().join('__');
        if (done.has(key)) continue;
        if (!this.schedulesOverlap(a, b, day)) continue;
        const ta = this.owners.social.getTraits(a);
        const tb = this.owners.social.getTraits(b);
        const p = Math.min(55, 15 + ((ta.spontaneity + tb.spontaneity) / 2) * 0.3 + ((ta.warmth + tb.warmth) / 2) * 0.1);
        if (rollSeeded100(`runin:${key}:${day}`) >= p) continue;
        const action = this.pickNpcAction(a, b, day);
        this.owners.social.applyNpcSocialAction(a, b, action, day);
        this.owners.social.applyNpcSocialAction(b, a, action, day);
        const spot = pickRuninSpot(`${key}:${day}`);
        const verb = pickRuninVerb(action, `${key}:${day}`);
        this.owners.social.logNpcInteraction({
          day,
          firstId: a,
          secondId: b,
          location: spot,
          line: `${this.buddyDisplayName(a)} and ${this.buddyDisplayName(b)} ${verb} at ${spot}.`,
        });
        this.owners.social.checkMediationExposure(a, b, day);
        // Certain pairs compare notes about the player too (silent convergence).
        if (this.owners.social.getPlayerRead(a).certainty >= 40 && this.owners.social.getPlayerRead(b).certainty >= 40) {
          if (rollSeeded100(`align:${key}:${day}`) < 30) this.owners.social.alignPlayerReads(a, b, day);
        }
        this.owners.telemetry.logEvent('social', 'npc_runin', currentMinutes, { a, b, action });
        done.add(key);
        run++;
      }
    }
  }

  /**
   * Cozy romance ladder (non-explicit, informal): mutual warmth + trait
   * compatibility → crush → dating (one partner at a time); festering
   * resentment/annoyance → split. Crushes form quietly; datings and splits
   * leave witness lines.
   */
  private progressRomance(day: number): void {
    const ids = this.owners.social.getBuddies().filter(isBuddyAvailable).map((b) => b.id).sort();
    const currentMinutes = this.owners.clock.getTotalMinutes();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const compat = traitCompatibility(this.owners.social.getTraits(a), this.owners.social.getTraits(b));
        for (const [x, y] of [[a, b], [b, a]] as Array<[string, string]>) {
          const out = this.owners.social.getNpcBond(x, y);
          if (out.romance === 'none') {
            if (compat >= 55 && out.dims.affection >= 25 && out.dims.attraction >= 15
              && out.dims.annoyance < 40 && out.dims.resentment < 20) {
              this.owners.social.setNpcRomance(x, y, 'crush', day);
              this.owners.telemetry.logEvent('social', 'npc_crush', currentMinutes, { from: x, to: y });
            }
            continue;
          }
          if (out.romance === 'crush') {
            const back = this.owners.social.getNpcBond(y, x);
            const mutual = back.dims.affection >= 40 && back.romance !== 'none';
            if (out.dims.affection >= 45 && out.dims.comfort >= 45 && out.dims.trust >= 40 && mutual
              && out.dims.annoyance < 40 && out.dims.resentment < 20
              && !this.owners.social.isDatingAnyone(x) && !this.owners.social.isDatingAnyone(y)) {
              this.owners.social.setNpcRomance(x, y, 'dating', day);
              this.owners.social.setNpcRomance(y, x, 'dating', day);
              this.owners.social.logNpcInteraction({
                day,
                firstId: x,
                secondId: y,
                location: pickRuninSpot(`romance:${x}:${y}:${day}`),
                line: `${this.buddyDisplayName(x)} and ${this.buddyDisplayName(y)} are seeing each other now.`,
              });
              this.owners.telemetry.logEvent('social', 'npc_dating', currentMinutes, { a: x, b: y });
            } else if (out.dims.affection < 10) {
              this.owners.social.setNpcRomance(x, y, 'none', day);
            }
            continue;
          }
          // dating: split when the bond festers (strained-level pain ends informal ties)
          const cur = this.owners.social.getNpcBond(x, y);
          if (cur.romance !== 'none' && (cur.dims.resentment >= 50 || cur.dims.annoyance >= 60)) {
            const wasDating = cur.romance === 'dating';
            this.owners.social.setNpcRomance(x, y, 'none', day);
            if (wasDating) this.owners.social.setNpcRomance(y, x, 'none', day);
            this.owners.social.logNpcInteraction({
              day,
              firstId: x,
              secondId: y,
              location: 'around town',
              line: `${this.buddyDisplayName(x)} and ${this.buddyDisplayName(y)} split up.`,
            });
            this.owners.telemetry.logEvent('social', 'npc_split', currentMinutes, { a: x, b: y });
          }
        }
      }
    }
  }

  /**
   * Backstory re-introductions: people from before day 1 say hello again on
   * days 1–3 (max 2/day, once each) — and meeting them IS learning them.
   * Strangers never re-introduce. Empty-start rosters stay silent.
   */
  private maybeReintroduceBackstories(day: number): void {
    if (day < 1 || day > 3) return;
    const currentMinutes = this.owners.clock.getTotalMinutes();
    let said = 0;
    for (const buddy of this.owners.social.getBuddies()) {
      if (said >= 2) break;
      if (!isBuddyAvailable(buddy)) continue;
      const story = buddy.backstory;
      if (!story || story.relationship === 'stranger') continue;
      if (this.owners.social.isKnown(buddy.id)) continue;
      if (this.owners.world.getFlag(`reintro_${buddy.id}`)) continue;
      if (story.relationship !== 'close' && story.relationship !== 'friend'
        && story.relationship !== 'acquaintance' && story.relationship !== 'estranged') continue;
      const text = pickBackstoryReintro(story.relationship, `${buddy.id}:${day}`, buddy.displayName);
      this.owners.social.sendMessage(buddy.id, buddy.id, 'player', text, currentMinutes, false, ['reintro', 'backstory']);
      this.owners.social.learnHandle(buddy.id, buddy.handle);
      this.owners.world.setFlag(`reintro_${buddy.id}`, true);
      this.owners.telemetry.logEvent('social', 'backstory_reintro', currentMinutes, { buddyId: buddy.id });
      said++;
    }
  }

  private maybeRequestMediations(day: number): void {
    const currentMinutes = this.owners.clock.getTotalMinutes();
    const buddies = this.owners.social.getBuddies().filter(isBuddyAvailable).sort((x, y) => x.id.localeCompare(y.id));
    let asked = 0;
    for (const buddy of buddies) {
      if (asked >= 2) break;
      const last = this.owners.world.getFlag(`medask_${buddy.id}`);
      if (typeof last === 'number' && day - last < 4) continue;
      // Nobody asks favors of someone they read as disloyal.
      if (this.owners.social.getPlayerRead(buddy.id).beliefs.loyalty < 20) continue;
      const traits = this.owners.social.getTraits(buddy.id);
      if (rollSeeded100(`medask:${buddy.id}:${day}`) >= 8 + traits.warmth * 0.08) continue;
      const others = buddies.filter((o) => o.id !== buddy.id);
      if (others.length === 0) continue;
      const roll = rollSeeded100(`medkind:${buddy.id}:${day}`);
      let kind: 'introduce' | 'strengthen' | 'ask_about' = 'ask_about';
      let target = pickSeeded(others, `medwho:${buddy.id}:${day}`);
      if (roll < 35) {
        const strained = others.find((o) => this.owners.social.getNpcBond(buddy.id, o.id).dims.annoyance >= 15);
        if (!strained) continue;
        kind = 'strengthen';
        target = strained;
      } else if (roll < 70) {
        const strangers = others.filter((o) => this.owners.social.getNpcBond(buddy.id, o.id).dims.familiarity < 20);
        if (strangers.length === 0) continue;
        kind = 'introduce';
        target = pickSeeded(strangers, `medwho:${buddy.id}:${day}`);
      }
      const record = this.owners.social.requestMediation(buddy.id, target.id, kind, day);
      if (!record) continue;
      this.owners.world.setFlag(`medask_${buddy.id}`, day);
      const text = pickMediationAskLine(kind, `${buddy.id}:${day}`, this.buddyDisplayName(target.id));
      this.owners.social.sendMessage(buddy.id, buddy.id, 'player', text, currentMinutes, false, ['mediation', record.id]);
      this.owners.telemetry.logEvent('social', 'mediation_requested', currentMinutes, { requester: buddy.id, target: target.id, kind });
      asked++;
    }
  }


}

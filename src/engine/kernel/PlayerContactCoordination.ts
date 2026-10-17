import type { ActionResult, SimulationAction } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import { generateNewcomer, NEWCOMER_METVIA_ROTATION } from '../CharacterDirector';
import {
  pickContactLine,
  pickContactBounce,
  rollSeeded100,
} from '../characterTemplates';
import {
  classifyPlayerTone,
  receptionForBoldAct,
  receptionHintFor,
  isApology,
  pickInnerVoice,
  BATTERY_LUKEWARM_EXTRA,
  BATTERY_WARM_REFUND,
  BATTERY_WARM_BONUS,
  BATTERY_APOLOGY_REWARD,
} from '../PlayerActs';

/**
 * Contact discovery and social-battery messages are player command policy,
 * not clock or roster owners. All NPCs, memories, messages, and relationships
 * remain in the single SocialEngine; Needs owns the battery; World owns gates.
 */
export class PlayerContactCoordination {
  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'social' | 'world' | 'needs' | 'telemetry'>,
    private readonly registerNewcomer: (action: Extract<SimulationAction, { type: 'SOCIAL_ADD_BUDDY' }>) => ActionResult,
    private readonly publishState: () => void,
    private readonly createNewcomer: typeof generateNewcomer = generateNewcomer,
  ) {}

  public addContactByHandle(rawHandle: string, currentMinutes: number): { success: boolean; error?: string; data?: unknown } {
    const handle = String(rawHandle || '').trim().slice(0, 40);
    if (!handle) return { success: false, error: 'Type a Pulse ID first.' };
    const day = this.owners.clock.getTime().day;
    const lower = handle.toLowerCase();
    const buddy = this.owners.social.getBuddies().find((b) => b.handle.toLowerCase() === lower);
    let candidate: { buddyId: string; status: string } | null = null;
    if (!buddy) {
      for (const b of this.owners.social.getBuddies()) {
        const hit = (b.backstory?.candidates ?? []).find((c) => c.handle.toLowerCase() === lower);
        if (hit) {
          candidate = { buddyId: b.id, status: hit.status };
          break;
        }
      }
    }
    const target = buddy ?? (candidate ? this.owners.social.getBuddy(candidate.buddyId) : undefined);
    if (!target) return { success: false, error: `No Pulse ID '${handle}' exists. Check the spelling.` };
    if (this.owners.social.getKnownHandles(target.id).some((h) => h.toLowerCase() === lower)) {
      return { success: true, data: { buddyId: target.id, already: true } };
    }
    if (candidate && candidate.status !== 'active') {
      const text = pickContactBounce(candidate.status === 'changed' ? 'changed' : 'dead', `${target.id}:${day}`);
      this.owners.social.addCoreMemory(target.id, {
        text: `Tried old handle "${handle}" — dead ID (day ${day}).`,
        kind: 'fact',
        day,
      });
      return { success: false, error: text };
    }
    if (this.owners.needs.getSocialBattery() < 2) {
      return { success: false, error: pickInnerVoice('blocked', `add:${target.id}:${day}`) };
    }
    if (this.owners.world.getFlag(`contactadd_${target.id}_${day}`)) {
      return { success: false, error: 'You already reached out today. Give it a day.' };
    }
    this.owners.world.setFlag(`contactadd_${target.id}_${day}`, true);
    this.owners.needs.spendSocialBattery(2);
    // Rules decide: close/friend always accept; others roll on warmth vs shyness.
    const stage = this.owners.social.getRelationshipStage(target.id);
    const traits = this.owners.social.getTraits(target.id);
    const roll = rollSeeded100(`contact:${target.id}:${day}:${handle.length}`);
    const accepted = stage === 'close' || stage === 'friend'
      || roll < 10 + traits.warmth * 0.3 - traits.shyness * 0.2 + (target.backstory && target.backstory.relationship !== 'stranger' ? 25 : 0);
    if (!accepted) {
      this.owners.social.sendMessage(target.id, target.id, 'player', pickContactLine('decline', `${target.id}:${day}`), currentMinutes, false, ['contact', 'declined']);
      this.owners.telemetry.logEvent('social', 'contact_declined', currentMinutes, { buddyId: target.id });
      this.publishState();
      return { success: true, data: { buddyId: target.id, accepted: false } };
    }
    this.owners.social.learnHandle(target.id, target.handle);
    this.owners.social.sendMessage(target.id, target.id, 'player', pickContactLine('accept', `${target.id}:${day}`), currentMinutes, false, ['contact', 'accepted']);
    this.owners.telemetry.logEvent('social', 'contact_added', currentMinutes, { buddyId: target.id });
    this.publishState();
    return { success: true, data: { buddyId: target.id, accepted: true } };
  }

  /**
   * Player-initiated NightBoard meet (rules-throttled newcomer source for the
   * unbounded online roster). Costs 6 battery, once per day. The meeting
   * itself is async (AI-or-template intro) — the dispatch only starts it.
   */
  public meetOnNightBoard(currentMinutes: number): { success: boolean; error?: string; data?: unknown } {
    const day = this.owners.clock.getTime().day;
    if (this.owners.world.getFlag(`nbmeet_${day}`)) {
      return { success: false, error: 'You already went looking tonight. Try again tomorrow.' };
    }
    if (this.owners.needs.getSocialBattery() < 6) {
      return { success: false, error: pickInnerVoice('blocked', `nbmeet:${day}`) };
    }
    this.owners.needs.spendSocialBattery(6);
    this.owners.world.setFlag(`nbmeet_${day}`, true);
    const metVia = NEWCOMER_METVIA_ROTATION[this.owners.social.getBuddies().filter((b) => b.isProcedural).length % NEWCOMER_METVIA_ROTATION.length]!;
    const existingIds = this.owners.social.getBuddies().map((b) => b.id);
    const loadEpoch = this.owners.world.getLoadEpoch();
    void this.createNewcomer({ metVia, day, seed: `nbmeet-day-${day}`, useAI: true }, { existingIds })
      .then((res) => {
        if (loadEpoch !== this.owners.world.getLoadEpoch()) return;
        // SOCIAL_ADD_BUDDY already publishes its own completed owner write.
        this.registerNewcomer({ type: 'SOCIAL_ADD_BUDDY', buddy: res.definition, introText: res.introText });
      })
      .catch(() => {});
    this.owners.telemetry.logEvent('social', 'nightboard_meet', currentMinutes, { day });
    this.publishState();
    return { success: true, data: { day } };
  }

  /**
   * Mediation asks: warm buddies occasionally ask the player to introduce them,
   * strengthen a fraying tie, or share what someone is like. One ask per buddy
   * per 4 days, max 2 asks/day. The ask arrives as a DM; the player answers
   * via MEDIATION_RESPOND (UI follow-up dispatches it).
   */
  // ==========================================
  // SOCIAL BATTERY — the introvert protagonist's meter (rules-only accounting)
  // Every player send costs; bold sends cost more and are judged at send time
  // (stage gate + seeded reception roll). Outcomes land immediately: warmth
  // refunds, awkwardness stings, rejection drains to zero and demands an
  // apology before that buddy hears another word. The AI only paraphrases
  // the stored reception hint — it never prices or judges.
  // ==========================================

  /**
   * Gate a player DM (pure rules; called before the message is stored).
   * { ok:false } carries an inner-voice line for the UI notice.
   * The 'scripted' tag (authored dialogue choices) bypasses the gate so
   * pre-battery story beats can never stall on an empty meter.
   */
  public gatePlayerMessage(rawBuddyId: string, text: string, tags?: string[]): { ok: boolean; error?: string } {
    const buddy = this.owners.social.getBuddy(rawBuddyId);
    if (!buddy) return { ok: true }; // system paths without a buddy stay ungated
    if ((tags ?? []).includes('scripted')) return { ok: true };
    const buddyId = buddy.id;
    const day = this.owners.clock.getTime().day;
    const apologizeKey = `must_apologize_${buddyId}`;
    // Owed apology: only an apology gets through (and it heals a little).
    if (this.owners.world.getFlag(apologizeKey)) {
      if (!isApology(text)) {
        return { ok: false, error: pickInnerVoice('must_apologize', `${buddyId}:${day}`) };
      }
      this.owners.world.setFlag(apologizeKey, false);
      this.owners.needs.rechargeSocialBattery(BATTERY_APOLOGY_REWARD);
      this.owners.social.applySocialAction(buddyId, 'apologize');
      // Owning it reads loyal and kind.
      this.owners.social.observePlayerTrait(buddyId, { loyalty: 65, warmth: 60 }, day);
      return { ok: true };
    }
    const assessment = classifyPlayerTone(text);
    if (this.owners.needs.getSocialBattery() < assessment.upfrontCost) {
      return { ok: false, error: pickInnerVoice('blocked', `${buddyId}:${day}`) };
    }
    this.owners.needs.spendSocialBattery(assessment.upfrontCost);
    // Every line teaches the buddy something: tone first, brevity second.
    if (assessment.tone === 'warm') {
      this.owners.social.observePlayerTrait(buddyId, { warmth: 80 }, day);
    } else if (assessment.tone === 'cold') {
      this.owners.social.observePlayerTrait(buddyId, { warmth: 15 }, day);
    } else if (assessment.boldness > 0) {
      this.owners.social.observePlayerTrait(buddyId, { spontaneity: 75, warmth: 70 }, day);
    } else {
      this.owners.social.observePlayerTrait(buddyId, {
        shyness: text.length < 25 ? 75 : text.length > 120 ? 35 : 55,
        warmth: 55,
      }, day);
    }
    if (assessment.boldness > 0) {
      const rels = this.owners.social.getRelationships(buddyId);
      const reception = receptionForBoldAct({
        buddyId,
        stage: this.owners.social.getRelationshipStage(buddyId),
        dims: rels ?? {
          familiarity: 0, trust: 0, comfort: 0, respect: 0, annoyance: 0,
          affection: 0, attraction: 0, suspicion: 0, resentment: 0,
        },
        traits: this.owners.social.getTraits(buddyId),
        day,
        seed: `${text.length}:${text.slice(0, 12)}`,
      }, assessment.boldness);
      this.owners.world.setFlag(`reception_${buddyId}_${day}`, reception);
      if (reception === 'warm') {
        this.owners.needs.rechargeSocialBattery(BATTERY_WARM_REFUND + BATTERY_WARM_BONUS);
      } else if (reception === 'lukewarm') {
        // Short of the sting: spendSocialBattery leaves the balance (lenient).
        this.owners.needs.spendSocialBattery(BATTERY_LUKEWARM_EXTRA);
      } else {
        this.owners.needs.drainSocialBattery();
        this.owners.world.setFlag(apologizeKey, true);
        this.owners.telemetry.logEvent('social', 'bold_rejected', this.owners.clock.getTotalMinutes(), { buddyId, tone: assessment.tone, reception });
      }
    }
    return { ok: true };
  }

  /** Prompt direction for a bold player line sent today (rules-stored, AI paraphrases). */
  public getReceptionHint(rawBuddyId: string, day: number): string {    try {
      const buddy = this.owners.social.getBuddy(rawBuddyId);
      if (!buddy) return '';
      const outcome = this.owners.world.getFlag(`reception_${buddy.id}_${Math.max(1, Math.floor(day) || 1)}`);
      if (outcome !== 'warm' && outcome !== 'lukewarm' && outcome !== 'reject' && outcome !== 'offlimits') return '';
      return receptionHintFor(outcome, buddy.displayName);
    } catch { return ''; }
  }

}

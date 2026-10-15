import type { CoreDomainOwners } from './CoreDomainOwners';
import {
  STRAINED_ANNOYANCE,
  DISTANT_ANNOYANCE,
  GONE_ANNOYANCE,
} from '../SocialEngine';
import {
  pickConfrontLine,
  pickFarewellLine,
  pickReturnLine,
  pickInitiativeText,
  resolveArchetype,
} from '../characterTemplates';

type RelationshipOwners = Pick<
  CoreDomainOwners, 'social' | 'world' | 'clock' | 'telemetry'
>;

/**
 * Daily promise consequences, social witnessed reputation, and the historical
 * sharp/distant/return flow.
 *
 * This is one domain policy over the existing relationship graph. It stores
 * no relationships or lifecycle state. #187 will separate actual actor
 * canonical lifecycle/contact state from derived relationship stage on this seam.
 */
export class RelationshipContinuity {
  constructor(private readonly owners: RelationshipOwners) {}

  public checkSharpRelationship(rawBuddyId: string, currentMinutes: number): void {
    try {
      const buddy = this.owners.social.getBuddy(rawBuddyId);
      if (!buddy) return;
      const buddyId = buddy.id;
      const rels = this.owners.social.getRelationships(buddyId);
      if (!rels) return;
      const day = this.owners.clock.getTime().day;
      const strainedKey = `strained_${buddyId}`;
      const sharpKey = `sharp_${buddyId}`;
      const sharpState = this.owners.world.getFlag(sharpKey);

      // Repair: strained flag set but annoyance cooled well below the line → silent repair
      if (this.owners.world.getFlag(strainedKey) && rels.annoyance < STRAINED_ANNOYANCE - 10) {
        this.owners.world.setFlag(strainedKey, false);
        if (this.owners.world.getFlag('sharp_active') === buddyId) this.owners.world.setFlag('sharp_active', '');
        if (sharpState === 'confronted') this.owners.world.setFlag(sharpKey, '');
        this.owners.telemetry.logEvent('social', 'relationship_repaired', currentMinutes, { buddyId });
        return;
      }
      if (rels.annoyance < STRAINED_ANNOYANCE) return;

      // Confrontation (once per strained episode)
      if (!this.owners.world.getFlag(strainedKey)) {
        const active = this.owners.world.getFlag('sharp_active');
        if (active && active !== buddyId && active !== '') return; // governor: wait your turn
        this.owners.world.setFlag(strainedKey, true);
        this.owners.world.setFlag(sharpKey, 'confronted');
        this.owners.world.setFlag(`${sharpKey}_day`, day);
        if (!active || active === '') this.owners.world.setFlag('sharp_active', buddyId);
        const text = pickConfrontLine(resolveArchetype(buddyId, buddy.archetype), `${buddyId}:${day}:sharp`);
        this.owners.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['sharp', 'confrontation']);
        this.owners.telemetry.logEvent('social', 'relationship_confrontation', currentMinutes, { buddyId, annoyance: rels.annoyance, witnesses: this.shiftWitnessAffinities(buddyId, -4) });
        return;
      }

      if (sharpState === 'confronted' && rels.annoyance >= DISTANT_ANNOYANCE) {
        const active = this.owners.world.getFlag('sharp_active');
        if (active && active !== buddyId && active !== '') return;
        this.owners.social.setActorCondition(buddyId, { lifecycle: 'active', contact: 'distant' });
        this.owners.world.setFlag(sharpKey, 'distant');
        this.owners.world.setFlag(`${sharpKey}_day`, day);
        this.owners.world.setFlag(`distant_${buddyId}_until`, day + 7);
        this.owners.world.setFlag('sharp_active', buddyId);
        const text = pickFarewellLine(resolveArchetype(buddyId, buddy.archetype), `${buddyId}:${day}:sharp`);
        this.owners.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['sharp', 'farewell']);
        this.owners.telemetry.logEvent('social', 'buddy_distant', currentMinutes, { buddyId, witnesses: this.shiftWitnessAffinities(buddyId, -10) });
        return;
      }
      if (sharpState === 'distant' && rels.annoyance >= GONE_ANNOYANCE) {
        // Genuinely gone: stays in roster as epitaph (memories kept), presence forced dark
        this.owners.social.setActorCondition(buddyId, { lifecycle: 'departed', contact: 'open' });
        this.owners.world.setFlag(sharpKey, 'gone');
        this.owners.world.setFlag(`${sharpKey}_day`, day);
        if (this.owners.world.getFlag('sharp_active') === buddyId) this.owners.world.setFlag('sharp_active', '');
        const text = pickFarewellLine(resolveArchetype(buddyId, buddy.archetype), `${buddyId}:${day}:sharp:gone`);
        this.owners.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['sharp', 'gone']);
        this.owners.telemetry.logEvent('social', 'buddy_gone', currentMinutes, { buddyId, witnesses: this.shiftWitnessAffinities(buddyId, -10) });
      }
    } catch { /* sharp events never break the tick */ }
  }

  /** P3 daily pass: overdue promises break + distant buddies return. Rules only, no AI. */
  public processRelationshipDaily(newDay: number): void {
    const currentMinutes = this.owners.clock.getTotalMinutes();
    try {
      const broken = this.owners.social.checkPromiseDues(newDay);
      for (const { buddyId, promise } of broken) {
        const stage = this.owners.social.getRelationshipStage(buddyId);
        // Only friend+ buddies complain out loud, and only once per day per buddy
        if ((stage === 'friend' || stage === 'close') && !this.owners.world.getFlag(`promise_nag_${buddyId}_${newDay}`)) {
          this.owners.world.setFlag(`promise_nag_${buddyId}_${newDay}`, true);
          const buddy = this.owners.social.getBuddy(buddyId);
          const text = pickInitiativeText(resolveArchetype(buddyId, buddy?.archetype), 'promise_reminder', `${buddyId}:${newDay}:nag`, { promiseText: promise.text });
          this.owners.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['promise', 'broken']);
        }
        this.owners.telemetry.logEvent('social', 'promise_broken', currentMinutes, { buddyId, promiseId: promise.id, witnesses: this.shiftWitnessAffinities(buddyId, -4) });
      }
    } catch { /* promises never break the tick */ }
    try {
      for (const buddy of this.owners.social.getBuddies()) {
        if (this.owners.social.getActorCondition(buddy.id)?.contact !== 'distant') continue;
        const until = this.owners.world.getFlag(`distant_${buddy.id}_until`);
        if (typeof until === 'number' && newDay < until) continue;
        this.owners.social.setActorCondition(buddy.id, { lifecycle: 'active', contact: 'open' });
        const rels = this.owners.social.getRelationships(buddy.id);
        if (rels) this.owners.social.adjustRelationship(buddy.id, { annoyance: 25, trust: Math.max(5, rels.trust - 10) });
        this.owners.world.setFlag(`sharp_${buddy.id}`, 'returned');
        this.owners.world.setFlag(`sharp_${buddy.id}_day`, newDay);
        this.owners.world.setFlag(`strained_${buddy.id}`, false);
        if (this.owners.world.getFlag('sharp_active') === buddy.id) this.owners.world.setFlag('sharp_active', '');
        const text = pickReturnLine(resolveArchetype(buddy.id, buddy.archetype), `${buddy.id}:${newDay}:return`);
        this.owners.social.sendMessage(buddy.id, buddy.id, 'player', text, currentMinutes, false, ['sharp', 'return']);
        this.owners.telemetry.logEvent('social', 'buddy_returned', currentMinutes, { buddyId: buddy.id, witnesses: this.shiftWitnessAffinities(buddy.id, 8) });
      }
    } catch { /* returns never break the tick */ }
  }

  /** P4 — the player's close friends notice what happens to their mutuals (affinity witness shift). */
  private shiftWitnessAffinities(targetId: string, delta: number): number {
    let count = 0;
    try {
      for (const buddy of this.owners.social.getBuddies()) {
        if (buddy.id === targetId) continue;
        const condition = this.owners.social.getActorCondition(buddy.id);
        if (!condition || condition.lifecycle === 'departed' || condition.contact !== 'open') continue;
        const stage = this.owners.social.getRelationshipStage(buddy.id);
        if (stage !== 'friend' && stage !== 'close') continue;
        this.owners.social.adjustAffinity(buddy.id, targetId, delta);
        count++;
      }
    } catch { /* witness shifts never break the tick */ }
    return count;
  }
}

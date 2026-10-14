import type { ActionResult } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import {
  CITY_NODES, isCityNodeId, quoteTravel, walkEnergyCost, rollStreetEncounter,
  BUS_FARE, type CityNodeId, type TravelMode,
} from '../CityMap';
import {
  OUTINGS, isValidOutingId, isOutingOpen, outingHoursLabel,
  dinerStaffEncounter, canalRegularEncounter, buildLaundromatRumor,
  MIN_OUTING_ENERGY, type OutingId,
} from '../OutingDirector';
import { batteryCostForOuting, pickInnerVoice } from '../PlayerActs';
import { pickOutingWarmLine, pickOutingReservedLine } from '../characterTemplates';

/**
 * Player-initiated town navigation and outings as cross-domain commands.
 * Economy owns cash/location; Needs owns fatigue/battery; World owns
 * attendance/history; Social owns actor encounter effects.
 */
export class CityActivityCoordination {
  constructor(
    private readonly owners: Pick<
      CoreDomainOwners,
      'economy' | 'clock' | 'gameContext' | 'needs' | 'world' | 'social' | 'telemetry'
    >,
    private readonly advanceMinutes: (minutes: number, reason: string, options?: { skipPublish?: boolean }) => void,
    private readonly publishState: () => void,
  ) {}

  private static outingHomeNode(outingId: string): CityNodeId | null {
    if (outingId === 'diner_soup' || outingId === 'diner_platter' || outingId === 'diner_pie') return 'diner';
    if (outingId === 'canal_walk') return 'canal';
    if (outingId === 'laundromat') return 'laundry';
    return null;
  }

  public static requireLocation(have: CityNodeId, want: CityNodeId): string | null {
    if (have === want) return null;
    return `You're at ${CITY_NODES[have].name} — travel to ${CITY_NODES[want].name} first.`;
  }

  public travelTo(rawTo: unknown, rawMode: unknown, options?: { ignoreFatigue?: boolean }): ActionResult & { data?: { summary: string; encounter?: string; minutes: number; cost: number } } {
    try {
      if (!isCityNodeId(rawTo)) return { success: false, error: `Unknown destination.` };
      const to: CityNodeId = rawTo;
      const mode: TravelMode = rawMode === 'bus' ? 'bus' : 'walk';
      const from = this.owners.economy.getLocation();
      if (from === to) return { success: true, data: { summary: `Already at ${CITY_NODES[to].name}.`, minutes: 0, cost: 0 } };
      const day = this.owners.clock.getTime().day;
      const environment = this.owners.gameContext.environment.current();
      if (to === 'canal' && environment.weather.condition === 'storm') {
        return { success: false, error: 'Canal walkway closed in the storm. Come back after the front passes.' };
      }
      const quote = quoteTravel(from, to, mode, environment.weather.tags.includes('wet'));
      if (quote.busUsed && !this.owners.economy.canAfford(BUS_FARE)) {
        return { success: false, error: `Bus fare is $${BUS_FARE.toFixed(2)} — walk it instead?` };
      }
      const walkCost = quote.mode === 'walk' ? walkEnergyCost(quote.minutes) : 0;
      // P7 leniency: the auto-trip home never strands the player, whatever the legs feel like
      if (!options?.ignoreFatigue && this.owners.needs.getState().energy < 10 && walkCost > 0) {
        return { success: false, error: 'Too tired to walk there (need 10% energy). Take the bus or rest.' };
      }
      if (quote.busUsed) this.owners.economy.spendCash(BUS_FARE, `Bus to ${CITY_NODES[to].name}`);
      this.advanceMinutes(quote.minutes, `Travel: ${CITY_NODES[from].name} → ${CITY_NODES[to].name} (${quote.mode})`, { skipPublish: true });
      if (walkCost > 0) this.owners.needs.consumeEnergy(walkCost);
      this.owners.economy.setLocation(to);
      // Arrival counts for meetings (same flags the legacy views raise)
      if (to === 'cafe' || to === 'cart') {
        try { this.owners.world.setFlag(`visited_${to === 'cafe' ? 'cafe' : 'work'}_${day}`, true); } catch { /* attendance is best-effort */ }
      }
      // One street encounter per trip (deterministic, capped by design)
      let encounterText: string | undefined;
      try {
        const candidates = this.owners.social.getBuddies()
          .filter((b) => b.status !== 'distant' && b.status !== 'gone' && b.status !== 'blocked')
          .map((b) => ({ id: b.id, name: b.displayName }));
        const encounter = rollStreetEncounter(from, to, day, environment.weather.tags.includes('wet'), candidates);
        if (encounter && encounter.kind !== 'quiet') {
          if (encounter.cashDelta !== 0) this.owners.economy.earnCash(encounter.cashDelta, 'Street find');
          if (encounter.energyDelta !== 0) {
            if (encounter.energyDelta < 0) this.owners.needs.consumeEnergy(-encounter.energyDelta);
            else this.owners.needs.restoreEnergy(encounter.energyDelta);
          }
          if (encounter.familiarityBuddyId) {
            const rels = this.owners.social.getRelationships(encounter.familiarityBuddyId);
            if (rels) this.owners.social.adjustRelationship(encounter.familiarityBuddyId, { familiarity: Math.min(100, rels.familiarity + 3) });
          }
          encounterText = encounter.text;
          this.owners.telemetry.logEvent('room', 'street_encounter', this.owners.clock.getTotalMinutes(), { kind: encounter.kind, from, to });
        }
      } catch { /* encounters never break travel */ }
      const route = quote.path.map((n) => CITY_NODES[n].name).join(' → ');
      this.owners.telemetry.logEvent('room', 'travel', this.owners.clock.getTotalMinutes(), { from, to, mode: quote.mode, minutes: quote.minutes });
      this.publishState();
      return {
        success: true,
        data: {
          summary: `${route} (${quote.minutes}m${quote.busUsed ? `, bus $${BUS_FARE.toFixed(2)}` : ', on foot'}) — now at ${CITY_NODES[to].name}.`,
          encounter: encounterText,
          minutes: quote.minutes,
          cost: quote.cost,
        },
      };
    } catch {
      return { success: false, error: 'Travel failed.' };
    }
  }

  private static isBuddyAvailable<T extends { status?: string }>(buddy: T | undefined): buddy is T {
    return !!buddy && buddy.status !== 'distant' && buddy.status !== 'gone' && buddy.status !== 'blocked';
  }

  public doCityOuting(rawOutingId: string): ActionResult & { data?: { summary: string; encounterBuddyId?: string; rumor?: string } } {
    try {
      if (!isValidOutingId(rawOutingId)) return { success: false, error: `Unknown outing: ${rawOutingId}` };
      const outingId: OutingId = rawOutingId;
      const spec = OUTINGS[outingId];
      // P7 gating: outings happen where they happen
      const homeNode = CityActivityCoordination.outingHomeNode(outingId);
      if (homeNode) {
        const err = CityActivityCoordination.requireLocation(this.owners.economy.getLocation(), homeNode);
        if (err) return { success: false, error: err };
      }
      const day = this.owners.clock.getTime().day;
      const hour = this.owners.clock.getTime().hour;
      const minutes = this.owners.clock.getTotalMinutes();
      const needs = this.owners.needs.getState();
      if (needs.energy < MIN_OUTING_ENERGY) {
        return { success: false, error: `Too tired to head out (need ${MIN_OUTING_ENERGY}% energy). Rest first.` };
      }
      if (spec.cost > 0 && !this.owners.economy.canAfford(spec.cost)) {
        return { success: false, error: `Cannot afford ${spec.label} ($${spec.cost.toFixed(2)}).` };
      }
      // Social battery: going out costs presence (~1 per 6 minutes out).
      const outingBattery = batteryCostForOuting(spec.minutes);
      if (this.owners.needs.getSocialBattery() < outingBattery) {
        return { success: false, error: pickInnerVoice('outing', `${outingId}:${day}`) };
      }
      // P6 the city keeps time — closed places fail honestly (UI gates too)
      if (!isOutingOpen(outingId, hour)) {
        return { success: false, error: `${spec.label} is closed now (open ${outingHoursLabel(outingId)}).` };
      }
      const environment = this.owners.gameContext.environment.current();
      if (outingId === 'canal_walk' && environment.weather.condition === 'storm') {
        return { success: false, error: 'Canal storm outside — the walkway is closed. Come back after the front passes.' };
      }
      if (spec.cost > 0) this.owners.economy.spendCash(spec.cost, `City outing (${spec.label})`);
      this.owners.needs.spendSocialBattery(outingBattery);
      this.advanceMinutes(spec.minutes, `City outing: ${spec.label}`, { skipPublish: true });
      if (spec.energyDelta < 0) this.owners.needs.consumeEnergy(-spec.energyDelta);
      else this.owners.needs.restoreEnergy(spec.energyDelta);
      this.owners.needs.addHunger(spec.hungerDelta);
      this.owners.needs.addHealth(spec.healthDelta);

      // Encounters (deterministic per day; buddies must be present and available).
      // Whoever holds the role shows up — voice pool follows temperament, not identity.
      if (outingId === 'diner_soup' || outingId === 'diner_platter' || outingId === 'diner_pie') {
        const staffBuddy = this.owners.social.getBuddyWithRole('diner-staff');
        if (CityActivityCoordination.isBuddyAvailable(staffBuddy) && staffBuddy && dinerStaffEncounter(hour, day)) {
          const buddyId = staffBuddy.id;
          this.owners.social.applySocialAction(buddyId, 'remembered_detail');
          this.owners.social.addCoreMemory(buddyId, { text: `Ran into ${staffBuddy.displayName} working the diner, Day ${day}.`, kind: 'shared_moment', day });
          // Face to face: you learn their handle on the spot.
          this.owners.social.learnHandle(buddyId, staffBuddy.handle);
          // Showing up in person reads spontaneous.
          this.owners.social.observePlayerTrait(buddyId, { spontaneity: 70 }, day);
          const shy = this.owners.social.getTraits(buddyId).shyness >= 60;
          const line = shy ? pickOutingReservedLine(`${outingId}:${day}`) : pickOutingWarmLine(`${outingId}:${day}`);
          this.owners.social.sendMessage(buddyId, buddyId, 'player', line, this.owners.clock.getTotalMinutes(), false, ['outing', 'diner']);
          this.owners.telemetry.logEvent('social', 'outing_encounter', minutes, { buddyId, outing: outingId });
          this.publishState();
          return { success: true, data: { summary: `Hearty ${spec.label} at the diner — and ${staffBuddy.displayName} was on shift!`, encounterBuddyId: buddyId } };
        }
        this.owners.telemetry.logEvent('room', 'outing_diner', minutes, { outing: outingId });
        this.publishState();
        return { success: true, data: { summary: `Hearty ${spec.label} at the diner. Quiet tables, good coffee.` } };
      }
      if (outingId === 'canal_walk') {
        const walker = this.owners.social.getBuddyWithRole('canal-regular');
        const raining = environment.weather.tags.includes('wet');
        if (CityActivityCoordination.isBuddyAvailable(walker) && walker && canalRegularEncounter(hour, day, raining)) {
          const buddyId = walker.id;
          this.owners.social.applySocialAction(buddyId, 'intellectual_curiosity');
          this.owners.social.addCoreMemory(buddyId, { text: `Walked the canal with ${walker.displayName}, Day ${day}${raining ? ' in the rain' : ''}.`, kind: 'shared_moment', day });
          // Face to face: you learn their handle on the spot.
          this.owners.social.learnHandle(buddyId, walker.handle);
          // Showing up in person reads spontaneous.
          this.owners.social.observePlayerTrait(buddyId, { spontaneity: 70 }, day);
          const shy = this.owners.social.getTraits(buddyId).shyness >= 60;
          const line = shy ? pickOutingReservedLine(`${outingId}:${day}`) : pickOutingWarmLine(`${outingId}:${day}`);
          this.owners.social.sendMessage(buddyId, buddyId, 'player', line, this.owners.clock.getTotalMinutes(), false, ['outing', 'canal']);
          this.owners.telemetry.logEvent('social', 'outing_encounter', minutes, { buddyId, outing: outingId });
          this.publishState();
          return { success: true, data: { summary: `Canal walk${raining ? ' in the rain' : ''} — crossed paths with ${walker.displayName}.`, encounterBuddyId: buddyId } };
        }
        this.owners.telemetry.logEvent('room', 'outing_walk', minutes, { outing: outingId });
        this.publishState();
        return { success: true, data: { summary: `Canal walk${raining ? ' in the rain' : ''}. Cleared your head.` } };
      }
      // laundromat: rumor for the UI notice (no NPC message — dryers, not drama)
      const pairs = this.owners.social.getBuddies()
        .filter((b) => CityActivityCoordination.isBuddyAvailable(b))
        .flatMap((a, i, list) => list.slice(i + 1).map((b) => ({ aName: a.displayName, bName: b.displayName, affinity: this.owners.social.getAffinity(a.id, b.id) })));
      const titles = this.owners.world.getTriggeredEvents().map((e) => e.title);
      const rumor = buildLaundromatRumor(pairs, titles, `${day}`);
      this.owners.telemetry.logEvent('room', 'outing_laundromat', minutes, { rumor });
      this.publishState();
      return { success: true, data: { summary: 'Laundromat: warm dryers, folded clothes.', rumor } };
    } catch {
      return { success: false, error: 'Outing failed.' };
    }
  }

}

import type { Appointment } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import {
  parseMeetupProposal,
  isMeetupCancelText,
  decideRsvp,
  decideNpcShow,
  appointmentRoll,
  locationLabel,
  LOCATION_SLOTS,
  pickCoopDetail,
  SHIFT_WAGE,
} from '../AppointmentDirector';
import {
  pickRsvpLine,
  pickStoodUpLine,
  pickMeetingApologyLine,
  pickShiftWrapLine,
  pickGigWrapLine,
  pickArchiveWrapLine,
} from '../characterTemplates';
import { BATTERY_NEW_APPOINTMENT } from '../PlayerActs';

type AppointmentOwners = Pick<
  CoreDomainOwners,
  'clock' | 'world' | 'social' | 'telemetry' | 'needs' | 'economy' | 'gameContext'
>;

/**
 * Canonical appointment outcomes use existing world appointments, social bonds
 * and messages, life resources, finance, environment and telemetry.
 * This coordinator stores no appointments and does not tick independently.
 */
export class AppointmentCoordination {
  constructor(private readonly owners: AppointmentOwners) {}

  public processAppointmentsDaily(newDay: number): void {
    this.runRsvpPass(newDay);
    this.resolveDueAppointments(newDay);
  }

  private static isOpenAppointment(a: Appointment, fromDay: number): boolean {
    const st = a.status ?? 'scheduled';
    return (st === 'scheduled' || st === 'confirmed') && a.targetDay >= fromDay;
  }

  /**
   * Parse a player chat line for meetup proposals or cancellations.
   * Called from Pulse after the promise ledger. Never throws, never double-books.
   */
  public handleMeetupChat(rawBuddyId: string, text: string, day: number): Appointment | null {
    try {
      const buddy = this.owners.social.getBuddy(rawBuddyId);
      if (!buddy) return null;
      const buddyId = buddy.id;
      if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') return null;
      const safeDay = Math.max(1, Math.floor(day) || 1);
      const open = this.owners.world.getAppointments().filter((a) => a.characterId === buddyId && AppointmentCoordination.isOpenAppointment(a, safeDay));
      if (isMeetupCancelText(text)) {
        const target = open[open.length - 1];
        if (!target) return null;
        this.owners.world.updateAppointment(target.id, { status: 'cancelled' });
        this.owners.social.addCoreMemory(buddyId, {
          text: `Cancelled ${locationLabel(target.locationId)} plans, Day ${safeDay}.`,
          kind: 'fact',
          day: safeDay,
        });
        // Cancelling reads flaky and a little disloyal.
        this.owners.social.observePlayerTrait(buddyId, { discipline: 35, loyalty: 45 }, safeDay);
        this.owners.telemetry.logEvent('social', 'appointment_cancelled', this.owners.clock.getTotalMinutes(), { buddyId, appointmentId: target.id });
        return null;
      }
      const proposal = parseMeetupProposal(text);
      if (!proposal) return null;
      // Drained: no new plans (existing commitments are still honored).
      if (this.owners.needs.getSocialBattery() <= 0) return null;
      if (open.length > 0) return null; // one open plan per buddy
      const slot = LOCATION_SLOTS[proposal.locationId];
      const targetDay = safeDay + proposal.dayOffset;
      const appt = this.owners.world.scheduleAppointment({
        id: `appt_${buddyId}_${targetDay}_${slot.start}`.slice(0, 60),
        characterId: buddyId,
        locationId: proposal.locationId,
        targetDay,
        startMinute: slot.start,
        endMinute: slot.end,
        description: `Meet ${buddy.displayName} at ${locationLabel(proposal.locationId)}`,
        status: 'scheduled',
      });
      this.owners.telemetry.logEvent('social', 'appointment_scheduled', this.owners.clock.getTotalMinutes(), { buddyId, appointmentId: appt.id, location: proposal.locationId, targetDay });
      // Making plans costs presence too (the introvert pays to commit).
      this.owners.needs.spendSocialBattery(BATTERY_NEW_APPOINTMENT);
      // Near-term plans (tonight/tomorrow) get an immediate answer; farther plans
      // are answered by the daily pass. Either way the NPC replies exactly once.
      if (targetDay <= safeDay + 1) this.runRsvpPass(safeDay, [appt], targetDay <= safeDay ? 'tonight' : 'tomorrow');
      return appt;
    } catch { return null; }
  }

  /** NPC confirm/decline pass. Daily: answers farther-future plans not yet answered. Rules only. */
  private runRsvpPass(newDay: number, only?: Appointment[], dayRef?: string): void {
    try {
      const minutes = this.owners.clock.getTotalMinutes();
      const due = (only ?? this.owners.world.getAppointments()).filter((a) => {
        if (a.status !== undefined && a.status !== 'scheduled') return false;
        if (a.rsvp) return false;
        if (only) return true;
        return a.targetDay > newDay;
      });
      for (const appt of due) {
        const buddy = this.owners.social.getBuddy(appt.characterId);
        if (!buddy || buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const stage = this.owners.social.getRelationshipStage(buddy.id);
        const mood = this.owners.social.getDailyMood(buddy.id, newDay);
        const rsvp = decideRsvp({ stage, mood, roll: appointmentRoll(`${appt.id}:rsvp`) });
        const label = locationLabel(appt.locationId);
        const ref = dayRef ?? (appt.targetDay === newDay + 1 ? 'tomorrow' : `on day ${appt.targetDay}`);
        if (rsvp === 'no') {
          this.owners.world.updateAppointment(appt.id, { rsvp: 'no', status: 'cancelled' });
          this.owners.social.sendMessage(buddy.id, buddy.id, 'player', pickRsvpLine('no', appt.id, label, ref), minutes, false, ['appointment', 'rsvp']);
          this.owners.telemetry.logEvent('social', 'appointment_declined', minutes, { buddyId: buddy.id, appointmentId: appt.id });
        } else {
          this.owners.world.updateAppointment(appt.id, { rsvp, status: 'confirmed' });
          this.owners.social.sendMessage(buddy.id, buddy.id, 'player', pickRsvpLine(rsvp, appt.id, label, ref), minutes, false, ['appointment', 'rsvp']);
          this.owners.telemetry.logEvent('social', 'appointment_confirmed', minutes, { buddyId: buddy.id, appointmentId: appt.id, rsvp });
        }
      }
    } catch { /* RSVP never breaks the tick */ }
  }

  /** Resolve past-due meetings: happened / stood-up / flaked / mutual miss. Rules only. */
  private resolveDueAppointments(newDay: number): void {
    try {
      const minutes = this.owners.clock.getTotalMinutes();
      const due = this.owners.world.getAppointments().filter((a) => {
        const st = a.status ?? 'scheduled';
        return (st === 'scheduled' || st === 'confirmed') && a.targetDay < newDay;
      });
      for (const appt of due) {
        const buddy = this.owners.social.getBuddy(appt.characterId);
        if (!buddy) { this.owners.world.updateAppointment(appt.id, { status: 'cancelled' }); continue; }
        const label = locationLabel(appt.locationId);
        const name = buddy.displayName;
        const playerShowed = this.didPlayerAttend(appt, buddy.id);
        const stage = this.owners.social.getRelationshipStage(buddy.id);
        const mood = this.owners.social.getDailyMood(buddy.id, appt.targetDay);
        const npcShowed = buddy.status !== 'distant' && buddy.status !== 'gone' && buddy.status !== 'blocked'
          && decideNpcShow({ rsvp: appt.rsvp, stage, mood, roll: appointmentRoll(`${appt.id}:show`) });
        if (npcShowed && playerShowed) {
          this.owners.world.updateAppointment(appt.id, { status: 'happened', isCompleted: true, npcShowed: true, playerShowed: true });
          // P5.2 co-op enrichment: joint work pays more (dims x2 + wage/flavor), cafe stays intimate
          // P6 gig shifts ride the same path (marked by gig_ id prefix, any contact)
          const isShift = appt.locationId === 'work' && (buddy.archetype === 'coworker' || appt.id.startsWith('gig_'));
          const isArchive = appt.locationId === 'archive';
          if (isShift || isArchive) {
            const detail = pickCoopDetail(appt.id, isShift ? 'shift' : 'archive');
            const action = isShift ? 'work_camaraderie' : 'intellectual_curiosity';
            this.owners.social.applySocialAction(buddy.id, action);
            this.owners.social.applySocialAction(buddy.id, action);
            // P6.2 heat waves pay +$6 (thirsty town, busy cart); P6 gig shifts pay their wage
            if (isShift) {
              const shiftEnvironment = this.owners.gameContext.environment.at({
                atMinute: (Math.max(1, appt.targetDay) - 1) * 1440 + 720,
              });
              const weatherBonus = shiftEnvironment.weather.tags.includes('hot') ? 6 : 0;
              this.owners.economy.earnCash(
                (appt.wageOverride ?? SHIFT_WAGE) + weatherBonus,
                `Side shift with ${name}`,
              );
            }
            this.owners.social.addCoreMemory(buddy.id, {
              text: isShift
                ? `Worked a side shift with ${name}, Day ${appt.targetDay}: ${detail}.`
                : `Indexed the archive with ${name}, Day ${appt.targetDay}: ${detail}.`,
              kind: 'shared_moment',
              day: appt.targetDay,
            });
            const wrap = appt.id.startsWith('gig_')
              ? pickGigWrapLine(appt.id, detail)
              : isShift ? pickShiftWrapLine(appt.id, detail) : pickArchiveWrapLine(appt.id, detail);
            this.owners.social.sendMessage(buddy.id, buddy.id, 'player', wrap, minutes, false, ['appointment', isShift ? 'shift' : 'archive']);
            this.owners.telemetry.logEvent('social', 'appointment_happened', minutes, { buddyId: buddy.id, appointmentId: appt.id, coop: isShift ? 'shift' : 'archive' });
          } else {
            this.owners.social.applySocialAction(buddy.id, appt.locationId === 'cafe' ? 'vulnerable_share' : 'work_camaraderie');
            this.owners.social.addCoreMemory(buddy.id, { text: `Met ${name} at ${label}, Day ${appt.targetDay}.`, kind: 'shared_moment', day: appt.targetDay });
            this.owners.telemetry.logEvent('social', 'appointment_happened', minutes, { buddyId: buddy.id, appointmentId: appt.id });
          }
        } else if (npcShowed && !playerShowed) {
          // P6.2 severe weather (fog/storm) is a legitimate excuse: missed, but no hard feelings
          const excused = this.owners.gameContext.environment.at({
            atMinute: (Math.max(1, appt.targetDay) - 1) * 1440 + 720,
          }).weather.tags.includes('severe');
          if (excused) {
            this.owners.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: true, playerShowed: false });
            this.owners.social.addCoreMemory(buddy.id, { text: `Severe weather kept you from ${label}, Day ${appt.targetDay}. No hard feelings.`, kind: 'fact', day: appt.targetDay });
            this.owners.telemetry.logEvent('social', 'appointment_excused', minutes, { buddyId: buddy.id, appointmentId: appt.id });
          } else {
            this.owners.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: true, playerShowed: false });
            this.owners.social.applySocialAction(buddy.id, 'dismissive');
            this.owners.social.addCoreMemory(buddy.id, { text: `Stood up ${name} at ${label}, Day ${appt.targetDay}.`, kind: 'fact', day: appt.targetDay });
            this.owners.social.sendMessage(buddy.id, buddy.id, 'player', pickStoodUpLine(appt.id, label), minutes, false, ['appointment', 'missed']);
            this.owners.telemetry.logEvent('social', 'appointment_missed', minutes, { buddyId: buddy.id, appointmentId: appt.id });
          }
        } else if (!npcShowed && playerShowed) {
          this.owners.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: false, playerShowed: true });
          this.owners.social.applySocialAction(buddy.id, 'dismissive');
          this.owners.social.addCoreMemory(buddy.id, { text: `${name} flaked on ${label}, Day ${appt.targetDay}.`, kind: 'fact', day: appt.targetDay });
          this.owners.social.sendMessage(buddy.id, buddy.id, 'player', pickMeetingApologyLine(appt.id, label), minutes, false, ['appointment', 'apology']);
          this.owners.telemetry.logEvent('social', 'appointment_flaked', minutes, { buddyId: buddy.id, appointmentId: appt.id });
        } else {
          this.owners.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: false, playerShowed: false });
          this.owners.telemetry.logEvent('social', 'appointment_missed', minutes, { buddyId: buddy.id, appointmentId: appt.id, bothAbsent: true });
        }
      }
    } catch { /* resolution never breaks the tick */ }
  }

  /** Player attendance: cafe/work = visited the view that day; lobby = DM'd; archive = real joint effort (2+ DMs). */
  private didPlayerAttend(appt: Appointment, buddyId: string): boolean {
    if (appt.locationId === 'cafe' || appt.locationId === 'work') {
      return this.owners.world.getFlag(`visited_${appt.locationId}_${appt.targetDay}`) === true;
    }
    try {
      const playerMsgs = this.owners.social.getMessages(buddyId).filter((m) => m.senderId === 'player' && m.day === appt.targetDay);
      return appt.locationId === 'archive' ? playerMsgs.length >= 2 : playerMsgs.length >= 1;
    } catch { return false; }
  }

}

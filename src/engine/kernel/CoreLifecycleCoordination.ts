import type { CoreDomainOwners } from './CoreDomainOwners';
import type { RelationshipContinuity } from './RelationshipContinuity';
import type { AppointmentCoordination } from './AppointmentCoordination';
import type { MyPlaceSocialCycle } from './MyPlaceSocialCycle';
import type { RentCoordination } from './RentCoordination';
import type { NpcSocialLifeCycle } from './NpcSocialLifeCycle';
import type { SocialPresenceCycle } from './SocialPresenceCycle';
import { getAllPulseReleases } from '../PulseCatalog';

export interface CoreLifecycleSubsystems {
  relationshipContinuity: RelationshipContinuity;
  appointmentCoordination: AppointmentCoordination;
  myplaceSocial: MyPlaceSocialCycle;
  rentCoordination: RentCoordination;
  npcSocialLife: NpcSocialLifeCycle;
  socialPresence: SocialPresenceCycle;
}

/**
 * Authoritative Core bootstrap and lifecycle event coordinator.
 * Wires cross-domain event subscriptions, daily transitions, and roster
 * synchronization exactly once without duplicate event listeners.
 */
export class CoreLifecycleCoordination {
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly owners: CoreDomainOwners,
    private readonly subsystems: CoreLifecycleSubsystems,
    private readonly notifySubscribers: () => void,
    private readonly bumpVersion: () => void,
  ) {}

  public register(): void {
    if (this.unsubscribers.length > 0) {
      return; // Already registered
    }

    const { events, clock, economy, needs, telemetry, world, social, pulse, hardware } = this.owners;
    const {
      relationshipContinuity,
      appointmentCoordination,
      myplaceSocial,
      rentCoordination,
      npcSocialLife,
      socialPresence,
    } = this.subsystems;

    // Unified roster: world attitudes + MyPlace pages follow SocialEngine registrations
    world.setBuddyProvider(() =>
      social.getBuddies().map((b) => ({ id: b.id, archetype: b.archetype })),
    );

    // Initial stubs for existing buddies
    for (const buddy of social.getBuddies()) {
      myplaceSocial.ensureMyPlaceStub(buddy);
    }

    this.unsubscribers.push(
      events.on('mood:changed', () => {
        this.bumpVersion();
      }),
    );

    this.unsubscribers.push(
      events.on('time:day_changed', ({ newDay }) => {
        economy.handleDayTransition(newDay);
        const needsDay = needs.handleDayTransition();
        if (needsDay.emergencyFoodNeeded) {
          if (economy.spendCash(4, `Late-night chips (too hungry to sleep, Day ${newDay})`)) {
            needs.applyEmergencyFoodRelief();
          } else {
            needs.applyEmergencyFoodFailure();
          }
        }
        // Daily relationship pass: overdue promises + distant returns
        relationshipContinuity.processRelationshipDaily(newDay);
        // Daily meeting pass: RSVP for tomorrow + resolve past
        appointmentCoordination.processAppointmentsDaily(newDay);
        // Daily MyPlace life: Top 8 re-rank + guestbook notes and replies
        myplaceSocial.processDay(newDay);
        // Daily rent ladder: reminders, warnings, overdue nudges
        rentCoordination.processRentDaily(newDay);
        // Character Lives daily pass: agenda planning, NPC run-ins, romance, mediation asks
        npcSocialLife.processDay(newDay);
        // Social battery: quiet yesterday repays solitude
        socialPresence.processPlayerBatteryDaily(newDay);
      }),
    );

    this.unsubscribers.push(
      events.on('economy:cash_changed', ({ newCash }) => {
        telemetry.updateCashBounds(newCash);
      }),
    );

    this.unsubscribers.push(
      events.on('social:buddy_registered', ({ buddy }: any) => {
        try {
          world.ensureAttitudesForBuddy(buddy.id, clock.getTotalMinutes());
        } catch {
          // Attitudes are best-effort
        }
        myplaceSocial.ensureMyPlaceStub(buddy);
      }),
    );

    // Keep PulseEngine in sync when Pulse is installed via SoftwareRegistry
    this.unsubscribers.push(
      events.on('software:installed' as any, ({ software }: any) => {
        if (
          software?.appId === 'app.pulse' ||
          software?.appId === 'app.pulse_messenger' ||
          String(software?.appId).includes('pulse')
        ) {
          const version = String(software.version || '');
          try {
            const all = getAllPulseReleases() as Array<{ id: string; version: string }>;
            const match =
              all.find((r) => r.version === version) ||
              all.find((r) => r.id.includes(version.replace('.', '_')));
            if (match) {
              (pulse as any).currentPulseId = match.id;
            }
          } catch {}
        }
      }),
    );

    // Hardware and power change notifications
    this.unsubscribers.push(
      events.on('hardware:upgraded' as any, () => {
        this.notifySubscribers();
      }),
    );
    this.unsubscribers.push(
      events.on('hardware:power_changed' as any, () => {
        this.notifySubscribers();
      }),
    );
    this.unsubscribers.push(
      events.on('hardware:disc_inserted' as any, () => {
        this.notifySubscribers();
      }),
    );
    this.unsubscribers.push(
      events.on('hardware:disc_ejected' as any, () => {
        this.notifySubscribers();
      }),
    );
    this.unsubscribers.push(
      events.on('hardware:os_migrated' as any, () => {
        (hardware as any).state.osVersion = this.owners.os.getCurrentOsId();
        this.notifySubscribers();
      }),
    );
  }

  public dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}

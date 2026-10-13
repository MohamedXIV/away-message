import type {
  ActionResult,
  SimulationAction,
  SimulationState,
  Appointment,
} from '../types';
import type { Fulfillment, PlaceDeliveryOptions } from '../DeliveryEngine';
import { createCoreDomainOwners, type CoreDomainOwners } from './CoreDomainOwners';
import { TimeAdvancement } from './TimeAdvancement';
import { CoreStatePublication } from './CoreStatePublication';
import { CorePersistenceCoordinator } from './CorePersistenceCoordinator';
import { CoreLifecycleCoordination } from './CoreLifecycleCoordination';
import { CoreCommandRouting } from './CoreCommandRouting';
import { JobBoardCoordination } from './JobBoardCoordination';
import { GroceryDeliveryCoordination } from './GroceryDeliveryCoordination';
import { MyPlaceSocialCycle } from './MyPlaceSocialCycle';
import { RentCoordination } from './RentCoordination';
import { AppointmentCoordination } from './AppointmentCoordination';
import { SocialPresenceCycle } from './SocialPresenceCycle';
import { RelationshipContinuity } from './RelationshipContinuity';
import { NpcSocialLifeCycle } from './NpcSocialLifeCycle';
import { ProceduralWorldCycle } from './ProceduralWorldCycle';
import { PlayerContactCoordination } from './PlayerContactCoordination';
import { CityActivityCoordination } from './CityActivityCoordination';
import { DesktopStorageCommands } from './DesktopStorageCommands';
import { SocialInteractionCommands } from './SocialInteractionCommands';
import { WorldNarrativeCommands } from './WorldNarrativeCommands';
import { PlayerEconomyCommands } from './PlayerEconomyCommands';
import { PlayerRoutineCommands } from './PlayerRoutineCommands';
import { PlayerHardwareCommands } from './PlayerHardwareCommands';
import { SimulationControlCommands } from './SimulationControlCommands';
import type { FullSimulationSnapshot } from '../../persistence/schema';

export interface CoreRuntimeHooks {
  advanceGameMinutes?: (minutes: number, reason?: string) => void;
  advanceRealTime?: (deltaRealSeconds: number) => void;
  placeGroceryOrder?: (
    items: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
    deliveryOptions?: PlaceDeliveryOptions,
  ) => ActionResult;
}

/**
 * Authoritative Core Runtime composition root.
 *
 * Wires canonical domain authorities, command routing, lifecycle event subscriptions,
 * state projection/caching, time advancement, and persistence coordination into
 * a single-writer composition.
 */
export class CoreRuntime {
  public readonly owners: CoreDomainOwners;
  public readonly publication: CoreStatePublication;
  public readonly persistence: CorePersistenceCoordinator;
  public readonly lifecycle: CoreLifecycleCoordination;
  public readonly timeAdvancement: TimeAdvancement;
  public readonly commandRouting: CoreCommandRouting;

  public readonly jobBoard: JobBoardCoordination;
  public readonly groceryDelivery: GroceryDeliveryCoordination;
  public readonly myplaceSocial: MyPlaceSocialCycle;
  public readonly rentCoordination: RentCoordination;
  public readonly appointmentCoordination: AppointmentCoordination;
  public readonly socialPresence: SocialPresenceCycle;
  public readonly relationshipContinuity: RelationshipContinuity;
  public readonly npcSocialLife: NpcSocialLifeCycle;
  public readonly proceduralWorld: ProceduralWorldCycle;
  public readonly playerContacts: PlayerContactCoordination;
  public readonly cityActivity: CityActivityCoordination;
  public readonly desktopCommands: DesktopStorageCommands;
  public readonly socialCommands: SocialInteractionCommands;
  public readonly worldCommands: WorldNarrativeCommands;
  public readonly economyCommands: PlayerEconomyCommands;
  public readonly routineCommands: PlayerRoutineCommands;
  public readonly hardwareCommands: PlayerHardwareCommands;
  public readonly controlCommands: SimulationControlCommands;

  private activeView: SimulationState['activeView'] = 'room';

  constructor(initialState?: Partial<SimulationState>, hooks?: CoreRuntimeHooks) {
    const owners = createCoreDomainOwners(initialState);
    this.owners = owners;
    this.publication = new CoreStatePublication();
    this.persistence = new CorePersistenceCoordinator();

    this.activeView =
      initialState?.activeView ??
      (owners.hardware.getState().hasComputer ? 'pc' : 'room');

    const advanceMinutesFn = (minutes: number, reason?: string) => {
      if (hooks?.advanceGameMinutes) {
        hooks.advanceGameMinutes(minutes, reason);
      } else {
        this.advanceGameMinutes(minutes, reason);
      }
    };

    const placeGroceryOrderFn = (
      items: Array<{ sku: string; qty: number }>,
      fulfillment: Fulfillment,
      nowMinute: number,
    ) => {
      if (hooks?.placeGroceryOrder) {
        return hooks.placeGroceryOrder(items, fulfillment, nowMinute);
      }
      return this.placeGroceryOrder(items, fulfillment, nowMinute);
    };

    this.jobBoard = new JobBoardCoordination(owners, () => this.notifySubscribers());
    this.myplaceSocial = new MyPlaceSocialCycle(owners);
    this.rentCoordination = new RentCoordination(owners, () => this.notifySubscribers());
    this.appointmentCoordination = new AppointmentCoordination(owners);
    this.socialPresence = new SocialPresenceCycle(owners);
    this.relationshipContinuity = new RelationshipContinuity(owners);
    this.npcSocialLife = new NpcSocialLifeCycle(owners);

    this.proceduralWorld = new ProceduralWorldCycle(
      owners,
      (buddy, introText) =>
        this.dispatchAction({
          type: 'SOCIAL_ADD_BUDDY',
          buddy,
          introText,
        }).success,
      () => this.notifySubscribers(),
    );

    this.groceryDelivery = new GroceryDeliveryCoordination(
      owners,
      (minutes, reason) => advanceMinutesFn(minutes, reason),
      () => this.notifySubscribers(),
    );

    this.timeAdvancement = new TimeAdvancement(owners, {
      currentView: () => this.activeView,
      processDeliveries: () => this.groceryDelivery.processDeliveries(),
      processJobReplies: () => this.jobBoard.processJobReplies(),
      sweepBusyLeaveLines: (atMinute) => this.socialPresence.sweepBusyLeaveLines(atMinute),
      scheduleDailyProfileUpdate: (mode, day, atMinute) =>
        this.myplaceSocial.scheduleDailyProfileUpdate(mode, day, atMinute),
      processNewDay: (day) => this.proceduralWorld.processNewDay(day),
      publishState: () => this.notifySubscribers(),
    });

    this.playerContacts = new PlayerContactCoordination(
      owners,
      (action) => this.dispatchAction(action),
      () => this.notifySubscribers(),
    );

    this.cityActivity = new CityActivityCoordination(
      owners,
      (minutes, reason) => advanceMinutesFn(minutes, reason),
      () => this.notifySubscribers(),
    );

    this.desktopCommands = new DesktopStorageCommands(owners, () => this.notifySubscribers());
    this.socialCommands = new SocialInteractionCommands(
      owners,
      this.playerContacts,
      this.relationshipContinuity,
      () => this.notifySubscribers(),
    );
    this.worldCommands = new WorldNarrativeCommands(owners, () => this.notifySubscribers());

    this.economyCommands = new PlayerEconomyCommands(
      owners,
      this.rentCoordination,
      this.jobBoard,
      placeGroceryOrderFn,
      (minutes, reason) => advanceMinutesFn(minutes, reason),
      () => this.notifySubscribers(),
    );

    this.routineCommands = new PlayerRoutineCommands(
      owners,
      (minutes, reason) => advanceMinutesFn(minutes, reason),
      () => this.groceryDelivery.processDeliveries(),
      () => this.jobBoard.processJobReplies(),
      () => this.notifySubscribers(),
    );

    this.hardwareCommands = new PlayerHardwareCommands(
      owners,
      (minutes, reason) => advanceMinutesFn(minutes, reason),
      () => this.notifySubscribers(),
    );

    this.controlCommands = new SimulationControlCommands(
      owners,
      this.cityActivity,
      (minutes, reason) => advanceMinutesFn(minutes, reason),
      (view) => {
        this.activeView = view;
      },
      () => this.notifySubscribers(),
    );

    this.commandRouting = new CoreCommandRouting({
      control: this.controlCommands,
      economy: this.economyCommands,
      routine: this.routineCommands,
      hardware: this.hardwareCommands,
      desktop: this.desktopCommands,
      social: this.socialCommands,
      world: this.worldCommands,
    });

    this.lifecycle = new CoreLifecycleCoordination(
      owners,
      {
        relationshipContinuity: this.relationshipContinuity,
        appointmentCoordination: this.appointmentCoordination,
        myplaceSocial: this.myplaceSocial,
        rentCoordination: this.rentCoordination,
        npcSocialLife: this.npcSocialLife,
        socialPresence: this.socialPresence,
      },
      () => this.notifySubscribers(),
      () => this.publication.bumpVersion(),
    );

    this.lifecycle.register();
  }

  public getActiveView(): SimulationState['activeView'] {
    return this.activeView;
  }

  public setActiveView(view: SimulationState['activeView']): void {
    this.activeView = view;
  }

  public getState(): Readonly<SimulationState> {
    return this.publication.getState(this.owners, this.activeView);
  }

  public subscribe(listener: (state: Readonly<SimulationState>) => void): () => void {
    return this.publication.subscribe(listener, () => this.getState());
  }

  public notifySubscribers(): void {
    this.publication.notifySubscribers(() => this.getState());
  }

  public advanceRealTime(deltaRealSeconds: number): void {
    this.timeAdvancement.advanceRealTime(deltaRealSeconds);
  }

  public advanceGameMinutes(minutes: number, reason?: string): void {
    this.timeAdvancement.advanceGameMinutes(minutes, reason);
  }

  public placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
    deliveryOptions?: PlaceDeliveryOptions,
  ): ActionResult & { data?: { orderId: string; etaMinute: number; summary: string } } {
    return this.groceryDelivery.placeGroceryOrder(
      rawItems,
      fulfillment,
      nowMinute,
      deliveryOptions,
    );
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    const currentMinutes = this.owners.clock.getTotalMinutes();
    return this.commandRouting.dispatch(action, currentMinutes);
  }

  public exportSnapshot(): SimulationState {
    this.publication.invalidateCache();
    return this.persistence.exportSnapshot(this.owners, this.activeView);
  }

  public exportFullSnapshot(
    saveSlotId = 'slot_1',
    saveName?: string,
  ): FullSimulationSnapshot {
    return this.persistence.exportFullSnapshot(
      this.owners,
      this.activeView,
      saveSlotId,
      saveName,
    );
  }

  public loadSnapshot(snapshot: SimulationState): void {
    this.activeView = this.persistence.loadSnapshot(this.owners, snapshot);
    this.notifySubscribers();
  }

  public handleMeetupChat(rawBuddyId: string, text: string, day: number): Appointment | null {
    return this.appointmentCoordination.handleMeetupChat(rawBuddyId, text, day);
  }
}

import {
  SimulationState,
  SimulationAction,
  ActionResult,
  Appointment,
} from './types';
import { GameClock } from './GameClock';
import { EventBus } from './EventBus';
import { EconomyEngine } from './EconomyEngine';
import { PlayerNeedsEngine } from './PlayerNeedsEngine';
import { HardwareEngine } from './HardwareEngine';
import { FileSystemEngine } from './FileSystemEngine';
import { DownloadManager } from './DownloadManager';
import {
  DeliveryEngine,
  type Fulfillment,
  type PlaceDeliveryOptions,
} from './DeliveryEngine';
import { SoftwareRegistry } from './SoftwareRegistry';
import { SocialEngine } from './SocialEngine';
import { TelemetryEngine } from './TelemetryEngine';
import { WorldEventsEngine } from './WorldEventsEngine';
import { EnvironmentEngine } from './EnvironmentEngine';
import { MoodEngine } from './MoodEngine';
import type { GameContextReadApi } from './GameContext';
import { OsEngine } from './OsEngine';
import { PulseEngine } from './PulseEngine';
import { MyPlaceEngine } from './MyPlaceEngine';
import { pulseHasFeature } from './PulseCatalog';
import type { CoreDomainOwners } from './kernel/CoreDomainOwners';
import type { TimeAdvancement } from './kernel/TimeAdvancement';
import type { JobBoardCoordination } from './kernel/JobBoardCoordination';
import type { GroceryDeliveryCoordination } from './kernel/GroceryDeliveryCoordination';
import type { MyPlaceSocialCycle } from './kernel/MyPlaceSocialCycle';
import type { RentCoordination } from './kernel/RentCoordination';
import type { AppointmentCoordination } from './kernel/AppointmentCoordination';
import type { SocialPresenceCycle } from './kernel/SocialPresenceCycle';
import type { RelationshipContinuity } from './kernel/RelationshipContinuity';
import type { NpcSocialLifeCycle } from './kernel/NpcSocialLifeCycle';
import type { ProceduralWorldCycle } from './kernel/ProceduralWorldCycle';
import type { PlayerContactCoordination } from './kernel/PlayerContactCoordination';
import type { CityActivityCoordination } from './kernel/CityActivityCoordination';
import type { DesktopStorageCommands } from './kernel/DesktopStorageCommands';
import type { SocialInteractionCommands } from './kernel/SocialInteractionCommands';
import type { WorldNarrativeCommands } from './kernel/WorldNarrativeCommands';
import type { PlayerEconomyCommands } from './kernel/PlayerEconomyCommands';
import type { PlayerRoutineCommands } from './kernel/PlayerRoutineCommands';
import type { PlayerHardwareCommands } from './kernel/PlayerHardwareCommands';
import type { SimulationControlCommands } from './kernel/SimulationControlCommands';
import type { CoreCommandRouting } from './kernel/CoreCommandRouting';
import { CoreRuntime } from './kernel/CoreRuntime';

export class SimulationEngine {
  public readonly runtime: CoreRuntime;
  public readonly clock!: GameClock;
  public readonly events!: EventBus;
  public readonly economy!: EconomyEngine;
  public readonly needs!: PlayerNeedsEngine;
  public readonly hardware!: HardwareEngine;
  public readonly os!: OsEngine;
  public readonly pulse!: PulseEngine;
  public readonly myplace!: MyPlaceEngine;
  public readonly vfs!: FileSystemEngine;
  public readonly downloads!: DownloadManager;
  public readonly delivery!: DeliveryEngine;
  public readonly software!: SoftwareRegistry;
  public readonly social!: SocialEngine;
  public readonly telemetry!: TelemetryEngine;
  public readonly world!: WorldEventsEngine;
  public readonly environment!: EnvironmentEngine;
  public readonly mood!: MoodEngine;
  public readonly gameContext!: GameContextReadApi;

  constructor(initialState?: Partial<SimulationState>) {
    this.runtime = new CoreRuntime(initialState, {
      advanceGameMinutes: (minutes, reason, options) =>
        this.advanceGameMinutes(minutes, reason, options),
      advanceRealTime: (delta) => this.advanceRealTime(delta),
      placeGroceryOrder: (items, fulfillment, minute, options) =>
        this.placeGroceryOrder(items, fulfillment, minute, options),
    });
    const owners = this.runtime.owners;

    this.events = owners.events;
    this.clock = owners.clock;
    this.needs = owners.needs;
    this.economy = owners.economy;
    this.hardware = owners.hardware;
    this.vfs = owners.vfs;
    this.world = owners.world;
    this.environment = owners.environment;
    this.mood = owners.mood;
    this.gameContext = owners.gameContext;
    this.os = owners.os;
    this.pulse = owners.pulse;
    this.myplace = owners.myplace;
    this.downloads = owners.downloads;
    this.delivery = owners.delivery;
    this.software = owners.software;
    this.social = owners.social;
    this.telemetry = owners.telemetry;
  }

  public get coreOwners(): CoreDomainOwners {
    return this.runtime.owners;
  }

  public get jobBoard(): JobBoardCoordination {
    return this.runtime.jobBoard;
  }

  public get groceryDelivery(): GroceryDeliveryCoordination {
    return this.runtime.groceryDelivery;
  }

  public get myplaceSocial(): MyPlaceSocialCycle {
    return this.runtime.myplaceSocial;
  }

  public get rentCoordination(): RentCoordination {
    return this.runtime.rentCoordination;
  }

  public get appointmentCoordination(): AppointmentCoordination {
    return this.runtime.appointmentCoordination;
  }

  public get socialPresence(): SocialPresenceCycle {
    return this.runtime.socialPresence;
  }

  public get relationshipContinuity(): RelationshipContinuity {
    return this.runtime.relationshipContinuity;
  }

  public get npcSocialLife(): NpcSocialLifeCycle {
    return this.runtime.npcSocialLife;
  }

  public get proceduralWorld(): ProceduralWorldCycle {
    return this.runtime.proceduralWorld;
  }

  public get playerContacts(): PlayerContactCoordination {
    return this.runtime.playerContacts;
  }

  public get cityActivity(): CityActivityCoordination {
    return this.runtime.cityActivity;
  }

  public get desktopCommands(): DesktopStorageCommands {
    return this.runtime.desktopCommands;
  }

  public get socialCommands(): SocialInteractionCommands {
    return this.runtime.socialCommands;
  }

  public get worldCommands(): WorldNarrativeCommands {
    return this.runtime.worldCommands;
  }

  public get economyCommands(): PlayerEconomyCommands {
    return this.runtime.economyCommands;
  }

  public get routineCommands(): PlayerRoutineCommands {
    return this.runtime.routineCommands;
  }

  public get hardwareCommands(): PlayerHardwareCommands {
    return this.runtime.hardwareCommands;
  }

  public get controlCommands(): SimulationControlCommands {
    return this.runtime.controlCommands;
  }

  public get commandRouting(): CoreCommandRouting {
    return this.runtime.commandRouting;
  }

  public get timeAdvancement(): TimeAdvancement {
    return this.runtime.timeAdvancement;
  }

  public get activeView(): 'pc' | 'room' | 'cafe' | 'work' | 'city' {
    return this.runtime.getActiveView();
  }

  public set activeView(view: 'pc' | 'room' | 'cafe' | 'work' | 'city') {
    this.runtime.setActiveView(view);
  }

  public getState(): Readonly<SimulationState> {
    return this.runtime.getState();
  }

  public advanceRealTime(deltaRealSeconds: number): void {
    this.runtime.advanceRealTime(deltaRealSeconds);
  }

  public advanceGameMinutes(
    minutes: number,
    reason?: string,
    options?: { skipPublish?: boolean },
  ): void {
    this.runtime.advanceGameMinutes(minutes, reason, options);
  }

  public isPulse6(): boolean {
    try {
      return pulseHasFeature(this.pulse.getCurrentPulseId(), 'buddy-colors');
    } catch {
      return false;
    }
  }

  public getReceptionHint(rawBuddyId: string, day: number): string {
    return this.playerContacts.getReceptionHint(rawBuddyId, day);
  }

  public handleMeetupChat(
    rawBuddyId: string,
    text: string,
    day: number,
  ): Appointment | null {
    return this.appointmentCoordination.handleMeetupChat(rawBuddyId, text, day);
  }

  public travelTo(
    rawTo: unknown,
    rawMode: unknown,
    options?: { ignoreFatigue?: boolean },
  ): ActionResult & { data?: { summary: string; encounter?: string; minutes: number; cost: number } } {
    return this.cityActivity.travelTo(rawTo, rawMode, options);
  }

  public getJobBoard(): Array<{
    gig: import('./JobDirector').Gig;
    pending: boolean;
    appliedMinute: number;
  }> {
    return this.jobBoard.getJobBoard();
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

  public doCityOuting(
    rawOutingId: string,
  ): ActionResult & { data?: { summary: string; encounterBuddyId?: string; rumor?: string } } {
    return this.cityActivity.doCityOuting(rawOutingId);
  }

  public async generateProceduralEventsNow(options?: {
    maxEvents?: number;
    useAI?: boolean;
  }): Promise<import('./types').GlobalEvent[]> {
    const currentDay = this.clock.getTime().day;
    const totalMinutes = this.clock.getTotalMinutes();
    const { ProceduralDirector } = await import('./ProceduralDirector');
    const dir = new ProceduralDirector(this.world);
    const res = await dir.generateNextBatch(currentDay, totalMinutes, {
      maxEvents: options?.maxEvents ?? 2,
      useAI: options?.useAI ?? true,
    });
    this.notifySubscribers();
    return res.events;
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    return this.runtime.dispatchAction(action);
  }

  public subscribe(listener: (state: Readonly<SimulationState>) => void): () => void {
    return this.runtime.subscribe(listener);
  }

  public notifySubscribers(): void {
    this.runtime.notifySubscribers();
  }

  public exportSnapshot(): SimulationState {
    return this.runtime.exportSnapshot();
  }

  public exportFullSnapshot(
    saveSlotId = 'slot_1',
    saveName?: string,
  ): import('../persistence/schema').FullSimulationSnapshot {
    return this.runtime.exportFullSnapshot(saveSlotId, saveName);
  }

  public loadSnapshot(snapshot: SimulationState): void {
    this.runtime.loadSnapshot(snapshot);
  }
}

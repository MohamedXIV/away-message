// ==========================================
// TIME & CLOCK DOMAIN
// ==========================================

import type { InnerVoicePersistedState } from '../innerVoice/types';

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night' | 'late_night';

export interface GameTime {
  day: number;           // 1..14 (and 15+ in free play)
  hour: number;          // 0..23
  minute: number;        // 0..59
  totalMinutes: number;  // Monotonic elapsed simulation minutes from Day 1, 08:00 (base = 480)
  timeOfDay: TimeOfDay;
  isWeekend: boolean;    // Day 6, 7, 13, 14
}

export interface TimeJumpResult {
  elapsedMinutes: number;
  previousTime: GameTime;
  newTime: GameTime;
  dayChanged: boolean;
  daysSkipped: number;
}

export interface GameClockConfig {
  initialDay?: number;
  initialHour?: number;
  initialMinute?: number;
  timeScaleMinutesPerRealSecond?: number; // Default: 1.0 (1 real second = 1 game minute)
}

// ==========================================
// ECONOMY & PLAYER DOMAIN
// ==========================================

export type EnergyStatus = 'Rested' | 'Fine' | 'Tired' | 'Exhausted';

export interface PlayerState {
  cash: number;              // Starting: $38.00
  energy: number;            // 0..100
  fatigue: number;           // 0..100
  rentDueDay: number;        // Day 7, then Day 14
  rentAmount: number;        // $140.00
  rentPaid: boolean;
  internetBillDueDay: number;// Day 5, then Day 12
  internetBillAmount: number;// $25.00
  internetBillPaid: boolean;
  dailyFoodCost: number;     // $10.00 / day
  // P6.1 body: hunger rises with time, health drifts with care, sleepDebt caps energy
  hunger: number;            // 0..100 (100 = starving)
  health: number;            // 0..100 (lenient: floor effects only, never death)
  sleepDebt: number;         // 0+ (late/short nights accumulate, good nights repay)
  // P6 pantry: finite ingredients (noodles cups, grocery bags). Snack is vending (infinite).
  pantry: { noodles: number; groceries: number };
  // P7 where the player physically is (map travel, persisted)
  location: import('../CityMap').CityNodeId;
  // Social battery (visible meter): the introvert protagonist spends it on
  // every social act and recharges alone. 0 = socially blocked (soft-lock
  // proof: sleep, solitude and apologies always work). Old saves start full.
  socialBattery: number;       // 0..100 (100 = fresh, 0 = drained)
}

export interface WorkShiftResult {
  success: boolean;
  hours: number;
  earnedWage: number;
  energySpent: number;
  fatigueAdded: number;
  error?: string;
}

// ==========================================
// HARDWARE & OS DOMAIN
// ==========================================

export type ConnectionType = 'dialup_56k' | 'dsl_256k' | 'dsl_512k' | 'dsl_1m';
// Core OS lineage — now heavy, supports 4.8 / 5.0 / 6.0 / 6.1 / 7.0-beta / 7.0 / 7.0.1 + procedural
export type OsVersion = 'Orion_4.8' | 'Orion_5.0' | 'Orion_6.0' | 'Orion_6.1' | 'Orion_7.0-beta' | 'Orion_7.0' | 'Orion_7.0.1' | (string & {});

export type OwnedItemKind = 'hardware' | 'display' | 'media';
export type OwnedItemLocation = 'inventory' | 'room_package' | 'installed' | 'inserted';

export interface OwnedItem {
  instanceId: string;
  catalogItemId: string;
  kind: OwnedItemKind;
  location: OwnedItemLocation;
}

export interface LegacyRecoveryState {
  starterBundlePurchaseLost: boolean;
  consumed: boolean;
}

export interface PlayerInventoryState {
  items: OwnedItem[];
  purchaseCounts: Record<string, number>;
  legacyRecovery?: LegacyRecoveryState;
}

export interface ComputerSetupState {
  assembled: boolean;
  poweredOn: boolean;
  chassis: import('../hardware/types').ChassisComponent | null;
  motherboard: import('../hardware/types').MotherboardComponent | null;
  cpu: import('../hardware/types').CpuComponent | null;
  ramSticks: import('../hardware/types').RamStickComponent[];
  storage: import('../hardware/types').StorageComponent[];
  opticalDrives: import('../hardware/types').OpticalDriveComponent[];
  soundCard: import('../hardware/types').SoundCardComponent | null;
  networkCard: import('../hardware/types').NetworkCardComponent | null;
  insertedMediaId: string | null;
}

export interface DisplaySetupState {
  monitor: import('../hardware/types').MonitorComponent | null;
}

export interface HardwareState {
  hasComputer: boolean;
  isPoweredOn: boolean;
  cpuTier: number;
  cpuName: string;
  ramMB: number;
  hddTotalGB: number;
  hddFreeGB: number;
  connectionType: ConnectionType | null;
  connectionSpeedKbps: number;
  soundCardInstalled: boolean;
  speakersInstalled: boolean;
  webcamInstalled: boolean;
}

export interface RamPressure {
  totalRamMB: number;
  usedRamMB: number;
  freeRamMB: number;
  pressureRatio: number;            // used / total
  status: 'nominal' | 'elevated' | 'critical';
}

export interface OsEngineState {
  currentOsId: OsVersion | null;
  installedPatchIds: OsVersion[];
  lastBootAtMinute?: number;
  lastInstallAtMinute?: number;
  lastInstallLog?: string[];
  pendingReboot?: boolean;
  proceduralCatalog?: unknown[];
}

export interface PulseEngineState {
  currentPulseId: string;
  installedPatchIds: string[];
  lastUpdateAtMinute?: number;
  lastUpdateLog?: string[];
  pendingReboot?: boolean;
  proceduralCatalog?: any[];
}

export interface MyPlaceEngineState {
  currentMyPlaceId: string;
  lastUpdateAtMinute?: number;
  lastUpdateLog?: string[];
  userProfile: {
    username: string;
    displayName: string;
    headline: string;
    bio: string;
    interests: string[];
    songTitle: string;
    avatarGlyph: string;
    top8: Array<{ handle: string; name: string; avatar: string }>;
    glitterIntensity: number;
    tiledBackground?: string;
  };
  guestbook: Record<string, Array<{ author: string; text: string; date: string; minute: number }>>;
  proceduralCatalog?: any[];
}

export interface SoftwareRequirement {
  minOs: OsVersion;
  minRamMB: number;
  minCpuTier: number;
  requiredDiskBytes: number;
}

// ==========================================
// VIRTUAL FILE SYSTEM (VFS) DOMAIN
// ==========================================

export type FileKind = 'executable' | 'installer' | 'text' | 'image' | 'audio' | 'archive' | 'shortcut' | 'system' | 'directory';

export interface FileRecord {
  id: string;
  name: string;
  path: string;                     // e.g. 'C:/Downloads/PulseSetup.exe'
  parentPath: string;               // e.g. 'C:/Downloads'
  kind: FileKind;
  sizeBytes: number;
  createdAtMinute: number;
  modifiedAtMinute: number;
  appAssociation?: string;
  targetPath?: string;              // For shortcuts
  content?: string;                 // Text file contents or data payload
  isReadOnly?: boolean;
  metadata?: {
    isPortable?: boolean;
    isAdware?: boolean;
    isReadOnly?: boolean;
    author?: string;
    version?: string;
    originalTrashPath?: string;
    textContent?: string;
    extractedFiles?: string[];
    [key: string]: unknown;
  };
}

export interface VirtualFileSystemState {
  totalDiskBytes: number;
  baseSystemBytes: number;
  files: Record<string, FileRecord>;
}

// ==========================================
// DOWNLOADS DOMAIN
// ==========================================

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'complete' | 'failed' | 'cancelled';
export type DownloadManagerType = 'browser' | 'flashfetch';

export interface DownloadTask {
  id: string;
  sourceId: string;                 // e.g. 'downloadhub_pulse'
  sourceUrl: string;                // 'http://downloadhub.local/files/PulseSetup.exe'
  fileName: string;
  targetDirectory: string;          // 'C:/Downloads'
  totalBytes: number;
  downloadedBytes: number;
  sourceMaxKbps: number;            // Server throttle rate
  allocatedKbps: number;            // Fair-share bandwidth allocated
  status: DownloadStatus;
  resumable: boolean;
  manager: DownloadManagerType;
  startedAtMinute: number;
  completedAtMinute?: number;
  errorMessage?: string;
  fileKind: 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'text';
  appAssociation?: string;
}

export interface DownloadManagerState {
  tasks: DownloadTask[];
  maxConcurrentBrowser: number;
  maxConcurrentFlashFetch: number;
}

// ==========================================
// SOFTWARE REGISTRY DOMAIN
// ==========================================

export type InstallStage = 'welcome' | 'compatibility' | 'destination' | 'options' | 'progress' | 'finish';

export interface SoftwareComponentOption {
  id: string;
  name: string;
  description: string;
  defaultChecked: boolean;
  isAdwareOrToolbar?: boolean;
  installedBytes?: number;
  modifiesBrowserHomepage?: string;
  modifiesBrowserToolbar?: string;
  launchAtStartup?: boolean;
}

export interface SoftwareDefinition {
  id: string;
  appId: string;
  name: string;
  version: string;
  publisher: string;
  installedBytes: number;
  requirements: SoftwareRequirement;
  hasInstaller: boolean;
  isPortable?: boolean;
  isAdware?: boolean;
  bundledOffers?: SoftwareComponentOption[];
  icon?: string;
}

export interface InstalledSoftwareRecord {
  id: string;
  appId: string;
  name: string;
  version: string;
  installedBytes: number;
  installPath: string;
  installedAtMinute: number;
  isPortable: boolean;
  isAdware: boolean;
  adwarePayload?: {
    toolbarInjected?: boolean;
    homepageHijacked?: string;
    startupAutorun?: boolean;
  };
  shortcuts: string[];
}

export interface InstallerSession {
  sessionId: string;
  softwareDef: SoftwareDefinition;
  currentStage: 1 | 2 | 3 | 4 | 5 | 6; // 1: Welcome, 2: Compatibility, 3: Destination, 4: Options, 5: Progress, 6: Finish
  destinationPath: string;
  selectedOptions: {
    createDesktopShortcut: boolean;
    createStartMenuShortcut: boolean;
    launchOnStartup: boolean;
    acceptedBundledOffers: Record<string, boolean>;
  };
  compatibilityResult: {
    isCompatible: boolean;
    osCheck: { passed: boolean; required: string; current: string };
    ramCheck: { passed: boolean; required: number; current: number };
    cpuCheck: { passed: boolean; required: number; current: number };
    diskCheck: { passed: boolean; required: number; available: number };
  };
  installProgress: number; // 0..100
}

// ==========================================
// SOCIAL & CONTACTS DOMAIN
// ==========================================

export type BuddyPresenceStatus = 'online' | 'away' | 'busy' | 'offline';
export type BuddyStatus = BuddyPresenceStatus;

export interface RelationshipDimensions {
  familiarity: number;  // 0..100
  trust: number;        // 0..100
  comfort: number;      // 0..100
  respect: number;      // 0..100
  annoyance: number;    // 0..100
  // Character Lives (v4): carried on every bond so crushes, suspicion and
  // grudges can live between NPCs too. 0 = none, 100 = consuming.
  affection: number;    // 0..100
  attraction: number;   // 0..100
  suspicion: number;    // 0..100
  resentment: number;   // 0..100
}

// Character Lives — fixed temperament (Big5-lite). Set once at creation
// (core 4 hand-authored, procedural from archetype + stable id jitter) and
// never mutated afterwards, never chosen by AI. Rules read these to weight
// rolls and pick template lines; AI only paraphrases inside chat.
export interface CharacterTraits {
  shyness: number;      // 0..100 — high = terse, guarded, modest; low = forward
  warmth: number;       // 0..100 — high = seeks contact, forgiving
  discipline: number;   // 0..100 — high = keeps schedule and promises, leaves on time
  spontaneity: number;  // 0..100 — high = more NPC-NPC run-ins and dynamic plans
  loyalty: number;      // 0..100 — high = keeps confidences, resents betrayal harder
}

export interface ScheduleBlock {
  startMinuteOfDay: number; // 0..1439
  endMinuteOfDay: number;   // 0..1439
  status: BuddyPresenceStatus;
  awayMessage: string;
}

export type CharacterArchetype = 'coworker' | 'nightowl' | 'student' | 'trader' | 'artist' | 'regular' | (string & {});
export type BuddyLifecycleStatus = 'stranger' | 'acquaintance' | 'friend' | 'close' | 'distant' | 'gone' | 'blocked';
export type BuddyMetVia = 'nightboard' | 'myplace' | 'pulse-room' | 'work' | 'intro' | 'core';

export type HairColor = 'black' | 'dark_brown' | 'brown' | 'light_brown' | 'blonde' | 'auburn' | 'red' | 'grey' | 'dyed_blue' | 'dyed_pink' | 'dyed_green';
export type EyeColor = 'brown' | 'dark_brown' | 'hazel' | 'blue' | 'green' | 'grey' | 'amber';

export interface CharacterRoutine {
  wakeMinute: number;
  sleepMinute: number;
  workShift: 'morning' | 'day' | 'evening' | 'night' | 'flexible';
  preferredHangout?: string;
}

export interface CharacterArtProfile {
  engine: 'live2d' | 'mesh' | 'none';
  modelPath: string;
  expressions: Record<string, string>;
  defaultOutfit: string;
}

/** Pre-game history: who this buddy was to the player before day 1. */
export interface BuddyBackstory {
  relationship: 'stranger' | 'acquaintance' | 'friend' | 'close' | 'estranged';
  label: string; // ≤ 60 chars, e.g. 'old friend from the food-cart shifts'
  lapseDays: number; // days since last contact (0 = in touch)
  knowsAccounts: boolean; // the player once knew their handles (frictionless re-learn)
  candidates: Array<{ handle: string; status: 'active' | 'dead' | 'changed'; note?: string }>; // ≤ 3 old handles to try
  bioSeed: string; // ≤ 200 chars of flavor for generated profiles
}

export interface BuddyCharacter {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
  schedule: Record<number, ScheduleBlock[]>; // Keyed by day (1..14 legacy, 1..7 weekly for dynamic)
  initialRelationships: RelationshipDimensions;
  typingSpeedWpm: number;
  // Character Lives (v4): fixed temperament, set at creation, never mutated.
  // Required on new defs; v3 saves are backfilled deterministically on load.
  traits: CharacterTraits;
  // Dynamic-roster metadata (optional so legacy defs keep compiling)
  archetype?: CharacterArchetype;
  status?: BuddyLifecycleStatus;
  metVia?: BuddyMetVia;
  isProcedural?: boolean;
  createdDay?: number;
  // Free roster (v5): data-owned identity. All optional with engine backfills
  // so legacy/procedural defs keep compiling; the content store fills them.
  /** Physical vs far-away: remote buddies never meet in person (no art). */
  reach?: 'local' | 'remote';
  appearance?: { hair: HairColor | string; eyes: EyeColor | string };
  languages?: Array<{ lang: string; level: number }>; // 1..5 proficiency
  /** Capability tags: landlord, diner... engine queries these, never ids. */
  roles?: string[];
  backstory?: BuddyBackstory;
  chatColor?: string;
  bio?: string;
  routine?: CharacterRoutine;
  art?: CharacterArtProfile;
}

export interface BuddyPresence {
  status: BuddyPresenceStatus;
  awayMessage: string;
  customAwayMessage?: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;                 // 'player' or buddyId
  recipientId: string;
  text: string;
  timestampMinute: number;
  day: number;
  isRead: boolean;
  deliveredAway: boolean;
  tags?: string[];
  imageUrl?: string;
  imagePrompt?: string;
  imageCaption?: string;
}

export interface SocialEngineState {
  relationships: Record<string, RelationshipDimensions>;
  presence: Record<string, BuddyPresence>;
  conversations: Record<string, MessageRecord[]>;
  // Dynamic roster: buddy definitions (core 4 are code-owned; procedural ones persist here)
  buddies?: Record<string, BuddyCharacter>;
  // P3 long-term memory: immortal facts + promises per buddy (persisted, capped)
  coreMemories?: Record<string, CoreMemory[]>;
  promises?: Record<string, PromiseRecord[]>;
  // P4 buddy-to-buddy affinities: sorted "a__b" keys → -100..100 (persisted)
  affinities?: Record<string, number>;
  // P4 room-bump daily caps: "a__b_day" keys → used points (persisted, pruned)
  affinityCaps?: Record<string, number>;
  // Character Lives (v4): directed NPC↔NPC bonds "from__to" (persisted)
  npcBonds?: Record<string, NpcBondState>;
  // Character Lives (v4): per-buddy planned blocks keyed by buddy id (persisted, pruned)
  agenda?: Record<string, AgendaItem[]>;
  // Character Lives (v4): player mediations between NPCs, capped (persisted)
  mediations?: MediationRecord[];
  // Character Lives (v4): witnessable NPC↔NPC moments, capped (persisted)
  npcSocialLog?: NpcInteractionLog[];
  // Introvert protagonist (v4): each buddy's read of the player, keyed by buddy id (persisted)
  playerReads?: Record<string, PlayerReadState>;
  // Free roster (v5): pulse handles the player has learned, keyed by buddy id (persisted).
  // Empty at new game — contacts are earned through meetings, intros, and backstory.
  knownHandles?: Record<string, string[]>;
  // Free roster (v5): one-line epitaphs for pruned gone buddies, oldest-first (persisted, capped).
  epitaphs?: string[];
}

// ==========================================
// P3 — MEMORY & RELATIONSHIP DEPTH
// ==========================================

/** Immortal per-buddy memory: survives the rolling 6-message window, injected into every prompt. */
export interface CoreMemory {
  id: string;
  text: string; // <= 160 chars
  kind: 'fact' | 'promise_kept' | 'promise_broken' | 'first_meeting' | 'shared_moment' | 'shared_photo';
  day: number;
}

/** A commitment the player made to a buddy. Kept/broken explicitly move trust. */
export interface PromiseRecord {
  id: string;
  text: string; // <= 140 chars
  status: 'open' | 'kept' | 'broken';
  createdDay: number;
  dueDay?: number;
}

/** Relationship stage derived deterministically from dimensions (never stored, always computed). */
export type RelationshipStage = 'stranger' | 'acquaintance' | 'friend' | 'close' | 'strained';

/** Daily mood: deterministic hash per (buddy, day), overridden to 'cold' when strained. */
export type DailyMood = 'warm' | 'steady' | 'tired' | 'off' | 'cold';

// ==========================================
// CHARACTER LIVES — NPC inner life (v4 save shape)
// Rules decide, AI paraphrases. Every roll below is a seeded hash —
// no Math.random, no model-picked numbers, offline-safe by construction.
// ==========================================

/** Directed bond between two NPCs (the player is never a party to one). All dims 0..100. */
export interface NpcBondDims {
  familiarity: number;
  trust: number;
  comfort: number;
  respect: number;
  affection: number;
  attraction: number;
  annoyance: number;
  suspicion: number;
  resentment: number;
}

/** Cozy, non-explicit romance ladder. 'dating' is informal (no ceremony, no UI meter). */
export type NpcRomanceStage = 'none' | 'crush' | 'dating';

export interface NpcBondState {
  dims: NpcBondDims;
  romance: NpcRomanceStage;
  romanceSinceDay: number; // day the current stage started (1 when 'none')
  updatedDay: number;      // last day this bond moved
}

/** One planned block in a buddy's life (sleep/work/social/errand). */
export type AgendaKind = 'sleep' | 'work' | 'social' | 'errand';

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  label: string;       // <= 60 chars, template-pool text (never freeform AI text in saves)
  day: number;
  startMinute: number; // minute of day 0..1439
  endMinute: number;   // minute of day 1..1440
}

/** Player mediation between two NPCs: asked → player acts → the pair may compare notes. */
export type MediationKind = 'introduce' | 'strengthen' | 'ask_about';
export type MediationStatus = 'open' | 'fulfilled' | 'ignored' | 'sabotaged' | 'exposed';

export interface MediationRecord {
  id: string;
  requesterId: string; // buddy who asked the player
  targetId: string;    // buddy they asked about / want to meet / bond with
  kind: MediationKind;
  status: MediationStatus;
  createdDay: number;
  resolvedDay?: number;
}

/** Witnessable NPC↔NPC moment (rules-decided, capped, prompt-visible as gossip). */
export interface NpcInteractionLog {
  id: string;
  day: number;
  firstId: string;
  secondId: string;
  location: string; // display label from the template pool
  line: string;     // witness line (<= 140 chars)
}

/**
 * One buddy's read of the PLAYER (the introvert protagonist). Beliefs start
 * neutral (50s) — strangers misread quiet as cold until behavior teaches
 * them otherwise. Certainty 0..100 slows learning as it grows.
 */
export interface PlayerReadState {
  beliefs: CharacterTraits;
  certainty: number; // 0..100
  updatedDay: number;
}

// ==========================================
// WORLD / SANDBOX DOMAIN (replaces narrative beats)
// ==========================================

export interface Appointment {
  id: string;
  characterId: string;
  locationId: string;               // 'cafe' | 'work' | 'motel_lobby'
  targetDay: number;
  startMinute: number;              // Minute of day (e.g. 15 * 60 = 15:00)
  endMinute: number;
  description: string;
  isCompleted: boolean;
  isMissed: boolean;
  // P5 live-meeting lifecycle (optional so legacy/old-save appointments keep working)
  status?: AppointmentStatus;       // default 'scheduled'
  rsvp?: AppointmentRsvp;           // NPC reply, decided by rules
  npcShowed?: boolean;
  playerShowed?: boolean;
  // P6 job-board shifts pay their gig wage instead of the standard side-shift wage
  wageOverride?: number;
  // P6 job provenance: set when this appointment was created from a job-board gig acceptance
  origin?: { kind: 'job'; id: string };
}

/** P5 live-meeting lifecycle: scheduled → confirmed → happened/missed, or cancelled. */
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'happened' | 'missed' | 'cancelled';

/** P5 NPC reply to a planned meeting (rules-only, messaged to the player). */
export type AppointmentRsvp = 'yes' | 'no' | 'maybe';

export interface InkSemanticTag {
  type: 'beat' | 'effect' | 'social';
  target?: string;
  action?: string;
  value?: unknown;
  raw: string;
}

// Sandbox global event shared with WorldEventsEngine — includes pulse_update like OS
export type GlobalEventCategory = 'os_release' | 'pulse_update' | 'site_launch' | 'city_news' | 'economy' | 'culture' | 'system';

export interface GlobalEvent {
  id: string;
  title: string;
  description: string;
  category: GlobalEventCategory;
  triggerDay: number;
  triggerHour?: number;
  knowledgePrompt: string;
  siteUrl?: string;
  isTriggered: boolean;
  triggeredAtMinute?: number;
}

export type BuddyAttitude = 'hyped' | 'curious' | 'skeptical' | 'annoyed' | 'indifferent' | 'worried';

export interface BuddyEventKnowledge {
  eventId: string;
  attitude: BuddyAttitude;
  personalTake: string; // one sentence, buddy-specific
  learnedAtMinute: number;
}

export interface WorldState {
  flags: Record<string, boolean | number | string>;
  appointments: Appointment[];
  windowObservationHistory: string[];
  triggeredEvents: GlobalEvent[];
  // Per-buddy attitude bank — each buddy sees same event through different eyes
  buddyKnowledge: Record<string, BuddyEventKnowledge[]>; // key: buddyId
}

// Deprecated alias — kept for backward compat during migration to sandbox
export type NarrativeState = WorldState & {
  activeBeatId?: string | null;
  completedBeats?: string[];
};

// ==========================================
// TELEMETRY DOMAIN
// ==========================================

export interface TelemetryRecord {
  timestampMinutes: number;
  realTimestampMs: number;
  category: 'economy' | 'hardware' | 'social' | 'software' | 'download' | 'world' | 'narrative' | 'room';
  action: string;
  data?: Record<string, unknown>;
}

export interface TelemetryStats {
  sessionStartTimeMs: number;
  totalRealPlayTimeSeconds: number;
  gameDaysReached: number;
  minutesInPcView: number;
  minutesInRoomView: number;
  totalMoneyEarned: number;
  totalMoneySpent: number;
  peakCash: number;
  lowestCash: number;
  rentPaymentsCompleted: number;
  programsInstalledCount: number;
  downloadsCompletedCount: number;
  windowObservationsCount: number;
  workShiftsCompleted: number;
  hardwareUpgradesCount: number;
  osUpgradedDay: number | null;
  cafeMeetingAttended: boolean;
  endingReached: string | null;
}

// ==========================================
// ROOT SIMULATION STATE & ACTIONS
// ==========================================

export interface SimulationState {
  version: number;
  time: GameTime;  player: PlayerState;
  hardware: HardwareState;
  computer: ComputerSetupState;
  display: DisplaySetupState;
  inventory: PlayerInventoryState;
  os: OsEngineState;
  pulse: PulseEngineState;
  myplace: MyPlaceEngineState;
  vfs: VirtualFileSystemState;
  downloads: DownloadTask[];
  deliveries: import('../DeliveryEngine').DeliveryEngineState;
  installedSoftware: InstalledSoftwareRecord[];
  social: SocialEngineState;
  world: WorldState;
  /** @deprecated use world — kept for migration compat */
  narrative: NarrativeState;
  telemetry: {
    stats: TelemetryStats;
    logs: TelemetryRecord[];
  };
  activeView: 'pc' | 'room' | 'cafe' | 'work' | 'city';
  /**
   * Player Inner Voice cooldown/notable-history (#23). Additive and optional:
   * absent in older saves (clean defaults apply), ignored by older builds.
   * No SAVE_FORMAT bump required.
   */
  innerVoice?: InnerVoicePersistedState;
}

export interface StorePurchaseResultData {
  purchasedItemIds: string[];
  charged: number;
  recoveredLegacyPurchase: boolean;
}

export type SimulationAction =
  | { type: 'TIME_ADVANCE_MINUTES'; minutes: number; reason?: string }
  | { type: 'TIME_SET_PAUSED'; paused: boolean }
  | { type: 'VIEW_SWITCH'; view: 'pc' | 'room' | 'cafe' | 'work' | 'city' }
  | { type: 'PLAYER_EARN_CASH'; amount: number; reason: string }
  | { type: 'PLAYER_SPEND_CASH'; amount: number; reason: string }
  | { type: 'STORE_PURCHASE_ITEM'; storeId: 'silicon_spares'; skuId: string }
  | { type: 'PLAYER_WORK_SHIFT'; durationMinutes?: number; wage?: number }
  | { type: 'PLAYER_PAY_RENT' }
  | { type: 'PLAYER_PAY_INTERNET' }
  | { type: 'PLAYER_REST_OR_SLEEP'; wakeHour?: number; wakeMinute?: number }
  | { type: 'PLAYER_INTERACT_ROOM'; activity: 'tea' | 'coffee' | 'meal' | 'groceries' | 'shower' | 'window' }
  | { type: 'PLAYER_CITY_OUTING'; outingId: string }
  | { type: 'PLAYER_PLACE_ORDER'; items: Array<{ sku: string; qty: number }>; fulfillment: 'pickup' | 'delivery' }
  | { type: 'JOB_APPLY'; gigId: string }
  | { type: 'TRAVEL_TO'; to: import('../CityMap').CityNodeId; mode: 'walk' | 'bus' }
  | { type: 'HARDWARE_UPGRADE_RAM'; ramMB: number; cost: number }
  | { type: 'HARDWARE_UPGRADE_CONNECTION'; connectionType: ConnectionType; cost: number }
  | { type: 'HARDWARE_UPGRADE_OS'; targetOs: OsVersion; cost: number }
  | { type: 'DOWNLOAD_START'; sourceId: string; url: string; fileName: string; totalBytes: number; sourceMaxKbps: number; fileKind?: 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'text'; appAssociation?: string; manager?: DownloadManagerType }
  | { type: 'DOWNLOAD_PAUSE'; taskId: string }
  | { type: 'DOWNLOAD_RESUME'; taskId: string }
  | { type: 'DOWNLOAD_CANCEL'; taskId: string }
  | { type: 'VFS_CREATE_FILE'; file: Omit<FileRecord, 'id' | 'createdAtMinute' | 'modifiedAtMinute'> & { id?: string } }
  | { type: 'VFS_DELETE_FILE'; path: string }
  | { type: 'VFS_MOVE_TRASH'; path: string }
  | { type: 'VFS_RESTORE_TRASH'; trashPath: string }
  | { type: 'VFS_EMPTY_TRASH' }
  | { type: 'SOFTWARE_INSTALL'; softwareId: string; selectedOptions?: Record<string, boolean> }
  | { type: 'SOFTWARE_UNINSTALL'; installedId: string }
  | { type: 'SOCIAL_SEND_MESSAGE'; buddyId: string; text: string; tags?: string[]; imageUrl?: string; imagePrompt?: string; imageCaption?: string }
  | { type: 'SOCIAL_RECEIVE_MESSAGE'; buddyId: string; text: string; timestampMinute?: number; deliveredAway?: boolean; tags?: string[]; imageUrl?: string; imagePrompt?: string; imageCaption?: string }
  | { type: 'SOCIAL_APPLY_ACTION'; buddyId: string; socialAction: string }
  // Character Lives (v4): the player's answer to an NPC mediation request.
  // Rules resolve it; the Pulse UI may dispatch this (chat command or button follow-up).
  | { type: 'MEDIATION_RESPOND'; mediationId: string; choice: 'help' | 'ignore' | 'badmouth' }
  // Free roster (v5): the player types a pulse handle to add (rules check it).
  | { type: 'ADD_CONTACT'; handle: string }
  // Free roster (v5): the player browses NightBoard for someone new (rules throttle it).
  | { type: 'NIGHTBOARD_MEET' }
  | { type: 'SOCIAL_ADD_BUDDY'; buddy: BuddyCharacter; introText?: string; silent?: boolean }
  | { type: 'SOCIAL_REMOVE_BUDDY'; buddyId: string }
  | { type: 'WORLD_SET_FLAG'; key: string; value: boolean | number | string }
  | { type: 'WORLD_TRIGGER_EVENT'; eventId: string }
  | { type: 'WORLD_ADD_OBSERVATION'; entry: string }
  | { type: 'WORLD_SCHEDULE_APPOINTMENT'; appointment: Omit<Appointment, 'isCompleted' | 'isMissed'> }
  // Deprecated aliases — map to WORLD_* internally
  | { type: 'NARRATIVE_TRIGGER_BEAT'; beatId: string }
  | { type: 'NARRATIVE_SET_FLAG'; key: string; value: boolean | number | string }
  | { type: 'NARRATIVE_SCHEDULE_APPOINTMENT'; appointment: Omit<Appointment, 'isCompleted' | 'isMissed'> };

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==========================================
// SIMULATION EVENT MAP (EVENT BUS)
// ==========================================

export interface SimulationEventMap {
  'time:tick': { time: GameTime; deltaMinutes: number };
  'time:day_changed': { newDay: number; previousDay: number; time: GameTime };
  'time:jump': { jumpMinutes: number; time: GameTime; reason?: string };
  'economy:cash_changed': { previousCash: number; newCash: number; delta: number; reason: string };
  'economy:shift_completed': { wage: number; hours: number; energySpent: number };
  'economy:rent_due': { day: number; amount: number };
  'economy:rent_paid': { day: number; amount: number };
  'economy:energy_changed': { previousEnergy: number; newEnergy: number; delta: number };
  'hardware:upgraded': { component: string; oldValue: unknown; newValue: unknown };
  'hardware:os_migrated': { from: OsVersion | null; to: OsVersion };
  'hardware:disc_inserted': { disc: import('../hardware/types').InsertedDisc };
  'hardware:disc_ejected': Record<string, never>;
  'hardware:power_changed': { isPoweredOn: boolean };
  'download:started': { task: DownloadTask };
  'download:paused': { task: DownloadTask };
  'download:resumed': { task: DownloadTask };
  'download:cancelled': { taskId: string };
  'download:progress': { taskId: string; progress: number; speedKbps: number };
  'download:completed': { task: DownloadTask; filePath: string };
  'download:failed': { taskId: string; error: string };
  'vfs:file_created': { file: FileRecord };
  'vfs:file_trashed': { file: FileRecord };
  'vfs:file_restored': { file: FileRecord };
  'vfs:trash_emptied': { bytesReclaimed: number };
  'vfs:file_deleted': { path: string; sizeBytes: number };
  'software:installed': { software: InstalledSoftwareRecord };
  'software:uninstalled': { software: InstalledSoftwareRecord };
  'social:status_changed': { buddyId: string; presence: BuddyPresence };
  'social:message_received': { message: MessageRecord };
  'social:relationship_updated': { buddyId: string; dimensions: RelationshipDimensions; delta: Partial<RelationshipDimensions> };
  'social:buddy_registered': { buddy: BuddyCharacter };
  'social:buddy_removed': { buddyId: string };
  'social:buddy_status_changed': { buddyId: string; status: BuddyLifecycleStatus };
  'social:promise_resolved': { buddyId: string; promiseId: string; kept: boolean };
  'world:flag_changed': { key: string; value: boolean | number | string };
  'world:global_event_triggered': { event: GlobalEvent };
  'world:appointment_scheduled': { appointment: Appointment };
  // Deprecated narrative aliases
  'narrative:tag_emitted': { tag: InkSemanticTag };
  'narrative:beat_triggered': { beatId: string };
  'telemetry:event_logged': { record: TelemetryRecord };
}

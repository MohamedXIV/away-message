import { getNpcStyle, getNpcMoodLabel, getNpcAvailabilityLabel, getNpcActivityLabel } from '../data/npcStyles';
import { CHARACTER_ARCHETYPES } from '../../../engine/characterTemplates';
import { CORE_BY_ID } from '../../../engine/coreBuddies';
import type { BuddyCharacter, BuddyPresence, RelationshipDimensions } from '../../../engine/types';
import { buildBodyHint } from '../../../engine/BodyDirector';
import { weatherLineForDay } from '../../../engine/WeatherEngine';
import {
  extractFactsFromPlayerMessage,
  extractPromisesFromPlayerMessage,
  looksLikeCompletion,
  looksLikePhotoQuestion,
  buildConversationSummary,
  buildMemoryContext,
} from './conversationMemory';
import { pickRandomBuddyLink } from './linkDetector';
import type { DetectedLink } from './linkDetector';
import { loadPulseState, savePulseState, getCurrentPulseSlotId } from '../persistence';
import type { PulseSharedLink } from '../persistence';

/**
 * Shared DM-grade chat context (P8/A1). PulseMessengerApp and CafeScene build
 * NPC replies from exactly the same persona / relationship / memory / world
 * inputs, and record exchanges back into the same Pulse memory stores —
 * one continuous relationship across screens.
 */

// Governed social actions honoured from free-chat AI replies.
// Mirrors the GeneratedChatResponseSchema enum minus 'none' (no-op).
export const CHAT_SOCIAL_ACTIONS = new Set([
  'empathy',
  'remembered_detail',
  'tease_playful',
  'dismissive',
  'vulnerable_share',
  'work_camaraderie',
  'intellectual_curiosity',
]);

/** Minimal engine surface the chat layer needs (structural — the real engine satisfies it). */
export interface ChatEngine {
  social: {
    getBuddy(id: string): (BuddyCharacter & { archetype?: BuddyCharacter['archetype'] }) | undefined;
    getRelationships(id: string): RelationshipDimensions | undefined;
    getPresence(id: string): BuddyPresence | undefined;
    getMessages(id: string): Array<{ senderId: string; text: string }>;
    getRelationshipStage(id: string): string;
    getDailyMood(id: string, day: number): string;
    buildLongTermContext(id: string): string;
    buildAffinityContext(id: string): string;
    getCoreMemories(id: string): Array<{ kind: string }>;
    getOpenPromises(id: string): Array<{ id: string; text: string }>;
    addPromise(id: string, text: string, createdDay: number, dueDay?: number): unknown;
    resolvePromise(id: string, promiseId: string, kept: boolean, day: number): unknown;
    // Character Lives (optional so older stubs keep compiling; SocialEngine implements all)
    getTraits?(id: string): { shyness: number; warmth: number; discipline: number; spontaneity: number; loyalty: number };
    buildBondContext?(id: string): string;
    buildRomanceContext?(id: string): string;
    getAgenda?(id: string, day?: number): Array<{ kind: string; label: string; day: number }>;
    buildPlayerReadContext?(id: string): string;
  };
  dispatchAction(action: { type: string; buddyId?: string; socialAction?: string; [key: string]: any }): unknown;
  handleMeetupChat?(buddyId: string, text: string, day: number): void;
  /** Rules-stored reception hint for a bold player line (SimulationEngine implements it). */
  getReceptionHint?(buddyId: string, day: number): string;
  /** True when the installed Pulse release is the 6.x generation. */
  isPulse6?(): boolean;
  world?: {
    getKnowledgeContextForBuddy?(buddyId: string, day: number): string;
    getKnowledgeContext?(day: number): string;
  };
  clock?: { getTime(): { day: number } };
  economy?: { getState(): { energy: number; hunger?: number; health?: number; sleepDebt?: number } };
}

/** The four Pulse memory stores every chat turn reads and writes. */
export interface PulseMemorySlices {
  conversationMemory: Record<string, string[]>;
  buddyFacts: Record<string, string[]>;
  conversationSummaries: Record<string, string>;
  recentReplies: Record<string, string[]>;
  npcMood?: Record<string, string>;
  npcActivity?: Record<string, string>;
}

export function buddyPersonaLine(buddyId: string, buddy?: BuddyCharacter | null): string {
  // Core voices come from the registry (content-owned, never hand-copied here).
  const core = CORE_BY_ID[buddyId];
  if (core) return core.persona;
  const archetype = buddy?.archetype && CHARACTER_ARCHETYPES[buddy.archetype] ? buddy.archetype : undefined;
  if (archetype) {
    const template = CHARACTER_ARCHETYPES[archetype];
    if (template) {
      return `${template.personaHint} Vocabulary hints: ${template.vocabulary.join(', ')}. Quirks: ${template.quirks.join(', ')}.`;
    }
  }
  return 'A believable online friend with a distinct but grounded personality.';
}

// ---------------------------------------------------------------------------
// Cross-surface memory bridge: CafeScene (which owns no pulseState) reads and
// writes the same persisted memory slices PulseMessengerApp holds in memory.
// The app subscribes below and refreshes from storage after cafe turns.
// ---------------------------------------------------------------------------

type MemoryBridgeListener = () => void;
const bridgeListeners = new Set<MemoryBridgeListener>();

export function subscribePulseMemoryChanged(listener: MemoryBridgeListener): () => void {
  bridgeListeners.add(listener);
  return () => {
    bridgeListeners.delete(listener);
  };
}

function notifyPulseMemoryChanged(): void {
  for (const listener of Array.from(bridgeListeners)) {
    try {
      listener();
    } catch { /* listeners are best-effort */ }
  }
}

/** Read the four live memory slices from persisted Pulse state (current slot). */
export function readMemorySlices(): PulseMemorySlices {
  try {
    const slotId = getCurrentPulseSlotId();
    const state = loadPulseState(slotId);
    return {
      conversationMemory: state.conversationMemory,
      buddyFacts: state.buddyFacts,
      conversationSummaries: state.conversationSummaries,
      recentReplies: state.recentReplies,
    };
  } catch {
    return { conversationMemory: {}, buddyFacts: {}, conversationSummaries: {}, recentReplies: {} };
  }
}

/** Merge memory slices back to persisted state and notify live subscribers. */
export function writeMemorySlices(patch: Partial<PulseMemorySlices>): void {
  try {
    const slotId = getCurrentPulseSlotId();
    const state = loadPulseState(slotId);
    savePulseState(
      {
        ...state,
        conversationMemory: patch.conversationMemory ?? state.conversationMemory,
        buddyFacts: patch.buddyFacts ?? state.buddyFacts,
        conversationSummaries: patch.conversationSummaries ?? state.conversationSummaries,
        recentReplies: patch.recentReplies ?? state.recentReplies,
      },
      slotId
    );
    notifyPulseMemoryChanged();
  } catch { /* bridge writes are best-effort */ }
}

export interface DmContextInput {
  engine: ChatEngine;
  buddyId: string;
  playerText: string;
  pulse: PulseMemorySlices;
  day: number;
  totalMinutes: number;
  /** Extra scene line appended to the relationship snapshot (e.g. in-person meetings). */
  sceneContext?: string;
  /** Extra persona line for out-of-DM scenes (e.g. "you sit across from the player…"). */
  personaSuffix?: string;
}

export interface DmChatContext {
  displayName: string;
  handle: string;
  persona: string;
  relationshipSummary: string;
  recentMessages: Array<{ sender: string; text: string }>;
  worldKnowledge: string;
  currentDay: number;
  memoryContext: string;
  updatedSummary: string;
  mergedFacts: string[];
  recentRepliesForBuddy: string[];
  recentMessagesForSummary: Array<{ sender: string; text: string }>;
  preSendPatch: {
    conversationMemory: Record<string, string[]>;
    conversationSummaries: Record<string, string>;
    buddyFacts: Record<string, string[]>;
    npcMood: Record<string, string>;
    npcActivity: Record<string, string>;
  };
}

/**
 * Pre-send ledger: promise capture, follow-through detection, meetup parsing.
 * Rules only, no AI. Must run AFTER the player's SEND_MESSAGE dispatch so the
 * fresh line is already in engine history.
 */
export function runChatLedger(engine: ChatEngine, buddyId: string, text: string, totalMinutes: number): void {
  try {
    const gameDay = Math.floor(totalMinutes / 1440) + 1;
    for (const extracted of extractPromisesFromPlayerMessage(text)) {
      engine.social.addPromise(
        buddyId,
        extracted.text,
        gameDay,
        extracted.dueDayOffset !== undefined ? gameDay + extracted.dueDayOffset : undefined
      );
    }
    if (looksLikeCompletion(text)) {
      const open = engine.social.getOpenPromises(buddyId);
      if (open.length > 0 && open[0]) engine.social.resolvePromise(buddyId, open[0].id, true, gameDay);
    }
    engine.handleMeetupChat?.(buddyId, text, gameDay);
  } catch { /* ledger never blocks chat */ }
}

/** Build everything generateChat needs, plus the pre-send memory patch. No writes. */
export function buildDmChatContext(input: DmContextInput): DmChatContext {
  const { engine, buddyId, playerText: text, pulse, day: currentDay } = input;
  const totalMinutes = input.totalMinutes;
  const buddy = engine.social.getBuddy(buddyId);
  const relationship = engine.social.getRelationships(buddyId);
  const presence = engine.social.getPresence(buddyId);
  const gameHour = Math.floor((totalMinutes % 1440) / 60);
  let playerEnergy = 80;
  let bodyHint = '';
  try {
    const playerState = engine.economy?.getState();
    playerEnergy = playerState?.energy ?? 80;
    bodyHint = buildBodyHint({
      energy: playerState?.energy ?? 80,
      hunger: playerState?.hunger ?? 0,
      health: playerState?.health ?? 100,
      sleepDebt: playerState?.sleepDebt ?? 0,
    });
  } catch { playerEnergy = 80; }
  const style = getNpcStyle(buddyId);
  const mood = getNpcMoodLabel(presence, relationship, gameHour, playerEnergy);
  const availability = getNpcAvailabilityLabel(presence, gameHour);
  const activity = getNpcActivityLabel(presence, buddyId, gameHour);
  const existingMemory = pulse.conversationMemory[buddyId] || [];
  const existingFacts = pulse.buddyFacts[buddyId] || [];
  const newFacts = extractFactsFromPlayerMessage(text);
  const mergedFacts = [...existingFacts, ...newFacts].slice(-12);
  const recentMessagesForSummary = engine.social.getMessages(buddyId).slice(-8).map((message) => ({
    sender: message.senderId === 'player' ? 'player' : 'buddy',
    text: message.text,
  }));
  const previousSummary = pulse.conversationSummaries[buddyId] || '';
  const updatedSummary = buildConversationSummary(recentMessagesForSummary, previousSummary);
  const recentRepliesForBuddy = pulse.recentReplies[buddyId] || [];
  const memoryContext = buildMemoryContext([...existingMemory, `Player said: ${text}`].slice(-6), mergedFacts, updatedSummary, recentRepliesForBuddy);

  const personaSuffix = input.personaSuffix ? ` ${input.personaSuffix}` : '';
  // Pulse 6.x: the buddy knows their client does color + motion — MSN-era peacocking allowed.
  let pulse6Suffix = '';
  try {
    if (engine.isPulse6?.()) {
      pulse6Suffix = ' You are on Pulse 6.0: you tint your own name your signature color, and you may use animated emoticons like (:lol:) (:love:) (:dance:) sparingly when the feeling is real — classics like :) :( :D still work everywhere.';
    }
  } catch { /* flavor is best-effort */ }
  // Character Lives: fixed temperament steers phrasing (numbers never quoted — see service prompt).
  let temperamentLine = '';
  try {
    const traits = engine.social.getTraits?.(buddyId);
    if (traits) {
      temperamentLine = ` Temperament (fixed 0-100, shape tone, never quote numbers): shy ${traits.shyness}, warm ${traits.warmth}, disciplined ${traits.discipline}, spontaneous ${traits.spontaneity}, loyal ${traits.loyalty}.`;
    }
  } catch { /* temperament is best-effort */ }
  let identityLine = '';
  if (buddy) {
    const app = buddy.appearance;
    const reachText = buddy.reach === 'remote' ? 'Lives online / far away (never meets in person)' : 'Oakhaven local';
    const langs = (buddy.languages ?? []).map((l) => `${l.lang} (level ${l.level}/5)`).join(', ');
    const rolesText = (buddy.roles ?? []).length > 0 ? ` Roles: ${(buddy.roles ?? []).join(', ')}.` : '';
    identityLine = ` Physical: ${app?.hair ?? 'natural'} hair, ${app?.eyes ?? 'honest'} eyes. Reach: ${reachText}.${langs ? ` Languages: ${langs}.` : ''}${rolesText}`;
  }
  let backstoryLine = '';
  if (buddy?.backstory) {
    const b = buddy.backstory;
    backstoryLine = ` Pre-game backstory: Was ${b.relationship} to the player before day 1 ("${b.label}"). Last in touch ${b.lapseDays} days ago.`;
  }
  const personaWithStyle = `${style.persona} Vocabulary hints: ${style.vocabulary.join(', ')}. Punctuation: ${style.punctuation}. Quirks: ${style.quirks.join(', ')}. ${buddyPersonaLine(buddyId, buddy)}${identityLine}${backstoryLine}${temperamentLine}${pulse6Suffix}${personaSuffix}`;
  let relationshipStage = 'acquaintance';
  let dailyMood = 'steady';
  let longTermContext = '';
  let affinityContext = '';
  let bondContext = '';
  let romanceContext = '';
  let plansLine = '';
  let receptionHint = '';
  let playerReadLine = '';
  let photoRecallHint = '';
  let weatherLine = '';
  try {
    weatherLine = weatherLineForDay(currentDay);
  } catch { /* weather is best-effort */ }
  try {
    relationshipStage = engine.social.getRelationshipStage(buddyId);
    dailyMood = engine.social.getDailyMood(buddyId, currentDay);
    longTermContext = engine.social.buildLongTermContext(buddyId);
    affinityContext = engine.social.buildAffinityContext(buddyId);
    // Character Lives: NPC↔NPC ties, romance status, and today's plans (all bounded, rules-built).
    bondContext = engine.social.buildBondContext?.(buddyId) ?? '';
    romanceContext = engine.social.buildRomanceContext?.(buddyId) ?? '';
    // Bold-act reception: the rules judged the player's line at send time.
    receptionHint = engine.getReceptionHint?.(buddyId, currentDay) ?? '';
    // Their read of the player (qualitative, rules-built — never numbers).
    playerReadLine = engine.social.buildPlayerReadContext?.(buddyId) ?? '';
    try {
      const agenda = engine.social.getAgenda?.(buddyId, currentDay) ?? [];
      if (agenda.length > 0) {
        plansLine = `Plans today: ${agenda.slice(0, 3).map((a) => `${a.label} (${a.kind})`).join('; ')}`;
      }
    } catch { /* plans are best-effort */ }
    if (looksLikePhotoQuestion(text) && engine.social.getCoreMemories(buddyId).some((m) => m.kind === 'shared_photo')) {
      photoRecallHint = ' The player is asking about a shared photo — recall it warmly and specifically from the LongTerm memories.';
    }
  } catch { /* prompt enrichment is best-effort */ }
  const sceneSuffix = input.sceneContext ? ` | Scene: ${input.sceneContext}` : '';
  const relationshipSummary = `${relationship ? JSON.stringify(relationship) : 'new friendship'} | Stage: ${relationshipStage} | DailyMood: ${dailyMood} | Mood: ${mood} | Availability: ${availability} | Activity: ${activity} | ${weatherLine} | ${memoryContext} | ${longTermContext}${affinityContext ? ` | ${affinityContext}` : ''}${bondContext ? ` | ${bondContext}` : ''}${romanceContext ? ` | ${romanceContext}` : ''}${plansLine ? ` | ${plansLine}` : ''}${receptionHint ? ` | Reception: ${receptionHint}` : ''}${playerReadLine ? ` | ${playerReadLine}` : ''}${photoRecallHint}${bodyHint ? ` | ${bodyHint}` : ''}${sceneSuffix} | Typing: ${style.typing.wpm} wpm, ${style.typing.pauseStyle}`;

  let worldKnowledge = '';
  let currentGameDay = currentDay;
  try {
    if (engine.world?.getKnowledgeContextForBuddy) {
      worldKnowledge = engine.world.getKnowledgeContextForBuddy(buddyId, currentGameDay ?? 1);
    } else if (engine.world?.getKnowledgeContext) {
      worldKnowledge = engine.world.getKnowledgeContext(currentGameDay ?? 1);
    } else if (engine.clock?.getTime) {
      currentGameDay = engine.clock.getTime().day;
    }
  } catch {}

  return {
    displayName: buddy?.displayName || buddyId,
    handle: buddy?.handle || buddyId,
    persona: personaWithStyle,
    relationshipSummary,
    recentMessages: recentMessagesForSummary,
    worldKnowledge,
    currentDay: currentGameDay,
    memoryContext,
    updatedSummary,
    mergedFacts,
    recentRepliesForBuddy,
    recentMessagesForSummary,
    preSendPatch: {
      conversationMemory: { ...pulse.conversationMemory, [buddyId]: [...(pulse.conversationMemory[buddyId] || []), `Player said: ${text}`].slice(-6) },
      conversationSummaries: { ...pulse.conversationSummaries, [buddyId]: updatedSummary },
      buddyFacts: { ...pulse.buddyFacts, [buddyId]: mergedFacts },
      npcMood: { ...(pulse.npcMood || {}), [buddyId]: mood },
      npcActivity: { ...(pulse.npcActivity || {}), [buddyId]: activity },
    },
  };
}

/**
 * Honour the model's chosen socialAction through governed engine rules.
 * Fallback/generic replies and 'none' never move the needle.
 */
export function honorSocialAction(engine: ChatEngine, buddyId: string, socialAction: unknown, allow: boolean): void {
  try {
    if (allow && typeof socialAction === 'string' && CHAT_SOCIAL_ACTIONS.has(socialAction)) {
      engine.dispatchAction({ type: 'SOCIAL_APPLY_ACTION', buddyId, socialAction });
    }
  } catch { /* relationship nudge never blocks chat */ }
}

export interface ExchangeUpdateInput {
  npcTexts: string[];
  existingReplies: string[];
  previousSummary: string;
  recentMessages: Array<{ sender: string; text: string }>;
  detectedLinks: DetectedLink[];
  displayName: string;
  buddyId: string;
  totalMinutes: number;
  existingSharedLinks: PulseSharedLink[];
  existingDiscoveredHosts: string[];
}

/** Pure post-reply computation: merged replies, rebuilt summary, captured links. */
export function computeExchangeUpdate(input: ExchangeUpdateInput): {
  mergedReplies: string[];
  postReplySummary: string;
  newSharedLinks: PulseSharedLink[];
  mergedSharedLinks: PulseSharedLink[];
  mergedDiscoveredHosts: string[];
} {
  const newReplyTexts = input.npcTexts.map((text) => text.slice(0, 500));
  const mergedReplies = [...input.existingReplies, ...newReplyTexts].slice(-6);
  const messagesWithReply = [...input.recentMessages, ...newReplyTexts.map((replyText) => ({ sender: 'buddy', text: replyText }))];
  const postReplySummary = buildConversationSummary(messagesWithReply, input.previousSummary);

  const existingUrls = new Set(input.existingSharedLinks.map((link) => link.url.toLowerCase()));
  const newSharedLinks: PulseSharedLink[] = [];
  input.detectedLinks.forEach((link) => {
    const lower = link.url.toLowerCase();
    if (existingUrls.has(lower) || newSharedLinks.some((entry) => entry.url.toLowerCase() === lower)) return;
    const poolMatch = (() => {
      try {
        const pool = pickRandomBuddyLink(input.buddyId, input.totalMinutes) as unknown as { host: string; title: string; snippet: string } | null;
        return pool && pool.host === link.host ? pool : null;
      } catch { return null; }
    })();
    const title = poolMatch?.title || `${link.host} — shared by ${input.displayName}`;
    const snippet = poolMatch?.snippet || `Shared in Pulse by ${input.displayName} at Day ${Math.floor(input.totalMinutes / 1440) + 1}.`;
    newSharedLinks.push({
      id: `shared_${input.buddyId}_${link.host}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url: link.url,
      host: link.host,
      title,
      sharedBy: input.buddyId,
      sharedByName: input.displayName,
      minute: input.totalMinutes,
      snippet,
    });
  });
  const mergedSharedLinks = [...input.existingSharedLinks, ...newSharedLinks].slice(-30);
  const discoveredSet = new Set(input.existingDiscoveredHosts);
  newSharedLinks.forEach((link) => discoveredSet.add(link.host.toLowerCase()));
  const mergedDiscoveredHosts = Array.from(discoveredSet).slice(0, 30);
  return { mergedReplies, postReplySummary, newSharedLinks, mergedSharedLinks, mergedDiscoveredHosts };
}

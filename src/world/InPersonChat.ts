import { aiService } from '../ai/service';
import { loadAISettings } from '../ai/settings';
import {
  buildDmChatContext,
  honorSocialAction,
  readMemorySlices,
  runChatLedger,
  writeMemorySlices,
  type ChatEngine,
} from '../apps/pulse/utils/chatContext';
import { buildConversationSummary } from '../apps/pulse/utils/conversationMemory';

type GenerateChatRequest = Parameters<typeof aiService.generateChat>[0];
type GenerateChatSettings = Parameters<typeof aiService.generateChat>[1];
type GenerateChatResult = Awaited<ReturnType<typeof aiService.generateChat>>;

export interface InPersonChatHistoryEntry {
  senderId: string;
  text: string;
}

export interface InPersonChatTurnResult {
  ok: boolean;
  actorId: string;
  playerText: string;
  replies: string[];
  history: InPersonChatHistoryEntry[];
  fallback: boolean;
  error?: string;
}

export interface InPersonChatTurnInput {
  engine: ChatEngine;
  actorId: string;
  playerText: string;
  totalMinutes: number;
  day: number;
  sceneContext: string;
  personaSuffix: string;
  tags?: string[];
}

export interface InPersonChatDependencies {
  generateChat?: (
    request: GenerateChatRequest,
    settings: GenerateChatSettings,
  ) => Promise<GenerateChatResult>;
  loadSettings?: () => GenerateChatSettings;
}

interface ActionResultLike {
  success?: boolean;
  error?: string;
}

const DEFAULT_TAGS = ['in-person', 'physical-chat'];

function cleanReplies(result: GenerateChatResult): string[] {
  const generated = result.data.messages
    .map((message) => message.text.trim())
    .filter(Boolean)
    .slice(0, 2);

  // The shared AI service has an intentionally online-flavoured no-key
  // fallback. Physical scenes still call generateChat, but present a neutral
  // face-to-face fallback when no provider is available.
  if (result.meta.fallback) {
    return ['Sorry—lost my train of thought for a second. What were you saying?'];
  }
  return generated.length > 0 ? generated : ['...'];
}

/**
 * Shared physical-conversation turn.
 *
 * This is the same social pipeline as Pulse/Cafe:
 * SOCIAL_SEND_MESSAGE -> ledger -> DM-grade context -> generateChat ->
 * governed social action -> persisted memory. Physical scenes additionally
 * record the NPC reply through SOCIAL_RECEIVE_MESSAGE so canonical
 * SocialEngine history contains both sides of the in-person exchange.
 */
export async function sendInPersonChatTurn(
  input: InPersonChatTurnInput,
  dependencies: InPersonChatDependencies = {},
): Promise<InPersonChatTurnResult> {
  const text = input.playerText.trim();
  const history = () => input.engine.social.getMessages(input.actorId)
    .slice(-12)
    .map((message) => ({ senderId: message.senderId, text: message.text }));

  if (!text) {
    return {
      ok: false,
      actorId: input.actorId,
      playerText: '',
      replies: [],
      history: history(),
      fallback: false,
      error: 'Message is empty.',
    };
  }

  const tags = [...DEFAULT_TAGS, ...(input.tags ?? [])];
  const sendResult = input.engine.dispatchAction({
    type: 'SOCIAL_SEND_MESSAGE',
    buddyId: input.actorId,
    text,
    tags,
  }) as ActionResultLike;

  if (!sendResult?.success) {
    return {
      ok: false,
      actorId: input.actorId,
      playerText: text,
      replies: [],
      history: history(),
      fallback: false,
      error: sendResult?.error ?? 'Message could not be sent.',
    };
  }

  runChatLedger(input.engine, input.actorId, text, input.totalMinutes);

  const slices = readMemorySlices();
  const context = buildDmChatContext({
    engine: input.engine,
    buddyId: input.actorId,
    playerText: text,
    pulse: slices,
    day: input.day,
    totalMinutes: input.totalMinutes,
    sceneContext: input.sceneContext,
    personaSuffix: input.personaSuffix,
  });
  writeMemorySlices({
    conversationMemory: context.preSendPatch.conversationMemory,
    conversationSummaries: context.preSendPatch.conversationSummaries,
    buddyFacts: context.preSendPatch.buddyFacts,
    npcMood: context.preSendPatch.npcMood,
    npcActivity: context.preSendPatch.npcActivity,
  });

  const generateChat = dependencies.generateChat
    ?? ((request, settings) => aiService.generateChat(request, settings));
  const settings = (dependencies.loadSettings ?? loadAISettings)();

  try {
    const generated = await generateChat({
      buddyId: input.actorId,
      displayName: context.displayName,
      handle: context.handle,
      persona: context.persona,
      relationshipSummary: context.relationshipSummary,
      recentMessages: context.recentMessages,
      playerMessage: text,
      worldKnowledge: context.worldKnowledge,
      currentDay: context.currentDay,
    }, settings);

    const replies = cleanReplies(generated);
    honorSocialAction(
      input.engine,
      input.actorId,
      (generated.data as { socialAction?: unknown }).socialAction,
      !generated.meta.fallback,
    );

    replies.forEach((reply, index) => {
      input.engine.dispatchAction({
        type: 'SOCIAL_RECEIVE_MESSAGE',
        buddyId: input.actorId,
        text: reply,
        timestampMinute: input.totalMinutes + index + 1,
        deliveredAway: false,
        tags,
      });
    });

    const fresh = readMemorySlices();
    const mergedReplies = [
      ...(fresh.recentReplies[input.actorId] ?? []),
      ...replies.map((reply) => reply.slice(0, 500)),
    ].slice(-6);
    const summary = buildConversationSummary(
      [
        ...context.recentMessages,
        ...replies.map((reply) => ({ sender: 'buddy', text: reply })),
      ],
      fresh.conversationSummaries[input.actorId] ?? context.updatedSummary,
    );
    writeMemorySlices({
      recentReplies: {
        ...fresh.recentReplies,
        [input.actorId]: mergedReplies,
      },
      conversationSummaries: {
        ...fresh.conversationSummaries,
        [input.actorId]: summary,
      },
    });

    return {
      ok: true,
      actorId: input.actorId,
      playerText: text,
      replies,
      history: history(),
      fallback: generated.meta.fallback,
    };
  } catch (error) {
    return {
      ok: false,
      actorId: input.actorId,
      playerText: text,
      replies: [],
      history: history(),
      fallback: false,
      error: error instanceof Error ? error.message : 'In-person chat failed.',
    };
  }
}

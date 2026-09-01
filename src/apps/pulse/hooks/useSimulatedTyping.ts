import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { soundManager } from '../../../audio/SoundManager';
import { NpcDialogueScript, DialogueChoiceOption } from '../types';
import { DIALOGUE_SCRIPTS } from '../data/dialogueTrees';
import { parseNarrativeTag } from '../../../narrative/tagParser';
import type { GeneratedChatResponse } from '../../../ai/types';
import { getNpcStyle } from '../data/npcStyles';

export interface TypingState {
  isTyping: boolean;
  activeBuddyId: string | null;
  typingIndicatorText: string;
  availableChoices: DialogueChoiceOption[];
  currentScriptId: string | null;
}

export function useSimulatedTyping(_activeConversationBuddyId: string | null) {
  const engine = useSimulationStore((s) => s.engine);

  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: false,
    activeBuddyId: null,
    typingIndicatorText: '',
    availableChoices: [],
    currentScriptId: null,
  });

  const [playerTypingText, setPlayerTypingText] = useState('');
  const [isPlayerTyping, setIsPlayerTyping] = useState(false);

  const activeTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimeouts = () => {
    activeTimeoutRef.current.forEach((t) => clearTimeout(t));
    activeTimeoutRef.current = [];
  };

  const executeTags = useCallback((tags?: string[]) => {
    if (!tags || tags.length === 0) return;
    for (const tagStr of tags) {
      const parsed = parseNarrativeTag(tagStr);
      switch (parsed.type) {
        case 'beat':
          engine.dispatchAction({ type: 'NARRATIVE_TRIGGER_BEAT', beatId: parsed.beatId });
          break;
        case 'effect_flag':
          engine.dispatchAction({ type: 'NARRATIVE_SET_FLAG', key: parsed.key, value: parsed.value });
          break;
        case 'effect_money':
          if (parsed.action === 'earn') {
            engine.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: parsed.amount, reason: parsed.reason });
          } else {
            engine.dispatchAction({ type: 'PLAYER_SPEND_CASH', amount: parsed.amount, reason: parsed.reason });
          }
          break;
        case 'effect_file':
          if (parsed.action === 'create') {
            const parent = parsed.path.substring(0, parsed.path.lastIndexOf('/')) || 'C:/Downloads';
            const name = parsed.path.substring(parsed.path.lastIndexOf('/') + 1) || 'file.dat';
            engine.dispatchAction({
              type: 'VFS_CREATE_FILE',
              file: {
                name,
                path: parsed.path,
                parentPath: parent,
                kind: (parsed.kind || 'text') as any,
                sizeBytes: 1024,
              },
            });
          } else if (parsed.action === 'delete') {
            engine.dispatchAction({ type: 'VFS_DELETE_FILE', path: parsed.path });
          }
          break;
        case 'effect_view':
          engine.dispatchAction({ type: 'VIEW_SWITCH', view: parsed.view });
          break;
        case 'social':
          engine.dispatchAction({ type: 'SOCIAL_APPLY_ACTION', buddyId: parsed.buddyId, socialAction: parsed.action });
          break;
        case 'schedule_appointment':
          engine.dispatchAction({
            type: 'NARRATIVE_SCHEDULE_APPOINTMENT',
            appointment: {
              id: parsed.appointmentId,
              characterId: parsed.characterId || 'maya',
              locationId: parsed.location,
              targetDay: parsed.day,
              startMinute: parsed.startMinute,
              endMinute: parsed.endMinute,
              description: parsed.description,
            },
          });
          break;
        case 'unlock':
          engine.dispatchAction({
            type: 'NARRATIVE_SET_FLAG',
            key: `unlock_${parsed.targetType}_${parsed.targetId}`,
            value: true,
          });
          break;
      }
    }
  }, [engine]);

  const triggerNpcScript = useCallback((script: NpcDialogueScript) => {
    clearTimeouts();
    const buddy = engine.social.getBuddy(script.buddyId);
    const style = getNpcStyle(script.buddyId);
    // Prefer style profile wpm but respect engine's buddy speed if it exists; apply variance for human feel
    const baseWpm = style.typing.wpm ?? buddy?.typingSpeedWpm ?? 60;
    const varianceFactor = 1 + ((Math.random() * 2 - 1) * (style.typing.variance ?? 10) / 100);
    const wpm = Math.max(35, Math.round(baseWpm * varianceFactor));
    const cps = (wpm * 5) / 60;

    let accumulatedDelay = 400;

    script.messages.forEach((msg, idx) => {
      // Apply style pause: Maya is hesitant (longer), Ryan is bursty (shorter)
      const isLongPause = style.buddyId === 'maya' && msg.text.includes('...');
      const hesitationExtra = isLongPause ? 500 : 0;
      const typingDuration = Math.max(800, Math.min(4200, (msg.text.length / cps) * 1000 + hesitationExtra));

      const t1 = setTimeout(() => {
        const indicatorText = (() => {
          if (style.buddyId === 'maya') return 'maya is typing a message...';
          if (style.buddyId === 'nora') return 'NightOwl87 is typing...';
          if (style.buddyId === 'henderson') return `${buddy?.displayName || script.buddyId} is typing...`;
          return `${buddy?.displayName || script.buddyId} is typing a message...`;
        })();
        setTypingState((prev) => ({
          ...prev,
          isTyping: true,
          activeBuddyId: script.buddyId,
          typingIndicatorText: indicatorText,
          currentScriptId: script.id,
        }));
      }, accumulatedDelay);

      const t2 = setTimeout(() => {
        engine.social.sendMessage(
          script.buddyId,
          script.buddyId,
          'player',
          msg.text,
          engine.clock.getTotalMinutes(),
          false,
          msg.tags,
          (msg as any).imageUrl,
          (msg as any).imagePrompt,
          (msg as any).imageCaption
        );
        // If there's an image, also save it to VFS as a small file for the era
        const imageUrl = (msg as any).imageUrl as string | undefined;
        if (imageUrl && imageUrl.startsWith('data:')) {
          try {
            const fileName = `Pulse_${script.buddyId}_${Date.now()}.jpg`;
            // Estimate size from data URL length
            const sizeBytes = Math.ceil((imageUrl.length * 3) / 4);
            engine.dispatchAction({
              type: 'VFS_CREATE_FILE',
              file: {
                name: fileName,
                path: `C:/Pictures/${fileName}`,
                parentPath: 'C:/Pictures',
                kind: 'image',
                sizeBytes: Math.min(sizeBytes, 80 * 1024),
                metadata: { textContent: `Image from ${script.buddyId}: ${(msg as any).imagePrompt || ''}` },
              },
            });
          } catch {}
        } else if (imageUrl && imageUrl.startsWith('http')) {
          // For http URLs (Fal), trigger a download to VFS
          try {
            const fileName = `Pulse_${script.buddyId}_${Date.now()}.jpg`;
            const info = { fileName, totalBytes: 45 * 1024, sourceMaxKbps: 180, fileKind: 'image' as const, downloadUrl: imageUrl, sourceId: `pulse_image_${script.buddyId}`, targetDirectory: 'C:/Pictures' } as any;
            engine.dispatchAction({
              type: 'DOWNLOAD_START',
              sourceId: info.sourceId,
              url: info.downloadUrl,
              fileName: info.fileName,
              totalBytes: info.totalBytes,
              sourceMaxKbps: info.sourceMaxKbps,
              fileKind: 'image',
            });
          } catch {}
        }
        soundManager.play('im_recv');

        if (msg.tags) {
          executeTags(msg.tags);
        }

        const isLastMessage = idx === script.messages.length - 1;
        if (isLastMessage) {
          setTypingState((prev) => ({
            ...prev,
            isTyping: false,
            activeBuddyId: null,
            typingIndicatorText: '',
            availableChoices: script.playerChoices || [],
          }));
        }
      }, accumulatedDelay + typingDuration);

      activeTimeoutRef.current.push(t1, t2);
      accumulatedDelay += typingDuration + 1200;
    });
  }, [engine, executeTags]);

  const triggerGeneratedResponse = useCallback((buddyId: string, response: GeneratedChatResponse) => {
    const socialTags = response.socialAction === 'none' ? undefined : [response.socialAction];
    const topLevelImagePrompt = (response as any).imagePrompt as string | null | undefined;
    const topLevelCaption = (response as any).imageCaption as string | null | undefined;
    const topLevelUrl = (response as any).imageUrl as string | null | undefined;
    triggerNpcScript({
      id: `ai_${buddyId}_${Date.now()}`,
      buddyId,
      messages: response.messages.map((message, index) => {
        const isLast = index === response.messages.length - 1;
        const msgImagePrompt = (message as any).imagePrompt || (isLast ? topLevelImagePrompt : null);
        const msgCaption = (message as any).imageCaption || (isLast ? topLevelCaption : null);
        const msgUrl = (message as any).imageUrl || (isLast ? topLevelUrl : null);
        return {
          text: message.text,
          tags: isLast ? socialTags : undefined,
          imageUrl: msgUrl || undefined,
          imagePrompt: msgImagePrompt || undefined,
          imageCaption: msgCaption || undefined,
        };
      }),
      playerChoices: [],
    });
  }, [triggerNpcScript]);

  const selectPlayerChoice = useCallback((choice: DialogueChoiceOption, buddyId: string) => {
    setIsPlayerTyping(true);
    setPlayerTypingText('');
    setTypingState((prev) => ({ ...prev, availableChoices: [] }));

    let charIndex = 0;
    const fullText = choice.text;
    const typeInterval = setInterval(() => {
      charIndex++;
      setPlayerTypingText(fullText.substring(0, charIndex));

      if (charIndex >= fullText.length) {
        clearInterval(typeInterval);
        setTimeout(() => {
          engine.dispatchAction({
            type: 'SOCIAL_SEND_MESSAGE',
            buddyId,
            text: fullText,
            tags: [choice.socialAction],
          });
          engine.dispatchAction({
            type: 'SOCIAL_APPLY_ACTION',
            buddyId,
            socialAction: choice.socialAction,
          });
          soundManager.play('im_send');
          setIsPlayerTyping(false);
          setPlayerTypingText('');

          if (choice.nextScriptId) {
            const nextScript = DIALOGUE_SCRIPTS.find((s) => s.id === choice.nextScriptId);
            if (nextScript) {
              setTimeout(() => triggerNpcScript(nextScript), 1000);
            }
          }
        }, 250);
      }
    }, 20);
  }, [engine, triggerNpcScript]);

  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  return {
    typingState,
    playerTypingText,
    isPlayerTyping,
    triggerNpcScript,
    triggerGeneratedResponse,
    selectPlayerChoice,
  };
}

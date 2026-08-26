import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { soundManager } from '../../../audio/SoundManager';
import { NpcDialogueScript, DialogueChoiceOption } from '../types';
import { DIALOGUE_SCRIPTS } from '../data/dialogueTrees';
import { parseNarrativeTag } from '../../../narrative/tagParser';

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
    const wpm = buddy?.typingSpeedWpm ?? 60;
    const cps = (wpm * 5) / 60;

    let accumulatedDelay = 400;

    script.messages.forEach((msg, idx) => {
      const typingDuration = Math.max(800, Math.min(3000, (msg.text.length / cps) * 1000));

      const t1 = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isTyping: true,
          activeBuddyId: script.buddyId,
          typingIndicatorText: (buddy?.displayName || script.buddyId) + ' is typing a message...',
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
          msg.tags
        );
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
    selectPlayerChoice,
  };
}

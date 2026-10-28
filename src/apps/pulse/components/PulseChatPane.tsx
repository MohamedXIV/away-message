import React, { useEffect, useRef, useState } from 'react';
import type { SimulationConversationRead } from '../../../engine/kernel/SimulationPublication';
import type { SimulationPulseNarrativeResult } from '../../../simulation/host/SimulationHostProtocol';
import { buddySignatureColor, resolveArchetype } from '../../../engine/characterTemplates';
import type { PulseContactView } from './PulseBuddyList';
import { PulseAvatar, PULSE_STATUS_DOT, PULSE_STATUS_LABEL } from './PulseAvatar';
import { formatSimulationMinutes } from '../utils/timeFormat';
import { isNearTranscriptBottom, shouldFollowLatestMessage } from '../utils/transcriptScroll';

export type PulseNarrativePhase = SimulationPulseNarrativeResult['phase'];

export function pulseConversationStateText(
  phase: PulseNarrativePhase,
  contact: PulseContactView | null,
  sending: boolean,
  replyActivity: SimulationPulseNarrativeResult['replyActivity'] = 'idle',
): string {
  if (sending) return 'Sending your message…';
  const name = contact?.displayName ?? 'They';
  if (phase === 'waiting_first' || phase === 'waiting_second' || phase === 'waiting_outreach') {
    if (contact?.status === 'offline') {
      return `${name} is offline right now. Your message is waiting for them.`;
    }
    if (contact?.status === 'away' || contact?.status === 'busy') {
      return `${name} is ${PULSE_STATUS_LABEL[contact.status].toLowerCase()} right now. They'll reply when they're free.`;
    }
    if (replyActivity === 'typing' && contact?.status === 'online') return `${name} is typing…`;
    return `Waiting for ${name} to reply…`;
  }
  if (phase === 'complete') {
    return `You've caught up with ${name} for today. You can start another conversation tomorrow.`;
  }
  return 'No reply options are available right now.';
}

interface PulseChatPaneProps {
  contact: PulseContactView | null;
  accountName: string;
  page: SimulationConversationRead | null;
  pageOffset: number;
  latestUnread: number;
  loading: boolean;
  choices: Array<{ id: string; text: string }>;
  choicesLoading: boolean;
  phase: PulseNarrativePhase;
  replyActivity?: SimulationPulseNarrativeResult['replyActivity'];
  sending: boolean;
  pendingChoiceIndex: number | null;
  compact: boolean;
  onOlder: () => void;
  onNewer: () => void;
  onNewest: () => void;
  onChoose: (index: number) => void;
  onInspect?: (opener: HTMLElement) => void;
  onLatestVisibilityChange?: (visible: boolean) => void;
  scrollToLatestSignal: number;
  onJumpToLatest: () => void;
}

/** Messenger conversation surface. Canonical transcripts only; the player
 * composes through authored choices, so no fake free-text intent is implied. */
export const PulseChatPane: React.FC<PulseChatPaneProps> = ({
  contact, accountName, page, pageOffset, latestUnread, loading, choices, choicesLoading,
  phase, replyActivity = 'idle', sending, pendingChoiceIndex, compact, onOlder, onNewer, onNewest, onChoose,
  onLatestVisibilityChange, scrollToLatestSignal, onJumpToLatest, onInspect,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousScope = useRef('');
  const previousLatestId = useRef('');
  const [newBelow, setNewBelow] = useState(false);
  const messages = page?.messages ?? [];
  const latestMessage = messages.at(-1);
  const latestId = latestMessage?.id ?? '';
  const latestSenderId = latestMessage?.senderId ?? '';
  const scope = `${contact?.actorId ?? 'none'}:${pageOffset}`;
  const waiting = phase === 'waiting_first' || phase === 'waiting_second' || phase === 'waiting_outreach';
  const startIndex = page ? Math.max(1, page.total - pageOffset - messages.length + 1) : 0;
  const endIndex = page ? Math.max(0, page.total - pageOffset) : 0;
  const showPager = page !== null && (page.total > messages.length || pageOffset > 0);

  const scrollToBottom = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    nearBottom.current = true;
    setNewBelow(false);
    onLatestVisibilityChange?.(true);
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const scopeChanged = previousScope.current !== scope;
    previousScope.current = scope;
    const priorLatestId = previousLatestId.current;
    previousLatestId.current = latestId;

    if (scopeChanged) {
      // A new contact or history page intentionally starts at the newest
      // message of that page, which is the boundary next to the previous one.
      scrollToBottom();
      return;
    }
    const latestChanged = Boolean(latestId) && priorLatestId !== '' && priorLatestId !== latestId;
    if (!latestChanged) return;
    if (shouldFollowLatestMessage({
      pageOffset, latestSenderId, latestChanged, nearBottom: nearBottom.current,
    })) {
      scrollToBottom();
    } else if (pageOffset === 0) {
      setNewBelow(true);
    }
  }, [scope, latestId, latestSenderId, pageOffset]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const near = isNearTranscriptBottom({
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
    });
    if (near !== nearBottom.current) {
      nearBottom.current = near;
      onLatestVisibilityChange?.(near);
    }
    if (near) setNewBelow(false);
    else if (latestUnread > 0) setNewBelow(true);
  };

  useEffect(() => {
    // While the page is frozen, the canonical unread count is the truthful
    // signal that unseen turns are waiting below. Use the synchronous ref:
    // a page refresh may scroll to the bottom before this effect runs.
    if (!nearBottom.current && latestUnread > 0) setNewBelow(true);
  }, [latestUnread]);

  useEffect(() => {
    if (scrollToLatestSignal <= 0) return;
    scrollToBottom();
  }, [scrollToLatestSignal]);

  const jumpToLatest = () => {
    if (pageOffset > 0) {
      setNewBelow(false);
      onNewest();
      return;
    }
    setNewBelow(false);
    scrollToBottom();
    onJumpToLatest();
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || sending) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    if (!/^[1-9]$/.test(event.key)) return;
    const index = Number(event.key) - 1;
    if (choices[index]) {
      event.preventDefault();
      onChoose(index);
    }
  };

  if (!contact) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#fffdf8] p-6 text-center text-[12px] italic text-[#6b5a7a]">
        Choose a buddy to open a conversation.
      </div>
    );
  }

  const signature = buddySignatureColor(contact.actorId, resolveArchetype(contact.actorId, contact.archetype));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#fffdf8]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[#bca8d2] bg-gradient-to-b from-[#f7f1ff] to-[#e7dcf4] px-2 py-1">
        <PulseAvatar actorId={contact.actorId} name={contact.displayName}
          archetype={contact.archetype} status={contact.status} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[12px] font-bold text-[#2f194c]">{contact.displayName}</h3>
            <span className={`h-2 w-2 shrink-0 rounded-full ${PULSE_STATUS_DOT[contact.status]}`} aria-hidden="true" />
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#6d5684]">
              {PULSE_STATUS_LABEL[contact.status]}
            </span>
          </div>
          <p className="truncate text-[10px] text-[#6d5684]">
            @{contact.handle}
            {contact.awayMessage && contact.status !== 'offline' ? ` — “${contact.awayMessage}”` : ''}
          </p>
        </div>
        {onInspect && (
          <button type="button" onClick={event => onInspect(event.currentTarget)}
            aria-label={`View profile for ${contact.displayName}`}
            className="shrink-0 border border-[#9473b4] bg-gradient-to-b from-white to-[#e4d8f0] px-2 py-1 text-[10px] font-bold text-[#4b2d68] shadow-[1px_1px_0_#bba8cc] hover:from-[#fff9e8] hover:to-[#eadcf6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#71479e]">
            Profile
          </button>
        )}
      </header>

      {showPager && (
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-[#ded1ec] bg-[#f4eefb] px-2 py-0.5 text-[10px] text-[#6d5684]">
          <span>
            {loading ? 'Opening conversation…' : !page || page.total === 0
              ? 'No messages yet'
              : `${startIndex}–${endIndex} of ${page.total} messages`}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" disabled={!page || loading || !page.hasOlder} onClick={onOlder}
              className="border border-[#b49dcb] bg-white px-1.5 py-0.5 disabled:opacity-40">← Older</button>
            <button type="button" disabled={loading || pageOffset === 0} onClick={onNewer}
              className="border border-[#b49dcb] bg-white px-1.5 py-0.5 disabled:opacity-40">Newer →</button>
            {pageOffset > 0 && (
              <button type="button" onClick={onNewest} data-testid="worker-pulse-latest"
                className="border border-[#8b6b2d] bg-[#fff6c9] px-1.5 py-0.5 font-bold text-[#5b3a7b]">
                {latestUnread > 0 ? `Latest (${latestUnread} new) ↓` : 'Latest ↓'}
              </button>
            )}
          </span>
        </div>
      )}

      <div className="relative min-h-[84px] flex-1">
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={`Conversation with ${contact.displayName}`}
          data-testid="worker-pulse-messages"
          data-pulse-transcript-style="classic"
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto bg-white px-2 py-2 pb-8 font-sans text-[12px] select-text"
        >
          {loading && messages.length === 0 ? (
            <p className="py-6 text-center italic text-[#6d5684]">Opening conversation…</p>
          ) : messages.length === 0 ? (
            <div className="mx-auto mt-3 max-w-[260px] border border-dashed border-[#c9b7dc] bg-white/70 px-3 py-2 text-center text-[11px] text-[#6b5a7a]">
              <p className="font-bold text-[#4f326e]">Conversation with {contact.displayName}</p>
              <p className="mt-1">{waiting
                ? 'Your message is on its way.'
                : 'Pick a written reply below to say hello.'}</p>
            </div>
          ) : messages.map((message, index) => {
            const player = message.senderId === 'player';
            const previous = messages[index - 1];
            const showDay = !previous || previous.day !== message.day;
            const senderName = player ? accountName : contact.displayName;
            const offline = message.deliveredAway
              || message.tags?.some(tag => /offline/i.test(tag)) === true;
            return (
              <React.Fragment key={message.id}>
                {showDay && (
                  <div className="my-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6d5684]">
                    <span className="h-px flex-1 bg-[#e2d7ee]" aria-hidden="true" />
                    <span>Day {message.day}</span>
                    <span className="h-px flex-1 bg-[#e2d7ee]" aria-hidden="true" />
                  </div>
                )}
                <div data-sender={player ? 'player' : 'buddy'}
                  className={`mb-1 rounded-sm border-l-[3px] py-0.5 pl-1.5 pr-1 leading-relaxed ${
                    offline ? 'border-[#c89f47] bg-[#fff7d9]' : player
                      ? 'border-[#8970ad] bg-[#f5effa]' : 'border-transparent hover:bg-[#f5f1fa]'
                  }`}>
                  <time className="mr-1.5 font-mono text-[10px] text-[#6d5684]"
                    title={`Day ${message.day}`}>
                    ({formatSimulationMinutes(message.timestampMinute % 1440)})
                  </time>
                  {offline && (
                    <span className="mr-1 border border-[#c8a74a] bg-[#fff3c2] px-1 text-[9px] font-bold uppercase tracking-wide text-[#6d5000]">
                      offline
                    </span>
                  )}
                  <span className="mr-1.5 font-bold"
                    style={{ color: player ? '#452765' : signature }}>{senderName}:</span>
                  <span className="whitespace-pre-wrap break-words text-[#2e2438]">{message.text}</span>
                  {message.imageUrl && (
                    <figure className="mt-1.5 ml-4 max-w-[280px]">
                      <img src={message.imageUrl}
                        alt={message.imageCaption || message.imagePrompt || `Photo from ${senderName}`}
                        loading="lazy"
                        className="max-h-48 w-auto border border-[#bca8d2] bg-white object-contain" />
                      {message.imageCaption && (
                        <figcaption className="mt-0.5 text-[10px] italic text-[#6d5684]">{message.imageCaption}</figcaption>
                      )}
                    </figure>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {newBelow && (
          <button type="button" onClick={jumpToLatest} data-testid="worker-pulse-new-messages"
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 border border-[#8b6b2d] bg-[#fff6c9] px-2.5 py-1 text-[10px] font-bold text-[#5b3a7b] shadow-[2px_2px_0_rgba(70,45,95,0.2)] hover:bg-[#fffbe6]">
            New message{latestUnread > 1 ? `s (${latestUnread})` : ''} ↓
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-[#bca8d2] bg-[#ece5f4] p-1"
        data-testid="worker-pulse-composer" aria-busy={sending}>
        {choices.length > 0 ? (
          <div onKeyDown={handleComposerKeyDown} data-testid="worker-pulse-choices"
            aria-label="Written replies" aria-describedby="pulse-reply-help">
            <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-[#5b3a7b]">
              <span>Quick replies</span>
              <span aria-hidden="true" className="font-normal normal-case tracking-normal text-[#6d5684]">Written only · 1–9</span>
            </div>
            <p id="pulse-reply-help" className="sr-only">
              Choose one written reply. Press 1 through 9 to send quickly.
            </p>
            <div className="max-h-32 space-y-1 overflow-y-auto pr-0.5">
              {choices.map((choice, index) => {
                const active = pendingChoiceIndex === index;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={sending}
                    onClick={() => onChoose(index)}
                    aria-label={choice.text}
                    aria-keyshortcuts={String(index + 1)}
                    className={`flex w-full items-start gap-1.5 border px-2 py-1 text-left text-[12px] leading-snug ${
                      active
                        ? 'border-[#6b3d9d] bg-[#fff6d8] text-[#2f194c]'
                        : 'border-[#ac8fca] bg-gradient-to-b from-white to-[#f0e7f9] text-[#342047] hover:from-[#fffdf4] hover:to-[#e4d4f2]'
                    } disabled:opacity-60`}
                  >
                    <span aria-hidden="true"
                      className="mt-px flex h-4 w-4 shrink-0 items-center justify-center border border-[#a78fc2] bg-white text-[10px] font-bold text-[#5b3a7b]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">{choice.text}</span>
                    {active && sending && <span className="shrink-0 text-[10px] italic text-[#6d5684]">sending…</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p role="status" data-testid="worker-pulse-conversation-state"
            data-reply-activity={replyActivity} aria-live="polite"
            className={`border px-2 py-1 text-[11px] ${
              waiting
                ? 'border-[#c8a74a] bg-[#fff8d8] text-[#624900]'
                : 'border-[#bca8d2] bg-white/80 text-[#5b4a6d]'
            }`}>
            <span aria-hidden="true" className={`mr-1 inline-block ${replyActivity === 'typing' ? 'motion-safe:animate-pulse' : ''}`}>
              {replyActivity === 'typing' && contact?.status === 'online' ? '✎' : waiting ? '⌛' : '☕'}
            </span>
            {sending || choicesLoading ? (sending ? 'Sending your message…' : 'Checking what you can say…')
              : pulseConversationStateText(phase, contact, sending, replyActivity)}
          </p>
        )}
      </div>
    </div>
  );
};

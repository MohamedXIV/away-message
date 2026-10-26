import React, { useEffect, useRef } from 'react';
import type { SimulationConversationRead } from '../../../engine/kernel/SimulationPublication';
import type { SimulationPulseNarrativeResult } from '../../../simulation/host/SimulationHostProtocol';
import { buddySignatureColor, resolveArchetype } from '../../../engine/characterTemplates';
import type { PulseContactView } from './PulseBuddyList';
import { PulseAvatar, PULSE_STATUS_DOT, PULSE_STATUS_LABEL } from './PulseAvatar';
import { formatSimulationMinutes } from '../utils/timeFormat';

export type PulseNarrativePhase = SimulationPulseNarrativeResult['phase'];

export function pulseConversationStateText(
  phase: PulseNarrativePhase,
  contact: PulseContactView | null,
  sending: boolean,
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
    return `Waiting for ${name} to reply…`;
  }
  if (phase === 'complete') {
    return `You've caught up with ${name} for today. The thread opens again tomorrow.`;
  }
  return 'Checking what you can say…';
}

function messageDayLabel(day: number): string {
  return `Day ${day}`;
}

interface PulseChatPaneProps {
  contact: PulseContactView | null;
  accountName: string;
  page: SimulationConversationRead | null;
  pageOffset: number;
  loading: boolean;
  choices: Array<{ id: string; text: string }>;
  choicesLoading: boolean;
  phase: PulseNarrativePhase;
  sending: boolean;
  pendingChoiceIndex: number | null;
  onOlder: () => void;
  onNewer: () => void;
  onChoose: (index: number) => void;
}

/** Messenger conversation surface. Canonical transcripts only; the player
 * composes through authored choices, so no fake free-text intent is implied. */
export const PulseChatPane: React.FC<PulseChatPaneProps> = ({
  contact, accountName, page, pageOffset, loading, choices, choicesLoading,
  phase, sending, pendingChoiceIndex, onOlder, onNewer, onChoose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollKey = useRef('');
  const messages = page?.messages ?? [];
  const lastMessageId = messages.at(-1)?.id ?? '';

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const key = `${contact?.actorId ?? 'none'}:${pageOffset}:${messages.length}:${lastMessageId}`;
    if (scrollKey.current === key) return;
    scrollKey.current = key;
    element.scrollTop = element.scrollHeight;
  }, [contact?.actorId, pageOffset, messages.length, lastMessageId]);

  const waiting = phase === 'waiting_first' || phase === 'waiting_second' || phase === 'waiting_outreach';
  const startIndex = page ? Math.max(1, page.total - pageOffset - messages.length + 1) : 0;
  const endIndex = page ? Math.max(0, page.total - pageOffset) : 0;

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
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#fffdf8] p-6 text-center text-[11px] italic text-[#7d6d8d]">
        Choose a buddy to open a conversation.
      </div>
    );
  }

  const signature = buddySignatureColor(contact.actorId, resolveArchetype(contact.actorId, contact.archetype));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#fffdf8]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[#bca8d2] bg-gradient-to-b from-[#f7f1ff] to-[#e7dcf4] px-2 py-1.5">
        <PulseAvatar actorId={contact.actorId} name={contact.displayName}
          archetype={contact.archetype} status={contact.status} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[12px] font-bold text-[#2f194c]">{contact.displayName}</h3>
            <span className={`h-2 w-2 shrink-0 rounded-full ${PULSE_STATUS_DOT[contact.status]}`} aria-hidden="true" />
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-[#6d5684]">
              {PULSE_STATUS_LABEL[contact.status]}
            </span>
          </div>
          <p className="truncate text-[10px] text-[#6d5684]">
            @{contact.handle}
            {contact.awayMessage && contact.status !== 'offline' ? ` — “${contact.awayMessage}”` : ''}
          </p>
        </div>
        <span className="shrink-0 border border-[#b49dcb] bg-[#fff9e8] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#6b4f1d]">
          IM
        </span>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-[#ded1ec] bg-[#f4eefb] px-2 py-0.5 text-[9px] text-[#6d5684]">
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
        </span>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${contact.displayName}`}
        data-testid="worker-pulse-messages"
        className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fffdf8_0%,#fbf7ff_100%)] px-2 py-2 text-[11px]"
      >
        {loading && messages.length === 0 ? (
          <p className="py-6 text-center italic text-[#8b7c9a]">Opening conversation…</p>
        ) : messages.length === 0 ? (
          <div className="mx-auto mt-4 max-w-[260px] border border-dashed border-[#c9b7dc] bg-white/70 px-3 py-3 text-center text-[10px] text-[#7d6d8d]">
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
                <div className="my-2 flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest text-[#9a89aa]">
                  <span className="h-px flex-1 bg-[#e2d7ee]" aria-hidden="true" />
                  <span>{messageDayLabel(message.day)}</span>
                  <span className="h-px flex-1 bg-[#e2d7ee]" aria-hidden="true" />
                </div>
              )}
              <div className={`mb-1.5 flex ${player ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] border px-2 py-1 shadow-[1px_1px_0_rgba(70,45,95,0.12)] ${
                    player
                      ? 'border-[#9a76bf] bg-[#eee3fb]'
                      : 'border-[#d8c7e8] bg-white'
                  }`}
                  data-sender={player ? 'player' : 'buddy'}
                >
                  <div className="mb-0.5 flex flex-wrap items-baseline gap-1 text-[9px]">
                    <span className="font-bold" style={{ color: player ? '#4a2a77' : signature }}>{senderName}</span>
                    <time className="text-[9px] text-[#8b7c9a]" title={`Day ${message.day}`}>
                      ({formatSimulationMinutes(message.timestampMinute % 1440)})
                    </time>
                    {offline && (
                      <span className="border border-[#c8a74a] bg-[#fff3c2] px-1 text-[7px] font-bold uppercase tracking-wide text-[#6d5000]">
                        offline message
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words leading-snug text-[#2e2438]">{message.text}</div>
                  {message.imageUrl && (
                    <figure className="mt-1.5 max-w-[280px]">
                      <img src={message.imageUrl}
                        alt={message.imageCaption || message.imagePrompt || `Photo from ${senderName}`}
                        loading="lazy"
                        className="max-h-48 w-auto border border-[#bca8d2] bg-white object-contain" />
                      {message.imageCaption && (
                        <figcaption className="mt-0.5 text-[9px] italic text-[#6d5684]">{message.imageCaption}</figcaption>
                      )}
                    </figure>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-[#bca8d2] bg-[#ece5f4] p-1.5" data-testid="worker-pulse-composer">
        {choices.length > 0 ? (
          <div onKeyDown={handleComposerKeyDown} data-testid="worker-pulse-choices" aria-label="Written replies">
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wide text-[#5b3a7b]">
              <span>Pick a message</span>
              <span aria-hidden="true" className="font-normal normal-case tracking-normal text-[#8b7c9a]">1–9 selects</span>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
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
                    className={`flex w-full items-start gap-1.5 border px-2 py-1.5 text-left text-[11px] leading-snug ${
                      active
                        ? 'border-[#6b3d9d] bg-[#fff6d8] text-[#2f194c]'
                        : 'border-[#ac8fca] bg-gradient-to-b from-white to-[#f0e7f9] text-[#342047] hover:from-[#fffdf4] hover:to-[#e4d4f2]'
                    } disabled:opacity-60`}
                  >
                    <span aria-hidden="true"
                      className="mt-px flex h-4 w-4 shrink-0 items-center justify-center border border-[#a78fc2] bg-white text-[8px] font-bold text-[#5b3a7b]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">{choice.text}</span>
                    {active && sending && <span className="shrink-0 text-[8px] italic text-[#6d5684]">sending…</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p role="status" data-testid="worker-pulse-conversation-state"
            aria-live="polite"
            className={`border px-2 py-1.5 text-[10px] ${
              waiting
                ? 'border-[#c8a74a] bg-[#fff8d8] text-[#624900]'
                : 'border-[#bca8d2] bg-white/80 text-[#5b4a6d]'
            }`}>
            <span aria-hidden="true" className="mr-1">{waiting ? '⌛' : '☕'}</span>
            {sending || choicesLoading ? (sending ? 'Sending your message…' : 'Checking what you can say…')
              : pulseConversationStateText(phase, contact, sending)}
          </p>
        )}
        <p className="mt-1 text-[8px] leading-tight text-[#857396]">
          Replies are written for this conversation. Free typing needs a connected AI service.
        </p>
      </div>
    </div>
  );
};

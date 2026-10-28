import { useEffect, useRef, type KeyboardEvent } from 'react';
import { PulseAvatar, PULSE_STATUS_DOT, PULSE_STATUS_LABEL } from './PulseAvatar';
import { formatPulseLastMessage, type PulseContactView } from './PulseBuddyList';

interface PulseContactProfileProps {
  contact: PulseContactView;
  onClose: () => void;
}

/** Public contact card, scoped to a learned buddy of the signed-in identity.
 * Never exposes hidden relationship stages, memories or private knowledge. */
export function PulseContactProfile({ contact, onClose }: PulseContactProfileProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const statusLabel = PULSE_STATUS_LABEL[contact.status];
  const lastMessage = formatPulseLastMessage(contact.lastMessageMinute) || 'No messages yet';
  const awayMessage = contact.status === 'offline'
    ? 'Not available while offline'
    : contact.awayMessage || 'No away message set';

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      // The close button is the only action; never tab into the covered IM.
      event.preventDefault();
      closeRef.current?.focus();
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#271438]/60 p-2">
      <div role="dialog" aria-modal="true" aria-label="Buddy profile"
        onKeyDown={handleKeys} data-testid="worker-pulse-profile"
        className="flex max-h-full w-full max-w-[350px] flex-col overflow-hidden border-2 border-[#4d286f] bg-[#f6f1fa] text-[#302044] shadow-[5px_5px_0_rgba(21,8,34,0.4)]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#3d1e5a] bg-gradient-to-b from-[#8959ba] to-[#532881] px-2 py-1.5 text-white">
          <span className="text-[12px] font-bold tracking-wide">Pulse Buddy Profile</span>
          <button ref={closeRef} type="button" onClick={onClose}
            aria-label="Close buddy profile"
            className="flex h-5 w-5 shrink-0 items-center justify-center border border-white/75 bg-white/15 text-[12px] font-bold hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ffd44f]">
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">
          <div className="flex items-center gap-3 border-b border-[#c3b3d5] bg-gradient-to-b from-[#fffdf7] to-[#ede4f6] p-3">
            <PulseAvatar actorId={contact.actorId} name={contact.displayName}
              archetype={contact.archetype} status={contact.status} size="lg" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-bold text-[#35204c]">{contact.displayName}</h3>
              <p className="truncate text-[11px] text-[#6d5684]">@{contact.handle}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-[#534067]">
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${PULSE_STATUS_DOT[contact.status]}`} />
                {statusLabel}
              </p>
            </div>
          </div>
          <div className="m-2 border border-[#bca6d1] bg-white shadow-[inset_1px_1px_0_#ece4f4]">
            <div className="border-b border-[#d5c6e2] bg-[#e9e0f2] px-2 py-1 text-[10px] font-bold text-[#4c2a68]">
              Contact Card
            </div>
            <dl className="space-y-2 p-2 text-[11px]">
              <div>
                <dt className="font-bold text-[#59416f]">Pulse ID</dt>
                <dd className="break-all text-[#302044]">@{contact.handle}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#59416f]">Current status</dt>
                <dd className="text-[#302044]">{statusLabel}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#59416f]">Away message</dt>
                <dd className="whitespace-pre-wrap break-words italic text-[#51415f]">{awayMessage}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#59416f]">Last IM</dt>
                <dd className="text-[#51415f]">{lastMessage}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-[#bca6d1] bg-[#e9e0f2] px-2 py-1 text-[10px] text-[#5b466e]">
          <span>Pulse Messenger · 2005</span>
          <span>Buddy info</span>
        </div>
      </div>
    </div>
  );
}

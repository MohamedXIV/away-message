import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { PulseContactView } from './PulseBuddyList';

interface PulseAddBuddyDialogProps {
  accountName: string;
  candidates: ReadonlyArray<{ actorId: string; displayName: string; handle: string }>;
  contacts: ReadonlyArray<PulseContactView>;
  submitting: boolean;
  onAdd: (actorId: string) => Promise<void>;
  onClose: () => void;
}

/** Classic add-by-ID dialog. The suggestions come only from Worker-published,
 * already learned handles; this UI never searches the hidden Social roster. */
export function PulseAddBuddyDialog({
  accountName, candidates, contacts, submitting, onAdd, onClose,
}: PulseAddBuddyDialogProps) {
  const [typedId, setTypedId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionListId = useId();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const dismiss = () => { if (!submitting) onClose(); };

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    } else if (event.key === 'Tab') {
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const handle = typedId.trim().replace(/^@/, '').toLowerCase();
    if (!handle) {
      setError('Enter a Pulse ID.');
      return;
    }
    if (contacts.some(contact => contact.handle.toLowerCase() === handle)) {
      setError('That Pulse ID is already on your Buddy List.');
      return;
    }
    const candidate = candidates.find(row => row.handle.toLowerCase() === handle);
    if (!candidate) {
      setError("That Pulse ID is not among the handles you've learned. Meet the person first.");
      return;
    }
    setError(null);
    void onAdd(candidate.actorId).catch(cause => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#271438]/65 p-2">
      <div role="dialog" aria-modal="true" aria-label="Add a buddy"
        onKeyDown={handleKeys} data-testid="worker-pulse-add-buddy-dialog"
        className="flex max-h-full w-full max-w-[370px] flex-col overflow-hidden border-2 border-[#4d286f] bg-[#f6f1fa] text-[#302044] shadow-[5px_5px_0_rgba(21,8,34,0.4)]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#3d1e5a] bg-gradient-to-b from-[#8959ba] to-[#532881] px-2 py-1.5 text-white">
          <span className="text-[12px] font-bold tracking-wide">Add a Buddy</span>
          <button type="button" onClick={dismiss} disabled={submitting}
            aria-label="Close add buddy"
            className="flex h-5 w-5 shrink-0 items-center justify-center border border-white/75 bg-white/15 text-[12px] font-bold hover:bg-white/30 disabled:opacity-50">×</button>
        </div>
        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="border-b border-[#d7c7e6] bg-[#fffdf7] px-3 py-2 text-[11px]">
            <p className="font-bold text-[#4f326e]">Add by Pulse ID</p>
            <p className="mt-1 leading-relaxed text-[#645272]">
              Enter a handle you've learned in the world. This Buddy List belongs only to {'@' + accountName}.
            </p>
          </div>
          <div className="space-y-2 px-3 py-3">
            <label htmlFor={suggestionListId + '-input'} className="block text-[11px] font-bold text-[#4f326e]">
              Buddy's Pulse ID
            </label>
            <input ref={inputRef} name="buddyPulseId" id={suggestionListId + '-input'}
              type="text" autoComplete="off" spellCheck={false} maxLength={64}
              list={suggestionListId} value={typedId}
              onChange={event => { setTypedId(event.target.value); setError(null); }}
              placeholder="@their_handle"
              className="w-full border border-[#9473b4] bg-white px-2 py-1.5 font-pixel text-[12px] text-[#302044] shadow-[inset_1px_1px_2px_rgba(55,30,80,0.15)] outline-none focus:border-[#5b2d8f]" />
            <datalist id={suggestionListId}>
              {candidates.map(row => (
                <option key={row.actorId} value={row.handle} label={row.displayName} />
              ))}
            </datalist>
            {candidates.length === 0 && (
              <p className="text-[10px] italic text-[#68557a]">
                No new handles learned yet. Meet someone before adding their Pulse ID.
              </p>
            )}
            {error && (
              <p role="alert" className="border border-[#cb9c9c] bg-[#fff0ef] px-2 py-1 text-[11px] text-[#893535]">
                {error}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#c9b7dc] bg-[#e9e0f2] px-3 py-2">
            <button type="button" onClick={dismiss} disabled={submitting}
              className="border border-[#957cac] bg-white px-3 py-1 text-[11px] text-[#493262] hover:bg-[#f7efff] disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="border border-[#5c347f] bg-gradient-to-b from-[#fff4c7] to-[#e6d49b] px-3 py-1 text-[11px] font-bold text-[#40265f] shadow-[1px_1px_0_#b4a3c4] hover:from-[#fff9dc] disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Buddy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

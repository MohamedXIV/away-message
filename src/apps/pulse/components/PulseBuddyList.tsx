import React, { useMemo, useState } from 'react';
import type { BuddyCharacter, BuddyPresence, BuddyPresenceStatus } from '../../../engine/types';
import type { SimulationMessengerRead } from '../../../engine/kernel/SimulationPublication';
import { PulseAvatar, PULSE_STATUS_DOT, PULSE_STATUS_LABEL } from './PulseAvatar';
import { formatSimulationMinutes } from '../utils/timeFormat';

export interface PulseContactView {
  actorId: string;
  displayName: string;
  handle: string;
  archetype?: BuddyCharacter['archetype'];
  status: BuddyPresenceStatus;
  awayMessage: string;
  unread: number;
  lastMessageMinute: number | null;
}

const presenceRank: Record<BuddyPresenceStatus, number> = {
  online: 0, away: 1, busy: 2, offline: 3,
};

/** Canonical messenger rows plus Social presence, never a React-owned roster. */
export function buildPulseContactViews(
  contacts: SimulationMessengerRead['contacts'],
  presence: Record<string, Pick<BuddyPresence, 'status' | 'awayMessage'>>,
): PulseContactView[] {
  return contacts
    .map((row) => {
      const current = presence[row.actorId];
      return {
        actorId: row.actorId,
        displayName: row.displayName,
        handle: row.handle,
        archetype: row.archetype,
        status: current?.status ?? row.onlineStatus,
        awayMessage: current?.awayMessage ?? '',
        unread: row.unread,
        lastMessageMinute: row.lastMessageMinute,
      };
    })
    .sort((a, b) => presenceRank[a.status] - presenceRank[b.status]
      || b.unread - a.unread
      || a.displayName.localeCompare(b.displayName));
}

export function partitionPulseContacts(contacts: readonly PulseContactView[]): {
  online: PulseContactView[];
  offline: PulseContactView[];
} {
  return {
    online: contacts.filter(contact => contact.status !== 'offline'),
    offline: contacts.filter(contact => contact.status === 'offline'),
  };
}

/** Last canonical message time, not an invented "last seen" presence claim. */
export function formatPulseLastMessage(minute: number | null): string {
  if (minute === null || !Number.isFinite(minute) || minute < 0) return '';
  const day = Math.floor(minute / 1440) + 1;
  return `Last message Day ${day}, ${formatSimulationMinutes(minute % 1440)}`;
}

export function pulsePresenceLine(contact: PulseContactView): string {
  if (contact.status === 'offline') {
    return formatPulseLastMessage(contact.lastMessageMinute) || 'Offline';
  }
  const label = PULSE_STATUS_LABEL[contact.status];
  return contact.awayMessage ? `${label} — “${contact.awayMessage}”` : label;
}

interface PulseContactRowProps {
  contact: PulseContactView;
  selected: boolean;
  onSelect: (actorId: string) => void;
}

const PulseContactRow: React.FC<PulseContactRowProps> = ({ contact, selected, onSelect }) => {
  const statusLabel = PULSE_STATUS_LABEL[contact.status];
  const presence = pulsePresenceLine(contact);
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.actorId)}
      aria-pressed={selected}
      aria-label={`${contact.displayName}, ${statusLabel}${contact.awayMessage ? `, ${contact.awayMessage}` : ''}${contact.unread > 0 ? `, ${contact.unread} unread` : ''}`}
      data-testid={`worker-pulse-contact-${contact.actorId}`}
      className={`group flex w-full items-center gap-2 border-b border-[#e3d8ef] px-2 py-1.5 text-left last:border-b-0 ${
        selected
          ? 'bg-[#dcd0ef] text-[#2c1742] shadow-[inset_0_0_0_1px_#8a68ad]'
          : 'hover:bg-[#f2ecf9] focus-visible:bg-[#f2ecf9]'
      }`}
    >
      <PulseAvatar actorId={contact.actorId} name={contact.displayName}
        archetype={contact.archetype} status={contact.status} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-bold text-[#3c2360]">{contact.displayName}</span>
          {contact.status !== 'online' && (
            <span className={`shrink-0 rounded-sm border border-black/10 px-1 text-[8px] font-bold uppercase tracking-wide ${
              contact.status === 'offline' ? 'bg-[#e5e0ea] text-[#6f647c]' : 'bg-[#fff4c4] text-[#725600]'
            }`}>{statusLabel}</span>
          )}
          {contact.unread > 0 && (
            <span className="ml-auto shrink-0 rounded-full border border-[#8d2f1f] bg-[#d84a32] px-1.5 text-[9px] font-bold leading-4 text-white">
              {contact.unread > 99 ? '99+' : contact.unread}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[9px] text-[#79688a]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PULSE_STATUS_DOT[contact.status]}`} aria-hidden="true" />
          <span className="truncate italic">{presence}</span>
        </span>
      </span>
    </button>
  );
};

interface PulseBuddyGroupProps {
  title: string;
  contacts: PulseContactView[];
  selectedId: string | null;
  onSelect: (actorId: string) => void;
  defaultExpanded?: boolean;
  emptyLabel: string;
}

const PulseBuddyGroup: React.FC<PulseBuddyGroupProps> = ({
  title, contacts, selectedId, onSelect, defaultExpanded = true, emptyLabel,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <section aria-label={title} className="select-none">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(current => !current)}
        className="flex w-full items-center gap-1 border-y border-[#c9b7dc] bg-[#e7def2] px-2 py-1 text-left text-[9px] font-bold uppercase tracking-wider text-[#5b3a7b] hover:bg-[#ded1ec]"
      >
        <span aria-hidden="true" className="text-[8px]">{expanded ? '▼' : '►'}</span>
        <span>{title} ({contacts.length})</span>
      </button>
      {expanded && (
        contacts.length > 0
          ? <div>{contacts.map(contact => (
              <PulseContactRow key={contact.actorId} contact={contact}
                selected={selectedId === contact.actorId} onSelect={onSelect} />
            ))}</div>
          : <p className="px-3 py-2 text-[10px] italic text-[#8b7c9a]">{emptyLabel}</p>
      )}
    </section>
  );
};

interface PulseBuddyListProps {
  contacts: PulseContactView[];
  selectedId: string | null;
  onSelect: (actorId: string) => void;
}

/** Full buddy list: shared by the wide split pane and the compact drawer. */
export const PulseBuddyList: React.FC<PulseBuddyListProps> = ({
  contacts, selectedId, onSelect,
}) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(contact =>
      contact.displayName.toLowerCase().includes(needle)
      || contact.handle.toLowerCase().includes(needle));
  }, [contacts, search]);
  const { online, offline } = partitionPulseContacts(filtered);
  const onlineCount = partitionPulseContacts(contacts).online.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbf8ff]" data-testid="worker-pulse-contacts">
      <div className="border-b border-[#bca8d2] bg-[#f1ebf8] p-1.5">
        <label className="sr-only" htmlFor="pulse-buddy-search">Search contacts</label>
        <input
          id="pulse-buddy-search"
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search buddies…"
          className="w-full border border-[#a78fc2] bg-white px-2 py-1 font-sans text-[11px] text-[#332247] shadow-[inset_1px_1px_2px_rgba(55,30,80,0.12)] outline-none focus:border-[#5b2d8f]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="p-4 text-center text-[10px] text-[#7d6d8d]">
            <p className="font-bold text-[#4f326e]">No buddies yet</p>
            <p className="mt-1">Meet people around town to add them to Pulse.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-center text-[10px] italic text-[#7d6d8d]">No buddies match “{search.trim()}”.</p>
        ) : (
          <>
            <PulseBuddyGroup title="Online" contacts={online} selectedId={selectedId}
              onSelect={onSelect} emptyLabel="Everyone is offline right now." />
            <PulseBuddyGroup title="Offline" contacts={offline} selectedId={selectedId}
              onSelect={onSelect} emptyLabel="No offline buddies." />
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[#bca8d2] bg-[#ece5f4] px-2 py-1 text-[9px] text-[#6a5680]">
        <span>{onlineCount} online · {contacts.length} contacts</span>
        <span>Pulse 5.2</span>
      </div>
    </div>
  );
};

interface PulseContactRailProps {
  contacts: PulseContactView[];
  selectedId: string | null;
  onSelect: (actorId: string) => void;
  onOpenList: () => void;
}

/** Compact windows keep presence visible without hiding the conversation. */
export const PulseContactRail: React.FC<PulseContactRailProps> = ({
  contacts, selectedId, onSelect, onOpenList,
}) => {
  return (
    <div className="flex shrink-0 items-stretch gap-1 overflow-x-auto border-b border-[#bca8d2] bg-[#f1ebf8] px-1 py-1"
      data-testid="worker-pulse-contact-rail">
      {contacts.length === 0 ? (
        <p className="px-2 py-1 text-[10px] italic text-[#7d6d8d]">No buddies yet.</p>
      ) : contacts.map(contact => {
        const selected = contact.actorId === selectedId;
        return (
          <button
            key={contact.actorId}
            type="button"
            onClick={() => onSelect(contact.actorId)}
            aria-pressed={selected}
            aria-label={`${contact.displayName}, ${PULSE_STATUS_LABEL[contact.status]}${contact.unread > 0 ? `, ${contact.unread} unread` : ''}`}
            className={`relative flex min-w-[58px] max-w-[78px] shrink-0 flex-col items-center gap-0.5 border px-1 py-1 text-center ${
              selected ? 'border-[#77549b] bg-white shadow-[inset_0_0_0_1px_#d9c9ec]' : 'border-transparent hover:border-[#c7b6da] hover:bg-white/60'
            }`}
          >
            <PulseAvatar actorId={contact.actorId} name={contact.displayName}
              archetype={contact.archetype} status={contact.status} size="sm" />
            <span className="w-full truncate text-[9px] font-bold text-[#3c2360]">{contact.displayName}</span>
            {contact.status !== 'online' && (
              <span className="text-[8px] uppercase text-[#756487]">{PULSE_STATUS_LABEL[contact.status]}</span>
            )}
            {contact.unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full border border-[#8d2f1f] bg-[#d84a32] px-1 text-[8px] font-bold leading-3 text-white">
                {contact.unread > 9 ? '9+' : contact.unread}
              </span>
            )}
          </button>
        );
      })}
      <button type="button" onClick={onOpenList}
        className="ml-auto flex min-w-[46px] shrink-0 flex-col items-center justify-center border border-[#b49dcb] bg-[#fff9e8] px-1 text-[8px] font-bold leading-tight text-[#5b3a7b] hover:bg-white">
        <span aria-hidden="true" className="text-sm">☰</span>
        All
      </button>
    </div>
  );
};

import React from 'react';
import type { BuddyCharacter, BuddyPresenceStatus } from '../../../engine/types';
import { buddySignatureColor, resolveArchetype } from '../../../engine/characterTemplates';

const SIZES = {
  sm: { box: 24, text: 'text-[10px]', dot: 'h-2 w-2', offset: '-bottom-0.5 -right-0.5' },
  md: { box: 32, text: 'text-[11px]', dot: 'h-2.5 w-2.5', offset: '-bottom-0.5 -right-0.5' },
  lg: { box: 40, text: 'text-sm', dot: 'h-3 w-3', offset: '-bottom-0.5 -right-0.5' },
} as const;

export const PULSE_STATUS_LABEL: Record<BuddyPresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
};

export const PULSE_STATUS_DOT: Record<BuddyPresenceStatus, string> = {
  online: 'bg-[#35a853]',
  away: 'bg-[#e0a800]',
  busy: 'bg-[#c43b2f]',
  offline: 'bg-[#8b8b8b]',
};

/** Two-character monogram so every generated actor has a stable, readable icon. */
export function pulseInitials(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

interface PulseAvatarProps {
  actorId: string;
  name: string;
  archetype?: BuddyCharacter['archetype'];
  status?: BuddyPresenceStatus;
  size?: keyof typeof SIZES;
  /** Display name is included in the accessible label unless the avatar is decorative. */
  showStatusLabel?: boolean;
}

/**
 * Presentation-only buddy icon. Signature colors already exist in authored
 * character content; no portrait asset or new identity model is invented here.
 */
export const PulseAvatar: React.FC<PulseAvatarProps> = ({
  actorId,
  name,
  archetype,
  status,
  size = 'md',
  showStatusLabel = false,
}) => {
  const metrics = SIZES[size];
  const color = buddySignatureColor(actorId, resolveArchetype(actorId, archetype));
  const label = showStatusLabel && status
    ? `${name}, ${PULSE_STATUS_LABEL[status]}`
    : undefined;
  return (
    <span
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="relative inline-flex shrink-0 items-center justify-center border border-[#4a2a66] font-bold text-white shadow-[inset_1px_1px_0_rgba(255,255,255,0.45),1px_1px_0_rgba(0,0,0,0.28)]"
      style={{ width: metrics.box, height: metrics.box, backgroundColor: color }}
    >
      <span className={metrics.text}>{pulseInitials(name)}</span>
      {status && (
        <span
          className={`absolute ${metrics.offset} ${metrics.dot} rounded-full border border-white ${PULSE_STATUS_DOT[status]}`}
          title={PULSE_STATUS_LABEL[status]}
        />
      )}
    </span>
  );
};

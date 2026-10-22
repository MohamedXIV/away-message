import React from 'react';
import type { SurfaceProvenance } from '../../narrative/fakeNet/contracts';

const BADGES: Record<SurfaceProvenance, { label: string; className: string; title: string }> = {
  canonical_fact: {
    label: 'canonical',
    className: 'border-emerald-500 bg-emerald-950 text-emerald-300',
    title: 'Checked against a canonical game-world fact.',
  },
  rumor: {
    label: 'rumor',
    className: 'border-amber-500 bg-amber-950 text-amber-300',
    title: 'Repeated by someone. Not confirmed world truth.',
  },
  claim: {
    label: 'claim',
    className: 'border-amber-500 bg-amber-950 text-amber-300',
    title: 'A claim from this surface. Not confirmed world truth.',
  },
  opinion: {
    label: 'opinion',
    className: 'border-sky-500 bg-sky-950 text-sky-300',
    title: 'A personal opinion. Not a world fact.',
  },
  lie: {
    label: 'roleplay / lie',
    className: 'border-rose-500 bg-rose-950 text-rose-300',
    title: 'Authored unreliability or roleplay. Not canonical.',
  },
  unknown: {
    label: 'unverified',
    className: 'border-gray-500 bg-gray-900 text-gray-300',
    title: 'Unknown or unverified. Not canonical.',
  },
};

export const SurfaceProvenanceBadge: React.FC<{ provenance: SurfaceProvenance }> = ({ provenance }) => {
  const badge = BADGES[provenance];
  return (
    <span
      title={badge.title}
      className={`inline-block border px-1 py-0 text-[9px] uppercase tracking-wide ${badge.className}`}
    >
      {badge.label}
    </span>
  );
};

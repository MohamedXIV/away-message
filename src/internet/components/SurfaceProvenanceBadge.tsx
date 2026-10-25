import React from 'react';
import type { SurfaceProvenance } from '../../narrative/fakeNet/contracts';

const BADGES: Record<SurfaceProvenance, { label: string; className: string; title: string }> = {
  canonical_fact: {
    label: 'reported',
    className: 'border-emerald-500 bg-emerald-950 text-emerald-300',
    title: 'Reported in town records.',
  },
  rumor: {
    label: 'rumor',
    className: 'border-amber-500 bg-amber-950 text-amber-300',
    title: 'Passed along by other people. Details are unconfirmed.',
  },
  claim: {
    label: 'claim',
    className: 'border-amber-500 bg-amber-950 text-amber-300',
    title: 'A statement from this poster. Check other sources.',
  },
  opinion: {
    label: 'opinion',
    className: 'border-sky-500 bg-sky-950 text-sky-300',
    title: 'The poster’s personal opinion.',
  },
  lie: {
    label: 'disputed',
    className: 'border-rose-500 bg-rose-950 text-rose-300',
    title: 'Other people dispute this account.',
  },
  unknown: {
    label: 'unverified',
    className: 'border-gray-500 bg-gray-900 text-gray-300',
    title: 'No reliable source has confirmed this.',
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

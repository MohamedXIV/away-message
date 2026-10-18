// src/world/phaser/layeredRoom/artTreatments.ts
//
// Issue #159 — Phase A runtime art-direction comparison.
//
// A "treatment" is a complete authored visual language for the same
// canonical room: identical Place/Space/View/Anchor/prop semantics,
// identical geometry, different production art. This module is the only
// piece of the runtime that knows the convention; everything downstream
// (asset load plan, structure signature, WorldScene) stays generic.
//
// Convention (docs/verification/issue-159-art-direction/):
//   base asset id            → blockout / shared spatial reference
//   `${base}_${treatment}`  → that treatment's authored variant, when the
//                              content store carries a production-tagged
//                              image row under that id.
// Resolution never invents art: an unauthored variant falls back to the
// base row, so a partially produced treatment set still renders, and an
// unknown treatment id resolves to the blockout rather than borrowing
// another treatment's visuals.

import { GENERATED_ASSETS } from '../../../engine/worldContent.generated';

/** Treatment ids are short snake_case suffixes usable inside asset ids. */
export const ART_TREATMENT_IDS = ['sr', 'gn'] as const;
export type ArtTreatmentId = (typeof ART_TREATMENT_IDS)[number];

/** The authored blockout/shared-reference baseline: no suffix. */
export const BLOCKOUT_TREATMENT = 'blockout';
export type ArtTreatment = typeof BLOCKOUT_TREATMENT | ArtTreatmentId;

export function isArtTreatment(value: unknown): value is ArtTreatment {
  return value === BLOCKOUT_TREATMENT
    || ART_TREATMENT_IDS.some((id) => id === value);
}

export interface TreatmentVariantDef {
  id: ArtTreatment;
  /** Human label for the QA selector and evidence payloads. */
  label: string;
  /** One-line visual language, for status payloads and screenshots. */
  summary: string;
  /**
   * Honest-production marker: set when part of this treatment's layer set is
   * a deterministic paint-over draft rather than a finished Gen-AI pass. The
   * QA selector surfaces it so nobody mistakes a draft for production art.
   */
  draftNote?: string;
}

/** The compared treatments, in review order. Blockout stays first. */
export const ART_TREATMENTS: readonly TreatmentVariantDef[] = [
  {
    id: BLOCKOUT_TREATMENT,
    label: 'Blockout',
    summary: 'shared spatial reference: flat shape/color layers, locked composition',
  },
  {
    id: 'sr',
    label: 'Stylized Realism',
    summary: 'Western stylized realism: believable 2005 materials, controlled simplification',
  },
  {
    id: 'gn',
    label: 'Graphic Novel',
    summary: 'painterly western graphic novel: ink lines, posterized light, moody palette',
    draftNote: 'draft: bed layer is generated art; the rest is deterministic paint-over',
  },
] as const;

/**
 * Resolves one authored asset id through a treatment. Returns the variant
 * id only when the generated catalog carries it as a loadable production
 * image; otherwise the base id (which may itself be the blockout). Pure
 * over the generated registry, so unit tests need no Phaser or DOM.
 */
export function resolveTreatmentAssetId(
  baseAssetId: string,
  treatment: ArtTreatment,
  assets: readonly { id: string; kind: string; tags: string[] }[] = GENERATED_ASSETS,
): string {
  if (treatment === BLOCKOUT_TREATMENT) return baseAssetId;
  const variantId = `${baseAssetId}_${treatment}`;
  const variant = assets.find((asset) => asset.id === variantId);
  if (
    variant
    && variant.kind === 'image'
    && variant.tags.includes('production')
  ) {
    return variantId;
  }
  return baseAssetId;
}

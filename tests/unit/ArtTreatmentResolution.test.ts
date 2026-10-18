// tests/unit/ArtTreatmentResolution.test.ts
//
// Issue #159 — the treatment convention is a content-catalog resolution,
// never an invented visual. These tests pin the contract the runtime relies
// on: a variant wins only when the generated catalog carries it as a
// production image, everything else falls back to the authored base row, and
// the blockout treatment is the identity.

import { describe, expect, it } from 'vitest';
import {
  ART_TREATMENTS,
  BLOCKOUT_TREATMENT,
  isArtTreatment,
  resolveTreatmentAssetId,
} from '../../src/world/phaser/layeredRoom/artTreatments';
import { GENERATED_ASSETS } from '../../src/engine/worldContent.generated';

const catalog = GENERATED_ASSETS as unknown as {
  id: string;
  kind: string;
  tags: string[];
  uri: string;
  normalMapAssetId: string;
}[];

const assetRow = (id: string) => catalog.find((asset) => asset.id === id);

describe('treatment registry', () => {
  it('lists blockout first, then the authored comparison treatments', () => {
    expect(ART_TREATMENTS.map((variant) => variant.id)).toEqual([BLOCKOUT_TREATMENT, 'sr', 'gn']);
    expect(isArtTreatment('sr')).toBe(true);
    expect(isArtTreatment('gn')).toBe(true);
    expect(isArtTreatment(BLOCKOUT_TREATMENT)).toBe(true);
    expect(isArtTreatment('anime')).toBe(false);
    expect(isArtTreatment(undefined)).toBe(false);
  });

  it('labels any treatment whose layer set still contains drafts', () => {
    const draft = ART_TREATMENTS.filter((variant) => variant.draftNote).map((variant) => variant.id);
    // The #159 batch ran out of Gen-AI quota mid-set: sr is fully generated,
    // gn is a real generated bed plus deterministic paint-over drafts. If a
    // later batch finishes gn, this assertion must be updated with it —
    // silently shipping an unlabeled draft is the failure mode this guards.
    expect(draft).toEqual(['gn']);
  });
});

describe('resolveTreatmentAssetId', () => {
  it('is the identity for the blockout treatment', () => {
    expect(resolveTreatmentAssetId('spike_desk', BLOCKOUT_TREATMENT)).toBe('spike_desk');
  });

  it('resolves an authored variant over its base row', () => {
    expect(resolveTreatmentAssetId('spike_desk', 'sr')).toBe('spike_desk_sr');
    const variant = assetRow('spike_desk_sr');
    expect(variant?.kind).toBe('image');
    expect(variant?.tags).toContain('production');
    // The variant inherits its base layer tags so any tag-driven runtime
    // behavior keeps working through a treatment switch.
    expect(variant?.tags).toContain('layer-fixture');
    expect(variant?.tags).toContain('sr');
  });

  it('falls back to the base row when the variant is unauthored', () => {
    // spike_bed_b has no gn row in this batch (quota), so the blockout bed
    // shows instead of borrowing another treatment's art or crashing.
    expect(assetRow('spike_bed_b_gn')).toBeUndefined();
    expect(resolveTreatmentAssetId('spike_bed_b', 'gn')).toBe('spike_bed_b');
  });

  it('never resolves a non-image or non-production variant', () => {
    const fake = [
      { id: 'base_sr', kind: 'audio', tags: ['production', 'sr'] },
      { id: 'other_sr', kind: 'image', tags: ['sr'] },
    ];
    expect(resolveTreatmentAssetId('base', 'sr', fake)).toBe('base');
    expect(resolveTreatmentAssetId('other', 'sr', fake)).toBe('other');
  });

  it('resolves the architecture variant with its own linked normal map', () => {
    expect(resolveTreatmentAssetId('spike_architecture', 'sr')).toBe('spike_architecture_sr');
    const row = assetRow('spike_architecture_sr');
    expect(row?.normalMapAssetId).toBe('spike_architecture_sr_n');
    const normal = assetRow('spike_architecture_sr_n');
    expect(normal?.kind).toBe('image');
    expect(normal?.tags).toContain('production');
    expect(normal?.tags).toContain('normal');
    expect(row?.uri).toBe('assets/world/starter-spike/sr/spike_architecture_sr.png');
  });

  it('keeps every authored variant URI inside the spike asset folder', () => {
    for (const asset of catalog) {
      if (!/_sr$|_gn$|_sr_n$|_gn_n$/.test(asset.id)) continue;
      expect(asset.uri).toMatch(/^assets\/world\/starter-spike\/(sr|gn)\//);
    }
  });
});

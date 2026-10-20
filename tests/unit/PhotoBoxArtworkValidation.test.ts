import { describe, expect, it } from 'vitest';
import { DEFAULT_PHOTOBOX_FILTERS, makePhotoBoxSvg, verifiedPhotoBoxSvg } from
  '../../src/engine/PhotoBoxArtwork';
describe('PhotoBox artwork authenticity', () => {
  it('accepts exactly the authored self-contained artwork including valid adjustments', () => {
    const f = { ...DEFAULT_PHOTOBOX_FILTERS, brightness: 143, sepia: 35, blur: 2 };
    const svg = makePhotoBoxSvg('diner', f);
    expect(verifiedPhotoBoxSvg(svg)).toBe(svg);
  });
  it('rejects malicious lookalikes, appended scripts and out-of-range filters', () => {
    const svg = makePhotoBoxSvg('motel', { ...DEFAULT_PHOTOBOX_FILTERS });
    expect(verifiedPhotoBoxSvg(svg + '<script>alert(1)</script>')).toBeNull();
    expect(verifiedPhotoBoxSvg(svg.replace('STARLITE', '<script>alert(1)</script>'))).toBeNull();
    expect(verifiedPhotoBoxSvg(svg.replace('brightness(100%)', 'brightness(999%)'))).toBeNull();
    expect(verifiedPhotoBoxSvg('<svg xmlns="http://www.w3.org/2000/svg" aria-label="PhotoBox motel illustration"><script/></svg>')).toBeNull();
    expect(verifiedPhotoBoxSvg('x'.repeat(16385))).toBeNull();
  });
});

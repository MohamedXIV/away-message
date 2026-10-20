/** Authored, self-contained SVG illustrations (not photographs or encoded fake PNGs).
 * Kept pure so both original PhotoBox UI and canonical VFS owner draw the same scene.
 */
export type PhotoBoxScene = 'motel' | 'diner' | 'canal';
export interface PhotoBoxFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  invert: number;
  blur: number;
}
export const DEFAULT_PHOTOBOX_FILTERS: Readonly<PhotoBoxFilters> = Object.freeze({
  brightness: 100, contrast: 100, saturation: 100, sepia: 0, invert: 0, blur: 0,
});
const SCENES: Readonly<Record<PhotoBoxScene, string>> = {
  motel: `<rect width="800" height="500" fill="#142439"/>
    <rect y="330" width="800" height="170" fill="#18262e"/>
    <path d="M0 407 800 378M0 451 800 421" stroke="#5684ad" stroke-width="4"/>
    <rect x="175" y="125" width="460" height="257" fill="#29313b" stroke="#718b9e" stroke-width="7"/>
    <rect x="215" y="188" width="160" height="120" fill="#101929"/>
    <path d="M232 188V308M256 188V308M280 188V308M304 188V308M328 188V308" stroke="#7283a8" stroke-width="5"/>
    <rect x="400" y="185" width="190" height="77" fill="#380b32" stroke="#f65dab" stroke-width="8"/>
    <text x="495" y="233" font-size="27" font-family="monospace" fill="#ffe2fc" text-anchor="middle">STARLITE</text>
    <rect x="432" y="280" width="115" height="67" fill="#183c53" stroke="#9e61da" stroke-width="4"/>
    <text x="489" y="322" font-size="28" fill="#e1faff" text-anchor="middle">104</text>
    <path d="M40 400l720 -35" stroke="#f467c1" stroke-width="6" opacity=".35"/>`,
  diner: `<rect width="800" height="500" fill="#13222e"/>
    <rect y="338" width="800" height="162" fill="#26343b"/>
    <rect x="135" y="115" width="530" height="260" fill="#2b373f" stroke="#c5a89f" stroke-width="6"/>
    <path d="M125 150h550" stroke="#c75465" stroke-width="15"/>
    <rect x="190" y="185" width="170" height="130" fill="#a9cad0"/>
    <rect x="395" y="185" width="190" height="130" fill="#a9cad0"/>
    <path d="M245 185v130M450 185v130" stroke="#8b5151" stroke-width="8"/>
    <rect x="295" y="70" width="210" height="73" fill="#442a36" stroke="#f5bc57" stroke-width="8"/>
    <text x="400" y="113" font-size="31" fill="#ffecad" text-anchor="middle" font-family="sans-serif">4TH STREET</text>
    <circle cx="267" cy="265" r="24" fill="#fce4a8"/>
    <rect x="455" y="258" width="72" height="12" fill="#f6e5cc"/>
    <path d="M0 430h800" stroke="#b3bec2" stroke-width="5"/>`,
  canal: `<rect width="800" height="500" fill="#182a32"/>
    <path d="M0 290h800v210H0" fill="#2f5159"/>
    <path d="M0 340q200 -35 400 10t400 -10" stroke="#7aa8ab" stroke-width="9" fill="none"/>
    <path d="M0 410q175 -30 400 10t400 -5" stroke="#63868b" stroke-width="7" fill="none"/>
    <rect x="105" y="105" width="330" height="180" fill="#46545b" stroke="#799099" stroke-width="6"/>
    <rect x="145" y="146" width="80" height="94" fill="#94b2ab"/>
    <rect x="270" y="146" width="118" height="94" fill="#94b2ab"/>
    <path d="M105 105l165 -72 165 72" stroke="#899498" stroke-width="13" fill="none"/>
    <rect x="510" y="95" width="65" height="190" fill="#506674"/>
    <rect x="522" y="42" width="40" height="55" fill="#a8adb1"/>
    <path d="M570 235h170m-170 26h170" stroke="#e0aa64" stroke-width="11"/>
    <path d="M0 290h800" stroke="#d7a670" stroke-width="12"/>
    <circle cx="660" cy="80" r="28" fill="#dfd0a4" opacity=".7"/>`,
};
export function validPhotoBoxScene(value: unknown): value is PhotoBoxScene {
  return typeof value === 'string' && Object.hasOwn(SCENES, value);
}
export function validatePhotoBoxFilters(value: unknown): PhotoBoxFilters {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid image filters');
  const data = value as Record<string, unknown>;
  const bounds: Record<keyof PhotoBoxFilters, readonly [number, number]> = {
    brightness: [20, 200], contrast: [20, 200], saturation: [0, 250],
    sepia: [0, 100], invert: [0, 100], blur: [0, 10],
  };
  const result = {} as PhotoBoxFilters;
  for (const key of Object.keys(bounds) as Array<keyof PhotoBoxFilters>) {
    const v = data[key], [min,max] = bounds[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
      throw new Error('Invalid ' + key + ' filter value');
    result[key] = v;
  }
  return result;
}
export function photoBoxCssFilter(filters: PhotoBoxFilters): string {
  const f = validatePhotoBoxFilters(filters);
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) sepia(${f.sepia}%) invert(${f.invert}%) blur(${f.blur}px)`;
}
export function makePhotoBoxSvg(scene: PhotoBoxScene, filters: PhotoBoxFilters): string {
  if (!validPhotoBoxScene(scene)) throw new Error('Unknown PhotoBox illustration');
  const css = photoBoxCssFilter(filters);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" role="img" aria-label="PhotoBox ${scene} illustration">
    <g style="filter: ${css}">${SCENES[scene]}</g>
    </svg>`;
}

/** Reject any SVG not byte-identical to our authored scene/filter generator.
 * This is used before creating an image data URI from VFS file content:
 * arbitrary player-saved SVG with lookalike headers must never render here.
 */
export function verifiedPhotoBoxSvg(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 16384) return null;
  const scene = /aria-label="PhotoBox (motel|diner|canal) illustration"/.exec(input)?.[1];
  const match = /filter: brightness\\((\\d+(?:\\.\\d+)?)%\\) contrast\\((\\d+(?:\\.\\d+)?)%\\) saturate\\((\\d+(?:\\.\\d+)?)%\\) sepia\\((\\d+(?:\\.\\d+)?)%\\) invert\\((\\d+(?:\\.\\d+)?)%\\) blur\\((\\d+(?:\\.\\d+)?)px\\)/.exec(input);
  if (!validPhotoBoxScene(scene) || !match) return null;
  const values = match.slice(1).map(Number);
  try {
    const filters = validatePhotoBoxFilters({
      brightness: values[0], contrast: values[1], saturation: values[2],
      sepia: values[3], invert: values[4], blur: values[5],
    });
    return input === makePhotoBoxSvg(scene, filters) ? input : null;
  } catch {
    return null;
  }
}

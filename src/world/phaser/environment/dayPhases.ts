// src/world/phaser/environment/dayPhases.ts

export interface DayPhaseProfile {
  id: string;
  name: string;
  minuteOfDay: number; // 0..1440
  ambientColor: string; // #rrggbb
  ambientIntensity: number;
  exteriorColor: string; // #rrggbb
  exteriorIntensity: number;
  artificialLightProminence: number; // 0..1
  reflectionVisibility: number; // 0..1
  skyColor: string; // #rrggbb
  starAlpha: number; // 0..1
}

export interface DayPhaseParameters {
  ambientColor: string;
  ambientIntensity: number;
  exteriorColor: string;
  exteriorIntensity: number;
  artificialLightProminence: number;
  reflectionVisibility: number;
  skyColor: string;
  starAlpha: number;
}

export const CANONICAL_DAY_PHASES: Record<
  'dawn_morning' | 'day' | 'late_afternoon' | 'dusk_evening' | 'night_late_night',
  DayPhaseProfile
> = {
  night_late_night: {
    id: 'night_late_night',
    name: 'Night / Late Night',
    minuteOfDay: 150, // 02:30 (deepest darkest night)
    ambientColor: '#1e293b',
    ambientIntensity: 0.25,
    exteriorColor: '#0f172a',
    exteriorIntensity: 0.25,
    artificialLightProminence: 0.95,
    reflectionVisibility: 0.85,
    skyColor: '#090d16',
    starAlpha: 1.0,
  },
  dawn_morning: {
    id: 'dawn_morning',
    name: 'Dawn / Morning',
    minuteOfDay: 390, // 06:30
    ambientColor: '#ffe8cc',
    ambientIntensity: 0.85,
    exteriorColor: '#ffd8a8',
    exteriorIntensity: 0.90,
    artificialLightProminence: 0.40,
    reflectionVisibility: 0.50,
    skyColor: '#fbcfe8',
    starAlpha: 0.0,
  },
  day: {
    id: 'day',
    name: 'Day',
    minuteOfDay: 720, // 12:00
    ambientColor: '#ffffff',
    ambientIntensity: 1.0,
    exteriorColor: '#e0f2fe',
    exteriorIntensity: 1.0,
    artificialLightProminence: 0.15,
    reflectionVisibility: 0.30,
    skyColor: '#7dd3fc',
    starAlpha: 0.0,
  },
  late_afternoon: {
    id: 'late_afternoon',
    name: 'Late Afternoon',
    minuteOfDay: 990, // 16:30
    ambientColor: '#fed7aa',
    ambientIntensity: 0.88,
    exteriorColor: '#f97316',
    exteriorIntensity: 0.85,
    artificialLightProminence: 0.35,
    reflectionVisibility: 0.45,
    skyColor: '#fdba74',
    starAlpha: 0.0,
  },
  dusk_evening: {
    id: 'dusk_evening',
    name: 'Dusk / Evening',
    minuteOfDay: 1170, // 19:30
    ambientColor: '#a78bfa',
    ambientIntensity: 0.55,
    exteriorColor: '#4f46e5',
    exteriorIntensity: 0.50,
    artificialLightProminence: 0.75,
    reflectionVisibility: 0.70,
    skyColor: '#312e81',
    starAlpha: 0.40,
  },
};

const ORDERED_PROFILES: DayPhaseProfile[] = [
  CANONICAL_DAY_PHASES.night_late_night,
  CANONICAL_DAY_PHASES.dawn_morning,
  CANONICAL_DAY_PHASES.day,
  CANONICAL_DAY_PHASES.late_afternoon,
  CANONICAL_DAY_PHASES.dusk_evening,
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16) || 0;
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampR = Math.min(255, Math.max(0, Math.round(r)));
  const clampG = Math.min(255, Math.max(0, Math.round(g)));
  const clampB = Math.min(255, Math.max(0, Math.round(b)));
  return '#' + ((1 << 24) + (clampR << 16) + (clampG << 8) + clampB).toString(16).slice(1);
}

function smoothInterpolate(t: number): number {
  // Smooth cosine s-curve with zero derivative at boundaries
  return (1 - Math.cos(Math.PI * t)) / 2;
}

function interpolateColor(colorA: string, colorB: string, factor: number): string {
  const [rA, gA, bA] = hexToRgb(colorA);
  const [rB, gB, bB] = hexToRgb(colorB);
  const r = rA + (rB - rA) * factor;
  const g = gA + (gB - gA) * factor;
  const b = bA + (bB - bA) * factor;
  return rgbToHex(r, g, b);
}

/**
 * Evaluates semantic day phase parameters for any given minute of day (0..1440),
 * interpolating continuously without abrupt minute-boundary switches.
 */
export function interpolateDayPhase(rawMinuteOfDay: number): DayPhaseParameters {
  const normalizedMinute = ((rawMinuteOfDay % 1440) + 1440) % 1440;

  // Find surrounding profiles in cyclic 24h space
  let fromProfile = ORDERED_PROFILES[ORDERED_PROFILES.length - 1]!;
  let toProfile = ORDERED_PROFILES[0]!;

  for (let i = 0; i < ORDERED_PROFILES.length; i++) {
    const current = ORDERED_PROFILES[i]!;
    const next = ORDERED_PROFILES[(i + 1) % ORDERED_PROFILES.length]!;

    if (current.minuteOfDay <= next.minuteOfDay) {
      if (normalizedMinute >= current.minuteOfDay && normalizedMinute <= next.minuteOfDay) {
        fromProfile = current;
        toProfile = next;
        break;
      }
    } else {
      // Midnight crossing segment (e.g. dusk_evening 1170m -> night_late_night 60m)
      if (normalizedMinute >= current.minuteOfDay || normalizedMinute <= next.minuteOfDay) {
        fromProfile = current;
        toProfile = next;
        break;
      }
    }
  }

  // Calculate t in [0, 1]
  let segmentDuration: number;
  let elapsed: number;

  if (fromProfile.minuteOfDay <= toProfile.minuteOfDay) {
    segmentDuration = toProfile.minuteOfDay - fromProfile.minuteOfDay;
    elapsed = normalizedMinute - fromProfile.minuteOfDay;
  } else {
    segmentDuration = (1440 - fromProfile.minuteOfDay) + toProfile.minuteOfDay;
    elapsed = normalizedMinute >= fromProfile.minuteOfDay
      ? normalizedMinute - fromProfile.minuteOfDay
      : (1440 - fromProfile.minuteOfDay) + normalizedMinute;
  }

  const rawT = segmentDuration > 0 ? elapsed / segmentDuration : 0;
  const t = Math.max(0, Math.min(1, rawT));
  const factor = smoothInterpolate(t);

  return {
    ambientColor: interpolateColor(fromProfile.ambientColor, toProfile.ambientColor, factor),
    ambientIntensity: fromProfile.ambientIntensity + (toProfile.ambientIntensity - fromProfile.ambientIntensity) * factor,
    exteriorColor: interpolateColor(fromProfile.exteriorColor, toProfile.exteriorColor, factor),
    exteriorIntensity: fromProfile.exteriorIntensity + (toProfile.exteriorIntensity - fromProfile.exteriorIntensity) * factor,
    artificialLightProminence: fromProfile.artificialLightProminence + (toProfile.artificialLightProminence - fromProfile.artificialLightProminence) * factor,
    reflectionVisibility: fromProfile.reflectionVisibility + (toProfile.reflectionVisibility - fromProfile.reflectionVisibility) * factor,
    skyColor: interpolateColor(fromProfile.skyColor, toProfile.skyColor, factor),
    starAlpha: fromProfile.starAlpha + (toProfile.starAlpha - fromProfile.starAlpha) * factor,
  };
}

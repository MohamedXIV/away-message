// src/engine/WeatherEngine.ts
// P6.2 living weather — pure deterministic Oakhaven forecast synced to game days.
// No state, no AI, no persistence: weather is a pure function of the day number,
// so reloads, tests and UI always agree. Day 1 = Aug 22, 2006.

export type WeatherCondition = 'rain' | 'drizzle' | 'overcast' | 'fog' | 'clear' | 'heat' | 'storm';

export interface DayWeather {
  day: number;
  condition: WeatherCondition;
  label: string;
  icon: string;
  highF: number;
  lowF: number;
}

/** Hand-authored 14-day Oakhaven cycle (canal town in late August: mostly grey, sometimes hot). */
const CYCLE: WeatherCondition[] = [
  'overcast', 'rain', 'rain', 'drizzle', 'overcast', 'fog', 'clear',
  'rain', 'overcast', 'heat', 'drizzle', 'rain', 'fog', 'clear',
];

const CONDITION_META: Record<WeatherCondition, { label: string; icon: string; highF: number; lowF: number }> = {
  rain: { label: 'Canal Rain', icon: '🌧️', highF: 62, lowF: 48 },
  drizzle: { label: 'Light Drizzle', icon: '🌦️', highF: 64, lowF: 50 },
  overcast: { label: 'Heavy Overcast', icon: '☁️', highF: 68, lowF: 54 },
  fog: { label: 'Canal Fog', icon: '🌫️', highF: 59, lowF: 45 },
  clear: { label: 'Break in Clouds', icon: '⛅', highF: 72, lowF: 55 },
  heat: { label: 'Heat Wave', icon: '☀️', highF: 88, lowF: 70 },
  storm: { label: 'Canal Storm', icon: '⛈️', highF: 60, lowF: 47 },
};

function hashDay(day: number): number {
  let hash = day >>> 0;
  hash = ((hash * 1103515245 + 12345) >>> 0) % 100;
  return hash;
}

/** Weather for a game day: 14-day cycle + a governed storm every 15th day. */
export function getWeatherForDay(rawDay: number): DayWeather {
  const day = Math.max(1, Math.floor(rawDay) || 1);
  // Monthly-ish storm front (days 15, 30, 45...) — the one dramatic exception
  const condition: WeatherCondition = day % 15 === 0 ? 'storm' : CYCLE[(day - 1) % CYCLE.length]!;
  const meta = CONDITION_META[condition];
  const jitter = (hashDay(day) % 5) - 2;
  return { day, condition, label: meta.label, icon: meta.icon, highF: meta.highF + jitter, lowF: meta.lowF };
}

/** N-day forecast starting on `fromDay` (used by WeatherBuddy). */
export function getForecast(fromDay: number, count: number): DayWeather[] {
  const out: DayWeather[] = [];
  const n = Math.max(1, Math.min(10, Math.floor(count) || 1));
  for (let i = 0; i < n; i++) out.push(getWeatherForDay(fromDay + i));
  return out;
}

/** Game day → weekday name (day 1 = Tuesday Aug 22, 2006). */
export function gameDayName(rawDay: number): string {
  const day = Math.max(1, Math.floor(rawDay) || 1);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[new Date(2006, 7, 21 + day).getDay()]!;
}

/** Game day → display date (matches the static inbox: Aug 22, 2006 day 1). */
export function gameDayLabel(rawDay: number): string {
  const day = Math.max(1, Math.floor(rawDay) || 1);
  return new Date(2006, 7, 21 + day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Wet days make Maya happy (rain/drizzle/storm). */
export function isWetWeather(condition: WeatherCondition): boolean {
  return condition === 'rain' || condition === 'drizzle' || condition === 'storm';
}

/** Heavy fog or storm is a legitimate meeting excuse (no hard feelings). */
export function isSevereWeather(condition: WeatherCondition): boolean {
  return condition === 'fog' || condition === 'storm';
}

/** Heat waves pay +$6 on side shifts (thirsty town, busy cart). */
export function shiftWageBonus(condition: WeatherCondition): number {
  return condition === 'heat' ? 6 : 0;
}

/** One-line prompt injection for chat. */
export function weatherLineForDay(rawDay: number): string {
  const w = getWeatherForDay(rawDay);
  return `Weather today: ${w.label} ${w.icon} (high ${w.highF}F).`;
}

// src/world/types.ts

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night' | 'late_night';
export type WeatherType = 'clear' | 'cloudy' | 'rain';

export type RoomHotspotId =
  | 'pc'
  | 'kettle'
  | 'shower'
  | 'window'
  | 'bed'
  | 'door';

export interface HotspotBounds {
  id: RoomHotspotId;
  label: string;
  sublabel: string;
  icon: string;
  x: number; // 0..1 normalized coordinate
  y: number; // 0..1 normalized coordinate
  w: number; // 0..1 normalized width
  h: number; // 0..1 normalized height
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  life?: number;
  maxLife?: number;
}

export interface RainDrop {
  x: number;
  y: number;
  vy: number;
  length: number;
  alpha: number;
}

export interface WindowCondensationDrop {
  x: number;
  y: number;
  vy: number;
  size: number;
  alpha: number;
}

export interface PersistentStreetEntity {
  id: string;
  name: string;
  description: string;
  x?: number;
  y?: number;
  activeTimes: TimeOfDay[];
  activeWeather?: WeatherType[];
}

export interface WindowThought {
  id: string;
  minDay?: number;
  maxDay?: number;
  timeOfDay?: TimeOfDay[];
  weather?: WeatherType[];
  requiredFlags?: string[];
  text: string;
  mood: 'melancholy' | 'curious' | 'nostalgic' | 'hopeful' | 'restless';
}

export type MayaExpression =
  | 'neutral'
  | 'smile'
  | 'thoughtful'
  | 'surprised'
  | 'shy';

export interface CafeDialogueChoice {
  id: string;
  text: string;
  nextBeatId: string;
  socialTag?: string; // e.g. 'empathy', 'remembered_detail', 'tease_playful'
  socialActionName?: string;
  trustDelta?: number;
  comfortDelta?: number;
  familiarityDelta?: number;
  customReactionText?: string;
  mayaReactionExpression?: MayaExpression;
}

export interface CafeDialogueBeat {
  id: string;
  speaker: 'Maya' | 'You';
  expression?: MayaExpression;
  text: string;
  choices?: CafeDialogueChoice[];
  nextBeatId?: string;
  isEnd?: boolean;
}

export interface RoomActivityOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  durationMinutes: number;
  energyChange: number;
  cashCost?: number;
  cashReward?: number;
  actionType: 'tea' | 'coffee' | 'meal' | 'groceries' | 'shower' | 'window' | 'work' | 'sleep' | 'walk' | 'cafe' | 'diner' | 'outing';
  /** Opening hours [startHour, endHour) in 24h — absent means always open. */
  openHours?: [number, number];
}

// src/world/data/windowThoughts.ts

import { TimeOfDay, WeatherType, WindowThought, PersistentStreetEntity } from '../types';

export const PERSISTENT_STREET_ENTITIES: PersistentStreetEntity[] = [
  {
    id: 'trenchcoat_man',
    name: 'Man by the Payphone',
    description: 'A figure in a worn tan trenchcoat leaning against the illuminated payphone booth on the corner, speaking quietly into the receiver.',
    activeTimes: ['evening', 'night', 'late_night'],
  },
  {
    id: 'flickering_diner',
    name: '24H Diner Neon Sign',
    description: 'The neon blue and coral pink sign for the corner diner buzzes rhythmically against the damp brickwork, casting magenta reflections across the wet asphalt.',
    activeTimes: ['morning', 'day', 'evening', 'night', 'late_night'],
  },
  {
    id: 'recurring_sedan',
    name: 'Faded Maroon Sedan',
    description: 'A faded 1994 maroon four-door sedan parked under the buzzing sodium streetlight, exhaust puffing intermittently into the cold air.',
    activeTimes: ['day', 'evening', 'night'],
  },
  {
    id: 'motel_clerk',
    name: 'Motel Caretaker in Alley',
    description: 'Mr. Henderson stands by the motel service entrance with a brass ring of keys and a glowing cigarette tip, staring out toward the canal bridge.',
    activeTimes: ['morning', 'late_night'],
  },
];

export const WINDOW_THOUGHTS: WindowThought[] = [
  // Early Days (1..3)
  {
    id: 'day1_intro',
    minDay: 1,
    maxDay: 2,
    timeOfDay: ['morning', 'day'],
    text: 'A quiet morning outside Room 104. Delivery vans rattle over the metal expansion joints on the canal bridge. The air smells of wet concrete and cheap diner roast.',
    mood: 'melancholy',
  },
  {
    id: 'day1_night',
    minDay: 1,
    maxDay: 3,
    timeOfDay: ['night', 'late_night'],
    text: 'The sodium streetlights hum at 60 Hz. Down below, an occasional pair of headlights sweeps through the room, briefly illuminating the pale motel wallpaper before fading back into dark.',
    mood: 'nostalgic',
  },
  {
    id: 'rain_street',
    weather: ['rain'],
    text: 'Rain needles against the second-story glass. Droplets collect, shudder in the crossbreeze, and trace erratic vertical rivers down the pane. The entire city is reflected upside down in the puddles below.',
    mood: 'melancholy',
  },
  {
    id: 'mid_game_work',
    minDay: 4,
    maxDay: 8,
    timeOfDay: ['morning', 'day'],
    text: 'People rushing toward the light rail station with umbrellas tucked under their arms. Out here, everyone seems to have somewhere urgent to be. Inside this room, time feels measured purely in download percentages and dial-up tones.',
    mood: 'restless',
  },
  {
    id: 'mid_game_night',
    minDay: 5,
    maxDay: 9,
    timeOfDay: ['evening', 'night'],
    text: 'Across the alley, the blinking amber tower lights atop the telecommunications antenna pulse in a steady rhythm. Somewhere across those copper wires, Ryan is closing the food cart and Maya is finishing her evening shift.',
    mood: 'hopeful',
  },
  {
    id: 'post_cafe_thoughts',
    minDay: 11,
    maxDay: 14,
    requiredFlags: ['maya_met_in_person'],
    text: 'The street feels different after meeting Maya at Starlight Café. You recognize the crosswalk where she turned toward the subway, and the neon lights seem a little warmer than they did a week ago.',
    mood: 'hopeful',
  },
  {
    id: 'end_game_clarity',
    minDay: 13,
    maxDay: 14,
    text: 'Two weeks in this room. The desk is covered in CD jewel cases, notes, and receipts. The hum of the computer fan has become as natural as breathing. Whatever comes next, you found a way to bridge both worlds.',
    mood: 'hopeful',
  },
  {
    id: 'generic_late_night',
    timeOfDay: ['late_night'],
    text: '3:00 AM. The city is dead quiet except for the distant drone of the highway and the clicking of the hard drive on the desk. You feel like the only conscious person for miles.',
    mood: 'curious',
  },
];

export function getContextualWindowThought(
  day: number,
  timeOfDay: TimeOfDay,
  weather: WeatherType,
  flags: Record<string, any> = {}
): { thought: string; entity: PersistentStreetEntity | null; mood: string } {  // Find matching thoughts
  const matchingThoughts = WINDOW_THOUGHTS.filter((t) => {
    if (t.minDay !== undefined && day < t.minDay) return false;
    if (t.maxDay !== undefined && day > t.maxDay) return false;
    if (t.timeOfDay && !t.timeOfDay.includes(timeOfDay)) return false;
    if (t.weather && !t.weather.includes(weather)) return false;
    if (t.requiredFlags && !t.requiredFlags.every((f) => !!flags[f])) return false;
    return true;
  });

  // Pick deterministic or best match
  const selectedThought: WindowThought =
    (matchingThoughts.length > 0 && matchingThoughts[day % matchingThoughts.length]) ||
    matchingThoughts[0] ||
    WINDOW_THOUGHTS[0] || {
      id: 'fallback',
      text: 'The quiet street stretches out under the gray sky.',
      mood: 'melancholy' as const,
    };

  // Check matching street entity
  const matchingEntities = PERSISTENT_STREET_ENTITIES.filter(
    (e) => e.activeTimes.includes(timeOfDay) && (!e.activeWeather || e.activeWeather.includes(weather))
  );
  const selectedEntity: PersistentStreetEntity | null =
    matchingEntities.length > 0 ? (matchingEntities[day % matchingEntities.length] ?? null) : null;

  return {
    thought: selectedThought.text,
    entity: selectedEntity,
    mood: selectedThought.mood,
  };
}

// ==========================================
// P6.5 — STREET SIGHTINGS (schedules made visible)
// Which buddies can be seen from the window right now, from live presence.
// Distant/gone buddies are conspicuously absent. Pure + deterministic.
// ==========================================

export interface SightingBuddy {
  id: string;
  displayName: string;
  presenceStatus: string; // 'online' | 'away' | 'offline' | ...
  lifecycleStatus?: string;
}

const STREET_SIGHTINGS: Record<string, Array<{ times: TimeOfDay[]; text: string }>> = {
  ryan: [
    { times: ['morning', 'day'], text: 'Ryan’s cart glows two blocks down, steam rolling off the grill.' },
    { times: ['evening', 'night'], text: 'Ryan is closing the cart, counting the till under the awning light.' },
  ],
  maya: [
    { times: ['morning', 'day'], text: 'Maya hurries past with a camera bag, late for something as usual.' },
    { times: ['evening', 'night'], text: 'Maya’s silhouette crosses the diner window across the street.' },
  ],
  nora: [
    { times: ['night', 'late_night'], text: 'A figure with a small flashlight picks along the canal path — Nora, on another night round.' },
    { times: ['evening'], text: 'Nora slips into the alley with a duffel bag full of God-knows-what.' },
  ],
  henderson: [
    { times: ['morning', 'day'], text: 'Mr. Henderson props the motel office door open and waters the plastic plant.' },
    { times: ['evening'], text: 'Henderson does his evening round, keys jingling, checking every door twice.' },
  ],
};

const ABSENT_SIGHTING_LINES: string[] = [
  '{name} hasn’t been seen in days. The street feels emptier.',
  'No sign of {name} lately. Even the regulars noticed.',
  'You catch yourself looking for {name} out there. Nothing.',
];

/**
 * One street sighting for the window, or null when the street is quiet.
 * Visible (online/away) buddies with a time-appropriate line win; absent
 * (distant/gone) buddies surface as melancholy notes ~30% of the time.
 */
export function getStreetSighting(
  buddies: SightingBuddy[],
  timeOfDay: TimeOfDay,
  seedDay: number
): string | null {
  const hash = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };
  const absent = buddies.filter((b) => b.lifecycleStatus === 'distant' || b.lifecycleStatus === 'gone');
  if (absent.length > 0 && hash(`absent:${seedDay}`) % 100 < 30) {
    const missing = absent[hash(`who:${seedDay}`) % absent.length]!;
    const line = ABSENT_SIGHTING_LINES[hash(`line:${seedDay}`) % ABSENT_SIGHTING_LINES.length]!;
    return line.replaceAll('{name}', missing.displayName);
  }
  const visible = buddies.filter((b) => b.presenceStatus === 'online' || b.presenceStatus === 'away');
  const options: string[] = [];
  for (const buddy of visible) {
    const pools = STREET_SIGHTINGS[buddy.id];
    if (pools) {
      for (const pool of pools) {
        if (pool.times.includes(timeOfDay)) options.push(pool.text);
      }
    } else {
      // Procedural friends get a generic but personal line
      options.push(`A familiar face crosses the street below — ${buddy.displayName}, one of your newer friends.`);
    }
  }
  if (options.length === 0) return null;
  return options[hash(`seen:${seedDay}:${timeOfDay}`) % options.length]!;
}

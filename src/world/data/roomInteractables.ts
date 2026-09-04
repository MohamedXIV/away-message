// src/world/data/roomInteractables.ts

import { RoomActivityOption, HotspotBounds } from '../types';

export const ROOM_HOTSPOTS: HotspotBounds[] = [
  {
    id: 'pc',
    label: 'PC Desk',
    sublabel: 'Orion PC & CRT Monitor (Click to sit down)',
    icon: '💻',
    x: 0.12,
    y: 0.44,
    w: 0.26,
    h: 0.46,
  },
  {
    id: 'kettle',
    label: 'Kettle & Kitchenette',
    sublabel: 'Electric Kettle & Mug (Brew tea, coffee, noodles)',
    icon: '🫖',
    x: 0.41,
    y: 0.52,
    w: 0.14,
    h: 0.28,
  },
  {
    id: 'shower',
    label: 'Bathroom Door',
    sublabel: 'Hot Shower (12 min — Refresh & restore energy)',
    icon: '🚿',
    x: 0.86,
    y: 0.30,
    w: 0.11,
    h: 0.58,
  },
  {
    id: 'window',
    label: 'Motel Window',
    sublabel: 'Look outside (4 min — Street view & thoughts)',
    icon: '🪟',
    x: 0.40,
    y: 0.12,
    w: 0.22,
    h: 0.34,
  },
  {
    id: 'bed',
    label: 'Motel Bed',
    sublabel: 'Rest & Sleep (Jump to 08:00 next day)',
    icon: '🛏️',
    x: 0.65,
    y: 0.48,
    w: 0.20,
    h: 0.42,
  },
  {
    id: 'door',
    label: 'Hallway Door (Room 104)',
    sublabel: 'Food Cart Shift / Starlight Café / Walk outside',
    icon: '🚪',
    x: 0.02,
    y: 0.28,
    w: 0.09,
    h: 0.60,
  },
];

export const BEVERAGE_OPTIONS: RoomActivityOption[] = [
  {
    id: 'brew_tea',
    title: 'Brew Hot Black Tea',
    description: 'Boil water in the electric kettle and steep a bag of generic black tea. Steams warmly in your favorite ceramic mug.',
    icon: '🫖',
    durationMinutes: 6,
    energyChange: 5,
    actionType: 'tea',
  },
  {
    id: 'brew_coffee',
    title: 'Instant Roast Coffee',
    description: 'Two spoonfuls of instant freeze-dried granules and boiling water. Bitter, hot, and quick.',
    icon: '☕',
    durationMinutes: 5,
    energyChange: 5,
    actionType: 'coffee',
  },
  {
    id: 'instant_noodles',
    title: 'Spicy Instant Cup Noodles',
    description: 'Pour boiling kettle water into a foam cup of chili-beef noodles. Wait 3 minutes, then enjoy a hot, satisfying meal.',
    icon: '🍜',
    durationMinutes: 15,
    energyChange: 10,
    cashCost: 3.00,
    actionType: 'meal',
  },
  {
    id: 'cook_groceries',
    title: 'Cook Pantry Groceries',
    description: 'Thirty minutes at the hotplate: rice, beans, an egg. Real food, real cheap — the rent-week special.',
    icon: '🍳',
    durationMinutes: 30,
    energyChange: 12,
    cashCost: 8.00,
    actionType: 'groceries',
  },
];

// P6 place hours: the city keeps time — diners, carts and laundromats open/close.
// Absent openHours = always open (canal, bus). Overnight ranges wrap past midnight.
/** Pure opening-hours check (testable, deterministic). */
export function isOptionOpen(opt: { openHours?: [number, number] }, hour: number): boolean {
  if (!opt.openHours) return true;
  const [start, end] = opt.openHours;
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (start <= end) return h >= start && h < end;
  return h >= start || h < end;
}

export function openHoursLabel(openHours?: [number, number]): string {
  if (!openHours) return '';
  const fmt = (h: number): string => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;
  return `${fmt(openHours[0])}–${fmt(openHours[1])}`;
}

export const DOOR_OPTIONS: RoomActivityOption[] = [
  {
    id: 'food_cart_shift',
    title: 'Work Food Cart Shift',
    description: 'Head down to the bustling downtown food cart for a 4-hour evening rush shift with Ryan. Hard work on your feet, but pays reliable cash.',
    icon: '🚚',
    durationMinutes: 240,
    energyChange: -40,
    cashReward: 62.00,
    actionType: 'work',
    openHours: [16, 23],
  },
  {
    id: 'overtime_shift',
    title: 'Overtime Cart Shift (3h)',
    description: 'An extra evening top-up shift when the cart runs late. Shorter, lighter pay — perfect rent-week rescue money.',
    icon: '🌙',
    durationMinutes: 180,
    energyChange: -30,
    cashReward: 52.00,
    actionType: 'work',
    openHours: [17, 23],
  },
  {
    id: 'canal_walk',
    title: 'Evening Walk along the Canal',
    description: 'A 45-minute walk by the water to clear your head. Nora is rumored to walk here late at night — and the rain makes it better.',
    icon: '🚶',
    durationMinutes: 45,
    energyChange: 6,
    actionType: 'outing',
  },
  {
    id: 'diner_soup',
    title: 'Diner: Tomato Soup & Toast',
    description: 'Quick and cheap at the 4th Street Diner. Maya works the lunch-to-dinner shift — you might catch her.',
    icon: '🍲',
    durationMinutes: 40,
    energyChange: 6,
    cashCost: 5.00,
    actionType: 'diner',
    openHours: [11, 22],
  },
  {
    id: 'diner_platter',
    title: 'Diner: Blue Plate Platter',
    description: 'The full hearty dinner at the 4th Street Diner. Proper food, proper mood repair. Maya works the lunch-to-dinner shift.',
    icon: '🍽️',
    durationMinutes: 60,
    energyChange: 10,
    cashCost: 11.00,
    actionType: 'diner',
    openHours: [11, 22],
  },
  {
    id: 'diner_pie',
    title: 'Diner: Apple Pie & Coffee',
    description: 'Dessert and a bottomless coffee at the counter. Cheap comfort. Maya works the lunch-to-dinner shift.',
    icon: '🥧',
    durationMinutes: 25,
    energyChange: 6,
    cashCost: 4.00,
    actionType: 'diner',
    openHours: [11, 22],
  },
  {
    id: 'laundromat',
    title: 'Laundromat Run',
    description: 'Wash a load at the Suds & Spin. Forty minutes of warm dryers — and the bulletin board of town gossip.',
    icon: '🧺',
    durationMinutes: 40,
    energyChange: -3,
    cashCost: 4.00,
    actionType: 'outing',
    openHours: [7, 23],
  },
  {
    id: 'visit_cafe',
    title: 'Travel to Starlight Café',
    description: 'Catch the cross-town bus to meet Maya at the Starlight Café for warm coffee and in-person conversation.',
    icon: '☕',
    durationMinutes: 75,
    energyChange: 10,
    cashCost: 4.00,
    actionType: 'cafe',
  },
];

// src/engine/JobDirector.ts
// P6 job board — pure rules for gig applications: odds, reply delays, decisions.
// Apply anytime; the reply lands 4–10h later (never instant). Accept creates a
// real next-day work appointment through the existing meeting machinery.
// Contacts are capability roles (resolved against the live roster at reply time).

export interface Gig {
  id: string;
  title: string;
  blurb: string;
  pay: number;
  durationMin: number;
  minEnergy: number;
  /** Capability role of the contact (resolved against the roster at reply time). */
  contactRole: string;
  baseOdds: number; // 0..100 before relationship modifiers
}

export const GIGS: Record<string, Gig> = {
  cart_helper: {
    id: 'cart_helper', title: "Ryan's Cart Relief", blurb: 'Lunch rush backup at the food cart. Tacos, change, small talk.',
    pay: 40, durationMin: 180, minEnergy: 25, contactRole: 'cart-owner', baseOdds: 80,
  },
  diner_dishwasher: {
    id: 'diner_dishwasher', title: 'Diner Dish Pit', blurb: 'Evening dishes at the 4th Street Diner. Hot, loud, honest.',
    pay: 45, durationMin: 240, minEnergy: 30, contactRole: 'diner-staff', baseOdds: 75,
  },
  flyer_run: {
    id: 'flyer_run', title: 'Motel Flyer Run', blurb: 'Henderson needs flyers on every door in the district. Easy legs, easy money.',
    pay: 20, durationMin: 120, minEnergy: 15, contactRole: 'landlord', baseOdds: 90,
  },
  night_stock: {
    id: 'night_stock', title: 'Night Stockroom', blurb: 'Overnight shelving and counting. Quiet, heavy, well paid.',
    pay: 55, durationMin: 300, minEnergy: 60, contactRole: 'canal-regular', baseOdds: 65,
  },
};

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** Deterministic 0..99 roll for job decisions (stable across reloads). */
export function jobRoll(seed: string): number {
  return hashText(seed) % 100;
}

/** Reply delay: 4–10h after applying (never instant — someone has to read it). */
export function replyDelayMinutes(gigId: string, appliedMinute: number): number {
  return 240 + (hashText(`reply:${gigId}:${appliedMinute}`) % 361);
}

export interface ApplicationDecision {
  baseOdds: number;
  contactStage: string;
  contactGone: boolean;
  roll: number;
}

/**
 * Accept/reject a gig application. Pure.
 * - gone/distant/blocked/strained contact → always reject
 * - friend/close contact vouches (+15), acquaintance +5
 * - clamped 5..95, accept iff roll < odds
 */
export function decideApplication(opts: ApplicationDecision): { accepted: boolean; odds: number } {
  if (opts.contactGone) return { accepted: false, odds: 0 };
  if (opts.contactStage === 'strained') return { accepted: false, odds: 0 };
  let odds = opts.baseOdds;
  if (opts.contactStage === 'friend' || opts.contactStage === 'close') odds += 15;
  else if (opts.contactStage === 'acquaintance') odds += 5;
  odds = Math.max(5, Math.min(95, odds));
  return { accepted: opts.roll >= 0 && opts.roll < odds, odds };
}

// src/engine/BodyDirector.ts
// P6.1 body-to-chat bridge — pure rules turning body state into one NPC-facing
// observation line. NPCs notice, never diagnose; at most one note fires.

export interface BodyState {
  energy: number;
  hunger: number;
  health: number;
  sleepDebt: number;
}

/**
 * Returns '' when the player looks fine, otherwise a single gentle observation
 * for prompt injection (priority: exhausted → starving → unwell).
 */
export function buildBodyHint(body: BodyState): string {
  if (body.energy < 25) return 'Body: the player looks exhausted (low energy) — you may notice it with care once in a while.';
  if (body.hunger > 75) return 'Body: the player has barely eaten (very hungry) — you may notice it with care once in a while.';
  if (body.health < 40) return 'Body: the player looks unwell (poor health) — you may notice it with care once in a while.';
  return '';
}

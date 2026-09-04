import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildRentMailHistory } from '../../src/engine/BoardDirector';
import {
  pickRentReminderLine,
  pickRentSternLine,
  pickRentNudgeLine,
  pickRentThanksLine,
} from '../../src/engine/characterTemplates';
import { DOOR_OPTIONS, BEVERAGE_OPTIONS } from '../../src/world/data/roomInteractables';

function hendersonMessages(sim: SimulationEngine, tag: string): string[] {
  return sim.social.getMessages('henderson').filter((m) => m.tags?.includes(tag)).map((m) => m.text);
}

describe('P6.4 rent ladder (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('reminds on day 5, warns on day 7, nudges daily once overdue', () => {
    expect(sim.economy.getState().rentDueDay).toBe(7);
    sim.advanceGameMinutes(4 * 24 * 60, 'to day 5');
    expect(sim.world.getFlag('rent_reminded_7')).toBe(true);
    expect(sim.world.getFlag('rentmail_due_7')).toBe(14000);
    expect(hendersonMessages(sim, 'reminder').length).toBe(1);

    sim.advanceGameMinutes(2 * 24 * 60, 'to day 7');
    expect(sim.world.getFlag('rent_warned_7')).toBe(true);
    expect(hendersonMessages(sim, 'warning').length).toBe(1);

    sim.advanceGameMinutes(24 * 60, 'to day 8');
    expect(sim.world.getFlag('rent_overdue')).toBe(true);
    expect(sim.world.getFlag('rentmail_overdue_7')).toBeDefined();
    expect(hendersonMessages(sim, 'nudge').length).toBe(1);

    sim.advanceGameMinutes(24 * 60, 'to day 9');
    expect(hendersonMessages(sim, 'nudge').length).toBe(2); // one per day, no spam
  });

  it('pauses new downloads while overdue and resumes on payment', () => {
    sim.advanceGameMinutes(7 * 24 * 60, 'to day 8');
    expect(sim.world.getFlag('rent_overdue')).toBe(true);
    const blocked = sim.dispatchAction({
      type: 'DOWNLOAD_START', sourceId: 'tool', url: 'http://downloadhub.local/tool.exe',
      fileName: 'tool.exe', totalBytes: 192_000, sourceMaxKbps: 512,
    });
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('rent');

    sim.economy.earnCash(500, 'test funds');
    const paid = sim.dispatchAction({ type: 'PLAYER_PAY_RENT' });
    expect(paid.success).toBe(true);
    expect(sim.world.getFlag('rent_overdue')).toBe(false);
    expect(hendersonMessages(sim, 'thanks').length).toBe(1);
    const allowed = sim.dispatchAction({
      type: 'DOWNLOAD_START', sourceId: 'tool', url: 'http://downloadhub.local/tool.exe',
      fileName: 'tool.exe', totalBytes: 192_000, sourceMaxKbps: 512,
    });
    expect(allowed.success).toBe(true);
  });

  it('rebuilds the paper trail from flags (survives payment)', () => {
    sim.advanceGameMinutes(7 * 24 * 60, 'to day 8');
    sim.economy.earnCash(500, 'test funds');
    sim.dispatchAction({ type: 'PLAYER_PAY_RENT' });
    const mail = buildRentMailHistory(sim.world.getFlags());
    expect(mail.map((m) => m.key)).toEqual(['rentmail_due_7', 'rentmail_overdue_7']);
    expect(mail[0]!.day).toBe(7);
    expect(mail[1]!.day).toBe(8);
    expect(mail[0]!.senderEmail).toBe('desk@starlitemotel.local');
  });
});

describe('P6.4 rent lines (templates)', () => {
  it('fills amount and day placeholders deterministically', () => {
    expect(pickRentReminderLine('s', 140, 7)).toContain('$140.00');
    expect(pickRentReminderLine('s', 140, 7)).toContain('7');
    expect(pickRentSternLine('s', 155, 7)).toContain('$155.00');
    expect(pickRentNudgeLine('s', 155)).toContain('$155.00');
    expect(pickRentThanksLine('s')).toBe(pickRentThanksLine('s'));
  });
});

describe('P6.4 relief valves (data + engine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('offers a 3-hour overtime shift in the door options', () => {
    const ot = DOOR_OPTIONS.find((d) => d.id === 'overtime_shift')!;
    expect(ot).toBeDefined();
    expect(ot.durationMinutes).toBe(180);
    expect(ot.cashReward).toBe(52);
    expect(ot.actionType).toBe('work');
  });

  it('offers home cooking in the kettle options and honors it', () => {
    const groceries = BEVERAGE_OPTIONS.find((b) => b.id === 'cook_groceries')!;
    expect(groceries.cashCost).toBe(8);
    (sim.economy as any).state.pantry.groceries = 1; // stocked pantry required
    sim.advanceGameMinutes(20 * 60, 'long day'); // hunger 30 → 90
    const cashBefore = sim.getState().player.cash;
    const res = sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'groceries' });
    expect(res.success).toBe(true);
    expect(sim.getState().player.cash).toBe(cashBefore - 8);
    expect(sim.getState().player.hunger).toBeLessThanOrEqual(30);
  });
});

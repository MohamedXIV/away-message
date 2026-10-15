import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('PlayerActionRuntime production dispatch', () => {
  it('preserves canonical cash transactions and subscriber publication', () => {
    const game = new SimulationEngine();
    const before = game.economy.getState().cash;
    const observed: number[] = [];
    const unsubscribe = game.subscribe((state) => { observed.push(state.player.cash); });

    expect(game.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 18, reason: 'test shift' }).success).toBe(true);
    expect(game.dispatchAction({ type: 'PLAYER_SPEND_CASH', amount: 5, reason: 'test fare' }).success).toBe(true);
    expect(game.economy.getState().cash).toBe(before + 13);
    expect(observed.at(-1)).toBe(before + 13);
    expect(game.exportSnapshot().player.cash).toBe(before + 13);
    unsubscribe();
  });

  it('retains minute ownership and time advancement through the action port', () => {
    const game = new SimulationEngine();
    const before = game.clock.getTotalMinutes();
    expect(game.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 3, reason: 'player action test' }).success).toBe(true);
    expect(game.clock.getTotalMinutes()).toBe(before + 3);
    expect(game.getState().time.totalMinutes).toBe(before + 3);
  });

  it('keeps retired direct OS upgrades blocked by the v6 computer policy', () => {
    const game = new SimulationEngine();
    const result = game.dispatchAction({ type: 'HARDWARE_UPGRADE_OS', targetOs: 'Orion_5.0', cost: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/retired/);
  });
});

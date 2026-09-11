import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { totalDeliveryBacklogExtra } from '../../src/engine/WorldModifiers';

/**
 * RED-first TDD for #46: WorldEventsEngine publishes bounded modifiers,
 * owning domains apply them. WorldEventsEngine is the sole event truth;
 * queries never mutate source or consumer state.
 */
describe('World event modifiers (#46)', () => {
  it('1. same triggered event + time yields the same modifiers', () => {
    const first = new SimulationEngine();
    const second = new SimulationEngine();
    const atMinute = 4 * 1440 + 30;
    first.world.triggerEventById('city_canal_festival', atMinute);
    second.world.triggerEventById('city_canal_festival', atMinute);

    expect(first.world.queryActiveModifiers({ atMinute })).toEqual(
      second.world.queryActiveModifiers({ atMinute }),
    );
  });

  it('2. inactive/untriggered event publishes no active effect', () => {
    const sim = new SimulationEngine();
    // Festival catalog exists but nothing triggered yet on day 1.
    expect(sim.world.queryActiveModifiers({ atMinute: 100 })).toEqual([]);
    expect(sim.world.queryActiveModifiers({ domain: 'delivery', atMinute: 100 })).toEqual([]);
  });

  it('3. modifier activates and expires deterministically', () => {
    const sim = new SimulationEngine();
    const firedAt = 4 * 1440;
    sim.world.triggerEventById('city_canal_festival', firedAt);

    // Just before the trigger: nothing.
    expect(sim.world.queryActiveModifiers({ atMinute: firedAt - 1 })).toEqual([]);
    // At trigger and inside the 2880-minute window: delivery + life modifiers.
    const active = sim.world.queryActiveModifiers({ atMinute: firedAt });
    expect(active.map((m) => m.id).sort()).toEqual([
      'festival_courier_backlog',
      'festival_night_opportunity',
    ]);
    expect(sim.world.queryActiveModifiers({ atMinute: firedAt + 2880 })).toHaveLength(2);
    // Past the window: expired.
    expect(sim.world.queryActiveModifiers({ atMinute: firedAt + 2881 })).toEqual([]);
  });

  it('4. large time jump matches incremental final modifier state', () => {
    // Same canonical trigger in both sims; only the post-trigger time path differs.
    const jumped = new SimulationEngine();
    const stepped = new SimulationEngine();
    const firedAt = jumped.clock.getTotalMinutes();
    expect(stepped.clock.getTotalMinutes()).toBe(firedAt);
    jumped.world.triggerEventById('city_canal_festival', firedAt);
    stepped.world.triggerEventById('city_canal_festival', firedAt);

    jumped.advanceGameMinutes(1000, 'single jump');
    for (let i = 0; i < 10; i++) stepped.advanceGameMinutes(100, 'small step');
    expect(jumped.clock.getTotalMinutes()).toBe(stepped.clock.getTotalMinutes());
    // Inside the 2880-minute festival window on both paths.
    expect(
      jumped.world.queryActiveModifiers({ atMinute: jumped.clock.getTotalMinutes() }),
    ).toEqual(
      stepped.world.queryActiveModifiers({ atMinute: stepped.clock.getTotalMinutes() }),
    );
    expect(jumped.world.queryActiveModifiers({ atMinute: jumped.clock.getTotalMinutes() })).toHaveLength(2);

    // And expiry agrees across both paths once the window passes.
    jumped.advanceGameMinutes(2000, 'past the window');
    for (let i = 0; i < 20; i++) stepped.advanceGameMinutes(100, 'past the window');
    expect(jumped.clock.getTotalMinutes()).toBe(stepped.clock.getTotalMinutes());
    expect(jumped.world.queryActiveModifiers({ atMinute: jumped.clock.getTotalMinutes() })).toEqual([]);
    expect(stepped.world.queryActiveModifiers({ atMinute: stepped.clock.getTotalMinutes() })).toEqual([]);
  });

  it('5. modifier query causes zero source/consumer mutation', () => {
    const sim = new SimulationEngine();
    sim.world.triggerEventById('city_canal_festival', 4 * 1440);
    const before = sim.exportSnapshot();
    for (let i = 0; i < 5; i++) {
      sim.world.queryActiveModifiers({ atMinute: 4 * 1440 + i });
      sim.world.queryActiveModifiers({ domain: 'delivery', atMinute: 4 * 1440 + i });
    }
    expect(sim.exportSnapshot()).toEqual(before);
  });

  it('7. objective event effect is independent from per-character knowledge', () => {
    const sim = new SimulationEngine();
    const [actor] = sim.social.getBuddies();
    if (!actor) throw new Error('Expected at least one Away character.');
    const firedAt = 4 * 1440;
    sim.world.triggerEventById('city_canal_festival', firedAt);
    const knowledgeBefore = sim.world.getBuddyKnowledgeMap();

    const modifiers = sim.world.queryActiveModifiers({ atMinute: firedAt });
    expect(modifiers.length).toBeGreaterThan(0);
    // Querying touches no attitudes/knowledge; engine owns knowledge separately.
    expect(sim.world.getBuddyKnowledgeMap()).toEqual(knowledgeBefore);
    // Modifiers carry provenance, never attitudes or takes.
    for (const modifier of modifiers) {
      expect(modifier).not.toHaveProperty('attitude');
      expect(modifier).not.toHaveProperty('personalTake');
      expect(modifier.sourceEventId).toBe('city_canal_festival');
    }
  });

  it('8. save/reload reconstructs an equivalent modifier set from canonical event truth', () => {
    const first = new SimulationEngine();
    const firedAt = 4 * 1440;
    first.world.triggerEventById('city_canal_festival', firedAt);
    const before = first.world.queryActiveModifiers({ atMinute: firedAt + 60 });

    const reloaded = new SimulationEngine(first.exportSnapshot() as never);
    expect(reloaded.world.queryActiveModifiers({ atMinute: firedAt + 60 })).toEqual(before);
  });

  it('9. repeated querying/processing is idempotent', () => {
    const sim = new SimulationEngine();
    sim.world.triggerEventById('city_canal_festival', 4 * 1440);
    const first = sim.world.queryActiveModifiers({ atMinute: 4 * 1440 + 10 });
    const second = sim.world.queryActiveModifiers({ atMinute: 4 * 1440 + 10 });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    // Returns are frozen views: mutating a detached clone cannot corrupt later queries.
    expect(Object.isFrozen(second[0])).toBe(true);
    const tampered = { ...(second[0] as object), kind: 'hacked' };
    expect((tampered as { kind: string }).kind).toBe('hacked');
    expect(sim.world.queryActiveModifiers({ atMinute: 4 * 1440 + 10 })).toEqual(first);
  });

  it('10. no AI/provider dependency affects canonical modifiers', () => {
    const sim = new SimulationEngine();
    sim.world.triggerEventById('city_canal_festival', 4 * 1440);
    const modifiers = sim.world.queryActiveModifiers({ atMinute: 4 * 1440 + 5 });
    // Pure rules output: JSON-stable with no key, no service, no fallback involved.
    expect(JSON.parse(JSON.stringify(modifiers))).toEqual(modifiers);
    expect(totalDeliveryBacklogExtra(modifiers)).toBe(360);
  });

  it('supports domain/kind/target filtering without leaking other domains', () => {
    const sim = new SimulationEngine();
    sim.world.triggerEventById('city_canal_festival', 4 * 1440);
    sim.world.triggerEventById('orion_os_7_release', 4 * 1440 + 5);
    const atMinute = 4 * 1440 + 10;

    const delivery = sim.world.queryActiveModifiers({ domain: 'delivery', atMinute });
    expect(delivery).toHaveLength(1);
    expect(delivery[0]?.kind).toBe('courier_backlog');

    const life = sim.world.queryActiveModifiers({ domain: 'life', atMinute });
    expect(life.map((m) => m.id).sort()).toEqual([
      'festival_night_opportunity',
      'os7_upgrade_opportunity',
    ]);

    // Transit publishes nothing yet (#35 owns the future consumer).
    expect(sim.world.queryActiveModifiers({ domain: 'transit', atMinute })).toEqual([]);
  });
});

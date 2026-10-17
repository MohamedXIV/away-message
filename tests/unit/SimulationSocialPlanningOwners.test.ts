import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine, normalizeBuddyId } from '../../src/engine/SocialEngine';
import { PlayerReadLedger } from '../../src/engine/social/PlayerReadLedger';
import { MediationLedger } from '../../src/engine/social/MediationLedger';

describe('#173 player-read and mediation canonical owners', () => {
  it('learns and aligns detached beliefs with bounded certainty, then restores exactly', () => {
    const alive = new Set(['a', 'b']);
    const owner = new PlayerReadLedger(normalizeBuddyId, id => alive.has(id));
    expect(owner.get('unknown')).toEqual(PlayerReadLedger.neutral());
    owner.observe('unknown', { loyalty: 99 }, 5);
    expect(owner.exportState()).toEqual({});
    for (let i = 0; i < 6; i++) {
      owner.observe('a', { warmth: 95 }, 2);
      owner.observe('b', { warmth: 5 }, 2);
    }
    expect(owner.align('a', 'b', 3)).toBe(true);
    expect(owner.buildContext('a')).toContain('Their read of you');
    const saved = owner.exportState();
    saved.a!.beliefs.warmth = -1;
    expect(owner.get('a').beliefs.warmth).toBeGreaterThan(0);
    const restored = new PlayerReadLedger(normalizeBuddyId, id => alive.has(id));
    restored.restore(owner.exportState());
    expect(restored.exportState()).toEqual(owner.exportState());
    restored.forget('a');
    expect(restored.get('a')).toEqual(PlayerReadLedger.neutral());
    expect(restored.get('b').certainty).toBe(48);
  });

  it('validates persisted beliefs and leaves unknown roster reads inert', () => {
    const reads = new PlayerReadLedger(normalizeBuddyId, id => id === 'a');
    reads.restore({ a: { beliefs: { shyness: 900, warmth: -20, discipline: 60, spontaneity: 50, loyalty: 50 },
      certainty: 1000, updatedDay: -2 } } as any);
    expect(reads.get('a').certainty).toBe(100);
    expect(reads.get('a').updatedDay).toBe(1);
    expect(reads.get('a').beliefs.shyness).toBe(100);
    expect(reads.get('a').beliefs.warmth).toBe(0);
    reads.observe('b', { warmth: 90 }, 2);
    expect(reads.get('b')).toEqual(PlayerReadLedger.neutral());
  });

  it('caps/deduplicates mediation, detaches reads, retains state/status and prunes removed actors', () => {
    const owner = new MediationLedger(normalizeBuddyId, id => ['a', 'b', 'c'].includes(id), 2);
    const one = owner.request('a', 'b', 'introduce', 2)!;
    expect(owner.request('a', 'b', 'introduce', 2)).toBeNull();
    expect(owner.request('b', 'c', 'ask_about', 2)).not.toBeNull();
    expect(owner.request('a', 'c', 'strengthen', 2)).toBeNull();
    one.status = 'exposed';
    expect(owner.get(one.id)?.status).toBe('open');
    expect(owner.resolve(one.id, 'badmouth', 4)?.status).toBe('sabotaged');
    expect(owner.getOpen()).toHaveLength(1);
    const exposed = owner.expose('a', 'b', 5, () => 100, vi.fn());
    expect(exposed).toHaveLength(1);
    expect(exposed[0]?.status).toBe('exposed');
    expect(owner.expose('a', 'b', 5, () => 100, vi.fn())).toHaveLength(0);
    const saved = owner.exportRecords();
    const copy = new MediationLedger(normalizeBuddyId, () => true, 2);
    copy.restore(saved);
    expect(copy.exportRecords()).toEqual(saved);
    copy.forgetActor('a');
    expect(copy.get(one.id)).toBeUndefined();
    expect(owner.get(one.id)).toBeDefined();
  });

  it('preserves full Social mediation effects, event payloads and deterministic save/load', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const spy = vi.spyOn(bus, 'emit');
    const [a, b] = social.getBuddies();
    const rec = social.requestMediation(a!.id, b!.id, 'strengthen', 2)!;
    expect(spy).toHaveBeenCalledWith('social:mediation_requested', { mediation: rec });
    expect(social.respondMediation(rec.id, 'badmouth', 3)?.status).toBe('sabotaged');
    social.adjustNpcBond(a!.id, b!.id, { suspicion: 100 }, 3);
    social.adjustNpcBond(b!.id, a!.id, { suspicion: 100 }, 3);
    let exposed = false;
    for (let day = 3; day <= 60; day++) {
      if (social.checkMediationExposure(a!.id, b!.id, day).length) { exposed = true; break; }
    }
    expect(exposed).toBe(true);
    expect(spy).toHaveBeenCalledWith('social:mediation_exposed',
      { mediation: expect.objectContaining({ id: rec.id, status: 'exposed' }) });
    expect(social.getPlayerRead(a!.id).beliefs.loyalty).toBeLessThan(50);
    const snapshot = social.getState();
    expect(new SocialEngine(new EventBus(), snapshot).getState()).toEqual(snapshot);
    social.removeBuddy(a!.id);
    expect(social.getMediation(rec.id)).toBeUndefined();
    expect(new SocialEngine(new EventBus(), snapshot).getMediation(rec.id)?.status).toBe('exposed');
  });
});

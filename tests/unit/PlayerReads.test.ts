import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { EventBus } from '../../src/engine/EventBus';
import { PLAYER_TRAITS } from '../../src/engine/characterTemplates';
import { planInitiatives, type InitiativeEngine } from '../../src/apps/pulse/utils/initiatives';
import { buildDmChatContext } from '../../src/apps/pulse/utils/chatContext';

describe('Player fixed canon + neutral priors', () => {
  it('defines the introvert protagonist (shy, homebound, taciturn)', () => {
    expect(PLAYER_TRAITS.shyness).toBeGreaterThanOrEqual(80);
    expect(PLAYER_TRAITS.spontaneity).toBeLessThanOrEqual(30);
  });

  it('starts every read neutral with zero certainty (strangers misread nothing yet)', () => {
    const social = new SocialEngine(new EventBus());
    const read = social.getPlayerRead('maya');
    expect(read.beliefs).toEqual({ shyness: 50, warmth: 50, discipline: 50, spontaneity: 50, loyalty: 50 });
    expect(read.certainty).toBe(0);
    expect(social.buildPlayerReadContext('maya')).toBe('');
  });
});

describe('PlayerReads learning', () => {
  it('learns fast at first, slower later (certainty-gated rate)', () => {
    const social = new SocialEngine(new EventBus());
    social.observePlayerTrait('maya', { warmth: 80 }, 1);
    const first = social.getPlayerRead('maya');
    expect(first.beliefs.warmth).toBeGreaterThan(50);
    expect(first.certainty).toBe(8);
    expect(first.beliefs.shyness).toBe(50); // untouched dims stay put
    social.observePlayerTrait('maya', { warmth: 80 }, 1);
    const second = social.getPlayerRead('maya');
    expect(second.beliefs.warmth).toBeGreaterThan(first.beliefs.warmth);
    expect(second.beliefs.warmth - first.beliefs.warmth)
      .toBeLessThan(first.beliefs.warmth - 50); // diminishing steps
    expect(second.certainty).toBe(16);
  });

  it('recovers from an early misread (quiet mistaken for cold, then corrected)', () => {
    const social = new SocialEngine(new EventBus());
    social.observePlayerTrait('maya', { warmth: 15 }, 1); // terse early days
    const cold = social.getPlayerRead('maya').beliefs.warmth;
    expect(cold).toBeLessThan(50);
    for (let i = 0; i < 5; i++) social.observePlayerTrait('maya', { warmth: 80 }, 2);
    const corrected = social.getPlayerRead('maya').beliefs.warmth;
    expect(corrected).toBeGreaterThan(cold);
  });

  it('reads kept/broken promises as loyalty + discipline', () => {
    const kept = new SocialEngine(new EventBus());
    kept.addPromise('maya', 'help carry boxes on saturday', 1);
    const open = kept.getOpenPromises('maya')[0]!;
    kept.resolvePromise('maya', open.id, true, 2);
    expect(kept.getPlayerRead('maya').beliefs.loyalty).toBeGreaterThan(50);

    const broken = new SocialEngine(new EventBus());
    broken.addPromise('maya', 'help carry boxes on saturday', 1);
    const open2 = broken.getOpenPromises('maya')[0]!;
    broken.resolvePromise('maya', open2.id, false, 2);
    expect(broken.getPlayerRead('maya').beliefs.loyalty).toBeLessThan(50);
  });

  it('reads mediation help as loyal, exposure as proof of disloyalty', () => {
    const engine = new SimulationEngine();
    const rec = engine.social.requestMediation('maya', 'ryan', 'introduce', 1)!;
    engine.dispatchAction({ type: 'MEDIATION_RESPOND', mediationId: rec.id, choice: 'help' });
    expect(engine.social.getPlayerRead('maya').beliefs.loyalty).toBeGreaterThan(50);

    const engine2 = new SimulationEngine();
    const rec2 = engine2.social.requestMediation('maya', 'ryan', 'strengthen', 1)!;
    engine2.dispatchAction({ type: 'MEDIATION_RESPOND', mediationId: rec2.id, choice: 'badmouth' });
    engine2.social.adjustNpcBond('maya', 'ryan', { suspicion: 100 }, 1);
    engine2.social.adjustNpcBond('ryan', 'maya', { suspicion: 100 }, 1);
    for (let day = 1; day <= 500; day++) {
      if (engine2.social.checkMediationExposure('maya', 'ryan', day).length > 0) break;
    }
    expect(engine2.social.getMediation(rec2.id)?.status).toBe('exposed');
    expect(engine2.social.getPlayerRead('maya').beliefs.loyalty).toBeLessThan(50);
    expect(engine2.social.getPlayerRead('ryan').beliefs.loyalty).toBeLessThan(50);
  });

  it('reads DM tone and brevity (short = shy, warm words = kind, cold = distant)', () => {
    const engine = new SimulationEngine();
    engine.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'maya', text: 'ok' });
    const terse = engine.social.getPlayerRead('maya');
    expect(terse.beliefs.shyness).toBeGreaterThan(50);
    engine.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'maya', text: 'thank you, that really means a lot to me' });
    expect(engine.social.getPlayerRead('maya').beliefs.warmth).toBeGreaterThan(50);
  });

  it('blends certain pairs toward each other (they compared notes), never the unsure', () => {
    const social = new SocialEngine(new EventBus());
    for (let i = 0; i < 6; i++) {
      social.observePlayerTrait('maya', { warmth: 90 }, 1);
      social.observePlayerTrait('ryan', { warmth: 10 }, 1);
    }
    expect(social.alignPlayerReads('maya', 'ryan', 2)).toBe(true);
    expect(social.getPlayerRead('maya').beliefs.warmth).toBeLessThan(90);
    expect(social.getPlayerRead('ryan').beliefs.warmth).toBeGreaterThan(10);
    // Unsure pairs never blend
    const fresh = new SocialEngine(new EventBus());
    expect(fresh.alignPlayerReads('maya', 'ryan', 2)).toBe(false);
  });

  it('round-trips reads through save state', () => {
    const social = new SocialEngine(new EventBus());
    social.observePlayerTrait('maya', { warmth: 80, loyalty: 80 }, 3);
    const restored = new SocialEngine(new EventBus(), social.getState());
    expect(restored.getPlayerRead('maya')).toEqual(social.getPlayerRead('maya'));
  });
});

describe('PlayerReads prompt + mechanical effects', () => {
  it('speaks qualitatively in prompts only once an impression forms', () => {
    const engine = new SimulationEngine();
    const fresh = buildDmChatContext({
      engine: engine as any,
      buddyId: 'maya',
      playerText: 'hey',
      pulse: { conversationMemory: {}, buddyFacts: {}, conversationSummaries: {}, recentReplies: {} },
      day: 1,
      totalMinutes: 600,
    });
    expect(fresh.relationshipSummary).not.toContain('Their read of you');
    for (let i = 0; i < 4; i++) engine.social.observePlayerTrait('maya', { warmth: 85 }, 1);
    const warmed = buildDmChatContext({
      engine: engine as any,
      buddyId: 'maya',
      playerText: 'hey',
      pulse: { conversationMemory: {}, buddyFacts: {}, conversationSummaries: {}, recentReplies: {} },
      day: 1,
      totalMinutes: 600,
    });
    expect(warmed.relationshipSummary).toContain('Their read of you');
    expect(warmed.relationshipSummary).toContain('kind');
  });

  it('cold-read players get fewer voluntary check-ins', () => {
    const stub: InitiativeEngine = {
      social: {
        getBuddies: () => [
          { id: 'warm_seen', displayName: 'WarmSeen', status: 'friend' as const, archetype: 'regular' as const },
          { id: 'cold_seen', displayName: 'ColdSeen', status: 'friend' as const, archetype: 'regular' as const },
        ],
        getRelationshipStage: () => 'friend' as const,
        getPresence: () => ({ status: 'online' as const }),
        getDailyMood: () => 'warm' as const,
        getOpenPromises: () => [],
        getTraits: () => ({ shyness: 25, warmth: 78, spontaneity: 72 }),
        getPlayerRead: (id: string) => ({
          beliefs: { warmth: id === 'warm_seen' ? 90 : 10 },
          certainty: 80,
        }),
      },
    };
    const counts: Record<string, number> = { warm_seen: 0, cold_seen: 0 };
    for (let day = 1; day <= 120; day++) {
      const { plans } = planInitiatives(stub, { day, blockedIds: [], initiatedToday: {}, maxCount: 10, salt: 'login' });
      for (const p of plans) counts[p.buddyId] = (counts[p.buddyId] ?? 0) + 1;
    }
    expect(counts['warm_seen']).toBeGreaterThan(counts['cold_seen'] ?? 0);
  });

  it('deeply distrusted players stop receiving mediation asks', () => {
    const engine = new SimulationEngine();
    for (const buddy of engine.social.getBuddies()) {
      for (let i = 0; i < 12; i++) engine.social.observePlayerTrait(buddy.id, { loyalty: 0 }, 1);
      expect(engine.social.getPlayerRead(buddy.id).beliefs.loyalty).toBeLessThan(20);
    }
    for (let i = 0; i < 30; i++) engine.advanceGameMinutes(1440, 'untrusted weeks');
    expect(engine.social.getOpenMediations()).toHaveLength(0);
    for (const buddy of engine.social.getBuddies()) {
      expect(engine.social.getMessages(buddy.id).filter((m) => m.tags?.includes('mediation'))).toHaveLength(0);
    }
  });
});

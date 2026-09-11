// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { SocialEngine, traitCompatibility, npcBondKey, NPC_SOCIAL_ACTION_DELTAS } from '../../src/engine/SocialEngine';
import { EventBus } from '../../src/engine/EventBus';
import { buildCharacter, validatePersistedBuddy } from '../../src/engine/CharacterEngine';
import { classifyScheduleBlock, pickLeaveLine, LEAVE_LINES } from '../../src/engine/characterTemplates';
import { buildDmChatContext } from '../../src/apps/pulse/utils/chatContext';
import { planInitiatives, nerveForInitiative, buzzChanceFor, type InitiativeEngine } from '../../src/apps/pulse/utils/initiatives';
import { NPC_BUZZ_LINES } from '../../src/engine/characterTemplates';
import {
  checkSaveCompatibility,
  loadSlotSnapshot,
  migrateSnapshotToV4,
  saveSlot,
  SAVE_FORMAT_VERSION,
} from '../../src/persistence/slots';
import { db } from '../../src/persistence/db';

function advanceDays(engine: SimulationEngine, days: number): void {
  for (let i = 0; i < days; i++) engine.advanceGameMinutes(1440, `test day ${i + 1}`);
}

describe('Character Lives v4 save migration', () => {
  beforeEach(async () => {
    await db.saves.clear().catch(() => {});
  });

  it('bumps the format to 4 but keeps v2/v3 snapshots loadable', () => {
    expect(SAVE_FORMAT_VERSION).toBeGreaterThanOrEqual(4);
    expect(checkSaveCompatibility({ version: 2, snapshot: {} } as any).status).toBe('ok');
    expect(checkSaveCompatibility({ version: 3, snapshot: {} } as any).status).toBe('ok');
    expect(checkSaveCompatibility({ version: 4, snapshot: {} } as any).status).toBe('ok');
    expect(checkSaveCompatibility({ version: 5, snapshot: {} } as any).status).toBe('ok');
    expect(checkSaveCompatibility({ version: SAVE_FORMAT_VERSION, snapshot: {} } as any).status).toBe('ok');
    expect(checkSaveCompatibility({ version: SAVE_FORMAT_VERSION + 1, snapshot: {} } as any).status).toBe('refused');
    expect(checkSaveCompatibility({ version: 3 } as any).status).toBe('legacy');
  });

  it('migrates a v3 snapshot deterministically without mutating input', () => {
    const v3 = {
      social: {
        relationships: {
          maya: { familiarity: 10, trust: 20, comfort: 30, respect: 40, annoyance: 0 },
        },
        presence: {},
        conversations: {},
        buddies: {
          sam_guitar: {
            id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar',
            schedule: { 1: [{ startMinuteOfDay: 0, endMinuteOfDay: 1440, status: 'online', awayMessage: 'hi' }] },
            initialRelationships: { familiarity: 10, trust: 10, comfort: 10, respect: 10, annoyance: 0 },
            typingSpeedWpm: 70, archetype: 'artist', status: 'acquaintance', metVia: 'intro', isProcedural: true, createdDay: 2,
          },
        },
      },
    } as any;
    const migrated = migrateSnapshotToV4(v3, 3);
    // Input untouched
    expect(v3.social.buddies.sam_guitar.traits).toBeUndefined();
    expect(v3.social.relationships.maya.affection).toBeUndefined();
    // Dims backfilled honest-neutral
    const mayaRel = migrated.social.relationships.maya!;
    expect(mayaRel.affection).toBe(0);
    expect(mayaRel.suspicion).toBe(0);
    expect(mayaRel.resentment).toBe(0);
    expect(mayaRel.trust).toBe(20);
    // Traits match a fresh build for the same id (same deterministic formula)
    const fresh = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar', archetype: 'artist' });
    expect(migrated.social.buddies!.sam_guitar!.traits).toEqual(fresh.definition.traits);
    // New sections default empty
    expect(migrated.social.npcBonds).toEqual({});
    expect(migrated.social.agenda).toEqual({});
    expect(migrated.social.mediations).toEqual([]);
    expect(migrated.social.npcSocialLog).toEqual([]);
    // Stable across calls
    expect(migrateSnapshotToV4(v3, 3)).toEqual(migrated);
  });

  it('loadSlotSnapshot upgrades a stored v3 record on the way in', async () => {
    const sim = new SimulationEngine();
    await saveSlot(sim, 'slot_1');
    const record = await db.saves.get('slot_1');
    expect(record?.version).toBe(SAVE_FORMAT_VERSION);
    // Rewrite the row as a v3 document (no traits anywhere)
    const snapshot = JSON.parse(JSON.stringify(record!.snapshot)) as any;
    for (const def of Object.values(snapshot.social.buddies ?? {})) delete (def as any).traits;
    for (const rel of Object.values(snapshot.social.relationships ?? {})) {
      delete (rel as any).affection; delete (rel as any).attraction;
      delete (rel as any).suspicion; delete (rel as any).resentment;
    }
    delete snapshot.social.npcBonds;
    await db.saves.put({ ...record!, version: 3, snapshot });
    const loaded = await loadSlotSnapshot('slot_1');
    expect(loaded).not.toBeNull();
    const maya = (loaded!.social.relationships as any).maya;
    expect(maya.affection).toBe(0);
    expect(maya.trust).toBeGreaterThanOrEqual(0);
    // Restored engine backfills procedural traits and reads neutral bonds
    const revived = new SimulationEngine(loaded as any);
    expect(revived.social.getNpcBond('maya', 'ryan').romance).toBe('none');
    await db.saves.delete('slot_1');
  });
});

describe('Character Lives fixed traits (Big5-lite)', () => {
  it('hand-authors the core 4 (maya reads shy-guarded)', () => {
    const social = new SocialEngine(new EventBus());
    const maya = social.getTraits('maya');
    expect(maya.shyness).toBeGreaterThanOrEqual(80);
    expect(social.getTraits('ryan').shyness).toBeLessThan(maya.shyness);
    expect(social.getTraits('nora').loyalty).toBeGreaterThanOrEqual(70);
    // Copies, never live refs
    maya.shyness = 0;
    expect(social.getTraits('maya').shyness).toBeGreaterThanOrEqual(80);
  });

  it('builds stable procedural traits within a small jitter of the archetype base', () => {
    const a = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar', archetype: 'artist' });
    const b = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar', archetype: 'artist' });
    expect(a.definition.traits).toEqual(b.definition.traits);
    for (const dim of ['shyness', 'warmth', 'discipline', 'spontaneity', 'loyalty'] as const) {
      expect(Math.abs(a.definition.traits[dim] - 70) <= 30).toBe(true); // sane range, artist-leaning
    }
    const explicit = buildCharacter({
      id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar', traits: { shyness: 5 },
    });
    expect(explicit.definition.traits.shyness).toBe(5);
  });

  it('backfills v3 persisted defs deterministically', () => {
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar' });
    const v3def = JSON.parse(JSON.stringify(definition)) as Record<string, unknown>;
    delete v3def.traits;
    const res = validatePersistedBuddy(v3def);
    expect(res.ok).toBe(true);
    expect(res.definition?.traits).toEqual(definition.traits);
  });

  it('never mutates traits through social actions', () => {
    const social = new SocialEngine(new EventBus());
    const before = social.getTraits('maya');
    social.applySocialAction('maya', 'vulnerable_share');
    social.applySocialAction('maya', 'dismissive');
    expect(social.getTraits('maya')).toEqual(before);
  });

  it('traitCompatibility is symmetric, bounded, and 100 for identical twins', () => {
    const social = new SocialEngine(new EventBus());
    const maya = social.getTraits('maya');
    expect(traitCompatibility(maya, maya)).toBe(100);
    const ryan = social.getTraits('ryan');
    const c = traitCompatibility(maya, ryan);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(100);
    expect(traitCompatibility(maya, ryan)).toBe(traitCompatibility(ryan, maya));
  });
});

describe('Character Lives directed NPC bonds', () => {
  it('reads neutral by default and writes directionally with clamping', () => {
    const social = new SocialEngine(new EventBus());
    expect(social.getNpcBond('maya', 'ryan').dims.familiarity).toBe(0);
    expect(social.getNpcBond('maya', 'maya').romance).toBe('none');
    const key = npcBondKey('ryan', 'maya');
    expect(key).toBe('ryan__maya');
    expect(npcBondKey('maya', 'maya')).toBe('');
    social.adjustNpcBond('maya', 'ryan', { familiarity: 200, annoyance: -50 }, 1);
    expect(social.getNpcBond('maya', 'ryan').dims.familiarity).toBe(100);
    expect(social.getNpcBond('maya', 'ryan').dims.annoyance).toBe(0);
    // Directional: reverse untouched
    expect(social.getNpcBond('ryan', 'maya').dims.familiarity).toBe(0);
    // Unknown buddies never write
    expect(social.adjustNpcBond('maya', 'ghost', { familiarity: 5 }, 1)).toBeNull();
  });

  it('applies the fixed NPC action table (unknown names only read)', () => {
    const social = new SocialEngine(new EventBus());
    expect(NPC_SOCIAL_ACTION_DELTAS['warm_chat']).toBeDefined();
    social.applyNpcSocialAction('maya', 'ryan', 'deep_talk', 2);
    const bond = social.getNpcBond('maya', 'ryan');
    expect(bond.dims.trust).toBe(3);
    expect(bond.dims.affection).toBe(2);
    expect(bond.updatedDay).toBe(2);
    const before = social.getNpcBond('maya', 'ryan');
    expect(social.applyNpcSocialAction('maya', 'ryan', 'not_an_action', 2)).toEqual(before);
  });

  it('drops bonds with removed buddies and persists the rest', () => {
    const social = new SocialEngine(new EventBus());
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar' });
    social.registerBuddy(definition);
    social.adjustNpcBond('maya', 'sam_guitar', { familiarity: 10 }, 1);
    social.adjustNpcBond('maya', 'ryan', { familiarity: 10 }, 1);
    expect(social.removeBuddy('sam_guitar')).toBe(true);
    const state = social.getState();
    expect(state.npcBonds?.['maya__sam_guitar']).toBeUndefined();
    expect(state.npcBonds?.['maya__ryan']?.dims.familiarity).toBe(10);
    const restored = new SocialEngine(new EventBus(), state);
    expect(restored.getNpcBond('maya', 'ryan').dims.familiarity).toBe(10);
  });

  it('builds bounded bond context for prompts', () => {
    const social = new SocialEngine(new EventBus());
    expect(social.buildBondContext('maya')).toBe('');
    social.adjustNpcBond('maya', 'ryan', { affection: 40 }, 1);
    social.adjustNpcBond('ryan', 'maya', { affection: 40 }, 1);
    const ctx = social.buildBondContext('maya');
    expect(ctx).toContain('Ryan');
    expect(social.buildRomanceContext('maya')).toBe('Romance: single');
  });
});

describe('Character Lives NPC run-ins (player is not the center)', () => {
  it('runs overlapping-schedule run-ins within caps, deterministically', () => {
    const a = new SimulationEngine();
    const b = new SimulationEngine();
    advanceDays(a, 5);
    advanceDays(b, 5);
    const logA = a.social.getNpcSocialLog();
    const logB = b.social.getNpcSocialLog();
    expect(logA.length).toBeGreaterThan(0);
    expect(logA).toEqual(logB);
    // Max 3/day enforced
    for (let day = 1; day <= 6; day++) {
      expect(a.social.getNpcSocialLog(day).length).toBeLessThanOrEqual(3);
    }
    for (const entry of logA) {
      expect(entry.line.length).toBeGreaterThan(10);
      expect(entry.location.length).toBeGreaterThan(0);
    }
    // Bonds moved off neutral for at least one pair
    const moved = ['maya', 'ryan', 'nora', 'henderson'].some((x) =>
      ['maya', 'ryan', 'nora', 'henderson'].some((y) => {
        if (x === y) return false;
        const d = a.social.getNpcBond(x, y).dims;
        return d.familiarity > 0 || d.affection > 0 || d.annoyance > 0;
      })
    );
    expect(moved).toBe(true);
  });
});

describe('Character Lives polite goodbyes', () => {
  it('classifies sleep/work blocks and picks shy-soft leave lines', () => {
    expect(classifyScheduleBlock('asleep')).toBe('sleep');
    expect(classifyScheduleBlock('work @ cart')).toBe('work');
    expect(classifyScheduleBlock('office closed')).toBe('sleep');
    expect(classifyScheduleBlock('gaming / chilling')).toBeNull();
    // Shy buddies draw from the soft (apologetic) pool
    expect(LEAVE_LINES.sleep.soft).toContain(pickLeaveLine('sleep', 88, 'maya:1'));
    expect(LEAVE_LINES.work.direct).toContain(pickLeaveLine('work', 20, 'ryan:1'));
  });

  it('says goodbye once when a work block starts mid-contact', () => {
    const engine = new SimulationEngine(); // day 1, 08:00
    engine.social.sendMessage('ryan', 'player', 'ryan', 'hey, you working today?', 8 * 60 + 30);
    engine.advanceGameMinutes(60, 'morning'); // 09:00 — ryan offline @ work
    const leaves = engine.social.getMessages('ryan').filter((m) => m.tags?.includes('leave'));
    expect(leaves).toHaveLength(1);
    expect(leaves[0]?.tags).toContain('work');
    // No second goodbye later the same day
    engine.advanceGameMinutes(240, 'shift');
    expect(engine.social.getMessages('ryan').filter((m) => m.tags?.includes('leave'))).toHaveLength(1);
  });

  it('stays silent without recent contact', () => {
    const engine = new SimulationEngine();
    engine.advanceGameMinutes(600, 'quiet day');
    for (const buddy of engine.social.getBuddies()) {
      expect(engine.social.getMessages(buddy.id).filter((m) => m.tags?.includes('leave'))).toHaveLength(0);
    }
  });
});

describe('Character Lives weekly agenda planning', () => {
  it('fills free windows deterministically within caps', () => {
    const a = new SimulationEngine();
    const b = new SimulationEngine();
    advanceDays(a, 5);
    advanceDays(b, 5);
    let total = 0;
    for (const buddy of a.social.getBuddies()) {
      const agenda = a.social.getAgenda(buddy.id);
      expect(agenda).toEqual(b.social.getAgenda(buddy.id));
      total += agenda.length;
      for (let day = 1; day <= 7; day++) {
        expect(a.social.getAgenda(buddy.id, day).length).toBeLessThanOrEqual(4);
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});

describe('Character Lives mediations', () => {
  it('validates requests (no self, no ghosts, no dupes)', () => {
    const social = new SocialEngine(new EventBus());
    expect(social.requestMediation('maya', 'maya', 'introduce', 1)).toBeNull();
    expect(social.requestMediation('maya', 'ghost', 'introduce', 1)).toBeNull();
    const rec = social.requestMediation('maya', 'ryan', 'introduce', 1);
    expect(rec?.status).toBe('open');
    expect(social.requestMediation('maya', 'ryan', 'introduce', 1)).toBeNull();
    expect(social.getOpenMediations()).toHaveLength(1);
  });

  it('help fulfills with bond bumps and thanks; ignore mildly annoys', () => {
    const engine = new SimulationEngine();
    const rec = engine.social.requestMediation('maya', 'ryan', 'introduce', 1)!;
    const res = engine.dispatchAction({ type: 'MEDIATION_RESPOND', mediationId: rec.id, choice: 'help' });
    expect(res.success).toBe(true);
    expect((res.data as { status: string }).status).toBe('fulfilled');
    expect(engine.social.getNpcBond('maya', 'ryan').dims.familiarity).toBeGreaterThan(0);
    expect(engine.social.getMessages('maya').some((m) => m.tags?.includes('mediation'))).toBe(true);

    const rec2 = engine.social.requestMediation('nora', 'ryan', 'ask_about', 1)!;
    const before = engine.social.getRelationships('nora')!;
    engine.dispatchAction({ type: 'MEDIATION_RESPOND', mediationId: rec2.id, choice: 'ignore' });
    const after = engine.social.getRelationships('nora')!;
    expect(after.annoyance).toBeGreaterThan(before.annoyance);
  });

  it('badmouth stays quiet until the pair compares notes — then both crater', () => {
    const engine = new SimulationEngine();
    const trustBefore = engine.social.getRelationships('maya')!.trust;
    const rec = engine.social.requestMediation('maya', 'ryan', 'strengthen', 1)!;
    engine.dispatchAction({ type: 'MEDIATION_RESPOND', mediationId: rec.id, choice: 'badmouth' });
    expect(engine.social.getMediation(rec.id)?.status).toBe('sabotaged');
    // No immediate damage — they haven't talked yet
    expect(engine.social.getRelationships('maya')!.trust).toBe(trustBefore);
    // Suspicious pairs compare notes fast: boost suspicion, then scan days
    engine.social.adjustNpcBond('maya', 'ryan', { suspicion: 100 }, 1);
    engine.social.adjustNpcBond('ryan', 'maya', { suspicion: 100 }, 1);
    let exposedDay = -1;
    for (let day = 1; day <= 500; day++) {
      const exposed = engine.social.checkMediationExposure('maya', 'ryan', day);
      if (exposed.length > 0) {
        exposedDay = day;
        break;
      }
    }
    expect(exposedDay).toBeGreaterThan(0);
    expect(engine.social.getMediation(rec.id)?.status).toBe('exposed');
    expect(engine.social.getRelationships('maya')!.trust).toBeLessThan(trustBefore);
    expect(engine.social.getRelationships('ryan')!.trust).toBeLessThan(50);
    expect(engine.social.getCoreMemories('maya').some((m) => m.text.includes('compared notes'))).toBe(true);
  });

  it('rejects unknown or closed mediations', () => {
    const engine = new SimulationEngine();
    expect(engine.dispatchAction({ type: 'MEDIATION_RESPOND', mediationId: 'med_nope', choice: 'help' }).success).toBe(false);
  });

  it('NPCs ask the player for help on their own within a few weeks', () => {
    const engine = new SimulationEngine();
    let asked = false;
    for (let i = 0; i < 30 && !asked; i++) {
      engine.advanceGameMinutes(1440, 'waiting for asks');
      asked = engine.social.getOpenMediations().length > 0;
    }
    expect(asked).toBe(true);
  });
});

describe('Character Lives cozy romance', () => {
  it('forms crushes quietly, datings publicly, splits on festering bonds', () => {
    const engine = new SimulationEngine();
    expect(engine.social.buildRomanceContext('ryan')).toBe('Romance: single');
    // Mutual warmth + compatibility (ryan/maya compat is high)
    engine.social.adjustNpcBond('ryan', 'maya', { affection: 30, attraction: 20, familiarity: 20 }, 1);
    engine.social.adjustNpcBond('maya', 'ryan', { affection: 30, attraction: 20, familiarity: 20 }, 1);
    engine.advanceGameMinutes(1440, 'day 2');
    expect(engine.social.getNpcBond('ryan', 'maya').romance).toBe('crush');
    // Deepen both directions → dating (public witness line)
    engine.social.adjustNpcBond('ryan', 'maya', { affection: 25, comfort: 50, trust: 45, attraction: 15 }, 2);
    engine.social.adjustNpcBond('maya', 'ryan', { affection: 25, comfort: 50, trust: 45, attraction: 15 }, 2);
    engine.advanceGameMinutes(1440, 'day 3');
    expect(engine.social.getNpcBond('ryan', 'maya').romance).toBe('dating');
    expect(engine.social.getNpcBond('maya', 'ryan').romance).toBe('dating');
    expect(engine.social.isDatingAnyone('ryan')).toBe(true);
    expect(engine.social.buildRomanceContext('ryan')).toContain('dating Maya');
    expect(engine.social.getNpcSocialLog().some((l) => l.line.includes('seeing each other'))).toBe(true);
    // Festering resentment ends it with a witness line
    engine.social.adjustNpcBond('ryan', 'maya', { resentment: 60 }, 3);
    engine.advanceGameMinutes(1440, 'day 4');
    expect(engine.social.getNpcBond('ryan', 'maya').romance).toBe('none');
    expect(engine.social.isDatingAnyone('ryan')).toBe(false);
    expect(engine.social.getNpcSocialLog().some((l) => l.line.includes('split up'))).toBe(true);
  });
});

describe('Character Lives chat wiring', () => {
  it('injects temperament, ties, romance and plans into DM context', () => {
    const engine = new SimulationEngine();
    engine.social.adjustNpcBond('maya', 'ryan', { affection: 40 }, 1);
    engine.social.adjustNpcBond('ryan', 'maya', { affection: 40 }, 1);
    const ctx = buildDmChatContext({
      engine: engine as any,
      buddyId: 'maya',
      playerText: 'hey, are you seeing anyone lately?',
      pulse: { conversationMemory: {}, buddyFacts: {}, conversationSummaries: {}, recentReplies: {} },
      day: 1,
      totalMinutes: 600,
    });
    expect(ctx.persona).toContain('Temperament');
    expect(ctx.persona).toContain('shy 88');
    expect(ctx.relationshipSummary).toContain('Ties:');
    expect(ctx.relationshipSummary).toContain('Romance: single');
  });
});

describe('Character Lives initiative nerve (who messages first)', () => {
  function makeTraitStub(
    traitsById: Record<string, { shyness: number; warmth: number; spontaneity: number }>,
    opts?: { promiseHolder?: string }
  ): InitiativeEngine {
    const buddies = Object.keys(traitsById).map((id) => ({
      id, displayName: id, status: 'friend' as const, archetype: 'regular' as const,
    }));
    return {
      social: {
        getBuddies: () => buddies,
        getRelationshipStage: () => 'friend' as const,
        getPresence: () => ({ status: 'online' as const }),
        getDailyMood: () => 'warm' as const,
        getOpenPromises: (id: string) => (id === opts?.promiseHolder ? [{ text: 'bring tacos' }] : []),
        getTraits: (id: string) => traitsById[id],
      },
    };
  }

  it('scores nerve from temperament (shy low, bold high, close braver)', () => {
    const shy = { shyness: 88, warmth: 62, spontaneity: 45 }; // maya-like
    const bold = { shyness: 25, warmth: 78, spontaneity: 72 }; // ryan-like
    expect(nerveForInitiative('friend', shy)).toBeLessThan(nerveForInitiative('friend', bold));
    expect(nerveForInitiative('close', shy)).toBeGreaterThan(nerveForInitiative('friend', shy));
    expect(nerveForInitiative('friend', shy)).toBeLessThanOrEqual(10);
    expect(buzzChanceFor(88)).toBeGreaterThan(0);
    expect(buzzChanceFor(60)).toBe(0);
  });

  it('lets bold buddies message first far more often than shy ones', () => {
    const engine = makeTraitStub({
      ryan_like: { shyness: 25, warmth: 78, spontaneity: 72 },
      maya_like: { shyness: 88, warmth: 62, spontaneity: 45 },
    });
    const counts: Record<string, number> = { ryan_like: 0, maya_like: 0 };
    for (let day = 1; day <= 120; day++) {
      const { plans } = planInitiatives(engine, { day, blockedIds: [], initiatedToday: {}, maxCount: 10, salt: 'login' });
      for (const p of plans) counts[p.buddyId] = (counts[p.buddyId] ?? 0) + 1;
    }
    expect(counts['ryan_like']).toBeGreaterThanOrEqual(8);
    expect(counts['ryan_like']).toBeGreaterThan((counts['maya_like'] ?? 0) * 2);
  });

  it('exempts duty: even shy buddies chase open promises', () => {
    const engine = makeTraitStub(
      { maya_like: { shyness: 88, warmth: 62, spontaneity: 45 } },
      { promiseHolder: 'maya_like' }
    );
    let reminded = false;
    for (let day = 1; day <= 60 && !reminded; day++) {
      const { plans } = planInitiatives(engine, { day, blockedIds: [], initiatedToday: {}, maxCount: 10, salt: 'login' });
      reminded = plans.some((p) => p.kind === 'promise_reminder');
    }
    expect(reminded).toBe(true);
  });

  it('shy buddies buzz instead of typing (tagged plans from the buzz pool)', () => {
    const engine = makeTraitStub({
      shy_one: { shyness: 95, warmth: 100, spontaneity: 100 },
    });
    let buzz: { text: string; tags?: string[] } | undefined;
    for (let day = 1; day <= 60 && !buzz; day++) {
      const { plans } = planInitiatives(engine, { day, blockedIds: [], initiatedToday: {}, maxCount: 10, salt: 'login' });
      buzz = plans.find((p) => p.tags?.includes('buzz'));
    }
    expect(buzz).toBeDefined();
    expect(NPC_BUZZ_LINES).toContain(buzz!.text);
  });
});

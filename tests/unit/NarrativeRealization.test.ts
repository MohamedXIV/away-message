import { describe, expect, it, vi } from 'vitest';
import {
  NarrativeContextProjectionSchema,
  type NarrativeFrame,
} from '../../src/narrative/contracts';
import {
  NarrativeCoordinator,
  type NarrativeEffectOwner,
  type NarrativeSessionRef,
} from '../../src/narrative/NarrativeCoordinator';
import { DEFAULT_NARRATIVE_FLOWS } from '../../src/narrative/flows';
import {
  buildRealizationPrompt,
  buildUtterancePlan,
  realizeOffline,
  realizeUtterance,
  resolveRealizationTier,
  validateRealizedText,
} from '../../src/narrative/realization';

const session: NarrativeSessionRef = {
  flowId: 'test_flow',
  trigger: { kind: 'interaction', interactionId: 'test' },
  actorId: 'maya',
};

const context = NarrativeContextProjectionSchema.parse({
  currentDay: 2,
  currentTimeMinute: 600,
  timeOfDay: 'day',
  player: { cash: 40, energy: 70, fatigue: 20 },
  actor: {
    id: 'maya', reach: 'local', roles: ['diner-staff'], lifecycle: 'active',
    connection: 'known', relationshipStage: 'friend', trusted: true, conflicted: false,
  },
  flags: {},
  completedBeats: [],
});

function frame(text: string, tags: string[] = []): NarrativeFrame {
  return { text, tags, choices: [], canContinue: false, pendingEffects: [] };
}

function planFor(text: string, tags: string[], speakerKind: 'canonical_local' | 'surface_only' = 'canonical_local') {
  const plan = buildUtterancePlan({ frame: frame(text, tags), session, context, speakerKind });
  if (!plan) throw new Error('Expected a plan.');
  return plan;
}

describe('#183 realization tier policy', () => {
  it('keeps canonical actors at L0-L2 and surfaces at L3', () => {
    expect(resolveRealizationTier({ speakerKind: 'system', requestedTier: 'L2' })).toBe('L0');
    expect(resolveRealizationTier({ speakerKind: 'canonical_local', requestedTier: 'L1' })).toBe('L1');
    expect(resolveRealizationTier({ speakerKind: 'canonical_remote', requestedTier: 'L2' })).toBe('L2');
    expect(resolveRealizationTier({ speakerKind: 'canonical_local', requestedTier: 'L3' })).toBe('L2');
    expect(resolveRealizationTier({ speakerKind: 'canonical_local', exactAuthored: true, requestedTier: 'L2' })).toBe('L0');
    expect(resolveRealizationTier({ speakerKind: 'surface_only' })).toBe('L3');
    expect(resolveRealizationTier({ speakerKind: 'surface_only', requestedTier: 'L1' })).toBe('L1');
  });

  it('builds a bounded plan from authored Ink tags', () => {
    const plan = planFor(
      'Then the week comes out sideways, in pieces.',
      ['tier:l2', 'speech:reassure', 'fact:the week', 'fact:pieces', 'tone:warm', 'forbid:the exact reason'],
    );
    expect(plan.tier).toBe('L2');
    expect(plan.speakerId).toBe('maya');
    expect(plan.speakerKind).toBe('canonical_local');
    expect(plan.speechAct).toBe('reassure');
    expect(plan.offlineText).toBe('Then the week comes out sideways, in pieces.');
    expect(plan.requiredFacts).toEqual(['the week', 'pieces']);
    expect(plan.tone).toEqual(['warm']);
    expect(plan.forbiddenClaims).toEqual(['the exact reason']);
    expect(plan.maxChars).toBe(400);
  });

  it('clamps a canonical L3 tag to L2', () => {
    const plan = planFor('Some line.', ['tier:l3', 'fact:some line']);
    expect(plan.tier).toBe('L2');
  });

  it('returns no plan for an empty authored frame', () => {
    expect(buildUtterancePlan({ frame: frame('   '), session, context })).toBeNull();
  });
});

describe('#183 offline and AI realization', () => {
  const plan = planFor(
    'Then the week comes out sideways, in pieces.',
    ['tier:l2', 'speech:reassure', 'fact:the week', 'fact:pieces', 'tone:warm', 'forbid:the exact reason'],
  );

  it('uses the complete authored utterance offline', async () => {
    expect(realizeOffline(plan)).toMatchObject({ text: plan.offlineText, source: 'offline', tier: 'L2' });
    const realized = await realizeUtterance(plan);
    expect(realized.source).toBe('offline');
    expect(realized.text).toBe(plan.offlineText);
  });

  it('accepts AI wording that preserves required facts', async () => {
    const ai = vi.fn(async () => 'Okay. The week comes out sideways, in pieces. I am listening.');
    const realized = await realizeUtterance(plan, { ai });
    expect(ai).toHaveBeenCalledWith(plan);
    expect(realized.source).toBe('ai');
    expect(realized.text.toLowerCase()).toContain('the week');
  });

  it('falls back when AI omits a required fact', async () => {
    const realized = await realizeUtterance(plan, { ai: async () => 'I hear you.' });
    expect(realized.source).toBe('offline');
    expect(realized.text).toBe(plan.offlineText);
    expect(realized.fallbackReason).toContain('omitted required fact');
  });

  it('falls back when AI introduces a forbidden claim', async () => {
    const realized = await realizeUtterance(plan, {
      ai: async () => 'The week comes out sideways, in pieces, because of the exact reason.',
    });
    expect(realized.source).toBe('offline');
    expect(realized.fallbackReason).toContain('forbidden claim');
  });

  it('never calls AI for L0 exact-authored text', async () => {
    const exact = planFor('The office is closed today.', ['tier:l0']);
    const ai = vi.fn(async () => 'The office is shut.');
    const realized = await realizeUtterance(exact, { ai });
    expect(ai).not.toHaveBeenCalled();
    expect(realized.source).toBe('offline');
  });

  it('requires fact anchors before accepting L1/L2 AI wording', async () => {
    const unanchored = planFor('The silence settles.', ['tier:l1']);
    const realized = await realizeUtterance(unanchored, { ai: async () => 'Quiet, still.' });
    expect(realized.source).toBe('offline');
    expect(realized.fallbackReason).toContain('required-fact anchors');
  });

  it('allows noncanonical claims only at L3', async () => {
    const surface = planFor('The forum insists the canal is haunted.', ['tier:l3'], 'surface_only');
    expect(surface.tier).toBe('L3');
    const realized = await realizeUtterance(surface, {
      ai: async () => 'A guestbook post swears the canal is haunted by a modem ghost.',
    });
    expect(realized.source).toBe('ai');

    const canonical = planFor('Some canonical line.', ['tier:l3', 'fact:canonical line']);
    expect(canonical.tier).toBe('L2');
  });

  it('falls back on AI timeout without blocking offline interaction', async () => {
    const realized = await realizeUtterance(plan, {
      ai: () => new Promise<string>(() => {}),
      timeoutMs: 20,
    });
    expect(realized.source).toBe('offline');
    expect(realized.text).toBe(plan.offlineText);
    expect(realized.fallbackReason).toContain('timed out');
  });

  it('rejects multi-line and overlong AI text', () => {
    expect(validateRealizedText(plan, 'line one\nline two').ok).toBe(false);
    expect(validateRealizedText(plan, 'x'.repeat(plan.maxChars + 1)).ok).toBe(false);
  });

  it('builds a prompt with facts and forbidden claims but no effect payloads', () => {
    const prompt = buildRealizationPrompt(plan);
    expect(prompt.user).toContain('the week');
    expect(prompt.user).toContain('the exact reason');
    expect(prompt.system).toContain('surface wording');
    expect(prompt.user).not.toContain('social_act');
    expect(prompt.user).not.toContain('pendingEffects');
  });
});

describe('#183 realization cannot change canonical effects', () => {
  it('keeps validated effect payloads and pending state unchanged across AI realization', async () => {
    const effects: unknown[] = [];
    const owner: NarrativeEffectOwner = {
      handleEffect: (request) => {
        effects.push(request);
        return { accepted: true, committed: true };
      },
    };
    const coordinator = new NarrativeCoordinator({
      flows: DEFAULT_NARRATIVE_FLOWS,
      contextSource: {
        buildContext: () => context,
      },
      effectOwner: owner,
    });
    coordinator.requestInteraction({ interactionId: 'cafe_meeting', actorId: 'maya', placeId: 'place_a1' });
    coordinator.advanceToChoices();
    coordinator.choose(0);
    const effectsAfterChoice = JSON.parse(JSON.stringify(effects));
    const pendingAfterChoice = JSON.stringify(coordinator.getPendingEffects());

    const plan = coordinator.getUtterancePlan();
    expect(plan?.tier).toBe('L2');
    expect(JSON.stringify(plan)).not.toContain('social_act');
    const realized = await realizeUtterance(plan!, {
      ai: async () => 'Okay. The week comes out sideways, in pieces. I am listening.',
    });
    expect(realized.source).toBe('ai');

    expect(JSON.parse(JSON.stringify(effects))).toEqual(effectsAfterChoice);
    expect(JSON.stringify(coordinator.getPendingEffects())).toBe(pendingAfterChoice);
  });
});

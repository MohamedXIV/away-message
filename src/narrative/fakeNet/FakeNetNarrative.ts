import type { SimulationEngine } from '../../engine/SimulationEngine';
import type { NarrativeFrame } from '../contracts';
import {
  NarrativeCoordinator,
  type NarrativeFlowDefinition,
  type NarrativeSessionRef,
} from '../NarrativeCoordinator';
import { SimulationNarrativeAdapter } from '../SimulationNarrativeAdapter';
import { buildUtterancePlan } from '../realization/RealizationPolicy';
import { realizeUtterance } from '../realization/RealizeUtterance';
import type { AiUtteranceRealizer } from '../realization/contracts';
import nightboardCanalThread from '../ink/flows/nightboard-canal-thread.ink.json';
import generatedSiteCanalWatch from '../ink/flows/generated-site-canal-watch.ink.json';
import {
  assertSurfaceNarrative,
  isSurfaceProvenance,
  type SurfaceAuthor,
  type SurfaceCanonicalFact,
  type SurfaceKnownActor,
  type SurfaceNarrative,
  type SurfaceProvenance,
  type SurfaceStatement,
  type SurfaceStatementRole,
} from './contracts';

export const NIGHTBOARD_CANAL_FLOW_ID = 'nightboard_canal_thread';
export const NIGHTBOARD_CANAL_INTERACTION_ID = 'nightboard_canal_thread';
export const GENERATED_SITE_CANAL_FLOW_ID = 'generated_site_canal_watch';
export const GENERATED_SITE_CANAL_INTERACTION_ID = 'generated_site_canal_watch';

export const FAKE_NET_FLOWS: readonly NarrativeFlowDefinition[] = [
  {
    flowId: NIGHTBOARD_CANAL_FLOW_ID,
    compiledStory: nightboardCanalThread,
    startsOn: { interactionIds: [NIGHTBOARD_CANAL_INTERACTION_ID] },
  },
  {
    flowId: GENERATED_SITE_CANAL_FLOW_ID,
    compiledStory: generatedSiteCanalWatch,
    startsOn: { interactionIds: [GENERATED_SITE_CANAL_INTERACTION_ID] },
  },
];

const MAX_FRAMES = 64;
const AUTHORITY_CLAIMS = [
  'confirmed by',
  'officially confirmed',
  'official confirmation',
  'verified by',
  'canonical fact',
] as const;

export interface FakeNetRuntime {
  coordinator: NarrativeCoordinator;
  canonicalFacts: readonly SurfaceCanonicalFact[];
  knownActors: readonly SurfaceKnownActor[];
}

export interface FakeNetNarrativeOptions {
  /** Optional L3 surface realizer. Without it, authored text is final. */
  ai?: AiUtteranceRealizer;
  /** Bounded AI realization timeout; failures fall back to authored text. */
  timeoutMs?: number;
}

/** The only public owner facts a fake-internet surface may label canonical. */
export function readSurfaceFacts(engine: SimulationEngine): SurfaceCanonicalFact[] {
  const hud = engine.getHudProjection();
  return [{ key: 'current_day', value: hud.time.day, source: 'clock.day' }];
}

/** Player-known contacts only; surface handles are never resolved from this list implicitly. */
export function readSurfaceKnownActors(engine: SimulationEngine): SurfaceKnownActor[] {
  return engine.getPulseContactsRead().contacts.map((contact) => ({
    id: contact.id,
    displayName: contact.displayName,
    handles: [contact.handle],
  }));
}

/**
 * Fake-net flows use the canonical adapter for bounded context only. No effect
 * owner is bound, so an authored mistake cannot commit a canonical consequence.
 */
export function createFakeNetRuntime(engine: SimulationEngine): FakeNetRuntime {
  const adapter = new SimulationNarrativeAdapter(engine);
  return {
    coordinator: new NarrativeCoordinator({
      flows: FAKE_NET_FLOWS,
      contextSource: adapter,
    }),
    canonicalFacts: readSurfaceFacts(engine),
    knownActors: readSurfaceKnownActors(engine),
  };
}

export async function buildNightBoardNarrative(
  runtime: FakeNetRuntime,
  options: FakeNetNarrativeOptions = {},
): Promise<SurfaceNarrative> {
  return buildSurfaceNarrative(runtime, {
    interactionId: NIGHTBOARD_CANAL_INTERACTION_ID,
    flowId: NIGHTBOARD_CANAL_FLOW_ID,
    title: 'Canal pumps & the low hum',
    options,
  });
}

export async function buildGeneratedSiteNarrative(
  runtime: FakeNetRuntime,
  options: FakeNetNarrativeOptions = {},
): Promise<SurfaceNarrative> {
  const narrative = await buildSurfaceNarrative(runtime, {
    interactionId: GENERATED_SITE_CANAL_INTERACTION_ID,
    flowId: GENERATED_SITE_CANAL_FLOW_ID,
    title: 'Canal Watch',
    options,
  });
  const header = narrative.statements.find((statement) => statement.role === 'header');
  return header?.text.trim() ? { ...narrative, title: header.text.trim() } : narrative;
}

async function buildSurfaceNarrative(
  runtime: FakeNetRuntime,
  input: {
    interactionId: string;
    flowId: string;
    title: string;
    options: FakeNetNarrativeOptions;
  },
): Promise<SurfaceNarrative> {
  const started = runtime.coordinator.requestInteraction({ interactionId: input.interactionId });
  if (!started.started) {
    throw new Error(`Fake-net flow did not start: ${started.reason ?? 'unknown'}`);
  }
  try {
    const frames = collectFrames(runtime.coordinator);
    if (runtime.coordinator.getPendingEffects().length > 0) {
      throw new Error('Fake-net flows may not request canonical effects.');
    }
    const statements: SurfaceStatement[] = [];
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index]!;
      const statement = await toStatement(frame, index, runtime, input.flowId, input.options);
      if (statement) statements.push(statement);
    }
    const clueIds = [...new Set(
      statements.flatMap((statement) => (statement.clueId ? [statement.clueId] : [])),
    )];
    const narrative: SurfaceNarrative = {
      flowId: input.flowId,
      title: input.title,
      statements,
      canonicalFacts: runtime.canonicalFacts,
      clueIds,
    };
    assertSurfaceNarrative({
      narrative,
      canonicalFacts: runtime.canonicalFacts,
      knownActors: runtime.knownActors,
    });
    return narrative;
  } finally {
    runtime.coordinator.end();
  }
}

function collectFrames(coordinator: NarrativeCoordinator): NarrativeFrame[] {
  const frames: NarrativeFrame[] = [];
  let frame = coordinator.getCurrentFrame();
  if (!frame) return frames;
  for (let step = 0; step < MAX_FRAMES; step += 1) {
    if (frame.choices.length > 0) {
      throw new Error('Fake-net narrative flows must be linear.');
    }
    if (frame.text.trim() || frame.tags.length > 0) frames.push(frame);
    if (!frame.canContinue) break;
    frame = coordinator.continue();
  }
  return frames;
}

async function toStatement(
  frame: NarrativeFrame,
  index: number,
  runtime: FakeNetRuntime,
  flowId: string,
  options: FakeNetNarrativeOptions,
): Promise<SurfaceStatement | null> {
  const text = frame.text.trim();
  if (!text) return null;
  const tags = frame.tags.map((tag) => tag.trim()).filter(Boolean);
  const { role, heading } = parseRole(tags);
  const author = resolveAuthor(tags, runtime.knownActors);
  const provenance = parseProvenance(tags);
  const factRef = tagValue(tags, 'factref:');
  const canonicalFact = provenance === 'canonical_fact' && factRef
    ? runtime.canonicalFacts.find((fact) => fact.key === factRef)
    : undefined;
  const clueId = tagValue(tags, 'clue:');

  const session: NarrativeSessionRef = {
    flowId,
    trigger: { kind: 'interaction', interactionId: flowId },
    ...(author.actorId ? { actorId: author.actorId } : {}),
  };
  const plan = buildUtterancePlan({
    frame,
    session,
    speakerKind: author.kind === 'canonical_actor' ? 'canonical_local' : 'surface_only',
    requestedTier: provenance === 'canonical_fact' ? 'L0' : author.kind === 'canonical_actor' ? 'L2' : 'L3',
    exactAuthored: provenance === 'canonical_fact',
    maxChars: 400,
  });
  let realizedText = text;
  if (plan) {
    const guarded = provenance === 'canonical_fact'
      ? plan
      : { ...plan, forbiddenClaims: [...plan.forbiddenClaims, ...AUTHORITY_CLAIMS] };
    const realized = await realizeUtterance(
      guarded,
      options.ai
        ? { ai: options.ai, ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}) }
        : {},
    );
    realizedText = realized.text;
  }

  return {
    id: `${flowId}:${index}`,
    role,
    ...(heading ? { heading } : {}),
    author,
    provenance,
    text: realizedText,
    ...(canonicalFact ? { canonicalFact: { ...canonicalFact } } : {}),
    ...(factRef ? { factRef } : {}),
    ...(clueId ? { clueId } : {}),
    tags,
  };
}

function resolveAuthor(tags: readonly string[], knownActors: readonly SurfaceKnownActor[]): SurfaceAuthor {
  const actorId = tagValue(tags, 'actor:');
  if (actorId) {
    const actor = knownActors.find((candidate) => candidate.id === actorId);
    return {
      kind: 'canonical_actor',
      actorId,
      handle: actor?.handles[0] ?? tagValue(tags, 'author:') ?? actorId,
      displayName: actor?.displayName ?? tagValue(tags, 'name:') ?? actorId,
    };
  }
  const handle = tagValue(tags, 'author:') ?? 'anonymous';
  return {
    kind: 'surface_only',
    handle,
    displayName: tagValue(tags, 'name:') ?? (handle.replace(/[_-]+/g, ' ') || 'Anonymous'),
  };
}

function parseRole(tags: readonly string[]): { role: SurfaceStatementRole; heading?: string } {
  const raw = tagValue(tags, 'role:') ?? 'reply';
  const [rawRole, ...headingParts] = raw.split(':');
  const role = rawRole?.trim().toLowerCase();
  const normalized: SurfaceStatementRole =
    role === 'opening' || role === 'reply' || role === 'section' || role === 'guestbook' || role === 'header'
      ? role
      : 'reply';
  const heading = normalized === 'section' ? headingParts.join(':').trim() : '';
  return { role: normalized, ...(heading ? { heading } : {}) };
}

function parseProvenance(tags: readonly string[]): SurfaceProvenance {
  const raw = tagValue(tags, 'provenance:')?.toLowerCase();
  return isSurfaceProvenance(raw) ? raw : 'unknown';
}

function tagValue(tags: readonly string[], prefix: string): string | undefined {
  const match = tags.find((tag) => tag.toLowerCase().startsWith(prefix));
  return match ? match.slice(prefix.length).trim() || undefined : undefined;
}

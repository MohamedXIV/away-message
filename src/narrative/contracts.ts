import { z } from 'zod';

// ==========================================
// Social action vocabulary (mirrors src/narrative/types)
// ==========================================

export const SOCIAL_ACTION_TYPES = [
  'empathy',
  'remembered_detail',
  'tease_playful',
  'dismissive',
  'vulnerable_share',
  'work_camaraderie',
  'intellectual_curiosity',
] as const;

export const SocialActionTypeSchema = z.enum(SOCIAL_ACTION_TYPES);
export type SocialActionType = z.infer<typeof SocialActionTypeSchema>;

// ==========================================
// Narrative context projection (bounded, serializable, read-only)
// ==========================================

export const ActorContextSchema = z.object({
  id: z.string().min(1),
  reach: z.enum(['local', 'remote']),
  roles: z.array(z.string()),
  lifecycle: z.string(),
  connection: z.enum(['unknown', 'known', 'distant', 'blocked']),
  relationshipStage: z.string(),
  trusted: z.boolean(),
  conflicted: z.boolean(),
});

export const LocationContextSchema = z.object({
  placeId: z.string().optional(),
  coLocated: z.boolean(),
});

export const ObligationContextSchema = z.object({
  id: z.string().optional(),
  kind: z.string().optional(),
  description: z.string().optional(),
});

export const ScenarioContextSchema = z.object({
  instanceId: z.string().optional(),
  hookId: z.string().optional(),
});

export const PlayerContextSchema = z.object({
  cash: z.number().optional(),
  energy: z.number().optional(),
  fatigue: z.number().optional(),
  cashBand: z.enum(['low', 'medium', 'high']).optional(),
});

export const NarrativeContextProjectionSchema = z.object({
  currentDay: z.number().int(),
  currentTimeMinute: z.number().int().min(0).max(1439),
  timeOfDay: z.string(),
  player: PlayerContextSchema.default({}),
  actor: ActorContextSchema.optional(),
  targetActor: ActorContextSchema.optional(),
  location: LocationContextSchema.optional(),
  obligation: ObligationContextSchema.optional(),
  scenario: ScenarioContextSchema.optional(),
  knowledge: z.object({ playerKnows: z.array(z.string()) }).optional(),
  flags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])).default({}),
  completedBeats: z.array(z.string()).default([]),
});

export type NarrativeContextProjection = z.infer<typeof NarrativeContextProjectionSchema>;

// ==========================================
// Approved bounded context queries
// ==========================================

export const NARRATIVE_CONTEXT_QUERIES = [
  'current_day',
  'current_time_minute',
  'time_of_day',
  'player_cash',
  'player_energy',
  'player_fatigue',
  'player_cash_band',
  'actor_id',
  'actor_reach',
  'actor_lifecycle',
  'actor_connection',
  'actor_known',
  'actor_relationship_stage',
  'actor_trusted',
  'actor_conflicted',
  'actor_can_meet_in_person',
  'location_place_id',
  'location_co_located',
  'has_obligation',
  'scenario_instance_id',
  'scenario_hook_id',
  'flag',
  'completed_beat',
  'player_knows',
] as const;

export type NarrativeContextQuery = (typeof NARRATIVE_CONTEXT_QUERIES)[number];

export class NarrativeContextQueryError extends Error {
  constructor(query: string) {
    super(`Unknown or unsupported narrative context query: ${query}`);
    this.name = 'NarrativeContextQueryError';
  }
}

export function queryNarrativeContext(
  projection: NarrativeContextProjection,
  query: NarrativeContextQuery | string,
  arg?: string,
): unknown {
  if (!(NARRATIVE_CONTEXT_QUERIES as readonly string[]).includes(query)) {
    throw new NarrativeContextQueryError(String(query));
  }
  switch (query) {
    case 'current_day':
      return projection.currentDay;
    case 'current_time_minute':
      return projection.currentTimeMinute;
    case 'time_of_day':
      return projection.timeOfDay;
    case 'player_cash':
      return projection.player.cash ?? 0;
    case 'player_energy':
      return projection.player.energy ?? 0;
    case 'player_fatigue':
      return projection.player.fatigue ?? 0;
    case 'player_cash_band':
      return projection.player.cashBand ?? 'medium';
    case 'actor_id':
      return projection.actor?.id ?? null;
    case 'actor_reach':
      return projection.actor?.reach ?? null;
    case 'actor_lifecycle':
      return projection.actor?.lifecycle ?? null;
    case 'actor_connection':
      return projection.actor?.connection ?? null;
    case 'actor_known':
      return projection.actor?.connection === 'known';
    case 'actor_relationship_stage':
      return projection.actor?.relationshipStage ?? null;
    case 'actor_trusted':
      return projection.actor?.trusted ?? false;
    case 'actor_conflicted':
      return projection.actor?.conflicted ?? false;
    case 'actor_can_meet_in_person':
      return projection.actor?.reach === 'local' && projection.actor?.connection !== 'blocked' && projection.actor?.lifecycle !== 'departed';
    case 'location_place_id':
      return projection.location?.placeId ?? null;
    case 'location_co_located':
      return projection.location?.coLocated ?? false;
    case 'has_obligation':
      return Boolean(projection.obligation?.id);
    case 'scenario_instance_id':
      return projection.scenario?.instanceId ?? null;
    case 'scenario_hook_id':
      return projection.scenario?.hookId ?? null;
    case 'flag':
      if (!arg) throw new NarrativeContextQueryError('flag (missing key)');
      return projection.flags[arg] ?? null;
    case 'completed_beat':
      if (!arg) throw new NarrativeContextQueryError('completed_beat (missing id)');
      return projection.completedBeats.includes(arg);
    case 'player_knows':
      if (!arg) throw new NarrativeContextQueryError('player_knows (missing fact)');
      return projection.knowledge?.playerKnows?.includes(arg) ?? false;
    default:
      throw new NarrativeContextQueryError(String(query));
  }
}

// ==========================================
// Semantic effect requests (validated, never raw mutation)
// ==========================================

const JsonValueSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
);

const AppointmentSchema = z.object({
  id: z.string().min(1),
  characterId: z.string().min(1),
  locationId: z.string().min(1),
  targetDay: z.number().int(),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  description: z.string(),
});

// Small explicit approved semantic-effect registry (generic request_effect boundary).
// Unknown effect identifiers are rejected; domain owners remain the final authority
// on preconditions and commits. Extend this list only when a domain owner exists.
export const APPROVED_SEMANTIC_EFFECT_IDS = [
  'social_act',
  'pay_meal',
  'study_together',
  'schedule_meetup',
  'confide',
  'apologize',
  'knowledge_reveal',
  'travel_request',
] as const;

export type ApprovedSemanticEffectId = (typeof APPROVED_SEMANTIC_EFFECT_IDS)[number];

export const ApprovedSemanticEffectIdSchema = z.enum(APPROVED_SEMANTIC_EFFECT_IDS);

// Typed payload contract for every approved generic effect. An effect id alone is
// not authorization: the payload shape must match its owner-facing contract.
// Domain owners still validate preconditions and commit the final outcome.
const GenericEffectArgPayloadSchema = z.strictObject({
  arg: z.string().min(1).max(128),
});

export const SEMANTIC_EFFECT_PAYLOAD_SCHEMAS = {
  social_act: z.strictObject({ arg: SocialActionTypeSchema }),
  pay_meal: GenericEffectArgPayloadSchema,
  study_together: z.strictObject({ courseId: z.string().min(1).max(64) }),
  schedule_meetup: GenericEffectArgPayloadSchema,
  confide: GenericEffectArgPayloadSchema,
  apologize: GenericEffectArgPayloadSchema,
  knowledge_reveal: GenericEffectArgPayloadSchema,
  travel_request: GenericEffectArgPayloadSchema,
} satisfies Record<ApprovedSemanticEffectId, z.ZodTypeAny>;

// Effect request lifecycle (Ink side only; canonical commits stay with domain owners).
export const EFFECT_LIFECYCLE_STATUSES = ['queued', 'accepted', 'committed', 'rejected'] as const;
export type EffectLifecycleStatus = (typeof EFFECT_LIFECYCLE_STATUSES)[number];

export const NarrativeEffectRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('world_set_flag'), key: z.string().min(1), value: z.union([z.boolean(), z.number(), z.string()]) }),
  z.object({ type: z.literal('world_trigger_event'), eventId: z.string().min(1) }),
  z.object({ type: z.literal('schedule_appointment'), appointment: AppointmentSchema }),
  z.object({ type: z.literal('social_act'), buddyId: z.string().min(1), action: SocialActionTypeSchema }),
  z.object({ type: z.literal('unlock'), targetType: z.enum(['website', 'app', 'search_term', 'file']), targetId: z.string().min(1) }),
  z.object({
    type: z.literal('request_effect'),
    effectId: z.string().min(1).max(64),
    payload: z.record(z.string(), JsonValueSchema).optional().default({}),
  }),
]);

export type NarrativeEffectRequest = z.infer<typeof NarrativeEffectRequestSchema>;

export type EffectValidationResult =
  | { ok: true; request: NarrativeEffectRequest }
  | { ok: false; error: string };

const MAX_PAYLOAD_KEYS = 16;
const MAX_PAYLOAD_DEPTH = 4;

function payloadWithinBounds(value: unknown, depth = 0): boolean {
  if (depth > MAX_PAYLOAD_DEPTH) return false;
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) {
    if (value.length > MAX_PAYLOAD_KEYS) return false;
    return value.every((v) => payloadWithinBounds(v, depth + 1));
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length > MAX_PAYLOAD_KEYS) return false;
  return keys.every((k) => payloadWithinBounds((value as Record<string, unknown>)[k], depth + 1));
}

export interface EffectValidationOptions {
  /** May only narrow the canonical registry; ids without a payload contract stay rejected. */
  approvedEffectIds?: readonly string[];
}

export function validateNarrativeEffectRequest(
  input: unknown,
  options?: EffectValidationOptions,
): EffectValidationResult {
  const parsed = NarrativeEffectRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  const req = parsed.data;
  if (req.type === 'request_effect') {
    if (!payloadWithinBounds(req.payload)) {
      return { ok: false, error: 'request_effect payload exceeds size/depth bounds' };
    }
    const allowed = options?.approvedEffectIds ?? APPROVED_SEMANTIC_EFFECT_IDS;
    const payloadSchema = (SEMANTIC_EFFECT_PAYLOAD_SCHEMAS as Record<string, z.ZodTypeAny | undefined>)[req.effectId];
    if (!allowed.includes(req.effectId) || !payloadSchema) {
      return { ok: false, error: `unknown or unapproved semantic effect: ${req.effectId}` };
    }
    const payload = payloadSchema.safeParse(req.payload);
    if (!payload.success) {
      return {
        ok: false,
        error: `invalid payload for semantic effect '${req.effectId}': ${payload.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      };
    }
    return { ok: true, request: { ...req, payload: payload.data as Record<string, unknown> } };
  }
  // Bound string sizes for flag keys/values sanity
  if (req.type === 'world_set_flag' && req.key.length > 128) {
    return { ok: false, error: 'world_set_flag key too long' };
  }
  return { ok: true, request: req };
}

// ==========================================
// Frame + host state
// ==========================================

export const InkRuntimeStateSchema = z.object({
  version: z.literal(1),
  storyStateJson: z.string().min(2),
});

export type InkRuntimeState = z.infer<typeof InkRuntimeStateSchema>;

export interface InkChoiceFrame {
  id: string;
  text: string;
}

export interface NarrativeFrame {
  text: string;
  tags: string[];
  choices: InkChoiceFrame[];
  canContinue: boolean;
  pendingEffects: NarrativeEffectRequest[];
}

export interface NarrativeHostState {
  version: 1;
  flowId: string;
  compiledStoryKey: string;
  inkState: InkRuntimeState;
  /** Queued/accepted effect requests awaiting domain acknowledgement/commit. */
  pendingEffects?: NarrativeEffectRequest[];
}

export interface NarrativeStartContext {
  variables?: Record<string, boolean | number | string>;
  context?: NarrativeContextProjection;
}

// ==========================================
// NarrativeHost contract
// ==========================================

export interface NarrativeHost {
  start(flowId: string, startContext?: NarrativeStartContext): NarrativeFrame;
  choose(choiceIdOrIndex: string | number): NarrativeFrame;
  continue(): NarrativeFrame;
  save(): NarrativeHostState;
  load(state: NarrativeHostState): void;
  getContext(): NarrativeContextProjection;
  updateContext(projection: NarrativeContextProjection): void;
  getPendingEffects(): NarrativeEffectRequest[];
  clearPendingEffects(): void;
  acknowledgeEffect(effect: NarrativeEffectRequest): boolean;
  rejectEffect(effect: NarrativeEffectRequest, reason?: string): boolean;
}

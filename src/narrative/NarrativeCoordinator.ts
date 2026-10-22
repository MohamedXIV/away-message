import { NarrativeHostImpl, type NarrativeHostOptions } from './NarrativeHost';
import {
  NarrativeContextProjectionSchema,
  type NarrativeContextProjection,
  type NarrativeEffectRequest,
  type NarrativeFrame,
  type NarrativeHostState,
} from './contracts';
import { buildUtterancePlan } from './realization/RealizationPolicy';
import type {
  RealizationTier,
  SpeakerKind,
  UtterancePlan,
} from './realization/contracts';

/** Meaningful triggers only; ordinary time ticks are deliberately not a trigger. */
export type NarrativeSemanticEventKind =
  | 'conversation_started'
  | 'actor_encountered'
  | 'knowledge_fact_learned'
  | 'object_inspected'
  | 'scenario_hook_available';

export type NarrativeConversationChannel = 'pulse' | 'in_person';

/** Bounded Scenario hook reference. Scenario lifecycle/facts stay with ScenarioDirector. */
export interface NarrativeScenarioHookRef {
  instanceId: string;
  definitionId: string;
  hookId: string;
  roleId: string;
  boundActorId: string | null;
  presentationCue: string;
}

export interface NarrativeSemanticEvent {
  kind: NarrativeSemanticEventKind;
  actorId?: string;
  placeId?: string;
  channel?: NarrativeConversationChannel;
  factKey?: string;
  objectId?: string;
  scenario?: NarrativeScenarioHookRef;
}

export interface NarrativeInteractionRequest {
  interactionId: string;
  actorId?: string;
  placeId?: string;
  scenario?: NarrativeScenarioHookRef;
}

export interface NarrativeStartBinding {
  interactionIds?: readonly string[];
  semanticKinds?: readonly NarrativeSemanticEventKind[];
  /** When present, conversation_started must carry one of these channels. */
  conversationChannels?: readonly NarrativeConversationChannel[];
  scenarioCues?: readonly string[];
}

export interface NarrativeFlowDefinition {
  flowId: string;
  /** Compiled Ink JSON object (or JSON string). */
  compiledStory: unknown;
  startsOn?: NarrativeStartBinding;
}

export type NarrativeSessionTrigger =
  | { kind: 'interaction'; interactionId: string }
  | { kind: 'semantic'; eventKind: NarrativeSemanticEventKind }
  | { kind: 'scenario_hook'; hookId: string };

export interface NarrativeSessionRef {
  flowId: string;
  trigger: NarrativeSessionTrigger;
  actorId?: string;
  placeId?: string;
  scenario?: NarrativeScenarioHookRef;
}

/** Builds a bounded projection from canonical owner reads; never a full state snapshot. */
export interface NarrativeContextSource {
  buildContext(session: NarrativeSessionRef): NarrativeContextProjection;
}

export interface NarrativeEffectContext {
  flowId: string;
  session: NarrativeSessionRef;
  context: NarrativeContextProjection;
}

/** Canonical owners validate preconditions and commit; this interface only approves/forwards. */
export interface NarrativeEffectOwner {
  handleEffect(
    request: NarrativeEffectRequest,
    context: NarrativeEffectContext,
  ): { accepted: boolean; committed?: boolean; result?: unknown; error?: string };
}

export interface NarrativeCoordinatorOptions {
  flows: readonly NarrativeFlowDefinition[];
  contextSource: NarrativeContextSource;
  effectOwner?: NarrativeEffectOwner;
  /** Consumes a Scenario hook through the owning Scenario runtime. */
  consumeScenarioHook?: (hook: NarrativeScenarioHookRef) => boolean;
}

export type NarrativeCoordinatorReason =
  | 'active_flow'
  | 'no_flow'
  | 'unknown_interaction'
  | 'scenario_hook_unavailable';

export interface NarrativeCoordinatorResult {
  started: boolean;
  flowId: string | null;
  frame: NarrativeFrame | null;
  reason?: NarrativeCoordinatorReason;
}

export interface NarrativeCoordinatorState {
  version: 1;
  session: NarrativeSessionRef | null;
  context: NarrativeContextProjection | null;
  host: NarrativeHostState | null;
}

/**
 * Application-facing authored-flow coordinator.
 *
 * Starts/resumes compiled Ink flows from explicit interaction requests or
 * meaningful semantic events. It never subscribes to time ticks, never reads a
 * full simulation snapshot, and never mutates canonical state directly:
 * validated effect requests are forwarded to the owning domain through
 * NarrativeEffectOwner.
 */
export class NarrativeCoordinator {
  private readonly flows: readonly NarrativeFlowDefinition[];
  private readonly flowsById: ReadonlyMap<string, NarrativeFlowDefinition>;
  private readonly contextSource: NarrativeContextSource;
  private readonly effectOwner?: NarrativeEffectOwner;
  private readonly consumeScenarioHook?: (hook: NarrativeScenarioHookRef) => boolean;
  private host: NarrativeHostImpl | null = null;
  private session: NarrativeSessionRef | null = null;
  private context: NarrativeContextProjection | null = null;
  private lastFrame: NarrativeFrame | null = null;

  constructor(options: NarrativeCoordinatorOptions) {
    const seen = new Set<string>();
    for (const flow of options.flows) {
      if (!flow.flowId.trim()) throw new Error('Narrative flows need a non-empty flowId.');
      if (seen.has(flow.flowId)) throw new Error(`Duplicate narrative flow id: ${flow.flowId}`);
      if (flow.compiledStory === null || flow.compiledStory === undefined) {
        throw new Error(`Narrative flow '${flow.flowId}' has no compiled story.`);
      }
      seen.add(flow.flowId);
    }
    this.flows = [...options.flows].sort((a, b) => a.flowId.localeCompare(b.flowId));
    this.flowsById = new Map(this.flows.map((flow) => [flow.flowId, flow]));
    this.contextSource = options.contextSource;
    this.effectOwner = options.effectOwner;
    this.consumeScenarioHook = options.consumeScenarioHook;
  }

  public get isActive(): boolean {
    return this.host !== null;
  }

  public get activeFlowId(): string | null {
    return this.session?.flowId ?? null;
  }

  public get activeSession(): NarrativeSessionRef | null {
    return this.session ? clone(this.session) : null;
  }

  public requestInteraction(request: NarrativeInteractionRequest): NarrativeCoordinatorResult {
    if (this.host) return this.activeResult();
    const flow = this.flows.find((candidate) =>
      candidate.startsOn?.interactionIds?.includes(request.interactionId));
    if (!flow) {
      return {
        started: false, flowId: null, frame: null,
        reason: 'unknown_interaction',
      };
    }
    return this.startFlow(flow, {
      flowId: flow.flowId,
      trigger: { kind: 'interaction', interactionId: request.interactionId },
      ...(request.actorId ? { actorId: request.actorId } : {}),
      ...(request.placeId ? { placeId: request.placeId } : {}),
      ...(request.scenario ? { scenario: clone(request.scenario) } : {}),
    });
  }

  public handleSemanticEvent(event: NarrativeSemanticEvent): NarrativeCoordinatorResult {
    if (this.host) return this.activeResult();

    if (event.kind === 'scenario_hook_available') {
      const hook = event.scenario;
      if (!hook) return { started: false, flowId: null, frame: null, reason: 'no_flow' };
      const flow = this.flows.find((candidate) =>
        candidate.startsOn?.scenarioCues?.includes(hook.presentationCue));
      if (!flow) return { started: false, flowId: null, frame: null, reason: 'no_flow' };
      if (!this.consumeScenarioHook) {
        return { started: false, flowId: null, frame: null, reason: 'scenario_hook_unavailable' };
      }
      // Start first so corrupt/unknown compiled content cannot consume a hook
      // without presenting a flow. The Scenario owner still decides consumption.
      const started = this.startFlow(flow, {
        flowId: flow.flowId,
        trigger: { kind: 'scenario_hook', hookId: hook.hookId },
        ...(hook.boundActorId ? { actorId: hook.boundActorId } : {}),
        ...(event.placeId ? { placeId: event.placeId } : {}),
        scenario: clone(hook),
      });
      if (!this.consumeScenarioHook(clone(hook))) {
        this.end();
        return { started: false, flowId: null, frame: null, reason: 'scenario_hook_unavailable' };
      }
      return started;
    }

    const flow = this.flows.find((candidate) => {
      const binding = candidate.startsOn;
      if (!binding?.semanticKinds?.includes(event.kind)) return false;
      if (event.kind !== 'conversation_started') return true;
      if (!binding.conversationChannels) return true;
      return Boolean(event.channel && binding.conversationChannels.includes(event.channel));
    });
    if (!flow) return { started: false, flowId: null, frame: null, reason: 'no_flow' };
    return this.startFlow(flow, {
      flowId: flow.flowId,
      trigger: { kind: 'semantic', eventKind: event.kind },
      ...(event.actorId ? { actorId: event.actorId } : {}),
      ...(event.placeId ? { placeId: event.placeId } : {}),
    });
  }

  public continue(): NarrativeFrame {
    this.requireActive();
    this.syncContext();
    const frame = this.host!.continue();
    this.lastFrame = frame;
    return frame;
  }

  /**
   * Continue the authored flow until it offers choices or runs out of content.
   * Useful for presenting an authored scene as one readable block.
   */
  public advanceToChoices(maxSteps = 32): NarrativeFrame {
    this.requireActive();
    this.syncContext();
    let frame = this.lastFrame ?? this.host!.continue();
    let text = frame.text;
    const tags = [...frame.tags];
    let steps = 0;
    while (frame.choices.length === 0 && frame.canContinue && steps < maxSteps) {
      this.syncContext();
      frame = this.host!.continue();
      text += frame.text;
      tags.push(...frame.tags);
      steps += 1;
    }
    const combined: NarrativeFrame = { ...frame, text, tags };
    this.lastFrame = combined;
    return combined;
  }

  public choose(choiceIdOrIndex: string | number): NarrativeFrame {
    this.requireActive();
    this.syncContext();
    const frame = this.settle(this.host!.choose(choiceIdOrIndex));
    this.lastFrame = frame;
    return frame;
  }

  public getCurrentFrame(): NarrativeFrame | null {
    return this.lastFrame ? clone(this.lastFrame) : null;
  }

  /**
   * Semantic plan for the current authored frame. The plan contains the full
   * offline realization plus tier/fact/tone/forbidden metadata for optional
   * AI surface wording. It never contains effect payloads or canonical state.
   */
  public getUtterancePlan(options: {
    speakerKind?: SpeakerKind;
    requestedTier?: RealizationTier;
    exactAuthored?: boolean;
    maxChars?: number;
  } = {}): UtterancePlan | null {
    if (!this.lastFrame || !this.session) return null;
    return buildUtterancePlan({
      frame: this.lastFrame,
      session: this.session,
      ...(this.context ? { context: this.context } : {}),
      ...options,
    });
  }

  public getContext(): NarrativeContextProjection | null {
    return this.context ? clone(this.context) : null;
  }

  public getPendingEffects(): NarrativeEffectRequest[] {
    return this.host ? this.host.getPendingEffects() : [];
  }

  public acknowledgeEffect(effect: NarrativeEffectRequest): boolean {
    return this.host ? this.host.acknowledgeEffect(effect) : false;
  }

  public rejectEffect(effect: NarrativeEffectRequest, reason?: string): boolean {
    return this.host ? this.host.rejectEffect(effect, reason) : false;
  }

  public end(): void {
    this.host = null;
    this.session = null;
    this.context = null;
    this.lastFrame = null;
  }

  public save(): NarrativeCoordinatorState {
    return {
      version: 1,
      session: this.session ? clone(this.session) : null,
      context: this.context ? clone(this.context) : null,
      host: this.host ? this.host.save() : null,
    };
  }

  public load(state: NarrativeCoordinatorState): void {
    if (state.version !== 1) throw new Error(`Unsupported NarrativeCoordinatorState version: ${state.version}`);
    if (!state.host) {
      this.end();
      return;
    }
    if (!state.session) throw new Error('Narrative coordinator state has a flow but no session.');
    if (state.host.flowId !== state.session.flowId) {
      throw new Error('Narrative coordinator state has mismatched flow and session ids.');
    }
    const flow = this.flowsById.get(state.session.flowId);
    if (!flow) throw new Error(`Narrative flow is not registered: ${state.session.flowId}`);
    if (!state.context) throw new Error('Narrative coordinator state has a flow but no context.');
    const context = NarrativeContextProjectionSchema.parse(state.context);
    const host = new NarrativeHostImpl(this.hostOptions(flow, context));
    host.load(state.host);
    this.host = host;
    this.session = clone(state.session);
    this.context = context;
    this.lastFrame = null;
  }

  private startFlow(flow: NarrativeFlowDefinition, session: NarrativeSessionRef): NarrativeCoordinatorResult {
    const context = NarrativeContextProjectionSchema.parse(this.contextSource.buildContext(session));
    const host = new NarrativeHostImpl(this.hostOptions(flow, context));
    this.host = host;
    this.session = session;
    this.context = context;
    let frame: NarrativeFrame;
    try {
      frame = this.settle(host.start(flow.flowId));
    } catch (error) {
      this.end();
      throw error;
    }
    this.lastFrame = frame;
    return { started: true, flowId: flow.flowId, frame };
  }

  private hostOptions(flow: NarrativeFlowDefinition, context: NarrativeContextProjection): NarrativeHostOptions {
    return {
      loadCompiledStory: (key) => (key === flow.flowId ? flow.compiledStory : null),
      context,
      ...(this.effectOwner
        ? { onEffectRequest: (request) => this.forwardEffect(request) }
        : {}),
    };
  }

  private forwardEffect(request: NarrativeEffectRequest) {
    if (!this.effectOwner || !this.session || !this.context) {
      return { accepted: false, error: 'No canonical effect owner is bound to this narrative session.' };
    }
    return this.effectOwner.handleEffect(request, {
      flowId: this.session.flowId,
      session: clone(this.session),
      context: clone(this.context),
    });
  }

  /**
   * Ink returns a blank frame for effect-only lines; advance past them so
   * callers receive the next authored text (or choices) with effects committed.
   */
  private settle(frame: NarrativeFrame, maxSteps = 8): NarrativeFrame {
    let next = frame;
    let steps = 0;
    while (next.text.trim() === '' && next.canContinue && steps < maxSteps) {
      this.syncContext();
      next = this.host!.continue();
      steps += 1;
    }
    return next;
  }

  private syncContext(): void {
    if (!this.host || !this.session) return;
    const next = NarrativeContextProjectionSchema.parse(this.contextSource.buildContext(this.session));
    this.context = next;
    this.host.updateContext(next);
  }

  private activeResult(): NarrativeCoordinatorResult {
    return {
      started: false,
      flowId: this.session?.flowId ?? null,
      frame: this.getCurrentFrame(),
      reason: 'active_flow',
    };
  }

  private requireActive(): void {
    if (!this.host) throw new Error('NarrativeCoordinator has no active flow.');
  }
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

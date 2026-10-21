import { InkRuntime } from './ink/InkRuntime';
import {
  NarrativeContextProjectionSchema,
  NarrativeEffectRequest,
  NarrativeFrame,
  NarrativeHostState,
  NarrativeStartContext,
  validateNarrativeEffectRequest,
  APPROVED_SEMANTIC_EFFECT_IDS,
  queryNarrativeContext,
  type NarrativeContextProjection,
  type NarrativeHost,
  type InkRuntimeState,
} from './contracts';
import { z } from 'zod';

export interface NarrativeHostOptions {
  /** Resolves a compiled Ink story (JSON object or string) for a flow key. */
  loadCompiledStory: (flowKey: string) => unknown | null;
  /** Initial bounded context projection. */
  context: NarrativeContextProjection;
  /** Optional allowlist that may only narrow the canonical typed-effect registry. */
  approvedEffectIds?: readonly string[];
  /** Optional domain owner callback. If provided, validated requests are forwarded; otherwise queued. */
  onEffectRequest?: (request: NarrativeEffectRequest) => { accepted: boolean; committed?: boolean; result?: unknown; error?: string };
}

/**
 * Application-facing seam for authored narrative (Ink).
 *
 * Owns an InkRuntime (local flow state only) + bounded context projection +
 * validated effect requests. Never mutates canonical world/money/relationships/
 * knowledge/location directly; effect requests are validated and either queued
 * or forwarded to the owning domain via onEffectRequest.
 */
export class NarrativeHostImpl implements NarrativeHost {
  private readonly loadCompiledStory: (key: string) => unknown | null;
  private readonly onEffectRequest?: NarrativeHostOptions['onEffectRequest'];
  private readonly approvedEffectIds: readonly string[];
  private ink: InkRuntime | null = null;
  private flowId: string | null = null;
  private compiledStoryKey: string | null = null;
  private context: NarrativeContextProjection;
  private pendingEffects: NarrativeEffectRequest[] = [];

  constructor(options: NarrativeHostOptions) {
    this.loadCompiledStory = options.loadCompiledStory;
    this.onEffectRequest = options.onEffectRequest;
    this.approvedEffectIds = options.approvedEffectIds ?? [...APPROVED_SEMANTIC_EFFECT_IDS];
    this.context = NarrativeContextProjectionSchema.parse(options.context);
  }

  start(flowId: string, startContext?: NarrativeStartContext): NarrativeFrame {
    const compiled = this.loadCompiledStory(flowId);
    if (!compiled) throw new Error(`Compiled Ink story not found for flow: ${flowId}`);
    this.ink = new InkRuntime(compiled as any);
    this.flowId = flowId;
    this.compiledStoryKey = flowId;
    this.pendingEffects = [];
    if (startContext?.context) this.context = NarrativeContextProjectionSchema.parse(startContext.context);
    this.bindExternalFunctions();
    if (startContext?.variables) {
      for (const [k, v] of Object.entries(startContext.variables)) this.ink.setVariable(k, v);
    }
    return this.continue();
  }

  choose(choiceIdOrIndex: string | number): NarrativeFrame {
    this.ensureInk();
    let index: number;
    if (typeof choiceIdOrIndex === 'number') {
      index = choiceIdOrIndex;
    } else {
      // allow "choice_0" style or numeric string
      const m = String(choiceIdOrIndex).match(/(\d+)$/);
      index = m ? Number(m[1]) : Number(choiceIdOrIndex);
    }
    if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid choice: ${choiceIdOrIndex}`);
    this.ink!.choose(index);
    return this.continue();
  }

  continue(): NarrativeFrame {
    this.ensureInk();
    const cont = this.ink!.continue();
    const choices = cont.choices.map((c, i) => ({ id: `choice_${i}`, text: c.text }));
    return {
      text: cont.text,
      tags: cont.tags,
      choices,
      canContinue: cont.canContinue,
      pendingEffects: this.getPendingEffects(),
    };
  }

  save(): NarrativeHostState {
    this.ensureInk();
    const inkState = this.ink!.saveState();
    // validate
    InkRuntimeStateSchemaCheck(inkState);
    return {
      version: 1,
      flowId: this.flowId ?? '',
      compiledStoryKey: this.compiledStoryKey ?? this.flowId ?? '',
      inkState: inkState as InkRuntimeState,
      pendingEffects: this.pendingEffects.map((e) => clone(e) as NarrativeEffectRequest),
    };
  }

  load(state: NarrativeHostState): void {
    if (state.version !== 1) throw new Error(`Unsupported NarrativeHostState version: ${state.version}`);
    const compiled = this.loadCompiledStory(state.compiledStoryKey);
    if (!compiled) throw new Error(`Compiled Ink story not found for key: ${state.compiledStoryKey}`);
    const restored: NarrativeEffectRequest[] = [];
    if (state.pendingEffects !== undefined && !Array.isArray(state.pendingEffects)) {
      throw new Error('Invalid pending narrative effects in saved state.');
    }
    const candidates = state.pendingEffects ?? [];
    for (const candidate of candidates) {
      const validated = validateNarrativeEffectRequest(candidate, { approvedEffectIds: this.approvedEffectIds });
      if (!validated.ok) {
        throw new Error(`Invalid pending narrative effect in saved state: ${validated.error}`);
      }
      restored.push(clone(validated.request));
    }
    const ink = new InkRuntime(compiled as any);
    ink.loadState(state.inkState);
    this.ink = ink;
    this.flowId = state.flowId;
    this.compiledStoryKey = state.compiledStoryKey;
    this.pendingEffects = restored;
    this.bindExternalFunctions();
  }

  getContext(): NarrativeContextProjection {
    return clone(this.context) as NarrativeContextProjection;
  }

  updateContext(projection: NarrativeContextProjection): void {
    this.context = NarrativeContextProjectionSchema.parse(clone(projection));
  }

  getPendingEffects(): NarrativeEffectRequest[] {
    return this.pendingEffects.map((e) => clone(e) as NarrativeEffectRequest);
  }

  clearPendingEffects(): void {
    this.pendingEffects = [];
  }

  acknowledgeEffect(effect: NarrativeEffectRequest): boolean {
    const idx = this.pendingEffects.findIndex((e) => sameEffect(e, effect));
    if (idx < 0) return false;
    this.pendingEffects.splice(idx, 1);
    return true;
  }

  rejectEffect(effect: NarrativeEffectRequest, _reason?: string): boolean {
    const idx = this.pendingEffects.findIndex((e) => sameEffect(e, effect));
    if (idx < 0) return false;
    this.pendingEffects.splice(idx, 1);
    return true;
  }

  private ensureInk(): void {
    if (!this.ink) throw new Error('NarrativeHost has no active flow. Call start() first.');
  }

  private bindExternalFunctions(): void {
    const ink = this.ink!;
    // Bounded context query function (lookahead-safe).
    ink.bindExternalFunction('narrative_query', (key: string, arg?: string) => {
      try {
        return queryContextSafe(this.context, key, arg === '' ? undefined : arg);
      } catch {
        return null;
      }
    }, true);

    // Validated effect request entry point. Returns a status string Ink can branch on.
    // Supports:
    //   request_effect('{"type":"world_set_flag",...}')   (full typed request as JSON)
    //   request_effect('effect_id')                      (generic request_effect)
    //   request_effect('effect_id', 'arg' | '{...}')     (generic with arg/payload)
    ink.bindExternalFunction('request_effect', (first: string, second: string) => {
      let candidate: unknown;
      // Try full JSON request in first arg
      try {
        const parsed = JSON.parse(first);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as any).type === 'string') {
          candidate = parsed;
        }
      } catch {
        // not JSON
      }
      if (!candidate) {
        let payload: Record<string, unknown> = {};
        if (second !== undefined && second !== null) {
          try {
            const p = JSON.parse(second);
            if (p && typeof p === 'object' && !Array.isArray(p)) payload = p as Record<string, unknown>;
            else payload = { arg: second };
          } catch {
            payload = { arg: second };
          }
        }
        candidate = { type: 'request_effect', effectId: String(first), payload };
      }
      const result = validateNarrativeEffectRequest(candidate, { approvedEffectIds: this.approvedEffectIds });
      if (!result.ok) {
        return `rejected:${result.error}`;
      }
      return this.handleEffectRequest(result.request);
    }, false);

    // Typed helpers
    ink.bindExternalFunction('request_world_set_flag', (key: string, value: boolean | number | string) => {
      const r = validateNarrativeEffectRequest({ type: 'world_set_flag', key, value });
      if (!r.ok) return `rejected:${r.error}`;
      return this.handleEffectRequest(r.request);
    }, false);

    ink.bindExternalFunction('request_social_act', (buddyId: string, action: string) => {
      const r = validateNarrativeEffectRequest({ type: 'social_act', buddyId, action });
      if (!r.ok) return `rejected:${r.error}`;
      return this.handleEffectRequest(r.request);
    }, false);
  }

  private handleEffectRequest(req: NarrativeEffectRequest): string {
    if (this.onEffectRequest) {
      const res = this.onEffectRequest(req);
      if (!res.accepted) {
        return `rejected:${res.error ?? 'domain rejected'}`;
      }
      if (res.committed) {
        return res.result !== undefined ? `committed:${String(res.result)}` : 'committed';
      }
      this.pendingEffects.push(req);
      return res.result !== undefined ? `accepted:${String(res.result)}` : 'accepted';
    }
    this.pendingEffects.push(req);
    return 'queued';
  }
}

function queryContextSafe(ctx: NarrativeContextProjection, key: string, arg?: string): unknown {
  return queryNarrativeContext(ctx, key, arg);
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function sameEffect(a: NarrativeEffectRequest, b: NarrativeEffectRequest): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function InkRuntimeStateSchemaCheck(state: unknown): void {
  const r = z.object({ version: z.literal(1), storyStateJson: z.string().min(2) }).safeParse(state);
  if (!r.success) throw new Error(`Invalid InkRuntimeState: ${r.error.message}`);
}

// (class is already exported above)

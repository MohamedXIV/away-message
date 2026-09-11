// src/engine/innerVoice/InnerVoiceEngine.ts
// Deterministic rules gate for the Player Inner Voice (#23).
//
// RULES DECIDE WHAT THE PLAYER MAY THINK AND WHEN.
// This engine never calls AI, never mutates gameplay state, and never
// reveals hidden knowledge. It validates eligibility, enforces priority,
// cooldown/dedupe, one-active-thought, ambient suppression, and bounded
// history. Text resolution lives in InnerVoiceTextService.

import {
  THOUGHT_PRESENTATIONS,
  THOUGHT_TONES,
  type InnerVoicePersistedState,
  type InnerVoiceUiState,
  type InspectThoughtRequest,
  type PlayerKnowledgeView,
  type ThoughtIntent,
  type ThoughtPresentation,
  type ThoughtTrigger,
} from './types';

/** Cooldown window (game minutes) for ordinary cooldown keys. */
export const INNER_VOICE_DEFAULT_COOLDOWN_MINUTES = 120;
/** Shorter window for explicit Inspect/Think re-requests. */
export const INNER_VOICE_INSPECT_COOLDOWN_MINUTES = 15;
/** Extended window for notable (urgent / high-priority) thoughts. */
export const INNER_VOICE_NOTABLE_COOLDOWN_MINUTES = 2880;
/** Priority at or above which a thought counts as notable. */
export const INNER_VOICE_NOTABLE_PRIORITY = 80;
/** Max queued intents waiting for the single active slot. */
export const INNER_VOICE_MAX_QUEUE = 8;
/** Max recent intents remembered (session + persisted ids). */
export const INNER_VOICE_MAX_RECENT = 20;

/** Only these knowledge view fields may feed a ThoughtIntent. */
const ALLOWED_KNOWLEDGE_KEYS: ReadonlySet<string> = new Set([
  'visiblePlaceId',
  'visibleObjects',
  'learnedFacts',
  'playerMemories',
  'bodyHint',
  'economyHint',
  'timeHint',
  'weatherHint',
]);

/** Only these knowledge-ref namespaces may feed a ThoughtIntent. */
const ALLOWED_REF_PREFIXES = ['visible:', 'learned:', 'memory:', 'player:'];

function normalizeKnowledgeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function listContainsKnowledgeToken(values: readonly string[] | undefined, token: string): boolean {
  if (!values) return false;
  const normalizedToken = normalizeKnowledgeToken(token);
  return values.some((value) => {
    const normalizedValue = normalizeKnowledgeToken(value);
    return normalizedValue === normalizedToken || normalizedValue.endsWith(`_${normalizedToken}`);
  });
}

function isAllowedRef(ref: string): boolean {
  if (typeof ref !== 'string' || ref.trim() === '') return false;
  return ALLOWED_REF_PREFIXES.some((prefix) => ref.startsWith(prefix));
}

/**
 * A namespace alone is not proof of knowledge. Every ref must be backed by
 * the caller-provided PlayerKnowledgeView so hidden facts cannot be disguised
 * as learned:/visible:/memory:/player: references.
 */
function isRefBackedByKnowledge(ref: string, knowledge: PlayerKnowledgeView): boolean {
  const parts = ref.split(':');
  const namespace = parts[0];
  const domain = parts[1];
  const token = parts.slice(2).join(':');

  if (namespace === 'visible') {
    if (domain === 'place') {
      return Boolean(token) && normalizeKnowledgeToken(knowledge.visiblePlaceId ?? '') === normalizeKnowledgeToken(token);
    }
    if (domain === 'object') {
      return Boolean(token) && listContainsKnowledgeToken(knowledge.visibleObjects, token);
    }
    if (domain === 'weather') {
      return Boolean(knowledge.weatherHint);
    }
    return false;
  }

  if (namespace === 'learned') {
    const learnedToken = parts.slice(1).join(':');
    return Boolean(learnedToken) && listContainsKnowledgeToken(knowledge.learnedFacts, learnedToken);
  }

  if (namespace === 'memory') {
    const memoryToken = parts.slice(1).join(':');
    return Boolean(memoryToken) && listContainsKnowledgeToken(knowledge.playerMemories, memoryToken);
  }

  if (namespace === 'player') {
    if (domain === 'body') return Boolean(knowledge.bodyHint);
    if (domain === 'economy') return Boolean(knowledge.economyHint);
    if (domain === 'time') return Boolean(knowledge.timeHint);
    if (domain === 'weather') return Boolean(knowledge.weatherHint);
    return false;
  }

  return false;
}

/** Default priority when the trigger leaves it to the rules. */
function defaultPriorityFor(presentation: ThoughtPresentation): number {
  if (presentation === 'urgent') return 80;
  if (presentation === 'inspect') return 50;
  return 10;
}

function clampPriority(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

let engineSequence = 0;

export class InnerVoiceEngine {
  private active: ThoughtIntent | null = null;
  private queue: ThoughtIntent[] = [];
  private recent: ThoughtIntent[] = [];
  private cooldowns = new Map<string, number>();
  private notableIds = new Set<string>();

  constructor(persisted?: InnerVoicePersistedState | null) {
    if (persisted) this.hydrate(persisted);
  }

  /** Restore cooldown/notable-history only. Queue + active stay session-ephemeral. */
  public hydrate(persisted: InnerVoicePersistedState): void {
    this.cooldowns = new Map(
      Object.entries(persisted.cooldowns ?? {}).filter(
        ([key, minute]) => typeof key === 'string' && Number.isFinite(minute),
      ),
    );
    this.notableIds = new Set((persisted.notableIds ?? []).filter((id) => typeof id === 'string'));
    // persisted.recent round-trips for history fidelity; cooldowns own replay
    // protection, so no live slots are seeded here.
  }

  /** Minimal persisted slice: cooldown/notable-history only. */
  public getPersistedState(): InnerVoicePersistedState {
    return {
      cooldowns: Object.fromEntries(this.cooldowns),
      notableIds: [...this.notableIds].slice(-INNER_VOICE_MAX_RECENT),
      recent: this.recent.slice(-INNER_VOICE_MAX_RECENT).map((intent) => ({
        id: intent.cooldownKey ?? intent.id,
        minute: this.cooldowns.get(intent.cooldownKey ?? intent.id) ?? 0,
      })),
    };
  }

  public peekActive(): ThoughtIntent | null {
    return this.active;
  }

  public getRecent(): ThoughtIntent[] {
    return [...this.recent];
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  /** Dismiss the active thought; promote the highest-priority queued intent. */
  public dismissActive(): void {
    if (this.active) {
      this.recent.push(this.active);
      this.recent = this.recent.slice(-INNER_VOICE_MAX_RECENT);
      this.active = null;
    }
    if (this.queue.length > 0) {
      this.queue.sort((a, b) => b.priority - a.priority);
      this.active = this.queue.shift() ?? null;
    }
  }

  /**
   * Explicit player Inspect/Think path. Bypasses ambient UI suppression
   * (the player asked), keeps knowledge/cooldown/dedupe governance, and
   * never touches world state — it only reads the given knowledge view.
   */
  public requestInspect(request: InspectThoughtRequest, nowMinute: number): ThoughtIntent | null {
    return this.request(
      {
        kind: 'explicit_think',
        topic: request.topic,
        semanticMeaning: request.semanticMeaning,
        tone: request.tone ?? 'neutral',
        source: request.source,
        knowledgeRefs: request.knowledgeRefs,
        cooldownKey: request.cooldownKey,
        presentation: 'inspect',
        knowledge: request.knowledge,
      },
      nowMinute,
      { inspectBypass: true } as InnerVoiceUiState,
      INNER_VOICE_INSPECT_COOLDOWN_MINUTES,
    );
  }

  /**
   * Rule-governed request. Returns an approved ThoughtIntent or null when
   * no thought is owed (ineligible, hidden knowledge, cooldown, dedupe,
   * suppressed, or queued behind a more important active thought).
   */
  public request(
    trigger: ThoughtTrigger,
    nowMinute: number,
    ui?: InnerVoiceUiState,
    cooldownWindow: number = INNER_VOICE_DEFAULT_COOLDOWN_MINUTES,
  ): ThoughtIntent | null {
    const presentation: ThoughtPresentation =
      trigger.presentation && (THOUGHT_PRESENTATIONS as readonly string[]).includes(trigger.presentation)
        ? trigger.presentation
        : 'ambient';
    const inspectBypass =
      (ui as (InnerVoiceUiState & { inspectBypass?: boolean }) | undefined)?.inspectBypass === true;

    // Shape eligibility: bounded contract, no empty semantic core.
    if (!trigger || typeof trigger.topic !== 'string' || trigger.topic.trim() === '') return null;
    if (typeof trigger.semanticMeaning !== 'string' || trigger.semanticMeaning.trim() === '') return null;
    if (typeof trigger.source !== 'string' || trigger.source.trim() === '') return null;
    if (!Array.isArray(trigger.knowledgeRefs) || trigger.knowledgeRefs.length === 0) return null;
    const tone = trigger.tone ?? 'neutral';
    if (!(THOUGHT_TONES as readonly string[]).includes(tone)) return null;

    // Knowledge safety: the view itself must carry no smuggled hidden fields.
    if (!this.isKnowledgeViewClean(trigger.knowledge)) return null;
    // Every provenance ref must be both namespace-safe and actually backed by
    // the supplied player knowledge view; allowed prefixes are not sufficient.
    for (const ref of trigger.knowledgeRefs) {
      if (!isAllowedRef(ref) || !isRefBackedByKnowledge(ref, trigger.knowledge)) return null;
    }

    const priority = clampPriority(trigger.priority, defaultPriorityFor(presentation));
    const notable = presentation === 'urgent' || priority >= INNER_VOICE_NOTABLE_PRIORITY;
    const explicitKey = typeof trigger.cooldownKey === 'string' && trigger.cooldownKey.trim() !== ''
      ? trigger.cooldownKey
      : undefined;
    const cooldownKey = explicitKey ?? (notable ? `${trigger.source}|${trigger.topic}` : undefined);
    const window = presentation === 'inspect'
      ? Math.min(cooldownWindow, INNER_VOICE_INSPECT_COOLDOWN_MINUTES)
      : notable || (cooldownKey !== undefined && this.notableIds.has(cooldownKey))
        ? Math.max(cooldownWindow, INNER_VOICE_NOTABLE_COOLDOWN_MINUTES)
        : cooldownWindow;

    if (cooldownKey) {
      const last = this.cooldowns.get(cooldownKey);
      if (last !== undefined && nowMinute - last < window) return null;
    }

    const intent: ThoughtIntent = {
      id: `iv:${trigger.source}|${cooldownKey ?? trigger.topic}|${nowMinute}|${engineSequence++}`,
      topic: trigger.topic,
      semanticMeaning: trigger.semanticMeaning,
      tone,
      priority,
      source: trigger.source,
      knowledgeRefs: [...trigger.knowledgeRefs],
      ...(cooldownKey ? { cooldownKey } : {}),
      presentation,
    };

    if (this.isDuplicate(intent)) return null;
    if (!inspectBypass && this.isUiSuppressed(presentation, ui)) return null;

    if (cooldownKey) {
      this.cooldowns.set(cooldownKey, nowMinute);
      if (notable) this.notableIds.add(cooldownKey);
    }

    if (!this.active) {
      this.active = intent;
      return intent;
    }
    if (priority > this.active.priority) {
      const displaced = this.active;
      this.active = intent;
      if (displaced.presentation === 'ambient' && this.queue.length < INNER_VOICE_MAX_QUEUE) {
        this.queue.unshift(displaced);
      }
      return intent;
    }
    if (this.queue.length < INNER_VOICE_MAX_QUEUE) {
      this.queue.push(intent);
      this.queue.sort((a, b) => b.priority - a.priority);
      return intent;
    }
    return null;
  }

  private isKnowledgeViewClean(knowledge: PlayerKnowledgeView | undefined | null): boolean {
    if (!knowledge || typeof knowledge !== 'object') return false;
    for (const key of Object.keys(knowledge)) {
      if (!ALLOWED_KNOWLEDGE_KEYS.has(key)) return false;
    }
    return true;
  }

  private isDuplicate(intent: ThoughtIntent): boolean {
    const identity = intent.cooldownKey ?? intent.id;
    const seen = new Set<string>();
    const collect = (entry: ThoughtIntent) => {
      seen.add(entry.cooldownKey ?? entry.id);
      seen.add(entry.id);
    };
    if (this.active) collect(this.active);
    for (const queued of this.queue) collect(queued);
    if (seen.has(identity) || seen.has(intent.id)) return true;
    const semantic = `${intent.source}|${intent.topic}`;
    const hasSemantic = (entry: ThoughtIntent) => `${entry.source}|${entry.topic}` === semantic;
    if (this.active && hasSemantic(this.active)) return true;
    return this.queue.some(hasSemantic);
  }

  private isUiSuppressed(presentation: ThoughtPresentation, ui?: InnerVoiceUiState): boolean {
    if (!ui) return false;
    if (presentation === 'urgent') return false;
    return Boolean(ui.importantDialogueOpen || ui.urgentModalOpen || ui.inCutscene);
  }
}

/**
 * #187 Canonical epistemic ledger owned exclusively by WorldEventsEngine.
 * World truth, unverified claims and individually learned references are
 * different records. Ink/UI may consume actor-scoped views, never the ledger.
 */
export type SemanticValue = string | number | boolean;
export type KnowledgeSourceKind =
  | 'direct_observation' | 'school_notice' | 'teacher' | 'friend'
  | 'citywire' | 'nightboard_post' | 'email' | 'pulse_message'
  | 'scenario_seed' | 'system';

export interface KnowledgeProvenance {
  kind: KnowledgeSourceKind;
  sourceId: string;
  atMinute: number;
}

export interface WorldFactRecord {
  id: string;
  subjectId: string;
  predicate: string;
  value: SemanticValue;
  established: KnowledgeProvenance;
}

export interface ClaimRecord {
  id: string;
  factId: string;
  assertedValue: SemanticValue;
  published: KnowledgeProvenance;
}

export interface KnowledgeReceipt {
  kind: 'fact' | 'claim';
  refId: string;
  learned: KnowledgeProvenance;
}

export interface SemanticKnowledgeState {
  facts: Record<string, WorldFactRecord>;
  claims: Record<string, ClaimRecord>;
  learned: Record<string, KnowledgeReceipt[]>;
}

export interface ActorKnowledgeView {
  actorId: string;
  facts: WorldFactRecord[];
  claims: ClaimRecord[];
  // No unsourced/hidden world fact appears in this view.
}

const ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,79}$/;
const KINDS: readonly string[] = [
  'direct_observation', 'school_notice', 'teacher', 'friend',
  'citywire', 'nightboard_post', 'email', 'pulse_message',
  'scenario_seed', 'system',
];
export const MAX_SEMANTIC_FACTS = 256;
export const MAX_SEMANTIC_CLAIMS = 256;
export const MAX_ACTOR_KNOWLEDGE = 64;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

function semanticValue(value: unknown): value is SemanticValue {
  return typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
    || (typeof value === 'string' && value.length <= 160);
}

function provenance(value: unknown): value is KnowledgeProvenance {
  return record(value)
    && typeof value.kind === 'string' && KINDS.includes(value.kind)
    && id(value.sourceId)
    && typeof value.atMinute === 'number'
    && Number.isSafeInteger(value.atMinute) && value.atMinute >= 0;
}

function copyProvenance(value: KnowledgeProvenance): KnowledgeProvenance {
  return { kind: value.kind, sourceId: value.sourceId, atMinute: value.atMinute };
}

function validFact(value: unknown): value is WorldFactRecord {
  return record(value) && id(value.id) && id(value.subjectId)
    && id(value.predicate) && semanticValue(value.value)
    && provenance(value.established);
}

function validClaim(value: unknown): value is ClaimRecord {
  return record(value) && id(value.id) && id(value.factId)
    && semanticValue(value.assertedValue) && provenance(value.published);
}

function validReceipt(value: unknown): value is KnowledgeReceipt {
  return record(value) && (value.kind === 'fact' || value.kind === 'claim')
    && id(value.refId) && provenance(value.learned);
}

function copyFact(fact: WorldFactRecord): WorldFactRecord {
  return { ...fact, established: copyProvenance(fact.established) };
}
function copyClaim(claim: ClaimRecord): ClaimRecord {
  return { ...claim, published: copyProvenance(claim.published) };
}
function copyReceipt(entry: KnowledgeReceipt): KnowledgeReceipt {
  return { ...entry, learned: copyProvenance(entry.learned) };
}

export class KnowledgeLedger {
  private readonly facts = new Map<string, WorldFactRecord>();
  private readonly claims = new Map<string, ClaimRecord>();
  private readonly learned = new Map<string, KnowledgeReceipt[]>();

  constructor(initial?: unknown) { if (initial) this.loadState(initial); }

  public establishFact(fact: WorldFactRecord): boolean {
    if (!validFact(fact) || this.facts.has(fact.id) || this.facts.size >= MAX_SEMANTIC_FACTS) return false;
    this.facts.set(fact.id, copyFact(fact));
    return true;
  }

  public publishClaim(claim: ClaimRecord): boolean {
    if (!validClaim(claim) || this.claims.has(claim.id) || this.claims.size >= MAX_SEMANTIC_CLAIMS) return false;
    // A claim never mutates its referenced fact, even when its assertion disagrees.
    this.claims.set(claim.id, copyClaim(claim));
    return true;
  }

  public learn(actorId: string, receipt: KnowledgeReceipt): boolean {
    if (!id(actorId) || !validReceipt(receipt)) return false;
    if (receipt.kind === 'fact' && !this.facts.has(receipt.refId)) return false;
    if (receipt.kind === 'claim' && !this.claims.has(receipt.refId)) return false;
    const existing = this.learned.get(actorId) ?? [];
    if (existing.some(e => e.kind === receipt.kind && e.refId === receipt.refId)) return false;
    this.learned.set(actorId, [...existing, copyReceipt(receipt)].slice(-MAX_ACTOR_KNOWLEDGE));
    return true;
  }

  public knowsFact(actorId: string, factId: string): boolean {
    return (this.learned.get(actorId) ?? []).some(e => e.kind === 'fact' && e.refId === factId);
  }

  public heardClaim(actorId: string, claimId: string): boolean {
    return (this.learned.get(actorId) ?? []).some(e => e.kind === 'claim' && e.refId === claimId);
  }

  /**
   * Player-facing subject filter: a heard claim belongs to a subject even when
   * the listener has NOT learned its underlying world fact. Resolve subject
   * privately via the canonical fact map; never copy hidden fact values out.
   */
  public forActorSubject(actorId: string, subjectId: string): ActorKnowledgeView {
    const view = this.forActor(actorId);
    return {
      actorId,
      facts: view.facts.filter(fact => fact.subjectId === subjectId),
      claims: view.claims.filter(claim => this.facts.get(claim.factId)?.subjectId === subjectId),
    };
  }

  public forActor(actorId: string): ActorKnowledgeView {
    const receipts = this.learned.get(actorId) ?? [];
    return {
      actorId,
      facts: receipts.filter(r => r.kind === 'fact')
        .flatMap(r => { const fact = this.facts.get(r.refId); return fact ? [copyFact(fact)] : []; }),
      claims: receipts.filter(r => r.kind === 'claim')
        .flatMap(r => { const claim = this.claims.get(r.refId); return claim ? [copyClaim(claim)] : []; }),
    };
  }

  public getState(): SemanticKnowledgeState {
    return {
      facts: Object.fromEntries([...this.facts].map(([key, f]) => [key, copyFact(f)])),
      claims: Object.fromEntries([...this.claims].map(([key, c]) => [key, copyClaim(c)])),
      learned: Object.fromEntries([...this.learned].map(([key, values]) => [key, values.map(copyReceipt)])),
    };
  }

  /** Corruption-safe bounded hydration; incompatible development data is dropped. */
  public loadState(value: unknown): void {
    this.facts.clear();
    this.claims.clear();
    this.learned.clear();
    if (!record(value)) return;
    if (record(value.facts)) {
      for (const [key, raw] of Object.entries(value.facts).slice(0, MAX_SEMANTIC_FACTS)) {
        if (key === (record(raw) ? raw.id : undefined) && validFact(raw)) this.facts.set(key, copyFact(raw));
      }
    }
    if (record(value.claims)) {
      for (const [key, raw] of Object.entries(value.claims).slice(0, MAX_SEMANTIC_CLAIMS)) {
        if (key === (record(raw) ? raw.id : undefined) && validClaim(raw)) this.claims.set(key, copyClaim(raw));
      }
    }
    if (record(value.learned)) {
      for (const [actorId, entries] of Object.entries(value.learned).slice(0, MAX_SEMANTIC_FACTS)) {
        if (!id(actorId) || !Array.isArray(entries)) continue;
        for (const entry of entries.slice(-MAX_ACTOR_KNOWLEDGE)) {
          if (validReceipt(entry)) this.learn(actorId, entry);
        }
      }
    }
  }
}

/** What a fake-internet statement is allowed to claim about the world. */
export const SURFACE_PROVENANCE_KINDS = [
  'canonical_fact',
  'rumor',
  'claim',
  'opinion',
  'lie',
  'unknown',
] as const;

export type SurfaceProvenance = (typeof SURFACE_PROVENANCE_KINDS)[number];

export const SURFACE_STATEMENT_ROLES = ['opening', 'reply', 'section', 'guestbook', 'header'] as const;
export type SurfaceStatementRole = (typeof SURFACE_STATEMENT_ROLES)[number];

export interface SurfaceAuthor {
  kind: 'surface_only' | 'canonical_actor';
  handle: string;
  displayName: string;
  /** Present only when an authored flow explicitly binds a player-known canonical actor. */
  actorId?: string;
}

/** A public, bounded fact copied from a canonical owner read. */
export interface SurfaceCanonicalFact {
  key: string;
  value: string | number | boolean;
  source: string;
}

export interface SurfaceStatement {
  id: string;
  role: SurfaceStatementRole;
  heading?: string;
  author: SurfaceAuthor;
  provenance: SurfaceProvenance;
  text: string;
  /** Canonical-fact provenance must copy this from an owner-provided fact. */
  canonicalFact?: SurfaceCanonicalFact;
  /** Raw authored fact reference, kept so invalid promotions can be rejected. */
  factRef?: string;
  clueId?: string;
  tags: readonly string[];
}

export interface SurfaceNarrative {
  flowId: string;
  title: string;
  statements: readonly SurfaceStatement[];
  canonicalFacts: readonly SurfaceCanonicalFact[];
  clueIds: readonly string[];
}

export interface SurfaceKnownActor {
  id: string;
  displayName: string;
  handles: readonly string[];
}

export interface SurfaceNarrativeValidationInput {
  narrative: SurfaceNarrative;
  canonicalFacts: readonly SurfaceCanonicalFact[];
  knownActors: readonly SurfaceKnownActor[];
}

const MAX_TEXT_CHARS = 600;
const MAX_STATEMENTS = 64;
const MAX_CLUES = 16;

/**
 * Validate provenance and identity boundaries. This never mutates state and
 * never promotes a claim: it only rejects statements that pretend to be
 * canonical or impersonate a canonical actor.
 */
export function validateSurfaceNarrative(input: SurfaceNarrativeValidationInput): string[] {
  const errors: string[] = [];
  const { narrative } = input;
  if (!narrative.title.trim()) errors.push('narrative.title must be non-empty');
  if (narrative.statements.length === 0) errors.push('narrative needs at least one statement');
  if (narrative.statements.length > MAX_STATEMENTS) errors.push(`narrative exceeds ${MAX_STATEMENTS} statements`);
  if (narrative.clueIds.length > MAX_CLUES) errors.push(`narrative exceeds ${MAX_CLUES} clue ids`);

  const factsByKey = new Map(input.canonicalFacts.map((fact) => [fact.key, fact]));
  const actorsById = new Map(input.knownActors.map((actor) => [actor.id, actor]));

  narrative.statements.forEach((statement, index) => {
    const at = `statement[${index}]`;
    if (!statement.text.trim()) errors.push(`${at}.text must be non-empty`);
    if (statement.text.length > MAX_TEXT_CHARS) errors.push(`${at}.text exceeds ${MAX_TEXT_CHARS} chars`);
    if (!statement.author.handle.trim()) errors.push(`${at}.author.handle must be non-empty`);
    if (!statement.author.displayName.trim()) errors.push(`${at}.author.displayName must be non-empty`);

    if (statement.author.kind === 'surface_only') {
      if (statement.author.actorId) {
        errors.push(`${at} surface-only author must not carry a canonical actor id`);
      }
    } else {
      const actor = statement.author.actorId ? actorsById.get(statement.author.actorId) : undefined;
      if (!actor) {
        errors.push(`${at} canonical author is not a player-known actor`);
      } else {
        const handleKnown = actor.handles.some(
          (handle) => handle.toLowerCase() === statement.author.handle.toLowerCase(),
        );
        if (!handleKnown) {
          errors.push(`${at} canonical author handle is not owned by the actor`);
        }
      }
    }

    if (statement.provenance === 'canonical_fact') {
      if (!statement.factRef) {
        errors.push(`${at} canonical_fact requires a factRef`);
      }
      if (!statement.canonicalFact) {
        errors.push(`${at} canonical_fact requires an owner-provided fact`);
      } else {
        const sourceFact = factsByKey.get(statement.canonicalFact.key);
        if (!sourceFact) {
          errors.push(`${at} canonical_fact references an unknown fact key`);
        } else if (
          sourceFact.value !== statement.canonicalFact.value
          || sourceFact.source !== statement.canonicalFact.source
        ) {
          errors.push(`${at} canonical_fact does not match the owner-provided value/source`);
        }
        if (statement.factRef && statement.factRef !== statement.canonicalFact.key) {
          errors.push(`${at} canonical_fact factRef does not match the copied fact`);
        }
        if (!textCarriesFact(statement.text, statement.canonicalFact.value)) {
          errors.push(`${at} canonical_fact text does not contain the owner-provided value`);
        }
      }
    } else {
      if (statement.canonicalFact) {
        errors.push(`${at} ${statement.provenance} must not carry a canonical fact`);
      }
      if (statement.factRef) {
        errors.push(`${at} ${statement.provenance} must not carry a fact reference`);
      }
    }
  });

  return errors;
}

export function assertSurfaceNarrative(input: SurfaceNarrativeValidationInput): void {
  const errors = validateSurfaceNarrative(input);
  if (errors.length > 0) throw new Error(`Invalid surface narrative: ${errors.join('; ')}`);
}

export function isSurfaceProvenance(value: unknown): value is SurfaceProvenance {
  return typeof value === 'string' && (SURFACE_PROVENANCE_KINDS as readonly string[]).includes(value);
}

export function isSurfaceStatementRole(value: unknown): value is SurfaceStatementRole {
  return typeof value === 'string' && (SURFACE_STATEMENT_ROLES as readonly string[]).includes(value);
}

function textCarriesFact(text: string, value: string | number | boolean): boolean {
  const normalized = normalize(text);
  return normalized.includes(normalize(String(value)));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

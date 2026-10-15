import type { CoreMemoryMeaning } from '../types';

/**
 * Typed memory meaning belongs to Social; this helper only validates and
 * detaches optional metadata. The prose remains a fallback, not truth.
 */
const REF = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,79}$/;
const SOURCES = ['direct_experience', 'domain_event', 'message', 'scenario'] as const;
const SUBJECTS = ['actor', 'promise', 'event', 'fact', 'claim'] as const;
const SALIENCE = ['low', 'medium', 'high'] as const;
const VALENCE = ['positive', 'negative', 'neutral', 'mixed'] as const;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value);
}
export function parseCoreMemoryMeaning(input: unknown): CoreMemoryMeaning | undefined {
  if (!object(input) || !Array.isArray(input.participants)
    || input.participants.length < 1 || input.participants.length > 8
    || !input.participants.every(isRef)
    || !object(input.subject) || !object(input.source)
    || !SUBJECTS.includes(input.subject.kind as typeof SUBJECTS[number])
    || !SOURCES.includes(input.source.kind as typeof SOURCES[number])
    || !isRef(input.subject.id) || !isRef(input.source.refId)
    || !SALIENCE.includes(input.salience as typeof SALIENCE[number])
    || !VALENCE.includes(input.valence as typeof VALENCE[number])) return undefined;
  return {
    participants: [...input.participants],
    subject: { kind: input.subject.kind as CoreMemoryMeaning['subject']['kind'], id: input.subject.id },
    source: { kind: input.source.kind as CoreMemoryMeaning['source']['kind'], refId: input.source.refId },
    salience: input.salience as CoreMemoryMeaning['salience'],
    valence: input.valence as CoreMemoryMeaning['valence'],
  };
}

import { describe, expect, it } from 'vitest';
import {
  assertSurfaceNarrative,
  validateSurfaceNarrative,
  type SurfaceCanonicalFact,
  type SurfaceKnownActor,
  type SurfaceNarrative,
  type SurfaceStatement,
} from '../../src/narrative/fakeNet';

const fact: SurfaceCanonicalFact = { key: 'current_day', value: 3, source: 'clock.day' };
const maya: SurfaceKnownActor = { id: 'maya', displayName: 'Maya', handles: ['maya_x'] };

function statement(overrides: Partial<SurfaceStatement> = {}): SurfaceStatement {
  return {
    id: 's1',
    role: 'reply',
    author: { kind: 'surface_only', handle: 'nightowl87', displayName: 'Night Owl' },
    provenance: 'rumor',
    text: 'The pumps are shutting off tomorrow.',
    tags: [],
    ...overrides,
  };
}

function narrative(statements: SurfaceStatement[], title = 'Canal pumps'): SurfaceNarrative {
  return { flowId: 'test', title, statements, canonicalFacts: [fact], clueIds: [] };
}

function errorsFor(statements: SurfaceStatement[], knownActors: SurfaceKnownActor[] = [maya]): string[] {
  return validateSurfaceNarrative({ narrative: narrative(statements), canonicalFacts: [fact], knownActors });
}

describe('#184 surface provenance and identity validation', () => {
  it('accepts a mixed narrative with sourced canonical fact and known canonical author', () => {
    const errors = errorsFor([
      statement(),
      statement({
        id: 'clock',
        author: { kind: 'surface_only', handle: 'anon_clock', displayName: 'anonymous' },
        provenance: 'canonical_fact',
        text: 'Day 3. That much is on the calendar.',
        factRef: 'current_day',
        canonicalFact: { ...fact },
      }),
      statement({
        id: 'maya',
        author: { kind: 'canonical_actor', actorId: 'maya', handle: 'maya_x', displayName: 'Maya' },
        provenance: 'opinion',
        text: 'The diner has been quiet all week.',
      }),
    ]);
    expect(errors).toEqual([]);
  });

  it('rejects canonical_fact without a fact ref or a sourced fact', () => {
    const noRef = errorsFor([
      statement({ provenance: 'canonical_fact', text: 'Day 3.', canonicalFact: { ...fact } }),
    ]);
    expect(noRef.join(' ')).toContain('requires a factRef');

    const noFact = errorsFor([
      statement({ provenance: 'canonical_fact', text: 'Day 3.', factRef: 'current_day' }),
    ]);
    expect(noFact.join(' ')).toContain('owner-provided fact');
  });

  it('rejects unknown, mismatched or text-inconsistent canonical facts', () => {
    const unknown = errorsFor([
      statement({
        provenance: 'canonical_fact', text: 'Route 2 is closed.', factRef: 'route_2_status',
        canonicalFact: { key: 'route_2_status', value: 'closed', source: 'transit' },
      }),
    ]);
    expect(unknown.join(' ')).toContain('unknown fact key');

    const mismatch = errorsFor([
      statement({
        provenance: 'canonical_fact', text: 'Day 99.', factRef: 'current_day',
        canonicalFact: { key: 'current_day', value: 99, source: 'clock.day' },
      }),
    ]);
    expect(mismatch.join(' ')).toContain('does not match');

    const missingValue = errorsFor([
      statement({
        provenance: 'canonical_fact', text: 'The calendar says something.', factRef: 'current_day',
        canonicalFact: { ...fact },
      }),
    ]);
    expect(missingValue.join(' ')).toContain('does not contain');
  });

  it('rejects claims that carry canonical fact fields', () => {
    const withFact = errorsFor([
      statement({ provenance: 'rumor', canonicalFact: { ...fact }, factRef: 'current_day' }),
    ]);
    expect(withFact.join(' ')).toContain('must not carry a canonical fact');
    expect(withFact.join(' ')).toContain('must not carry a fact reference');

    const lie = errorsFor([statement({ provenance: 'lie', text: 'I own the canal.' })]);
    expect(lie).toEqual([]);
  });

  it('rejects surface authors carrying canonical actor ids', () => {
    const errors = errorsFor([
      statement({ author: { kind: 'surface_only', actorId: 'maya', handle: 'nightowl87', displayName: 'Night Owl' } }),
    ]);
    expect(errors.join(' ')).toContain('must not carry a canonical actor id');
  });

  it('rejects unknown canonical authors and borrowed handles', () => {
    const unknown = errorsFor([
      statement({ author: { kind: 'canonical_actor', actorId: 'nobody', handle: 'nobody', displayName: 'Nobody' } }),
    ]);
    expect(unknown.join(' ')).toContain('not a player-known actor');

    const borrowed = errorsFor([
      statement({ author: { kind: 'canonical_actor', actorId: 'maya', handle: 'not_maya', displayName: 'Maya' } }),
    ]);
    expect(borrowed.join(' ')).toContain('handle is not owned');
  });

  it('does not infer a canonical identity from a surface handle', () => {
    const surface = statement({
      author: { kind: 'surface_only', handle: 'maya_x', displayName: 'maya x' },
    });
    expect(errorsFor([surface])).toEqual([]);
    expect(surface.author.actorId).toBeUndefined();
  });

  it('rejects surface impersonation of a known actor unless the handle is bound', () => {
    const impostor = errorsFor([
      statement({ author: { kind: 'surface_only', handle: 'nightowl87', displayName: 'Maya' } }),
    ]);
    expect(impostor.join(' ')).toContain('display name matches a player-known actor');

    const boundHandle = errorsFor([
      statement({ author: { kind: 'surface_only', handle: 'maya_x', displayName: 'Maya' } }),
    ]);
    expect(boundHandle).toEqual([]);
  });

  it('rejects empty/oversized narratives and throws through the assert helper', () => {
    expect(validateSurfaceNarrative({
      narrative: narrative([], ''),
      canonicalFacts: [fact],
      knownActors: [maya],
    }).join(' ')).toContain('title must be non-empty');

    expect(() => assertSurfaceNarrative({
      narrative: narrative([
        statement({ author: { kind: 'canonical_actor', actorId: 'nobody', handle: 'x', displayName: 'X' } }),
      ]),
      canonicalFacts: [fact],
      knownActors: [maya],
    })).toThrow(/Invalid surface narrative/);
  });
});

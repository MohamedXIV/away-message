import { describe, expect, it } from 'vitest';
import { getStreetSighting, type SightingBuddy } from '../../src/world/data/windowThoughts';

const visible = (overrides: Partial<SightingBuddy> = {}): SightingBuddy => ({
  id: 'person_a', displayName: 'Known Local', reach: 'local',
  knownToPlayer: true, physicallyVisibleFromWindow: true,
  ...overrides,
});

describe('window sightings only caption physically witnessed local actors', () => {
  it('fails closed for remote, unknown and spatially unverified contacts', () => {
    expect(getStreetSighting([visible({ reach: 'remote' })], 'day', 3)).toBeNull();
    expect(getStreetSighting([visible({ knownToPlayer: false })], 'day', 3)).toBeNull();
    expect(getStreetSighting([visible({ physicallyVisibleFromWindow: false })], 'day', 3)).toBeNull();
    expect(getStreetSighting([visible({ lifecycleStatus: 'gone' })], 'day', 3)).toBeNull();
    expect(getStreetSighting([visible({ lifecycleStatus: 'blocked' })], 'day', 3)).toBeNull();
  });

  it('renders a deterministic caption for a genuinely witnessed familiar local person', () => {
    const text = getStreetSighting([visible()], 'evening', 5);
    expect(text).toContain('Known Local');
    expect(text).toBe(getStreetSighting([visible()], 'evening', 5));
    expect(getStreetSighting([visible()], 'night', 5)).not.toBeNull();
  });
});

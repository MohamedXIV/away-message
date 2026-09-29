// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  PhaserCharacterSurface,
  resolveCharacterAnchorTransform,
  toPhaserMeshIndices,
} from '../../src/world/phaser/PhaserCharacterSurface';

describe('PhaserCharacterSurface (#25)', () => {
  it('converts renderer-neutral triangles to Phaser Mesh2D page-index tuples', () => {
    expect(toPhaserMeshIndices([0, 1, 2, 0, 2, 3])).toEqual([
      0, 1, 2, 0,
      0, 2, 3, 0,
    ]);
    expect(() => toPhaserMeshIndices([0, 1])).toThrow(/complete triples/i);
  });

  it('resolves normalized authored CharacterAnchor coordinates into scene pixels', () => {
    expect(resolveCharacterAnchorTransform({
      id: 'fixture_customer',
      name: 'Customer',
      x: 0.65,
      y: 0.5,
      tags: ['customer'],
      interactions: [],
    }, 1600, 900, 0.9)).toEqual({
      x: 1040,
      y: 450,
      scale: 0.9,
      depth: 31,
      visible: true,
    });
  });

  it('keeps placement behind a Phaser-only render surface', () => {
    const object = {
      setPosition: vi.fn(),
      setScale: vi.fn(),
      setDepth: vi.fn(),
      setVisible: vi.fn(),
      destroy: vi.fn(),
    };
    const surface = new PhaserCharacterSurface(object);
    surface.setTransform({ x: 320, y: 240, scale: 1.1, depth: 32, visible: true });

    expect(object.setPosition).toHaveBeenCalledWith(320, 240);
    expect(object.setScale).toHaveBeenCalledWith(1.1);
    expect(object.setDepth).toHaveBeenCalledWith(32);
    expect(object.setVisible).toHaveBeenCalledWith(true);

    surface.destroy();
    expect(object.destroy).toHaveBeenCalledOnce();
  });
});

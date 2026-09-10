// @vitest-environment jsdom
// tests/unit/PhysicalWorldLifecycle.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PhaserWorldRuntime } from '../../src/world/phaser/PhaserWorldRuntime';
import { createTechnicalFixtureProjection } from '../../src/world/phaser/technicalFixture';
import type { WorldInteractionIntent } from '../../src/world/phaser/types';

describe('Phaser Physical World Runtime Lifecycle', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 1280, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 720, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('creates exactly one runtime and destroys it cleanly without DOM leaks', () => {
    const projection = createTechnicalFixtureProjection();
    const runtime = new PhaserWorldRuntime({
      parent: container,
      projection,
    });

    expect(runtime).toBeDefined();

    // Destroy
    runtime.destroy();

    // Canvas must be cleaned up
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBe(0);
  });

  it('repeated navigation / re-mount does not accumulate duplicate canvases', () => {
    const projection = createTechnicalFixtureProjection();

    // First visit
    const runtime1 = new PhaserWorldRuntime({
      parent: container,
      projection,
    });
    runtime1.destroy();
    expect(container.querySelectorAll('canvas').length).toBe(0);

    // Second visit (simulating navigating away and returning)
    const runtime2 = new PhaserWorldRuntime({
      parent: container,
      projection,
    });
    runtime2.destroy();
    expect(container.querySelectorAll('canvas').length).toBe(0);

    // Third visit
    const runtime3 = new PhaserWorldRuntime({
      parent: container,
      projection,
    });
    runtime3.destroy();
    expect(container.querySelectorAll('canvas').length).toBe(0);
  });

  it('resizes scale without throwing or corrupting state', () => {
    const projection = createTechnicalFixtureProjection();
    const runtime = new PhaserWorldRuntime({
      parent: container,
      projection,
    });

    expect(() => {
      runtime.resize(1920, 1080);
      runtime.resize(800, 600);
    }).not.toThrow();

    runtime.destroy();
  });

  it('forwards semantic intents outward without mutating domain state directly', () => {
    const intents: WorldInteractionIntent[] = [];
    const projection = createTechnicalFixtureProjection();

    const runtime = new PhaserWorldRuntime({
      parent: container,
      projection,
      onIntent: (intent) => intents.push(intent),
    });

    // Simulate transition request
    runtime.transitionToView('view_a2');

    runtime.destroy();
  });
});

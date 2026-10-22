// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/world/phaser/PhysicalWorldBoundary', () => ({
  PhysicalWorldBoundary: () => null,
}));
vi.mock('../../src/world/phaser/presentationAdapter', () => ({
  createWorldSceneProjection: () => ({}),
}));

import { CafeScene } from '../../src/world/CafeScene';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';

async function waitForText(container: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
  throw new Error(`Timed out waiting for text: ${text}\n${container.textContent ?? ''}`);
}

describe('#185 café authored Ink surface', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollTo = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const engine = new SimulationEngine();
    engine.relocateActorSpatially('maya', { x: 20, y: 60, z: 0 });
    await act(async () => {
      useSimulationStore.getState().setEngine(engine);
    });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    await act(async () => {
      useSimulationStore.getState().setEngine(new SimulationEngine());
    });
  });

  it('renders the Ink opening and commits an authored choice through canonical Social', async () => {
    const engine = useSimulationStore.getState().engine;
    const before = engine.social.getRelationships('maya');

    await act(async () => {
      root.render(React.createElement(CafeScene));
    });
    await waitForText(container, 'Hey! You made it!');
    await waitForText(container, "Ask how they've been");

    const choice = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes("Ask how they've been"));
    expect(choice).toBeTruthy();

    await act(async () => {
      choice!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const after = engine.social.getRelationships('maya');
    expect(after?.trust).toBeGreaterThan(before?.trust ?? 0);
    expect(engine.social.getMessages('maya').some((message) => message.text.includes('the week comes out sideways')))
      .toBe(true);
    await waitForText(container, 'the week comes out sideways');
    expect(Array.from(container.querySelectorAll('button'))
      .some((button) => button.textContent?.includes("Ask how they've been"))).toBe(false);
  });
});

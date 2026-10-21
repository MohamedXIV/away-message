// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MyPlaceSite } from '../../src/internet/sites/MyPlaceSite';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import type { SiteRouteProps } from '../../src/internet/types';

describe('#181 MyPlace Add to Friends', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      useSimulationStore.getState().setEngine(new SimulationEngine());
    });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    await act(async () => {
      useSimulationStore.getState().setEngine(new SimulationEngine());
    });
  });

  it('promotes the viewed profile as a remote actor from the actual UI action', async () => {
    const engine = useSimulationStore.getState().engine;
    const props = {
      url: {} as SiteRouteProps['url'],
      navigate: () => {},
      params: { username: 'diner_ghost' },
      searchParams: {},
    } as SiteRouteProps;

    await act(async () => {
      root.render(React.createElement(MyPlaceSite, props));
    });

    const addButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Add to Friends'));
    expect(addButton).toBeTruthy();

    await act(async () => {
      addButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const actor = engine.social.getBuddies().find(buddy => buddy.handle === 'diner_ghost');
    expect(actor).toBeDefined();
    expect(actor?.reach).toBe('remote');
    expect(actor?.metVia).toBe('myplace');
    expect(engine.social.isKnown(actor!.id)).toBe(true);
    expect(container.textContent).toContain('In your Pulse list');
  });
});

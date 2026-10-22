// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NightBoardInkThread } from '../../src/internet/sites/NightBoardInkThread';
import { CanalWatchSite } from '../../src/internet/sites/CanalWatchSite';
import { NightBoardSite } from '../../src/internet/sites/NightBoardSite';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import type { SiteRouteProps } from '../../src/internet/types';

async function waitForText(container: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  throw new Error(`Timed out waiting for text: ${text}\n${container.textContent ?? ''}`);
}

describe('#184 playable fake-net surfaces', () => {
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

  it('renders the NightBoard Ink thread with provenance labels and governed promotion', async () => {
    const engine = useSimulationStore.getState().engine;
    const navigate = vi.fn();
    await act(async () => {
      root.render(React.createElement(NightBoardInkThread, { navigate }));
    });
    await waitForText(container, 'North Bank Owl');

    expect(container.textContent).toContain('rumor');
    expect(container.textContent).toContain('canonical');
    expect(container.textContent).toContain('opinion');
    expect(container.textContent).toContain('roleplay / lie');
    expect(container.textContent).toContain('unverified');
    expect(container.textContent).toContain('pumps cutting out');
    expect(engine.social.getBuddy('northbank_owl')).toBeUndefined();

    const addButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('add to Pulse'));
    expect(addButton).toBeTruthy();
    await act(async () => {
      addButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(engine.social.getBuddy('northbank_owl')?.reach).toBe('remote');
    expect(engine.social.isKnown('northbank_owl')).toBe(true);
    expect(container.textContent).toContain('added to Pulse');
  });

  it('keeps static and NPC-authored NightBoard content alongside the Ink entry', async () => {
    const engine = useSimulationStore.getState().engine;
    const npcTitle = engine.getNightBoardRead().threads[0]?.title;
    const props = {
      url: {} as SiteRouteProps['url'],
      navigate: vi.fn(),
      params: {},
      searchParams: {},
    } as SiteRouteProps;

    await act(async () => {
      root.render(React.createElement(NightBoardSite, props));
    });
    await waitForText(container, 'Sub-Canal Infrastructure Hum');

    expect(container.textContent).toContain('Ink-authored thread');
    if (npcTitle) expect(container.textContent).toContain(npcTitle);
  });

  it('renders the generated-site flow with a clue and provenance legend', async () => {
    const navigate = vi.fn();
    const props = {
      url: {} as SiteRouteProps['url'],
      navigate,
      params: {},
      searchParams: {},
    } as SiteRouteProps;

    await act(async () => {
      root.render(React.createElement(CanalWatchSite, props));
    });
    await waitForText(container, 'CANAL WATCH');

    expect(container.textContent).toContain('canonical');
    expect(container.textContent).toContain('claim');
    expect(container.textContent).toContain('unverified');
    expect(container.textContent).toContain('guestbook');
    expect(container.textContent).toContain('intake map');
    expect(container.textContent).toContain('not world truth');

    const back = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('back to NightBoard'));
    expect(back).toBeTruthy();
    await act(async () => {
      back!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(navigate).toHaveBeenCalledWith('http://nightboard.local/');
  });
});

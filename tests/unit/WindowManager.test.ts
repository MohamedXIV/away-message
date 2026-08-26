import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '../../src/store/useWindowStore';

describe('WindowManager Store & Logic Suite', () => {
  beforeEach(() => {
    useWindowStore.setState({
      windows: {},
      windowOrder: [],
      activeWindowId: null,
      highestZIndex: 10,
      cascadeCounter: 0,
    });
  });

  it('opens a new window and assigns cascaded position and highest zIndex', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('terminal', 'Terminal CLI');

    const state = useWindowStore.getState();
    const win = state.windows[winId];
    expect(win).toBeDefined();
    expect(win?.isOpen).toBe(true);
    expect(win?.title).toBe('Terminal CLI');
    expect(win?.zIndex).toBeGreaterThanOrEqual(11);
    expect(state.activeWindowId).toBe(winId);
  });

  it('supports opening with OpenWindowConfig object', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow({
      id: 'custom_doc',
      appId: 'notepad',
      title: 'Notes.txt',
      defaultSize: { width: 500, height: 350 },
      customState: { filePath: 'C:/Documents/Notes.txt' },
    });

    const state = useWindowStore.getState();
    const win = state.windows['custom_doc'];
    expect(winId).toBe('custom_doc');
    expect(win?.size).toEqual({ width: 500, height: 350 });
    expect(win?.customState?.filePath).toBe('C:/Documents/Notes.txt');
  });

  it('brings window to front when focused', () => {
    const store = useWindowStore.getState();
    const win1 = store.openWindow('terminal', 'Terminal 1');
    const win2 = store.openWindow('notepad', 'Notepad');

    expect(useWindowStore.getState().activeWindowId).toBe(win2);
    expect(useWindowStore.getState().windows[win2]?.zIndex).toBeGreaterThan(
      useWindowStore.getState().windows[win1]?.zIndex ?? 0
    );

    // Focus win1
    useWindowStore.getState().focusWindow(win1);
    const updatedState = useWindowStore.getState();
    expect(updatedState.activeWindowId).toBe(win1);
    expect(updatedState.windows[win1]?.zIndex).toBeGreaterThan(
      updatedState.windows[win2]?.zIndex ?? 0
    );
  });

  it('minimizes and restores window state cleanly', () => {
    const store = useWindowStore.getState();
    const win1 = store.openWindow('fileexplorer', 'File Explorer');
    const win2 = store.openWindow('notepad', 'Notepad');

    // Minimize win2 (active)
    store.minimizeWindow(win2);
    let state = useWindowStore.getState();
    expect(state.windows[win2]?.isMinimized).toBe(true);
    expect(state.activeWindowId).toBe(win1);

    // Restore win2
    store.restoreWindow(win2);
    state = useWindowStore.getState();
    expect(state.windows[win2]?.isMinimized).toBe(false);
    expect(state.activeWindowId).toBe(win2);
  });

  it('toggles maximize preserving restore bounds', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('controlpanel', 'Control Panel');

    const winBefore = useWindowStore.getState().windows[winId];
    expect(winBefore).toBeDefined();
    const originalPos = { ...winBefore!.position };
    const originalSize = { ...winBefore!.size };

    store.maximizeWindow(winId);
    expect(useWindowStore.getState().windows[winId]?.isMaximized).toBe(true);
    expect(useWindowStore.getState().windows[winId]?.previousPosition).toEqual(originalPos);
    expect(useWindowStore.getState().windows[winId]?.previousSize).toEqual(originalSize);

    store.unmaximizeWindow(winId);
    expect(useWindowStore.getState().windows[winId]?.isMaximized).toBe(false);
    expect(useWindowStore.getState().windows[winId]?.position).toEqual(originalPos);
    expect(useWindowStore.getState().windows[winId]?.size).toEqual(originalSize);
  });

  it('toggleMaximize toggles back and forth', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('terminal');

    store.toggleMaximize(winId);
    expect(useWindowStore.getState().windows[winId]?.isMaximized).toBe(true);

    store.toggleMaximize(winId);
    expect(useWindowStore.getState().windows[winId]?.isMaximized).toBe(false);
  });

  it('closes window and transfers active focus to next highest window', () => {
    const store = useWindowStore.getState();
    const win1 = store.openWindow('terminal', 'Terminal');
    const win2 = store.openWindow('notepad', 'Notepad');
    const win3 = store.openWindow('fileexplorer', 'Explorer');

    expect(useWindowStore.getState().activeWindowId).toBe(win3);

    store.closeWindow(win3);
    expect(useWindowStore.getState().windows[win3]?.isOpen).toBe(false);
    expect(useWindowStore.getState().activeWindowId).toBe(win2);

    store.closeWindow(win2);
    expect(useWindowStore.getState().windows[win2]?.isOpen).toBe(false);
    expect(useWindowStore.getState().activeWindowId).toBe(win1);

    store.closeWindow(win1);
    expect(useWindowStore.getState().windows[win1]?.isOpen).toBe(false);
    expect(useWindowStore.getState().activeWindowId).toBeNull();
  });

  it('minimizeAll minimizes all open windows', () => {
    const store = useWindowStore.getState();
    const win1 = store.openWindow('terminal');
    const win2 = store.openWindow('notepad');

    store.minimizeAll();
    const state = useWindowStore.getState();
    expect(state.windows[win1]?.isMinimized).toBe(true);
    expect(state.windows[win2]?.isMinimized).toBe(true);
    expect(state.activeWindowId).toBeNull();
  });

  it('cascades and tiles windows across workspace', () => {
    const store = useWindowStore.getState();
    const win1 = store.openWindow('terminal');
    const win2 = store.openWindow('notepad');

    store.cascadeWindows(1024, 768);
    let state = useWindowStore.getState();
    expect(state.windows[win1]?.position.x).not.toBe(state.windows[win2]?.position.x);

    store.tileWindows('horizontal', 1024, 768);
    state = useWindowStore.getState();
    expect(state.windows[win1]?.size.width).toBe(1024);

    store.tileWindows('vertical', 1024, 768);
    state = useWindowStore.getState();
    expect(state.windows[win1]?.size.width).toBe(512);
  });

  it('clamps size to minSize on setWindowSize', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('terminal');

    store.setWindowSize(winId, { width: 100, height: 80 });
    const win = useWindowStore.getState().windows[winId];
    expect(win).toBeDefined();
    expect(win?.size.width).toBeGreaterThanOrEqual(win?.minSize.width ?? 0);
    expect(win?.size.height).toBeGreaterThanOrEqual(win?.minSize.height ?? 0);
  });

  it('updates custom state and window title cleanly', () => {
    const store = useWindowStore.getState();
    const winId = store.openWindow('notepad');

    store.setWindowTitle(winId, 'Custom Title');
    store.updateWindowCustomState(winId, { isSaved: true });

    const win = useWindowStore.getState().windows[winId];
    expect(win).toBeDefined();
    expect(win?.title).toBe('Custom Title');
    expect(win?.customState?.isSaved).toBe(true);
  });
});

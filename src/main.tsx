import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

/**
 * One supported production runtime: the canonical Dedicated Worker.
 * Classic is an explicit DEV-only fixture for migration/regression tests.
 * A Worker boot error must never construct the legacy main-thread engine.
 */
async function mountGame(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;

  const requested = new URLSearchParams(window.location.search).get('runtime');
  if (requested && requested !== 'worker' && requested !== 'legacy') {
    throw new Error('Unknown simulation runtime. Use the normal game URL.');
  }
  if (requested === 'legacy' && !import.meta.env.DEV) {
    throw new Error('Classic simulation is not available in production.');
  }

  if (requested === 'legacy' && import.meta.env.DEV) {
    // Explicit browser-test/dev fixture ONLY, selected through full-page
    // navigation. This dynamic branch is dead in Vite production builds.
    root.dataset.runtime = 'legacy';
    const [{ default: App }, { useSimulationStore }, { useWindowStore }, slots] =
      await Promise.all([
        import('./App'),
        import('./store/useSimulationStore'),
        import('./store/useWindowStore'),
        import('./persistence/slots'),
      ]);
    (window as any).__simEngine = useSimulationStore.getState().engine;
    (window as any).__simStore = useSimulationStore;
    (window as any).__windowStore = useWindowStore;
    (window as any).__slots = slots;
    ReactDOM.createRoot(root).render(
      <React.StrictMode><App /></React.StrictMode>,
    );
    return;
  }

  // The ordinary / path, /?runtime=worker and worker.html all mount the
  // SAME Worker-only shell; no local SimulationKernel, no fallback and no
  // synchronous Classic import on the supported production route.
  root.dataset.runtime = 'worker';
  const { WorkerGameShell } = await import('./simulation/host/WorkerGameShell');
  ReactDOM.createRoot(root).render(<WorkerGameShell />);
}

void mountGame().catch(error => {
  // Fail closed. Never silently select a second simulation owner.
  const root = document.getElementById('root');
  if (root) {
    root.setAttribute('role', 'alert');
    root.setAttribute('data-testid', 'runtime-boot-error');
    root.textContent = 'Unable to start Away Message: ' +
      (error instanceof Error ? error.message : String(error));
  }
});

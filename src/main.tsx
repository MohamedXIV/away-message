import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

/**
 * Staged root-entry migration. The explicit ?runtime=worker route loads only
 * WorkerGameShell, never App/defaultEngine/useSimulationStore. When migration
 * gates pass, this decision can flip without rewriting the application.
 *
 * A Worker boot error is handled by WorkerGameSession and MUST NOT load a
 * second, synchronous SimulationEngine as a fallback.
 */
async function mountGame(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;

  const requested = new URLSearchParams(window.location.search).get('runtime');
  if (requested && requested !== 'worker' && requested !== 'legacy') {
    throw new Error('Unknown simulation runtime. Use runtime=worker or runtime=legacy.');
  }

  const workerMode = requested === 'worker';
  root.dataset.runtime = workerMode ? 'worker' : 'legacy';

  if (workerMode) {
    // Deliberately dynamic and mutually exclusive with the legacy import
    // chain: Vite should not even request the legacy main-thread engine.
    const { WorkerGameShell } = await import('./simulation/host/WorkerGameShell');
    ReactDOM.createRoot(root).render(<WorkerGameShell />);
    return;
  }

  const [{ default: App }, { useSimulationStore }, { useWindowStore }, slots] =
    await Promise.all([
      import('./App'),
      import('./store/useSimulationStore'),
      import('./store/useWindowStore'),
      import('./persistence/slots'),
    ]);

  // Legacy Playwright fixture only. Never install these on the Worker route.
  (window as any).__simEngine = useSimulationStore.getState().engine;
  (window as any).__simStore = useSimulationStore;
  (window as any).__windowStore = useWindowStore;
  (window as any).__slots = slots;
  ReactDOM.createRoot(root).render(
    <React.StrictMode><App /></React.StrictMode>,
  );
}

void mountGame().catch(error => {
  // The boot selector itself must fail closed: never retry the other runtime.
  const root = document.getElementById('root');
  if (root) {
    root.setAttribute('role', 'alert');
    root.setAttribute('data-testid', 'runtime-boot-error');
    root.textContent = 'Unable to start Away Message: ' +
      (error instanceof Error ? error.message : String(error));
  }
});

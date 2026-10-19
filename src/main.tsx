import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  const workerFirst = new URLSearchParams(window.location.search).get('runtime') === 'worker';

  // #175 staged cutover: the Worker-first route NEVER imports App or the
  // synchronous Zustand defaultEngine. Avoid a second canonical world even
  // during module evaluation. Normal gameplay stays on the legacy route
  // until every direct owner consumer is migrated on Draft PR #204.
  const start = async () => {
    if (workerFirst) {
      const { WorkerGameShell } = await import('./simulation/host/WorkerGameShell');
      root.render(<WorkerGameShell />);
      return;
    }

    const [{ default: App }, { useSimulationStore }, { useWindowStore }, slots] =
      await Promise.all([
        import('./App'),
        import('./store/useSimulationStore'),
        import('./store/useWindowStore'),
        import('./persistence/slots'),
      ]);
    // Existing Playwright/technical fixtures rely on these debug handles.
    // They must NOT exist on the Worker-first path.
    (window as any).__simEngine = useSimulationStore.getState().engine;
    (window as any).__simStore = useSimulationStore;
    (window as any).__windowStore = useWindowStore;
    (window as any).__slots = slots;
    root.render(<React.StrictMode><App /></React.StrictMode>);
  };

  void start().catch(cause => {
    const message = cause instanceof Error ? cause.message : String(cause);
    root.render(<div role="alert" className="p-6 text-red-300">Game startup failed: {message}</div>);
  });
}

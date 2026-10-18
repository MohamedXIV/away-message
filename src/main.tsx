import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useSimulationStore } from './store/useSimulationStore';
import { useWindowStore } from './store/useWindowStore';
import * as slots from './persistence/slots';

// Expose simulation engine & stores for Playwright test harness & debugging
if (typeof window !== 'undefined') {
  (window as any).__simEngine = useSimulationStore.getState().engine;
  (window as any).__simStore = useSimulationStore;
  (window as any).__windowStore = useWindowStore;
  (window as any).__slots = slots;
}

// Dev/browser-only QA mount for the #167 layered starter-room spike. It is a
// presentation harness: no store or engine wiring, entered and left by URL.
// The lazy import only fetches the harness when the spike is actually shown.
// Gated to DEV builds (same pattern as the content studio in App.tsx): a
// production bundle never reads the fixture URL, so the QA-only spike place
// cannot be opened by players even though it lives in the canonical catalog.
const LivingRoomSpikeHarnessLazy = React.lazy(
  () =>
    import('./world/phaser/LivingRoomSpikeHarness').then((module) => ({
      default: module.LivingRoomSpikeHarness,
    })),
);

const isDevBuild = (): boolean => {
  try {
    return (import.meta as unknown as { env: Record<string, string | boolean | undefined> }).env.DEV === true;
  } catch {
    return false;
  }
};

const roomSpikeRequested = (): boolean => {
  if (!isDevBuild()) return false;
  try {
    return new URLSearchParams(window.location.search).get('fixture') === 'room';
  } catch {
    return false;
  }
};

function Root(): React.ReactElement {
  const [isRoomSpike, setIsRoomSpike] = React.useState(roomSpikeRequested);

  React.useEffect(() => {
    const sync = () => setIsRoomSpike(roomSpikeRequested());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (isRoomSpike) {
    return (
      <React.Suspense fallback={<div className="p-6 text-slate-300 font-mono text-sm">Loading room spike…</div>}>
        <div className="fixed inset-0 bg-black">
          <LivingRoomSpikeHarnessLazy
            onExit={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('fixture');
              window.history.replaceState({}, '', url.toString());
              setIsRoomSpike(false);
            }}
          />
        </div>
      </React.Suspense>
    );
  }

  return <App />;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}


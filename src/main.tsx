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

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}


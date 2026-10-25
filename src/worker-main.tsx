import ReactDOM from 'react-dom/client';
import { WorkerGameShell } from './simulation/host/WorkerGameShell';
import './index.css';

// Separate HTML entry, NOT a query-flag branch inside the legacy main bundle.
// No App/Zustand/defaultEngine module is loaded in this Worker-owned world.
const root = document.getElementById('root');
if (root) ReactDOM.createRoot(root).render(<WorkerGameShell />);

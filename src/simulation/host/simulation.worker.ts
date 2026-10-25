import { createSimulationWorkerRuntime } from './SimulationWorkerRuntime';
import type { SimulationWorkerReply, SimulationWorkerRequest } from './SimulationHostProtocol';

// Vite bundles this file as a separate module worker. This thread alone
// constructs the domain graph; React, Phaser and audio never import it.
const port = self as unknown as {
  postMessage: (message: SimulationWorkerReply) => void;
  onmessage: ((event: MessageEvent<SimulationWorkerRequest>) => void) | null;
};
const runtime = createSimulationWorkerRuntime(message => port.postMessage(message));
port.onmessage = event => { void runtime.receive(event.data); };

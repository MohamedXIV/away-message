import React, { useMemo, useState } from 'react';
import { getAtHomeHardwareWorkbench } from '../../engine/AtHomeHardwareWorkbench';
import type { SimulationEngine } from '../../engine/SimulationEngine';

interface HardwareWorkbenchModalProps {
  engine: SimulationEngine;
  onStateChanged: () => void;
  onClose: () => void;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'motherboard': return 'Motherboard';
    case 'cpu': return 'CPU';
    case 'ram': return 'Memory';
    case 'storage': return 'Storage';
    case 'optical': return 'Optical';
    case 'sound': return 'Sound';
    case 'network': return 'Network';
    case 'monitor': return 'Display';
    case 'chassis': return 'Case';
    default: return kind;
  }
}

export const HardwareWorkbenchModal: React.FC<HardwareWorkbenchModalProps> = ({
  engine,
  onStateChanged,
  onClose,
}) => {
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const workbench = useMemo(() => getAtHomeHardwareWorkbench(engine), [engine, revision]);

  if (!workbench.success || !workbench.data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-lg border border-amber-900 bg-[#15120d] p-5 text-sm text-stone-200 shadow-2xl">
          <div className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-amber-500">Room 104 · Desk Workbench</div>
          <p className="text-stone-300">{workbench.error ?? 'Hardware management is unavailable.'}</p>
          <button onClick={onClose} className="mt-5 border border-stone-600 bg-stone-800 px-3 py-1.5 text-xs font-bold text-stone-100 hover:bg-stone-700">Close</button>
        </div>
      </div>
    );
  }

  const internalParts = workbench.data.installed.filter((part) => part.componentKind !== 'monitor');
  const displayParts = workbench.data.installed.filter((part) => part.componentKind === 'monitor');

  const install = (instanceId: string, targetSlot: Parameters<SimulationEngine['installOwnedHardwareAtHome']>[1], name: string) => {
    const result = engine.installOwnedHardwareAtHome(instanceId, targetSlot);
    onStateChanged();
    setRevision((value) => value + 1);
    setNotice(result.success ? `${name} installed at ${targetSlot}.` : result.error ?? `Could not install ${name}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden border border-amber-800/70 bg-[#15120d] text-stone-200 shadow-2xl">
        <div className="flex items-start justify-between border-b border-amber-900/60 bg-[#211a10] px-5 py-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">Room 104 · Desk Workbench</div>
            <h2 className="mt-1 text-lg font-bold text-amber-100">Installed hardware</h2>
            <p className="mt-1 max-w-2xl text-xs text-stone-400">Silicon & Spares sells parts. This desk is where owned physical parts are installed. Compatibility and safety decisions come from the simulation engine.</p>
          </div>
          <button onClick={onClose} className="ml-4 border border-stone-700 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-800">Close</button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-2">
          <section className="border-b border-stone-800 p-5 md:border-b-0 md:border-r">
            <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-stone-400">Machine internals</h3>
            <div className="space-y-2">
              {internalParts.map((part) => (
                <div key={part.instanceId} className="flex items-center justify-between border border-stone-800 bg-black/25 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-stone-100">{part.name}</div>
                    <div className="font-mono text-[10px] text-stone-500">{part.instanceId}</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-[10px] uppercase text-stone-500">{kindLabel(part.componentKind)}</div>
                    <div className="font-mono text-[11px] text-amber-500">{part.slot}</div>
                  </div>
                </div>
              ))}
              {internalParts.length === 0 && <div className="text-xs text-stone-500">No internal parts are currently installed.</div>}
            </div>

            <h3 className="mb-3 mt-6 font-mono text-xs font-bold uppercase tracking-wider text-stone-400">Connected display</h3>
            <div className="space-y-2">
              {displayParts.map((part) => (
                <div key={part.instanceId} className="border border-cyan-900/70 bg-cyan-950/15 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-cyan-100">{part.name}</div>
                    <div className="font-mono text-[11px] text-cyan-500">{part.slot}</div>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">{part.instanceId}</div>
                </div>
              ))}
              {displayParts.length === 0 && <div className="text-xs text-stone-500">No monitor is connected.</div>}
            </div>
          </section>

          <section className="p-5">
            <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-stone-400">Owned spares in Room 104</h3>
            <p className="mb-3 text-[11px] text-stone-500">Parts remain separate physical instances until you install them here.</p>
            <div className="space-y-2">
              {workbench.data.spares.map((spare) => (
                <div key={spare.instanceId} className={`border px-3 py-3 ${spare.compatible ? 'border-emerald-900/70 bg-emerald-950/10' : 'border-red-950/80 bg-red-950/10'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-100">{spare.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-stone-500">{spare.instanceId}</div>
                      <div className="mt-1 text-[11px] text-stone-400">{kindLabel(spare.componentKind)} → <span className="font-mono text-amber-500">{spare.targetSlot}</span></div>
                    </div>
                    <button
                      disabled={!spare.compatible}
                      onClick={() => install(spare.instanceId, spare.targetSlot, spare.name)}
                      className="shrink-0 border border-emerald-800 bg-emerald-950/50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:border-stone-800 disabled:bg-stone-900 disabled:text-stone-600"
                    >
                      Install
                    </button>
                  </div>
                  {!spare.compatible && <div className="mt-2 border-t border-red-950/80 pt-2 text-[11px] leading-relaxed text-red-300">{spare.reason ?? 'This part cannot be installed.'}</div>}
                </div>
              ))}
              {workbench.data.spares.length === 0 && <div className="border border-stone-800 bg-black/20 p-3 text-xs text-stone-500">No hardware spares are stored in the room.</div>}
            </div>
          </section>
        </div>

        {notice && <div className="border-t border-amber-900/50 bg-black/30 px-5 py-2.5 font-mono text-xs text-amber-200">{notice}</div>}
      </div>
    </div>
  );
};

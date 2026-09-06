import React, { useCallback, useEffect, useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { SAVE_SLOTS, AUTOSAVE_ID, listSlots, saveSlot, deleteSlot, requestBoot, slotCompatibility, type SlotSummary } from '../../persistence/slots';
import { soundManager } from '../../audio/SoundManager';

function formatDate(updatedAt: number): string {
  try {
    return new Date(updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * In-OS save/load window (P9). Three manual slots + autosave row.
 * Saving snapshots the live engine (+ current Pulse moment); loading
 * reboots into the slot so every subsystem (windows, Pulse, desktop)
 * comes back coherent.
 */
export const SaveLoadApp: React.FC = () => {
  const engine = useSimulationStore((s) => s.engine);
  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void listSlots().then(setSlots).catch(() => setSlots([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2400);
  };

  const handleSave = async (slotId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const summary = await saveSlot(engine, slotId);
      soundManager.play('click');
      flash(`Saved ✓ ${summary.name}`);
      refresh();
    } catch {
      flash('Save failed — storage unavailable?');
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = async (slotId: string) => {
    const verdict = await slotCompatibility(slotId).catch(() => ({ status: 'refused', reason: 'Could not read slot.' }) as const);
    if (verdict.status !== 'ok') {
      flash(verdict.status === 'legacy' ? 'That save is too old to load.' : 'That save needs a newer game version.');
      return;
    }
    soundManager.play('click');
    requestBoot({ kind: 'slot', slotId });
  };

  const handleDelete = async (slotId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteSlot(slotId);
      flash('Slot deleted.');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const byId = new Map(slots.map((s) => [s.id, s]));
  const rows: Array<{ id: string; label: string; auto?: boolean }> = [
    ...SAVE_SLOTS.map((id, i) => ({ id, label: `Slot ${i + 1}` })),
    { id: AUTOSAVE_ID, label: 'Autosave', auto: true },
  ];

  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col overflow-hidden">
      <div className="px-3 py-2 bg-[#dfdfdf] border-b border-gray-400 font-bold flex items-center gap-2">
        <span>💾</span><span>Save / Load Game</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {rows.map((row) => {
          const summary = byId.get(row.id);
          return (
            <div key={row.id} className="bg-white border border-gray-400 rounded p-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">{row.label}</span>
                {summary?.hasSnapshot ? (
                  <span className="font-mono text-[10px] text-gray-600">
                    {summary.name} • {formatDate(summary.updatedAt)}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">empty</span>
                )}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {!row.auto && (
                  <button
                    disabled={busy}
                    onClick={() => void handleSave(row.id)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded text-[11px] cursor-pointer"
                  >
                    Save
                  </button>
                )}
                <button
                  disabled={busy || !summary?.hasSnapshot}
                  onClick={() => summary && handleLoad(row.id)}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-400 rounded text-[11px] font-bold cursor-pointer"
                >
                  Load
                </button>
                <button
                  disabled={busy || !summary}
                  onClick={() => void handleDelete(row.id)}
                  className="px-2.5 py-1 bg-white hover:bg-red-50 disabled:opacity-50 border border-gray-400 rounded text-[11px] text-red-700 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-gray-500 italic px-1">
          Loading reboots the PC into that timeline — engine, Pulse chats and desktop included. Autosave fires every new day.
        </p>
      </div>
      {notice && (
        <div className="px-3 py-1.5 bg-[#fff7c7] border-t border-[#c39a35] text-[11px] font-bold text-[#4d3c00]">
          {notice}
        </div>
      )}
    </div>
  );
};

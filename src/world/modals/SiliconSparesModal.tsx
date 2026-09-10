// src/world/modals/SiliconSparesModal.tsx
// Shop interface for Milo's Silicon & Spares electronics & refurbished computer surplus.

import React, { useState } from 'react';
import { HARDWARE_STORE_INVENTORY } from '../../engine/hardware/catalog';
import type { HardwareStoreItem } from '../../engine/hardware/types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';
import { X, ShoppingCart, Monitor, Cpu, HardDrive, Disc } from 'lucide-react';

export interface SiliconSparesModalProps {
  onClose: () => void;
}

export const SiliconSparesModal: React.FC<SiliconSparesModalProps> = ({ onClose }) => {
  const cash = useSimulationStore((s) => s.state.player.cash);
  const hardware = useSimulationStore((s) => s.state.hardware);
  const currentOsId = useSimulationStore((s) => s.state.os.currentOsId);
  const purchaseCounts = useSimulationStore((s) => s.state.inventory.purchaseCounts);
  const legacyRecovery = useSimulationStore((s) => s.state.inventory.legacyRecovery);
  const roomPackageCount = useSimulationStore(
    (s) => s.state.inventory.items.filter((owned) => owned.location === 'room_package').length,
  );
  const purchaseStoreItem = useSimulationStore((s) => s.purchaseStoreItem);

  const [filter, setFilter] = useState<'all' | 'bundle' | 'ram' | 'storage' | 'monitor' | 'os_disc'>('all');
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);

  const items = HARDWARE_STORE_INVENTORY.filter((item) => filter === 'all' || item.category === filter);
  const starterRecoveryAvailable =
    legacyRecovery?.starterBundlePurchaseLost === true && legacyRecovery.consumed === false;

  const handleBuy = (item: HardwareStoreItem) => {
    const result = purchaseStoreItem(item.id);
    if (!result.success) {
      soundManager.play('error');
      setPurchaseNotice(result.error ?? 'Purchase failed.');
      return;
    }

    soundManager.play('click');
    setPurchaseNotice(
      result.data?.recoveredLegacyPurchase
        ? `Milo finds the old receipt. ${item.name} has been restored to your Room 104 package inventory.`
        : `Purchased ${item.name}! Added to your Room 104 package inventory.`,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none">
      <div className="bg-[#e8e4dc] border-4 border-t-white border-l-white border-r-[#555] border-b-[#555] shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] text-black font-sans">
        {/* Titlebar */}
        <div className="bg-gradient-to-r from-[#1c384a] to-[#2e5d7a] text-white px-3 py-1.5 flex justify-between items-center font-bold text-sm shadow">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-cyan-300" />
            <span>Silicon &amp; Spares — Milo’s Computer Surplus</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 bg-[#c0c0c0] text-black border border-t-white border-l-white border-b-black border-r-black flex items-center justify-center text-xs font-bold active:border-t-black active:border-l-black"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Header & Wallet Banner */}
        <div className="bg-[#ded9cf] p-3 border-b border-[#bbb] flex justify-between items-center text-xs">
          <div>
            <span className="font-bold">Milo:</span> "Refurbished beige boxes, CRT glass, RAM sticks, and genuine OS retail jewel cases. Everything tested."
          </div>
          <div className="bg-emerald-900 text-emerald-100 font-mono font-bold px-2.5 py-1 rounded border border-emerald-700 shrink-0 ml-3">
            Cash: ${cash.toFixed(2)}
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-1 p-2 bg-[#d4cfc5] border-b border-[#bbb] text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 border ${filter === 'all' ? 'bg-[#1c384a] text-white font-bold border-black' : 'bg-[#e0dcd4] border-[#999] text-gray-800'}`}
          >
            All Items
          </button>
          <button
            type="button"
            onClick={() => setFilter('bundle')}
            className={`px-3 py-1 border ${filter === 'bundle' ? 'bg-[#1c384a] text-white font-bold border-black' : 'bg-[#e0dcd4] border-[#999] text-gray-800'}`}
          >
            Complete PC Bundles
          </button>
          <button
            type="button"
            onClick={() => setFilter('ram')}
            className={`px-3 py-1 border ${filter === 'ram' ? 'bg-[#1c384a] text-white font-bold border-black' : 'bg-[#e0dcd4] border-[#999] text-gray-800'}`}
          >
            RAM Sticks
          </button>
          <button
            type="button"
            onClick={() => setFilter('monitor')}
            className={`px-3 py-1 border ${filter === 'monitor' ? 'bg-[#1c384a] text-white font-bold border-black' : 'bg-[#e0dcd4] border-[#999] text-gray-800'}`}
          >
            CRT Monitors
          </button>
          <button
            type="button"
            onClick={() => setFilter('os_disc')}
            className={`px-3 py-1 border ${filter === 'os_disc' ? 'bg-[#1c384a] text-white font-bold border-black' : 'bg-[#e0dcd4] border-[#999] text-gray-800'}`}
          >
            OS Setup CDs
          </button>
        </div>

        {/* Purchase Notification Toast */}
        {purchaseNotice && (
          <div className="bg-yellow-100 border-b border-yellow-300 px-3 py-1.5 text-xs text-yellow-900 font-medium flex justify-between items-center">
            <span>{purchaseNotice}</span>
            <button type="button" onClick={() => setPurchaseNotice(null)} className="text-gray-500 hover:text-black">
              ×
            </button>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {items.map((item) => {
            const recoveryClaim = item.id === 'bundle_scrapyard' && starterRecoveryAvailable;
            const purchasedAlready = !item.repeatable && (purchaseCounts[item.id] ?? 0) > 0;
            const canAfford = !purchasedAlready && (recoveryClaim || cash >= item.price);

            return (
              <div
                key={item.id}
                className="bg-white p-3 border border-[#bbb] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {item.category === 'bundle' && <Monitor className="w-4 h-4 text-blue-600 shrink-0" />}
                    {item.category === 'ram' && <Cpu className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {item.category === 'storage' && <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />}
                    {item.category === 'os_disc' && <Disc className="w-4 h-4 text-purple-600 shrink-0" />}
                    <span className="font-bold text-sm text-gray-900">{item.name}</span>
                  </div>
                  <p className="text-xs text-gray-600">{item.description}</p>
                  <div className="text-[11px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded inline-block border border-gray-200">
                    {item.specsSummary}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="font-bold text-sm text-emerald-800 font-mono">
                    {recoveryClaim ? (
                      <span className="text-amber-700 text-xs font-bold">Ledger recovery</span>
                    ) : (
                      `$${item.price.toFixed(2)}`
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuy(item)}
                    disabled={!canAfford}
                    className={`px-3 py-1 text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                      canAfford
                        ? 'bg-yellow-400 hover:bg-yellow-300 text-black border-yellow-600 active:translate-y-0.5'
                        : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>{purchasedAlready ? 'Owned' : recoveryClaim ? 'Recover package' : 'Buy'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-[#ded9cf] p-2.5 border-t border-[#bbb] flex flex-wrap gap-2 justify-between items-center text-xs text-gray-600">
          <div>
            Current Machine:{' '}
            <span className="font-bold text-gray-900">
              {hardware.hasComputer
                ? `${currentOsId ?? 'No OS'} · ${hardware.ramMB}MB RAM`
                : 'None (Desk empty)'}
            </span>
          </div>
          <div className="flex gap-2">
            {(hardware.hasComputer || roomPackageCount > 0) && (
              <button
                type="button"
                onClick={() => {
                  useSimulationStore.getState().dispatchAction({ type: 'TRAVEL_TO', to: 'home', mode: 'walk' });
                  onClose();
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-black font-bold border-2 border-t-amber-300 border-l-amber-300 border-b-amber-800 border-r-amber-800 cursor-pointer shadow"
              >
                🏠 Return to Room 104
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 bg-[#c0c0c0] hover:bg-[#d0d0d0] text-black font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black cursor-pointer"
            >
              Leave Shop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';

interface ProductItem {
  id: string;
  name: string;
  category: 'RAM' | 'OS' | 'Modem' | 'Storage';
  price: number;
  description: string;
  specs: string;
  actionType: 'HARDWARE_UPGRADE_RAM' | 'HARDWARE_UPGRADE_OS' | 'HARDWARE_UPGRADE_CONNECTION';
  payloadValue: any;
}

const PRODUCTS: ProductItem[] = [
  {
    id: 'ram_512',
    name: '256MB SDRAM Expansion Module',
    category: 'RAM',
    price: 35.00,
    description: 'Bumps your total system memory to 512MB. Great for multitasking.',
    specs: 'PC133 SDRAM, CL3, 168-pin DIMM',
    actionType: 'HARDWARE_UPGRADE_RAM',
    payloadValue: 512,
  },
  {
    id: 'ram_768',
    name: '512MB High-Density RAM Module',
    category: 'RAM',
    price: 60.00,
    description: 'Upgrades your total RAM to 768MB. Meets PhotoBox Pro 2.0 system requirements!',
    specs: 'PC133 Low-Latency SDRAM, Dual-Rank',
    actionType: 'HARDWARE_UPGRADE_RAM',
    payloadValue: 768,
  },
  {
    id: 'ram_1024',
    name: '1024MB Ultra-Density Memory Kit',
    category: 'RAM',
    price: 95.00,
    description: 'Maxes out your motherboard with a massive 1GB of RAM.',
    specs: 'PC133 Copper Heat Spreader Module',
    actionType: 'HARDWARE_UPGRADE_RAM',
    payloadValue: 1024,
  },
  {
    id: 'os_orion60',
    name: 'Orion OS 6.0 Retail CD Edition',
    category: 'OS',
    price: 45.00,
    description: 'The next-generation operating system with aero-blue styling and advanced rasterization.',
    specs: 'CD-ROM, Holographic Authenticity Seal',
    actionType: 'HARDWARE_UPGRADE_OS',
    payloadValue: 'Orion_6.0',
  },
  {
    id: 'net_dsl512',
    name: 'DSL 512k Broadband Modem',
    category: 'Modem',
    price: 50.00,
    description: 'Doubles your download throughput to 64 kB/s on copper DSL lines.',
    specs: 'ADSL1, RJ-11 / RJ-45 Ethernet Bridge',
    actionType: 'HARDWARE_UPGRADE_CONNECTION',
    payloadValue: 'dsl_512k',
  },
  {
    id: 'net_dsl1m',
    name: 'DSL 1.0M Turbo Broadband Line',
    category: 'Modem',
    price: 85.00,
    description: 'Blazing 128 kB/s download speeds. Fastest connection in the Oakhaven district.',
    specs: 'ADSL2+ Turbo Bridge Modem',
    actionType: 'HARDWARE_UPGRADE_CONNECTION',
    payloadValue: 'dsl_1m',
  },
];

export const TechMartSite: React.FC<SiteRouteProps> = () => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const playerCash = useSimulationStore((s) => s.state.player?.cash ?? 150.00);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [cart, setCart] = useState<ProductItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [orderReceipt, setOrderReceipt] = useState<string | null>(null);

  const filteredProducts = selectedCategory === 'ALL'
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === selectedCategory);

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const handleAddToCart = (product: ProductItem) => {
    setCart((prev) => [...prev, product]);
    soundManager.play('im_recv');
  };

  const handleRemoveFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (playerCash < cartTotal) {
      alert(`Insufficient funds! Your balance is $${playerCash.toFixed(2)}, but order total is $${cartTotal.toFixed(2)}.`);
      return;
    }

    // Process all hardware upgrades with cost
    cart.forEach((item) => {
      if (item.actionType === 'HARDWARE_UPGRADE_RAM') {
        dispatchAction({
          type: 'HARDWARE_UPGRADE_RAM',
          ramMB: item.payloadValue,
          cost: item.price,
        });
      } else if (item.actionType === 'HARDWARE_UPGRADE_OS') {
        dispatchAction({
          type: 'HARDWARE_UPGRADE_OS',
          targetOs: item.payloadValue,
          cost: item.price,
        });
      } else if (item.actionType === 'HARDWARE_UPGRADE_CONNECTION') {
        dispatchAction({
          type: 'HARDWARE_UPGRADE_CONNECTION',
          connectionType: item.payloadValue,
          cost: item.price,
        });
      }
    });

    setOrderReceipt(`Order #TM-${Math.floor(Math.random() * 89999 + 10000)} successfully placed! Installed upgrades to your PC.`);
    setCart([]);
    soundManager.play('im_send');
  };

  return (
    <div className="w-full min-h-full bg-[#f8fafc] text-slate-800 font-sans text-xs p-4 flex flex-col items-center">
      {/* Header Banner */}
      <div className="max-w-4xl w-full bg-[#1e3a8a] text-white p-3 rounded-t flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-3xl">💻</span>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight leading-none text-yellow-400">
              TECHMART DIRECT 2006
            </h1>
            <span className="text-[10px] text-blue-200">
              PC Hardware, Memory Modules & High-Speed Modems
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-mono font-bold text-green-300">
            Cash: ${playerCash.toFixed(2)}
          </div>
          <span className="text-[10px] text-blue-200">
            Current Rig: {hardware.ramMB}MB RAM | {hardware.osVersion}
          </span>
        </div>
      </div>

      {/* Categories & Cart Status Bar */}
      <div className="max-w-4xl w-full bg-[#e2e8f0] border-x border-b border-slate-300 px-3 py-1.5 flex justify-between items-center text-xs">
        <div className="flex gap-2">
          {['ALL', 'RAM', 'OS', 'Modem'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-800 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <span className="font-bold text-blue-950 font-mono">
          🛒 Cart: {cart.length} item(s) (${cartTotal.toFixed(2)})
        </span>
      </div>

      {/* Main Grid: Products (Left) & Cart/Receipt (Right) */}
      <div className="max-w-4xl w-full grid grid-cols-3 gap-4 mt-4">
        {/* Products List */}
        <div className="col-span-2 space-y-3">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="bg-white border border-slate-300 p-3 rounded shadow-xs flex justify-between items-start hover:border-blue-400 transition-colors"
            >
              <div className="space-y-1 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-blue-950">{prod.name}</h3>
                  <span className="bg-slate-100 text-slate-600 border border-slate-300 text-[9px] px-1.5 py-0.2 rounded font-mono">
                    {prod.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{prod.description}</p>
                <span className="text-[10px] text-slate-400 font-mono block">Specs: {prod.specs}</span>
              </div>

              <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-base font-bold font-mono text-emerald-700">
                  ${prod.price.toFixed(2)}
                </span>
                <button
                  onClick={() => handleAddToCart(prod)}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs shadow-xs cursor-pointer"
                >
                  + Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Pane: Shopping Cart & Checkout */}
        <div className="col-span-1 space-y-3">
          <div className="bg-white border border-slate-300 p-3 rounded shadow-xs space-y-2">
            <h3 className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-1">
              Your Order Summary
            </h3>

            {cart.length === 0 ? (
              <div className="text-center py-6 text-slate-400 italic text-xs">
                Your cart is empty. Click "+ Add to Cart" to select components.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1">
                    <span className="truncate max-w-[130px]">{item.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold">${item.price.toFixed(2)}</span>
                      <button
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-red-500 hover:text-red-700 font-bold text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-sm font-bold">
              <span>Total:</span>
              <span className="font-mono text-emerald-700">${cartTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded shadow cursor-pointer text-xs"
            >
              ✓ Complete Purchase & Upgrade
            </button>
          </div>

          {/* Receipt Confirmation Alert */}
          {orderReceipt && (
            <div className="bg-green-50 border border-green-300 p-3 rounded text-green-900 text-xs shadow-xs space-y-1">
              <strong className="block text-sm">🎉 Purchase Confirmed!</strong>
              <p>{orderReceipt}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

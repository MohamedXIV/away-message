import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';
import { getTechMartDynamicState } from '../worldSiteHelpers';
import { getAllReleases, getReleaseById } from '../../engine/OsCatalog';

interface ProductItem {
  id: string;
  name: string;
  category: 'RAM' | 'OS' | 'Modem' | 'Storage' | 'Groceries';
  price: number;
  description: string;
  specs: string;
  actionType: 'HARDWARE_UPGRADE_RAM' | 'HARDWARE_UPGRADE_OS' | 'HARDWARE_UPGRADE_CONNECTION' | 'ORDER_PHYSICAL';
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
  // CornerMart physical line — groceries arrive by courier or self pickup (finite pantry!)
  {
    id: 'groc_noodle_cup',
    name: 'Spicy Cup Noodles',
    category: 'Groceries',
    price: 2.00,
    description: 'One foam cup. Pantry stock for lonely nights — not infinite, buy ahead.',
    specs: 'Pantry: +1 noodles',
    actionType: 'ORDER_PHYSICAL',
    payloadValue: 'noodles_cup',
  },
  {
    id: 'groc_noodle_6',
    name: 'Noodle 6-Pack',
    category: 'Groceries',
    price: 10.00,
    description: 'Six foam cups, one strip. The bulk student special.',
    specs: 'Pantry: +6 noodles',
    actionType: 'ORDER_PHYSICAL',
    payloadValue: 'noodle_6pack',
  },
  {
    id: 'groc_bag',
    name: 'Grocery Bag (rice, beans, eggs)',
    category: 'Groceries',
    price: 8.00,
    description: 'Cook real food at the hotplate. Feeds well and heals a little.',
    specs: 'Pantry: +1 groceries',
    actionType: 'ORDER_PHYSICAL',
    payloadValue: 'grocery_bag',
  },
  {
    id: 'groc_feast',
    name: 'Feast Box (party groceries)',
    category: 'Groceries',
    price: 20.00,
    description: 'Triple bags for heavy weeks or hungry friends.',
    specs: 'Pantry: +3 groceries',
    actionType: 'ORDER_PHYSICAL',
    payloadValue: 'grocery_feast',
  },
];

export const TechMartSite: React.FC<SiteRouteProps> = () => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const osState = useSimulationStore((s) => s.state.os);
  const playerCash = useSimulationStore((s) => s.state.player?.cash ?? 150.00);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const world = useSimulationStore((s) => s.state.world);
  const time = useSimulationStore((s) => s.state.time);

  const [cart, setCart] = useState<ProductItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [orderReceipt, setOrderReceipt] = useState<string | null>(null);
  // CornerMart fulfillment: fast trip vs slow free courier
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('delivery');

  // Dynamic world reactions: banners, price modifiers
  const { banners, priceModifiers, featuredProductIds } = getTechMartDynamicState(world, time.day);

  // OS catalog is core — all 4.8/5.0/6.0/6.1/7.0-beta/7.0/7.0.1 + procedural AI releases
  const osProducts: ProductItem[] = (() => {
    try {
      const engineOs = (useSimulationStore.getState().engine as any).os as { getAvailableReleases: (day:number, hw:any)=>any[] };
      const hw = useSimulationStore.getState().state.hardware;
      const available = engineOs ? engineOs.getAvailableReleases(time.day, hw as any) : (getAllReleases() as any[]).filter((r: any) => r.releaseDay <= time.day);
      // Map to ProductItem
      return available.map((r: any) => ({
        id: `os_${r.id}`,
        name: `${r.displayName}${r.kind === 'patch' || r.kind === 'hotfix' ? ' (Update)' : r.kind === 'beta' ? ' (Beta)' : ''}`,
        category: 'OS' as const,
        price: r.price ?? 0,
        description: `${r.blurb ?? ''} — ${r.changelog.slice(0, 2).join(' • ')}`,
        specs: `Build ${r.build} • ${r.installSizeGB}GB • ${r.requirements.minRamMB}MB RAM min • ${r.theme} • ${r.kind}`,
        actionType: 'HARDWARE_UPGRADE_OS' as const,
        payloadValue: r.id,
        _release: r,
        _kind: r.kind,
      }));
    } catch {
      return [];
    }
  })();

  const baseProductsWithoutOs = PRODUCTS.filter((p) => p.category !== 'OS');
  const allProducts = [...baseProductsWithoutOs, ...osProducts];

  const filteredProducts = selectedCategory === 'ALL'
    ? allProducts
    : allProducts.filter((p) => p.category === selectedCategory);

  const effectivePrice = (prod: ProductItem) => {
    const mult = priceModifiers[prod.id] ?? 1;
    return prod.price * mult;
  };
  const cartTotal = cart.reduce((sum, item) => sum + effectivePrice(item as ProductItem), 0);

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

    // CornerMart physical line: one grocery order (pickup trip vs slow courier)
    const groceryItems = cart.filter((item) => item.actionType === 'ORDER_PHYSICAL');
    let groceryNote = '';
    if (groceryItems.length > 0) {
      const res = dispatchAction({
        type: 'PLAYER_PLACE_ORDER',
        items: groceryItems.map((item) => ({ sku: String(item.payloadValue), qty: 1 })),
        fulfillment,
      }) as unknown as { success: boolean; error?: string; data?: { summary?: string } };
      groceryNote = res && (res as { success: boolean }).success
        ? ` Groceries: ${(res as { data?: { summary?: string } }).data?.summary ?? 'ordered.'}`
        : ` Groceries FAILED: ${(res as { error?: string }).error ?? 'unknown error.'}`;
    }

    setOrderReceipt(`Order #TM-${Math.floor(Math.random() * 89999 + 10000)} successfully placed! Installed upgrades to your PC.${groceryNote}`);
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
            Current Rig: {hardware.ramMB}MB RAM | {(() => { const r = getReleaseById(osState.currentOsId as any); return r ? r.displayName : (osState.currentOsId ?? 'No OS'); })()}
            {osState.installedPatchIds.length > 0 ? ` +${osState.installedPatchIds.length} patch` : ''} • {hardware.hddFreeGB.toFixed(1)}GB free
          </span>
        </div>
      </div>

      {/* Live World Banners */}
      {banners.length > 0 && (
        <div className="max-w-4xl w-full mt-2 space-y-1">
          {banners.map((b, idx) => (
            <div
              key={idx}
              className={`px-3 py-1.5 text-[11px] font-bold border flex items-center gap-2 ${
                b.tone === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                b.tone === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-900' :
                'bg-blue-50 border-blue-300 text-blue-900'
              }`}
            >
              <span>{b.tone === 'success' ? '✓' : b.tone === 'warning' ? '⚠' : '◉'}</span>
              <span>{b.text}</span>
              <span className="ml-auto text-[9px] font-mono opacity-60">via CityWire • Day {time.day}</span>
            </div>
          ))}
        </div>
      )}

      {/* Categories & Cart Status Bar */}
      <div className="max-w-4xl w-full bg-[#e2e8f0] border-x border-b border-slate-300 px-3 py-1.5 flex justify-between items-center text-xs">
        <div className="flex gap-2">
          {['ALL', 'RAM', 'OS', 'Modem', 'Groceries'].map((cat) => (
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
          {filteredProducts.map((prod) => {
            const isOs = prod.category === 'OS';
            const osCheck = (() => {
              if (!isOs) return { can: true, reason: '' };
              try {
                const engOs = (useSimulationStore.getState().engine as any).os as { canInstall: (id:string, hw:any, day:number)=>{ok:boolean; reasons:string[]} };
                const hw = useSimulationStore.getState().state.hardware;
                const res = engOs.canInstall(prod.payloadValue as string, hw as any, time.day);
                return { can: res.ok, reason: res.reasons[0] ?? '' };
              } catch { return { can: true, reason: '' }; }
            })();
            const isPatch = isOs && (String(prod.specs).includes('patch') || String(prod.specs).includes('hotfix') || prod.price === 0);
            return (
              <div
                key={prod.id}
                className={`bg-white border p-3 rounded shadow-xs flex justify-between items-start transition-colors ${isOs && !osCheck.can ? 'border-amber-300 bg-amber-50/30' : 'border-slate-300 hover:border-blue-400'}`}
              >
                <div className="space-y-1 flex-1 pr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-blue-950">{prod.name}</h3>
                    <span className="bg-slate-100 text-slate-600 border border-slate-300 text-[9px] px-1.5 py-0.2 rounded font-mono">
                      {prod.category}
                    </span>
                    {isOs && <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase border ${isPatch ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : prod.specs.includes('beta') ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-blue-50 text-blue-700 border-blue-300'}`}>{isPatch ? 'PATCH' : prod.specs.includes('beta') ? 'BETA' : 'OS'}</span>}
                    {isOs && osCheck.can && prod.price === 0 && <span className="bg-green-100 text-green-800 border border-green-300 text-[8px] px-1 py-0.5 rounded font-bold uppercase">FREE</span>}
                  </div>
                  <p className="text-xs text-slate-600">{prod.description}</p>
                  <span className="text-[10px] text-slate-400 font-mono block">Specs: {prod.specs}</span>
                  {isOs && !osCheck.can && <span className="text-[10px] text-amber-700 font-bold">⚠ {osCheck.reason}</span>}
                  {isOs && osCheck.can && <span className="text-[10px] text-emerald-700">✓ Ready to install • {prod.specs.split('•')[0]?.trim()}</span>}
                </div>

                <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                  {(() => {
                    const eff = effectivePrice(prod);
                    const isInflated = eff !== prod.price;
                    const isFeatured = featuredProductIds.includes(prod.id);
                    return (
                      <>
                        <div className="flex items-center gap-1.5">
                          {isFeatured && <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[8px] px-1 py-0.5 rounded font-bold uppercase">Featured</span>}
                          {isInflated && <span className="text-[10px] line-through text-slate-400">${prod.price.toFixed(2)}</span>}
                          <span className={`text-base font-bold font-mono ${isInflated ? 'text-amber-700' : prod.price === 0 ? 'text-emerald-700' : 'text-emerald-700'}`}>
                            {prod.price === 0 ? 'FREE' : `$${eff.toFixed(2)}`}
                          </span>
                        </div>
                        {isInflated && <span className="text-[9px] text-amber-700 font-bold">+{Math.round((eff / prod.price - 1) * 100)}% market surge</span>}
                        <button
                          disabled={isOs && !osCheck.can}
                          onClick={() => handleAddToCart({ ...prod, price: eff } as ProductItem)}
                          className={`px-3 py-1 font-bold rounded text-xs shadow-xs ${isOs && !osCheck.can ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer'}`}
                        >
                          {isOs && !osCheck.can ? 'Blocked' : '+ Add to Cart'}
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
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

            {cart.some((item) => item.actionType === 'ORDER_PHYSICAL') && (
              <div className="border border-slate-200 rounded p-2 space-y-1 bg-slate-50">
                <div className="font-bold text-[11px] text-slate-700">📦 CornerMart fulfillment:</div>
                <label className="flex items-start gap-1.5 text-[11px] cursor-pointer">
                  <input type="radio" name="fulfill" checked={fulfillment === 'delivery'} onChange={() => setFulfillment('delivery')} className="mt-0.5" />
                  <span><b>🚚 Courier</b> — free, arrives in 2–24h. Effortless.</span>
                </label>
                <label className="flex items-start gap-1.5 text-[11px] cursor-pointer">
                  <input type="radio" name="fulfill" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} className="mt-0.5" />
                  <span><b>🏃 Pickup</b> — 30-min trip, −5 energy. Pantry now.</span>
                </label>
              </div>
            )}

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

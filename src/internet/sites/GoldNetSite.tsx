import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';
import { getGoldNetPrice } from '../worldSiteHelpers';

export const GoldNetSite: React.FC<SiteRouteProps> = () => {
  const playerCash = useSimulationStore((s) => s.state.player?.cash ?? 150.00);
  const world = useSimulationStore((s) => s.state.world);
  const time = useSimulationStore((s) => s.state.time);
  const accountNumber = '8904-2199-0012';
  const [transferAmount, setTransferAmount] = useState('');
  const [statusMsg, setStatusMsg] = useState('SSL 128-Bit Encryption Verified.');
  const gold = getGoldNetPrice(world, time.day, 100);

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) return;
    if (amount > playerCash) {
      alert('Insufficient funds in checking account!');
      return;
    }

    useSimulationStore.setState((prev) => ({
      state: {
        ...prev.state,
        player: {
          ...prev.state.player,
          cash: (prev.state.player?.cash ?? 150.00) - amount,
        },
      },
    }));

    setStatusMsg(`Successfully transferred $${amount.toFixed(2)}.`);
    setTransferAmount('');
    soundManager.play('im_send');
  };

  return (
    <div className="w-full min-h-full bg-[#f8fafc] text-slate-800 font-sans text-xs p-4 flex flex-col items-center">
      {/* Top Banking Header */}
      <div className="max-w-4xl w-full bg-[#0f172a] text-white p-3 rounded-t flex justify-between items-center shadow">
        <div className="flex items-center gap-2">
          <span className="text-2xl text-amber-400">🏛️</span>
          <div>
            <h1 className="text-base font-bold font-serif text-amber-300">
              GoldNet Financial Banking
            </h1>
            <span className="text-[10px] text-slate-400">Member FDIC // 128-Bit Secure Server</span>
          </div>
        </div>

        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
          🔒 HTTPS / SSL ACTIVE
        </span>
      </div>

        {/* Live Market Tape */}
        <div className="max-w-4xl w-full mt-3 bg-amber-50 border border-amber-300 px-3 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-900">● GoldNet Spot</span>
            <span className="font-mono font-bold text-lg text-slate-900">${gold.price.toFixed(2)}</span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${gold.delta > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : gold.delta < 0 ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-gray-100 text-gray-600'}`}>
              {gold.delta > 0 ? `▲ +${gold.delta.toFixed(2)}` : gold.delta < 0 ? `▼ ${gold.delta.toFixed(2)}` : '— 0.00'} today
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Day {time.day} • {gold.historyLabel}</span>
        </div>

        {/* Main Account Details */}
      <div className="max-w-4xl w-full bg-white border border-slate-300 p-4 space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <span className="text-xs text-slate-500 block">Primary Checking Account</span>
            <strong className="text-sm font-mono text-slate-800">Acct #{accountNumber}</strong>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 block">Available Balance</span>
            <span className="text-xl font-bold font-mono text-emerald-700">
              ${playerCash.toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Transfer Funds Form */}
        <form onSubmit={handleTransfer} className="bg-slate-50 border border-slate-200 p-3 rounded space-y-2">
          <h3 className="font-bold text-xs text-slate-800">Electronic Wire Transfer:</h3>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Recipient Routing / Account"
              defaultValue="Starlite Motel Rent (Acct #4410)"
              className="flex-1 p-1.5 border border-slate-300 rounded text-xs outline-none bg-white"
            />
            <input
              type="number"
              step="1"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="$ Amount"
              className="w-24 p-1.5 border border-slate-300 rounded text-xs outline-none bg-white font-mono"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded text-xs shadow-xs cursor-pointer"
            >
              Wire Funds
            </button>
          </div>
        </form>

        {/* Status Message */}
        <div className="text-[11px] text-slate-500 font-mono text-right">
          {statusMsg}
        </div>
      </div>
    </div>
  );
};

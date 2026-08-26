import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { soundManager } from '../../audio/SoundManager';

interface AuctionListing {
  id: string;
  title: string;
  currentBid: number;
  bidsCount: number;
  timeRemaining: string;
  seller: string;
  imageGlyph: string;
}

const INITIAL_AUCTIONS: AuctionListing[] = [
  {
    id: 'bb_1',
    title: 'Vintage 35mm Rangefinder Camera (Working Shutter)',
    currentBid: 42.50,
    bidsCount: 14,
    timeRemaining: '2h 15m',
    seller: 'maya_shutter',
    imageGlyph: '📷',
  },
  {
    id: 'bb_2',
    title: 'SoundBlaster Live! 5.1 PCI Sound Card (Gold Plated)',
    currentBid: 28.00,
    bidsCount: 8,
    timeRemaining: '4h 50m',
    seller: 'tech_surplus_99',
    imageGlyph: '🔊',
  },
  {
    id: 'bb_3',
    title: 'USRobotics 56k V.92 External Serial Faxmodem',
    currentBid: 19.99,
    bidsCount: 3,
    timeRemaining: '1d 04h',
    seller: 'canal_salvage',
    imageGlyph: '📟',
  },
];

export const BidBaySite: React.FC<SiteRouteProps> = () => {
  const [auctions, setAuctions] = useState<AuctionListing[]>(INITIAL_AUCTIONS);

  const handlePlaceBid = (item: AuctionListing) => {
    setAuctions((prev) =>
      prev.map((a) =>
        a.id === item.id
          ? { ...a, currentBid: Math.round((a.currentBid + 2.50) * 100) / 100, bidsCount: a.bidsCount + 1 }
          : a
      )
    );
    soundManager.play('im_send');
    alert(`High bid placed on "${item.title}"! Current high bid is $${(item.currentBid + 2.50).toFixed(2)}.`);
  };

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-4 flex flex-col items-center">
      {/* Top Banner */}
      <div className="max-w-4xl w-full border-b-2 border-amber-500 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🏷️</span>
          <div>
            <h1 className="text-xl font-bold font-serif text-amber-700 leading-none">
              BidBay Marketplace & Auctions
            </h1>
            <span className="text-[10px] text-gray-500">Buy, Sell, and Outbid on Orion Network</span>
          </div>
        </div>
      </div>

      {/* Main Auctions Grid */}
      <div className="max-w-4xl w-full mt-4 space-y-3">
        {auctions.map((auc) => (
          <div
            key={auc.id}
            className="border border-gray-300 rounded p-3 flex justify-between items-center hover:border-amber-500 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded flex items-center justify-center text-2xl shadow-inner">
                {auc.imageGlyph}
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-blue-900">{auc.title}</h3>
                <span className="text-xs text-gray-500">Seller: {auc.seller}</span>
                <div className="text-[10px] text-red-600 font-bold">Time Left: {auc.timeRemaining}</div>
              </div>
            </div>

            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-base font-bold font-mono text-emerald-700">
                ${auc.currentBid.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-500">{auc.bidsCount} bids placed</span>
              <button
                onClick={() => handlePlaceBid(auc)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-xs shadow cursor-pointer"
              >
                Place Bid (+$2.50)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

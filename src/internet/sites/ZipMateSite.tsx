import React from 'react';
import { SiteRouteProps } from '../types';

export const ZipMateSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full border-b-2 border-amber-500 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl text-amber-600">📦</span>
          <div>
            <h1 className="text-xl font-bold font-serif text-amber-900 leading-none">
              ZipMate Archive Extractor
            </h1>
            <span className="text-[10px] text-gray-500">
              The Essential Compression Utility for Orion OS
            </span>
          </div>
        </div>

        <button
          onClick={() => doNavigate('downloadhub.local')}
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-xs shadow cursor-pointer"
        >
          ⬇ Download ZipMate 4.0
        </button>
      </div>

      <div className="max-w-4xl w-full mt-6 bg-amber-50 border border-amber-200 rounded p-6 shadow space-y-3">
        <h2 className="text-sm font-bold text-amber-900">
          High Compression Ratios & Archive Integrity
        </h2>
        <p className="text-xs text-gray-700 leading-relaxed">
          Open and extract ZIP, TAR, GZ, and RAR packages with 32-bit CRC checksum validation.
        </p>
      </div>
    </div>
  );
};

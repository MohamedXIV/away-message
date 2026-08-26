import React from 'react';
import { SiteRouteProps } from '../types';

export const Default404Page: React.FC<SiteRouteProps> = ({ url, navigate }) => {
  return (
    <div className="p-8 font-serif bg-[#fdfdfd] text-black h-full flex flex-col items-center justify-center text-center select-text">
      <div className="border-4 border-gray-400 p-8 max-w-lg bg-white shadow-md">
        <h1 className="text-3xl font-bold text-red-700 mb-2">HTTP 404 - Not Found</h1>
        <div className="h-0.5 bg-gray-300 w-full mb-4" />
        <p className="text-sm mb-4">
          The server could not find the requested URL: <code className="bg-gray-100 px-1 font-mono text-xs">{url.normalizedUrl}</code>
        </p>
        <p className="text-xs text-gray-600 mb-6">
          Please check the spelling of the web address or click the button below to return to the search directory.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('http://findit.local')}
            className="px-4 py-1.5 bg-[#ece9d8] border-2 border-gray-600 font-sans text-xs font-bold hover:bg-white active:bg-gray-300 shadow cursor-pointer"
          >
            🏠 Return to FindIt Search
          </button>
        </div>
      </div>
      <div className="text-[11px] text-gray-500 mt-6 font-mono">
        Orion Voyager HTTP Server / 4.8.0 Gateway Subsystem
      </div>
    </div>
  );
};

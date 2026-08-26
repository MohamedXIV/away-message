import React from 'react';
import { SiteRouteProps } from '../types';

export const PulseChatSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full border-b-2 border-blue-600 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl text-blue-600">💬</span>
          <div>
            <h1 className="text-xl font-bold font-serif text-blue-900 leading-none">
              Pulse Messenger Official Site
            </h1>
            <span className="text-[10px] text-gray-500">
              The Real-Time Social Network for Orion OS & PC
            </span>
          </div>
        </div>

        <button
          onClick={() => doNavigate('downloadhub.local')}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs shadow cursor-pointer"
        >
          ⬇ Download Pulse 5.2
        </button>
      </div>

      <div className="max-w-4xl w-full mt-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded p-6 shadow-xl flex justify-between items-center">
        <div className="space-y-2 max-w-lg">
          <h2 className="text-xl font-bold text-blue-200">Express Yourself with Custom Away Messages</h2>
          <p className="text-xs text-gray-300 leading-relaxed">
            Stay connected with friends, coworkers, and late-night textboards. Customize your profile font formatting, set period away message presets, and express yourself with expressive emoticons.
          </p>
        </div>
        <div className="text-5xl text-blue-300">💬</div>
      </div>
    </div>
  );
};

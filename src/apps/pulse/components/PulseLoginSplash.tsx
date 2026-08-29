import React, { useEffect, useState } from 'react';
import { soundManager } from '../../../audio/SoundManager';

export interface PulseLoginSession {
  username: string;
  status: 'online' | 'away' | 'busy';
  awayMessage: string;
  signedInAt: number;
}

interface PulseLoginSplashProps {
  onLogin: (session: PulseLoginSession) => void;
}

const connectionSteps = [
  'Finding Pulse Messenger service...',
  'Negotiating secure-ish connection...',
  'Loading buddy list...',
  'Checking away messages...',
  'Ready to connect.',
];

export const PulseLoginSplash: React.FC<PulseLoginSplashProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('wanderer06');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [step, setStep] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= connectionSteps.length - 1) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 380);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (step >= connectionSteps.length - 1) setShowForm(true);
  }, [step]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || isConnecting) return;
    setIsConnecting(true);
    soundManager.play('door_open');
    window.setTimeout(() => {
      onLogin({
        username: username.trim(),
        status: 'online',
        awayMessage: remember ? 'back online :)' : 'just signed in',
        signedInAt: Date.now(),
      });
    }, 900);
  };

  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#ffffff_0,#c7d8ed_48%,#6e8cad_100%)] p-6 font-sans text-xs text-[#132238]">
      <div className="w-full max-w-md border-2 border-[#38516e] bg-[#e8edf5] shadow-[8px_8px_0_rgba(15,35,60,0.3)]">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#203c66] to-[#6f9ac4] px-3 py-2 text-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/70 bg-[#ffd84d] text-lg text-[#23395d] shadow-inner">P</div>
            <div>
              <div className="text-sm font-bold tracking-wide">Pulse Messenger</div>
              <div className="text-[10px] opacity-80">your friends are only a click away</div>
            </div>
          </div>
          <div className="text-[10px]">v5.2</div>
        </div>

        <div className="p-4">
          <div className="mb-3 border border-[#91a5bc] bg-white p-3 shadow-inner">
            <div className="mb-2 flex items-center gap-2 font-bold text-[#264c77]">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#31a24c]" />
              <span>{connectionSteps[step]}</span>
            </div>
            <div className="h-2 overflow-hidden border border-[#7c91a9] bg-[#dfe8f2]">
              <div className="h-full bg-gradient-to-r from-[#4e78b2] to-[#79c6ef] transition-all duration-300" style={{ width: `${((step + 1) / connectionSteps.length) * 100}%` }} />
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="animate-[fadeIn_0.35s_ease-out] border border-[#a0aaba] bg-[#f7f9fc] p-3">
              <div className="mb-3 text-center">
                <div className="text-base font-bold text-[#203c66]">Welcome back!</div>
                <div className="mt-1 text-[11px] text-gray-600">Sign in to see who is online.</div>
              </div>
              <label className="mb-1 block font-bold" htmlFor="pulse-username">Screen name</label>
              <input id="pulse-username" value={username} onChange={(event) => setUsername(event.target.value)} className="mb-2 w-full border border-[#8194ac] bg-white px-2 py-1.5 shadow-inner outline-none focus:border-[#315d91]" autoComplete="username" />
              <label className="mb-1 block font-bold" htmlFor="pulse-password">Password <span className="font-normal text-gray-500">(not really checked in demo mode)</span></label>
              <input id="pulse-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mb-2 w-full border border-[#8194ac] bg-white px-2 py-1.5 shadow-inner outline-none focus:border-[#315d91]" autoComplete="current-password" />
              <label className="mb-3 flex items-center gap-2 text-[11px] text-gray-700"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember my screen name on this computer</label>
              <button disabled={isConnecting || !username.trim()} className="w-full border border-[#314766] bg-gradient-to-b from-[#7399c5] to-[#3d6194] px-3 py-2 font-bold text-white shadow-[1px_1px_0_#fff] disabled:cursor-wait disabled:opacity-60">
                {isConnecting ? 'Signing in...' : 'Sign In'}
              </button>
              <div className="mt-3 text-center text-[10px] text-gray-500">New to Pulse? Your screen name will be created for this test session.</div>
            </form>
          )}
        </div>

        <div className="flex justify-between border-t border-[#a1afbf] bg-[#d8e1ed] px-3 py-1 text-[10px] text-gray-600">
          <span>Connection: dial-up friendly</span>
          <span>© 2005 Pulse Network</span>
        </div>
      </div>
    </div>
  );
};

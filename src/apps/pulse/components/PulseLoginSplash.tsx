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

const SMILEY_WINK = '😉';

export const PulseLoginSplash: React.FC<PulseLoginSplashProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('wanderer06');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<'available' | 'invisible'>('available');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [wink, setWink] = useState(false);
  // Face state machine: asleep (grey, idle) → suspicious (wrong creds, 0.5s)
  // → happy (correct login, ~1s blend) → onLogin opens the app.
  const [face, setFace] = useState<'asleep' | 'suspicious' | 'happy'>('asleep');
  const suspiciousTimer = React.useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (suspiciousTimer.current !== null) window.clearTimeout(suspiciousTimer.current);
    };
  }, []);

  // Famous Yahoo wink every ~2.8s — only when happy (awake)
  useEffect(() => {
    if (face !== 'happy') {
      setWink(false);
      return;
    }
    const id = window.setInterval(() => {
      setWink(true);
      window.setTimeout(() => setWink(false), 260);
    }, 2800);
    return () => window.clearInterval(id);
  }, [face]);

  const flashSuspicious = () => {
    setFace('suspicious');
    soundManager.play('click');
    if (suspiciousTimer.current !== null) window.clearTimeout(suspiciousTimer.current);
    suspiciousTimer.current = window.setTimeout(() => setFace('asleep'), 500);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || isSigningIn) return;
    // Saved-password bridge: a remembered password must match when one exists
    // (empty password is always wrong — the face says so).
    try {
      const saved = window.localStorage.getItem('pulse_saved_password');
      if (!password || (saved && password !== saved)) {
        flashSuspicious();
        return;
      }
    } catch {
      if (!password) {
        flashSuspicious();
        return;
      }
    }
    setFace('happy');
    setIsSigningIn(true);
    soundManager.play('door_open');
    window.setTimeout(() => {
      try {
        if (remember && password) window.localStorage.setItem('pulse_saved_password', password);
        else window.localStorage.removeItem('pulse_saved_password');
      } catch { /* persistence is best-effort */ }
      onLogin({
        username: username.trim(),
        status: status === 'invisible' ? 'away' : 'online',
        awayMessage: remember ? 'back online :)' : 'just signed in',
        signedInAt: Date.now(),
      });
    }, 1000);
  };

  const isAsleep = face === 'asleep';
  const isSuspicious = face === 'suspicious';

  return (
    <div className="flex h-full flex-col bg-[#f0eef5] font-sans text-xs text-[#2b2b2b] overflow-hidden">
      {/* Pulse purple header */}
      <div className="bg-gradient-to-b from-[#5b2d8f] to-[#3b1a5e] px-3 py-2 text-white shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffd400] text-[#4a1a6b] font-black text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">P</div>
            <div>
              <div className="text-[11px] font-bold tracking-widest">PULSE</div>
              <div className="text-[11px] font-bold -mt-1 tracking-wide">Messenger</div>
            </div>
          </div>
          <div className="text-[10px] font-mono opacity-70">v5.2 • 2005</div>
        </div>
      </div>

      {/* Winking smiley hero — asleep (grey) by default, livens up on login */}
      <div className="flex flex-col items-center bg-gradient-to-b from-white to-[#e9e3f5] border-b border-[#c8b8e6] px-4 py-5">
        <div
          className={`relative flex h-[92px] w-[92px] items-center justify-center rounded-full border-4 border-[#4a1a6b] shadow-[0_6px_16px_rgba(75,30,110,0.35),inset_0_2px_0_rgba(255,255,255,0.9)] select-none ${
            isAsleep ? 'bg-[#9a9ab8]' : 'bg-[#ffd400]'
          }`}
          style={{
            transform: wink ? 'scale(1.04)' : isSuspicious ? 'scale(1.02) rotate(-2deg)' : 'scale(1)',
            transition: 'transform 180ms ease, background-color 350ms ease',
          }}
        >
          {isAsleep ? (
            <>
              {/* Closed drowsy eyes */}
              <div className="absolute left-[22px] top-[34px] h-3 w-4 rounded-b-full border-b-[3px] border-[#3a3a55]" />
              <div className="absolute right-[22px] top-[34px] h-3 w-4 rounded-b-full border-b-[3px] border-[#3a3a55]" />
              {/* Tiny sleepy mouth */}
              <div className="absolute bottom-[24px] left-1/2 h-2 w-5 -translate-x-1/2 rounded-full bg-[#3a3a55]/70" />
              {/* Floating Z */}
              <div className="absolute -right-1 top-0 animate-pulse text-sm font-black text-[#5b5b80]">z</div>
            </>
          ) : (
            <>
              {/* Eyes (suspicious glances sideways) */}
              <div className="absolute left-[22px] top-[28px] h-4 w-4 rounded-full bg-[#1a1033] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                <div className={`mt-[3px] h-1.5 w-1.5 rounded-full bg-white/90 ${isSuspicious ? 'ml-[8px]' : 'ml-[4px]'}`} />
              </div>
              <div className="absolute right-[22px] top-[28px] h-4 w-[7px] overflow-hidden rounded-sm bg-[#1a1033]">
                {/* Wink: right eye squinted (happy only) */}
                <div
                  className="absolute inset-0 bg-[#1a1033]"
                  style={{ transform: wink ? 'scaleY(0.18)' : 'scaleY(1)', transformOrigin: 'center', transition: 'transform 140ms ease' }}
                />
                {!wink && <div className="ml-[1px] mt-[3px] h-1.5 w-1.5 rounded-full bg-white/90" />}
                {wink && <div className="absolute left-0 right-0 top-[45%] h-[2px] bg-[#ffd400] rounded-full" />}
              </div>
              {/* Raised skeptical brow (suspicious only) */}
              {isSuspicious && (
                <div className="absolute left-[16px] top-[16px] h-[4px] w-6 -rotate-[18deg] rounded-full bg-[#1a1033]" />
              )}
              {/* Smile: full grin when happy, flat line when suspicious */}
              {isSuspicious ? (
                <div className="absolute bottom-[22px] left-1/2 h-[3px] w-9 -translate-x-1/2 rounded-full bg-[#1a1033]" />
              ) : (
                <>
                  <div className="absolute bottom-[18px] left-1/2 h-7 w-12 -translate-x-1/2 rounded-b-[999px] border-b-[5px] border-[#1a1033] border-l-[3px] border-r-[3px] bg-transparent" />
                  <div className="absolute bottom-[22px] left-1/2 h-2 w-6 -translate-x-1/2 rounded-b-full bg-[#ff6b9e]/80" />
                </>
              )}
            </>
          )}
        </div>
        <div className="mt-3 text-center">
          <div className="text-sm font-bold text-[#3b1a5e]">
            {isAsleep ? 'Zzz… ☺' : isSuspicious ? 'Hmm?! ' + '🤨' : wink ? 'See you there! ' + SMILEY_WINK : 'Hello! ' + '☺'}
          </div>
          <div className="text-[11px] text-[#5b4a7a]">your friends are only a click away</div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#6b5a8a]">
          <span className="h-2 w-2 rounded-full bg-[#2ecc71] shadow-[0_0_6px_rgba(46,204,113,0.9)] animate-pulse" />
          <span>Pulse Network • dial-up friendly</span>
        </div>
      </div>

      {/* Form — Yahoo fieldset style */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-auto bg-[#f7f5fb] p-4">
        <div className="mx-auto w-full max-w-[320px] space-y-3">
          <div>
            <label className="mb-1 block font-bold text-[#3b1a5e]" htmlFor="pulse-username">Pulse ID</label>
            <input
              id="pulse-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. wanderer06"
              className="w-full rounded border border-[#a99bd6] bg-white px-2.5 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] outline-none focus:border-[#5b2d8f] focus:ring-2 focus:ring-[#d8c8f5]"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold text-[#3b1a5e]" htmlFor="pulse-password">Password</label>
            <input
              id="pulse-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="w-full rounded border border-[#a99bd6] bg-white px-2.5 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] outline-none focus:border-[#5b2d8f] focus:ring-2 focus:ring-[#d8c8f5]"
              autoComplete="current-password"
            />
            <div className="mt-1 text-right">
              <a className="text-[11px] text-[#5b2d8f] underline decoration-dotted underline-offset-2 hover:text-[#3b1a5e]" href="#" onClick={(e) => e.preventDefault()}>Forgot your password?</a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="block flex-1 font-bold text-[#3b1a5e]">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="flex-1 rounded border border-[#a99bd6] bg-white px-2 py-1.5 text-xs">
              <option value="available">Available — I am Online</option>
              <option value="invisible">Invisible — lurk quietly</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-[#3b1a5e]">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#5b2d8f]" />
            Remember my ID & Password
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[#5b4a7a]">
            <input type="checkbox" defaultChecked className="accent-[#5b2d8f]" /> Sign in automatically
          </label>

          <button
            disabled={isSigningIn || !username.trim()}
            className="w-full rounded bg-gradient-to-b from-[#6a3fb8] to-[#4a2390] px-3 py-2.5 font-bold text-white shadow-[0_2px_0_#2a1550] hover:from-[#7550c0] hover:to-[#512aa0] disabled:cursor-wait disabled:opacity-60"
          >
            {isSigningIn ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex justify-center gap-3 text-[11px]">
            <a className="text-[#5b2d8f] underline decoration-dotted underline-offset-2" href="#" onClick={(e) => e.preventDefault()}>Get a new Pulse ID</a>
            <span className="text-[#9a8ab8]">•</span>
            <a className="text-[#5b2d8f] underline decoration-dotted underline-offset-2" href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between border-t border-[#c8b8e6] bg-[#efebf8] px-3 py-1.5 text-[10px] text-[#6b5a8a]">
        <span>© 2005 Pulse Network • dial-up friendly</span>
        <span className="font-mono">v5.2 • Orion • dial-up</span>
      </div>
    </div>
  );
};

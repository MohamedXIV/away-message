// src/world/CafeScene.tsx

import React, { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { soundManager } from '../audio/SoundManager';
import { CafeCanvasRenderer } from './CafeCanvas';
import { CAFE_DIALOGUE_BEATS } from './data/cafeDialogue';
import { MayaExpression, CafeDialogueChoice } from './types';
import { Coffee, Clock, ArrowRight, MessageSquare, Sparkles } from 'lucide-react';

export const CafeScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CafeCanvasRenderer | null>(null);

  const time = useSimulationStore((s) => s.state.time);
  const switchView = useSimulationStore((s) => s.switchView);
  const spendCash = useSimulationStore((s) => s.spendCash);
  const advanceTime = useSimulationStore((s) => s.advanceTime);
  const setWorldFlag = useSimulationStore((s) => s.setWorldFlag);
  const applySocialAction = useSimulationStore((s) => s.applySocialAction);

  // Dialogue State
  const [currentBeatId, setCurrentBeatId] = useState<string>('intro');
  const [currentExpression, setCurrentExpression] = useState<MayaExpression>('smile');
  const [displayedText, setDisplayedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(true);

  const defaultBeat = CAFE_DIALOGUE_BEATS.intro ?? {
    id: 'intro',
    speaker: 'Maya' as const,
    text: 'Hey! You made it!',
  };
  const beat = CAFE_DIALOGUE_BEATS[currentBeatId] ?? defaultBeat;

  // Initialize and mount Canvas Renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = 960;
    canvas.height = 540;

    const renderer = new CafeCanvasRenderer({
      canvas,
      expression: currentExpression,
    });
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Update expression on canvas when it changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setExpression(currentExpression);
    }
  }, [currentExpression]);

  // Typewriter Text Effect
  useEffect(() => {
    const fullText = beat.text;
    setDisplayedText('');
    setIsTyping(true);

    if (beat.expression) {
      setCurrentExpression(beat.expression);
    }

    let charIndex = 0;
    const interval = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [currentBeatId]);

  // Skip typewriter on dialogue box click
  const handleDialogueBoxClick = () => {
    if (isTyping) {
      setDisplayedText(beat.text);
      setIsTyping(false);
    }
  };

  // Handle choice selection
  const handleSelectChoice = (choice: CafeDialogueChoice) => {
    soundManager.play('click');

    if (choice.mayaReactionExpression) {
      setCurrentExpression(choice.mayaReactionExpression);
    }

    // Apply social impact
    if (choice.socialActionName) {
      applySocialAction('starlight_maya', choice.socialActionName);
    }
    if (choice.socialTag) {
      applySocialAction('starlight_maya', choice.socialTag);
    }

    setCurrentBeatId(choice.nextBeatId);
  };

  // Wrap up meeting — sandbox: just a world flag, no narrative beat
  const handleFinishMeeting = () => {
    soundManager.play('click');
    // Deduct coffee cost
    spendCash(4.00, 'Coffee at Starlight Café');
    // Advance 75 minutes
    advanceTime(75, 'Meeting Maya at Starlight Café');
    // Set world flag & social state
    setWorldFlag('maya_met_in_person', true);
    setWorldFlag('maya_cafe_scheduled', true);
    try { applySocialAction('starlight_maya', 'vulnerable_share'); } catch {}

    // Return to room
    switchView('room');
  };

  const formattedTime = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col select-none overflow-hidden font-sans">
      {/* Top Location Bar */}
      <div className="z-30 h-10 bg-amber-950/90 backdrop-blur-sm border-b border-amber-800/60 px-4 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center gap-2 font-bold">
          <Coffee className="w-4 h-4 text-amber-400" />
          <span>Starlight Café — Booth 4</span>
          <span className="text-amber-400/70 font-normal">• Meeting with Maya</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-amber-300">
          <Clock className="w-3.5 h-3.5" />
          <span>Day {time.day} • {formattedTime}</span>
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="flex-1 relative flex items-center justify-center p-2 bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full aspect-[16/9] shadow-2xl object-contain border border-amber-900/60 rounded"
        />

        {/* Floating Expression Badge */}
        <div className="absolute top-4 left-6 bg-slate-900/80 border border-amber-500/40 px-3 py-1 rounded-full text-xs text-amber-300 flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="capitalize">Maya: {currentExpression}</span>
        </div>
      </div>

      {/* Bottom Retro Dialogue Box */}
      <div className="z-30 min-h-[160px] bg-slate-900/95 border-t-2 border-amber-600/70 p-4 flex flex-col justify-between text-slate-200">
        {/* Speaker Name Tag */}
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-0.5 bg-amber-600 text-slate-950 font-bold text-xs rounded tracking-wide uppercase">
            {beat.speaker}
          </span>
          <span className="text-[11px] text-slate-400 italic">
            {beat.speaker === 'Maya' ? 'starlight_maya' : 'You'}
          </span>
        </div>

        {/* Dialogue Text Stream */}
        <div
          onClick={handleDialogueBoxClick}
          className="flex-1 cursor-pointer font-serif text-sm md:text-base leading-relaxed text-slate-100 tracking-wide px-1"
        >
          {displayedText}
          {isTyping && <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse" />}
        </div>

        {/* Choices / Actions Area */}
        <div className="mt-3 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2">
          {!isTyping && beat.choices && (
            <div className="w-full flex flex-col md:flex-row gap-2 justify-end">
              {beat.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => handleSelectChoice(choice)}
                  className="px-4 py-2 bg-slate-800 hover:bg-amber-600 hover:text-slate-950 border border-amber-500/40 hover:border-amber-400 rounded text-xs font-semibold text-left transition-all cursor-pointer shadow flex items-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-amber-400 group-hover:text-slate-950" />
                  <span>{choice.text}</span>
                </button>
              ))}
            </div>
          )}

          {!isTyping && beat.isEnd && (
            <button
              onClick={handleFinishMeeting}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow-lg text-xs transition-all cursor-pointer"
            >
              <span>Finish Coffee & Return to Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

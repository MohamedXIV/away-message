// src/world/CafeScene.tsx
// Starlight Café — optional in-person sandbox conversation with whichever local
// actor is selected. Uses the same governed relationship/memory/world inputs as Pulse.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useSimulationHud, useSimulationWorldRead } from '../store/useBoundedSimulationRead';
import { soundManager } from '../audio/SoundManager';
import { PhysicalWorldBoundary } from './phaser/PhysicalWorldBoundary';
import { createWorldSceneProjection } from './phaser/presentationAdapter';
import { GENERATED_VENUE_SERVICES } from '../engine/worldContent.generated';
import { CafeExpression } from './types';
import { Coffee, Clock, ArrowRight, Send } from 'lucide-react';
import { aiService } from '../ai/service';
import { loadAISettings } from '../ai/settings';
import {
  buildDmChatContext,
  runChatLedger,
  honorSocialAction,
  buddyPersonaLine,
  readMemorySlices,
  writeMemorySlices,
} from '../apps/pulse/utils/chatContext';
import { buildConversationSummary } from '../apps/pulse/utils/conversationMemory';
import { useReplySuggestions } from '../apps/pulse/hooks/useReplySuggestions';
import { ReplyChips } from '../apps/pulse/components/ReplyChips';
import { toneSuggestion } from '../engine/PlayerActs';

interface CafeTurn {
  id: number;
  speaker: 'buddy' | 'player';
  text: string;
}

const CAFE_OPENER =
  "Hey! You made it! It's... honestly so strange seeing you outside of that little chat box. But in a really good way. I grabbed the booth by the radiator — sit, sit.";

/** Default meeting buddy: most-familiar available local buddy (remote buddies never meet in person). */
function defaultCafeBuddyId(engine: { social: { getBuddies(): Array<{ id: string; status?: string; reach?: string }>; getRelationships(id: string): { familiarity: number } | undefined } }): string {
  const buddies = engine.social.getBuddies();
  const locals = buddies.filter((b) => (b.reach ?? 'local') === 'local' && b.status !== 'distant' && b.status !== 'gone' && b.status !== 'blocked');
  const pool = locals;
  let best = pool[0];
  let bestFam = -1;
  for (const b of pool) {
    const fam = engine.social.getRelationships(b.id)?.familiarity ?? 0;
    if (fam > bestFam) {
      bestFam = fam;
      best = b;
    }
  }
  return best?.id ?? '';
}

export function toneToExpression(tone: string | undefined, fallback: CafeExpression): CafeExpression {
  const normalized = (tone || '').toLowerCase();
  if (/happy|laugh|excit|playful|joy|grin/.test(normalized)) return 'smile';
  if (/shy|nervous|embarrass|blush/.test(normalized)) return 'shy';
  if (/surpris|shock|wow|amaze/.test(normalized)) return 'surprised';
  if (/sad|thoughtful|quiet|soft|melanchol|serious/.test(normalized)) return 'thoughtful';
  return fallback;
}

export const CafeScene: React.FC<{ buddyId?: string }> = ({ buddyId: propBuddyId }) => {
  const historyRef = useRef<HTMLDivElement>(null);
  const turnId = useRef(0);

  const engine = useSimulationStore((s) => s.engine);
  const buddyId = propBuddyId ?? defaultCafeBuddyId(engine);
  const time = useSimulationHud().time;
  const worldRead = useSimulationWorldRead();
  const totalMinutes = time.totalMinutes;
  const currentDay = time.day;
  const switchView = useSimulationStore((s) => s.switchView);
  const spendCash = useSimulationStore((s) => s.spendCash);
  const advanceTime = useSimulationStore((s) => s.advanceTime);
  const applySocialAction = useSimulationStore((s) => s.applySocialAction);

  const buddy = buddyId ? engine.social.getBuddy(buddyId) : undefined;
  const buddyName = buddy?.displayName || buddyId;

  // Dialogue State
  const [turns, setTurns] = useState<CafeTurn[]>([
    { id: 0, speaker: 'buddy', text: CAFE_OPENER },
  ]);
  const [input, setInput] = useState('');
  const [injectedSuggestion, setInjectedSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentExpression, setCurrentExpression] = useState<CafeExpression>('smile');
  const [displayedText, setDisplayedText] = useState<string>(CAFE_OPENER);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const { suggestions, loading: suggestionsLoading, refresh: refreshSuggestions } = useReplySuggestions();

  const cafeService = GENERATED_VENUE_SERVICES.find((service) => service.tags.includes('cafe'));
  if (!cafeService) throw new Error('Generated world has no authored café venue service.');
  const cafeEnvironment = worldRead.environment;
  const cafeProjection = useMemo(
    () => createWorldSceneProjection({
      placeId: cafeService.placeId,
      timeOfDay: time.timeOfDay,
      minuteOfDay: time.hour * 60 + time.minute,
      environment: cafeEnvironment,
      isInterior: true,
      actorByAnchorId: buddyId
        ? { fixture_cafe_customer_anchor: buddyId }
        : {},
    }),
    [
      cafeService.placeId,
      buddyId,
      time.timeOfDay,
      time.hour,
      time.minute,
      cafeEnvironment.atMinute,
      cafeEnvironment.weather.condition,
      cafeEnvironment.weather.precipitation,
      cafeEnvironment.weather.wind,
      cafeEnvironment.weather.visibility,
      cafeEnvironment.sourceEventIds.join('|'),
    ],
  );

  // Typewriter effect on the latest guest turn
  const latestBuddyText = [...turns].reverse().find((turn) => turn.speaker === 'buddy')?.text ?? '';
  useEffect(() => {
    const fullText = latestBuddyText;
    setDisplayedText('');
    if (!fullText) {
      setIsTyping(false);
      return;
    }
    setIsTyping(true);
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
  }, [latestBuddyText]);

  // Autoscroll history
  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight });
  }, [turns.length]);

  // Skip typewriter on dialogue box click
  const handleDialogueBoxClick = () => {
    if (isTyping) {
      setDisplayedText(latestBuddyText);
      setIsTyping(false);
    }
  };

  // Suggest player replies whenever the guest's latest line changes
  const latestBuddyId = [...turns].reverse().find((turn) => turn.speaker === 'buddy')?.id;
  useEffect(() => {
    if (!buddyId || latestBuddyId === undefined || busy) return;
    const key = `${buddyId}:cafe:${latestBuddyId}`;
    void refreshSuggestions(key, async () => {
      const slices = readMemorySlices();
      const buddyNow = engine.social.getBuddy(buddyId);
      const recent = engine.social.getMessages(buddyId).slice(-6).map((message) => ({
        sender: message.senderId === 'player' ? 'player' : 'buddy',
        text: message.text,
      }));
      const relationship = engine.social.getRelationships(buddyId);
      const memoryHint = (slices.buddyFacts[buddyId] || []).slice(-1)[0] || '';
      const result = await aiService.suggestReplies({
        buddyId,
        displayName: buddyNow?.displayName || buddyId,
        buddyPersona: buddyPersonaLine(buddyId, buddyNow),
        relationshipSummary: relationship ? JSON.stringify(relationship) : 'new friendship',
        recentMessages: recent,
        memoryHint,
      }, loadAISettings());
      return result.data.replies.map((text) => ({ text, ...toneSuggestion(text) }));
    });
  }, [latestBuddyId, busy, buddyId, engine, refreshSuggestions]);

  useEffect(() => {
    if (injectedSuggestion) setInput(injectedSuggestion);
  }, [injectedSuggestion]);

  const pushTurn = (speaker: 'buddy' | 'player', text: string) => {
    turnId.current += 1;
    const id = turnId.current;
    setTurns((previous) => [...previous.slice(-30), { id, speaker, text }]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!buddyId || !text || busy) return;
    soundManager.play('click');
    // Social battery gate first: refused lines surface as inner voice, input kept.
    const sendRes = engine.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId, text, tags: ['cafe'] });
    if (!sendRes.success) {
      pushTurn('player', `(${sendRes.error ?? '...not now.'})`);
      return;
    }
    setInput('');
    setInjectedSuggestion(null);
    pushTurn('player', text);
    setBusy(true);
    try {
      // Same shared path as Pulse DMs: engine history → ledger → context → AI → record.
      runChatLedger(engine, buddyId, text, totalMinutes);
      const slices = readMemorySlices();
      const ctx = buildDmChatContext({
        engine,
        buddyId,
        playerText: text,
        pulse: slices,
        day: currentDay,
        totalMinutes,
        sceneContext: `In-person meeting at Starlight Café, booth 4, Day ${currentDay}.`,
        personaSuffix: 'You are sitting across from the player at Starlight Café, booth 4, talking face to face over coffee (not online). Reference the cafe, the coffee, being here in person when natural.',
      });
      writeMemorySlices({
        conversationMemory: ctx.preSendPatch.conversationMemory,
        conversationSummaries: ctx.preSendPatch.conversationSummaries,
        buddyFacts: ctx.preSendPatch.buddyFacts,
      });
      const result = await aiService.generateChat({
        buddyId,
        displayName: ctx.displayName,
        handle: ctx.handle,
        persona: ctx.persona,
        relationshipSummary: ctx.relationshipSummary,
        recentMessages: ctx.recentMessages,
        playerMessage: text,
        worldKnowledge: ctx.worldKnowledge,
        currentDay: ctx.currentDay,
      }, loadAISettings());

      const texts = result.data.messages.map((message) => message.text).filter((line) => line.trim());
      honorSocialAction(engine, buddyId, (result.data as { socialAction?: unknown }).socialAction, !result.meta.fallback);

      // Record back into shared Pulse memory (post AI reply, like DM flow).
      const fresh = readMemorySlices();
      const mergedReplies = [...(fresh.recentReplies[buddyId] || []), ...texts.map((line) => line.slice(0, 500))].slice(-6);
      const summary = buildConversationSummary(
        [...ctx.recentMessages, ...texts.map((line) => ({ sender: 'buddy', text: line }))],
        fresh.conversationSummaries[buddyId] || ctx.updatedSummary
      );
      writeMemorySlices({
        recentReplies: { ...fresh.recentReplies, [buddyId]: mergedReplies },
        conversationSummaries: { ...fresh.conversationSummaries, [buddyId]: summary },
      });

      const firstTone = result.data.messages[0]?.tone;
      setCurrentExpression((previous) => toneToExpression(firstTone, previous));
      for (const line of texts.length > 0 ? texts : ['...']) pushTurn('buddy', line);
    } catch {
      pushTurn('buddy', 'sorry, lost my train of thought for a sec... what were you saying?');
    } finally {
      setBusy(false);
    }
  };

  // Wrap up this optional encounter. No campaign beat or named-character gate.
  const handleFinishMeeting = () => {
    soundManager.play('click');
    if (!buddyId) {
      switchView('room');
      return;
    }
    // Deduct coffee cost
    spendCash(4.00, 'Coffee at Starlight Café');
    // Advance 75 minutes
    advanceTime(75, `Coffee with ${buddyName} at Starlight Café`);
    try { applySocialAction(buddyId, 'vulnerable_share'); } catch {}

    // Return to room
    switchView('room');
  };

  const formattedTime = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  const priorTurns = turns.slice(0, -1);

  if (!buddyId) {
    return (
      <div className="w-full h-full bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md border border-amber-800/50 bg-slate-900 p-6 rounded shadow-xl text-center">
          <Coffee className="w-8 h-8 mx-auto mb-3 text-amber-400" />
          <h2 className="font-bold text-amber-200 mb-2">Starlight Café</h2>
          <p className="text-sm text-slate-400 mb-5">
            The café is open, but nobody you know is available to meet here right now.
          </p>
          <button
            onClick={() => switchView('room')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold"
          >
            Leave café
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col select-none overflow-hidden font-sans">
      {/* Top Location Bar */}
      <div className="z-30 h-10 bg-amber-950/90 backdrop-blur-sm border-b border-amber-800/60 px-4 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center gap-2 font-bold">
          <Coffee className="w-4 h-4 text-amber-400" />
          <span>Starlight Café — Booth 4</span>
          <span className="text-amber-400/70 font-normal">• Meeting with {buddyName}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-amber-300">
          <Clock className="w-3.5 h-3.5" />
          <span>Day {time.day} • {formattedTime}</span>
        </div>
      </div>

      {/* Canonical authored physical-world renderer; dialogue remains a React overlay. */}
      <div className="flex-1 relative bg-black overflow-hidden min-h-0">
        <PhysicalWorldBoundary
          projection={cafeProjection}
          visualMode="production"
          className="w-full h-full"
        />

        {/* Floating semantic expression badge until authored puppet assets replace the generic venue projection. */}
        <div className="absolute top-4 left-6 bg-slate-900/80 border border-amber-500/40 px-3 py-1 rounded-full text-xs text-amber-300 flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
          <span className="capitalize">{buddyName}: {currentExpression}</span>
        </div>
      </div>

      {/* Bottom Retro Dialogue Box */}
      <div className="z-30 min-h-[220px] max-h-[42%] flex flex-col bg-slate-900/95 border-t-2 border-amber-600/70 p-4 text-slate-200">
        {/* Speaker Name Tag */}
        <div className="flex items-center gap-2 mb-1">
          <span className="px-3 py-0.5 bg-amber-600 text-slate-950 font-bold text-xs rounded tracking-wide uppercase">
            {buddyName}
          </span>
          <span className="text-[11px] text-slate-400 italic">in person • booth 4</span>
        </div>

        {/* Scrollable history */}
        <div ref={historyRef} className="overflow-y-auto text-[13px] leading-relaxed space-y-1.5 pr-1 min-h-0">
          {priorTurns.slice(-8).map((turn) => (
            <div key={turn.id} className={turn.speaker === 'player' ? 'text-right' : 'text-left'}>
              <span className={`inline-block max-w-[85%] rounded px-2 py-1 ${turn.speaker === 'player' ? 'bg-amber-700/60 text-amber-50' : 'bg-slate-800 text-slate-200'}`}>
                {turn.text}
              </span>
            </div>
          ))}
        </div>

        {/* Current line with typewriter */}
        <div
          onClick={handleDialogueBoxClick}
          className="cursor-pointer font-serif text-sm md:text-base leading-relaxed text-slate-100 tracking-wide px-1 pt-1"
        >
          {displayedText}
          {isTyping && <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse" />}
        </div>

        {/* Suggested replies */}
        <ReplyChips
          suggestions={suggestions}
          loading={suggestionsLoading}
          disabled={busy}
          onPick={(text) => setInjectedSuggestion(text)}
          onRefresh={() => {
            const id = [...turns].reverse().find((turn) => turn.speaker === 'buddy')?.id;
            if (id === undefined) return;
            void refreshSuggestions(`${buddyId}:cafe:${id}:manual`, async () => {
              const slices = readMemorySlices();
              const recent = engine.social.getMessages(buddyId).slice(-6).map((message) => ({
                sender: message.senderId === 'player' ? 'player' : 'buddy',
                text: message.text,
              }));
              const relationship = engine.social.getRelationships(buddyId);
              const result = await aiService.suggestReplies({
                buddyId,
                displayName: buddy?.displayName || buddyId,
                buddyPersona: buddyPersonaLine(buddyId, buddy),
                relationshipSummary: relationship ? JSON.stringify(relationship) : 'new friendship',
                recentMessages: recent,
                memoryHint: (slices.buddyFacts[buddyId] || []).slice(-1)[0] || '',
              }, loadAISettings());
              return result.data.replies.map((text) => ({ text, ...toneSuggestion(text) }));
            });
          }}
        />

        {/* Free input + actions */}
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
            disabled={busy}
            placeholder={busy ? `${buddyName} is thinking…` : `Say something to ${buddyName}…`}
            className="flex-1 px-2.5 py-2 bg-slate-800 border border-amber-500/40 rounded text-xs outline-none text-slate-100 placeholder:text-slate-500 disabled:opacity-60"
          />
          <button
            onClick={() => void handleSend()}
            disabled={busy || !input.trim()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold rounded shadow text-xs transition-all cursor-pointer flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" /> Say
          </button>
          <button
            onClick={handleFinishMeeting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded text-xs transition-all cursor-pointer"
          >
            <span>Finish ☕</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// src/world/phaser/LivingRoomSpikeHarness.tsx
//
// Issue #167 — QA harness for the Layered Living Starter-Room Phaser spike.
// Dev/browser-only: mounted from main.tsx when ?fixture=room is present.
// All state here is LOCAL presentation state (time of day, weather, lamp,
// fixture variants, focus, wind). It never writes to the engine, persistence,
// or social systems — Phaser only emits outward semantic intents, which this
// harness records for evidence.

import React, { useEffect, useMemo, useState } from 'react';
import { PhysicalWorldHost } from './PhysicalWorldHost';
import {
  createLivingRoomSpikeProjection,
  type LivingRoomFocusTarget,
} from './layeredRoom/LivingRoomSpikePresentation';
import type { WorldFixtureCapabilityReport, WorldInteractionIntent } from './types';
import type { TimeOfDay, WeatherType } from '../types';

type BedVariant = 'a' | 'b' | 'hidden';

const TIME_PHASES: TimeOfDay[] = ['day', 'evening', 'night'];

export interface LivingRoomSpikeHarnessProps {
  onExit?: () => void;
}

interface SpikeStatus {
  placeId: string;
  viewId: string;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  lampOn: boolean;
  bedVariant: BedVariant;
  rugHidden: boolean;
  focus: LivingRoomFocusTarget;
  windIntensity: number;
  minuteOfDay: number;
  mountKey: number;
  mounted: boolean;
  canvasCount: number;
  intents: { type: string; anchorId?: string; capability?: string; targetViewId?: string }[];
  runtimeStats: Record<string, unknown> | null;
  capabilities: Partial<WorldFixtureCapabilityReport> | null;
}

function readCanvasCount(): number {
  if (typeof document === 'undefined') return 0;
  return document.querySelectorAll('canvas').length;
}

export const LivingRoomSpikeHarness: React.FC<LivingRoomSpikeHarnessProps> = ({ onExit }) => {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [weather, setWeather] = useState<WeatherType>('clear');
  const [lampOn, setLampOn] = useState(true);
  const [bedVariant, setBedVariant] = useState<BedVariant>('a');
  const [rugHidden, setRugHidden] = useState(false);
  const [focus, setFocus] = useState<LivingRoomFocusTarget>('hero');
  const [windIntensity, setWindIntensity] = useState(0.2);
  const [mounted, setMounted] = useState(true);
  const [mountKey, setMountKey] = useState(0);
  const [intents, setIntents] = useState<SpikeStatus['intents']>([]);
  const [snapshot, setSnapshot] = useState<{
    runtimeStats: Record<string, unknown> | null;
    capabilities: Partial<WorldFixtureCapabilityReport> | null;
    canvasCount: number;
  }>({ runtimeStats: null, capabilities: null, canvasCount: 0 });

  const fixtureVariants = useMemo(
    () => ({ spike_bed: bedVariant === 'hidden' ? null : bedVariant }),
    [bedVariant],
  );
  const hiddenPropIds = useMemo(
    () => (rugHidden ? ['spike_prop_rug'] : []),
    [rugHidden],
  );

  const projection = useMemo(
    () => createLivingRoomSpikeProjection({
      timeOfDay,
      weather,
      windIntensity,
      lampOn,
      fixtureVariants,
      hiddenPropIds,
      focus,
    }),
    [timeOfDay, weather, windIntensity, lampOn, fixtureVariants, hiddenPropIds, focus],
  );

  const handleIntent = (intent: WorldInteractionIntent) => {
    if (intent.type === 'HOTSPOT_HOVER') return;
    setIntents((previous) => [...previous.slice(-11), {
      type: intent.type,
      ...(intent.anchorId ? { anchorId: intent.anchorId } : {}),
      ...(intent.capability ? { capability: intent.capability } : {}),
      ...(intent.targetViewId ? { targetViewId: intent.targetViewId } : {}),
    }]);
  };

  // Poll the live scene for QA evidence. The scene is only reachable after
  // Phaser boots, so this stays gentle and read-only.
  useEffect(() => {
    if (!mounted) {
      setSnapshot({ runtimeStats: null, capabilities: null, canvasCount: readCanvasCount() });
      return;
    }
    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      const runtime = (window as unknown as {
        __awayPhysicalWorldRuntime?: {
          getScene(): {
            getLayeredRoomRuntimeStats?(): Record<string, unknown>;
            getCapabilityReport?(): Partial<WorldFixtureCapabilityReport>;
          } | null;
        };
      }).__awayPhysicalWorldRuntime;
      const scene = runtime?.getScene() ?? null;
      setSnapshot({
        runtimeStats: scene?.getLayeredRoomRuntimeStats?.() ?? null,
        capabilities: scene?.getCapabilityReport?.() ?? null,
        canvasCount: readCanvasCount(),
      });
    };
    poll();
    const interval = window.setInterval(poll, 400);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mounted, mountKey, projection]);

  const status: SpikeStatus = {
    placeId: projection.placeId,
    viewId: projection.viewId,
    timeOfDay,
    weather,
    lampOn,
    bedVariant,
    rugHidden,
    focus,
    windIntensity,
    minuteOfDay: projection.minuteOfDay ?? 0,
    mountKey,
    mounted,
    canvasCount: snapshot.canvasCount,
    intents,
    runtimeStats: snapshot.runtimeStats,
    capabilities: snapshot.capabilities,
  };

  const buttonClass = (active: boolean) =>
    `px-1.5 py-0.5 border rounded ${active ? 'bg-violet-800 border-violet-400' : 'bg-slate-900 border-slate-700'}`;

  const qaBar = (
    <div
      data-testid="spike-qa-bar"
      className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] rounded border border-violet-900/70 bg-black/70 px-2 py-1.5 text-[10px] text-slate-100 font-mono shadow-lg backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-center gap-1">
        <strong className="mr-1 text-violet-300">ROOM SPIKE QA</strong>
        <span
          data-testid="spike-status"
          data-state={JSON.stringify(status)}
          className="mr-1 whitespace-nowrap text-slate-300"
        >
          {timeOfDay}/{weather} · bed {bedVariant} · lamp {lampOn ? 'on' : 'off'} · focus {focus} ·
          {' '}canvas {snapshot.canvasCount}
        </span>
        {TIME_PHASES.map((phase) => (
          <button
            key={phase}
            data-testid={`spike-phase-${phase}`}
            onClick={() => setTimeOfDay(phase)}
            className={buttonClass(timeOfDay === phase)}
          >
            {phase}
          </button>
        ))}
        {(['clear', 'rain'] as WeatherType[]).map((next) => (
          <button
            key={next}
            data-testid={`spike-weather-${next}`}
            onClick={() => setWeather(next)}
            className={buttonClass(weather === next)}
          >
            {next}
          </button>
        ))}
        <button
          data-testid="spike-lamp-toggle"
          onClick={() => setLampOn((value) => !value)}
          className={buttonClass(lampOn)}
        >
          lamp
        </button>
        {(['a', 'b', 'hidden'] as BedVariant[]).map((variant) => (
          <button
            key={variant}
            data-testid={`spike-bed-${variant}`}
            onClick={() => setBedVariant(variant)}
            className={buttonClass(bedVariant === variant)}
          >
            bed {variant}
          </button>
        ))}
        <button
          data-testid="spike-rug-toggle"
          onClick={() => setRugHidden((value) => !value)}
          className={buttonClass(rugHidden)}
        >
          rug {rugHidden ? 'hidden' : 'shown'}
        </button>
        {(['hero', 'desk', 'window'] as LivingRoomFocusTarget[]).map((target) => (
          <button
            key={target}
            data-testid={`spike-focus-${target}`}
            onClick={() => setFocus(target)}
            className={buttonClass(focus === target)}
          >
            {target}
          </button>
        ))}
        <label className="flex items-center gap-1 px-1" htmlFor="spike-wind">
          wind
          <input
            id="spike-wind"
            data-testid="spike-wind"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={windIntensity}
            onChange={(event) => setWindIntensity(Number(event.target.value))}
            className="w-16"
          />
          {windIntensity.toFixed(2)}
        </label>
        <button
          data-testid="spike-remount"
          onClick={() => setMountKey((value) => value + 1)}
          className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded"
        >
          remount
        </button>
        <button
          data-testid="spike-unmount"
          onClick={() => setMounted(false)}
          className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded"
        >
          unmount
        </button>
        {!mounted && (
          <button
            data-testid="spike-reenter"
            onClick={() => setMounted(true)}
            className="px-1.5 py-0.5 bg-emerald-900 border border-emerald-700 rounded"
          >
            re-enter
          </button>
        )}
        {onExit && (
          <button
            data-testid="spike-exit"
            onClick={onExit}
            className="px-1.5 py-0.5 text-slate-300 border border-slate-700 rounded"
          >
            exit
          </button>
        )}
      </div>
      {!mounted && (
        <div data-testid="spike-unmounted-note" className="mt-1 text-center text-[10px] text-amber-200">
          World unmounted — canvas count must reach 0 before re-enter.
        </div>
      )}
    </div>
  );

  return (
    <div className="relative w-full h-full" data-testid="spike-root">
      {mounted && (
        <PhysicalWorldHost
          key={`spike-mount-${mountKey}`}
          projection={projection}
          visualMode="production"
          debug={false}
          exposeRuntime={true}
          onIntent={handleIntent}
        />
      )}
      <div className="pointer-events-none absolute inset-0 z-10">{qaBar}</div>
    </div>
  );
};

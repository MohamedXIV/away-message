// src/world/phaser/PhysicalWorldHost.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhaserWorldRuntime } from './PhaserWorldRuntime';
import type {
  PhysicalWorldHostProps,
  WorldInteractionIntent,
  WorldFixtureCapabilityReport,
} from './types';

export const PhysicalWorldHost: React.FC<PhysicalWorldHostProps> = ({
  projection,
  onIntent,
  overlaySlot,
  className = '',
  debug = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PhaserWorldRuntime | null>(null);
  const onIntentRef = useRef(onIntent);
  onIntentRef.current = onIntent;

  const [capabilityReport, setCapabilityReport] = useState<WorldFixtureCapabilityReport | null>(null);
  const [lastIntent, setLastIntent] = useState<WorldInteractionIntent | null>(null);

  const handleIntent = useCallback((intent: WorldInteractionIntent) => {
    setLastIntent(intent);
    onIntentRef.current?.(intent);
  }, []);

  // Initialize and destroy Phaser runtime with React lifecycle
  useEffect(() => {
    if (!containerRef.current) return;

    const runtime = new PhaserWorldRuntime({
      parent: containerRef.current,
      projection,
      onIntent: handleIntent,
    });
    runtimeRef.current = runtime;

    // ResizeObserver for HiDPI responsive canvas scaling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          runtime.resize(Math.round(width), Math.round(height));
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    // Initial capability check after brief boot
    const timer = setTimeout(() => {
      const scene = runtime.getScene();
      if (scene && typeof scene.getCapabilityReport === 'function') {
        setCapabilityReport(scene.getCapabilityReport());
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, []);

  // Synchronize projection updates to active Phaser runtime
  useEffect(() => {
    if (runtimeRef.current) {
      runtimeRef.current.updateProjection(projection);
    }
  }, [projection]);

  const handleSwitchView = (targetViewId: string) => {
    runtimeRef.current?.transitionToView(targetViewId);
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-[#0a0d14] flex flex-col ${className}`}
      data-testid="physical-world-host"
    >
      {/* Phaser Canvas Mounting Root */}
      <div
        ref={containerRef}
        className="w-full h-full relative"
        data-testid="phaser-container"
      />

      {/* Optional React Overlay Slot (Software UI, HUD, Modals) */}
      {overlaySlot && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {overlaySlot}
        </div>
      )}

      {/* Debug & Technical Fixture Control Bar */}
      {debug && (
        <div
          data-testid="world-fixture-controls"
          className="absolute top-3 right-3 z-30 flex flex-col gap-2 p-3 bg-black/80 border border-slate-700 text-xs text-slate-200 font-mono shadow-lg max-w-sm backdrop-blur"
        >
          <div className="font-bold text-amber-400 border-b border-slate-700 pb-1 flex justify-between items-center">
            <span>PHASER 4 PHYSICAL WORLD</span>
            <span className="text-[10px] text-slate-400">FIXTURE</span>
          </div>

          <div className="flex flex-col gap-1 text-[11px]">
            <div><strong>Place:</strong> {projection.placeName} ({projection.placeId})</div>
            <div><strong>Space:</strong> {projection.spaceName} ({projection.spaceId})</div>
            <div><strong>View:</strong> {projection.viewName} ({projection.viewId})</div>
            <div><strong>Time / Weather:</strong> {projection.timeOfDay} / {projection.weather}</div>
            <div>
              <strong>Last Intent:</strong>{' '}
              {lastIntent
                ? `${lastIntent.type} ${lastIntent.anchorId ?? lastIntent.targetViewId ?? ''}`
                : 'None'}
            </div>
          </div>

          {/* View Transitions */}
          {projection.availableViews.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
              <span className="text-slate-400">Switch View:</span>
              {projection.availableViews.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleSwitchView(v.id)}
                  className={`px-2 py-0.5 rounded border text-[10px] ${
                    v.id === projection.viewId
                      ? 'bg-amber-600 border-amber-500 text-white font-bold'
                      : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}

          {/* Living Environment Debug Controls */}
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800 text-[10px]">
            <div className="font-bold text-amber-300">Environment & Lighting:</div>

            {/* Five Day Phases */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-slate-400">Phase:</span>
              {[
                { name: 'Dawn', min: 390 },
                { name: 'Day', min: 720 },
                { name: 'Aft', min: 990 },
                { name: 'Dusk', min: 1170 },
                { name: 'Night', min: 60 },
              ].map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    const scene = runtimeRef.current?.getScene();
                    if (scene) {
                      runtimeRef.current?.updateProjection({
                        ...projection,
                        minuteOfDay: p.min,
                      });
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Weather & Occlusion */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-slate-400">Weather:</span>
              <button
                onClick={() => {
                  runtimeRef.current?.updateProjection({
                    ...projection,
                    weather: 'clear',
                  });
                }}
                className={`px-1.5 py-0.5 rounded border text-[10px] ${
                  projection.weather === 'clear'
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
              >
                Clear
              </button>
              <button
                onClick={() => {
                  runtimeRef.current?.updateProjection({
                    ...projection,
                    weather: 'rain',
                  });
                }}
                className={`px-1.5 py-0.5 rounded border text-[10px] ${
                  projection.weather === 'rain'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
              >
                Rain
              </button>
              <button
                onClick={() => {
                  const isCurrentlyInterior = projection.isInterior ?? true;
                  runtimeRef.current?.updateProjection({
                    ...projection,
                    isInterior: !isCurrentlyInterior,
                  });
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200"
                title="Toggle Indoor vs Outdoor occlusion"
              >
                {projection.isInterior ?? true ? '🏢 Indoor' : '🌳 Outdoor'}
              </button>
              <button
                onClick={() => {
                  const scene = runtimeRef.current?.getScene();
                  scene?.getEnvironmentManager()?.triggerLightning();
                }}
                className="px-1.5 py-0.5 rounded bg-indigo-900 hover:bg-indigo-800 border border-indigo-600 text-indigo-200 font-bold"
                title="Trigger lightning flash spike"
              >
                ⚡ Flash
              </button>
            </div>
          </div>

          {/* Capabilities Report Badge */}
          {capabilityReport && (
            <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 grid grid-cols-2 gap-1">
              <span className={capabilityReport.layeredRendering ? 'text-green-400' : 'text-red-400'}>
                ✓ Layered Sprites
              </span>
              <span className={capabilityReport.normalMapLighting ? 'text-green-400' : 'text-red-400'}>
                ✓ Normal-Map Light
              </span>
              <span className={capabilityReport.movablePointLight ? 'text-green-400' : 'text-red-400'}>
                ✓ Movable Light
              </span>
              <span className={capabilityReport.particles ? 'text-green-400' : 'text-red-400'}>
                ✓ Particles
              </span>
              <span className={capabilityReport.renderTextureFilter ? 'text-green-400' : 'text-red-400'}>
                ✓ Render-Texture
              </span>
              <span className={capabilityReport.hotspotInteraction ? 'text-green-400' : 'text-red-400'}>
                ✓ Hotspots
              </span>
              <span className={capabilityReport.dayPhaseInterpolation ? 'text-green-400' : 'text-red-400'}>
                ✓ Day Phases
              </span>
              <span className={capabilityReport.ambientMotion ? 'text-green-400' : 'text-red-400'}>
                ✓ Ambient Motion
              </span>
              <span className={capabilityReport.weatherOcclusion ? 'text-green-400' : 'text-red-400'}>
                ✓ Rain Occlusion
              </span>
              <span className={capabilityReport.puddleZones ? 'text-green-400' : 'text-red-400'}>
                ✓ Puddle Zones
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

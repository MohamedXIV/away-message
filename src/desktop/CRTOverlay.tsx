import React, { memo } from 'react';

export interface CRTOverlayProps {
  enabled?: boolean;
  scanlines?: boolean;
  curvature?: boolean;
  bloom?: boolean;
  flicker?: boolean;
  monitor?: import('../engine/hardware/types').MonitorComponent;
}

export const CRTOverlay: React.FC<CRTOverlayProps> = memo(({
  enabled = true,
  scanlines = true,
  curvature = true,
  bloom = true,
  flicker = false,
  monitor,
}) => {
  if (!enabled) return null;

  const showScanlines = monitor ? monitor.scanlineIntensity > 0 : scanlines;
  const showCurvature = monitor ? monitor.curvature > 0.1 : curvature;
  const showBloom = monitor ? monitor.bloomIntensity > 0 : bloom;
  const showFlicker = monitor ? monitor.flicker : flicker;
  const scanlineOpacity = monitor ? Math.round(monitor.scanlineIntensity * 60) : 40;
  const curvatureOpacity = monitor ? Math.max(0.15, monitor.curvature * 0.75) : 0.65;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none" aria-hidden="true">
      {/* 1. Horizontal Scanlines */}
      {showScanlines && (
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            opacity: scanlineOpacity / 100,
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 2px)',
            backgroundSize: '100% 2px',
          }}
        />
      )}

      {/* 2. Aperture Grille Micro-Mesh (Phosphor RGB Grid) */}
      <div
        className="absolute inset-0 opacity-15 mix-blend-color-burn"
        style={{
          background: 'repeating-linear-gradient(90deg, rgba(255,0,0,0.06) 0px, rgba(0,255,0,0.06) 1px, rgba(0,0,255,0.06) 2px, transparent 3px)',
          backgroundSize: '3px 100%',
        }}
      />

      {/* 3. Curved Glass Vignette & Radial Edge Darkening */}
      {showCurvature && (
        <div
          className="absolute inset-0"
          style={{
            opacity: curvatureOpacity,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 65%, rgba(0,0,0,0.25) 90%, rgba(0,0,0,0.65) 100%)',
            boxShadow: 'inset 0 0 80px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* 4. Phosphor Bloom / Subtle Warm Glow */}
      {showBloom && (
        <div
          className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(200, 240, 255, 0.08) 0%, transparent 80%)',
          }}
        />
      )}

      {/* 5. CRT Glass Bezel Border */}
      <div className="absolute inset-0 border-[3px] border-black/40 rounded-none pointer-events-none" />

      {/* 6. Optional Subtle Refresh Flicker Roll */}
      {showFlicker && (
        <div
          className="absolute inset-0 opacity-5 pointer-events-none animate-pulse"
          style={{
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
            backgroundSize: '100% 4px',
          }}
        />
      )}
    </div>
  );
});

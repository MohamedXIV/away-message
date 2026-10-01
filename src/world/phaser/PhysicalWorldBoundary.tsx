import React, { Suspense } from 'react';
import type { PhysicalWorldHostProps } from './types';

const LazyPhysicalWorldHost = React.lazy(async () => {
  const module = await import('./PhysicalWorldHost');
  return { default: module.PhysicalWorldHost };
});

/**
 * Browser-only loading boundary for the Phaser physical renderer.
 *
 * Importing game scenes must remain safe in Node tooling/tests. Phaser itself
 * touches browser globals during module initialization, so the concrete host is
 * loaded only after a browser render exists. This does not create a second
 * renderer: production browser renders still mount PhysicalWorldHost.
 */
export const PhysicalWorldBoundary: React.FC<PhysicalWorldHostProps> = (props) => {
  if (typeof window === 'undefined') {
    return (
      <div
        data-testid="physical-world-browser-boundary"
        className={props.className}
        aria-hidden="true"
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div
          data-testid="physical-world-loading"
          className={props.className}
          aria-hidden="true"
        />
      }
    >
      <LazyPhysicalWorldHost {...props} />
    </Suspense>
  );
};

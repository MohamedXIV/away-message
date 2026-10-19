import React from 'react';
import { useSimulationChrome } from '../store/useBoundedSimulationRead';
import { OsHostProvider } from './host/OsHostContext';
import { WindowFrameChrome } from './WindowFrameChrome';
import type { WindowFrameChromeProps } from './WindowFrameChrome';

/**
 * Legacy synchronous-game adapter only. Keep existing DesktopShell and
 * WindowManager unchanged until the production entrypoint cutover.
 * Worker-owned React imports WindowFrameChrome directly, not this adapter.
 */
export type WindowFrameProps = Pick<WindowFrameChromeProps, 'window' | 'isActive' | 'children'>;

export const WindowFrame: React.FC<WindowFrameProps> = ({ children, ...props }) => {
  const osVersion = useSimulationChrome().osVersion;
  return (
    <WindowFrameChrome {...props} osVersion={osVersion}>
      <OsHostProvider windowId={props.window.id}>{children}</OsHostProvider>
    </WindowFrameChrome>
  );
};

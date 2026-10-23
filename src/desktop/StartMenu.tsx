import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useSimulationChrome } from '../store/useBoundedSimulationRead';
import { useWindowStore } from '../store/useWindowStore';
import { StartMenuChrome, type StartMenuChromeProps } from './StartMenuChrome';

export type StartMenuProps = Pick<StartMenuChromeProps, 'isOpen' | 'onClose' | 'onOpenDialUp'>;

/** The synchronous game adapter; Worker imports only StartMenuChrome. */
export const StartMenu: React.FC<StartMenuProps> = props => {
  const chrome = useSimulationChrome();
  const dispatchAction = useSimulationStore(s => s.dispatchAction);
  const openWindow = useWindowStore(s => s.openWindow);
  return <StartMenuChrome {...props}
    osVersion={chrome.osVersion} pulseInstalled={chrome.pulseInstalled}
    launchApp={(appId, customState) => { openWindow(appId, customState ?? {}); }}
    rest={() => { dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 }); }} />;
};

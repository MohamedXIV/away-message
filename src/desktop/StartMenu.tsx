import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useSimulationChrome } from '../store/useBoundedSimulationRead';
import { useWindowStore } from '../store/useWindowStore';
import { StartMenuChrome, type StartMenuChromeProps } from './StartMenuChrome';

export type StartMenuProps = Pick<StartMenuChromeProps, 'isOpen' | 'onClose' | 'onOpenDialUp'>;

/** The synchronous game adapter; Worker imports only StartMenuChrome. */
export const StartMenu: React.FC<StartMenuProps> = props => {
  const chrome = useSimulationChrome();
  const setComputerPower = useSimulationStore(s => s.setComputerPower);
  const openWindow = useWindowStore(s => s.openWindow);
  return <StartMenuChrome {...props}
    osVersion={chrome.osVersion} pulseInstalled={chrome.pulseInstalled}
    launchApp={(appId, customState) => { openWindow(appId, customState ?? {}); }}
    onPowerAction={(choice) => {
      const off = setComputerPower(false);
      if (off.success && choice === 'restart') setComputerPower(true);
    }} />;
};

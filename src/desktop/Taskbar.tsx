import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useSimulationChrome } from '../store/useBoundedSimulationRead';
import { TaskbarChrome } from './TaskbarChrome';
import { StartMenu } from './StartMenu';
import { SystemTray } from './SystemTray';

interface TaskbarProps { onOpenDialUp: () => void; }

/** Legacy synchronous adapter, never imported by Worker entrypoint. */
export const Taskbar: React.FC<TaskbarProps> = ({ onOpenDialUp }) => {
  const chrome = useSimulationChrome();
  const switchView = useSimulationStore(s => s.switchView);
  return <TaskbarChrome osVersion={chrome.osVersion}
    pulseInstalled={chrome.pulseInstalled} onStepAway={() => switchView('room')}
    renderStartMenu={(close, isOpen) =>
      <StartMenu isOpen={isOpen} onClose={close} onOpenDialUp={onOpenDialUp} />}
    tray={<SystemTray onOpenDialUp={onOpenDialUp} />} />;
};

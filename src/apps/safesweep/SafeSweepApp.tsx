import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useSimulationApps } from '../../store/useBoundedSimulationRead';
import { SafeSweepView } from './SafeSweepView';

/** Legacy adapter; presentation/real cleaning contract shared with Worker. */
export const SafeSweepApp: React.FC = () => {
  const installedSoftware = useSimulationApps().installedSoftware;
  const dispatchAction = useSimulationStore(s => s.dispatchAction);
  return <SafeSweepView installedSoftware={installedSoftware}
    onUninstall={installedId => Promise.resolve(
      dispatchAction({ type: 'SOFTWARE_UNINSTALL', installedId })
    )} />;
};

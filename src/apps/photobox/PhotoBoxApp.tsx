import React from 'react';
import { useSimulationApps } from '../../store/useBoundedSimulationRead';
import { useSimulationStore } from '../../store/useSimulationStore';
import { PhotoBoxView } from './PhotoBoxView';

/** Legacy adapter remains functional on / until the production Worker cutover. */
export const PhotoBoxApp: React.FC = () => {
  const apps = useSimulationApps();
  const dispatch = useSimulationStore(s => s.dispatchAction);
  return <PhotoBoxView currentOsId={apps.os.currentOsId} ramMb={apps.hardware.ramMB}
    onExport={(scene, filters) => Promise.resolve(dispatch({
      type: 'PHOTOBOX_EXPORT_ARTWORK', scene, filters,
    }))} />;
};

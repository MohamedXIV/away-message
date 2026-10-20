import React from 'react';
import { useSimulationApps, useWeatherBuddyRead } from '../../store/useBoundedSimulationRead';
import { WeatherBuddyView } from './WeatherBuddyView';

/** Legacy main-thread adapter preserved while /worker.html reaches parity. */
export const WeatherBuddyApp: React.FC = () => {
  const { current, forecast } = useWeatherBuddyRead();
  const installedSoftware = useSimulationApps().installedSoftware;
  return <WeatherBuddyView currentCondition={current} forecast={forecast}
    installedSoftware={installedSoftware} />;
};

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const src = (p: string) => readFileSync(p, 'utf8');
const worker = src('src/simulation/host/WorkerWeatherBuddyPanel.tsx');
const view = src('src/apps/weatherbuddy/WeatherBuddyView.tsx');
const old = src('src/apps/weatherbuddy/WeatherBuddyApp.tsx');
const protocol = src('src/simulation/host/SimulationHostProtocol.ts');
describe('WeatherBuddy original UI on canonical Worker weather source', () => {
  it('retains original frog forecast, conversion and SearchMate UI without legacy hooks', () => {
    expect(old).toContain('<WeatherBuddyView');
    expect(view).toContain('WeatherBuddy 3.1');
    expect(view).toContain('5-Day Forecast:');
    expect(view).toContain('SearchMate Deal');
    expect(view).toContain('setIsCelsius');
    expect(view).toContain('currentCondition.weather.wind');
    expect(view).not.toContain('Humidity: 88%');
    expect(view).not.toContain('useBoundedSimulationRead');
    expect(view).not.toContain('useSimulationStore');
  });
  it('requires an installed program and two revision-safe finite Worker reads', () => {
    expect(worker).toContain("session.read({ kind: 'weatherBuddy' })");
    expect(worker).toContain("session.read({ kind: 'apps' })");
    expect(worker).toContain("app.appId === 'app.weatherbuddy'");
    expect(worker).toContain('nextWeather.revision !== revision');
    expect(worker).toContain('<WeatherBuddyView');
    expect(worker).not.toContain('defaultEngine');
    expect(protocol).toContain('weatherBuddy: SimulationWeatherBuddyRead');
  });
});

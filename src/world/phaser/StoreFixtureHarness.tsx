import React, { useMemo, useState } from 'react';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { requestPhysicalShopArrivalThought } from '../../engine/PhysicalShopInnerVoice';
import {
  getGeneratedPhysicalShop,
  getGeneratedShopFixtureAtAnchor,
  projectGeneratedPhysicalShopFocus,
} from '../../engine/GeneratedPhysicalShopDefinitions';
import type { TimeOfDay, WeatherType } from '../types';
import { PhysicalWorldHost } from './PhysicalWorldHost';
import { createGeneratedPhysicalShopProjection } from './GeneratedPhysicalShopPresentation';
import { createTechnicalAwayPuppetCharacterMount } from './TechnicalAwayPuppetRig';
import type { WorldInteractionIntent } from './types';

const STORE_PLACE_ID = 'place_b1';
const STORE_WORLD_SEED = 'corner-mart-browser-fixture-v1';

export interface StoreFixtureHarnessProps {
  onExit?: () => void;
}

export const StoreFixtureHarness: React.FC<StoreFixtureHarnessProps> = ({ onExit }) => {
  const [simulation] = useState(() => new SimulationEngine());
  const shop = useMemo(() => getGeneratedPhysicalShop(STORE_PLACE_ID), []);
  const [revision, setRevision] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [weather, setWeather] = useState<WeatherType>('clear');
  const [arrivalThought] = useState(() => requestPhysicalShopArrivalThought(simulation, {
    placeId: STORE_PLACE_ID,
    placeName: 'CornerMart',
    timeOfDay: 'day',
    weather: 'clear',
  }));
  const [focusFixtureId, setFocusFixtureId] = useState<string | null>(null);
  const [message, setMessage] = useState('Entered CornerMart.');

  const projection = useMemo(
    () => createGeneratedPhysicalShopProjection(STORE_PLACE_ID, {
      timeOfDay,
      weather,
      focusFixtureId,
    }),
    [timeOfDay, weather, focusFixtureId],
  );

  const characters = useMemo(() => {
    const cashier = createTechnicalAwayPuppetCharacterMount(
      'fixture_shop_staff_anchor',
      'actor-corner-mart-cashier',
    );
    return [{ ...cashier, scale: 0.82 }];
  }, []);

  const shopState = useMemo(
    () => simulation.getPhysicalShopState(shop.storeId, STORE_WORLD_SEED, shop.fixtures),
    [simulation, shop, revision],
  );
  const cashierCapabilities = useMemo(
    () => simulation.getPhysicalShopCashierCapabilities(shop.storeId, STORE_WORLD_SEED, shop.fixtures),
    [simulation, shop, revision],
  );

  const focusedStock = useMemo(() => {
    if (!focusFixtureId) return [];
    return projectGeneratedPhysicalShopFocus(STORE_PLACE_ID, focusFixtureId, shopState).slots;
  }, [focusFixtureId, shopState]);

  const ownership = Object.values(shopState.ownershipByItemId);
  const status = {
    placeId: projection.placeId,
    viewId: projection.viewId,
    availableViews: projection.availableViews.length,
    timeOfDay,
    weather,
    focusFixtureId,
    sceneProps: projection.sceneProps?.map((prop) => prop.id) ?? [],
    stockCount: ownership.filter((entry) => entry === 'store').length,
    unpaidCount: ownership.filter((entry) => entry === 'unpaid').length,
    ownedCount: ownership.filter((entry) => entry === 'owned').length,
    cashier: cashierCapabilities,
    cash: simulation.getState().player.cash,
    focusedStock,
    actorCount: characters.length,
    innerVoiceTopic: arrivalThought?.topic ?? null,
  };

  const bump = () => setRevision((value) => value + 1);

  const takeFirstFocusedItem = () => {
    const fixture = shop.fixtures.find((candidate) => candidate.id === focusFixtureId)
      ?? shop.fixtures.find((candidate) => candidate.id === 'corner_mart_shelf_left')
      ?? shop.fixtures.find((candidate) => candidate.slots.length > 0);
    if (!fixture) {
      setMessage('No stock fixture is available.');
      return;
    }
    const current = simulation.getPhysicalShopState(shop.storeId, STORE_WORLD_SEED, shop.fixtures);
    const slot = fixture.slots.find((candidate) => Boolean(current.stockBySlot[candidate.id]));
    if (!slot) {
      setMessage(fixture.id + ' has no available stock.');
      return;
    }
    const itemId = current.stockBySlot[slot.id]!;
    simulation.takePhysicalShopItem(shop.storeId, STORE_WORLD_SEED, shop.fixtures, itemId);
    setMessage('Carrying unpaid item ' + itemId + '.');
    bump();
  };

  const returnFirstUnpaidItem = () => {
    const current = simulation.getPhysicalShopState(shop.storeId, STORE_WORLD_SEED, shop.fixtures);
    const itemId = Object.entries(current.ownershipByItemId)
      .find(([, state]) => state === 'unpaid')?.[0];
    if (!itemId) {
      setMessage('No unpaid item to return.');
      return;
    }
    simulation.returnPhysicalShopItem(shop.storeId, STORE_WORLD_SEED, shop.fixtures, itemId);
    setMessage('Returned ' + itemId + ' to its authored slot.');
    bump();
  };

  const useCashier = () => {
    const capabilities = simulation.getPhysicalShopCashierCapabilities(
      shop.storeId,
      STORE_WORLD_SEED,
      shop.fixtures,
    );
    if (!capabilities.checkout) {
      setMessage('Cashier is available to talk; basket is empty.');
      return;
    }
    const result = simulation.checkoutPhysicalShop(
      shop.storeId,
      STORE_WORLD_SEED,
      shop.fixtures,
      shop.pricesByDefinitionId,
    );
    setMessage(
      result.success
        ? `Checkout complete: $${result.total?.toFixed(2) ?? '0.00'}.`
        : result.error ?? 'Checkout failed.',
    );
    bump();
  };

  const handleIntent = (intent: WorldInteractionIntent) => {
    if (intent.type !== 'INTERACTION') return;
    if (intent.capability === 'focus_fixture' && intent.anchorId) {
      const fixtureId = getGeneratedShopFixtureAtAnchor(intent.anchorId);
      if (fixtureId) {
        setFocusFixtureId(fixtureId);
        setMessage('Focused ' + fixtureId + '.');
      }
      return;
    }
    if (intent.capability === 'cashier') {
      useCashier();
      return;
    }
    if (intent.capability === 'leave_store') {
      setMessage('Exit intent emitted; store state remains persisted.');
      return;
    }
    if (intent.capability === 'inspect') {
      setMessage('Inspected ' + (intent.name ?? intent.anchorId ?? 'store detail') + '.');
    }
  };

  const phases: TimeOfDay[] = ['morning', 'day', 'evening', 'night', 'late_night'];

  return (
    <PhysicalWorldHost
      projection={projection}
      characters={characters}
      visualMode="production"
      debug={true}
      onIntent={handleIntent}
      overlaySlot={
        <div className="pointer-events-auto absolute top-3 left-3 w-[360px] max-w-[42vw] bg-black/85 border border-emerald-800 p-3 text-[11px] text-slate-100 font-mono shadow-xl">
          <div className="flex items-center justify-between border-b border-emerald-900 pb-2 mb-2">
            <strong className="text-emerald-300">CORNERMART #28 QA</strong>
            {onExit && (
              <button data-testid="corner-mart-exit" onClick={onExit} className="text-slate-300 hover:text-white">
                Exit
              </button>
            )}
          </div>
          <div
            data-testid="corner-mart-status"
            data-state={JSON.stringify(status)}
            className="text-slate-300 mb-2"
          >
            {timeOfDay} / {weather} · {focusFixtureId ?? 'hero'} · stock {status.stockCount} ·
            {' '}unpaid {status.unpaidCount} · owned {status.ownedCount}
          </div>
          <div data-testid="corner-mart-message" className="text-amber-200 mb-2 min-h-4">{message}</div>

          <div className="flex flex-wrap gap-1 mb-2">
            {phases.map((phase) => (
              <button
                key={phase}
                data-testid={'corner-mart-phase-' + phase}
                onClick={() => setTimeOfDay(phase)}
                className={`px-1.5 py-1 border ${timeOfDay === phase ? 'bg-emerald-800 border-emerald-500' : 'bg-slate-900 border-slate-700'}`}
              >
                {phase}
              </button>
            ))}
          </div>

          <div className="flex gap-1 mb-2">
            {(['clear', 'rain'] as WeatherType[]).map((nextWeather) => (
              <button
                key={nextWeather}
                data-testid={'corner-mart-weather-' + nextWeather}
                onClick={() => setWeather(nextWeather)}
                className={`px-2 py-1 border ${weather === nextWeather ? 'bg-blue-800 border-blue-500' : 'bg-slate-900 border-slate-700'}`}
              >
                {nextWeather}
              </button>
            ))}
            <button
              data-testid="corner-mart-focus-hero"
              onClick={() => setFocusFixtureId(null)}
              className="px-2 py-1 bg-slate-900 border border-slate-700"
            >
              hero
            </button>
            <button
              data-testid="corner-mart-focus-fridge"
              onClick={() => setFocusFixtureId('corner_mart_fridge')}
              className="px-2 py-1 bg-slate-900 border border-slate-700"
            >
              fridge
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              data-testid="corner-mart-take-item"
              onClick={takeFirstFocusedItem}
              className="px-2 py-1 bg-amber-900 border border-amber-700"
            >
              Take item
            </button>
            <button
              data-testid="corner-mart-return-item"
              onClick={returnFirstUnpaidItem}
              className="px-2 py-1 bg-slate-800 border border-slate-600"
            >
              Return unpaid
            </button>
            <button
              data-testid="corner-mart-cashier"
              onClick={useCashier}
              className="px-2 py-1 bg-emerald-900 border border-emerald-700"
            >
              Cashier
            </button>
          </div>
        </div>
      }
    />
  );
};

import React, { useMemo, useState } from 'react';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { requestPhysicalShopArrivalThought } from '../../engine/PhysicalShopInnerVoice';
import {
  getGeneratedPhysicalShop,
  getGeneratedShopFixtureAtAnchor,
  projectGeneratedPhysicalShopFocus,
} from '../../engine/GeneratedPhysicalShopDefinitions';
import {
  ensureVenueRoleCharacter,
  resolveInPersonVenueCharacterContext,
  type EnsureVenueRoleCharacterOptions,
  type InPersonVenueCharacterContext,
} from '../../engine/venue/VenueCharacterBridge';
import { sendInPersonChatTurn } from '../InPersonChat';
import type { TimeOfDay, WeatherType } from '../types';
import { projectEnvironmentPresentation } from './environment/environmentProjection';
import { PhysicalWorldHost } from './PhysicalWorldHost';
import { createGeneratedPhysicalShopProjection } from './GeneratedPhysicalShopPresentation';
import {
  createTechnicalAwayPuppetCharacterMount,
  createTechnicalAwayPuppetVisualState,
} from './TechnicalAwayPuppetRig';
import type { WorldInteractionIntent } from './types';

const STORE_PLACE_ID = 'place_b1';
const STORE_WORLD_SEED = 'corner-mart-browser-fixture-v1';
const CASHIER_ACTOR_ID = 'corner_mart_cashier';

const CASHIER_SETUP: EnsureVenueRoleCharacterOptions = {
  character: {
    id: CASHIER_ACTOR_ID,
    displayName: 'Casey',
    handle: 'casey_counter',
    archetype: 'regular',
    reach: 'local',
    roles: ['cashier', 'shop-staff'],
    appearance: { hair: 'brown', eyes: 'hazel' },
    languages: [{ lang: 'en', level: 5 }],
    status: 'acquaintance',
    metVia: 'intro',
    createdDay: 1,
  },
  placeId: STORE_PLACE_ID,
  assignment: {
    id: 'corner_mart_cashier_assignment',
    roleId: 'fixture_cashier_role',
    sourceKind: 'authored_fixture',
    sourceId: 'corner_mart',
    status: 'active',
    stationId: 'fixture_shop_staff_station',
  },
};

export interface StoreFixtureHarnessProps {
  onExit?: () => void;
}

function resolveCashierContext(
  simulation: SimulationEngine,
  viewName: string,
  weather: WeatherType,
): InPersonVenueCharacterContext | null {
  return resolveInPersonVenueCharacterContext(simulation, CASHIER_ACTOR_ID, {
    playerPlaceId: STORE_PLACE_ID,
    placeName: 'CornerMart',
    viewName,
    visibleContext: [
      'front counter',
      'grocery shelves',
      'drink fridge',
      weather === 'rain' ? 'rain at the front window' : 'front window',
    ],
  });
}

export const StoreFixtureHarness: React.FC<StoreFixtureHarnessProps> = ({ onExit }) => {
  const [simulation] = useState(() => {
    const engine = new SimulationEngine();
    ensureVenueRoleCharacter(engine, CASHIER_SETUP);
    // First arrival is an explicit simulation command. Subsequent React
    // renders only project stock and cashier capabilities without mutation.
    const firstShop = getGeneratedPhysicalShop(STORE_PLACE_ID);
    engine.initializePhysicalShop(firstShop.storeId, STORE_WORLD_SEED, firstShop.fixtures);
    return engine;
  });
  const shop = useMemo(() => getGeneratedPhysicalShop(STORE_PLACE_ID), []);
  const [revision, setRevision] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [weatherOverride, setWeatherOverride] = useState<WeatherType | null>(null);
  const canonicalEnvironment = simulation.gameContext.environment.current();
  const canonicalWeather = projectEnvironmentPresentation(canonicalEnvironment).weather;
  const weather = weatherOverride ?? canonicalWeather;
  const [arrivalThought] = useState(() => requestPhysicalShopArrivalThought(simulation, {
    placeId: STORE_PLACE_ID,
    placeName: 'CornerMart',
    timeOfDay: 'day',
    weather: 'clear',
  }));
  const [focusFixtureId, setFocusFixtureId] = useState<string | null>(null);
  const [message, setMessage] = useState('Entered CornerMart.');
  const [activeSocialTarget, setActiveSocialTarget] =
    useState<InPersonVenueCharacterContext | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const projection = useMemo(
    () => createGeneratedPhysicalShopProjection(STORE_PLACE_ID, {
      timeOfDay,
      ...(weatherOverride
        ? { weather: weatherOverride }
        : { environment: canonicalEnvironment }),
      focusFixtureId,
      actorByAnchorId: {
        fixture_shop_staff_anchor: CASHIER_ACTOR_ID,
      },
    }),
    [timeOfDay, weatherOverride, canonicalEnvironment, focusFixtureId],
  );

  const characters = useMemo(() => {
    const baseVisual = createTechnicalAwayPuppetVisualState(CASHIER_ACTOR_ID);
    const cashier = createTechnicalAwayPuppetCharacterMount(
      'fixture_shop_staff_anchor',
      CASHIER_ACTOR_ID,
      {
        ...baseVisual,
        tints: {
          ...baseVisual.tints,
          clothing: '#c78b48',
          outerwear: '#315d4d',
          hair: '#3d2a22',
        },
      },
    );
    return [{ ...cashier, scale: 1.08, depth: 32 }];
  }, []);

  const shopState = useMemo(
    () => simulation.getPhysicalShopState(shop.storeId, STORE_WORLD_SEED, shop.fixtures),
    [simulation, shop, revision],
  );
  const cashierCapabilities = useMemo(
    () => simulation.getPhysicalShopCashierCapabilities(shop.storeId, STORE_WORLD_SEED, shop.fixtures),
    [simulation, shop, revision],
  );
  const cashierContext = useMemo(
    () => resolveCashierContext(simulation, projection.viewName, weather),
    [simulation, projection.viewName, weather, revision],
  );
  const cashierHistory = useMemo(
    () => simulation.social.getMessages(CASHIER_ACTOR_ID)
      .slice(-8)
      .map((entry) => ({
        senderId: entry.senderId,
        recipientId: entry.recipientId,
        text: entry.text,
        tags: [...(entry.tags ?? [])],
      })),
    [simulation, revision],
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
    weatherWindowZones: projection.weatherWindowZones ?? [],
    cashierAnchorActorId:
      projection.anchors.find((anchor) => anchor.id === 'fixture_shop_staff_anchor')?.actorId ?? null,
    venueCashierAssignment:
      simulation.getVenueRuntimeState().roleAssignments['corner_mart_cashier_assignment'] ?? null,
    stockCount: ownership.filter((entry) => entry === 'store').length,
    unpaidCount: ownership.filter((entry) => entry === 'unpaid').length,
    ownedCount: ownership.filter((entry) => entry === 'owned').length,
    cashier: cashierCapabilities,
    cashierIdentity: cashierContext
      ? {
          actorId: cashierContext.actorId,
          displayName: cashierContext.displayName,
          handle: cashierContext.handle,
        }
      : null,
    cashierPresence: cashierContext?.presence ?? null,
    activeSocialTarget: activeSocialTarget
      ? {
          actorId: activeSocialTarget.actorId,
          sceneContext: activeSocialTarget.sceneContext,
          personaSuffix: activeSocialTarget.personaSuffix,
        }
      : null,
    chatBusy,
    chatHistory: cashierHistory,
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

  const openCashier = (actorId: string) => {
    const context = resolveInPersonVenueCharacterContext(simulation, actorId, {
      playerPlaceId: STORE_PLACE_ID,
      placeName: projection.placeName,
      viewName: projection.viewName,
      visibleContext: [
        'front counter',
        'grocery shelves',
        'drink fridge',
        weather === 'rain' ? 'rain at the front window' : 'front window',
      ],
    });
    if (!context) {
      setActiveSocialTarget(null);
      setMessage('The cashier is not physically available here.');
      return;
    }

    setActiveSocialTarget(context);
    setMessage(`Talking to ${context.displayName} in person.`);
  };

  const sendCashierMessage = async () => {
    const context = activeSocialTarget;
    const text = chatDraft.trim();
    if (!context || !text || chatBusy) return;

    setChatBusy(true);
    try {
      const result = await sendInPersonChatTurn({
        engine: simulation,
        actorId: context.actorId,
        playerText: text,
        totalMinutes: simulation.clock.getTotalMinutes(),
        day: simulation.clock.getTime().day,
        sceneContext: context.sceneContext,
        personaSuffix: context.personaSuffix,
        tags: ['corner-mart'],
      });

      if (result.ok) {
        setChatDraft('');
        setMessage(`${context.displayName}: ${result.replies.at(-1) ?? '...'}`);
      } else {
        setMessage(result.error ?? 'Could not continue the conversation.');
      }
      bump();
    } finally {
      setChatBusy(false);
    }
  };

  const checkoutAtCashier = () => {
    const context = activeSocialTarget
      ? resolveInPersonVenueCharacterContext(simulation, activeSocialTarget.actorId, {
          playerPlaceId: STORE_PLACE_ID,
          placeName: projection.placeName,
          viewName: projection.viewName,
          visibleContext: [
            'front counter',
            'grocery shelves',
            'drink fridge',
            weather === 'rain' ? 'rain at the front window' : 'front window',
          ],
        })
      : null;
    if (!context) {
      setMessage('Open the in-person cashier interaction first.');
      return;
    }

    const capabilities = simulation.getPhysicalShopCashierCapabilities(
      shop.storeId,
      STORE_WORLD_SEED,
      shop.fixtures,
    );
    if (!capabilities.checkout) {
      setMessage('No unpaid items to check out.');
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
        ? `${context.displayName} checked you out: $${result.total?.toFixed(2) ?? '0.00'}.`
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
      if (!intent.actorId) {
        setMessage('Cashier hotspot is missing actor identity.');
        return;
      }
      openCashier(intent.actorId);
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
      debug={false}
      exposeRuntime={true}
      onIntent={handleIntent}
      overlaySlot={
        <>
          {activeSocialTarget && (
            <div
              data-testid="corner-mart-physical-chat"
              className="pointer-events-auto absolute right-3 bottom-16 w-[310px] rounded border border-emerald-800/80 bg-[#111916]/95 p-3 text-[11px] text-slate-100 shadow-xl backdrop-blur-sm"
            >
              <div className="mb-2 flex items-center justify-between border-b border-emerald-900 pb-1.5">
                <div>
                  <strong className="text-emerald-300">{activeSocialTarget.displayName}</strong>
                  <span className="ml-2 text-[10px] text-slate-400">in person · cashier</span>
                </div>
                <button
                  data-testid="corner-mart-chat-close"
                  onClick={() => setActiveSocialTarget(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ×
                </button>
              </div>

              <div
                data-testid="corner-mart-chat-history"
                className="mb-2 max-h-32 space-y-1 overflow-y-auto rounded bg-black/30 p-2"
              >
                {cashierHistory.length === 0 ? (
                  <div className="text-slate-500">Say something to {activeSocialTarget.displayName}.</div>
                ) : (
                  cashierHistory.map((entry, index) => (
                    <div
                      key={`${entry.senderId}-${index}-${entry.text}`}
                      className={entry.senderId === 'player' ? 'text-right text-amber-200' : 'text-left text-emerald-200'}
                    >
                      <span className="text-[9px] uppercase text-slate-500">
                        {entry.senderId === 'player' ? 'you' : activeSocialTarget.displayName}
                      </span>
                      <div>{entry.text}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-1">
                <input
                  data-testid="corner-mart-chat-input"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void sendCashierMessage();
                  }}
                  disabled={chatBusy}
                  placeholder={chatBusy ? `${activeSocialTarget.displayName} is replying…` : 'Talk face to face…'}
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] outline-none focus:border-emerald-600 disabled:opacity-60"
                />
                <button
                  data-testid="corner-mart-chat-send"
                  onClick={() => void sendCashierMessage()}
                  disabled={chatBusy || !chatDraft.trim()}
                  className="rounded border border-emerald-700 bg-emerald-900 px-2 py-1.5 disabled:opacity-40"
                >
                  Send
                </button>
              </div>

              <button
                data-testid="corner-mart-checkout"
                onClick={checkoutAtCashier}
                disabled={!cashierCapabilities.checkout}
                className="mt-2 w-full rounded border border-amber-700 bg-amber-950 px-2 py-1.5 text-amber-100 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
              >
                {cashierCapabilities.checkout ? 'Checkout unpaid items' : 'Basket empty'}
              </button>
            </div>
          )}

          <div
            data-testid="corner-mart-qa-bar"
            className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] rounded border border-emerald-900/70 bg-black/70 px-2 py-1.5 text-[10px] text-slate-100 font-mono shadow-lg backdrop-blur-sm"
          >
            <div className="flex flex-wrap items-center justify-center gap-1">
              <strong className="mr-1 text-emerald-300">CORNERMART QA</strong>
              <span
                data-testid="corner-mart-status"
                data-state={JSON.stringify(status)}
                className="mr-1 whitespace-nowrap text-slate-300"
              >
                {timeOfDay}/{weather} · {focusFixtureId ?? 'hero'} · stock {status.stockCount} ·
                {' '}unpaid {status.unpaidCount} · owned {status.ownedCount}
              </span>
              {phases.map((phase) => (
                <button
                  key={phase}
                  data-testid={'corner-mart-phase-' + phase}
                  onClick={() => setTimeOfDay(phase)}
                  className={`px-1.5 py-0.5 border rounded ${timeOfDay === phase ? 'bg-emerald-800 border-emerald-500' : 'bg-slate-900 border-slate-700'}`}
                >
                  {phase}
                </button>
              ))}
              {(['clear', 'rain'] as WeatherType[]).map((nextWeather) => (
                <button
                  key={nextWeather}
                  data-testid={'corner-mart-weather-' + nextWeather}
                  onClick={() => setWeatherOverride(nextWeather)}
                  className={`px-1.5 py-0.5 border rounded ${weatherOverride === nextWeather ? 'bg-blue-800 border-blue-500' : 'bg-slate-900 border-slate-700'}`}
                >
                  {nextWeather}
                </button>
              ))}
              <button
                data-testid="corner-mart-focus-hero"
                onClick={() => setFocusFixtureId(null)}
                className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded"
              >
                hero
              </button>
              <button
                data-testid="corner-mart-focus-fridge"
                onClick={() => setFocusFixtureId('corner_mart_fridge')}
                className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded"
              >
                fridge
              </button>
              <button
                data-testid="corner-mart-take-item"
                onClick={takeFirstFocusedItem}
                className="px-1.5 py-0.5 bg-amber-900 border border-amber-700 rounded"
              >
                Take
              </button>
              <button
                data-testid="corner-mart-return-item"
                onClick={returnFirstUnpaidItem}
                className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded"
              >
                Return
              </button>
              <button
                data-testid="corner-mart-cashier"
                onClick={() => openCashier(CASHIER_ACTOR_ID)}
                className="px-1.5 py-0.5 bg-emerald-900 border border-emerald-700 rounded"
              >
                Talk
              </button>
              {onExit && (
                <button
                  data-testid="corner-mart-exit"
                  onClick={onExit}
                  className="px-1.5 py-0.5 text-slate-300 border border-slate-700 rounded"
                >
                  Exit
                </button>
              )}
            </div>
            <div
              data-testid="corner-mart-message"
              className="mt-1 text-center text-[10px] text-amber-200"
            >
              {message}
            </div>
          </div>
        </>
      }
    />
  );
};

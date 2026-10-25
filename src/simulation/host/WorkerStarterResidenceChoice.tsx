import { DEFAULT_STARTING_CASH } from '../../engine/EconomyEngine';
import { GENERATED_HOUSING_OFFERS, GENERATED_PLACES } from '../../engine/worldContent.generated';
import { listStarterHousingOffers } from '../../engine/residence/HousingProgression';

// Public, authored world content is safe on the presentation thread. The
// selected ID alone crosses IPC; Worker construction validates it again.
const starterOffers = listStarterHousingOffers(GENERATED_HOUSING_OFFERS, DEFAULT_STARTING_CASH);
const placeNames = new Map(GENERATED_PLACES.map(place => [place.id, place.name] as const));

export function WorkerStarterResidenceChoice({
  disabled, onChoose,
}: {
  disabled: boolean;
  onChoose: (offerId: string) => void;
}) {
  return (
    <section data-testid="worker-starter-residences"
      className="mt-3 rounded border border-amber-800/60 bg-amber-950/20 p-4">
      <h2 className="mb-1 font-semibold text-amber-200">Where will you start?</h2>
      <p className="mb-3 text-xs text-slate-400">These are the homes you can afford today. Rent and move-in costs matter.</p>
      {starterOffers.length === 0 && <p role="alert">No affordable starting residences are available.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {starterOffers.map(offer => (
          <button key={offer.id} type="button" disabled={disabled}
            data-testid="worker-starter-offer" data-place-id={offer.placeId}
            onClick={() => onChoose(offer.id)}
            className="rounded border border-slate-700 bg-slate-900 p-3 text-left hover:border-amber-400 disabled:opacity-50">
            <span className="block font-semibold text-slate-100">{placeNames.get(offer.placeId) ?? offer.placeId}</span>
            <span className="mt-1 block text-xs text-slate-400">
              ${offer.monthlyRent.toFixed(0)} monthly rent · ${offer.moveInCost.toFixed(0)} to move in
              {offer.starterDefault ? ' · suggested' : ''}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

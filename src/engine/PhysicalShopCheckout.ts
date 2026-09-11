import type { SimulationEngine } from './SimulationEngine';
import type { PhysicalShopEngine } from './PhysicalShopEngine';

export interface PhysicalShopCheckoutResult {
  success: boolean;
  total?: number;
  itemIds?: string[];
  error?: string;
}

/**
 * Canonical #27 checkout boundary. The shop owns only exact merchandise state;
 * cash mutation remains on SimulationEngine's existing economy action path.
 */
export function checkoutPhysicalShop(
  simulation: SimulationEngine,
  shop: PhysicalShopEngine,
  pricesByDefinitionId: Readonly<Record<string, number>>,
): PhysicalShopCheckoutResult {
  let quote;
  try {
    quote = shop.getCheckoutQuote(pricesByDefinitionId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Checkout quote failed.' };
  }

  if (quote.itemIds.length === 0) {
    return { success: false, error: 'There are no unpaid goods to check out.' };
  }

  if (simulation.getState().player.cash < quote.total) {
    return { success: false, error: `Cannot afford $${quote.total.toFixed(2)} checkout.` };
  }

  const spend = simulation.dispatchAction({
    type: 'PLAYER_SPEND_CASH',
    amount: quote.total,
    reason: 'Physical shop checkout',
  });
  if (!spend.success) {
    return { success: false, error: spend.error ?? `Cannot afford $${quote.total.toFixed(2)} checkout.` };
  }

  // Quote validation is synchronous and the SimulationEngine spend action has no
  // merchandise authority, so exact ownership is committed once after cash succeeds.
  shop.finalizeCheckout(quote);
  return { success: true, total: quote.total, itemIds: [...quote.itemIds] };
}

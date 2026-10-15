import type { PhysicalShopEngine } from './PhysicalShopEngine';

export interface PhysicalShopCheckoutResult {
  success: boolean;
  total?: number;
  itemIds?: string[];
  error?: string;
}

/** Economy owns cash; the shop owns merchandise. No SimulationEngine dependency. */
export interface PhysicalShopCashPort {
  canAfford(amount: number): boolean;
  spendCash(amount: number, reason: string): { success: boolean; error?: string };
}

/**
 * Quote and validate the carried goods before spending canonical cash.
 * No item ownership commits occur on quote failure or denied debit.
 * The synchronous checkout has no await between debit and finalization.
 */
export function checkoutPhysicalShop(
  cash: PhysicalShopCashPort,
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

  if (!cash.canAfford(quote.total)) {
    return { success: false, error: `Cannot afford $${quote.total.toFixed(2)} checkout.` };
  }

  // Validate all unpaid item identities/locations before money moves.
  // Nothing can mutate these synchronous shop-owned fields between this check
  // and the final ownership transition in the same call.
  try {
    shop.validateCheckout(quote);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Checkout validation failed.' };
  }

  const spend = cash.spendCash(quote.total, 'Physical shop checkout');
  if (!spend.success) {
    return { success: false, error: spend.error ?? `Cannot afford $${quote.total.toFixed(2)} checkout.` };
  }

  shop.finalizeCheckout(quote);
  return { success: true, total: quote.total, itemIds: [...quote.itemIds] };
}

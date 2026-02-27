/**
 * In-memory credit store for Stripe-backed premium generations.
 * Each paid Stripe session awards CREDITS_PER_PURCHASE runs (default 5).
 * Each premium generation deducts one credit.
 */

export const CREDITS_PER_PURCHASE = Number(process.env.CREDITS_PER_PURCHASE) || 5;

const CREDIT_STORE_MAX = 1000;

/** Map from Stripe session ID → remaining premium generation credits. */
const creditMap = new Map<string, number>();

/** Award credits for a paid Stripe session (idempotent after first call). */
export function awardCredits(sessionId: string, count = CREDITS_PER_PURCHASE): void {
  // ES2015+ guarantees Map iterates in insertion order, so this evicts the oldest entry.
  if (!creditMap.has(sessionId) && creditMap.size >= CREDIT_STORE_MAX) {
    const first = creditMap.keys().next().value;
    if (first !== undefined) creditMap.delete(first);
  }
  // Award only if not already credited (idempotent).
  if (!creditMap.has(sessionId)) {
    creditMap.set(sessionId, count);
  }
}

/** Return how many credits remain for a session (0 if unknown). */
export function getCredits(sessionId: string): number {
  return creditMap.get(sessionId) ?? 0;
}

/**
 * Attempt to consume one credit. Returns true if successful (credit deducted),
 * false if no credits remain.
 */
export function deductCredit(sessionId: string): boolean {
  const remaining = creditMap.get(sessionId) ?? 0;
  if (remaining <= 0) return false;
  creditMap.set(sessionId, remaining - 1);
  return true;
}

/** Clear store (for tests). */
export function clearCreditStore(): void {
  creditMap.clear();
}

// ---------------------------------------------------------------------------
// Legacy aliases kept for callers that haven't been migrated yet.
// ---------------------------------------------------------------------------
/** @deprecated Use awardCredits() */
export function markSessionPaid(sessionId: string): void {
  awardCredits(sessionId);
}
/** @deprecated Use getCredits() > 0 */
export function isSessionPaid(sessionId: string): boolean {
  return getCredits(sessionId) > 0;
}
/** @deprecated Use clearCreditStore() */
export const clearPaymentStore = clearCreditStore;

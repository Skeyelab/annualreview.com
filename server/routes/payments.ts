/**
 * Payments API:
 *   GET  /config   – returns { enabled: boolean } so the frontend knows whether payments are configured
 *   POST /checkout  – create Stripe Checkout session for premium report ($1)
 *   POST /webhook   – handle Stripe webhook events (mark sessions as paid)
 *
 * Required env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (webhook only).
 * Optional: STRIPE_PRICE_CENTS (default 100 = $1.00), STRIPE_CURRENCY (default "usd").
 */

import type { IncomingMessage, ServerResponse } from "http";
import Stripe from "stripe";
import { awardCredits, getCredits, CREDITS_PER_PURCHASE } from "../../lib/payment-store.js";
export interface PaymentsRoutesOptions {
  respondJson: (res: ServerResponse, status: number, data: object) => void;
  getStripe?: () => Stripe | null;
}

type Next = () => void;

/** Read raw request body as a Buffer. */
function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function paymentsRoutes(options: PaymentsRoutesOptions) {
  const { respondJson, getStripe = getStripeClient } = options;

  return async function paymentsMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: Next
  ): Promise<void> {
    const path = (req.url?.split("?")[0] || "").replace(/^\/+/, "") || "";

    if (path === "config" && req.method === "GET") {
      const enabled = getStripe() !== null;
      respondJson(res, 200, {
        enabled,
        price_cents: Number(process.env.STRIPE_PRICE_CENTS) || 100,
        credits_per_purchase: CREDITS_PER_PURCHASE,
      });
      return;
    }

    // GET /credits/:sessionId – returns remaining credits for a Stripe session
    if (path.startsWith("credits/") && req.method === "GET") {
      const sessionId = decodeURIComponent(path.slice("credits/".length));
      respondJson(res, 200, { credits: getCredits(sessionId) });
      return;
    }
    if (path === "checkout" && req.method === "POST") {
      const stripe = getStripe();
      if (!stripe) {
        respondJson(res, 503, { error: "Payments not configured (STRIPE_SECRET_KEY missing)" });
        return;
      }
      try {
        const rawBody = await readRawBody(req);
        const body = JSON.parse(rawBody.toString() || "{}") as {
          success_url?: string;
          cancel_url?: string;
        };
        const host = req.headers.host || "localhost:3000";
        const proto = (req.headers["x-forwarded-proto"] as string) || "http";
        const origin = `${proto}://${host}`;
        const successUrl = body.success_url || `${origin}/generate?session_id={CHECKOUT_SESSION_ID}&premium=1`;
        const cancelUrl = body.cancel_url || `${origin}/generate`;

        const priceCents = Number(process.env.STRIPE_PRICE_CENTS) || 100;
        const currency = process.env.STRIPE_CURRENCY || "usd";

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency,
                unit_amount: priceCents,
                product_data: {
                  name: "Premium Annual Review Report",
                  description: "Higher-quality AI report using a state-of-the-art model",
                },
              },
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
        });

        respondJson(res, 200, { url: session.url, session_id: session.id });
      } catch (e) {
        const err = e as Error;
        respondJson(res, 500, { error: err.message || "Failed to create checkout session" });
      }
      return;
    }

    if (path === "webhook" && req.method === "POST") {
      const stripe = getStripe();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!stripe || !webhookSecret) {
        respondJson(res, 503, { error: "Webhook not configured" });
        return;
      }
      try {
        const rawBody = await readRawBody(req);
        const sig = req.headers["stripe-signature"] as string | undefined;
        if (!sig) {
          respondJson(res, 400, { error: "Missing stripe-signature header" });
          return;
        }
        const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.payment_status === "paid" && session.id) {
            awardCredits(session.id);
          }
        }
        respondJson(res, 200, { received: true });
      } catch (e) {
        const err = e as Error;
        respondJson(res, 400, { error: err.message || "Webhook error" });
      }
      return;
    }

    next();
  };
}

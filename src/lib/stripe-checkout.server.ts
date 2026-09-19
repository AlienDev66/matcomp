import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import { getServerConfig } from "@/lib/config.server";

function getStripe() {
  const { stripeSecretKey } = getServerConfig();
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY não configurada.");
  }
  return import("stripe").then(({ default: Stripe }) => new Stripe(stripeSecretKey));
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function entryIdsFromSession(session: {
  metadata?: Record<string, string> | null;
}) {
  const ids = (session.metadata?.entry_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0 && session.metadata?.entry_id) {
    ids.push(session.metadata.entry_id);
  }
  return ids;
}

/** Service-role mark paid — used by webhook (no user session). */
export async function markEntriesPaidFromStripeSession(session: {
  id: string;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
}) {
  const entryIds = entryIdsFromSession(session);
  if (entryIds.length === 0) {
    console.warn("[stripe] session without entry metadata", session.id);
    return { marked: 0, entryIds: [] as string[] };
  }

  const admin = adminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL required for webhook.");
  }

  const perEntry =
    session.amount_total != null && entryIds.length > 0
      ? Math.round(session.amount_total / entryIds.length)
      : null;

  const { error } = await admin
    .from("competition_entries")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      approved: true,
      stripe_session_id: session.id,
      amount_paid_cents: perEntry,
    } as never)
    .in("id", entryIds)
    .eq("paid", false);

  // Also update already-paid rows' session id if return-URL raced us (idempotent)
  if (error) throw error;

  await admin
    .from("competition_entries")
    .update({
      stripe_session_id: session.id,
      paid: true,
      paid_at: new Date().toISOString(),
      approved: true,
    } as never)
    .in("id", entryIds);

  return { marked: entryIds.length, entryIds };
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator(
    (data: {
      entryId?: string;
      entryIds?: string[];
      competitionId: string;
      competitionName: string;
      divisionName: string;
      lineItems?: { name: string; amountCents: number; entryId: string }[];
      amountCents: number;
      currency: string;
      successUrl: string;
      cancelUrl: string;
      customerEmail?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (data.amountCents <= 0) {
      return { url: null as string | null, free: true as const, sessionId: null as string | null };
    }

    const stripe = await getStripe();
    const entryIds =
      data.entryIds?.length ? data.entryIds : data.entryId ? [data.entryId] : [];
    const lineItems =
      data.lineItems?.length && data.lineItems.length > 0
        ? data.lineItems.map((li) => ({
            quantity: 1,
            price_data: {
              currency: data.currency.toLowerCase(),
              unit_amount: li.amountCents,
              product_data: {
                name: `${data.competitionName} — ${li.name}`,
                metadata: {
                  entry_id: li.entryId,
                  competition_id: data.competitionId,
                },
              },
            },
          }))
        : [
            {
              quantity: 1,
              price_data: {
                currency: data.currency.toLowerCase(),
                unit_amount: data.amountCents,
                product_data: {
                  name: `${data.competitionName} — ${data.divisionName}`,
                  metadata: {
                    entry_id: entryIds[0] ?? "",
                    competition_id: data.competitionId,
                  },
                },
              },
            },
          ];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.customerEmail,
      line_items: lineItems,
      metadata: {
        entry_id: entryIds[0] ?? "",
        entry_ids: entryIds.join(","),
        competition_id: data.competitionId,
      },
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    });

    return { url: session.url, free: false as const, sessionId: session.id };
  });

export const verifyCheckoutSession = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    const entryIds = entryIdsFromSession(session);
    if (session.payment_status === "paid") {
      try {
        await markEntriesPaidFromStripeSession({
          id: session.id,
          amount_total: session.amount_total,
          metadata: session.metadata as Record<string, string> | null,
        });
      } catch (err) {
        console.warn("[stripe verify] admin mark failed (RLS client may still mark)", err);
      }
    }
    return {
      paid: session.payment_status === "paid",
      entryId: entryIds[0] ?? null,
      entryIds,
      amountTotal: session.amount_total,
      sessionId: session.id,
    };
  });

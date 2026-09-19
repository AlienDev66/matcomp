import { createServerFn } from "@tanstack/react-start";
import { getServerConfig } from "@/lib/config.server";

function getStripe() {
  const { stripeSecretKey } = getServerConfig();
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY não configurada.");
  }
  return import("stripe").then(({ default: Stripe }) => new Stripe(stripeSecretKey));
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
    const entryIds = (session.metadata?.entry_ids ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (entryIds.length === 0 && session.metadata?.entry_id) {
      entryIds.push(session.metadata.entry_id);
    }
    return {
      paid: session.payment_status === "paid",
      entryId: entryIds[0] ?? null,
      entryIds,
      amountTotal: session.amount_total,
      sessionId: session.id,
    };
  });

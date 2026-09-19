import { createFileRoute } from "@tanstack/react-router";
import { getServerConfig } from "@/lib/config.server";
import { markEntriesPaidFromStripeSession } from "@/lib/stripe-checkout.server";

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { stripeSecretKey, stripeWebhookSecret } = getServerConfig();
        if (!stripeSecretKey || !stripeWebhookSecret) {
          return Response.json(
            { error: "Stripe webhook not configured" },
            { status: 503 },
          );
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return Response.json({ error: "Missing signature" }, { status: 400 });
        }

        const rawBody = await request.text();
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeSecretKey);

        let event;
        try {
          event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            stripeWebhookSecret,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Invalid signature";
          console.error("[stripe webhook]", msg);
          return Response.json({ error: msg }, { status: 400 });
        }

        if (
          event.type === "checkout.session.completed" ||
          event.type === "checkout.session.async_payment_succeeded"
        ) {
          const session = event.data.object as {
            id: string;
            payment_status?: string | null;
            amount_total?: number | null;
            metadata?: Record<string, string> | null;
          };
          if (session.payment_status === "paid" || event.type.includes("succeeded")) {
            try {
              await markEntriesPaidFromStripeSession(session);
            } catch (err) {
              console.error("[stripe webhook] mark paid failed", err);
              return Response.json({ error: "Failed to mark paid" }, { status: 500 });
            }
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});

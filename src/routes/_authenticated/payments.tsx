import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import {
  ensureEntryCheckInCode,
  fetchMyEntries,
  markEntryPaid,
} from "@/lib/competition/api";
import { formatPrice } from "@/lib/competition/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  validateSearch: (s: Record<string, unknown>) => ({
    paid: s.paid === "1" || s.paid === true ? "1" : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Pagamentos — MatComp" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["my-entries"],
    queryFn: fetchMyEntries,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!search.session_id || search.paid !== "1") return;
    let cancelled = false;
    (async () => {
      try {
        const { verifyCheckoutSession } = await import("@/lib/stripe-checkout.server");
        const result = await verifyCheckoutSession({ data: { sessionId: search.session_id! } });
        if (cancelled) return;
        if (result.paid && (result.entryIds?.length || result.entryId)) {
          const ids = result.entryIds?.length
            ? result.entryIds
            : result.entryId
              ? [result.entryId]
              : [];
          for (const entryId of ids) {
            await markEntryPaid(entryId, {
              stripe_session_id: result.sessionId,
              amount_paid_cents: result.amountTotal ?? undefined,
            });
            await ensureEntryCheckInCode(entryId);
          }
          toast.success("Pagamento confirmado");
          await qc.invalidateQueries({ queryKey: ["my-entries"] });
        }
      } catch (err: any) {
        toast.error(err.message ?? "Falha a confirmar pagamento");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.session_id, search.paid, qc]);

  return (
    <AppChrome title="Pagamentos">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">As minhas inscrições</h1>
          <p className="text-sm text-white/45 mt-1">Pagamentos, check-in QR e estado.</p>
        </div>

        {isLoading ? (
          <p className="text-white/40">A carregar…</p>
        ) : entries.length === 0 ? (
          <p className="text-white/40">
            Sem inscrições.{" "}
            <Link to="/events" className="text-sky-400 hover:underline">
              Ver eventos
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="rounded-2xl border border-white/10 bg-[#141416] p-5 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-display font-semibold truncate">
                    {(e as any).competitions?.name ?? "Evento"}
                  </p>
                  <p className="text-sm text-white/45 mt-1">
                    {e.paid
                      ? `Pago ${formatPrice(e.amount_paid_cents)}`
                      : "Pagamento pendente"}
                    {e.checked_in_at ? " · Check-in feito" : ""}
                  </p>
                  {e.check_in_code && (
                    <p className="mt-2 font-mono text-xs tracking-widest text-sky-300">
                      Check-in: {e.check_in_code}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(e as any).competitions?.id && (
                    <Button asChild variant="outline" className="border-white/15" size="sm">
                      <Link
                        to="/$lang/event/$eventId"
                        params={{ lang: "pt", eventId: (e as any).competitions.id }}
                      >
                        Evento
                      </Link>
                    </Button>
                  )}
                  {e.check_in_code && (
                    <Button asChild size="sm" className="bg-sky-500 hover:bg-sky-400">
                      <Link to="/check-in/$code" params={{ code: e.check_in_code }}>
                        Ver QR
                      </Link>
                    </Button>
                  )}
                  {!e.check_in_code && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === e.id}
                      onClick={async () => {
                        setBusyId(e.id);
                        try {
                          await ensureEntryCheckInCode(e.id);
                          toast.success("Código gerado");
                          await qc.invalidateQueries({ queryKey: ["my-entries"] });
                        } catch (err: any) {
                          toast.error(err.message);
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      Gerar check-in
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppChrome>
  );
}

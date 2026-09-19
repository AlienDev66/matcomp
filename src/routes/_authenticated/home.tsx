import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchEvents,
  fetchMyAcademies,
  fetchMyAthleteMemberships,
  fetchMyEntries,
  fetchMyJoinRequests,
} from "@/lib/competition/api";
import { AppChrome } from "@/components/AppChrome";
import { EventCard } from "@/components/EventDiscovery";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { JOIN_STATUS_LABEL } from "@/lib/competition/types";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  CreditCard,
  MapPin,
  Trophy,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — MatComp" }] }),
  component: HomeHubPage,
});

function HomeHubPage() {
  const { user } = useAuth();
  const firstName = user?.email?.split("@")[0] ?? "athlete";

  const { data: myAthletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
  });
  const { data: staffAcademies = [] } = useQuery({
    queryKey: ["my-academies"],
    queryFn: fetchMyAcademies,
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: fetchMyJoinRequests,
  });
  const { data: myEntries = [] } = useQuery({
    queryKey: ["my-entries"],
    queryFn: fetchMyEntries,
  });
  const { data: myEvents = [] } = useQuery({
    queryKey: ["events-mine-hub"],
    queryFn: () => fetchEvents({ scope: "mine" }),
  });
  const { data: featured = [] } = useQuery({
    queryKey: ["events-featured-hub"],
    queryFn: () => fetchEvents({ scope: "upcoming" }),
  });

  const pending = requests.filter((r) => r.status === "pending");
  const trainingAcademy = (myAthletes[0] as any)?.academies?.name as string | undefined;
  const upcomingEntries = myEntries.slice(0, 4);
  const yourEvents = myEvents.slice(0, 3);
  const highlight = featured.slice(0, 3);

  let statusLine = "Conta MatComp pronta — junta-te a uma academia ou cria um evento.";
  if (trainingAcademy) statusLine = `Treinas em ${trainingAcademy}.`;
  else if (pending.length > 0)
    statusLine = `Pedido pendente: ${pending[0].academy?.name ?? "academia"}.`;
  if (staffAcademies.length > 0) {
    statusLine =
      (trainingAcademy ? `${statusLine} ` : "") +
      `Staff em ${staffAcademies.map((a) => a.name).join(", ")}.`;
  }

  return (
    <AppChrome>
      <div className="space-y-10 -mt-2">
        <header className="relative overflow-hidden border border-white/10">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 90% 0%, rgba(225,29,72,0.22), transparent 50%), linear-gradient(180deg, #141014 0%, #0a0a0b 100%)",
            }}
          />
          <div className="relative z-10 space-y-5 px-5 py-8 md:px-8 md:py-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
                Início
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl mt-1">
                Olá, {firstName}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-white/50">{statusLine}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="rounded-none bg-primary hover:bg-primary/90">
                <Link to="/events/new">
                  <CalendarPlus className="mr-2 h-4 w-4" /> Criar evento
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-none border-white/20 bg-transparent hover:bg-white/5"
              >
                <Link to="/join-academy">
                  <MapPin className="mr-2 h-4 w-4" /> Juntar academia
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-none text-white/60 hover:bg-white/5 hover:text-white"
              >
                <Link to="/events">
                  Ver eventos <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/events" as const, label: "Eventos", icon: Trophy, hint: "Marketplace" },
            { to: "/membership" as const, label: "Adesão", icon: Users, hint: "Academias" },
            { to: "/rankings" as const, label: "Rankings", icon: Building2, hint: "Temporada" },
            { to: "/payments" as const, label: "Pagamentos", icon: CreditCard, hint: "Inscrições" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 border border-white/10 bg-[#121214] px-4 py-4 transition hover:border-primary/40"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/35">{item.hint}</p>
              </div>
            </Link>
          ))}
        </section>

        {(upcomingEntries.length > 0 || yourEvents.length > 0) && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-bold tracking-tight">As tuas próximas</h2>
              <Link
                to="/payments"
                className="text-[10px] uppercase tracking-[0.2em] text-white/35 hover:text-primary"
              >
                Ver tudo
              </Link>
            </div>
            <ul className="divide-y divide-white/5 border border-white/10">
              {upcomingEntries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">
                      {(e as any).competitions?.name ?? "Evento"}
                    </p>
                    <p className="text-xs text-white/40">
                      {e.paid ? "Pago" : "Pagamento pendente"}
                      {e.checked_in_at ? " · Check-in" : ""}
                    </p>
                  </div>
                  {(e as any).competitions?.id && (
                    <Link
                      to="/$lang/event/$eventId"
                      params={{ lang: "pt", eventId: (e as any).competitions.id }}
                      className="text-xs text-primary hover:underline"
                    >
                      Abrir
                    </Link>
                  )}
                </li>
              ))}
              {yourEvents.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{ev.name}</p>
                    <p className="text-xs text-white/40">Evento que criaste</p>
                  </div>
                  <Link
                    to="/events/$competitionId"
                    params={{ competitionId: ev.id }}
                    className="text-xs text-primary hover:underline"
                  >
                    Gerir
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pending.length > 0 && (
          <section className="border border-amber-500/25 bg-amber-500/5 px-4 py-4">
            <p className="text-sm font-medium text-amber-100">
              {pending.length} pedido{pending.length > 1 ? "s" : ""} de academia{" "}
              {JOIN_STATUS_LABEL.pending.toLowerCase()}
            </p>
            <Link to="/membership" className="mt-1 inline-block text-xs text-amber-300/90 hover:underline">
              Ver em Adesão →
            </Link>
          </section>
        )}

        <section className="space-y-5 pb-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">Em destaque</h2>
            <Link
              to="/events"
              className="text-[10px] uppercase tracking-[0.2em] text-white/35 hover:text-primary"
            >
              Ver todos
            </Link>
          </div>
          {highlight.length === 0 ? (
            <p className="border border-dashed border-white/15 py-10 text-center text-sm text-white/40">
              Ainda sem eventos próximos.{" "}
              <Link to="/events/new" className="text-primary hover:underline">
                Cria o primeiro
              </Link>
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {highlight.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppChrome>
  );
}

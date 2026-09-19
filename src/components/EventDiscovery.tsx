import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents, fetchMyAthleteMemberships } from "@/lib/competition/api";
import { fetchFederations } from "@/lib/competition/federations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL, type Competition, type Federation } from "@/lib/competition/types";
import { CalendarPlus, Map, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "upcoming" | "past" | "mine";

export type EventDiscoveryProps = {
  /** When set, only show events for this federation and hide marketplace federation filter */
  federationId?: string;
  federation?: Federation | null;
  /** Wrap with chrome outside; this is just the page body */
  showCreateActions?: boolean;
  title?: string;
  subtitle?: string;
};

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000));
  if (diff < 0) return null;
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return `${diff} dias`;
}

function formatShort(iso: string | null) {
  if (!iso) return "Data TBA";
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EventCard({ event }: { event: Competition }) {
  const countdown = daysLeft(event.starts_at);
  return (
    <Link
      to="/$lang/event/$eventId"
      params={{ lang: "pt", eventId: event.id }}
      className="group relative block overflow-hidden border border-white/10 bg-[#121214] transition duration-300 hover:border-primary/50 hover:shadow-[0_0_0_1px_rgba(225,29,72,0.25)]"
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-end bg-[radial-gradient(ellipse_at_top_right,_rgba(225,29,72,0.45),_transparent_55%),linear-gradient(160deg,#1a0a0c,#0a0a0b)] p-4">
            <span className="font-display text-xl font-bold leading-tight text-white/90">
              {event.name}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/25 to-transparent opacity-90" />
        {countdown && (
          <span className="absolute right-3 top-3 border border-primary/40 bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {countdown}
          </span>
        )}
      </div>
      <div className="relative -mt-10 space-y-2 px-4 pb-4 pt-0">
        <p className="font-display text-lg font-bold leading-snug tracking-tight line-clamp-2 transition group-hover:text-primary">
          {event.name}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-white/45">
          <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
          <span className="truncate">{event.venue || event.map_query || "Portugal"}</span>
        </p>
        <div className="flex items-center justify-between border-t border-white/8 pt-2 text-[11px] uppercase tracking-[0.12em] text-white/35">
          <span>{formatShort(event.starts_at)}</span>
          <span className="text-white/50">{STATUS_LABEL[event.status]}</span>
        </div>
      </div>
    </Link>
  );
}

export function EventDiscovery({
  federationId,
  federation,
  showCreateActions = true,
  title,
  subtitle,
}: EventDiscoveryProps) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [search, setSearch] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [federationFilter, setFederationFilter] = useState<string>("all");

  const effectiveFederationId =
    federationId ?? (federationFilter !== "all" ? federationFilter : undefined);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events-discovery", tab, search, effectiveFederationId ?? null],
    queryFn: () =>
      fetchEvents({
        scope: tab === "mine" ? "mine" : tab,
        search,
        federationId: effectiveFederationId,
      }),
  });
  const { data: myAthletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
  });
  const { data: federations = [] } = useQuery({
    queryKey: ["federations"],
    queryFn: fetchFederations,
    enabled: !federationId,
  });

  const nearCity = myAthletes[0]?.academy?.city ?? null;
  const { near, more } = useMemo(() => {
    if (!nearCity) return { near: events.slice(0, 8), more: events.slice(8) };
    const n = events.filter(
      (e) =>
        (e.venue ?? "").toLowerCase().includes(nearCity.toLowerCase()) ||
        (e.map_query ?? "").toLowerCase().includes(nearCity.toLowerCase()),
    );
    const rest = events.filter((e) => !n.includes(e));
    return { near: n.length ? n : events.slice(0, 8), more: n.length ? rest : events.slice(8) };
  }, [events, nearCity]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "upcoming", label: "A decorrer" },
    { id: "past", label: "Passados" },
    { id: "mine", label: "Os teus" },
  ];

  const accent = federation?.primary_color || undefined;
  const heading = title ?? (federation ? federation.name : "Encontra o próximo tatami");
  const sub =
    subtitle ??
    (federation
      ? `Eventos organizados por ${federation.name}`
      : nearCity
        ? `À volta de ${nearCity} e no resto do circuito.`
        : "Inscrições, chaves e resultados num só sítio.");

  return (
    <div className="space-y-10 -mt-2">
      <header className="relative overflow-hidden border border-white/10">
        <div
          className="absolute inset-0"
          style={{
            background: federation?.banner_url
              ? undefined
              : accent
                ? `radial-gradient(ellipse 80% 60% at 10% 0%, ${accent}44, transparent 55%), linear-gradient(180deg, #141014 0%, #0a0a0b 100%)`
                : "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(225,29,72,0.28), transparent 55%), linear-gradient(180deg, #141014 0%, #0a0a0b 100%)",
          }}
        />
        {federation?.banner_url && (
          <img
            src={federation.banner_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-12deg, transparent, transparent 12px, rgba(255,255,255,0.4) 12px, rgba(255,255,255,0.4) 13px)",
          }}
        />
        <div className="relative z-10 flex flex-col gap-6 px-5 py-8 md:flex-row md:items-end md:justify-between md:px-8 md:py-10">
          <div className="max-w-lg space-y-2">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary"
              style={accent ? { color: accent } : undefined}
            >
              {federation ? "Eventos da federação" : "Eventos MatComp"}
            </p>
            <h1
              className="font-display text-3xl font-bold tracking-tight md:text-4xl"
              style={accent ? { color: accent } : undefined}
            >
              {heading}
            </h1>
            <p className="text-sm text-white/50">{sub}</p>
          </div>
          {showCreateActions && (
            <div className="flex flex-wrap gap-2">
              <Button asChild className="rounded-none bg-primary px-5 hover:bg-primary/90">
                <Link to="/events/new">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Criar evento
                </Link>
              </Button>
              {!federationId && (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-none border-white/20 bg-transparent hover:bg-white/5"
                >
                  <Link to="/join-academy">
                    <MapPin className="mr-2 h-4 w-4" />
                    Academias
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="rounded-none text-white/60 hover:bg-white/5 hover:text-white"
                onClick={() => setShowMap((v) => !v)}
              >
                <Map className="mr-2 h-4 w-4" />
                {showMap ? "Fechar mapa" : "Mapa"}
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-6 border-b border-white/10" aria-label="Filtro de eventos">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative -mb-px pb-3 text-sm font-medium transition",
                tab === t.id ? "text-white" : "text-white/40 hover:text-white/70",
              )}
            >
              {t.label}
              {tab === t.id && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                  style={accent ? { backgroundColor: accent } : undefined}
                />
              )}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!federationId && federations.length > 0 && (
            <select
              value={federationFilter}
              onChange={(e) => setFederationFilter(e.target.value)}
              className="h-10 rounded-none border border-white/10 bg-transparent px-3 text-sm text-white/80"
            >
              <option value="all">Todas as federações</option>
              {federations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar evento…"
              className="h-10 rounded-none border-white/10 bg-transparent pl-10"
            />
          </div>
        </div>
      </div>

      {showMap && (
        <div className="overflow-hidden border border-white/10">
          <iframe
            title="Events map"
            className="h-64 w-full grayscale-[40%] contrast-125"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-9.6%2C36.9%2C-6.1%2C42.2&layer=mapnik"
            loading="lazy"
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-white/40">A carregar eventos…</p>}

      <section className="space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {nearCity && !federationId ? `Perto de ${nearCity}` : "Em destaque"}
          </h2>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Por data</span>
        </div>
        {!isLoading && near.length === 0 && (
          <p className="border border-dashed border-white/15 py-12 text-center text-sm text-white/40">
            Ainda sem eventos neste filtro.
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {near.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      {more.length > 0 && (
        <section className="space-y-5 pb-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">Mais eventos</h2>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Circuito</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

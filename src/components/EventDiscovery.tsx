import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents, fetchMyAthleteMemberships } from "@/lib/competition/api";
import { fetchFederations } from "@/lib/competition/federations";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Competition, Federation } from "@/lib/competition/types";
import { STATUS_LABEL } from "@/lib/competition/types";
import { CalendarPlus, Map, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "upcoming" | "past" | "mine";

export type EventDiscoveryProps = {
  federationId?: string;
  federation?: Federation | null;
  showCreateActions?: boolean;
  /** Hide "Os teus" and auth-only bits for public guests */
  publicMode?: boolean;
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
  publicMode = false,
  title,
  subtitle,
}: EventDiscoveryProps) {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [federationFilter, setFederationFilter] = useState<string>("all");
  const [sort, setSort] = useState<"date" | "name">("date");

  const effectiveFederationId =
    federationId ?? (federationFilter !== "all" ? federationFilter : undefined);

  const scope = tab === "mine" ? "mine" : tab;

  const { data: events = [], isLoading } = useQuery({
    queryKey: [
      "events-discovery",
      scope,
      search,
      country,
      startDate,
      endDate,
      effectiveFederationId ?? null,
      publicMode,
    ],
    queryFn: () =>
      fetchEvents({
        scope,
        search,
        country: country || undefined,
        federationId: effectiveFederationId,
        excludeDrafts: publicMode || tab !== "mine",
      }),
  });

  const { data: myAthletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
    enabled: !!session,
  });
  const { data: federations = [] } = useQuery({
    queryKey: ["federations"],
    queryFn: fetchFederations,
    enabled: !federationId,
  });

  const filtered = useMemo(() => {
    let rows = [...events];
    if (startDate) {
      const t = new Date(startDate).getTime();
      rows = rows.filter((e) => !e.starts_at || new Date(e.starts_at).getTime() >= t);
    }
    if (endDate) {
      const t = new Date(endDate).getTime() + 24 * 3600 * 1000;
      rows = rows.filter((e) => !e.starts_at || new Date(e.starts_at).getTime() <= t);
    }
    if (sort === "name") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      rows.sort((a, b) => {
        const ta = a.starts_at ? new Date(a.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.starts_at ? new Date(b.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
        return tab === "past" ? tb - ta : ta - tb;
      });
    }
    return rows;
  }, [events, startDate, endDate, sort, tab]);

  const nearCity = myAthletes[0]?.academy?.city ?? null;
  const { near, more } = useMemo(() => {
    if (!nearCity) return { near: filtered.slice(0, 8), more: filtered.slice(8) };
    const n = filtered.filter(
      (e) =>
        (e.venue ?? "").toLowerCase().includes(nearCity.toLowerCase()) ||
        (e.map_query ?? "").toLowerCase().includes(nearCity.toLowerCase()),
    );
    const rest = filtered.filter((e) => !n.includes(e));
    return { near: n.length ? n : filtered.slice(0, 8), more: n.length ? rest : filtered.slice(8) };
  }, [filtered, nearCity]);

  const tabs: { id: Tab; label: string }[] = publicMode
    ? [
        { id: "upcoming", label: "Upcoming events" },
        { id: "past", label: "Past events" },
      ]
    : [
        { id: "upcoming", label: "Upcoming events" },
        { id: "past", label: "Past events" },
        { id: "mine", label: "Os teus" },
      ];

  const accent = federation?.primary_color || undefined;
  const heading =
    title ??
    (federation ? federation.name : nearCity ? `Events near ${nearCity}` : "Events near me");
  const sub =
    subtitle ??
    (federation
      ? `Eventos de ${federation.name}`
      : "Inscrições abertas, calendário e resultados — sem login.");

  return (
    <div className="space-y-8">
      {/* Upcoming / Past pill — Smoothcomp style */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full bg-white/10 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition",
                tab === t.id
                  ? "bg-white text-[#0a0a0b] shadow"
                  : "text-white/60 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event…"
              className="h-11 rounded-md border-white/15 bg-white/5 pl-10 text-white placeholder:text-white/35"
            />
          </div>
          {!federationId && (
            <select
              value={federationFilter}
              onChange={(e) => setFederationFilter(e.target.value)}
              className="h-11 rounded-md border border-white/15 bg-[#121214] px-3 text-sm text-white/80"
            >
              <option value="all">Type / federation</option>
              {federations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 rounded-md border-white/15 bg-white/5 text-white"
            aria-label="Start date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 rounded-md border-white/15 bg-white/5 text-white"
            aria-label="End date"
          />
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Countries"
            className="h-11 rounded-md border-white/15 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        {showCreateActions && (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button asChild className="bg-primary hover:bg-primary/90 rounded-md">
              {session ? (
                <Link to="/events/new" search={{ organizer: undefined }}>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Create event
                </Link>
              ) : (
                <Link to="/auth">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Create event
                </Link>
              )}
            </Button>
            {!federationId && (
              <Button asChild variant="secondary" className="rounded-md bg-white/10 text-white hover:bg-white/15">
                <Link to="/academies">
                  <MapPin className="mr-2 h-4 w-4" />
                  Academy finder
                </Link>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="rounded-md border-white/20 bg-transparent text-white hover:bg-white/5"
              onClick={() => setShowMap((v) => !v)}
            >
              <Map className="mr-2 h-4 w-4" />
              {showMap ? "Hide map" : "Show map"}
            </Button>
          </div>
        )}
      </div>

      {showMap && (
        <div className="overflow-hidden rounded-md border border-white/10">
          <iframe
            title="Events map"
            className="h-64 w-full grayscale-[30%] contrast-125"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-9.6%2C36.9%2C-6.1%2C42.2&layer=mapnik"
            loading="lazy"
          />
        </div>
      )}

      {federation && (
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary" style={accent ? { color: accent } : undefined}>
            Federação
          </p>
          <h1 className="font-display text-3xl font-bold" style={accent ? { color: accent } : undefined}>
            {heading}
          </h1>
          <p className="text-sm text-white/50">{sub}</p>
        </header>
      )}

      {isLoading && <p className="text-sm text-white/40">A carregar eventos…</p>}

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wide">
            {federationId ? "Events" : heading}
          </h2>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "date" | "name")}
            className="h-9 rounded-md border border-white/15 bg-white px-3 text-sm text-[#0a0a0b]"
          >
            <option value="date">Sort by date</option>
            <option value="name">Sort by name</option>
          </select>
        </div>

        {!isLoading && near.length === 0 && (
          <p className="border border-dashed border-white/15 py-16 text-center text-sm text-white/40">
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
        <section className="space-y-5 pb-4">
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wide">
            More events
          </h2>
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

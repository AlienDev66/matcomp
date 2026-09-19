import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchAcademyById,
  fetchCompetition,
  fetchDivisions,
  fetchEntries,
  fetchMatches,
  fetchMyAthleteMemberships,
  isCompetitionFavorited,
  toggleCompetitionFavorite,
} from "@/lib/competition/api";
import { Logo } from "@/components/Logo";
import { BracketTree } from "@/components/BracketTree";
import { deriveMedals, medalTotals } from "@/lib/competition/medals";
import {
  deadlineStatus,
  flagEmoji,
  formatPrice,
  STATUS_LABEL,
  type CompetitionMatch,
  type InfoLang,
} from "@/lib/competition/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BadgeCheck,
  Calendar,
  Check,
  ChevronRight,
  GitBranch,
  Heart,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Scale,
  Swords,
  Trophy,
  Users,
  Video,
} from "lucide-react";

function youtubeEmbedUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const parts = u.pathname.split("/");
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIdx + 1]}`;
      }
      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[liveIdx + 1]}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export type EventPublicViewProps = {
  competitionId: string;
  lang?: "pt" | "en" | "es";
};

type TabId = "info" | "athletes" | "brackets" | "matches" | "schedule" | "results" | "livestreams";

const TABS: { id: TabId; label: string; icon: typeof Info }[] = [
  { id: "info", label: "Informação", icon: Info },
  { id: "athletes", label: "Atletas", icon: Users },
  { id: "brackets", label: "Chaves", icon: GitBranch },
  { id: "matches", label: "Lutas", icon: Swords },
  { id: "schedule", label: "Horário", icon: Calendar },
  { id: "results", label: "Resultados", icon: Trophy },
  { id: "livestreams", label: "Livestream", icon: Video },
];

const LANGS: { id: InfoLang; label: string; flag: string }[] = [
  { id: "pt", label: "Português", flag: "🇵🇹" },
  { id: "es", label: "Español", flag: "🇪🇸" },
  { id: "en", label: "English", flag: "🇬🇧" },
];

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

export function EventPublicView({ competitionId, lang: langProp = "pt" }: EventPublicViewProps) {
  const { session, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("info");
  const [lang, setLang] = useState<InfoLang>(langProp);
  const [athleteQuery, setAthleteQuery] = useState("");
  const [bracketQuery, setBracketQuery] = useState("");
  const [matchAthlete, setMatchAthlete] = useState("");
  const [matchMat, setMatchMat] = useState("all");
  const [showUnapproved, setShowUnapproved] = useState<Record<string, boolean>>({});
  const [bracketDivisionId, setBracketDivisionId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const { data: competition } = useQuery({
    queryKey: ["public-competition", competitionId],
    queryFn: () => fetchCompetition(competitionId),
    refetchInterval: 8000,
  });
  const { data: hostAcademy } = useQuery({
    queryKey: ["public-host-academy", competition?.academy_id],
    queryFn: () => fetchAcademyById(competition!.academy_id!),
    enabled: !!competition?.academy_id,
  });
  const { data: hostOrganizer } = useQuery({
    queryKey: ["public-organizer", competition?.organizer_id],
    queryFn: async () => {
      const { fetchOrganizer } = await import("@/lib/competition/organizers");
      return fetchOrganizer(competition!.organizer_id!);
    },
    enabled: !!competition?.organizer_id,
  });
  const organizerLabel =
    hostOrganizer?.name ?? hostAcademy?.name ?? "Organizador independente";
  const { data: divisions = [] } = useQuery({
    queryKey: ["public-divisions", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["public-entries", competitionId],
    queryFn: () => fetchEntries(competitionId),
    refetchInterval: 10000,
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["public-matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
    refetchInterval: 4000,
  });
  const { data: myAthletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
    enabled: !!session,
  });
  const { data: favorited = false } = useQuery({
    queryKey: ["favorite", competitionId, session?.user?.id],
    queryFn: () => isCompetitionFavorited(competitionId),
    enabled: !!session,
  });

  const alreadyIn = useMemo(
    () => entries.some((e) => myAthletes.some((a) => a.id === e.athlete_id)),
    [entries, myAthletes],
  );
  const canSelfRegister =
    !!session &&
    competition?.status === "registration" &&
    myAthletes.length > 0 &&
    !alreadyIn;

  const infoText = useMemo(() => {
    if (!competition) return "";
    if (lang === "en" && competition.info_en) return competition.info_en;
    if (lang === "es" && competition.info_es) return competition.info_es;
    return competition.info_pt || competition.notes || "";
  }, [competition, lang]);

  const entriesByDivision = useMemo(() => {
    const map = new Map<string, typeof entries>();
    const unassigned: typeof entries = [];
    for (const e of entries) {
      if (!e.division_id) {
        unassigned.push(e);
        continue;
      }
      const list = map.get(e.division_id) ?? [];
      list.push(e);
      map.set(e.division_id, list);
    }
    return { map, unassigned };
  }, [entries]);

  const mats = useMemo(() => {
    const set = new Set(matches.map((m) => m.mat_number || 1));
    return [...set].sort((a, b) => a - b);
  }, [matches]);

  const scheduleByMat = useMemo(() => {
    const groups = new Map<number, { divisionId: string | null; name: string; matches: CompetitionMatch[] }[]>();
    for (const mat of mats.length ? mats : [1]) groups.set(mat, []);
    for (const d of divisions) {
      const divMatches = matches.filter((m) => m.division_id === d.id);
      const mat = divMatches[0]?.mat_number ?? 1;
      const list = groups.get(mat) ?? [];
      list.push({ divisionId: d.id, name: d.name, matches: divMatches });
      groups.set(mat, list);
    }
    return groups;
  }, [divisions, matches, mats]);

  const filteredMatches = useMemo(() => {
    const q = matchAthlete.trim().toLowerCase();
    return matches.filter((m) => {
      if (matchMat !== "all" && String(m.mat_number) !== matchMat) return false;
      if (!q) return true;
      return (
        m.athlete_a?.full_name.toLowerCase().includes(q) ||
        m.athlete_b?.full_name.toLowerCase().includes(q)
      );
    });
  }, [matches, matchAthlete, matchMat]);

  const dateLabel = formatDate(competition?.starts_at);
  const mapQuery = encodeURIComponent(
    competition?.map_query || competition?.venue || competition?.name || "Portugal",
  );
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=-9.5%2C36.9%2C-6.1%2C42.2&layer=mapnik&marker=0`;
  const osmSearch = `https://www.openstreetmap.org/search?query=${mapQuery}`;

  const deadlines = [
    { label: "Early bird / inscrição", iso: competition?.deadline_early_at },
    { label: "Last chance for 100% coupon refund", iso: competition?.deadline_refund_100_at },
    { label: "Last chance to edit", iso: competition?.deadline_edit_at },
  ]
    .map((d) => ({ ...d, status: deadlineStatus(d.iso) }))
    .filter((d) => d.status);

  const onFavorite = async () => {
    if (!session) {
      toast.error("Entra na conta para favoritar");
      return;
    }
    try {
      const on = await toggleCompetitionFavorite(competitionId);
      toast.success(on ? "Adicionado aos favoritos" : "Removido dos favoritos");
      await qc.invalidateQueries({ queryKey: ["favorite", competitionId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const registerHref = {
    to: "/$lang/event/$eventId/register" as const,
    params: { lang, eventId: competitionId },
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <Logo className="h-8 w-8 shrink-0" />
            <span className="font-display text-sm font-bold tracking-[0.18em] uppercase truncate">
              MatComp
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-xs uppercase tracking-wider">
            <Link to="/events" className="rounded-lg px-3 py-2 text-white/45 hover:text-white">
              Eventos
            </Link>
            {session ? (
              <Link to="/membership" className="rounded-lg px-3 py-2 text-white/45 hover:text-white">
                Adesão
              </Link>
            ) : (
              <Link to="/auth" className="rounded-lg px-3 py-2 text-white/45 hover:text-white">
                Entrar
              </Link>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                "hover:bg-white/10",
                favorited ? "text-primary" : "text-white/50 hover:text-white",
              )}
              onClick={() => void onFavorite()}
            >
              <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
            </Button>
            {competition?.status === "registration" && (
              <Button asChild className="ml-1 bg-primary hover:bg-primary/90 text-white font-semibold px-4">
                <Link {...registerHref}>Inscrever</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          {competition?.cover_image_url ? (
            <img
              src={competition.cover_image_url}
              alt=""
              className="h-full w-full object-cover opacity-55"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(ellipse 70% 80% at 30% 20%, rgba(225,29,72,0.35), transparent 55%), #121014",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/70 to-[#0a0a0b]/40" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
            {organizerLabel}
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">
            {competition?.name ?? "…"}
          </h1>
          <p className="mt-3 text-sm text-white/55">{dateLabel ?? "Data a anunciar"}</p>
          {competition?.venue && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/45">
              <MapPin className="h-3.5 w-3.5" />
              {competition.venue}
            </p>
          )}
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Secções do evento">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-primary text-white"
                    : "border-transparent text-white/40 hover:text-white/70",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {tab === "info" && (
          <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
            <div className="space-y-10 min-w-0">
              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition",
                      lang === l.id
                        ? "border-white bg-white text-black"
                        : "border-white/15 text-white/60 hover:border-white/30",
                    )}
                  >
                    <span>{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>

              <section id="event-register" className="border border-white/10 bg-[#121214] p-5 space-y-4">
                <h2 className="font-display text-lg font-semibold">Inscrição</h2>
                {authLoading ? null : !session ? (
                  <p className="text-sm text-white/55">
                    <Link to="/auth" className="text-primary hover:underline">
                      Entra na conta
                    </Link>{" "}
                    para te inscreveres neste evento.
                  </p>
                ) : alreadyIn ? (
                  <p className="text-sm text-emerald-400/90 inline-flex items-center gap-2">
                    <Check className="h-4 w-4" /> Já estás inscrito
                  </p>
                ) : myAthletes.length === 0 ? (
                  <p className="text-sm text-white/55">
                    Junta-te primeiro a uma academia.{" "}
                    <Link to="/join-academy" className="text-primary hover:underline">
                      Pedir adesão
                    </Link>
                  </p>
                ) : canSelfRegister ? (
                  <div className="space-y-3 max-w-md">
                    <p className="text-sm text-white/50">
                      Confirma o perfil, escolhe a categoria (cinturão / idade / peso) e paga.
                    </p>
                    <Button asChild className="bg-primary hover:bg-primary/90">
                      <Link {...registerHref}>Começar inscrição</Link>
                    </Button>
                  </div>
                ) : competition?.status !== "registration" ? (
                  <p className="text-sm text-white/45">Inscrições fechadas.</p>
                ) : null}
              </section>

              <section className="space-y-4">
                {competition?.name && (
                  <h2 className="font-display text-3xl font-bold tracking-tight">{competition.name}</h2>
                )}
                {infoText ? (
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/70">
                    {infoText}
                  </div>
                ) : (
                  <div className="space-y-4 text-[15px] leading-relaxed text-white/65">
                    <h3 className="font-display text-2xl font-bold uppercase text-white">Pesagem</h3>
                    <p>
                      A pesagem permanece aberta durante o evento. Atletas das divisões que vão
                      competir a seguir têm prioridade.
                    </p>
                    <h3 className="font-display text-2xl font-bold uppercase text-white">
                      Política de reembolso
                    </h3>
                    <p>
                      Se não houver adversário na tua divisão, a organização tenta um confronto
                      compatível. Sem adversário adequado, pode haver crédito para eventos futuros.
                    </p>
                  </div>
                )}
                {competition?.refund_policy_url && (
                  <a
                    href={competition.refund_policy_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-primary hover:underline"
                  >
                    Política de reembolso
                  </a>
                )}
              </section>
            </div>

            <aside className="space-y-8 lg:sticky lg:top-20 self-start text-sm">
              <div className="space-y-2 border-t border-white/10 pt-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Organizador</p>
                <p className="font-medium">{organizerLabel}</p>
                {hostAcademy && hostOrganizer && (
                  <p className="text-xs text-white/40">Host: {hostAcademy.name}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {competition?.organizer_years != null && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {competition.organizer_years} anos no MatComp
                    </span>
                  )}
                  {competition?.organizer_events_count != null && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {competition.organizer_events_count}+ eventos
                    </span>
                  )}
                </div>
              </div>

              {competition?.contact_email && (
                <a
                  href={`mailto:${competition.contact_email}`}
                  className="flex items-center gap-2 text-primary hover:underline border-t border-white/10 pt-4"
                >
                  <Mail className="h-4 w-4" /> Contacto
                </a>
              )}

              <div className="space-y-2 border-t border-white/10 pt-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Local</p>
                <p className="font-medium flex gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-white/40 shrink-0" />
                  {competition?.venue || "A anunciar"}
                </p>
                <p className="text-white/40 pl-6">Europe/Lisbon</p>
              </div>

              <div className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Categorias</p>
                {divisions.length === 0 && (
                  <p className="text-white/40">Ainda sem divisões</p>
                )}
                <ul className="space-y-3">
                  {divisions
                    .filter((d) => (d as { kind?: string }).kind !== "group")
                    .map((d) => (
                      <li key={d.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white/90">{d.name}</p>
                          {(d.category || d.belt) && (
                            <p className="text-xs text-white/35 mt-0.5 capitalize">
                              {[d.belt, d.category].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">
                          {formatPrice(d.price_cents, d.currency)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>

              {deadlines.length > 0 && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                    Cancelamento / reembolso
                  </p>
                  <ul className="space-y-3">
                    {deadlines.map((d) => (
                      <li key={d.label}>
                        <p className="text-white/85">{d.label}</p>
                        <p className="text-xs text-white/40 mt-1">{d.status?.display}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Mapa</p>
                  <a
                    href={osmSearch}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Abrir
                  </a>
                </div>
                <iframe
                  title="Mapa"
                  className="h-40 w-full border border-white/10 grayscale-[30%] contrast-125"
                  src={osmEmbed}
                  loading="lazy"
                />
              </div>
            </aside>
          </div>
        )}

        {tab === "athletes" && (
          <AthletesTab
            divisions={divisions}
            entriesByDivision={entriesByDivision}
            athleteQuery={athleteQuery}
            setAthleteQuery={setAthleteQuery}
            showUnapproved={showUnapproved}
            setShowUnapproved={setShowUnapproved}
            onBracket={(name) => {
              setBracketQuery(name);
              setTab("brackets");
            }}
            total={entries.length}
          />
        )}

        {tab === "brackets" && (
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-bold">Chaves</h2>
            {bracketDivisionId ? (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-white/60 hover:text-white"
                  onClick={() => setBracketDivisionId(null)}
                >
                  ← Todas as divisões
                </Button>
                <p className="font-display text-xl font-semibold">
                  {divisions.find((d) => d.id === bracketDivisionId)?.name}
                </p>
                <BracketTree matches={matches.filter((m) => m.division_id === bracketDivisionId)} />
              </div>
            ) : (
              <>
                <div className="relative max-w-xl">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <Input
                    value={bracketQuery}
                    onChange={(e) => setBracketQuery(e.target.value)}
                    placeholder="Procurar chave…"
                    className="pl-10 border-white/10 bg-[#141416] h-11"
                  />
                </div>
                <div className="overflow-hidden border border-white/10">
                  <div className="grid grid-cols-[1fr_80px_80px_24px] gap-2 border-b border-white/10 bg-[#141416] px-4 py-3 text-xs uppercase tracking-wider text-white/40">
                    <span>Grupo</span>
                    <span>Início</span>
                    <span>Local</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-white/5">
                    {divisions
                      .filter((d) => !bracketQuery || d.name.toLowerCase().includes(bracketQuery.toLowerCase()))
                      .map((d) => {
                        const count = (entriesByDivision.map.get(d.id) ?? []).filter(
                          (e) => e.approved !== false,
                        ).length;
                        const divMatches = matches.filter((m) => m.division_id === d.id);
                        const eta = divMatches[0]?.estimated_start;
                        const mat = divMatches[0]?.mat_number ?? 1;
                        return (
                          <li key={d.id}>
                            <button
                              type="button"
                              className="grid w-full grid-cols-[1fr_80px_80px_24px] items-center gap-2 px-4 py-4 text-left hover:bg-white/[0.03]"
                              onClick={() => setBracketDivisionId(d.id)}
                            >
                              <div>
                                <p className="font-medium">{d.name}</p>
                                <p className="text-sm text-white/40 mt-0.5">{count} participantes</p>
                              </div>
                              <span className="text-sm text-white/50">{formatTime(eta)}</span>
                              <span className="text-sm text-white/50">Tatâmi {mat}</span>
                              <ChevronRight className="h-4 w-4 text-white/30" />
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "matches" && (
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-bold">Lutas</h2>
            <p className="border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-white/80">
              Os horários são <strong>dinâmicos</strong> e mudam em tempo real. Atualiza para a
              informação mais recente.
            </p>
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <aside className="space-y-3 border border-white/10 bg-[#141416] p-4 h-fit">
                <p className="text-xs uppercase tracking-wider text-white/40">Filtros</p>
                <Input
                  placeholder="Atleta"
                  value={matchAthlete}
                  onChange={(e) => setMatchAthlete(e.target.value)}
                  className="border-white/10 bg-white/5"
                />
                <Select value={matchMat} onValueChange={setMatchMat}>
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue placeholder="Filtrar por tatâmi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tatâmis</SelectItem>
                    {mats.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        Tatâmi {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => toast.message("Filtros aplicados")}
                >
                  Filtrar
                </Button>
              </aside>
              <div className="space-y-3">
                {filteredMatches.length === 0 ? (
                  <p className="text-white/40 py-16 text-center">Sem lutas para mostrar</p>
                ) : (
                  filteredMatches.map((m) => (
                    <MatchCard key={m.id} match={m} divisions={divisions} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "schedule" && (
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-bold">Horário</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(mats.length ? mats : [1]).map((mat) => {
                const rows = scheduleByMat.get(mat) ?? [];
                const matchCount = rows.reduce((n, r) => n + r.matches.length, 0);
                return (
                  <div
                    key={mat}
                    className="border border-white/10 bg-[#141416] overflow-hidden flex flex-col max-h-[70vh]"
                  >
                    <div className="border-b border-white/10 px-4 py-3 font-display font-semibold">
                      Tatâmi {mat}
                    </div>
                    <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
                      {rows.length === 0 && (
                        <li className="px-4 py-8 text-sm text-white/35 text-center">Tatâmi vazio</li>
                      )}
                      {rows.map((r) => (
                        <li key={r.divisionId ?? r.name} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-white/40">{r.matches.length} lutas</p>
                          </div>
                          <span className="text-sm text-white/50 tabular-nums">
                            {formatTime(r.matches[0]?.estimated_start)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-white/10 px-4 py-3 text-xs text-white/40 flex justify-between">
                      <span>Lutas: {matchCount}</span>
                      <span>Tatâmi {mat}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "results" && (
          <div className="space-y-8">
            <h2 className="font-display text-3xl font-bold">Resultados</h2>
            {(() => {
              const medalists = deriveMedals(matches);
              const totals = medalTotals(medalists);
              return (
                <>
                  <div className="border border-white/10 bg-[#141416] p-6">
                    <p className="text-center text-xs uppercase tracking-[0.25em] text-white/40 mb-6">
                      Medalhas totais
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                      <div className="rounded-xl bg-amber-500 px-3 py-5 text-center text-black">
                        <p className="font-display text-2xl font-bold">{totals.gold}</p>
                        <p className="text-xs font-semibold uppercase mt-1">Ouro</p>
                      </div>
                      <div className="rounded-xl bg-white/30 px-3 py-5 text-center">
                        <p className="font-display text-2xl font-bold">{totals.silver}</p>
                        <p className="text-xs font-semibold uppercase mt-1">Prata</p>
                      </div>
                      <div className="rounded-xl bg-orange-800 px-3 py-5 text-center">
                        <p className="font-display text-2xl font-bold">{totals.bronze}</p>
                        <p className="text-xs font-semibold uppercase mt-1">Bronze</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {medalists.map((row) => {
                      const divName = divisions.find((d) => d.id === row.divisionId)?.name ?? "Divisão";
                      if (!row.gold && !row.silver && row.bronze.length === 0) return null;
                      return (
                        <div
                          key={row.divisionId}
                          className="border border-white/10 bg-[#141416] p-5 space-y-3"
                        >
                          <p className="font-display font-semibold">{divName}</p>
                          <ul className="space-y-2 text-sm">
                            {row.gold && (
                              <li className="flex items-center gap-2">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                                  1
                                </span>
                                {row.gold.name}
                              </li>
                            )}
                            {row.silver && (
                              <li className="flex items-center gap-2">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/30 text-[10px] font-bold">
                                  2
                                </span>
                                {row.silver.name}
                              </li>
                            )}
                            {row.bronze.map((b) => (
                              <li key={b.athleteId} className="flex items-center gap-2">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-800 text-[10px] font-bold">
                                  3
                                </span>
                                {b.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {tab === "livestreams" && (
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-bold">Livestream</h2>
            {competition?.livestream_url ? (
              <div className="border border-white/10 bg-[#141416] overflow-hidden">
                {youtubeEmbedUrl(competition.livestream_url) ? (
                  <div className="aspect-video bg-black">
                    <iframe
                      title="Livestream"
                      src={youtubeEmbedUrl(competition.livestream_url)!}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-black/50 flex items-center justify-center">
                    <a
                      href={competition.livestream_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-primary px-6 py-3 font-semibold hover:bg-primary/90"
                    >
                      <Video className="h-5 w-5" /> Abrir livestream
                    </a>
                  </div>
                )}
                <p className="px-4 py-3 text-sm text-white/45 truncate">{competition.livestream_url}</p>
              </div>
            ) : (
              <p className="text-white/40 py-16 text-center">Ainda sem livestream configurado.</p>
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} {hostAcademy?.name ?? "MatComp"}. Todos os direitos reservados.
      </footer>

      <div className="fixed bottom-5 right-5 z-50">
        {chatOpen && (
          <div className="mb-3 w-72 border border-white/10 bg-[#141416] p-4 shadow-2xl">
            <p className="font-medium text-sm mb-2">Suporte</p>
            <p className="text-xs text-white/50 mb-3">
              Dúvidas sobre este evento? Contacta o organizador.
            </p>
            {competition?.contact_email ? (
              <a
                href={`mailto:${competition.contact_email}`}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Mail className="h-4 w-4" /> {competition.contact_email}
              </a>
            ) : (
              <p className="text-xs text-white/40">Sem email de contacto.</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-lg hover:scale-105 transition"
          aria-label="Chat"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function AthletesTab({
  divisions,
  entriesByDivision,
  athleteQuery,
  setAthleteQuery,
  showUnapproved,
  setShowUnapproved,
  onBracket,
  total,
}: {
  divisions: { id: string; name: string }[];
  entriesByDivision: {
    map: Map<string, import("@/lib/competition/types").CompetitionEntry[]>;
    unassigned: import("@/lib/competition/types").CompetitionEntry[];
  };
  athleteQuery: string;
  setAthleteQuery: (v: string) => void;
  showUnapproved: Record<string, boolean>;
  setShowUnapproved: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onBracket: (name: string) => void;
  total: number;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold">Atletas</h2>
          <p className="text-sm text-white/45 mt-1">{total} inscrições</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="bg-white/10 hover:bg-white/15 text-white"
          onClick={() => onBracket("")}
        >
          Ver chaves e horário
        </Button>
      </div>
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <Input
          value={athleteQuery}
          onChange={(e) => setAthleteQuery(e.target.value)}
          placeholder="Procurar atleta ou divisão…"
          className="pl-10 border-white/10 bg-[#141416] h-11"
        />
      </div>

      <div className="space-y-10">
        {divisions.map((d) => {
          const all = entriesByDivision.map.get(d.id) ?? [];
          const q = athleteQuery.trim().toLowerCase();
          const filtered = q
            ? all.filter(
                (e) =>
                  e.athlete?.full_name.toLowerCase().includes(q) ||
                  e.athlete?.academy?.name?.toLowerCase().includes(q) ||
                  d.name.toLowerCase().includes(q),
              )
            : all;
          const approved = filtered.filter((e) => e.approved !== false);
          const unapproved = filtered.filter((e) => e.approved === false);
          const showU = showUnapproved[d.id];
          const visible = showU ? [...approved, ...unapproved] : approved;

          return (
            <section key={d.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl font-bold md:text-2xl">{d.name}</h3>
                <Button
                  type="button"
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => onBracket(d.name)}
                >
                  Chave
                </Button>
              </div>

              {visible.length > 0 && (
                <div className="overflow-x-auto border border-white/10">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-[#141416] text-xs uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="px-4 py-3 font-medium">Atleta</th>
                        <th className="px-4 py-3 font-medium">Nascimento</th>
                        <th className="px-4 py-3 font-medium">Academia</th>
                        <th className="px-4 py-3 font-medium">Inscrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visible.map((e) => {
                        const age = e.athlete?.birth_date
                          ? Math.floor(
                              (Date.now() - new Date(e.athlete.birth_date).getTime()) /
                                (365.25 * 24 * 3600 * 1000),
                            )
                          : null;
                        const flag = flagEmoji(e.athlete?.country_code);
                        return (
                          <tr key={e.id} className="bg-[#0f0f11]/80">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center bg-white/10 text-xs font-semibold">
                                  {(e.athlete?.full_name ?? "?").slice(0, 1)}
                                </div>
                                <div>
                                  <p className="font-medium text-primary">{e.athlete?.full_name}</p>
                                  <p className="text-xs text-white/40">
                                    {flag ? `${flag} ` : ""}
                                    {e.athlete?.country_code?.toUpperCase() ?? ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-white/55">
                              {e.athlete?.birth_date ? (
                                <>
                                  <p>{e.athlete.birth_date.slice(0, 4)}</p>
                                  {age != null && <p className="text-xs text-white/35">{age} anos</p>}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-primary">{e.athlete?.academy?.name ?? "—"}</p>
                              <p className="text-xs text-white/35">
                                {e.athlete?.affiliation ||
                                  e.athlete?.academy?.affiliation ||
                                  ""}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-white/55">
                              <p className="capitalize">
                                {[e.athlete?.belt, e.athlete?.category].filter(Boolean).join(" · ")}
                              </p>
                              <p className="text-xs mt-0.5">{d.name}</p>
                              {e.athlete?.weight_kg != null && (
                                <p className="inline-flex items-center gap-1 text-xs text-emerald-400 mt-1">
                                  <Scale className="h-3 w-3" />
                                  {Number(e.athlete.weight_kg).toFixed(2)} kg
                                </p>
                              )}
                              {e.approved === false && (
                                <p className="text-xs text-amber-400 mt-1">Por aprovar</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-sm text-white/40">Inscrições aprovadas: {approved.length}</p>
              {unapproved.length > 0 && (
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() =>
                    setShowUnapproved((s) => ({ ...s, [d.id]: !s[d.id] }))
                  }
                >
                  {showU ? "Ocultar" : "Mostrar"} por aprovar ({unapproved.length})
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  match: m,
  divisions,
}: {
  match: CompetitionMatch;
  divisions: { id: string; name: string }[];
}) {
  const divName = divisions.find((d) => d.id === m.division_id)?.name;
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-[#141416] p-5",
        m.status === "finished" && "opacity-75",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-white/35">
        <span>
          {divName ? `${divName} · ` : ""}R{m.round_index + 1} · Luta {m.match_index + 1} · Tatâmi{" "}
          {m.mat_number}
          {m.estimated_start ? ` · ${formatTime(m.estimated_start)}` : ""}
        </span>
        <span className={cn(m.status === "live" && "text-primary")}>{m.status}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-center">
        <p
          className={cn(
            "font-display text-lg font-semibold text-center sm:text-right",
            m.winner_id === m.athlete_a_id && "text-primary",
          )}
        >
          {m.athlete_a?.full_name ?? "TBD"}
        </p>
        <p className="text-center text-white/30 font-display text-sm">VS</p>
        <p
          className={cn(
            "font-display text-lg font-semibold text-center sm:text-left",
            m.winner_id === m.athlete_b_id && "text-primary",
          )}
        >
          {m.athlete_b?.full_name ?? "TBD"}
        </p>
      </div>
    </div>
  );
}

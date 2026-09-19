import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCompetition, fetchDivisions, fetchMatches } from "@/lib/competition/api";
import { useCompetitionRealtime } from "@/hooks/useCompetitionRealtime";

export const Route = createFileRoute("/tv/$competitionId")({
  head: () => ({ meta: [{ title: "TV Schedule — MatComp" }] }),
  component: TvPage,
});

function TvPage() {
  const { competitionId } = Route.useParams();

  useCompetitionRealtime(
    competitionId,
    [
      ["tv-matches", competitionId],
      ["tv-comp", competitionId],
    ],
    { includeCompetition: true },
  );

  const { data: competition } = useQuery({
    queryKey: ["tv-comp", competitionId],
    queryFn: () => fetchCompetition(competitionId),
    refetchInterval: 30_000,
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["tv-divs", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["tv-matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
    refetchInterval: 15_000,
  });

  const mats = [...new Set(matches.map((m) => m.mat_number))].sort((a, b) => a - b);
  const live = matches.filter((m) => m.status === "live");
  const next = matches
    .filter((m) => m.status === "queued")
    .sort((a, b) => (a.estimated_start ?? "").localeCompare(b.estimated_start ?? ""))
    .slice(0, 12);

  return (
    <div className="min-h-dvh bg-[#050505] text-white p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">TV Mode</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold mt-1">
            {competition?.name ?? "Event"}
          </h1>
        </div>
        <p className="font-display text-3xl tabular-nums text-white/50">
          {new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      {live.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-rose-400 mb-4">Live now</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {live.map((m) => (
              <Link
                key={m.id}
                to="/scoreboard/$matchId"
                params={{ matchId: m.id }}
                className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-5 block hover:bg-rose-950/50"
              >
                <p className="text-xs text-white/40 mb-2">
                  Mat {m.mat_number} · {divisions.find((d) => d.id === m.division_id)?.name}
                </p>
                <p className="font-display text-xl font-semibold">
                  {m.athlete_a?.full_name ?? "TBD"}{" "}
                  <span className="text-white/30">vs</span> {m.athlete_b?.full_name ?? "TBD"}
                </p>
                <p className="mt-2 tabular-nums text-2xl">
                  {m.score_a} — {m.score_b}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/40 mb-4">Up next</h2>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <ul className="divide-y divide-white/5">
            {next.length === 0 && (
              <li className="px-5 py-10 text-center text-white/35">Sem lutas na fila</li>
            )}
            {next.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium">
                    {m.athlete_a?.full_name ?? "TBD"} vs {m.athlete_b?.full_name ?? "TBD"}
                  </p>
                  <p className="text-sm text-white/40">
                    {divisions.find((d) => d.id === m.division_id)?.name} · Mat {m.mat_number}
                  </p>
                </div>
                <span className="tabular-nums text-white/50">
                  {m.estimated_start
                    ? new Date(m.estimated_start).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {mats.length > 0 && (
          <p className="mt-4 text-sm text-white/35">Tatâmis ativos: {mats.join(", ")}</p>
        )}
      </section>
    </div>
  );
}

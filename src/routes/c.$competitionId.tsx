import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCompetition, fetchMatches } from "@/lib/competition/api";
import { Logo } from "@/components/Logo";
import { STATUS_LABEL } from "@/lib/competition/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/c/$competitionId")({
  head: () => ({ meta: [{ title: "Competição ao vivo — MatComp" }] }),
  component: PublicCompetitionPage,
});

function PublicCompetitionPage() {
  const { competitionId } = Route.useParams();
  const { data: competition } = useQuery({
    queryKey: ["public-competition", competitionId],
    queryFn: () => fetchCompetition(competitionId),
    refetchInterval: 5000,
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["public-matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
    refetchInterval: 4000,
  });

  const live = matches.filter((m) => m.status === "live" || (m.status === "queued" && (m.athlete_a_id || m.athlete_b_id)));
  const finished = matches.filter((m) => m.status === "finished");

  return (
    <div className="min-h-dvh bg-[#070708] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(225,29,72,0.25), transparent 45%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 py-10 space-y-10">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-white/40">
            <Logo className="h-7 w-7" />
            <span className="text-xs tracking-[0.3em] uppercase">MatComp</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            {competition?.name ?? "…"}
          </h1>
          {competition && (
            <p className="text-sm text-primary uppercase tracking-widest">
              {STATUS_LABEL[competition.status]}
              {competition.venue ? ` · ${competition.venue}` : ""}
            </p>
          )}
        </header>

        <section className="space-y-3">
          <h2 className="text-xs tracking-[0.25em] text-white/40 uppercase">Lutas</h2>
          {live.length === 0 && finished.length === 0 && (
            <p className="text-center text-white/40 py-12">À espera da chave…</p>
          )}
          {[...live.filter((m) => m.status !== "finished"), ...finished].map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-2xl border border-white/10 bg-white/[0.03] p-5",
                m.status === "finished" && "opacity-60",
              )}
            >
              <p className="text-[10px] tracking-widest text-white/35 uppercase mb-3">
                Ronda {m.round_index + 1} · Luta {m.match_index + 1}
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-center">
                <p
                  className={cn(
                    "font-display text-xl font-semibold text-center sm:text-right",
                    m.winner_id === m.athlete_a_id && "text-primary",
                  )}
                >
                  {m.athlete_a?.full_name ?? "TBD"}
                </p>
                <p className="text-center text-white/30 font-display text-sm">VS</p>
                <p
                  className={cn(
                    "font-display text-xl font-semibold text-center sm:text-left",
                    m.winner_id === m.athlete_b_id && "text-primary",
                  )}
                >
                  {m.athlete_b?.full_name ?? "TBD"}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

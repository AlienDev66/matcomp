import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  fetchCompetition,
  fetchDivisions,
  fetchMatches,
} from "@/lib/competition/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { WIN_METHOD_LABEL, type WinMethod } from "@/lib/competition/types";
import { getMesaToken, mesaTokenFromSearch, setMesaToken } from "@/lib/mesa-token";

export const Route = createFileRoute("/mesa/$competitionId/$mat")({
  head: ({ params }) => ({
    meta: [{ title: `Mesa tatâmi ${params.mat} — MatComp` }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: MesaMatPage,
});

function MesaMatPage() {
  const { competitionId, mat: matParam } = Route.useParams();
  const search = Route.useSearch();
  const mat = Math.max(1, Number(matParam) || 1);

  useEffect(() => {
    const t = search.token || mesaTokenFromSearch(window.location.search);
    if (t) setMesaToken(t);
  }, [search.token]);

  const { data: competition } = useQuery({
    queryKey: ["mesa-comp", competitionId],
    queryFn: () => fetchCompetition(competitionId),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["mesa-divs", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["mesa-matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
    refetchInterval: 2000,
  });

  const onMat = useMemo(
    () =>
      matches
        .filter((m) => (m.mat_number || 1) === mat)
        .sort((a, b) => a.round_index - b.round_index || a.match_index - b.match_index),
    [matches, mat],
  );

  const live = onMat.filter((m) => m.status === "live");
  const queued = onMat.filter((m) => m.status === "queued");
  const done = onMat.filter((m) => m.status === "finished");
  const current = live[0] ?? queued[0] ?? null;

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10 sticky top-0 z-20 bg-[#0a0a0b]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo className="h-7 w-7 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary">
                Mesa · Tatâmi {mat}
              </p>
              <p className="font-display font-semibold truncate text-sm">
                {competition?.name ?? "…"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 print:hidden"
              onClick={() => window.print()}
            >
              Imprimir fila
            </Button>
            <Button asChild variant="outline" size="sm" className="border-white/15 print:hidden">
              <Link to="/mesa/$competitionId" params={{ competitionId }}>
                Todas as mesas
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8 mesa-print-root">
        {getMesaToken() && (
          <p className="text-xs text-emerald-400/80 print:hidden">
            Sessão mesa ativa (token) — podes pontuar sem login de admin.
          </p>
        )}
        <div className="border border-primary/40 bg-primary/10 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Esta mesa</p>
            <h1 className="font-display text-3xl font-bold">Tatâmi {mat}</h1>
            <p className="text-sm text-white/50 mt-1">
              Só lutas deste tatâmi. Outras mesas não interferem.
            </p>
          </div>
          {current && (
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link to="/scoreboard/$matchId" params={{ matchId: current.id }}>
                  {current.status === "live" ? "Continuar a pontuar" : "Abrir luta"}
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15">
                <Link
                  to="/display/mat/$competitionId/$mat"
                  params={{ competitionId, mat: String(mat) }}
                  target="_blank"
                >
                  Display
                </Link>
              </Button>
            </div>
          )}
        </div>

        {live.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-rose-400">Ao vivo neste tatâmi</h2>
            {live.map((m) => (
              <MatchRow key={m.id} match={m} divisions={divisions} highlight />
            ))}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-white/40">
            Fila — Tatâmi {mat}
          </h2>
          {queued.length === 0 && (
            <p className="text-sm text-white/35 border border-white/10 px-4 py-8 text-center">
              Sem lutas na fila deste tatâmi. No admin, gera chaves e atribui tatâmi {mat}.
            </p>
          )}
          {queued.map((m) => (
            <MatchRow key={m.id} match={m} divisions={divisions} />
          ))}
        </section>

        {done.length > 0 && (
          <section className="space-y-3 opacity-55">
            <h2 className="text-xs uppercase tracking-widest text-white/40">Concluídas</h2>
            {done.slice(0, 12).map((m) => (
              <MatchRow key={m.id} match={m} divisions={divisions} done />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function MatchRow({
  match: m,
  divisions,
  highlight,
  done,
}: {
  match: import("@/lib/competition/types").CompetitionMatch;
  divisions: { id: string; name: string }[];
  highlight?: boolean;
  done?: boolean;
}) {
  const div = divisions.find((d) => d.id === m.division_id)?.name;
  const method =
    m.win_method && m.win_method in WIN_METHOD_LABEL
      ? WIN_METHOD_LABEL[m.win_method as WinMethod]
      : null;
  return (
    <div
      className={cn(
        "border border-white/10 bg-[#141416] p-4 flex flex-wrap items-center justify-between gap-3",
        highlight && "border-rose-500/50 bg-rose-950/20",
      )}
    >
      <div className="min-w-0">
        <p className="text-xs text-white/40">
          R{m.round_index + 1} · Luta {m.match_index + 1}
          {div ? ` · ${div}` : ""}
        </p>
        <p className="font-display font-semibold mt-1">
          {m.athlete_a?.full_name ?? "TBD"}{" "}
          <span className="text-white/30">vs</span> {m.athlete_b?.full_name ?? "TBD"}
        </p>
        {(m.score_a > 0 || m.score_b > 0 || done) && (
          <p className="text-sm tabular-nums text-white/50 mt-1">
            {m.score_a} — {m.score_b}
            {method ? ` · ${method}` : ""}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
          <Link to="/scoreboard/$matchId" params={{ matchId: m.id }}>
            Pontuar
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-white/15">
          <Link
            to="/display/mat/$competitionId/$mat"
            params={{ competitionId: m.competition_id, mat: String(m.mat_number || 1) }}
            target="_blank"
          >
            Display
          </Link>
        </Button>
      </div>
    </div>
  );
}

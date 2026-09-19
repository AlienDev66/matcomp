import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchCompetition, fetchMatches } from "@/lib/competition/api";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/mesa/$competitionId/")({
  head: () => ({ meta: [{ title: "Mesas — MatComp" }] }),
  component: MesaHubPage,
});

function matNumbers(matsCount: number, matchMats: number[]) {
  const maxFromMatches = matchMats.length ? Math.max(...matchMats) : 0;
  const n = Math.max(matsCount || 1, maxFromMatches, 1);
  return Array.from({ length: n }, (_, i) => i + 1);
}

function MesaHubPage() {
  const { competitionId } = Route.useParams();
  const { data: competition } = useQuery({
    queryKey: ["mesa-comp", competitionId],
    queryFn: () => fetchCompetition(competitionId),
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["mesa-matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
    refetchInterval: 4000,
  });

  const mats = useMemo(
    () => matNumbers(competition?.mats_count ?? 1, matches.map((m) => m.mat_number || 1)),
    [competition?.mats_count, matches],
  );

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo className="h-7 w-7 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Mesas</p>
              <p className="font-display font-semibold truncate">{competition?.name ?? "…"}</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/events/$competitionId" params={{ competitionId }}>
              Admin
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <div className="max-w-xl space-y-2">
          <h1 className="font-display text-3xl font-bold">Escolhe a tua mesa</h1>
          <p className="text-sm text-white/50">
            Cada tatâmi tem a sua mesa. Abre o link no computador da pessoa que vai gerir esse
            tatâmi — as lutas e o marcador ficam só desse tatâmi.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mats.map((mat) => {
            const onMat = matches.filter((m) => (m.mat_number || 1) === mat);
            const live = onMat.filter((m) => m.status === "live").length;
            const queued = onMat.filter((m) => m.status === "queued").length;
            const done = onMat.filter((m) => m.status === "finished").length;
            return (
              <Link
                key={mat}
                to="/mesa/$competitionId/$mat"
                params={{ competitionId, mat: String(mat) }}
                className="group border border-white/10 bg-[#141416] p-6 transition hover:border-primary/60 hover:bg-[#18181a]"
              >
                <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Mesa</p>
                <p className="font-display text-3xl font-bold mt-1">Tatâmi {mat}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-white/35">Ao vivo</dt>
                    <dd className="text-lg font-semibold text-rose-400 tabular-nums">{live}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35">Fila</dt>
                    <dd className="text-lg font-semibold tabular-nums">{queued}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35">Feitas</dt>
                    <dd className="text-lg font-semibold text-white/45 tabular-nums">{done}</dd>
                  </div>
                </dl>
                <p className="mt-5 text-sm text-primary group-hover:underline">Abrir mesa →</p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

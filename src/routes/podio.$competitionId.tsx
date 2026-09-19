import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fetchCompetition,
  fetchDivisions,
  fetchPodiumCalls,
  notifyAthleteCall,
  setPodiumStatus,
  staffSetPodiumStatus,
  syncAllPodiumQueues,
} from "@/lib/competition/api";
import { PODIUM_MEDAL_LABEL } from "@/lib/competition/stations";
import { StationChrome } from "@/components/StationChrome";
import { useCompetitionRealtime } from "@/hooks/useCompetitionRealtime";
import { getMesaToken } from "@/lib/mesa-token";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PodiumCall, PodiumCallStatus } from "@/lib/competition/types";

export const Route = createFileRoute("/podio/$competitionId")({
  head: () => ({ meta: [{ title: "Pódio — MatComp" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: PodioPage,
});

function PodioPage() {
  const { competitionId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();

  useCompetitionRealtime(
    competitionId,
    [
      ["station-podium", competitionId],
      ["station-matches", competitionId],
    ],
    { includePodium: true },
  );

  const { data: competition } = useQuery({
    queryKey: ["station-comp", competitionId],
    queryFn: () => fetchCompetition(competitionId),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["station-divs", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });
  const { data: podium = [] } = useQuery({
    queryKey: ["station-podium", competitionId],
    queryFn: () => fetchPodiumCalls(competitionId),
    refetchInterval: 15_000,
  });

  const active = useMemo(
    () => podium.filter((p) => p.status === "pending" || p.status === "called"),
    [podium],
  );
  const calledNow = podium.filter((p) => p.status === "called");

  const setStatus = async (row: PodiumCall, status: PodiumCallStatus) => {
    try {
      const token = getMesaToken();
      if (token) await staffSetPodiumStatus(row.id, token, status);
      else await setPodiumStatus(row.id, status);
      if (status === "called" && competition) {
        void notifyAthleteCall({
          competitionId,
          competitionName: competition.name,
          athleteId: row.athlete_id,
          mat: 0,
          phase: "podium",
        });
      }
      toast.success(
        status === "called"
          ? "Chamado ao pódio"
          : status === "done"
            ? "Concluído"
            : "Atualizado",
      );
      await qc.invalidateQueries({ queryKey: ["station-podium", competitionId] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    }
  };

  return (
    <StationChrome
      competitionId={competitionId}
      title="Estação · Pódio"
      subtitle={competition?.name}
      tokenFromSearch={search.token}
    >
      {calledNow.length > 0 && (
        <div className="border border-primary/50 bg-primary/15 p-6 text-center space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary">A chamar agora</p>
          {calledNow.map((p) => (
            <div key={p.id}>
              <p className="font-display text-3xl md:text-4xl font-bold">
                {p.athlete?.full_name ?? p.athlete_id.slice(0, 8)}
              </p>
              <p className="text-white/60">
                {PODIUM_MEDAL_LABEL[p.medal]} ·{" "}
                {divisions.find((d) => d.id === p.division_id)?.name ?? ""}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-white/15"
          onClick={async () => {
            try {
              await syncAllPodiumQueues(competitionId);
              toast.success("Fila de pódio sincronizada com resultados");
              await qc.invalidateQueries({ queryKey: ["station-podium", competitionId] });
            } catch (err: any) {
              toast.error(err.message);
            }
          }}
        >
          Sincronizar medalhas
        </Button>
      </div>

      <ul className="space-y-2">
        {active.map((p) => (
          <li
            key={p.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 border px-4 py-3",
              p.status === "called"
                ? "border-primary/50 bg-primary/10"
                : "border-white/10 bg-white/[0.03]",
            )}
          >
            <div>
              <p className="font-display font-semibold text-lg">
                {p.athlete?.full_name ?? p.athlete_id.slice(0, 8)}
              </p>
              <p className="text-xs text-white/50">
                {PODIUM_MEDAL_LABEL[p.medal]} ·{" "}
                {divisions.find((d) => d.id === p.division_id)?.name ?? "—"}
              </p>
            </div>
            <div className="flex gap-2">
              {p.status === "pending" && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-primary"
                  onClick={() => void setStatus(p, "called")}
                >
                  Chamar
                </Button>
              )}
              {p.status === "called" && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => void setStatus(p, "done")}
                >
                  No pódio
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-white/40"
                onClick={() => void setStatus(p, "skipped")}
              >
                Skip
              </Button>
            </div>
          </li>
        ))}
        {active.length === 0 && (
          <li className="py-12 text-center text-white/40">
            Sem chamadas de pódio. Termina finais e sincroniza medalhas.
          </li>
        )}
      </ul>

      {podium.filter((p) => p.status === "done").length > 0 && (
        <section className="pt-4 border-t border-white/10">
          <h2 className="text-xs uppercase tracking-widest text-white/40 mb-2">Concluídos</h2>
          <ul className="text-sm text-white/40 space-y-1">
            {podium
              .filter((p) => p.status === "done")
              .map((p) => (
                <li key={p.id}>
                  {PODIUM_MEDAL_LABEL[p.medal]} — {p.athlete?.full_name}
                </li>
              ))}
          </ul>
        </section>
      )}
    </StationChrome>
  );
}

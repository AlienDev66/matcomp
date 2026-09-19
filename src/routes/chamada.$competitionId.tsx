import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fetchCompetition,
  fetchDivisions,
  fetchEntries,
  fetchMatches,
  notifyAthleteCall,
  setMatchCall,
  staffSetMatchCall,
} from "@/lib/competition/api";
import {
  CALL_STATUS_LABEL,
  upcomingCallQueue,
  weighInForAthlete,
  type AthleteCallStatus,
} from "@/lib/competition/stations";
import { StationChrome } from "@/components/StationChrome";
import { useCompetitionRealtime } from "@/hooks/useCompetitionRealtime";
import { getMesaToken } from "@/lib/mesa-token";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CompetitionMatch } from "@/lib/competition/types";

export const Route = createFileRoute("/chamada/$competitionId")({
  head: () => ({ meta: [{ title: "Chamada — MatComp" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: ChamadaPage,
});

function ChamadaPage() {
  const { competitionId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();

  useCompetitionRealtime(
    competitionId,
    [
      ["station-matches", competitionId],
      ["station-entries", competitionId],
    ],
    { includeEntries: true },
  );

  const { data: competition } = useQuery({
    queryKey: ["station-comp", competitionId],
    queryFn: () => fetchCompetition(competitionId),
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["station-entries", competitionId],
    queryFn: () => fetchEntries(competitionId),
    refetchInterval: 20_000,
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["station-matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
    refetchInterval: 15_000,
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["station-divs", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });

  const queue = useMemo(() => upcomingCallQueue(matches, 30), [matches]);

  const setCall = async (
    m: CompetitionMatch,
    side: "a" | "b",
    status: AthleteCallStatus,
    phase: "warmup" | "mat" | "weigh_in",
  ) => {
    const athleteId = side === "a" ? m.athlete_a_id : m.athlete_b_id;
    try {
      const token = getMesaToken();
      if (token) await staffSetMatchCall(m.id, token, side, status);
      else await setMatchCall(m.id, side, status);
      if (athleteId && competition) {
        void notifyAthleteCall({
          competitionId,
          competitionName: competition.name,
          athleteId,
          mat: m.mat_number || 1,
          phase,
        });
      }
      toast.success(CALL_STATUS_LABEL[status]);
      await qc.invalidateQueries({ queryKey: ["station-matches", competitionId] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    }
  };

  return (
    <StationChrome
      competitionId={competitionId}
      title="Estação · Chamada"
      subtitle={competition?.name}
      tokenFromSearch={search.token}
    >
      <p className="text-sm text-white/50">
        Próximas lutas por ETA. Chama aquecimento / tatâmi, ou manda para pesagem se ainda faltam.
      </p>

      <ul className="space-y-3">
        {queue.map((m) => {
          const div = divisions.find((d) => d.id === m.division_id)?.name ?? "—";
          return (
            <li
              key={m.id}
              className={cn(
                "border border-white/10 bg-white/[0.03] p-4 space-y-3",
                m.status === "live" && "border-rose-500/40 bg-rose-500/10",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
                <span>
                  Tatâmi {m.mat_number || 1} · {div}
                  {m.status === "live" ? " · AO VIVO" : ""}
                </span>
                <span>
                  {m.estimated_start
                    ? new Date(m.estimated_start).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "sem ETA"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(["a", "b"] as const).map((side) => {
                  const ath = side === "a" ? m.athlete_a : m.athlete_b;
                  const id = side === "a" ? m.athlete_a_id : m.athlete_b_id;
                  const call = (side === "a" ? m.call_a : m.call_b) ?? "none";
                  const wi = weighInForAthlete(entries, id);
                  if (!id) {
                    return (
                      <div key={side} className="border border-dashed border-white/10 p-3 text-white/30 text-sm">
                        BYE / TBD
                      </div>
                    );
                  }
                  return (
                    <div key={side} className="border border-white/10 p-3 space-y-2">
                      <p className="font-display font-semibold">{ath?.full_name ?? id.slice(0, 8)}</p>
                      <p className="text-[11px] text-white/45">
                        Pesagem:{" "}
                        <span
                          className={cn(
                            wi === "passed" && "text-emerald-400",
                            wi === "failed" && "text-rose-400",
                            (!wi || wi === "pending") && "text-amber-300",
                          )}
                        >
                          {wi === "passed" ? "OK" : wi === "failed" ? "FALHOU" : "PENDENTE"}
                        </span>
                        {" · "}
                        Chamada: {CALL_STATUS_LABEL[call]}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/15 h-8 text-xs"
                          onClick={() => void setCall(m, side, "warmup", "warmup")}
                        >
                          Aquecimento
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-primary h-8 text-xs"
                          onClick={() => void setCall(m, side, "mat", "mat")}
                        >
                          Tatâmi
                        </Button>
                        {(!wi || wi === "pending") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-amber-500/40 text-amber-200 h-8 text-xs"
                            onClick={() => void setCall(m, side, "holding", "weigh_in")}
                          >
                            → Pesagem
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 text-xs">
                <Link
                  to="/scoreboard/$matchId"
                  params={{ matchId: m.id }}
                  className="text-primary hover:underline"
                  target="_blank"
                >
                  Abrir mesa
                </Link>
                <Link
                  to="/display/mat/$competitionId/$mat"
                  params={{ competitionId, mat: String(m.mat_number || 1) }}
                  className="text-white/40 hover:underline"
                  target="_blank"
                >
                  Display
                </Link>
              </div>
            </li>
          );
        })}
        {queue.length === 0 && (
          <li className="py-12 text-center text-white/40">Sem lutas na fila</li>
        )}
      </ul>
    </StationChrome>
  );
}

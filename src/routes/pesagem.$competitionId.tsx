import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchCompetition,
  fetchDivisions,
  fetchEntries,
  fetchMatches,
  recordWeighIn,
  staffRecordWeighIn,
} from "@/lib/competition/api";
import { entriesNeedingWeighIn } from "@/lib/competition/stations";
import { StationChrome } from "@/components/StationChrome";
import { useCompetitionRealtime } from "@/hooks/useCompetitionRealtime";
import { getMesaToken } from "@/lib/mesa-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pesagem/$competitionId")({
  head: () => ({ meta: [{ title: "Pesagem — MatComp" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: PesagemPage,
});

function PesagemPage() {
  const { competitionId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useCompetitionRealtime(
    competitionId,
    [
      ["station-entries", competitionId],
      ["station-matches", competitionId],
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
    refetchInterval: 20_000,
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["station-divs", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });

  const needing = useMemo(() => entriesNeedingWeighIn(entries, matches), [entries, matches]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return needing;
    return needing.filter((row) =>
      (row.entry.athlete?.full_name ?? "").toLowerCase().includes(needle),
    );
  }, [needing, q]);

  const passed = entries.filter((e) => e.weigh_in_status === "passed").length;
  const failed = entries.filter((e) => e.weigh_in_status === "failed").length;

  const submit = async (entryId: string, status: "passed" | "failed") => {
    const el = document.getElementById(`kg-${entryId}`) as HTMLInputElement | null;
    const kg = Number(el?.value);
    if (!Number.isFinite(kg) || kg <= 0) {
      toast.error("Indica o peso em kg");
      return;
    }
    setBusyId(entryId);
    try {
      const token = getMesaToken();
      if (token) await staffRecordWeighIn(entryId, token, kg, status);
      else await recordWeighIn(entryId, { weigh_in_kg: kg, weigh_in_status: status });
      toast.success(status === "passed" ? "Pesagem OK" : "Pesagem falhada");
      await qc.invalidateQueries({ queryKey: ["station-entries", competitionId] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <StationChrome
      competitionId={competitionId}
      title="Estação · Pesagem"
      subtitle={competition?.name}
      tokenFromSearch={search.token}
    >
      <div className="flex flex-wrap gap-4 text-sm text-white/60">
        <span>
          Pendentes: <strong className="text-white">{needing.length}</strong>
        </span>
        <span>
          OK: <strong className="text-emerald-400">{passed}</strong>
        </span>
        <span>
          Falharam: <strong className="text-rose-400">{failed}</strong>
        </span>
      </div>

      <Input
        placeholder="Procurar atleta…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="bg-white/5 border-white/15"
      />

      <ul className="space-y-2">
        {filtered.map(({ entry: e, urgent, nextEta }) => (
          <li
            key={e.id}
            className={cn(
              "border px-4 py-3 space-y-2",
              urgent ? "border-amber-500/60 bg-amber-500/10" : "border-white/10 bg-white/[0.03]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display font-semibold text-lg">
                  {e.athlete?.full_name ?? e.athlete_id.slice(0, 8)}
                </p>
                <p className="text-xs text-white/50">
                  {divisions.find((d) => d.id === e.division_id)?.name ?? "—"}
                  {e.athlete?.academy?.name ? ` · ${e.athlete.academy.name}` : ""}
                  {nextEta
                    ? ` · luta ~ ${new Date(nextEta).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </p>
                {urgent && (
                  <p className="text-xs text-amber-300 mt-1 font-medium">
                    Urgente — luta a aproximar-se sem pesagem
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`kg-${e.id}`}
                  type="number"
                  step="0.1"
                  placeholder="kg"
                  className="h-9 w-24 bg-black/40 border-white/15"
                  defaultValue={e.athlete?.weight_kg ?? ""}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === e.id}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => void submit(e.id, "passed")}
                >
                  OK
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === e.id}
                  className="border-rose-500/40 text-rose-300"
                  onClick={() => void submit(e.id, "failed")}
                >
                  Falhou
                </Button>
              </div>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-12 text-center text-white/40">Ninguém pendente de pesagem</li>
        )}
      </ul>
    </StationChrome>
  );
}

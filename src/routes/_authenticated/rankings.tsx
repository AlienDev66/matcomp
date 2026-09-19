import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { fetchRankingRows, fetchRankingSeasons, recalcRankingSeason } from "@/lib/competition/rankings";
import { flagEmoji } from "@/lib/competition/types";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rankings")({
  head: () => ({ meta: [{ title: "Rankings — MatComp" }] }),
  component: RankingsPage,
});

function RankingsPage() {
  const qc = useQueryClient();
  const { data: seasons = [] } = useQuery({
    queryKey: ["ranking-seasons"],
    queryFn: fetchRankingSeasons,
  });
  const [seasonId, setSeasonId] = useState<string>("");
  const activeId = seasonId || seasons[0]?.id || "";
  const season = seasons.find((s) => s.id === activeId);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ranking-rows", activeId],
    queryFn: () => fetchRankingRows(activeId),
    enabled: !!activeId,
  });
  const [busy, setBusy] = useState(false);

  return (
    <AppChrome title="Ranking">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Rankings</h1>
            <p className="text-sm text-white/45 mt-1">
              Pontos por temporada · ouro 10 · prata 6 · bronze 3 · vitória +1
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-lg border border-white/10 bg-[#141416] px-3 text-sm"
              value={activeId}
              onChange={(e) => setSeasonId(e.target.value)}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.category_label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              className="border-white/15"
              disabled={!activeId || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await recalcRankingSeason(activeId);
                  toast.success("Ranking recalculado");
                  await qc.invalidateQueries({ queryKey: ["ranking-rows", activeId] });
                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Recalcular
            </Button>
          </div>
        </div>

        {season?.last_calculated_at && (
          <p className="text-xs text-white/35">
            Último cálculo: {new Date(season.last_calculated_at).toLocaleString("pt-PT")}
          </p>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[48px_1fr_80px_72px_100px] gap-2 border-b border-white/10 bg-[#141416] px-4 py-3 text-[10px] uppercase tracking-wider text-white/40">
            <span>#</span>
            <span>Athlete</span>
            <span className="text-right">Points</span>
            <span className="text-right">W/L</span>
            <span className="text-right">Medals</span>
          </div>
          {isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-white/40">A carregar…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-white/40">
              Sem dados — termina eventos e carrega em Recalcular.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[48px_1fr_80px_72px_100px] gap-2 items-center px-4 py-3"
                >
                  <span className="font-display text-lg font-bold text-white/50">{r.rank}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {flagEmoji(r.athlete?.country_code)} {r.athlete?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {r.athlete?.academy?.name ?? r.athlete?.affiliation ?? ""}
                    </p>
                  </div>
                  <span className="text-right tabular-nums font-semibold">{Number(r.points)}</span>
                  <span className="text-right tabular-nums text-sm text-white/50">
                    {r.wins}/{r.losses}
                  </span>
                  <span className="text-right text-xs tabular-nums text-white/55">
                    🥇{r.gold} 🥈{r.silver} 🥉{r.bronze}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-sm text-white/40">
          <Link to="/events" className="text-sky-400 hover:underline">
            ← Events
          </Link>
        </p>
      </div>
    </AppChrome>
  );
}

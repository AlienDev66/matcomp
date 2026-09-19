import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchCompetition, fetchDivisions, fetchMatches } from "@/lib/competition/api";
import { MatchDisplayView, pickMatDisplayMatch } from "@/components/MatchDisplay";
import { useCompetitionRealtime } from "@/hooks/useCompetitionRealtime";

export const Route = createFileRoute("/display/mat/$competitionId/$mat")({
  head: ({ params }) => ({
    meta: [{ title: `Display tatâmi ${params.mat} — MatComp` }],
  }),
  component: MatDisplayPage,
});

function MatDisplayPage() {
  const { competitionId, mat: matParam } = Route.useParams();
  const mat = Math.max(1, Number(matParam) || 1);

  useCompetitionRealtime(
    competitionId,
    [
      ["display-mat-matches", competitionId],
      ["display-comp", competitionId],
    ],
    { includeCompetition: true },
  );

  const { data: competition } = useQuery({
    queryKey: ["display-comp", competitionId],
    queryFn: () => fetchCompetition(competitionId),
    refetchInterval: 30_000,
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["display-mat-matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
    refetchInterval: 15_000,
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["display-divs", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, []);

  if (competition?.paused_mats?.includes(mat)) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#1a1a1a] text-white/50 text-2xl">
        Tatâmi {mat} — pausado
      </div>
    );
  }

  const match = pickMatDisplayMatch(matches, mat);
  if (!match) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#1a1a1a] text-white/40 text-2xl">
        Tatâmi {mat} — à espera da próxima luta…
      </div>
    );
  }

  const divName = divisions.find((d) => d.id === match.division_id)?.name ?? "Jiu-Jitsu";
  return <MatchDisplayView match={match} divName={divName} />;
}

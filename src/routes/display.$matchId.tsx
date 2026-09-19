import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchMatch } from "@/lib/competition/api";

/** Legacy per-match URL → stable tatâmi display that follows the active fight. */
export const Route = createFileRoute("/display/$matchId")({
  head: () => ({ meta: [{ title: "Display — MatComp" }] }),
  component: DisplayRedirectPage,
});

function DisplayRedirectPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const { data: match, isError } = useQuery({
    queryKey: ["display-match", matchId],
    queryFn: () => fetchMatch(matchId),
  });

  useEffect(() => {
    if (!match?.competition_id) return;
    void navigate({
      to: "/display/mat/$competitionId/$mat",
      params: {
        competitionId: match.competition_id,
        mat: String(match.mat_number || 1),
      },
      replace: true,
    });
  }, [match, navigate]);

  return (
    <div className="min-h-dvh grid place-items-center bg-[#1a1a1a] text-white/40 text-2xl">
      {isError ? "Display indisponível" : "A abrir display do tatâmi…"}
    </div>
  );
}

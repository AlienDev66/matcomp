import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$competitionId")({
  head: () => ({ meta: [{ title: "Evento — MatComp" }] }),
  component: LegacyCompetitionRedirect,
});

function LegacyCompetitionRedirect() {
  const { competitionId } = Route.useParams();
  return <Navigate to="/$lang/event/$eventId" params={{ lang: "pt", eventId: competitionId }} />;
}

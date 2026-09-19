import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$lang/event/$eventId")({
  head: ({ params }) => ({
    meta: [
      { title: `Evento — MatComp` },
      { name: "description", content: `Competição ${params.eventId}` },
    ],
  }),
  component: LangEventLayout,
});

function LangEventLayout() {
  return <Outlet />;
}

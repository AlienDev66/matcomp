import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/mesa/$competitionId")({
  component: () => <Outlet />,
});

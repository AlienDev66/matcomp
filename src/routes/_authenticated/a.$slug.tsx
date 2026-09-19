import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAcademyBySlug } from "@/lib/competition/api";
import { AcademyShell } from "@/components/AcademyShell";

export const Route = createFileRoute("/_authenticated/a/$slug")({
  component: AcademyLayout,
});

function AcademyLayout() {
  const { slug } = Route.useParams();
  const { data: academy, isLoading, error } = useQuery({
    queryKey: ["academy", slug],
    queryFn: () => fetchAcademyBySlug(slug),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        A carregar academia…
      </div>
    );
  }

  if (error || !academy) return <Navigate to="/home" />;

  return (
    <AcademyShell academy={academy}>
      <Outlet />
    </AcademyShell>
  );
}

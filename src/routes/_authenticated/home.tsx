import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyAcademies } from "@/lib/competition/api";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "As tuas academias — MatComp" }] }),
  component: HomePage,
});

function HomePage() {
  const { data: academies = [], isLoading } = useQuery({
    queryKey: ["my-academies"],
    queryFn: fetchMyAcademies,
  });

  if (!isLoading && academies.length === 0) {
    return <Navigate to="/onboarding" />;
  }
  if (!isLoading && academies.length === 1) {
    return <Navigate to="/a/$slug" params={{ slug: academies[0].slug }} />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 space-y-8">
      <div className="text-center space-y-2">
        <Logo className="mx-auto h-12 w-12" />
        <h1 className="font-display text-3xl font-bold">As tuas academias</h1>
        <p className="text-sm text-muted-foreground">Escolhe onde queres trabalhar</p>
      </div>

      {isLoading && <p className="text-center text-muted-foreground">A carregar…</p>}

      <div className="space-y-3">
        {academies.map((a) => (
          <Link
            key={a.id}
            to="/a/$slug"
            params={{ slug: a.slug }}
            className="block rounded-2xl border border-border bg-card/60 p-5 transition hover:border-primary/40 hover:bg-card"
          >
            <p className="font-display text-xl font-semibold">{a.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {a.city ? `${a.city} · ` : ""}/{a.slug}
            </p>
          </Link>
        ))}
      </div>

      <Button asChild className="w-full min-h-12 bg-primary hover:bg-primary/90">
        <Link to="/onboarding">
          <Plus className="h-4 w-4 mr-2" /> Nova academia
        </Link>
      </Button>
    </div>
  );
}

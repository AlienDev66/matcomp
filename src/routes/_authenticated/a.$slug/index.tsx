import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAcademyBySlug, fetchAthletes, fetchCompetitions } from "@/lib/competition/api";
import { STATUS_LABEL } from "@/lib/competition/types";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/a/$slug/")({
  head: () => ({ meta: [{ title: "Painel — MatComp" }] }),
  component: AcademyDashboard,
});

function AcademyDashboard() {
  const { slug } = Route.useParams();
  const { data: academy } = useQuery({
    queryKey: ["academy", slug],
    queryFn: () => fetchAcademyBySlug(slug),
  });
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions", academy?.id],
    queryFn: () => fetchCompetitions(academy!.id),
    enabled: !!academy?.id,
  });
  const { data: athletes = [] } = useQuery({
    queryKey: ["athletes", academy?.id],
    queryFn: () => fetchAthletes(academy!.id),
    enabled: !!academy?.id,
  });

  const live = competitions.filter((c) => c.status === "live");
  const upcoming = competitions.filter((c) => c.status === "draft" || c.status === "registration");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">Painel</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">{academy?.name}</h1>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/a/$slug/competitions" params={{ slug }}>
            <Plus className="h-4 w-4 mr-2" /> Nova competição
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Atletas", value: athletes.length, icon: Users },
          { label: "Ao vivo", value: live.length, icon: Trophy },
          { label: "Eventos", value: competitions.length, icon: Trophy },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card/40 p-5">
            <s.icon className="h-5 w-5 text-primary mb-3" />
            <p className="font-display text-3xl font-bold tabular-nums">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Próximos / rascunhos</h2>
        {upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda sem competições. Cria a primeira.</p>
        )}
        <div className="space-y-2">
          {upcoming.slice(0, 5).map((c) => (
            <Link
              key={c.id}
              to="/a/$slug/competitions/$competitionId"
              params={{ slug, competitionId: c.id }}
              className="flex items-center justify-between rounded-xl border border-border bg-card/30 px-4 py-3 hover:border-primary/30"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{STATUS_LABEL[c.status]}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

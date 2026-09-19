import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyOrganizers } from "@/lib/competition/organizers";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizer/")({
  head: () => ({ meta: [{ title: "Organizador — MatComp" }] }),
  component: OrganizerHubPage,
});

function OrganizerHubPage() {
  const { data: organizers = [], isLoading } = useQuery({
    queryKey: ["my-organizers"],
    queryFn: fetchMyOrganizers,
  });

  return (
    <AppChrome title="Organizador">
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary">Smoothcomp-style</p>
          <h1 className="font-display text-3xl font-bold">As tuas organizações</h1>
          <p className="max-w-2xl text-sm text-white/50 leading-relaxed">
            No MatComp, os eventos pertencem a um <strong className="text-white/70">Organizer</strong> —
            não à academia onde os atletas treinam. A academia é opcional (local/host). A federação
            lista eventos de organizations ligadas pelo código.
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link to="/organizer/new">
              <Plus className="mr-2 h-4 w-4" /> Criar organização
            </Link>
          </Button>
        </header>

        {isLoading && <p className="text-white/40 text-sm">A carregar…</p>}

        <ul className="space-y-3">
          {organizers.map((o) => (
            <li key={o.id}>
              <Link
                to="/organizer/$slug"
                params={{ slug: o.slug }}
                className="flex items-center gap-4 border border-white/10 bg-white/[0.03] px-5 py-4 hover:border-primary/40 transition"
              >
                <Building2 className="h-8 w-8 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold truncate">{o.name}</p>
                  <p className="text-xs text-white/40 font-mono mt-0.5">
                    Código: {o.organization_code} · {o.credits_balance ?? 0} créditos
                  </p>
                </div>
                <span className="text-xs text-primary">Gerir →</span>
              </Link>
            </li>
          ))}
          {!isLoading && organizers.length === 0 && (
            <li className="border border-dashed border-white/15 px-5 py-10 text-center text-sm text-white/45">
              Ainda não tens organização. Cria uma para poderes organizar eventos.
            </li>
          )}
        </ul>
      </div>
    </AppChrome>
  );
}

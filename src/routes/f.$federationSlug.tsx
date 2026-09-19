import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFederationBySlug } from "@/lib/competition/federations";
import {
  ensureFederationAdmin,
  fetchPendingFederationEvents,
  isFederationAdmin,
  setFederationApproval,
} from "@/lib/competition/api";
import {
  connectOrganizerByCode,
  fetchFederationOrganizers,
} from "@/lib/competition/organizers";
import { EventDiscovery } from "@/components/EventDiscovery";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/f/$federationSlug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.federationSlug} — MatComp Federation` }],
  }),
  component: FederationLayout,
});

function FederationLayout() {
  const { federationSlug } = Route.useParams();
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const [orgCode, setOrgCode] = useState("");
  const [busyCode, setBusyCode] = useState(false);
  const { data: federation, isLoading } = useQuery({
    queryKey: ["federation", federationSlug],
    queryFn: () => fetchFederationBySlug(federationSlug),
  });
  const { data: isAdmin } = useQuery({
    queryKey: ["fed-admin", federation?.id, user?.id],
    queryFn: () => isFederationAdmin(federation!.id),
    enabled: !!federation && !!user,
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["fed-pending", federation?.id],
    queryFn: () => fetchPendingFederationEvents(federation!.id),
    enabled: !!federation && !!isAdmin,
  });
  const { data: linkedOrgs = [] } = useQuery({
    queryKey: ["fed-orgs", federation?.id],
    queryFn: () => fetchFederationOrganizers(federation!.id),
    enabled: !!federation && !!isAdmin,
  });

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0a0a0b] text-white/40">A carregar…</div>
    );
  }

  if (!federation) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0a0a0b] text-white p-6 text-center">
        <div>
          <p className="font-display text-2xl font-bold mb-2">Federação não encontrada</p>
          <Link to="/" className="text-primary hover:underline">
            MatComp home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            to="/f/$federationSlug"
            params={{ federationSlug }}
            className="flex items-center gap-2.5 min-w-0"
          >
            {federation.logo_url ? (
              <img src={federation.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <Logo className="h-8 w-8" />
            )}
            <span className="font-display text-sm font-bold tracking-[0.15em] uppercase truncate">
              {federation.name}
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-xs uppercase tracking-wider">
            <Link
              to="/f/$federationSlug"
              params={{ federationSlug }}
              className="rounded-lg px-3 py-2 text-white"
            >
              Events
            </Link>
            <Link
              to={session ? "/rankings" : "/auth"}
              className="rounded-lg px-3 py-2 text-white/45 hover:text-white"
            >
              Ranking
            </Link>
            {federation.website_url ? (
              <a
                href={federation.website_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-2 text-white/45 hover:text-white"
              >
                Website
              </a>
            ) : null}
            <Link
              to={session ? "/membership" : "/auth"}
              className="rounded-lg px-3 py-2 text-white/45 hover:text-white"
            >
              Membership
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {user && !isAdmin && (
          <div className="border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              Queres gerir aprovações desta federação neste browser?
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15"
              onClick={async () => {
                try {
                  await ensureFederationAdmin(federation.id, user.id);
                  toast.success("És admin desta federação");
                  await qc.invalidateQueries({ queryKey: ["fed-admin", federation.id] });
                } catch (err: any) {
                  toast.error(err.message);
                }
              }}
            >
              Tornar-me admin (demo)
            </Button>
          </div>
        )}

        {isAdmin && (
          <section className="border border-white/10 p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold">Organizações ligadas</h2>
            <p className="text-sm text-white/50">
              Cola o <strong className="text-white/70">código da organização</strong> (página
              Organizador) para a ligar a esta federação.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value)}
                placeholder="código…"
                className="max-w-xs font-mono"
              />
              <Button
                type="button"
                disabled={busyCode || !orgCode.trim()}
                className="bg-primary hover:bg-primary/90"
                onClick={async () => {
                  setBusyCode(true);
                  try {
                    await connectOrganizerByCode(federation.id, orgCode);
                    toast.success("Organização ligada");
                    setOrgCode("");
                    await qc.invalidateQueries({ queryKey: ["fed-orgs", federation.id] });
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setBusyCode(false);
                  }
                }}
              >
                Ligar
              </Button>
            </div>
            <ul className="text-sm text-white/60 space-y-1">
              {linkedOrgs.map((row) => (
                <li key={row.id}>• {row.organizer?.name ?? row.organizer_id}</li>
              ))}
              {linkedOrgs.length === 0 && (
                <li className="text-white/35">Nenhuma organização ligada ainda.</li>
              )}
            </ul>
          </section>
        )}

        {isAdmin && pending.length > 0 && (
          <section className="border border-primary/30 bg-primary/5 p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold">Pedidos de aprovação</h2>
            {pending.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-white/10 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-white/40">{c.venue ?? "—"}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    onClick={async () => {
                      await setFederationApproval(c.id, "approved");
                      toast.success("Aprovado");
                      await qc.invalidateQueries({ queryKey: ["fed-pending", federation.id] });
                    }}
                  >
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/15"
                    onClick={async () => {
                      await setFederationApproval(c.id, "rejected");
                      toast.message("Rejeitado");
                      await qc.invalidateQueries({ queryKey: ["fed-pending", federation.id] });
                    }}
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        <EventDiscovery
          federationId={federation.id}
          federation={federation}
          showCreateActions={!!session}
          publicMode={!session}
          title={federation.name}
          subtitle={`Circuito · ${federation.subdomain ?? federation.slug}.matcomp.com`}
        />
        <Outlet />
      </main>
    </div>
  );
}

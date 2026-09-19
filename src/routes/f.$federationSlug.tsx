import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFederationBySlug } from "@/lib/competition/federations";
import { EventDiscovery } from "@/components/EventDiscovery";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/f/$federationSlug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.federationSlug} — MatComp Federation` }],
  }),
  component: FederationLayout,
});

function FederationLayout() {
  const { federationSlug } = Route.useParams();
  const { session } = useAuth();
  const { data: federation, isLoading } = useQuery({
    queryKey: ["federation", federationSlug],
    queryFn: () => fetchFederationBySlug(federationSlug),
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

      <main className="mx-auto max-w-6xl px-4 py-8">
        <EventDiscovery
          federationId={federation.id}
          federation={federation}
          showCreateActions={!!session}
          title={federation.name}
          subtitle={`Circuito · ${federation.subdomain ?? federation.slug}.matcomp.com`}
        />
        <Outlet />
      </main>
    </div>
  );
}

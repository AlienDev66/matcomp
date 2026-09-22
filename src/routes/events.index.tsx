import { createFileRoute, Link } from "@tanstack/react-router";
import { EventDiscovery } from "@/components/EventDiscovery";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Find events — MatComp" },
      {
        name: "description",
        content:
          "Descobre torneios de Jiu-Jitsu: próximos e passados. Inscrições e resultados — sem precisares de login.",
      },
    ],
  }),
  component: PublicEventsPage,
});

function PublicEventsPage() {
  const { session } = useAuth();

  return (
    <div className="min-h-dvh bg-[#121214] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#121214]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Link to="/" className="flex items-center gap-2 min-w-0 shrink">
              <Logo className="h-8 w-8 shrink-0" />
              <span className="font-display text-sm font-bold tracking-[0.16em] uppercase truncate">
                MatComp
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm text-white/55">
              <Link to="/events" className="text-white font-medium">
                Events
              </Link>
              <Link to="/academies" className="hover:text-white">
                Community
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {session ? (
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                <Link to="/home">Área pessoal</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="text-white/70 hover:text-white px-2.5">
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-primary hover:bg-primary/90 px-3"
                >
                  <Link to="/auth">
                    <span className="sm:hidden">Criar</span>
                    <span className="hidden sm:inline">Create account</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <EventDiscovery publicMode={!session} showCreateActions />
      </main>
    </div>
  );
}

import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { GitBranch, MonitorPlay, Trophy, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatComp — Software de torneios de BJJ" },
      {
        name: "description",
        content:
          "Organiza competições de Jiu-Jitsu: chaves, inscrições, tatâmis ao vivo e páginas públicas — feito para academias.",
      },
    ],
  }),
  component: MarketingLanding,
});

function MarketingLanding() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/home" />;

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="absolute inset-x-0 top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-bold tracking-[0.14em] uppercase">
              MatComp
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-white">
              <Link to="/auth">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative min-h-[88dvh] flex flex-col justify-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(225,29,72,0.42), transparent 58%), linear-gradient(180deg, #16080c 0%, #0a0a0b 72%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-18deg, transparent, transparent 18px, rgba(255,255,255,0.35) 18px, rgba(255,255,255,0.35) 19px)",
          }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 md:pb-24 md:pt-36">
          <p className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-[0.08em] uppercase leading-none">
            MatComp
          </p>
          <p className="mt-5 max-w-xl text-lg md:text-xl text-white/60 leading-relaxed">
            Software de torneios para Jiu-Jitsu: chaves, inscrições, tatâmis ao vivo e páginas
            públicas — feito para academias.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white px-8">
              <Link to="/auth">Começar</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/5 px-8"
            >
              <Link to="/auth">Criar evento</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 space-y-10">
        <h2 className="font-display text-3xl md:text-4xl font-bold max-w-lg">
          Tudo para correr um open limpo
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          {[
            {
              icon: GitBranch,
              t: "Chaves",
              d: "Eliminação simples em segundos a partir das inscrições. Mais formatos a caminho.",
            },
            {
              icon: Users,
              t: "Inscrições",
              d: "Atletas juntam-se a academias, pedem adesão e inscrevem-se sozinhos.",
            },
            {
              icon: MonitorPlay,
              t: "Tatâmis ao vivo",
              d: "Página pública com lutas, horários e resultados em tempo quase real.",
            },
            {
              icon: Trophy,
              t: "Rankings e medalhas",
              d: "Pontos por temporada, ecrãs de tatâmi e marcador digital.",
            },
          ].map((f) => (
            <div key={f.t} className="flex gap-4 border-t border-white/10 pt-6">
              <f.icon className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-xl font-semibold">{f.t}</p>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#111113] py-16">
        <div className="mx-auto max-w-3xl px-4 text-center space-y-6">
          <h2 className="font-display text-3xl font-bold">Cria o teu primeiro evento hoje</h2>
          <p className="text-white/55">
            Conta grátis. Junta-te a uma academia ou cria a tua. Organiza o próximo open em minutos.
          </p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white px-10">
            <Link to="/auth">Criar conta</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-display font-bold tracking-wider uppercase">MatComp</span>
          </div>
          <div className="flex flex-wrap gap-6 text-white/45">
            <Link to="/auth" className="hover:text-white">
              Eventos
            </Link>
            <a href="#features" className="hover:text-white">
              Funcionalidades
            </a>
            <Link to="/auth" className="hover:text-white">
              Suporte
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-white/30">
          © {new Date().getFullYear()} MatComp. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}

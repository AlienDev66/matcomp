import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  ClipboardCheck,
  GitBranch,
  Megaphone,
  MonitorPlay,
  Scale,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatComp — Software de torneios de BJJ" },
      {
        name: "description",
        content:
          "Organiza competições de Jiu-Jitsu de ponta a ponta: inscrições, chaves, pesagem, chamada, mesas ao vivo e pódio — feito para academias.",
      },
    ],
  }),
  component: MarketingLanding,
});

const FEATURES = [
  {
    icon: GitBranch,
    t: "Chaves multi-formato",
    d: "Eliminação simples, dupla, round-robin e consolação — com BYEs e avanço automático.",
  },
  {
    icon: MonitorPlay,
    t: "Mesas e ecrãs ao vivo",
    d: "Um PC por tatâmi, scoreboard IBJJF, display e TV com realtime — sem refrescar a página.",
  },
  {
    icon: Scale,
    t: "Operação no dia",
    d: "Estações de pesagem, chamada (aquecimento/tatâmi) e pódio, com tokens para staff.",
  },
  {
    icon: ClipboardCheck,
    t: "Inscrições e check-in",
    d: "Atletas em academias, inscrição online, aprovação e check-in por QR no dia.",
  },
  {
    icon: Megaphone,
    t: "Comunicação automática",
    d: "Quando chamas aquecimento, tatâmi ou pódio, o atleta recebe aviso (email/outbox).",
  },
  {
    icon: Trophy,
    t: "Medalhas e rankings",
    d: "Pódio sincronizado com resultados e rankings por temporada para academias.",
  },
] as const;

const DAY_FLOW = [
  { step: "01", label: "Check-in" },
  { step: "02", label: "Pesagem" },
  { step: "03", label: "Chamada" },
  { step: "04", label: "Tatâmi" },
  { step: "05", label: "Pódio" },
] as const;

function MarketingLanding() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/home" />;

  return (
    <div className="landing-root min-h-dvh bg-[#0a0a0b] text-white overflow-x-hidden">
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
              <Link to="/events">Find events</Link>
            </Button>
            <Button asChild variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild className="landing-cta-primary bg-primary hover:bg-primary/90 text-white">
              <Link to="/auth">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — brand first, one composition */}
      <section className="relative min-h-[90dvh] flex flex-col justify-end overflow-hidden">
        <div
          className="landing-layer landing-glow absolute inset-0"
          style={{
            ["--depth" as string]: 1,
            background:
              "radial-gradient(ellipse 80% 60% at 70% -10%, rgba(225,29,72,0.5), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(225,29,72,0.12), transparent 50%), linear-gradient(180deg, #14060a 0%, #0a0a0b 70%)",
          }}
        />
        <div
          className="landing-layer absolute inset-0 opacity-[0.1]"
          style={{
            ["--depth" as string]: 2,
            backgroundImage:
              "repeating-linear-gradient(-18deg, transparent, transparent 22px, rgba(255,255,255,0.4) 22px, rgba(255,255,255,0.4) 23px)",
          }}
        />
        <div
          className="landing-orb-hot pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
          aria-hidden
        />
        <div
          className="landing-orb-soft pointer-events-none absolute -left-16 bottom-32 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 md:pb-24 md:pt-36">
          <p className="landing-rise landing-delay-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-[0.08em] uppercase leading-none">
            MatComp
          </p>
          <p className="landing-rise landing-delay-2 mt-5 max-w-xl text-lg md:text-xl text-white/65 leading-relaxed">
            Do check-in ao pódio: chaves, pesagem, chamada, mesas por tatâmi e ecrãs ao vivo —
            o software de open para academias.
          </p>
          <div className="landing-rise landing-delay-3 mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="landing-cta-primary bg-primary hover:bg-primary/90 text-white px-8"
            >
              <Link to="/auth">Começar</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/5 px-8"
            >
              <Link to="/events">Find events</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Day flow — one job */}
      <section id="dia" className="border-y border-white/10 bg-[#0e0e10]">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-16">
          <p className="landing-fade text-[10px] uppercase tracking-[0.28em] text-primary">
            No dia do open
          </p>
          <h2 className="landing-rise landing-delay-1 mt-3 font-display text-2xl md:text-3xl font-bold max-w-md">
            Cada estação no seu ecrã. Tudo ligado.
          </h2>
          <ol className="mt-10 flex flex-wrap gap-x-2 gap-y-4 md:gap-x-0 md:justify-between">
            {DAY_FLOW.map((item, i) => (
              <li
                key={item.step}
                className={`landing-rise landing-delay-${i + 2} flex items-center gap-3 md:flex-1 md:min-w-0`}
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-primary/80 tracking-wider">{item.step}</p>
                  <p className="font-display text-lg font-semibold truncate">{item.label}</p>
                </div>
                {i < DAY_FLOW.length - 1 && (
                  <span
                    className="hidden md:block flex-1 mx-3 h-px bg-gradient-to-r from-white/25 to-transparent"
                    aria-hidden
                  />
                )}
              </li>
            ))}
          </ol>
          <p className="landing-fade landing-delay-7 mt-8 max-w-2xl text-sm text-white/45 leading-relaxed">
            Staff com links por token: pesagem marca o peso, chamada manda para aquecimento ou
            tatâmi, a mesa pontua, o pódio chama medalhados — com realtime entre ecrãs.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 space-y-12">
        <h2 className="landing-rise font-display text-3xl md:text-4xl font-bold max-w-lg">
          Tudo para correr um open limpo
        </h2>
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div
              key={f.t}
              className={`landing-feature landing-rise landing-delay-${(i % 4) + 2} flex gap-4 border-t border-white/10 pt-6`}
            >
              <f.icon className="landing-feature-icon h-6 w-6 text-primary shrink-0 mt-0.5" />
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
          <h2 className="landing-rise font-display text-3xl font-bold">
            Cria o teu primeiro evento hoje
          </h2>
          <p className="landing-fade landing-delay-2 text-white/55">
            Conta grátis. Junta-te a uma academia ou cria a tua. Do rascunho ao pódio, em minutos.
          </p>
          <Button
            asChild
            size="lg"
            className="landing-cta-primary landing-rise landing-delay-3 bg-primary hover:bg-primary/90 text-white px-10"
          >
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
            <Link to="/events" className="hover:text-white">
              Find events
            </Link>
            <a href="#dia" className="hover:text-white">
              Dia do evento
            </a>
            <a href="#features" className="hover:text-white">
              Funcionalidades
            </a>
            <Link to="/auth" className="hover:text-white">
              Entrar
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

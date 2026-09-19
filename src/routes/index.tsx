import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { GitBranch, MonitorPlay, Shield, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatComp — Competições para academias" },
      {
        name: "description",
        content: "Organiza torneios de Jiu-Jitsu: chaves, tatâmis e ecrãs ao vivo. Feito para várias academias.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/home" />;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Atmosphere — full-bleed gradient plane */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 70% 10%, rgba(225,29,72,0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(251,191,36,0.12), transparent 50%), linear-gradient(180deg, #0a0a0b 0%, #121014 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="font-display text-2xl font-bold tracking-tight">MatComp</span>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-20">
        <div className="max-w-3xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-amber-400/90">
            Plataforma de competições
          </p>
          <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl">
            Torneios limpos.
            <br />
            <span className="text-primary">Chaves claras.</span>
            <br />
            Qualquer academia.
          </h1>
          <p className="mt-8 max-w-xl text-lg text-white/60 leading-relaxed">
            MatComp é o Smoothcomp das academias: cria eventos, gera brackets, gere tatâmis e
            partilha o ecrã público — sem misturar com mensalidades.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="min-h-12 bg-primary px-8 text-base hover:bg-primary/90">
              <Link to="/auth">Criar conta grátis</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-h-12 border-white/20 bg-white/5 text-base">
              <a href="#como">Como funciona</a>
            </Button>
          </div>
        </div>

        <section id="como" className="mt-28 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, t: "Multi-academia", d: "Cada academia com o seu espaço, atletas e eventos." },
            { icon: GitBranch, t: "Chaves automáticas", d: "Single-elim em segundos a partir das inscrições." },
            { icon: MonitorPlay, t: "Ao vivo", d: "Atualiza lutas e o público vê na hora." },
            { icon: Shield, t: "Papéis claros", d: "Owner, admin e staff — só quem precisa gere." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <f.icon className="mb-4 h-6 w-6 text-primary" />
              <p className="font-display text-lg font-semibold">{f.t}</p>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-white/35">
        © {new Date().getFullYear()} MatComp — competições para academias
      </footer>
    </div>
  );
}

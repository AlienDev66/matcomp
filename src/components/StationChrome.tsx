import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { getMesaToken, mesaTokenFromSearch, setMesaToken } from "@/lib/mesa-token";

type Props = {
  competitionId: string;
  title: string;
  subtitle?: string;
  tokenFromSearch?: string;
  children: ReactNode;
};

/** Shared chrome for day-of stations (pesagem / chamada / pódio). */
export function StationChrome({
  competitionId,
  title,
  subtitle,
  tokenFromSearch,
  children,
}: Props) {
  useEffect(() => {
    const t = tokenFromSearch || mesaTokenFromSearch(window.location.search);
    if (t) setMesaToken(t);
  }, [tokenFromSearch]);

  const hasToken = typeof window !== "undefined" && !!getMesaToken();

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10 sticky top-0 z-20 bg-[#0a0a0b]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo className="h-7 w-7 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary">{title}</p>
              <p className="font-display font-semibold truncate text-sm">{subtitle ?? "MatComp"}</p>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-white/50">
            <Link to="/mesa/$competitionId" params={{ competitionId }} className="hover:text-white">
              Mesas
            </Link>
            <Link
              to="/tv/$competitionId"
              params={{ competitionId }}
              className="hover:text-white"
              target="_blank"
            >
              TV
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {hasToken ? (
          <p className="text-xs text-emerald-400/80">Sessão staff ativa (token).</p>
        ) : (
          <p className="text-xs text-amber-400/90">
            Sem token — abre o link do organizador ou faz login de manager para gravar.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
